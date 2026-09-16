import { calculateTreeLiquidity, type ChainPoolObject } from '../lib/tree-liquidity-overview.ts';
import { SUIDEX_V2_TREE_POOL_ID } from '../lib/suidex-v2-tree-lp-provider.ts';
import { TURBOS_TREE_POOL_IDS } from '../lib/turbos-tree-lp-provider.ts';
import { TREE_V3_POOL_ID, record } from '../lib/tree-v3-overview.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const POOL_IDS = [SUIDEX_V2_TREE_POOL_ID, TREE_V3_POOL_ID, ...TURBOS_TREE_POOL_IDS];

function response(body: unknown, status = 200, cache = 'public, max-age=20, s-maxage=30, stale-while-revalidate=60') {
  return Response.json(body, { status, headers: { 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
}

async function getPoolObjects(): Promise<ChainPoolObject[]> {
  const fields = POOL_IDS.map((id, index) => `p${index}: object(address: \"${id}\") { address asMoveObject { contents { type { repr } json } } }`).join('\n');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const result = await fetch(GRAPHQL_URL, {
      method: 'POST', signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query TreeLiquidityPools { ${fields} }` }),
    });
    if (!result.ok) throw new Error(`Sui GraphQL returned HTTP ${result.status}`);
    const payload = record(await result.json());
    if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('Sui GraphQL returned pool errors.');
    const data = record(payload.data);
    return POOL_IDS.map((_id, index) => {
      const object = record(data[`p${index}`]);
      const contents = record(record(object.asMoveObject).contents);
      return { address: object.address, type: record(contents.type).repr, json: contents.json };
    });
  } finally { clearTimeout(timeout); }
}

async function getPrices() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const result = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=sui,thickquidity,bitcoin,usd-coin&vs_currencies=usd', {
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (!result.ok) throw new Error(`CoinGecko returned HTTP ${result.status}`);
    const payload = record(await result.json());
    const price = (id: string) => Number(record(payload[id]).usd);
    const prices = { suiUsd: price('sui'), treeUsd: price('thickquidity'), wbtcUsd: price('bitcoin'), usdcUsd: price('usd-coin') };
    if (Object.values(prices).some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Reference prices were incomplete.');
    return prices;
  } finally { clearTimeout(timeout); }
}

export default async (request: Request) => {
  if (request.method !== 'GET') return response({ status: 'error', error: 'method-not-allowed' }, 405, 'no-store');
  const generatedAt = new Date().toISOString();
  try {
    const [objects, prices] = await Promise.all([getPoolObjects(), getPrices()]);
    const liquidity = calculateTreeLiquidity(objects, prices);
    if (!liquidity) throw new Error('One or more recognized pools could not be completely verified.');
    return response({
      status: 'ok', generatedAt, network: 'sui-mainnet',
      source: 'Sui Mainnet reserves + CoinGecko USD prices',
      methodology: 'recognized-tree-liquidity-v1', prices, liquidity,
      coverage: { suiDexV2Pools: 1, suiDexV3Pools: 1, turbosPoolsChecked: TURBOS_TREE_POOL_IDS.length, activeTurbosPools: liquidity.activeTurbosPools },
      warnings: ['USD liquidity is estimated from current verified on-chain reserves and current external reference prices.'],
    });
  } catch (error) {
    console.error('TREE liquidity overview failed:', error);
    return response({ status: 'error', generatedAt, error: 'liquidity-verification-unavailable', message: error instanceof Error ? error.message : String(error) }, 503, 'no-store');
  }
};

export const config = { path: '/api/tree-liquidity' };
