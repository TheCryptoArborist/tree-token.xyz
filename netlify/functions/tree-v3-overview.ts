import { ChannelCredentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  TREE_V3_POOL_ID,
  TREE_V3_POSITION_TYPE,
  TREE_V3_REWARD_TOKENS,
  normalizeCoinType,
  parseTreeV3PoolAccounting,
  parseTreeV3TickState,
  parseTreeV3Pool,
  parseTreeV3Position,
  parseSuiDexV3Analytics,
  record,
  valueTreeV3Position,
  type JsonRecord,
  type TreeV3TickState,
} from '../lib/tree-v3-overview.ts';
import { normalizeSuiAddress } from '../lib/leaderboard-provider.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const GRPC_HOST = 'fullnode.mainnet.sui.io:443';
const MAX_POSITION_PAGES = 20;
const POSITION_PAGE_SIZE = 50;
const SUIDEX_ANALYTICS_URL = 'https://dex.suidex.org/api/v3/pools-enriched';

const POSITION_SCAN_QUERY = `query ScanTreeV3Positions($owner: SuiAddress!, $first: Int!, $after: String, $type: String!) {
  address(address: $owner) {
    objects(first: $first, after: $after, filter: { type: $type }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        address
        owner {
          __typename
          ... on AddressOwner { address { address } }
          ... on ObjectOwner { address { address } }
        }
        contents { json }
      }
    }
  }
}`;

const TICK_SCAN_QUERY = `query TreeV3Ticks($address: SuiAddress!) {
  address(address: $address) {
    dynamicFields(first: 50) {
      pageInfo { hasNextPage }
      nodes {
        name { json }
        value {
          __typename
          ... on MoveValue { json }
        }
      }
    }
  }
}`;

function response(body: unknown, status = 200, cache = 'public, max-age=20, stale-while-revalidate=60') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cache,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function getPoolObject() {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: GRPC_HOST,
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  const { object } = await client.core.getObject({ objectId: TREE_V3_POOL_ID, include: { json: true } });
  return object?.json ?? null;
}

async function getReferencePrices() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=sui,thickquidity,bitcoin&vs_currencies=usd';
    const result = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!result.ok) return { suiUsd: null, treeUsd: null, btcUsd: null };
    const payload = record(await result.json());
    return {
      suiUsd: Number(record(payload.sui).usd) || null,
      treeUsd: Number(record(payload.thickquidity).usd) || null,
      btcUsd: Number(record(payload.bitcoin).usd) || null,
    };
  } catch {
    return { suiUsd: null, treeUsd: null, btcUsd: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function getSuiDexAnalyticsPayload() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const result = await fetch(SUIDEX_ANALYTICS_URL, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!result.ok) return null;
    return result.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getTickStates(ticksTableId: string) {
  const request = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: TICK_SCAN_QUERY, variables: { address: ticksTableId } }),
  });
  if (!request.ok) throw new Error(`Sui tick GraphQL returned HTTP ${request.status}`);
  const payload = record(await request.json());
  if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('Sui tick GraphQL returned errors.');
  const dynamicFields = record(record(record(payload.data).address).dynamicFields);
  if (record(dynamicFields.pageInfo).hasNextPage === true) throw new Error('The V3 tick scan exceeded its verified bound.');
  const tickStates = new Map<number, TreeV3TickState>();
  for (const nodeValue of Array.isArray(dynamicFields.nodes) ? dynamicFields.nodes : []) {
    const node = record(nodeValue);
    const value = record(node.value);
    if (value.__typename !== 'MoveValue') continue;
    const tick = parseTreeV3TickState(record(node.name).json, value.json);
    if (!tick || tickStates.has(tick.tick)) throw new Error('The V3 tick table contained an invalid or duplicate tick.');
    tickStates.set(tick.tick, tick);
  }
  return tickStates;
}

function valuationPrices(prices: { suiUsd?: number | null; treeUsd?: number | null; btcUsd?: number | null }, analyticsPayload: unknown) {
  const tokenPrices = record(record(analyticsPayload).tokenPrices);
  const finitePrice = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  };
  const rewardsUsd: Record<string, number> = {};
  for (const [key, value] of Object.entries(tokenPrices)) {
    const coinType = normalizeCoinType(key);
    const price = finitePrice(value);
    if (coinType && price !== null && TREE_V3_REWARD_TOKENS.some((token) => normalizeCoinType(token.coinType) === coinType)) rewardsUsd[coinType] = price;
  }
  const normalizedTree = normalizeCoinType(TREE_V3_REWARD_TOKENS[1].coinType)!;
  const normalizedBtc = normalizeCoinType(TREE_V3_REWARD_TOKENS[2].coinType)!;
  const treeUsd = finitePrice(prices.treeUsd) ?? rewardsUsd[normalizedTree] ?? null;
  const btcUsd = finitePrice(prices.btcUsd) ?? rewardsUsd[normalizedBtc] ?? null;
  if (treeUsd !== null) rewardsUsd[normalizedTree] = rewardsUsd[normalizedTree] ?? treeUsd;
  if (btcUsd !== null) rewardsUsd[normalizedBtc] = rewardsUsd[normalizedBtc] ?? btcUsd;
  return {
    suiUsd: finitePrice(prices.suiUsd) ?? finitePrice(tokenPrices.sui),
    treeUsd,
    rewardsUsd,
  };
}

