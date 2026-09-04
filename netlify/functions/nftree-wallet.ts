import { NFTREE_HOLDERS_QUERY, NFTREE_TYPE, type NftreeObjectNode } from '../lib/tree-nftree-overview.ts';
import { countNftreesForWallet, nftreeOwnerRoots, normalizeSuiAddress } from '../lib/nftree-wallet-verification.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';

function response(body: unknown, status = 200, cache = 'no-store') {
  return Response.json(body, { status, headers: { 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
}

async function graphql(query: string, variables: Record<string, unknown>, signal: AbortSignal) {
  const result = await fetch(GRAPHQL_URL, {
    method: 'POST', signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await result.json().catch(() => ({})) as { data?: unknown; errors?: Array<{ message?: string }> };
  if (!result.ok || (Array.isArray(payload.errors) && payload.errors.length)) throw new Error('Sui GraphQL verification failed.');
  return payload.data;
}

async function getNftreeObjects(signal: AbortSignal) {
  const nodes: NftreeObjectNode[] = [];
  const ids = new Set<string>();
  let after: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const data = await graphql(NFTREE_HOLDERS_QUERY, { first: 50, after, type: NFTREE_TYPE }, signal) as {
      objects?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: NftreeObjectNode[] };
    };
    const connection = data?.objects;
    if (!Array.isArray(connection?.nodes)) throw new Error('NFTree object page was unavailable.');
    for (const node of connection.nodes) {
      const id = normalizeSuiAddress(node?.address);
      if (!id || ids.has(id)) throw new Error('NFTree object scan was invalid.');
      ids.add(id);
      nodes.push(node);
    }
    if (connection.pageInfo?.hasNextPage !== true) return nodes;
    after = connection.pageInfo?.endCursor || null;
    if (!after) throw new Error('NFTree object scan lacked a cursor.');
  }
  throw new Error('NFTree object scan did not reach its end.');
}

async function resolveObjectOwners(roots: string[], signal: AbortSignal) {
  const unresolved = new Map(roots.map((root) => [root, root]));
  const visited = new Map(roots.map((root) => [root, new Set([root])]));
  const resolved = new Map<string, string>();
  for (let depth = 0; depth < 12 && unresolved.size; depth += 1) {
    const currentIds = [...new Set(unresolved.values())];
    const ownerByObject = new Map<string, { kind: string; address: string | null }>();
    for (let offset = 0; offset < currentIds.length; offset += 20) {
      const batch = currentIds.slice(offset, offset + 20);
      const fields = batch.map((id, index) => `o${index}: object(address: "${id}") { owner { __typename ... on AddressOwner { address { address } } ... on ObjectOwner { address { address } } } }`).join('\n');
      const data = await graphql(`query ResolveNftreeOwners { ${fields} }`, {}, signal) as Record<string, { owner?: { __typename?: unknown; address?: { address?: unknown } | null } } | null>;
      batch.forEach((id, index) => {
        const owner = data?.[`o${index}`]?.owner;
        ownerByObject.set(id, { kind: String(owner?.__typename || ''), address: normalizeSuiAddress(owner?.address?.address) });
      });
    }
    for (const [root, current] of [...unresolved]) {
      const owner = ownerByObject.get(current);
      if (!owner?.address) throw new Error('An NFTree object-owner chain was unavailable.');
      if (owner.kind === 'AddressOwner') {
        resolved.set(root, owner.address);
        unresolved.delete(root);
      } else if (owner.kind === 'ObjectOwner') {
        const seen = visited.get(root)!;
        if (seen.has(owner.address)) throw new Error('An NFTree object-owner cycle was detected.');
        seen.add(owner.address);
        unresolved.set(root, owner.address);
      } else {
        throw new Error('An NFTree object-owner chain was unsupported.');
      }
    }
  }
  if (unresolved.size) throw new Error('An NFTree object-owner chain exceeded the verification limit.');
  return resolved;
}

export default async (request: Request) => {
  if (request.method !== 'GET') return response({ status: 'error', error: 'method-not-allowed' }, 405);
  const address = normalizeSuiAddress(new URL(request.url).searchParams.get('address'));
  if (!address) return response({ status: 'error', error: 'invalid-address' }, 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const nodes = await getNftreeObjects(controller.signal);
    const roots = nftreeOwnerRoots(nodes);
    const resolvedOwners = await resolveObjectOwners(roots, controller.signal);
    const ownership = countNftreesForWallet(nodes, resolvedOwners, address);
    return response({
      status: 'ok', address, network: 'sui-mainnet', nftreeType: NFTREE_TYPE,
      methodology: 'canonical-nftree-current-owner-v1', ...ownership,
    }, 200, 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');
  } catch (error) {
    console.error('NFTree wallet verification failed:', error);
    return response({ status: 'error', error: 'nftree-verification-unavailable' }, 503);
  } finally {
    clearTimeout(timeout);
  }
};

export const config = { path: '/api/nftree-wallet' };
