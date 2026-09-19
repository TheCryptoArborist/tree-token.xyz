import { SUI_TYPE, TREE_TYPE } from './tree-swap-route.ts';

export const TREE_LIQUIDITY_VENUES = ['suidex', 'turbos', 'aftermath', 'cetus', 'flowx'] as const;
export type TreeLiquidityVenue = typeof TREE_LIQUIDITY_VENUES[number];

export const TREE_PARTNER_TYPES = {
  SUI: SUI_TYPE,
  TREE: TREE_TYPE,
  BOOM: '0x3766e534b5dc6cdb7defd998debf19f72565f4a7b8224e36b050f690b71a8819::boom::BOOM',
} as const;

export type TreeLiquidityPool = {
  venue: TreeLiquidityVenue;
  poolId: string;
  coinTypes: string[];
  reserves?: Record<string, string>;
  feePercent?: number;
  tvlUsd?: number;
  healthy: boolean;
  verifiedAt: string;
  source: 'on-chain';
};

export type TreeLiquidityGraph = {
  generatedAt: string;
  maxRouteHops: 3;
  pools: TreeLiquidityPool[];
  droppedPools: Array<{ venue: TreeLiquidityVenue; poolId: string; reason: string }>;
};

// Phase A is intentionally read-only. Venue adapters populate this graph from
// on-chain pool state; quote/execution code must not trust discovery alone.
export function buildTreeLiquidityGraph(
  pools: TreeLiquidityPool[],
  droppedPools: TreeLiquidityGraph['droppedPools'] = [],
): TreeLiquidityGraph {
  const healthy = pools.filter((pool) =>
    pool.healthy &&
    pool.coinTypes.includes(TREE_TYPE) &&
    pool.coinTypes.length >= 2
  );
  return {
    generatedAt: new Date().toISOString(),
    maxRouteHops: 3,
    pools: healthy,
    droppedPools,
  };
}
