import { randomUUID } from 'node:crypto';
import { timingSafeSecretEqual } from './leaderboard-background-worker.ts';
import { readCompleteExposureSnapshot } from './tree-exposure-cache.ts';
import {
  TREE_ACTIVITY_INDEX_KEY,
  TREE_BADGE_REFRESH_LOCK_TTL_MS,
  TREE_BURN_INDEX_KEY,
  clearTreeBadgeRefreshLock,
  readCompleteTreeBadgeSnapshot,
  readInternalBadgeValue,
  readTreeBadgeRefreshLock,
  writeCompleteTreeBadgeSnapshot,
  writeInternalBadgeValue,
  writeTreeBadgeRefreshLock,
  writeTreeBadgeRefreshStatus,
  type TreeBadgeRefreshStatus,
  type TreeBadgeStore,
} from './tree-badge-cache.ts';
import {
  refreshTreeActivityIndex,
  type TreeActivityIndex,
  type TreeActivityRefreshResult,
} from './tree-activity-index.ts';
import {
  refreshTreeBurnIndex,
  type TreeBurnIndex,
  type TreeBurnRefreshResult,
} from './tree-burn-index.ts';
import { buildCompleteTreeBadgeSnapshot } from './tree-badge-snapshot-builder.ts';

export type TreeBadgeWorkerDependencies = {
  getEnv?: (name: string) => string | undefined;
  deployContext?: string;
  deployId?: string;
  now?: () => number;
  createRunId?: () => string;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  store?: TreeBadgeStore;
  readExposure?: (context: string) => ReturnType<typeof readCompleteExposureSnapshot>;
  refreshActivity?: typeof refreshTreeActivityIndex;
  refreshBurns?: typeof refreshTreeBurnIndex;
  logger?: Pick<Console, 'info' | 'error'>;
};

export type TreeBadgeWorkerResult = {
  accepted: boolean;
  started: boolean;
  outcome:
    | 'production-disabled'
    | 'authentication-failed'
    | 'method-not-allowed'
    | 'already-active'
    | 'exposure-not-ready'
    | 'complete'
    | 'verification-incomplete'
    | 'error';
};

function enabled(value: string | undefined): boolean {
  return (value || '').trim().toLowerCase() === 'true';
}

async function waitForExposure(
  context: string,
  readExposure: (context: string) => ReturnType<typeof readCompleteExposureSnapshot>,
  sleepImpl: (milliseconds: number) => Promise<void>,
  waitMs: number,
) {
  const deadline = Date.now() + waitMs;
  do {
    const snapshot = await readExposure(context);
    if (snapshot) return snapshot;
    if (Date.now() >= deadline) break;
    await sleepImpl(5_000);
  } while (true);
  return null;
}

