import { getStore } from '@netlify/blobs';
import {
  DirectTreeEntry,
  METHODOLOGY_VERSION,
  SUI_GRAPHQL_CACHED_PROVIDER,
  SUI_GRAPHQL_PROVIDER,
} from './leaderboard-provider.ts';
import type { Reconciliation, ScanCoverage, SuiGraphqlScanResult } from './sui-graphql-leaderboard-provider.ts';

export const LEADERBOARD_STORE_NAME = 'tree-leaderboard';

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

export type LeaderboardStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
};

export function sanitizeCacheScope(value: string | undefined, fallback: string): string {
  const sanitized = (value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return sanitized || fallback;
}

export function leaderboardCacheKey(context: string | undefined, branch: string | undefined): string {
  return `complete:${sanitizeCacheScope(context, 'dev')}:${sanitizeCacheScope(branch, 'local')}`;
}

function defaultStore(): LeaderboardStore {
  return getStore({ name: LEADERBOARD_STORE_NAME, consistency: 'strong' }) as unknown as LeaderboardStore;
}

export async function readCompleteLeaderboardSnapshot(options: {
  context?: string;
  branch?: string;
  store?: LeaderboardStore;
}): Promise<CompleteLeaderboardSnapshot | null> {
  const store = options.store ?? defaultStore();
  const value = await store.get(leaderboardCacheKey(options.context, options.branch), { type: 'json' });
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as CompleteLeaderboardSnapshot;
  if (snapshot.methodologyVersion !== METHODOLOGY_VERSION
    || snapshot.provider !== SUI_GRAPHQL_PROVIDER
    || !Array.isArray(snapshot.entries)
    || snapshot.coverage?.scanComplete !== true
    || snapshot.reconciliation?.valid !== true) return null;
  return snapshot;
}

export async function writeCompleteLeaderboardSnapshot(scan: SuiGraphqlScanResult, options: {
  context?: string;
  branch?: string;
  store?: LeaderboardStore;
}): Promise<boolean> {
  if (scan.outcome !== 'complete' || !scan.coverage.scanComplete || !scan.reconciliation.valid || scan.holderCount === null) return false;
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
  const store = options.store ?? defaultStore();
  await store.setJSON(leaderboardCacheKey(options.context, options.branch), snapshot);
  return true;
}

export function resolveLeaderboardRefresh(scan: SuiGraphqlScanResult, cached: CompleteLeaderboardSnapshot | null) {
  if (scan.outcome === 'complete') {
    return {
      status: 'ok' as const,
      provider: SUI_GRAPHQL_PROVIDER,
      generatedAt: scan.generatedAt,
      snapshotGeneratedAt: scan.generatedAt,
      methodologyVersion: METHODOLOGY_VERSION,
      coverage: scan.coverage,
      refreshCoverage: null,
      reconciliation: scan.reconciliation,
      holderCount: scan.holderCount,
      displayedCount: scan.displayedCount,
      excludedCount: scan.excludedCount,
      entries: scan.entries,
      warnings: scan.warnings,
    };
  }
  if (cached) {
    return {
      status: 'stale' as const,
      provider: SUI_GRAPHQL_CACHED_PROVIDER,
      generatedAt: scan.generatedAt,
      snapshotGeneratedAt: cached.generatedAt,
      methodologyVersion: METHODOLOGY_VERSION,
      coverage: cached.coverage,
      refreshCoverage: scan.coverage,
      reconciliation: cached.reconciliation,
      holderCount: cached.holderCount,
      displayedCount: cached.displayedCount,
      excludedCount: cached.excludedCount,
      entries: cached.entries,
      warnings: ['Displayed rows are from the last complete Sui-native scan.', ...scan.warnings],
    };
  }
  return {
    status: scan.outcome === 'error' ? 'error' as const : 'verification-incomplete' as const,
    provider: SUI_GRAPHQL_PROVIDER,
    generatedAt: scan.generatedAt,
    snapshotGeneratedAt: null,
    methodologyVersion: METHODOLOGY_VERSION,
    coverage: scan.coverage,
    refreshCoverage: scan.coverage,
    reconciliation: scan.reconciliation,
    holderCount: null,
    displayedCount: 0,
    excludedCount: scan.excludedCount,
    entries: [],
    warnings: scan.warnings,
  };
}
