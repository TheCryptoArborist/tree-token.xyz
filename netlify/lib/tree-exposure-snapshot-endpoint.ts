import {
  EXPOSURE_SNAPSHOT_PROVIDER,
  readCompleteExposureSnapshot,
  readExposureRefreshStatus,
  type CompleteExposureSnapshot,
  type ExposureRefreshStatus,
} from './tree-exposure-cache.ts';
import { TREE_EXPOSURE_METHODOLOGY_VERSION } from './tree-exposure-types.ts';
import { resolveDefaultSuinsNames } from './suins-name-resolver.ts';

export const DEFAULT_EXPOSURE_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export type ExposureSnapshotEndpointDependencies = {
  context?: string;
  now?: () => number;
  getEnv?: (name: string) => string | undefined;
  readSnapshot?: () => Promise<CompleteExposureSnapshot | null>;
  readRefreshStatus?: () => Promise<ExposureRefreshStatus | null>;
  resolveNames?: typeof resolveDefaultSuinsNames;
};

export type PublicExposureRefreshStatus = {
  state: ExposureRefreshStatus['state'];
  stage: ExposureRefreshStatus['stage'];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  directPagesScanned: number;
  directObjectsScanned: number;
  directUniqueOwners: number;
  venueOutcomes: ExposureRefreshStatus['venueOutcomes'];
  totalExposureComplete: boolean;
  displayedCount: number;
  message: string;
};

function productionEnabled(getEnv: (name: string) => string | undefined): boolean {
  return (getEnv('TREE_EXPOSURE_PRODUCTION_ENABLED') || '').trim().toLowerCase() === 'true';
}

function readStaleAfterMs(getEnv: (name: string) => string | undefined): number {
  const value = getEnv('TREE_EXPOSURE_STALE_AFTER_MS');
  if (!value || !/^\d+$/.test(value.trim())) return DEFAULT_EXPOSURE_STALE_AFTER_MS;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 60_000 && parsed <= 7 * 24 * 60 * 60 * 1000
    ? parsed
    : DEFAULT_EXPOSURE_STALE_AFTER_MS;
}

function publicRefreshStatus(status: ExposureRefreshStatus | null): PublicExposureRefreshStatus | null {
  if (!status) return null;
  return {
    state: status.state,
    stage: status.stage,
    startedAt: status.startedAt,
    updatedAt: status.updatedAt,
    completedAt: status.completedAt,
    directPagesScanned: status.directPagesScanned,
    directObjectsScanned: status.directObjectsScanned,
    directUniqueOwners: status.directUniqueOwners,
    venueOutcomes: { ...status.venueOutcomes },
    totalExposureComplete: status.totalExposureComplete,
    displayedCount: status.displayedCount,
    message: status.message,
  };
}

