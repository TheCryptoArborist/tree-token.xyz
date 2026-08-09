import {
  readCompleteTreeBadgeSnapshot,
  readTreeBadgeRefreshStatus,
  type TreeBadgeRefreshStatus,
} from './tree-badge-cache.ts';
import {
  TREE_BADGE_METHODOLOGY_VERSION,
  TREE_BADGE_SNAPSHOT_PROVIDER,
  type CompleteTreeBadgeSnapshot,
} from './tree-badge-types.ts';

export const DEFAULT_TREE_BADGE_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export type TreeBadgeEndpointDependencies = {
  context?: string;
  now?: () => number;
  getEnv?: (name: string) => string | undefined;
  readSnapshot?: () => Promise<CompleteTreeBadgeSnapshot | null>;
  readStatus?: () => Promise<TreeBadgeRefreshStatus | null>;
  triggerRefresh?: (request: Request, secret: string) => Promise<number>;
};

function enabled(value: string | undefined): boolean {
  return (value || '').trim().toLowerCase() === 'true';
}

function staleAfterMs(getEnv: (name: string) => string | undefined): number {
  const value = getEnv('TREE_BADGE_STALE_AFTER_MS');
  if (!value || !/^\d+$/.test(value.trim())) return DEFAULT_TREE_BADGE_STALE_AFTER_MS;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 60_000 && parsed <= 7 * 24 * 60 * 60 * 1000
    ? parsed
    : DEFAULT_TREE_BADGE_STALE_AFTER_MS;
}

function publicStatus(status: TreeBadgeRefreshStatus | null) {
  if (!status) return null;
  return {
    state: status.state,
    stage: status.stage,
    startedAt: status.startedAt,
    updatedAt: status.updatedAt,
    completedAt: status.completedAt,
    exposureSnapshotGeneratedAt: status.exposureSnapshotGeneratedAt,
    activityOutcome: status.activityOutcome,
    burnOutcome: status.burnOutcome,
    displayedCount: status.displayedCount,
    message: status.message,
  };
}

async function triggerBackgroundRefresh(request: Request, secret: string): Promise<number> {
  const url = new URL('/.netlify/functions/tree-badges-refresh-background', request.url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-tree-badge-refresh-secret': secret,
    },
  });
  return response.status;
}

export async function resolveTreeBadgePayload(dependencies: TreeBadgeEndpointDependencies = {}) {
  const now = dependencies.now ?? Date.now;
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const context = dependencies.context || 'dev';
  if (context === 'production' && !enabled(getEnv('TREE_BADGE_PRODUCTION_ENABLED'))) {
    return {
      status: 'disabled' as const,
      provider: TREE_BADGE_SNAPSHOT_PROVIDER,
      methodologyVersion: TREE_BADGE_METHODOLOGY_VERSION,
      generatedAt: new Date(now()).toISOString(),
      message: 'TREE behavioral badges are not enabled in production.',
    };
  }

  const readSnapshot = dependencies.readSnapshot ?? (() => readCompleteTreeBadgeSnapshot({ context }));
  const readStatus = dependencies.readStatus ?? (() => readTreeBadgeRefreshStatus({ context }));
  const [snapshot, storedStatus] = await Promise.all([readSnapshot(), readStatus()]);
  const refreshStatus = publicStatus(storedStatus);
  const refreshState = refreshStatus?.state ?? 'idle';
  const generatedAt = new Date(now()).toISOString();

  if (!snapshot) {
    const refreshing = refreshState === 'queued' || refreshState === 'running';
    return {
      status: refreshing ? 'refreshing' as const : 'not-ready' as const,
      provider: TREE_BADGE_SNAPSHOT_PROVIDER,
      methodologyVersion: TREE_BADGE_METHODOLOGY_VERSION,
      generatedAt,
      snapshotGeneratedAt: null,
      snapshotAgeMs: null,
      exposureSnapshotGeneratedAt: refreshStatus?.exposureSnapshotGeneratedAt ?? null,
      refreshState,
      refreshStatus,
      displayedCount: 0,
      entries: [],
      source: null,
      summary: null,
      warnings: refreshState === 'error' || refreshState === 'verification-incomplete'
        ? ['The latest badge refresh did not produce a complete verified snapshot.']
        : [],
      message: refreshing
        ? 'Building the complete 30-day activity and lifetime burn badge indexes.'
        : 'A complete verified TREE behavioral badge snapshot is not available yet.',
    };
  }

  const snapshotAgeMs = Math.max(0, now() - Date.parse(snapshot.generatedAt));
  const stale = snapshotAgeMs > staleAfterMs(getEnv);
  return {
    status: stale ? 'stale' as const : 'ok' as const,
    provider: snapshot.provider,
    methodologyVersion: snapshot.methodologyVersion,
    generatedAt,
    snapshotGeneratedAt: snapshot.generatedAt,
    snapshotAgeMs,
    exposureSnapshotGeneratedAt: snapshot.exposureSnapshotGeneratedAt,
    refreshState,
    refreshStatus,
    displayedCount: snapshot.displayedCount,
    entries: snapshot.entries,
    source: snapshot.source,
    summary: snapshot.summary,
    warnings: [
      ...snapshot.warnings,
      ...(stale ? [`Behavioral badges are from the last complete snapshot at ${snapshot.generatedAt}.`] : []),
    ],
    message: stale
      ? 'Showing the last complete verified TREE behavioral badge snapshot.'
      : 'Showing the current complete verified TREE behavioral badge snapshot.',
  };
}

