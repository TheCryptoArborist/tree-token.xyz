import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  REFRESH_LOCK_TTL_MS,
  clearRefreshLock,
  readRefreshLock,
  writeCompleteLeaderboardSnapshot,
  writeLeaderboardRefreshStatus,
  writeRefreshLock,
  type LeaderboardRefreshStatus,
  type LeaderboardStore,
} from './leaderboard-cache.ts';
import { readSuiGraphqlBackgroundConfig } from './sui-graphql-background-config.ts';
import {
  scanSuiGraphqlLeaderboard,
  type ScanProgress,
  type SuiGraphqlScanResult,
} from './sui-graphql-leaderboard-provider.ts';

type WorkerDependencies = {
  getEnv?: (name: string) => string | undefined;
  now?: () => number;
  createRunId?: () => string;
  scan?: typeof scanSuiGraphqlLeaderboard;
  store?: LeaderboardStore;
  logger?: Pick<Console, 'info' | 'error'>;
};

export type BackgroundWorkerResult = {
  accepted: boolean;
  started: boolean;
  outcome: 'authentication-failed' | 'method-not-allowed' | 'already-active' | 'complete' | 'verification-incomplete' | 'error';
};

export function timingSafeSecretEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function statusFromProgress(base: LeaderboardRefreshStatus, progress: ScanProgress, updatedAt: string): LeaderboardRefreshStatus {
  return {
    ...base,
    state: 'running',
    updatedAt,
    pagesScanned: progress.pagesScanned,
    objectsScanned: progress.objectsScanned,
    addressOwnedCoinObjects: progress.addressOwnedCoinObjects,
    uniqueAddressOwners: progress.uniqueAddressOwners,
    excludedAddresses: progress.excludedAddresses,
    elapsedMs: progress.elapsedMs,
    hasNextPage: progress.hasNextPage,
    reachedEnd: false,
    scanComplete: false,
    message: 'Building a complete verified TREE leaderboard snapshot.',
  };
}

export async function runLeaderboardBackgroundWorker(request: Request, dependencies: WorkerDependencies = {}): Promise<BackgroundWorkerResult> {
  if (request.method !== 'POST') return { accepted: false, started: false, outcome: 'method-not-allowed' };
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const configuredSecret = getEnv('TREE_LEADERBOARD_REFRESH_SECRET') || '';
  const requestSecret = request.headers.get('x-tree-refresh-secret') || '';
  if (!configuredSecret || !requestSecret || !timingSafeSecretEqual(configuredSecret, requestSecret)) {
    return { accepted: false, started: false, outcome: 'authentication-failed' };
  }

  const now = dependencies.now ?? Date.now;
  const createRunId = dependencies.createRunId ?? randomUUID;
  const scan = dependencies.scan ?? scanSuiGraphqlLeaderboard;
  const logger = dependencies.logger ?? console;
  const context = getEnv('CONTEXT') || 'dev';
  const storeOptions = { context, store: dependencies.store };
  const commitRef = getEnv('COMMIT_REF') || null;
  const deployId = getEnv('DEPLOY_ID') || null;
  const currentLock = await readRefreshLock(storeOptions);
  if (currentLock && Date.parse(currentLock.expiresAt) > now()) {
    logger.info('TREE leaderboard refresh is already active.');
    return { accepted: true, started: false, outcome: 'already-active' };
  }

  const runId = createRunId();
  const startedMs = now();
  const startedAt = new Date(startedMs).toISOString();
  await writeRefreshLock({
    runId,
    startedAt,
    expiresAt: new Date(startedMs + REFRESH_LOCK_TTL_MS).toISOString(),
    commitRef,
    deployId,
  }, storeOptions);

  let status: LeaderboardRefreshStatus = {
    state: 'queued',
    runId,
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    pagesScanned: 0,
    objectsScanned: 0,
    addressOwnedCoinObjects: 0,
    uniqueAddressOwners: 0,
    excludedAddresses: 0,
    elapsedMs: 0,
    hasNextPage: false,
    reachedEnd: false,
    scanComplete: false,
    message: 'TREE leaderboard refresh queued.',
    commitRef,
    deployId,
  };

  try {
    await writeLeaderboardRefreshStatus(status, storeOptions);
    status = { ...status, state: 'running', updatedAt: new Date(now()).toISOString(), message: 'Building a complete verified TREE leaderboard snapshot.' };
    await writeLeaderboardRefreshStatus(status, storeOptions);
    const config = readSuiGraphqlBackgroundConfig(getEnv);
    const result = await scan({
      ...config,
      onProgress: async (progress) => {
        status = statusFromProgress(status, progress, new Date(now()).toISOString());
        await writeLeaderboardRefreshStatus(status, storeOptions);
      },
    });
    const completedAt = new Date(now()).toISOString();
    const terminalState = result.outcome === 'complete' ? 'complete' : result.outcome;
    let snapshotWritten = false;
    if (terminalState === 'complete') snapshotWritten = await writeCompleteLeaderboardSnapshot(result, storeOptions);
    const effectiveState = terminalState === 'complete' && !snapshotWritten ? 'verification-incomplete' : terminalState;
    status = {
      ...status,
      state: effectiveState,
      updatedAt: completedAt,
      completedAt,
      pagesScanned: result.coverage.pagesScanned,
      objectsScanned: result.coverage.objectsScanned,
      addressOwnedCoinObjects: result.coverage.addressOwnedCoinObjects,
      uniqueAddressOwners: result.coverage.uniqueAddressOwners,
      excludedAddresses: result.coverage.excludedAddresses,
      elapsedMs: result.coverage.elapsedMs,
      hasNextPage: result.coverage.hasNextPage,
      reachedEnd: result.coverage.reachedEnd,
      scanComplete: snapshotWritten,
      message: snapshotWritten
        ? 'A complete verified TREE leaderboard snapshot is available.'
        : effectiveState === 'error'
          ? 'The TREE leaderboard refresh failed without replacing verified rankings.'
          : 'The TREE leaderboard refresh was incomplete; verified rankings were preserved.',
    };
    await writeLeaderboardRefreshStatus(status, storeOptions);
    return { accepted: true, started: true, outcome: effectiveState };
  } catch {
    const completedAt = new Date(now()).toISOString();
    status = {
      ...status,
      state: 'error',
      updatedAt: completedAt,
      completedAt,
      scanComplete: false,
      message: 'The TREE leaderboard refresh failed without replacing verified rankings.',
    };
    try { await writeLeaderboardRefreshStatus(status, storeOptions); } catch { /* Preserve the generic failure path. */ }
    logger.error('TREE leaderboard background refresh failed.');
    return { accepted: true, started: true, outcome: 'error' };
  } finally {
    try { await clearRefreshLock(runId, storeOptions); } catch { /* The lock expires automatically. */ }
  }
}

export type { SuiGraphqlScanResult };
