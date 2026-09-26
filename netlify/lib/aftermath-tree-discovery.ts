import { Aftermath } from 'aftermath-ts-sdk';
import { TREE_TYPE, normalizeMoveType } from './tree-swap-route.ts';
import type { DiscoveredPoolCandidate, VenueDiscoveryAdapter } from './tree-venue-discovery.ts';

type AftermathPoolLike = {
  pool?: {
    objectId?: string;
    coins?: Record<string, unknown>;
  };
};

export function aftermathPoolToCandidate(poolLike: AftermathPoolLike): DiscoveredPoolCandidate | null {
  const pool = poolLike.pool || {};
  const poolId = String(pool.objectId || '').toLowerCase();
  const coinTypes = Object.keys(pool.coins || {});
  if (!poolId || !coinTypes.some((type) => normalizeMoveType(type) === normalizeMoveType(TREE_TYPE))) return null;
  return {
    venue: 'aftermath',
    poolId,
    coinTypes,
    discoverySource: 'aftermath-sdk:getAllPools',
  };
}

export function createAftermathTreeDiscoveryAdapter(): VenueDiscoveryAdapter {
  return {
    venue: 'aftermath',
    discover: async () => {
      const afSdk = await Aftermath.create({ network: 'MAINNET' });
      const pools = await afSdk.Pools().getAllPools();
      return pools
        .map((pool) => aftermathPoolToCandidate(pool as unknown as AftermathPoolLike))
        .filter((pool): pool is DiscoveredPoolCandidate => pool !== null);
    },
  };
}
