import { randomUUID } from 'node:crypto';
import { timingSafeSecretEqual } from './leaderboard-background-worker.ts';
import {
  EXPOSURE_REFRESH_LOCK_TTL_MS,
  clearExposureRefreshLock,
  readExposureRefreshLock,
  writeCompleteExposureSnapshot,
  writeExposureRefreshLock,
  writeExposureRefreshStatus,
  type ExposureRefreshStage,
  type ExposureRefreshStatus,
  type ExposureStore,
} from './tree-exposure-cache.ts';
import {
  runCompleteTreeExposureScan,
  type CompleteExposureScanResult,
  type ExposureScanProgress,
  type ExposureScanRunnerDependencies,
} from './tree-exposure-scan-runner.ts';

export type ExposureWorkerDependencies = {
  getEnv?: (name: string) => string | undefined;
  deployContext?: string;
  deployId?: string;
  now?: () => number;
  createRunId?: () => string;
  runScan?: (dependencies: ExposureScanRunnerDependencies) => Promise<CompleteExposureScanResult>;
  scanDependencies?: Omit<ExposureScanRunnerDependencies, 'getEnv' | 'onProgress' | 'now'>;
  store?: ExposureStore;
  logger?: Pick<Console, 'info' | 'error'>;
};

export type ExposureBackgroundWorkerResult = {
  accepted: boolean;
  started: boolean;
  outcome: 'production-disabled' | 'authentication-failed' | 'method-not-allowed' | 'already-active' | 'complete' | 'verification-incomplete' | 'error';
};

function productionEnabled(getEnv: (name: string) => string | undefined): boolean {
  return (getEnv('TREE_EXPOSURE_PRODUCTION_ENABLED') || '').trim().toLowerCase() === 'true';
}

function cacheStage(stage: ExposureScanProgress['stage']): ExposureRefreshStage {
  return stage === 'failed' ? 'failed' : stage;
}

function statusFromProgress(
  base: ExposureRefreshStatus,
  progress: ExposureScanProgress,
  updatedAt: string,
): ExposureRefreshStatus {
  return {
    ...base,
    state: progress.stage === 'complete' ? 'running' : 'running',
    stage: cacheStage(progress.stage),
    updatedAt,
    directPagesScanned: progress.directPagesScanned,
    directObjectsScanned: progress.directObjectsScanned,
    directUniqueOwners: progress.directUniqueOwners,
    venueOutcomes: { ...progress.venueOutcomes },
    message: progress.message,
  };
}

