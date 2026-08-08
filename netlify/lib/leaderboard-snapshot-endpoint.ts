import {
  readCompleteLeaderboardSnapshot,
  readLeaderboardRefreshStatus,
  type CompleteLeaderboardSnapshot,
  type LeaderboardRefreshStatus,
} from './leaderboard-cache.ts';
import { METHODOLOGY_VERSION } from './leaderboard-provider.ts';
import { readLeaderboardStaleAfterMs } from './sui-graphql-background-config.ts';

export type SnapshotEndpointDependencies = {
  context?: string;
  now?: () => number;
  getEnv?: (name: string) => string | undefined;
  readSnapshot?: () => Promise<CompleteLeaderboardSnapshot | null>;
  readRefreshStatus?: () => Promise<LeaderboardRefreshStatus | null>;
};

export type PublicLeaderboardRefreshStatus = {
  state: LeaderboardRefreshStatus['state'];
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
};

function publicRefreshStatus(status: LeaderboardRefreshStatus | null): PublicLeaderboardRefreshStatus | null {
  if (!status) return null;
  return {
    state: status.state,
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
  };
}

export async function resolveLeaderboardSnapshotPayload(dependencies: SnapshotEndpointDependencies = {}) {
  const now = dependencies.now ?? Date.now;
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const context = dependencies.context ?? getEnv('CONTEXT') ?? 'dev';
  const readSnapshot = dependencies.readSnapshot ?? (() => readCompleteLeaderboardSnapshot({ context }));
  const readStatus = dependencies.readRefreshStatus ?? (() => readLeaderboardRefreshStatus({ context }));
  const [snapshot, storedStatus] = await Promise.all([readSnapshot(), readStatus()]);
  const refreshStatus = publicRefreshStatus(storedStatus);
  const refreshState = refreshStatus?.state ?? 'idle';
  const responseGeneratedAt = new Date(now()).toISOString();

  if (!snapshot) {
    const refreshing = refreshState === 'queued' || refreshState === 'running';
    const message = refreshing
      ? 'Building the first verified TREE leaderboard snapshot.'
      : 'A complete verified TREE leaderboard snapshot is not available yet.';
    return {
      status: refreshing ? 'refreshing' as const : 'not-ready' as const,
      provider: 'sui-graphql-snapshot',
      generatedAt: responseGeneratedAt,
      snapshotGeneratedAt: null,
      snapshotAgeMs: null,
      refreshState,
      refreshStatus,
      methodologyVersion: METHODOLOGY_VERSION,
      coverage: null,
      reconciliation: null,
      holderCount: null,
      displayedCount: 0,
      excludedCount: refreshStatus?.excludedAddresses ?? 0,
      entries: [],
      warnings: refreshState === 'verification-incomplete' || refreshState === 'error'
        ? ['The latest background refresh did not produce a complete verified snapshot.']
        : [],
      message,
    };
  }

  const snapshotAgeMs = Math.max(0, now() - Date.parse(snapshot.generatedAt));
  const staleAfterMs = readLeaderboardStaleAfterMs(getEnv);
  const stale = snapshotAgeMs > staleAfterMs;
  return {
    status: stale ? 'stale' as const : 'ok' as const,
    provider: 'sui-graphql-snapshot',
    generatedAt: responseGeneratedAt,
    snapshotGeneratedAt: snapshot.generatedAt,
    snapshotAgeMs,
    refreshState,
    refreshStatus,
    methodologyVersion: snapshot.methodologyVersion,
    coverage: snapshot.coverage,
    reconciliation: snapshot.reconciliation,
    holderCount: snapshot.holderCount,
    displayedCount: snapshot.displayedCount,
    excludedCount: snapshot.excludedCount,
    entries: snapshot.entries,
    warnings: stale ? [`Displayed rows are from the last verified snapshot at ${snapshot.generatedAt}.`] : [],
    message: stale ? 'Showing the last complete verified TREE leaderboard snapshot.' : 'Showing the current complete verified TREE leaderboard snapshot.',
  };
}

export async function createLeaderboardSnapshotResponse(request: Request, dependencies: SnapshotEndpointDependencies = {}): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'method-not-allowed' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  }
  try {
    const payload = await resolveLeaderboardSnapshotPayload(dependencies);
    const cacheable = payload.status === 'ok' || payload.status === 'stale';
    return Response.json(payload, {
      headers: { 'Cache-Control': cacheable ? 'public, max-age=15, s-maxage=30, stale-while-revalidate=60' : 'no-store' },
    });
  } catch {
    return Response.json({
      status: 'error',
      provider: 'sui-graphql-snapshot',
      generatedAt: new Date((dependencies.now ?? Date.now)()).toISOString(),
      snapshotGeneratedAt: null,
      snapshotAgeMs: null,
      refreshState: 'error',
      refreshStatus: null,
      methodologyVersion: METHODOLOGY_VERSION,
      coverage: null,
      reconciliation: null,
      holderCount: null,
      displayedCount: 0,
      excludedCount: 0,
      entries: [],
      warnings: ['The verified TREE leaderboard snapshot is temporarily unavailable.'],
      message: 'Leaderboard unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
