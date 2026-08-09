import exclusions from '../../data/tree-leaderboard-exclusions.json';

export const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const TREE_COIN_OBJECT_TYPE = `0x2::coin::Coin<${TREE_COIN_TYPE}>`;
export const TREE_DECIMALS = 6;
export const TREE_TOTAL_SUPPLY_RAW = 1_000_000_000_000_000n;
export const METHODOLOGY_VERSION = 'direct-tree-sui-graphql-poc-v2';
export const SUI_GRAPHQL_PROVIDER = 'sui-graphql';
export const SUI_GRAPHQL_CACHED_PROVIDER = 'sui-graphql-cached';
export const BLOCKVISION_VALIDATION_PROVIDER = 'blockvision-validation';

export const LEADERBOARD_COVERAGE = {
  directTree: true,
  moonbagsLocks: false,
  suiDexV2: false,
  suiDexV3: false,
  turbos: false,
  nftreeCount: false,
  qualification: 'unique valid address owners found by a complete Coin<TREE> object scan',
} as const;

const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const exclusionMap = new Map(exclusions.map((item) => [item.address.toLowerCase(), item]));

export type LeaderboardProviderName = typeof SUI_GRAPHQL_PROVIDER | typeof SUI_GRAPHQL_CACHED_PROVIDER | typeof BLOCKVISION_VALIDATION_PROVIDER;

export type DirectTreeEntry = {
  rank: number;
  wallet: string;
  suinsName?: string | null;
  directTreeRaw: string;
  directTree: string;
  supplyPercent: string;
  tier: string;
  coinObjectCount: number;
  moonbagsLocks: null;
  suiDexV2: null;
  suiDexV3: null;
  turbos: null;
  nftreeCount: null;
};

export function tierForRank(rank: number): string {
  if (rank <= 5) return 'Ancient Grove';
  if (rank <= 10) return 'Giant Sequoia';
  if (rank <= 20) return 'Heritage Oak';
  if (rank <= 30) return 'Canopy Guardian';
  return 'Forest Keeper';
}

export function normalizeSuiAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return SUI_ADDRESS.test(normalized) ? normalized : null;
}

export function excludedAddress(address: string) {
  return exclusionMap.get(address) || null;
}

export function exclusionMetadata() {
  return {
    configuredEntries: exclusions.length,
    categories: [...new Set(exclusions.map((item) => item.category))],
    addressValidation: '0x followed by 64 hexadecimal characters',
  };
}
