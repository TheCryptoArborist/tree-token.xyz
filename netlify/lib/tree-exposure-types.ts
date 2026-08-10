import { TREE_DECIMALS, TREE_TOTAL_SUPPLY_RAW } from './leaderboard-provider.ts';
import { formatBaseUnits, formatPercentFromRaw } from './sui-graphql-leaderboard-provider.ts';

export const TREE_EXPOSURE_METHODOLOGY_VERSION = 'verified-tree-exposure-v1';
export const LP_PROVIDER_BADGE = 'lp-provider';
export const LP_MAXI_BADGE = 'lp-maxi';
export const DIAMOND_HANDS_BADGE = 'diamond-hands';
export const PAPER_HANDS_BADGE = 'paper-hands';
export const ACCUMULATOR_BADGE = 'accumulator';
export const BURNED_BADGE = 'burned';

export type ExposureVenue = 'suiDexV2' | 'suiDexV3' | 'turbos';

export type WalletLpPosition = {
  wallet: string;
  lpTreeRaw: string;
  venue: ExposureVenue;
  positionCount: number;
  metadata?: Record<string, unknown>;
};

export type ExposureVenueResult = {
  venue: ExposureVenue;
  outcome: 'complete' | 'verification-incomplete' | 'error';
  generatedAt: string;
  positions: WalletLpPosition[];
  warnings: string[];
  coverage: Record<string, unknown>;
};

export type DirectExposureCandidate = {
  wallet: string;
  suinsName?: string | null;
  directTreeRaw: string;
  coinObjectCount?: number;
};

export type VerifiedExposureEntry = {
  rank: number;
  wallet: string;
  suinsName: string | null;
  liquidTreeRaw: string;
  liquidTree: string;
  lpTreeRaw: string;
  lpTree: string;
  totalExposureRaw: string;
  totalExposure: string;
  supplyPercent: string;
  liquidCoinObjectCount: number;
  lpPositionCount: number;
  lpBreakdown: {
    suiDexV2Raw: string;
    suiDexV2: string;
    suiDexV3Raw: string;
    suiDexV3: string;
    turbosRaw: string;
    turbos: string;
  };
  activity30d?: {
    windowStart: string;
    windowEnd: string;
    buyCount: number;
    sellCount: number;
    buyTreeRaw: string;
    buyTree: string;
    sellTreeRaw: string;
    sellTree: string;
  } | null;
  burnedTreeRaw?: string | null;
  burnedTree?: string | null;
  badges: string[];
};

export function formatTreeRaw(raw: bigint): string {
  return formatBaseUnits(raw, TREE_DECIMALS);
}

export function formatTreeSupplyPercent(raw: bigint): string {
  return formatPercentFromRaw(raw, TREE_TOTAL_SUPPLY_RAW);
}

export function parseUnsignedRaw(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}
