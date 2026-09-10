import {
  NFTREE_HOLDERS_QUERY,
  NFTREE_TYPE,
  calculateNftreeOverview,
  nftreePoolQuery,
  parseNftreePoolResponse,
  type NftreeObjectNode,
} from '../lib/tree-nftree-overview.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';

function response(body: unknown, status = 200, cache = 'public, max-age=30, s-maxage=60, stale-while-revalidate=180') {
  return Response.json(body, { status, headers: { 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
}

async function graphql(query: string, variables: Record<string, unknown>, signal: AbortSignal) {
  const result = await fetch(GRAPHQL_URL, {
    method: 'POST', signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!result.ok) throw new Error(`Sui GraphQL returned HTTP ${result.status}.`);
  const payload = await result.json() as { data?: unknown; errors?: Array<{ message?: string }> };
  if (Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error(payload.errors.map((error) => error?.message || 'Unknown GraphQL error').join(' '));
  }
  return payload.data;
}

async function getHolderObjects(signal: AbortSignal) {
  const nodes: NftreeObjectNode[] = [];
  let after: string | null = null;
  let reachedEnd = false;
  let pagesScanned = 0;
  while (pagesScanned < 20) {
    const data = await graphql(NFTREE_HOLDERS_QUERY, { first: 50, after, type: NFTREE_TYPE }, signal) as {
      objects?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: NftreeObjectNode[] };
    };
    const connection = data?.objects;
    if (!Array.isArray(connection?.nodes)) throw new Error('NFTree holder page was unavailable.');
    nodes.push(...connection.nodes);
    pagesScanned += 1;
    if (connection.pageInfo?.hasNextPage !== true) { reachedEnd = true; break; }
    after = connection.pageInfo?.endCursor || null;
    if (!after) throw new Error('NFTree holder scan lacked a continuation cursor.');
  }
  return { nodes, reachedEnd, pagesScanned };
}

export default async (request: Request) => {
  if (request.method !== 'GET') return response({ status: 'error', error: 'method-not-allowed' }, 405, 'no-store');
  const generatedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const [holders, poolData] = await Promise.all([
      getHolderObjects(controller.signal),
      graphql(nftreePoolQuery(), {}, controller.signal).then(parseNftreePoolResponse),
    ]);
    const nftree = calculateNftreeOverview({
      mintConfig: poolData.mintConfig,
      holderNodes: holders.nodes,
      holderScanReachedEnd: holders.reachedEnd,
      salePools: poolData.salePools,
    });
    return response({
      status: 'ok', generatedAt, network: 'sui-mainnet', source: 'Sui Mainnet GraphQL',
      methodology: 'verified-nftree-ownership-v1', nftree,
      coverage: {
        holderPagesScanned: holders.pagesScanned,
        holderObjectsScanned: holders.nodes.length,
        salePoolsScanned: poolData.salePools.length,
        reachedEnd: holders.reachedEnd,
      },
      warnings: nftree.marketplaceOrCustody > 0
        ? [`${nftree.marketplaceOrCustody} holder-owned NFTrees are object-owned by marketplace or custody objects, so the wallet count reports directly verifiable address owners only.`]
        : [],
    });
  } catch (error) {
    console.error('NFTree overview failed:', error);
    return response({
      status: 'error', generatedAt, error: 'nftree-verification-unavailable',
      message: error instanceof Error ? error.message : String(error),
    }, 503, 'no-store');
  } finally {
    clearTimeout(timeout);
  }
};

export const config = { path: '/api/tree-nftree' };
