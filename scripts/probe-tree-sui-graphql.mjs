const DEFAULT_ENDPOINT = 'https://graphql.mainnet.sui.io/graphql';
const TREE_COIN_OBJECT_TYPE = '0x2::coin::Coin<0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>';
const QUERY = `query TreeCoinObjects($first: Int!, $after: String, $coinObjectType: String!) {
  objects(first: $first, after: $after, filter: { type: $coinObjectType }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      address
      owner {
        __typename
        ... on AddressOwner { address { address } }
        ... on ObjectOwner { address { address } }
      }
      asMoveObject {
        contents {
          json
          balanceField: extract(path: "balance") { json }
        }
      }
    }
  }
}`;

const argumentsList = process.argv.slice(2);
const showWallets = argumentsList.includes('--show-wallets');
const pagesArgument = argumentsList.find((argument) => argument.startsWith('--pages='));
const endpointArgument = argumentsList.find((argument) => argument.startsWith('--endpoint='));
const requestedPages = pagesArgument ? Number(pagesArgument.slice('--pages='.length)) : 1;
if (!Number.isInteger(requestedPages) || requestedPages < 1 || requestedPages > 100) {
  console.error('--pages must be an integer from 1 to 100.');
  process.exit(1);
}
const endpoint = endpointArgument ? endpointArgument.slice('--endpoint='.length) : DEFAULT_ENDPOINT;
try { new URL(endpoint); } catch {
  console.error('--endpoint must be a valid URL.');
  process.exit(1);
}

const ownerKindCounts = {};
const walletRaw = new Map();
let malformedBalanceCount = 0;
let aggregateAddressOwnedRaw = 0n;
let objectsReturned = 0;
let pagesScanned = 0;
let after = null;
let finalPageInfo = null;
let finalHttpStatus = null;
const graphqlErrors = [];

for (let page = 0; page < requestedPages; page += 1) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-sui-rpc-show-usage': 'true',
    },
    body: JSON.stringify({ query: QUERY, variables: { first: 50, after, coinObjectType: TREE_COIN_OBJECT_TYPE } }),
  });
  finalHttpStatus = response.status;
  const payload = await response.json().catch(() => ({}));
  if (Array.isArray(payload.errors)) graphqlErrors.push(...payload.errors.map((error) => error?.message || 'Unknown GraphQL error'));
  if (!response.ok || graphqlErrors.length) break;
  const objects = payload?.data?.objects;
  const nodes = Array.isArray(objects?.nodes) ? objects.nodes : [];
  finalPageInfo = objects?.pageInfo || null;
  pagesScanned += 1;
  objectsReturned += nodes.length;
  for (const node of nodes) {
    const ownerKind = typeof node?.owner?.__typename === 'string' ? node.owner.__typename : 'Unknown';
    ownerKindCounts[ownerKind] = (ownerKindCounts[ownerKind] || 0) + 1;
    const rawValue = node?.asMoveObject?.contents?.balanceField?.json ?? node?.asMoveObject?.contents?.json?.balance;
    if (typeof rawValue !== 'string' || !/^\d+$/.test(rawValue)) {
      malformedBalanceCount += 1;
      continue;
    }
    if (ownerKind !== 'AddressOwner') continue;
    const raw = BigInt(rawValue);
    aggregateAddressOwnedRaw += raw;
    const wallet = node?.owner?.address?.address;
    if (typeof wallet === 'string') walletRaw.set(wallet.toLowerCase(), (walletRaw.get(wallet.toLowerCase()) || 0n) + raw);
  }
  if (finalPageInfo?.hasNextPage !== true || typeof finalPageInfo?.endCursor !== 'string' || !finalPageInfo.endCursor) break;
  after = finalPageInfo.endCursor;
}

const report = {
  httpStatus: finalHttpStatus,
  graphqlErrors,
  pageInfo: finalPageInfo,
  pagesScanned,
  objectsReturned,
  ownerKindCounts,
  malformedBalanceCount,
  aggregateAddressOwnedRawTree: aggregateAddressOwnedRaw.toString(),
  completeLeaderboardScan: false,
  note: 'This bounded diagnostic probe is not treated as a complete leaderboard scan.',
};
if (showWallets) report.wallets = [...walletRaw.entries()].map(([wallet, raw]) => ({ wallet, raw: raw.toString() }));
console.log(JSON.stringify(report, null, 2));
