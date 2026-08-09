import { getDeployStore, getStore } from '@netlify/blobs';
import {
  TREE_DECIMALS,
  TREE_TOTAL_SUPPLY_RAW,
  normalizeSuiAddress,
} from './leaderboard-provider.ts';
import type { ExposureSnapshot } from './tree-exposure-aggregator.ts';
import {
  LP_MAXI_BADGE,
  LP_PROVIDER_BADGE,
  TREE_EXPOSURE_METHODOLOGY_VERSION,
  formatTreeRaw,
  formatTreeSupplyPercent,
  parseUnsignedRaw,
  type ExposureVenue,
  type VerifiedExposureEntry,
} from './tree-exposure-types.ts';

export const EXPOSURE_STORE_NAME = 'tree-exposure';
export const COMPLETE_EXPOSURE_SNAPSHOT_KEY = 'complete';
export const EXPOSURE_REFRESH_STATUS_KEY = 'refresh-status';
export const EXPOSURE_REFRESH_LOCK_KEY = 'refresh-lock';
export const EXPOSURE_REFRESH_LOCK_TTL_MS = 30 * 60 * 1000;
export const EXPOSURE_SNAPSHOT_PROVIDER = 'tree-exposure-snapshot';

export type ExposureVenueSourceSummary = {
  outcome: 'complete';
  walletCount: number;
  positionCount: number;
  principalTreeRaw: string;
  coverage: Record<string, unknown>;
  warnings: string[];
};

export type ExposureSourceSummary = {
  direct: {
    outcome: 'complete';
    pagesScanned: number;
    objectsScanned: number;
    verifiedAddressOwners: number;
    eligibleDirectOwners: number;
    exposureCandidateCount: number;
    addressOwnedRaw: string;
  };
  venues: Record<ExposureVenue, ExposureVenueSourceSummary>;
  suins: {
    requestedCount: number;
    resolvedCount: number;
    complete: boolean;
    generatedAt: string;
    warnings: string[];
  };
};

export type ExposureSnapshotSummary = {
  top50TotalRaw: string;
  top50LiquidRaw: string;
  top50LpRaw: string;
  rank50CutoffRaw: string;
  badgeCounts: {
    lpProvider: number;
    lpMaxi: number;
  };
};

export type CompleteExposureSnapshot = ExposureSnapshot & {
  outcome: 'complete';
  provider: typeof EXPOSURE_SNAPSHOT_PROVIDER;
  coinSymbol: 'TREE';
  coinDecimals: typeof TREE_DECIMALS;
  totalSupplyRaw: string;
  displayedCount: 50;
  source: ExposureSourceSummary;
  summary: ExposureSnapshotSummary;
};

export type ExposureRefreshState = 'idle' | 'queued' | 'running' | 'complete' | 'verification-incomplete' | 'error';
export type ExposureRefreshStage = 'queued' | 'direct-tree' | 'suidex-v2' | 'suidex-v3' | 'turbos' | 'aggregate' | 'suins' | 'complete' | 'failed';

export type ExposureRefreshStatus = {
  state: ExposureRefreshState;
  stage: ExposureRefreshStage;
  runId: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  directPagesScanned: number;
  directObjectsScanned: number;
  directUniqueOwners: number;
  venueOutcomes: Record<ExposureVenue, 'pending' | 'complete' | 'verification-incomplete' | 'error'>;
  totalExposureComplete: boolean;
  displayedCount: number;
  message: string;
  commitRef: string | null;
  deployId: string | null;
};

export type ExposureRefreshLock = {
  runId: string;
  startedAt: string;
  expiresAt: string;
  commitRef: string | null;
  deployId: string | null;
};

export type ExposureStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

export type ExposureStoreFactories = {
  getStore: (name: string, options: { consistency: 'strong' }) => unknown;
  getDeployStore: (name: string) => unknown;
};

const defaultFactories: ExposureStoreFactories = {
  getStore: (name, options) => getStore(name, options),
  getDeployStore: (name) => getDeployStore(name),
};

export function selectExposureStore(
  context: string | undefined,
  factories: ExposureStoreFactories = defaultFactories,
): ExposureStore {
  return (context === 'production'
    ? factories.getStore(EXPOSURE_STORE_NAME, { consistency: 'strong' })
    : factories.getDeployStore(EXPOSURE_STORE_NAME)) as ExposureStore;
}

type StoreOptions = { context?: string; store?: ExposureStore };