export async function createTreeBadgeResponse(
  request: Request,
  dependencies: TreeBadgeEndpointDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'method-not-allowed' }, {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }
  try {
    let payload = await resolveTreeBadgePayload(dependencies);
    if (payload.status === 'disabled') {
      return Response.json(payload, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
    const context = dependencies.context || 'dev';
    if (payload.status === 'not-ready'
      && payload.refreshState === 'idle'
      && context === 'deploy-preview'
      && enabled(getEnv('TREE_BADGE_AUTO_BOOTSTRAP'))) {
      const secret = getEnv('TREE_BADGE_REFRESH_SECRET')
        || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
        || '';
      if (secret) {
        try {
          const triggerRefresh = dependencies.triggerRefresh ?? triggerBackgroundRefresh;
          const triggerStatus = await triggerRefresh(request, secret);
          if (triggerStatus === 202) {
            payload = {
              ...payload,
              status: 'refreshing',
              refreshState: 'queued',
              warnings: [...payload.warnings],
              message: 'The complete TREE behavioral badge refresh was accepted by the background runtime.',
            };
          } else {
            payload = {
              ...payload,
              warnings: [...payload.warnings, `The badge background trigger returned ${triggerStatus}.`],
            };
          }
        } catch {
          payload = {
            ...payload,
            warnings: [...payload.warnings, 'The badge background trigger is temporarily unavailable.'],
          };
        }
      }
    }

    const cacheable = payload.status === 'ok' || payload.status === 'stale';
    return Response.json(payload, {
      headers: {
        'Cache-Control': cacheable
          ? 'public, max-age=15, s-maxage=30, stale-while-revalidate=60'
          : 'no-store',
      },
    });
  } catch {
    return Response.json({
      status: 'error',
      provider: TREE_BADGE_SNAPSHOT_PROVIDER,
      methodologyVersion: TREE_BADGE_METHODOLOGY_VERSION,
      generatedAt: new Date((dependencies.now ?? Date.now)()).toISOString(),
      snapshotGeneratedAt: null,
      snapshotAgeMs: null,
      exposureSnapshotGeneratedAt: null,
      refreshState: 'error',
      refreshStatus: null,
      displayedCount: 0,
      entries: [],
      source: null,
      summary: null,
      warnings: ['The verified TREE behavioral badge snapshot is temporarily unavailable.'],
      message: 'TREE behavioral badges unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
