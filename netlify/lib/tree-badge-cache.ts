import { getDeployStore, getStore } from '@netlify/blobs';
import { normalizeSuiAddress } from './leaderboard-provider.ts';
import {
  BEHAVIOR_BADGE_ORDER,
  TREE_BADGE_METHODOLOGY_VERSION,
  TREE_BADGE_SNAPSHOT_PROVIDER,
  expectedBehaviorBadges,
  type CompleteTreeBadgeSnapshot,
  type TreeBehaviorBadgeEntry,
} from './tree-badge-types.ts';

export const TREE_BADGE_STORE_NAME = 'tree-leaderboard-badges';
export const COMPLETE_TREE_BADGE_SNAPSHOT_KEY = 'complete';
export const TREE_BADGE_REFRESH_STATUS_KEY = 'refresh-status';
export const TREE_BADGE_REFRESH_LOCK_KEY = 'refresh-lock';
export const TREE_ACTIVITY_INDEX_KEY = 'activity-index';
export const TREE_BURN_INDEX_KEY = 'burn-index';
export const TREE_BADGE_REFRESH_LOCK_TTL_MS = 30 * 60 * 1000;

export type TreeBadgeRefreshState = 'idle' | 'queued' | 'running' | 'complete' | 'verification-incomplete' | 'error';
export type TreeBadgeRefreshStage = 'queued' | 'waiting-for-exposure' | 'activity' | 'burns' | 'aggregate' | 'complete' | 'failed';

export type TreeBadgeRefreshStatus = {
  state: TreeBadgeRefreshState;
  stage: TreeBadgeRefreshStage;
  runId: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  exposureSnapshotGeneratedAt: string | null;
  activityOutcome: 'pending' | 'complete' | 'verification-incomplete' | 'error';
  burnOutcome: 'pending' | 'complete' | 'verification-incomplete' | 'error';
  displayedCount: number;
  message: string;
  commitRef: string | null;
  deployId: string | null;
};

export type TreeBadgeRefreshLock = {
  runId: string;
  startedAt: string;
  expiresAt: string;
  commitRef: string | null;
  deployId: string | null;
};

export type TreeBadgeStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

export type TreeBadgeStoreFactories = {
  getStore: (name: string, options: { consistency: 'strong' }) => unknown;
  getDeployStore: (name: string) => unknown;
};

const defaultFactories: TreeBadgeStoreFactories = {
  getStore: (name, options) => getStore(name, options),
  getDeployStore: (name) => getDeployStore(name),
};

export function selectTreeBadgeStore(
  context: string | undefined,
  factories: TreeBadgeStoreFactories = defaultFactories,
): TreeBadgeStore {
  return (context === 'production'
    ? factories.getStore(TREE_BADGE_STORE_NAME, { consistency: 'strong' })
    : factories.getDeployStore(TREE_BADGE_STORE_NAME)) as TreeBadgeStore;
}

type StoreOptions = { context?: string; store?: TreeBadgeStore };

function resolveStore(options: StoreOptions): TreeBadgeStore {
  return options.store ?? selectTreeBadgeStore(options.context);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateEntry(value: unknown, expectedRank: number): value is TreeBehaviorBadgeEntry {
  const entry = record(value) as Partial<TreeBehaviorBadgeEntry>;
  const wallet = normalizeSuiAddress(entry.wallet);
  if (!wallet || wallet !== entry.wallet || entry.rank !== expectedRank) return false;
  const activity = record(entry.activity30d) as TreeBehaviorBadgeEntry['activity30d'];
  const burn = record(entry.burn) as TreeBehaviorBadgeEntry['burn'];
  const expected = expectedBehaviorBadges(activity, burn);
  if (!expected || !Array.isArray(entry.badges)) return false;
  return entry.badges.length === expected.length
    && entry.badges.every((badge, index) => badge === expected[index]);
}

export function validateCompleteTreeBadgeSnapshot(value: unknown): value is CompleteTreeBadgeSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as CompleteTreeBadgeSnapshot;
  if (snapshot.outcome !== 'complete'
    || snapshot.provider !== TREE_BADGE_SNAPSHOT_PROVIDER
    || snapshot.methodologyVersion !== TREE_BADGE_METHODOLOGY_VERSION
    || !validDate(snapshot.generatedAt)
    || !validDate(snapshot.exposureSnapshotGeneratedAt)
    || snapshot.displayedCount !== 50
    || !Array.isArray(snapshot.entries)
    || snapshot.entries.length !== 50
    || !Array.isArray(snapshot.warnings)
    || !snapshot.warnings.every((warning) => typeof warning === 'string')) return false;

  const wallets = new Set<string>();
  const counts = Object.fromEntries(BEHAVIOR_BADGE_ORDER.map((badge) => [badge, 0])) as Record<string, number>;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const entry = snapshot.entries[index];
    if (!validateEntry(entry, index + 1) || wallets.has(entry.wallet)) return false;
    wallets.add(entry.wallet);
    for (const badge of entry.badges) counts[badge] += 1;
  }

  const source = record(snapshot.source);
  const activity = record(source.activity);
  const burns = record(source.burns);
  if (activity.outcome !== 'complete'
    || burns.outcome !== 'complete'
    || !validDate(activity.generatedAt)
    || !validDate(activity.windowStart)
    || !validDate(activity.windowEnd)
    || !validNonNegativeInteger(activity.poolCount)
    || !validNonNegativeInteger(activity.transactionCount)
    || !Array.isArray(activity.warnings)
    || !activity.warnings.every((warning) => typeof warning === 'string')
    || !validDate(burns.generatedAt)
    || typeof burns.indexedThroughCheckpoint !== 'string'
    || !/^\d+$/.test(burns.indexedThroughCheckpoint)
    || !validNonNegativeInteger(burns.walletCount)
    || !Array.isArray(burns.warnings)
    || !burns.warnings.every((warning) => typeof warning === 'string')) return false;

  const summary = record(snapshot.summary);
  return summary.diamondHands === counts['diamond-hands']
    && summary.paperHands === counts['paper-hands']
    && summary.accumulator === counts.accumulator
    && summary.burned === counts.burned;
}