function resolveStore(options: StoreOptions): ExposureStore {
  return options.store ?? selectExposureStore(options.context);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safeGeneratedAt(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function safeSuinsName(value: unknown): boolean {
  return value === null || (typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && value.length <= 255
    && !/[\u0000-\u001f\u007f]/.test(value));
}

function expectedBadges(liquidRaw: bigint, lpRaw: bigint): string[] {
  const badges: string[] = [];
  if (lpRaw > 0n) badges.push(LP_PROVIDER_BADGE);
  if (lpRaw > liquidRaw && lpRaw > 0n) badges.push(LP_MAXI_BADGE);
  return badges;
}

function validateEntry(value: unknown, expectedRank: number): value is VerifiedExposureEntry {
  const entry = record(value) as Partial<VerifiedExposureEntry>;
  const wallet = normalizeSuiAddress(entry.wallet);
  if (!wallet || wallet !== entry.wallet || entry.rank !== expectedRank || !safeSuinsName(entry.suinsName)) return false;

  const liquidRaw = parseUnsignedRaw(entry.liquidTreeRaw);
  const lpRaw = parseUnsignedRaw(entry.lpTreeRaw);
  const totalRaw = parseUnsignedRaw(entry.totalExposureRaw);
  const breakdown = record(entry.lpBreakdown);
  const v2Raw = parseUnsignedRaw(breakdown.suiDexV2Raw);
  const v3Raw = parseUnsignedRaw(breakdown.suiDexV3Raw);
  const turbosRaw = parseUnsignedRaw(breakdown.turbosRaw);
  if (liquidRaw === null || lpRaw === null || totalRaw === null
    || v2Raw === null || v3Raw === null || turbosRaw === null
    || totalRaw <= 0n || totalRaw > TREE_TOTAL_SUPPLY_RAW
    || lpRaw !== v2Raw + v3Raw + turbosRaw
    || totalRaw !== liquidRaw + lpRaw) return false;

  if (entry.liquidTree !== formatTreeRaw(liquidRaw)
    || entry.lpTree !== formatTreeRaw(lpRaw)
    || entry.totalExposure !== formatTreeRaw(totalRaw)
    || entry.supplyPercent !== formatTreeSupplyPercent(totalRaw)
    || breakdown.suiDexV2 !== formatTreeRaw(v2Raw)
    || breakdown.suiDexV3 !== formatTreeRaw(v3Raw)
    || breakdown.turbos !== formatTreeRaw(turbosRaw)
    || !safeNonNegativeInteger(entry.liquidCoinObjectCount)
    || !safeNonNegativeInteger(entry.lpPositionCount)) return false;

  const badges = Array.isArray(entry.badges) ? entry.badges : [];
  const expected = expectedBadges(liquidRaw, lpRaw);
  return badges.length === expected.length && badges.every((badge, index) => badge === expected[index]);
}

function validateSource(snapshot: CompleteExposureSnapshot): boolean {
  const source = record(snapshot.source);
  const direct = record(source.direct);
  if (direct.outcome !== 'complete'
    || !safeNonNegativeInteger(direct.pagesScanned)
    || !safeNonNegativeInteger(direct.objectsScanned)
    || !safeNonNegativeInteger(direct.verifiedAddressOwners)
    || !safeNonNegativeInteger(direct.eligibleDirectOwners)
    || !safeNonNegativeInteger(direct.exposureCandidateCount)
    || direct.exposureCandidateCount !== direct.eligibleDirectOwners
    || parseUnsignedRaw(direct.addressOwnedRaw) === null) return false;

  const venues = record(source.venues);
  for (const venue of ['suiDexV2', 'suiDexV3', 'turbos'] as const) {
    const summary = record(venues[venue]);
    if (summary.outcome !== 'complete'
      || !safeNonNegativeInteger(summary.walletCount)
      || !safeNonNegativeInteger(summary.positionCount)
      || parseUnsignedRaw(summary.principalTreeRaw) === null
      || !Array.isArray(summary.warnings)
      || !summary.warnings.every((warning) => typeof warning === 'string')
      || !summary.coverage
      || typeof summary.coverage !== 'object') return false;
  }

  const suins = record(source.suins);
  return safeNonNegativeInteger(suins.requestedCount)
    && safeNonNegativeInteger(suins.resolvedCount)
    && suins.resolvedCount <= suins.requestedCount
    && typeof suins.complete === 'boolean'
    && safeGeneratedAt(suins.generatedAt)
    && Array.isArray(suins.warnings)
    && suins.warnings.every((warning) => typeof warning === 'string');
}

export function validateCompleteExposureSnapshot(value: unknown): value is CompleteExposureSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as CompleteExposureSnapshot;
  if (snapshot.outcome !== 'complete'
    || snapshot.provider !== EXPOSURE_SNAPSHOT_PROVIDER
    || snapshot.methodologyVersion !== TREE_EXPOSURE_METHODOLOGY_VERSION
    || !safeGeneratedAt(snapshot.generatedAt)
    || snapshot.coinSymbol !== 'TREE'
    || snapshot.coinDecimals !== TREE_DECIMALS
    || snapshot.totalSupplyRaw !== TREE_TOTAL_SUPPLY_RAW.toString()
    || snapshot.displayedCount !== 50
    || !Array.isArray(snapshot.entries)
    || snapshot.entries.length !== 50
    || !safeNonNegativeInteger(snapshot.eligibleOwnerCount)
    || snapshot.eligibleOwnerCount < 50
    || snapshot.coverage?.directTreeComplete !== true
    || snapshot.coverage?.suiDexV2Complete !== true
    || snapshot.coverage?.suiDexV3Complete !== true
    || snapshot.coverage?.turbosComplete !== true
    || snapshot.coverage?.totalExposureComplete !== true
    || !Array.isArray(snapshot.warnings)
    || !snapshot.warnings.every((warning) => typeof warning === 'string')) return false;

  const wallets = new Set<string>();
  let top50TotalRaw = 0n;
  let top50LiquidRaw = 0n;
  let top50LpRaw = 0n;
  let lpProvider = 0;
  let lpMaxi = 0;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const entry = snapshot.entries[index];
    if (!validateEntry(entry, index + 1) || wallets.has(entry.wallet)) return false;
    wallets.add(entry.wallet);
    top50TotalRaw += BigInt(entry.totalExposureRaw);
    top50LiquidRaw += BigInt(entry.liquidTreeRaw);
    top50LpRaw += BigInt(entry.lpTreeRaw);
    if (entry.badges.includes(LP_PROVIDER_BADGE)) lpProvider += 1;
    if (entry.badges.includes(LP_MAXI_BADGE)) lpMaxi += 1;
  }
  if (top50TotalRaw > TREE_TOTAL_SUPPLY_RAW) return false;

  const summary = record(snapshot.summary);
  const badgeCounts = record(summary.badgeCounts);
  return summary.top50TotalRaw === top50TotalRaw.toString()
    && summary.top50LiquidRaw === top50LiquidRaw.toString()
    && summary.top50LpRaw === top50LpRaw.toString()
    && summary.rank50CutoffRaw === snapshot.entries[49].totalExposureRaw
    && badgeCounts.lpProvider === lpProvider
    && badgeCounts.lpMaxi === lpMaxi
    && validateSource(snapshot);
}

