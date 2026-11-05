import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  SUIDEX_V2_TREE_POOL,
  SUIDEX_V3_TREE_POOL,
  TURBOS_SUI_TREE_POOL,
  TREE_TYPE,
  normalizeMoveType,
} from './tree-swap-route.ts';
import { TREE_PARTNER_TYPES, type TreeLiquidityPool, type TreeLiquidityVenue } from './tree-liquidity-graph.ts';

export const KNOWN_TREE_POOLS = [
  { venue: 'suidex', poolId: SUIDEX_V2_TREE_POOL },
  { venue: 'suidex', poolId: SUIDEX_V3_TREE_POOL },
  { venue: 'turbos', poolId: TURBOS_SUI_TREE_POOL },
  { venue: 'aftermath', poolId: '0x2eb0b762b9625ddb82b296542662c74d297cfc508e04523f69f3ebf73c372334' },
  { venue: 'aftermath', poolId: '0x637c93e47274c1d5cf2f8f230dfebf22875e227c220c2156469578f8f4504c53' },
] as const satisfies ReadonlyArray<{ venue: TreeLiquidityVenue; poolId: string }>;

type ObjectLike = {
  objectId?: string;
  type?: string;
  content?: unknown;
};

function collectMoveTypes(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string' && value.includes('::')) {
    // Generic pool types embed the constituent types inside <...>; storing the
    // entire generic string prevents every approved-coin comparison from matching.
    for (const type of value.match(/0x[0-9a-fA-F]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*/g) ?? []) out.add(type);
  }
  else if (Array.isArray(value)) for (const item of value) collectMoveTypes(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value as Record<string, unknown>)) collectMoveTypes(item, out);
  return out;
}

function approvedTypes(types: Iterable<string>): string[] {
  const approved = Object.values(TREE_PARTNER_TYPES).map(normalizeMoveType);
  return [...types].filter((type) => approved.includes(normalizeMoveType(type)));
}

export function normalizeKnownPoolObject(
  venue: TreeLiquidityVenue,
  poolId: string,
  object: ObjectLike,
  verifiedAt = new Date().toISOString(),
): TreeLiquidityPool {
  const found = collectMoveTypes([object.type, object.content]);
  const coins = approvedTypes(found);
  const hasTree = coins.some((type) => normalizeMoveType(type) === normalizeMoveType(TREE_TYPE));
  return {
    venue,
    poolId: poolId.toLowerCase(),
    coinTypes: coins,
    healthy: hasTree && coins.length >= 2,
    verifiedAt,
    source: 'on-chain',
  };
}

// Read-only seed discovery. This intentionally verifies known pool objects before
// we add venue-specific full scans. It never builds or submits a transaction.
export async function discoverKnownTreePools(client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
})) {
  const pools: TreeLiquidityPool[] = [];
  const droppedPools: Array<{ venue: TreeLiquidityVenue; poolId: string; reason: string }> = [];

  for (const seed of KNOWN_TREE_POOLS) {
    try {
      const response = await client.core.getObject({
        objectId: seed.poolId,
        include: { content: true },
      });
      const data = (response as unknown as { object?: ObjectLike; data?: ObjectLike }).object
        || (response as unknown as { data?: ObjectLike }).data
        || response as unknown as ObjectLike;
      const pool = normalizeKnownPoolObject(seed.venue, seed.poolId, data);
      if (pool.healthy) pools.push(pool);
      else droppedPools.push({ venue: seed.venue, poolId: seed.poolId, reason: 'Pool object did not expose TREE plus an approved partner coin.' });
    } catch {
      droppedPools.push({ venue: seed.venue, poolId: seed.poolId, reason: 'Pool object could not be verified on-chain.' });
    }
  }
  return { pools, droppedPools };
}