export async function readCompleteTreeBadgeSnapshot(options: StoreOptions = {}): Promise<CompleteTreeBadgeSnapshot | null> {
  const value = await resolveStore(options).get(COMPLETE_TREE_BADGE_SNAPSHOT_KEY, { type: 'json' });
  return validateCompleteTreeBadgeSnapshot(value) ? value : null;
}

export async function writeCompleteTreeBadgeSnapshot(
  snapshot: CompleteTreeBadgeSnapshot,
  options: StoreOptions = {},
): Promise<boolean> {
  if (!validateCompleteTreeBadgeSnapshot(snapshot)) return false;
  await resolveStore(options).setJSON(COMPLETE_TREE_BADGE_SNAPSHOT_KEY, snapshot);
  return true;
}

function sanitizeStatus(status: TreeBadgeRefreshStatus): TreeBadgeRefreshStatus {
  return {
    state: status.state,
    stage: status.stage,
    runId: status.runId,
    startedAt: status.startedAt,
    updatedAt: status.updatedAt,
    completedAt: status.completedAt,
    exposureSnapshotGeneratedAt: status.exposureSnapshotGeneratedAt,
    activityOutcome: status.activityOutcome,
    burnOutcome: status.burnOutcome,
    displayedCount: status.displayedCount,
    message: status.message,
    commitRef: status.commitRef,
    deployId: status.deployId,
  };
}

export async function readTreeBadgeRefreshStatus(options: StoreOptions = {}): Promise<TreeBadgeRefreshStatus | null> {
  const value = await resolveStore(options).get(TREE_BADGE_REFRESH_STATUS_KEY, { type: 'json' });
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as TreeBadgeRefreshStatus
    : null;
}

export async function writeTreeBadgeRefreshStatus(
  status: TreeBadgeRefreshStatus,
  options: StoreOptions = {},
): Promise<void> {
  await resolveStore(options).setJSON(TREE_BADGE_REFRESH_STATUS_KEY, sanitizeStatus(status));
}

export async function readTreeBadgeRefreshLock(options: StoreOptions = {}): Promise<TreeBadgeRefreshLock | null> {
  const value = await resolveStore(options).get(TREE_BADGE_REFRESH_LOCK_KEY, { type: 'json' });
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as TreeBadgeRefreshLock
    : null;
}

export async function writeTreeBadgeRefreshLock(
  lock: TreeBadgeRefreshLock,
  options: StoreOptions = {},
): Promise<void> {
  await resolveStore(options).setJSON(TREE_BADGE_REFRESH_LOCK_KEY, lock);
}

export async function clearTreeBadgeRefreshLock(runId: string, options: StoreOptions = {}): Promise<boolean> {
  const store = resolveStore(options);
  const current = await readTreeBadgeRefreshLock({ store });
  if (!current || current.runId !== runId) return false;
  await store.delete(TREE_BADGE_REFRESH_LOCK_KEY);
  return true;
}

export async function readInternalBadgeValue<T>(key: string, options: StoreOptions = {}): Promise<T | null> {
  const value = await resolveStore(options).get(key, { type: 'json' });
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : null;
}

export async function writeInternalBadgeValue(key: string, value: unknown, options: StoreOptions = {}): Promise<void> {
  await resolveStore(options).setJSON(key, value);
}
