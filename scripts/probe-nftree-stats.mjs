const ENDPOINT = 'https://graphql.mainnet.sui.io/graphql';
const NFTREE_TYPE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
const SALE_POOL_IDS = [
  '0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a',
  '0xedd6b2d96968197bc121ad7bed064a43b5ad7d84cbb8b7c00d8fd78bea3e2e4d',
  '0xed43f2ffb52ef542ea2cfccd0358431923460fec8ef659febda111614e20457a',
];

const QUERY = `query NftreeObjects($first: Int!, $after: String, $type: String!) {
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

const ownerKindCounts = {};
const addressOwners = new Set();
const objectOwners = new Set();
const resolvedObjectOwnerWallets = new Set();
const nftreeNumbers = [];
const rarities = {};
const objectIds = new Set();
const duplicateObjectIds = [];
const errors = [];
let after = null;
let hasNextPage = true;
let pagesScanned = 0;

async function graphql(query, variables = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || Array.isArray(payload.errors)) {
    throw new Error((payload.errors || [{ message: `HTTP ${response.status}` }]).map((entry) => entry?.message || String(entry)).join(' '));
  }
  return payload.data || {};
}

while (hasNextPage && pagesScanned < 100) {
  let data;
  try {
    data = await graphql(QUERY, { first: 50, after, type: NFTREE_TYPE });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    break;
  }
  const connection = data?.objects;
  const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];
  for (const node of nodes) {
    const objectId = String(node?.address || '').toLowerCase();
    if (objectIds.has(objectId)) duplicateObjectIds.push(objectId);
    else objectIds.add(objectId);
    const ownerKind = String(node?.owner?.__typename || 'Unknown');
    ownerKindCounts[ownerKind] = (ownerKindCounts[ownerKind] || 0) + 1;
    const owner = String(node?.owner?.address?.address || '').toLowerCase();
    if (ownerKind === 'AddressOwner' && owner) addressOwners.add(owner);
    if (ownerKind === 'ObjectOwner' && owner) objectOwners.add(owner);
    const json = node?.asMoveObject?.contents?.json || {};
    const number = Number(json.number);
    if (Number.isSafeInteger(number)) nftreeNumbers.push(number);
    const rarity = String(json.rarity || 'Unknown');
    rarities[rarity] = (rarities[rarity] || 0) + 1;
  }
  pagesScanned += 1;
  hasNextPage = connection?.pageInfo?.hasNextPage === true;
  after = connection?.pageInfo?.endCursor || null;
  if (hasNextPage && !after) {
    errors.push('GraphQL reported another page without an end cursor.');
    break;
  }
}

const unresolvedOwnerObjects = new Set(objectOwners);
for (let depth = 0; depth < 20 && unresolvedOwnerObjects.size; depth += 1) {
  const batch = [...unresolvedOwnerObjects].slice(0, 20);
  const fields = batch.map((address, index) => `o${index}: object(address: "${address}") { owner { __typename ... on AddressOwner { address { address } } ... on ObjectOwner { address { address } } } }`).join('\n');
  try {
    const data = await graphql(`query ResolveNftreeOwners { ${fields} }`);
    for (let index = 0; index < batch.length; index += 1) {
      const current = batch[index];
      unresolvedOwnerObjects.delete(current);
      const owner = data?.[`o${index}`]?.owner;
      const address = String(owner?.address?.address || '').toLowerCase();
      if (owner?.__typename === 'AddressOwner' && address) resolvedObjectOwnerWallets.add(address);
      else if (owner?.__typename === 'ObjectOwner' && address && !unresolvedOwnerObjects.has(address)) unresolvedOwnerObjects.add(address);
    }
  } catch (error) {
    errors.push(`Owner resolution failed: ${error instanceof Error ? error.message : String(error)}`);
    break;
  }
}

const salePoolCounts = [];
const salePoolObjectIds = new Set();
const duplicateSalePoolObjectIds = [];
try {
  const fields = SALE_POOL_IDS.map((address, index) => `p${index}: object(address: "${address}") { asMoveObject { contents { json } } }`).join('\n');
  const data = await graphql(`query NftreeSalePools { ${fields} }`);
  for (let index = 0; index < SALE_POOL_IDS.length; index += 1) {
    const nfts = Array.isArray(data?.[`p${index}`]?.asMoveObject?.contents?.json?.nfts)
      ? data[`p${index}`].asMoveObject.contents.json.nfts
      : [];
    for (const nft of nfts) {
      const id = String(nft?.id || '').toLowerCase();
      if (salePoolObjectIds.has(id)) duplicateSalePoolObjectIds.push(id);
      else salePoolObjectIds.add(id);
    }
    salePoolCounts.push({ poolId: SALE_POOL_IDS[index], count: nfts.length });
  }
} catch (error) {
  errors.push(`Sale pool scan failed: ${error instanceof Error ? error.message : String(error)}`);
}

const holderWallets = new Set([...addressOwners, ...resolvedObjectOwnerWallets]);

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  type: NFTREE_TYPE,
  pagesScanned,
  reachedEnd: !hasNextPage,
  objectsScanned: objectIds.size,
  ownerKindCounts,
  uniqueAddressOwners: addressOwners.size,
  uniqueObjectOwners: objectOwners.size,
  resolvedObjectOwnerWallets: resolvedObjectOwnerWallets.size,
  unresolvedOwnerObjects: unresolvedOwnerObjects.size,
  holderWallets: holderWallets.size,
  salePoolCounts,
  salePoolInventory: salePoolObjectIds.size,
  duplicateSalePoolObjectIds,
  totalLoaded: objectIds.size + salePoolObjectIds.size,
  minNumber: nftreeNumbers.length ? Math.min(...nftreeNumbers) : null,
  maxNumber: nftreeNumbers.length ? Math.max(...nftreeNumbers) : null,
  uniqueNumbers: new Set(nftreeNumbers).size,
  rarities,
  duplicateObjectIds,
  errors,
}, null, 2));
