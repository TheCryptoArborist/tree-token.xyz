export const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const METHODOLOGY_VERSION = 'direct-tree-phase-2.1';
export const LEADERBOARD_COVERAGE = {
  directTree: true,
  moonbagsLocks: false,
  suiDexV2: false,
  suiDexV3: false,
  turbos: false,
  nftreeCount: false,
} as const;

type BlockVisionHolder = { address?: unknown; quantity?: unknown; percentage?: unknown };

export type DirectTreeEntry = {
  rank: number;
  wallet: string;
  directTree: string;
  supplyPercent: number | null;
  tier: string;
  moonbagsLocks: null;
  suiDexV2: null;
  suiDexV3: null;
  turbos: null;
  nftreeCount: null;
};

function tierForRank(rank: number) {
  if (rank <= 5) return 'Ancient Grove';
  if (rank <= 10) return 'Giant Sequoia';
  if (rank <= 20) return 'Heritage Oak';
  if (rank <= 30) return 'Canopy Guardian';
  return 'Forest Keeper';
}

export async function fetchDirectTreeLeaderboard(apiKey: string) {
  const url = new URL('https://api.blockvision.org/v2/sui/coin/holders');
  url.searchParams.set('coinType', TREE_COIN_TYPE);
  url.searchParams.set('limit', '50');
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'x-api-key': apiKey },
  });
  if (!response.ok) throw new Error(`BlockVision returned ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const container = (payload.result ?? payload.data ?? payload) as Record<string, unknown>;
  const rows = (Array.isArray(container.data) ? container.data : Array.isArray(container.items) ? container.items : []) as BlockVisionHolder[];
  const entries: DirectTreeEntry[] = rows.slice(0, 50).flatMap((row, index) => {
    const wallet = typeof row.address === 'string' ? row.address : '';
    const directTree = typeof row.quantity === 'string' || typeof row.quantity === 'number' ? String(row.quantity) : '';
    const percentage = Number(row.percentage);
    if (!wallet || !directTree) return [];
    return [{
      rank: index + 1,
      wallet,
      directTree,
      supplyPercent: Number.isFinite(percentage) ? percentage : null,
      tier: tierForRank(index + 1),
      moonbagsLocks: null,
      suiDexV2: null,
      suiDexV3: null,
      turbos: null,
      nftreeCount: null,
    }];
  });
  const total = Number(container.total ?? payload.total);
  return { entries, holderCount: Number.isFinite(total) ? total : null };
}