export async function runExposureBackgroundWorker(
  request: Request,
  dependencies: ExposureWorkerDependencies = {},
): Promise<ExposureBackgroundWorkerResult> {
  if (request.method !== 'POST') return { accepted: false, started: false, outcome: 'method-not-allowed' };
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const deployContext = dependencies.deployContext || 'dev';
  if (deployContext === 'production' && !productionEnabled(getEnv)) {
    return { accepted: false, started: false, outcome: 'production-disabled' };
  }

  const configuredSecret = getEnv('TREE_EXPOSURE_REFRESH_SECRET')
    || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
    || '';
  const requestSecret = request.headers.get('x-tree-exposure-refresh-secret')
    || request.headers.get('x-tree-refresh-secret')
    || '';
  if (!configuredSecret || !requestSecret || !timingSafeSecretEqual(configuredSecret, requestSecret)) {
    return { accepted: false, started: false, outcome: 'authentication-failed' };
  }

  const now = dependencies.now ?? Date.now;
  const createRunId = dependencies.createRunId ?? randomUUID;
  const runScan = dependencies.runScan ?? runCompleteTreeExposureScan;
  const logger = dependencies.logger ?? console;
  const storeOptions = { context: deployContext, store: dependencies.store };
  const commitRef = getEnv('COMMIT_REF') || null;
  const deployId = dependencies.deployId || getEnv('DEPLOY_ID') || null;
  const currentLock = await readExposureRefreshLock(storeOptions);
  if (currentLock && Date.parse(currentLock.expiresAt) > now()) {
    logger.info('TREE exposure refresh is already active.');
    return { accepted: true, started: false, outcome: 'already-active' };
  }

  const runId = createRunId();
  const startedMs = now();
  const startedAt = new Date(startedMs).toISOString();
  await writeExposureRefreshLock({
    runId,
    startedAt,
    expiresAt: new Date(startedMs + EXPOSURE_REFRESH_LOCK_TTL_MS).toISOString(),
    commitRef,
    deployId,
  }, storeOptions);

  let status: ExposureRefreshStatus = {
    state: 'queued',
    stage: 'queued',
    runId,
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    directPagesScanned: 0,
    directObjectsScanned: 0,
    directUniqueOwners: 0,
    venueOutcomes: {
      suiDexV2: 'pending',
      suiDexV3: 'pending',
      turbos: 'pending',
    },
    totalExposureComplete: false,
    displayedCount: 0,
    message: 'TREE exposure refresh queued.',
    commitRef,
    deployId,
  };

  try {
    await writeExposureRefreshStatus(status, storeOptions);
    status = {
      ...status,
      state: 'running',
      stage: 'direct-tree',
      updatedAt: new Date(now()).toISOString(),
      message: 'Building a complete verified Liquid TREE plus LP snapshot.',
    };
    await writeExposureRefreshStatus(status, storeOptions);

    const result = await runScan({
      ...dependencies.scanDependencies,
      getEnv,
      now,
      onProgress: async (progress) => {
        status = statusFromProgress(status, progress, new Date(now()).toISOString());
        await writeExposureRefreshStatus(status, storeOptions);
      },
    });

    const completedAt = new Date(now()).toISOString();
    let effectiveOutcome: ExposureBackgroundWorkerResult['outcome'] = result.outcome;
    let snapshotWritten = false;
    if (result.outcome === 'complete' && result.snapshot) {
      snapshotWritten = await writeCompleteExposureSnapshot(result.snapshot, storeOptions);
      if (!snapshotWritten) effectiveOutcome = 'verification-incomplete';
    }
    status = {
      ...status,
      state: effectiveOutcome === 'complete'
        ? 'complete'
        : effectiveOutcome === 'error'
          ? 'error'
          : 'verification-incomplete',
      stage: effectiveOutcome === 'complete' ? 'complete' : 'failed',
      updatedAt: completedAt,
      completedAt,
      totalExposureComplete: effectiveOutcome === 'complete' && snapshotWritten,
      displayedCount: effectiveOutcome === 'complete' && result.snapshot ? result.snapshot.entries.length : 0,
      message: effectiveOutcome === 'complete'
        ? 'Complete verified TREE exposure snapshot stored.'
        : result.outcome === 'complete'
          ? 'The completed scan failed final cache validation; the prior snapshot was preserved.'
          : 'The exposure refresh did not produce a complete snapshot; the prior snapshot was preserved.',
    };
    await writeExposureRefreshStatus(status, storeOptions);
    logger.info(`TREE exposure refresh finished with outcome ${effectiveOutcome}.`);
    return { accepted: true, started: true, outcome: effectiveOutcome };
  } catch (error) {
    const completedAt = new Date(now()).toISOString();
    status = {
      ...status,
      state: 'error',
      stage: 'failed',
      updatedAt: completedAt,
      completedAt,
      totalExposureComplete: false,
      displayedCount: 0,
      message: 'TREE exposure refresh failed; the prior complete snapshot was preserved.',
    };
    await writeExposureRefreshStatus(status, storeOptions);
    logger.error(error instanceof Error ? error.message : 'TREE exposure refresh failed.');
    return { accepted: true, started: true, outcome: 'error' };
  } finally {
    await clearExposureRefreshLock(runId, storeOptions);
  }
}