export async function readCompleteExposureSnapshot(options: StoreOptions = {}): Promise<CompleteExposureSnapshot | null> {
  const value = await resolveStore(options).get(COMPLETE_EXPOSURE_SNAPSHOT_KEY, { type: 'json' });
  return validateCompleteExposureSnapshot(value) ? value : null;
}

export async function writeCompleteExposureSnapshot(snapshot: CompleteExposureSnapshot, options: StoreOptions = {}): Promise<boolean> {
  if (!validateCompleteExposureSnapshot(snapshot)) return false;
  await resolveStore(options).setJSON(COMPLETE_EXPOSURE_SNAPSHOT_KEY, snapshot);
  return true;
}

function sanitizeRefreshStatus(status: ExposureRefreshStatus): ExposureRefreshStatus {
  return {
    state: status.state,
    stage: status.stage,
    runId: status.runId,
    startedAt: status.startedAt,
    updatedAt: status.updatedAt,
    completedAt: status.completedAt,
    directPagesScanned: status.directPagesScanned,
    directObjectsScanned: status.directObjectsScanned,
    directUniqueOwners: status.directUniqueOwners,
    venueOutcomes: {
      suiDexV2: status.venueOutcomes.suiDexV2,
      suiDexV3: status.venueOutcomes.suiDexV3,
      turbos: status.venueOutcomes.turbos,
    },
    totalExposureComplete: status.totalExposureComplete,
    displayedCount: status.displayedCount,
    message: status.message,
    commitRef: status.commitRef,
    deployId: status.deployId,
  };
}

export async function readExposureRefreshStatus(options: StoreOptions = {}): Promise<ExposureRefreshStatus | null> {
  const value = await resolveStore(options).get(EXPOSURE_REFRESH_STATUS_KEY, { type: 'json' });
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ExposureRefreshStatus
    : null;
}

export async function writeExposureRefreshStatus(status: ExposureRefreshStatus, options: StoreOptions = {}): Promise<void> {
  await resolveStore(options).setJSON(EXPOSURE_REFRESH_STATUS_KEY, sanitizeRefreshStatus(status));
}

export async function readExposureRefreshLock(options: StoreOptions = {}): Promise<ExposureRefreshLock | null> {
  const value = await resolveStore(options).get(EXPOSURE_REFRESH_LOCK_KEY, { type: 'json' });
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ExposureRefreshLock
    : null;
}

export async function writeExposureRefreshLock(lock: ExposureRefreshLock, options: StoreOptions = {}): Promise<void> {
  await resolveStore(options).setJSON(EXPOSURE_REFRESH_LOCK_KEY, lock);
}

export async function clearExposureRefreshLock(runId: string, options: StoreOptions = {}): Promise<boolean> {
  const store = resolveStore(options);
  const current = await readExposureRefreshLock({ store });
  if (!current || current.runId !== runId) return false;
  await store.delete(EXPOSURE_REFRESH_LOCK_KEY);
  return true;
}