export async function runTreeBadgeBackgroundWorker(
  request: Request,
  dependencies: TreeBadgeWorkerDependencies = {},
): Promise<TreeBadgeWorkerResult> {
  if (request.method !== 'POST') return { accepted: false, started: false, outcome: 'method-not-allowed' };
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const context = dependencies.deployContext || 'dev';
  if (context === 'production' && !enabled(getEnv('TREE_BADGE_PRODUCTION_ENABLED'))) {
    return { accepted: false, started: false, outcome: 'production-disabled' };
  }

  const configuredSecret = getEnv('TREE_BADGE_REFRESH_SECRET')
    || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
    || '';
  const requestSecret = request.headers.get('x-tree-badge-refresh-secret')
    || request.headers.get('x-tree-refresh-secret')
    || '';
  if (!configuredSecret || !requestSecret || !timingSafeSecretEqual(configuredSecret, requestSecret)) {
    return { accepted: false, started: false, outcome: 'authentication-failed' };
  }

  const now = dependencies.now ?? Date.now;
  const createRunId = dependencies.createRunId ?? randomUUID;
  const sleepImpl = dependencies.sleepImpl ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const logger = dependencies.logger ?? console;
  const storeOptions = { context, store: dependencies.store };
  const currentLock = await readTreeBadgeRefreshLock(storeOptions);
  if (currentLock && Date.parse(currentLock.expiresAt) > now()) {
    return { accepted: true, started: false, outcome: 'already-active' };
  }

  const runId = createRunId();
  const startedMs = now();
  const startedAt = new Date(startedMs).toISOString();
  const commitRef = getEnv('COMMIT_REF') || null;
  const deployId = dependencies.deployId || getEnv('DEPLOY_ID') || null;
  await writeTreeBadgeRefreshLock({
    runId,
    startedAt,
    expiresAt: new Date(startedMs + TREE_BADGE_REFRESH_LOCK_TTL_MS).toISOString(),
    commitRef,
    deployId,
  }, storeOptions);

  let status: TreeBadgeRefreshStatus = {
    state: 'queued',
    stage: 'queued',
    runId,
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    exposureSnapshotGeneratedAt: null,
    activityOutcome: 'pending',
    burnOutcome: 'pending',
    displayedCount: 0,
    message: 'TREE behavioral badge refresh queued.',
    commitRef,
    deployId,
  };

  const saveStatus = async (patch: Partial<TreeBadgeRefreshStatus>) => {
    status = { ...status, ...patch, updatedAt: new Date(now()).toISOString() };
    await writeTreeBadgeRefreshStatus(status, storeOptions);
  };

  try {
    await writeTreeBadgeRefreshStatus(status, storeOptions);
    await saveStatus({ state: 'running', stage: 'waiting-for-exposure', message: 'Waiting for a complete TREE exposure snapshot.' });
    const readExposure = dependencies.readExposure
      ?? ((deployContext) => readCompleteExposureSnapshot({ context: deployContext }));
    const waitMs = context === 'deploy-preview' ? 5 * 60 * 1000 : 0;
    const exposure = await waitForExposure(context, readExposure, sleepImpl, waitMs);
    if (!exposure) {
      await saveStatus({
        state: 'verification-incomplete', stage: 'failed', completedAt: new Date(now()).toISOString(),
        message: 'A complete exposure snapshot was not available; the prior badge snapshot was preserved.',
      });
      return { accepted: true, started: true, outcome: 'exposure-not-ready' };
    }
    await saveStatus({ exposureSnapshotGeneratedAt: exposure.generatedAt });

    const priorActivity = await readInternalBadgeValue<TreeActivityIndex>(TREE_ACTIVITY_INDEX_KEY, storeOptions);
    await saveStatus({ stage: 'activity', message: 'Refreshing the checkpointed rolling 30-day TREE trade ledger.' });
    const refreshActivity = dependencies.refreshActivity ?? refreshTreeActivityIndex;
    const activity: TreeActivityRefreshResult = await refreshActivity(priorActivity, {
      getEnv,
      now,
      sleepImpl,
      onPoolComplete: (index) => writeInternalBadgeValue(TREE_ACTIVITY_INDEX_KEY, index, storeOptions),
    } as never);
    await saveStatus({ activityOutcome: activity.outcome === 'complete' ? 'complete' : activity.outcome === 'error' ? 'error' : 'verification-incomplete' });
    if (activity.outcome !== 'complete' || !activity.index) {
      await saveStatus({
        state: activity.outcome === 'error' ? 'error' : 'verification-incomplete',
        stage: 'failed', completedAt: new Date(now()).toISOString(),
        message: 'The activity index did not complete; the prior complete badge snapshot was preserved.',
      });
      return { accepted: true, started: true, outcome: activity.outcome === 'error' ? 'error' : 'verification-incomplete' };
    }
    await writeInternalBadgeValue(TREE_ACTIVITY_INDEX_KEY, activity.index, storeOptions);

    const priorBurns = await readInternalBadgeValue<TreeBurnIndex>(TREE_BURN_INDEX_KEY, storeOptions);
    await saveStatus({ stage: 'burns', message: 'Refreshing checkpointed lifetime TREE burn attribution for the current Top 50.' });
    const refreshBurns = dependencies.refreshBurns ?? refreshTreeBurnIndex;
    const burns: TreeBurnRefreshResult = await refreshBurns(
      priorBurns,
      exposure.entries.map((entry) => entry.wallet),
      {
        now,
        sleepImpl,
        onWalletComplete: (index) => writeInternalBadgeValue(TREE_BURN_INDEX_KEY, index, storeOptions),
      },
    );
    await saveStatus({ burnOutcome: burns.outcome === 'complete' ? 'complete' : burns.outcome === 'error' ? 'error' : 'verification-incomplete' });
    if (burns.outcome !== 'complete' || !burns.index) {
      await saveStatus({
        state: burns.outcome === 'error' ? 'error' : 'verification-incomplete',
        stage: 'failed', completedAt: new Date(now()).toISOString(),
        message: 'The burn index did not complete; the prior complete badge snapshot was preserved.',
      });
      return { accepted: true, started: true, outcome: burns.outcome === 'error' ? 'error' : 'verification-incomplete' };
    }
    await writeInternalBadgeValue(TREE_BURN_INDEX_KEY, burns.index, storeOptions);

    await saveStatus({ stage: 'aggregate', message: 'Building the complete six-badge Top 50 snapshot.' });
    const snapshot = buildCompleteTreeBadgeSnapshot({
      exposure,
      activityIndex: activity.index,
      burnIndex: burns.index,
      activityWarnings: activity.warnings,
      burnWarnings: burns.warnings,
      generatedAt: new Date(now()).toISOString(),
    });
    if (!snapshot || !await writeCompleteTreeBadgeSnapshot(snapshot, storeOptions)) {
      await saveStatus({
        state: 'verification-incomplete', stage: 'failed', completedAt: new Date(now()).toISOString(),
        message: 'Final badge integrity validation failed; the prior complete badge snapshot was preserved.',
      });
      return { accepted: true, started: true, outcome: 'verification-incomplete' };
    }

    const completedAt = new Date(now()).toISOString();
    await saveStatus({
      state: 'complete', stage: 'complete', completedAt,
      displayedCount: snapshot.entries.length,
      message: 'Complete verified TREE behavioral badge snapshot stored.',
    });
    logger.info('TREE behavioral badge refresh completed.');
    return { accepted: true, started: true, outcome: 'complete' };
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'TREE badge refresh failed.');
    await saveStatus({
      state: 'error', stage: 'failed', completedAt: new Date(now()).toISOString(),
      message: 'TREE badge refresh failed; the prior complete badge snapshot was preserved.',
    });
    return { accepted: true, started: true, outcome: 'error' };
  } finally {
    await clearTreeBadgeRefreshLock(runId, storeOptions);
  }
}
