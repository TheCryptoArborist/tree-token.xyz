import { formatTreeRaw, parseUnsignedRaw } from './tree-exposure-types.ts';

export const TREE_BADGE_METHODOLOGY_VERSION = 'verified-tree-behavior-badges-v1';
export const TREE_BADGE_SNAPSHOT_PROVIDER = 'tree-badge-snapshot';

export const DIAMOND_HANDS_BADGE = 'diamond-hands';
export const PAPER_HANDS_BADGE = 'paper-hands';
export const ACCUMULATOR_BADGE = 'accumulator';
export const BURNED_BADGE = 'burned';

export const BEHAVIOR_BADGE_ORDER = [
  DIAMOND_HANDS_BADGE,
  PAPER_HANDS_BADGE,
  ACCUMULATOR_BADGE,
  BURNED_BADGE,
] as const;

export type BehaviorBadge = typeof BEHAVIOR_BADGE_ORDER[number];

export const TREE_ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const TREE_ACTIVITY_MIN_VOLUME_RAW = 100_000_000_000n;
export const TREE_ACTIVITY_ACCUMULATOR_BUYS = 10;
export const BURNED_BADGE_THRESHOLD_RAW = 500_000_000_000n;

export type ActivityEvidence = {
  windowStart: string;
  windowEnd: string;
  buyCount: number;
  sellCount: number;
  buyTreeRaw: string;
  buyTree: string;
  sellTreeRaw: string;
  sellTree: string;
};

export type BurnEvidence = {
  burnedTreeRaw: string;
  burnedTree: string;
  indexedThroughCheckpoint: string;
};

export type TreeBehaviorBadgeEntry = {
  rank: number;
  wallet: string;
  activity30d: ActivityEvidence;
  burn: BurnEvidence;
  badges: BehaviorBadge[];
};

export type BadgeSourceSummary = {
  activity: {
    outcome: 'complete';
    methodologyVersion: string;
    generatedAt: string;
    windowStart: string;
    windowEnd: string;
    poolCount: number;
    transactionCount: number;
    warnings: string[];
  };
  burns: {
    outcome: 'complete';
    methodologyVersion: string;
    generatedAt: string;
    indexedThroughCheckpoint: string;
    walletCount: number;
    warnings: string[];
  };
};

export type CompleteTreeBadgeSnapshot = {
  outcome: 'complete';
  provider: typeof TREE_BADGE_SNAPSHOT_PROVIDER;
  methodologyVersion: typeof TREE_BADGE_METHODOLOGY_VERSION;
  generatedAt: string;
  exposureSnapshotGeneratedAt: string;
  displayedCount: 50;
  entries: TreeBehaviorBadgeEntry[];
  source: BadgeSourceSummary;
  summary: {
    diamondHands: number;
    paperHands: number;
    accumulator: number;
    burned: number;
  };
  warnings: string[];
};

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function expectedBehaviorBadges(
  activity: ActivityEvidence,
  burn: BurnEvidence,
): BehaviorBadge[] | null {
  const buyRaw = parseUnsignedRaw(activity.buyTreeRaw);
  const sellRaw = parseUnsignedRaw(activity.sellTreeRaw);
  const burnedRaw = parseUnsignedRaw(burn.burnedTreeRaw);
  if (buyRaw === null || sellRaw === null || burnedRaw === null
    || !validCount(activity.buyCount) || !validCount(activity.sellCount)
    || !validDate(activity.windowStart) || !validDate(activity.windowEnd)
    || Date.parse(activity.windowStart) >= Date.parse(activity.windowEnd)
    || activity.buyTree !== formatTreeRaw(buyRaw)
    || activity.sellTree !== formatTreeRaw(sellRaw)
    || burn.burnedTree !== formatTreeRaw(burnedRaw)
    || typeof burn.indexedThroughCheckpoint !== 'string'
    || !/^\d+$/.test(burn.indexedThroughCheckpoint)) return null;

  const badges: BehaviorBadge[] = [];
  if (activity.sellCount === 0) badges.push(DIAMOND_HANDS_BADGE);
  if (sellRaw > buyRaw && sellRaw >= TREE_ACTIVITY_MIN_VOLUME_RAW) badges.push(PAPER_HANDS_BADGE);
  if (activity.buyCount >= TREE_ACTIVITY_ACCUMULATOR_BUYS
    && buyRaw >= TREE_ACTIVITY_MIN_VOLUME_RAW
    && buyRaw > sellRaw) badges.push(ACCUMULATOR_BADGE);
  if (burnedRaw >= BURNED_BADGE_THRESHOLD_RAW) badges.push(BURNED_BADGE);
  return badges;
}
