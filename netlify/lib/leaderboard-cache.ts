import { getDeployStore, getStore } from '@netlify/blobs';
import {
  METHODOLOGY_VERSION,
  SUI_GRAPHQL_PROVIDER,
  type DirectTreeEntry,
} from './leaderboard-provider.ts';
import type { Reconciliation, ScanCoverage, SuiGraphqlScanResult } from './sui-graphql-leaderboard-provider.ts';

export const LEADERBOARD_STORE_NAME = 'tree-leaderboard';
export const COMPLETE_SNAPSHOT_KEY = 'complete';
export const REFRESH_STATUS_KEY = 'refresh-status';
export const REFRESH_LOCK_KEY = 'refresh-lock';
export const REFRESH_LOCK_TTL_MS = 20 * 60 * 1000;

export type CompleteLeaderboardSnapshot = {
  generatedAt: string;
  provider: typeof SUI_GRAPHQL_PROVIDER;
  methodologyVersion: typeof METHODOLOGY_VERSION;
  entries: DirectTreeEntry[];
  holderCount: number;
  displayedCount: number;
  excludedCount: number;
  coverage: ScanCoverage;
  reconciliation: Reconciliation;
  sourceCheckpoint: SuiGraphqlScanResult['sourceCheckpoint'];
};

export type LeaderboardRefreshState = 'idle' | 'queued' | 'running' | 'complete' | 'verification-incomplete' | 'error';

export type LeaderboardRefreshStatus = {
  state: LeaderboardRefreshState;
  runId: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  pagesScanned: number;
  objectsScanned: number;
  addressOwnedCoinObjects: number;
  uniqueAddressOwners: number;
  excludedAddresses: number;
  elapsedMs: number;
  hasNextPage: boolean;
  reachedEnd: boolean;
  scanComplete: boolean;
  message: string;
  commitRef: string | null;
  deployId: string | null;
};

export type LeaderboardRefreshLock = {
  runId: string;
  startedAt: string;
  expiresAt: string;
  commitRef: string | null;
  deployId: string | null;
};

export type LeaderboardStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

export type LeaderboardStoreFactories = {
  getStore: (name: string, options: { consistency: 'strong' }) => unknown;
  getDeployStore: (name: string) => unknown;
};

const defaultFactories: LeaderboardStoreFactories = {
  getStore: (name, options) => getStore(name, options),
  getDeployStore: (name) => getDeployStore(name),
};

export function selectLeaderboardStore(
  context: string | undefined,
  factories: LeaderboardStoreFactories = defaultFactories,
): LeaderboardStore {
  return (context === 'production'
    ? factories.getStore(LEADERBOARD_STORE_NAME, { consistency: 'strong' })
    : factories.getDeployStore(LEADERBOARD_STORE_NAME)) as LeaderboardStore;
}

type StoreOptions = { context?: string; store?: LeaderboardStore };

function resolveStore(options: StoreOptions): LeaderboardStore {
  return options.store ?? selectLeaderboardStore(options.context);
}

export async function readCompleteLeaderboardSnapshot(options: StoreOptions = {}): Promise<CompleteLeaderboardSnapshot | null> {
  const value = await resolveStore(options).get(COMPLETE_SNAPSHOT_KEY, { type: 'json' });
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as CompleteLeaderboardSnapshot;
  if (snapshot.methodologyVersion !== METHODOLOGY_VERSION
    || snapshot.provider !== SUI_GRAPHQL_PROVIDER
    || !Number.isFinite(Date.parse(snapshot.generatedAt))
    || !Array.isArray(snapshot.entries)
    || snapshot.coverage?.scanComplete !== true
    || snapshot.coverage?.reachedEnd !== true
    || snapshot.reconciliation?.valid !== true) return null;
  return snapshot;
}

export async function writeCompleteLeaderboardSnapshot(scan: SuiGraphqlScanResult, options: StoreOptions = {}): Promise<boolean> {
  const integrityValid = scan.coverage.malformedOwnerAddresses === 0
    && scan.coverage.malformedBalances === 0
    && scan.coverage.unknownOwnerObjectsSkipped === 0
    && scan.coverage.duplicateObjectIds === 0;
  if (scan.outcome !== 'complete'
    || !scan.coverage.scanComplete
    || !scan.coverage.reachedEnd
    || !scan.reconciliation.valid
    || !integrityValid
    || scan.holderCount === null) return false;
  const snapshot: CompleteLeaderboardSnapshot = {
    generatedAt: scan.generatedAt,
    provider: SUI_GRAPHQL_PROVIDER,
    methodologyVersion: METHODOLOGY_VERSION,
    entries: scan.entries,
    holderCount: scan.holderCount,
    displayedCount: scan.displayedCount,
    excludedCount: scan.excludedCount,
    coverage: scan.coverage,
    reconciliation: scan.reconciliation,
    sourceCheckpoint: scan.sourceCheckpoint,
  };
  await resolveStore(options).setJSON(COMPLETE_SNAPSHOT_KEY, snapshot);
  return true;
}

function sanitizeRefreshStatus(status: LeaderboardRefreshStatus): LeaderboardRefreshStatus {
  return {
    state: status.state,
    runId: status.runId,
    startedAt: status.startedAt,
    updatedAt: status.updatedAt,
    completedAt: status.completedAt,
    pagesScanned: status.pagesScanned,
    objectsScanned: status.objectsScanned,
    addressOwnedCoinObjects: status.addressOwnedCoinObjects,
    uniqueAddressOwners: status.uniqueAddressOwners,
    excludedAddresses: status.excludedAddresses,
    elapsedMs: status.elapsedMs,
    hasNextPage: status.hasNextPage,
    reachedEnd: status.reachedEnd,
    scanComplete: status.scanComplete,
    message: status.message,
    commitRef: status.commitRef,
    deployId: status.deployId,
  };
}

export async function readLeaderboardRefreshStatus(options: StoreOptions = {}): Promise<LeaderboardRefreshStatus | null> {
  const value = await resolveStore(options).get(REFRESH_STATUS_KEY, { type: 'json' });
  return value && typeof value === 'object' ? value as LeaderboardRefreshStatus : null;
}

export async function writeLeaderboardRefreshStatus(status: LeaderboardRefreshStatus, options: StoreOptions = {}): Promise<void> {
  await resolveStore(options).setJSON(REFRESH_STATUS_KEY, sanitizeRefreshStatus(status));
}

export async function readRefreshLock(options: StoreOptions = {}): Promise<LeaderboardRefreshLock | null> {
  const value = await resolveStore(options).get(REFRESH_LOCK_KEY, { type: 'json' });
  return value && typeof value === 'object' ? value as LeaderboardRefreshLock : null;
}

export async function writeRefreshLock(lock: LeaderboardRefreshLock, options: StoreOptions = {}): Promise<void> {
  await resolveStore(options).setJSON(REFRESH_LOCK_KEY, lock);
}

export async function clearRefreshLock(runId: string, options: StoreOptions = {}): Promise<boolean> {
  const store = resolveStore(options);
  const current = await readRefreshLock({ store });
  if (!current || current.runId !== runId) return false;
  await store.delete(REFRESH_LOCK_KEY);
  return true;
}
