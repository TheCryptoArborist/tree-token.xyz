import { ChannelCredentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  TREE_V3_POOL_ID,
  TREE_V3_POSITION_TYPE,
  parseTreeV3Pool,
  parseTreeV3Position,
  parseSuiDexV3Analytics,
  record,
  type JsonRecord,
} from '../lib/tree-v3-overview.ts';
import { normalizeSuiAddress } from '../lib/leaderboard-provider.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const GRPC_HOST = 'fullnode.mainnet.sui.io:443';
const MAX_POSITION_PAGES = 20;
const POSITION_PAGE_SIZE = 50;
const SUIDEX_ANALYTICS_URL = 'https://dex.suidex.org/api/v3/pools-enriched';

const POSITION_SCAN_QUERY = `query ScanTreeV3Positions($first: Int!, $after: String, $type: String!) {
  objects(first: $first, after: $after, filter: { type: $type }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      address
      owner {
        __typename
        ... on AddressOwner { address { address } }
        ... on ObjectOwner { address { address } }
      }
      asMoveObject { contents { json } }
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
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=sui,thickquidity&vs_currencies=usd';
    const result = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!result.ok) return { suiUsd: null, treeUsd: null };
    const payload = record(await result.json());
    return {
      suiUsd: Number(record(payload.sui).usd) || null,
      treeUsd: Number(record(payload.thickquidity).usd) || null,
    };
  } catch {
    return { suiUsd: null, treeUsd: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function getSuiDexAnalyticsPayload() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
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
        variables: { first: POSITION_PAGE_SIZE, after, type: TREE_V3_POSITION_TYPE },
      }),
    });
    if (!request.ok) throw new Error(`Sui GraphQL returned HTTP ${request.status}`);
    const payload = record(await request.json());
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (errors.length) throw new Error(errors.map((item) => String(record(item).message || 'GraphQL error')).join(' | '));
    const connection = record(record(payload.data).objects);
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
    return response({
      status: positionResult.coverage.scanComplete ? 'ok' : 'verification-incomplete',
      generatedAt,
      network: 'sui-mainnet',
      provider: 'sui-graphql-public-position-scan',
      owner,
      market: { ...prices, source: prices.suiUsd || prices.treeUsd ? 'coingecko' : 'unavailable' },
      pool,
      positionCount: positionResult.positions.length,
      positions: positionResult.coverage.scanComplete ? positionResult.positions : [],
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
