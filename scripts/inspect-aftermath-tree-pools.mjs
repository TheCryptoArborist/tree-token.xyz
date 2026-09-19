import { createAftermathTreeDiscoveryAdapter } from '../netlify/lib/aftermath-tree-discovery.ts';

const pools = await createAftermathTreeDiscoveryAdapter().discover();
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: pools.length,
  pools: pools.map((pool) => ({
    poolId: pool.poolId,
    coinTypes: pool.coinTypes,
    discoverySource: pool.discoverySource,
  })),
}, null, 2));
