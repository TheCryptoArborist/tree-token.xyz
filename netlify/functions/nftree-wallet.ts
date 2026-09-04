import { NFTREE_TYPE } from '../lib/tree-nftree-overview.ts';
import { normalizeSuiAddress } from '../lib/nftree-wallet-verification.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const KIOSK_OWNER_CAP_TYPE = '0x2::kiosk::KioskOwnerCap';
const KIOSK_ITEM_SUFFIX = '::kiosk::Item';

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

const OWNED_OBJECTS_QUERY = `query OwnedObjects($first: Int!, $after: String, $type: String!, $owner: SuiAddress!) {
  objects(first: $first, after: $after, filter: { type: $type, owner: $owner }) {
    pageInfo { hasNextPage endCursor }
    nodes { address asMoveObject { contents { json } } }
  }
}`;

async function getOwnedObjects(owner: string, type: string, signal: AbortSignal) {
  const nodes: Array<{ address?: unknown; asMoveObject?: { contents?: { json?: unknown } } | null }> = [];
  const ids = new Set<string>();
  let after: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const data = await graphql(OWNED_OBJECTS_QUERY, { first: 50, after, type, owner }, signal) as {
      objects?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: typeof nodes };
    };
    const connection = data?.objects;
    if (!Array.isArray(connection?.nodes)) throw new Error('Owned object page was unavailable.');
    for (const node of connection.nodes) {
      const id = normalizeSuiAddress(node?.address);
      if (!id || ids.has(id)) throw new Error('Owned object identities were invalid.');
      ids.add(id);
      nodes.push(node);
    }
    if (connection.pageInfo?.hasNextPage !== true) return nodes;
    after = connection.pageInfo?.endCursor || null;
    if (!after) throw new Error('Owned object scan lacked a cursor.');
  }
  throw new Error('Owned object scan did not reach its end.');
}

const KIOSK_FIELDS_QUERY = `query KioskFields($kiosk: SuiAddress!, $first: Int!, $after: String) {
  object(address: $kiosk) {
    dynamicFields(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { name { type { repr } json } }
    }
  }
}`;

async function getKioskItemIds(kiosk: string, signal: AbortSignal) {
  const ids = new Set<string>();
  let after: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const data = await graphql(KIOSK_FIELDS_QUERY, { kiosk, first: 50, after }, signal) as {
      object?: { dynamicFields?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: Array<{ name?: { type?: { repr?: unknown }; json?: { id?: unknown } } }> } } | null;
    };
    const fields = data?.object?.dynamicFields;
    if (!Array.isArray(fields?.nodes)) throw new Error('Kiosk contents were unavailable.');
    for (const node of fields.nodes) {
      if (!String(node?.name?.type?.repr || '').endsWith(KIOSK_ITEM_SUFFIX)) continue;
      const id = normalizeSuiAddress(node?.name?.json?.id);
      if (!id || ids.has(id)) throw new Error('Kiosk item identities were invalid.');
      ids.add(id);
    }
    if (fields.pageInfo?.hasNextPage !== true) return [...ids];
    after = fields.pageInfo?.endCursor || null;
    if (!after) throw new Error('Kiosk scan lacked a cursor.');
  }
  throw new Error('Kiosk scan did not reach its end.');
}

async function getObjectTypes(ids: string[], signal: AbortSignal) {
  const result = new Map<string, string>();
  const batches = [];
  for (let offset = 0; offset < ids.length; offset += 20) batches.push(ids.slice(offset, offset + 20));
  const responses = await Promise.all(batches.map(async (batch) => {
    const fields = batch.map((id, index) => `o${index}: object(address: "${id}") { asMoveObject { contents { type { repr } } } }`).join('\n');
    const data = await graphql(`query KioskItemTypes { ${fields} }`, {}, signal) as Record<string, { asMoveObject?: { contents?: { type?: { repr?: unknown } } } | null } | null>;
    return { batch, data };
  }));
  responses.forEach(({ batch, data }) => batch.forEach((id, index) => {
    const type = String(data?.[`o${index}`]?.asMoveObject?.contents?.type?.repr || '');
    if (!type) throw new Error('A Kiosk item type was unavailable.');
    result.set(id, type);
  }));
  return result;
}

export default async (request: Request) => {
  if (request.method !== 'GET') return response({ status: 'error', error: 'method-not-allowed' }, 405);
  const address = normalizeSuiAddress(new URL(request.url).searchParams.get('address'));
  if (!address) return response({ status: 'error', error: 'invalid-address' }, 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 26_000);
  try {
    const [directNftrees, ownerCaps] = await Promise.all([
      getOwnedObjects(address, NFTREE_TYPE, controller.signal),
      getOwnedObjects(address, KIOSK_OWNER_CAP_TYPE, controller.signal),
    ]);
    const kioskIds = ownerCaps.map((cap) => normalizeSuiAddress((cap.asMoveObject?.contents?.json as { for?: unknown } | undefined)?.for));
    if (kioskIds.some((id) => !id) || new Set(kioskIds).size !== kioskIds.length) throw new Error('Kiosk ownership capabilities were invalid.');
    const kioskItems = (await Promise.all(kioskIds.map((id) => getKioskItemIds(id!, controller.signal)))).flat();
    if (new Set(kioskItems).size !== kioskItems.length) throw new Error('Kiosk item identities overlapped.');
    const itemTypes = await getObjectTypes(kioskItems, controller.signal);
    const kioskCount = kioskItems.filter((id) => itemTypes.get(id) === NFTREE_TYPE).length;
    const directCount = directNftrees.length;
    return response({
      status: 'ok', address, network: 'sui-mainnet', nftreeType: NFTREE_TYPE,
      methodology: 'canonical-nftree-direct-and-kiosk-cap-v2',
      nftreeCount: directCount + kioskCount, directCount, kioskCount,
      kiosksScanned: kioskIds.length, kioskItemsScanned: kioskItems.length,
    }, 200, 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');
  } catch (error) {
    console.error('NFTree wallet verification failed:', error);
    return response({ status: 'error', error: 'nftree-verification-unavailable' }, 503);
  } finally {
    clearTimeout(timeout);
  }
};

export const config = { path: '/api/nftree-wallet' };