async function scanPositions(owner: string, pool: NonNullable<ReturnType<typeof parseTreeV3Pool>>) {
  const positions = [];
  const seen = new Set<string>();
  let after: string | null = null;
  let pagesScanned = 0;
  let objectsScanned = 0;
  let reachedEnd = false;

  for (let page = 0; page < MAX_POSITION_PAGES; page += 1) {
    const request = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: POSITION_SCAN_QUERY,
        variables: { owner, first: POSITION_PAGE_SIZE, after, type: TREE_V3_POSITION_TYPE },
      }),
    });
    if (!request.ok) throw new Error(`Sui GraphQL returned HTTP ${request.status}`);
    const payload = record(await request.json());
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (errors.length) throw new Error(errors.map((item) => String(record(item).message || 'GraphQL error')).join(' | '));
    const connection = record(record(record(payload.data).address).objects);
    const pageInfo = record(connection.pageInfo);
    const nodes = Array.isArray(connection.nodes)
      ? connection.nodes.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'))
      : [];
    pagesScanned += 1;
    objectsScanned += nodes.length;
    for (const node of nodes) {
      const position = parseTreeV3Position(node, owner, pool);
      if (!position || seen.has(position.objectId)) continue;
      seen.add(position.objectId);
      positions.push(position);
    }
    if (pageInfo.hasNextPage !== true) { reachedEnd = true; break; }
    if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor) break;
    after = pageInfo.endCursor;
  }

  return { positions, coverage: { pagesScanned, objectsScanned, reachedEnd, scanComplete: reachedEnd } };
}

export default async (request: Request) => {
  if (request.method !== 'GET') return response({ status: 'error', error: 'method-not-allowed' }, 405, 'no-store');
  const generatedAt = new Date().toISOString();
  const url = new URL(request.url);
  const ownerInput = url.searchParams.get('owner');
  const owner = ownerInput ? normalizeSuiAddress(ownerInput) : null;
  if (ownerInput && !owner) return response({ status: 'error', error: 'invalid-owner' }, 400, 'no-store');

  try {
    const [poolObject, prices, analyticsPayload] = await Promise.all([getPoolObject(), getReferencePrices(), getSuiDexAnalyticsPayload()]);
    const pool = parseTreeV3Pool(poolObject, prices);
    if (!pool) return response({ status: 'error', generatedAt, error: 'pool-verification-failed' }, 503, 'no-store');
    const analytics = parseSuiDexV3Analytics(analyticsPayload, pool);
    const accounting = parseTreeV3PoolAccounting(poolObject, pool);

    if (!owner) {
      return response({
        status: 'ok',
        generatedAt,
        network: 'sui-mainnet',
        provider: 'sui-grpc-plus-verified-config',
        market: { ...prices, source: prices.suiUsd || prices.treeUsd ? 'coingecko' : 'unavailable' },
        pool,
        analytics: analytics ?? {
          volume24hUsd: null,
          fees24hUsd: null,
          aprPercent: null,
          rewards: [],
          status: 'not-published-without-verified-source', source: null,
        },
        warnings: [
          ...(pool.tvlUsdEstimate === null ? ['Pool TVL estimate is unavailable because one or both reference prices could not be verified.'] : ['TVL is an estimate from current on-chain reserves and external USD reference prices.']),
          ...(!analytics ? ['SuiDex volume, fee, and incentive analytics could not be independently validated.'] : []),
        ],
      });
    }

    const positionResult = await scanPositions(owner, pool);
    const tickStates = accounting ? await getTickStates(accounting.ticksTableId) : new Map<number, TreeV3TickState>();
    const positionValues = positionResult.positions.map((position) => valueTreeV3Position(
      position, pool, accounting, tickStates, valuationPrices(prices, analyticsPayload), Math.floor(Date.now() / 1000),
    ));
    return response({
      status: positionResult.coverage.scanComplete ? 'ok' : 'verification-incomplete',
      generatedAt,
      network: 'sui-mainnet',
      provider: 'sui-graphql-public-position-scan',
      owner,
      market: { ...prices, source: prices.suiUsd || prices.treeUsd ? 'coingecko' : 'unavailable' },
      pool,
      positionCount: positionValues.length,
      positions: positionResult.coverage.scanComplete ? positionValues : [],
      coverage: positionResult.coverage,
      warnings: positionResult.coverage.scanComplete
        ? []
        : ['The public V3 position scan did not reach its natural end. Partial positions were not published.'],
    }, 200, 'private, no-store');
  } catch (error) {
    console.error('TREE V3 overview failed:', error);
    return response({
      status: 'error',
      generatedAt,
      error: 'v3-overview-unavailable',
      message: error instanceof Error ? error.message : String(error),
    }, 503, 'no-store');
  }
};

export const config = { path: '/api/tree-v3-overview' };