export async function resolveExposureSnapshotPayload(
  dependencies: ExposureSnapshotEndpointDependencies = {},
) {
  const now = dependencies.now ?? Date.now;
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const context = dependencies.context || 'dev';
  if (context === 'production' && !productionEnabled(getEnv)) {
    return {
      status: 'disabled' as const,
      provider: EXPOSURE_SNAPSHOT_PROVIDER,
      generatedAt: new Date(now()).toISOString(),
      methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION,
      message: 'TREE exposure preview is not enabled in production.',
    };
  }

  const readSnapshot = dependencies.readSnapshot ?? (() => readCompleteExposureSnapshot({ context }));
  const readStatus = dependencies.readRefreshStatus ?? (() => readExposureRefreshStatus({ context }));
  const [snapshot, storedStatus] = await Promise.all([readSnapshot(), readStatus()]);
  const refreshStatus = publicRefreshStatus(storedStatus);
  const refreshState = refreshStatus?.state ?? 'idle';
  const responseGeneratedAt = new Date(now()).toISOString();

  if (!snapshot) {
    const refreshing = refreshState === 'queued' || refreshState === 'running';
    return {
      status: refreshing ? 'refreshing' as const : 'not-ready' as const,
      provider: EXPOSURE_SNAPSHOT_PROVIDER,
      generatedAt: responseGeneratedAt,
      snapshotGeneratedAt: null,
      snapshotAgeMs: null,
      refreshState,
      refreshStatus,
      methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION,
      coinSymbol: 'TREE',
      coinDecimals: 6,
      totalSupplyRaw: '1000000000000000',
      coverage: null,
      eligibleOwnerCount: null,
      displayedCount: 0,
      source: null,
      summary: null,
      entries: [],
      warnings: refreshState === 'verification-incomplete' || refreshState === 'error'
        ? ['The latest exposure refresh did not produce a complete verified snapshot.']
        : [],
      message: refreshing
        ? 'Building the first complete verified Liquid TREE plus LP snapshot.'
        : 'A complete verified TREE exposure snapshot is not available yet.',
    };
  }

  const snapshotAgeMs = Math.max(0, now() - Date.parse(snapshot.generatedAt));
  const stale = snapshotAgeMs > readStaleAfterMs(getEnv);
  let entries = snapshot.entries;
  let source = snapshot.source;
  const identityWarnings: string[] = [];
  const snapshotHasResolvedNames = entries.some((entry) => Boolean(entry.suinsName));
  if (!snapshotHasResolvedNames && entries.length) {
    try {
      const resolution = await (dependencies.resolveNames ?? resolveDefaultSuinsNames)(
        entries.map((entry) => entry.wallet),
      );
      entries = entries.map((entry) => ({
        ...entry,
        suinsName: resolution.names[entry.wallet] || null,
      }));
      const warning = resolution.complete
        ? []
        : ['Some current SuiNS names could not be resolved.'];
      source = {
        ...snapshot.source,
        suins: {
          requestedCount: resolution.requestedCount,
          resolvedCount: resolution.resolvedCount,
          complete: resolution.complete,
          generatedAt: resolution.generatedAt,
          warnings: warning,
        },
      };
      identityWarnings.push(...warning);
    } catch {
      identityWarnings.push('Current SuiNS identity enrichment was temporarily unavailable.');
    }
  }
  return {
    status: stale ? 'stale' as const : 'ok' as const,
    provider: snapshot.provider,
    generatedAt: responseGeneratedAt,
    snapshotGeneratedAt: snapshot.generatedAt,
    snapshotAgeMs,
    refreshState,
    refreshStatus,
    methodologyVersion: snapshot.methodologyVersion,
    coinSymbol: snapshot.coinSymbol,
    coinDecimals: snapshot.coinDecimals,
    totalSupplyRaw: snapshot.totalSupplyRaw,
    coverage: snapshot.coverage,
    eligibleOwnerCount: snapshot.eligibleOwnerCount,
    displayedCount: snapshot.displayedCount,
    source,
    summary: snapshot.summary,
    entries,
    warnings: [
      ...snapshot.warnings,
      ...identityWarnings,
      ...(stale ? [`Displayed exposure rows are from the last complete snapshot at ${snapshot.generatedAt}.`] : []),
    ],
    message: stale
      ? 'Showing the last complete verified TREE exposure snapshot.'
      : 'Showing the current complete verified TREE exposure snapshot.',
  };
}

export async function createExposureSnapshotResponse(
  request: Request,
  dependencies: ExposureSnapshotEndpointDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'method-not-allowed' },
      { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const payload = await resolveExposureSnapshotPayload(dependencies);
    if (payload.status === 'disabled') {
      return Response.json(payload, { status: 404, headers: { 'Cache-Control': 'no-store' } });
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
      provider: EXPOSURE_SNAPSHOT_PROVIDER,
      generatedAt: new Date((dependencies.now ?? Date.now)()).toISOString(),
      snapshotGeneratedAt: null,
      snapshotAgeMs: null,
      refreshState: 'error',
      refreshStatus: null,
      methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION,
      coinSymbol: 'TREE',
      coinDecimals: 6,
      totalSupplyRaw: '1000000000000000',
      coverage: null,
      eligibleOwnerCount: null,
      displayedCount: 0,
      source: null,
      summary: null,
      entries: [],
      warnings: ['The verified TREE exposure snapshot is temporarily unavailable.'],
      message: 'TREE exposure preview unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
