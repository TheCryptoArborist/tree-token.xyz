export const NFTREE_PACKAGE_ID = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705';
export const NFTREE_TYPE = `${NFTREE_PACKAGE_ID}::collection::NFT`;
export const NFTREE_MINT_CONFIG_ID = '0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b';
export const NFTREE_SALE_POOL_IDS = [
  '0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a',
  '0xedd6b2d96968197bc121ad7bed064a43b5ad7d84cbb8b7c00d8fd78bea3e2e4d',
  '0xed43f2ffb52ef542ea2cfccd0358431923460fec8ef659febda111614e20457a',
] as const;

type RecordLike = Record<string, unknown>;

export type NftreeObjectNode = {
  address?: unknown;
  owner?: {
    __typename?: unknown;
    address?: { address?: unknown } | null;
  } | null;
};

export type NftreeSalePool = {
  poolId: string;
  nfts: unknown[];
};

export type NftreeOverviewInput = {
  mintConfig: unknown;
  holderNodes: NftreeObjectNode[];
  holderScanReachedEnd: boolean;
  salePools: NftreeSalePool[];
};

function record(value: unknown): RecordLike {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : {};
}

function normalizedId(value: unknown): string | null {
  const id = String(value || '').toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(id) ? id : null;
}

function nftId(value: unknown): string | null {
  return normalizedId(record(value).id);
}

export function calculateNftreeOverview(input: NftreeOverviewInput) {
  if (input.holderScanReachedEnd !== true) throw new Error('NFTree holder scan did not reach the final page.');
  if (input.salePools.length !== NFTREE_SALE_POOL_IDS.length) throw new Error('Not all NFTree sale pools were returned.');

  const mintPriceMist = String(record(input.mintConfig).mint_price_mist || '');
  if (!/^\d+$/.test(mintPriceMist) || BigInt(mintPriceMist) <= 0n) throw new Error('NFTree mint price was not verified.');

  const holderIds = new Set<string>();
  const directWallets = new Set<string>();
  let directHolderOwned = 0;
  let marketplaceOrCustody = 0;
  for (const node of input.holderNodes) {
    const id = normalizedId(node.address);
    if (!id) throw new Error('NFTree holder object had an invalid object ID.');
    if (holderIds.has(id)) throw new Error(`Duplicate NFTree holder object ${id}.`);
    holderIds.add(id);
    const ownerKind = String(node.owner?.__typename || '');
    if (ownerKind === 'AddressOwner') {
      const wallet = normalizedId(node.owner?.address?.address);
      if (!wallet) throw new Error(`NFTree ${id} had an invalid address owner.`);
      directHolderOwned += 1;
      directWallets.add(wallet);
    } else if (ownerKind === 'ObjectOwner') {
      marketplaceOrCustody += 1;
    } else {
      throw new Error(`NFTree ${id} had unsupported ownership ${ownerKind || 'Unknown'}.`);
    }
  }

  const salePoolIds = new Set<string>();
  const poolInventory = input.salePools.map((pool) => {
    if (!NFTREE_SALE_POOL_IDS.includes(pool.poolId as typeof NFTREE_SALE_POOL_IDS[number])) {
      throw new Error(`Unrecognized NFTree sale pool ${pool.poolId}.`);
    }
    for (const nft of pool.nfts) {
      const id = nftId(nft);
      if (!id) throw new Error(`Sale pool ${pool.poolId} contained an invalid NFTree object.`);
      if (salePoolIds.has(id)) throw new Error(`NFTree ${id} appeared in more than one sale pool.`);
      if (holderIds.has(id)) throw new Error(`NFTree ${id} appeared as both holder-owned and sale-pool inventory.`);
      salePoolIds.add(id);
    }
    return { poolId: pool.poolId, count: pool.nfts.length };
  });

  const holderOwned = holderIds.size;
  const salePool = salePoolIds.size;
  const totalLoaded = holderOwned + salePool;
  if (directHolderOwned + marketplaceOrCustody !== holderOwned) throw new Error('NFTree ownership reconciliation failed.');
  if (poolInventory.reduce((sum, pool) => sum + pool.count, 0) !== salePool) throw new Error('NFTree sale-pool reconciliation failed.');

  const mistPerSui = 1_000_000_000n;
  const whole = BigInt(mintPriceMist) / mistPerSui;
  const remainder = BigInt(mintPriceMist) % mistPerSui;
  const mintPriceSui = Number(whole) + Number(remainder) / Number(mistPerSui);

  return {
    mintPriceMist,
    mintPriceSui,
    totalLoaded,
    holderOwned,
    salePool,
    directHolderOwned,
    marketplaceOrCustody,
    directHolderWallets: directWallets.size,
    poolInventory,
    reconciliation: {
      loadedEqualsHolderPlusPool: totalLoaded === holderOwned + salePool,
      holderOwnershipComplete: directHolderOwned + marketplaceOrCustody === holderOwned,
      salePoolObjectIdsUnique: true,
    },
  };
}

export const NFTREE_HOLDERS_QUERY = `query NftreeObjects($first: Int!, $after: String, $type: String!) {
  objects(first: $first, after: $after, filter: { type: $type }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      address
      owner {
        __typename
        ... on AddressOwner { address { address } }
        ... on ObjectOwner { address { address } }
      }
    }
  }
}`;

export function nftreePoolQuery() {
  const pools = NFTREE_SALE_POOL_IDS.map((id, index) => `p${index}: object(address: "${id}") { asMoveObject { contents { json } } }`).join('\n');
  return `query NftreePoolsAndConfig {
    config: object(address: "${NFTREE_MINT_CONFIG_ID}") { asMoveObject { contents { json } } }
    ${pools}
  }`;
}

export function parseNftreePoolResponse(data: unknown) {
  const root = record(data);
  const mintConfig = record(record(record(root.config).asMoveObject).contents).json;
  const salePools = NFTREE_SALE_POOL_IDS.map((poolId, index) => {
    const json = record(record(record(root[`p${index}`]).asMoveObject).contents).json;
    const nfts = record(json).nfts;
    if (!Array.isArray(nfts)) throw new Error(`NFTree sale pool ${poolId} was unavailable.`);
    return { poolId, nfts };
  });
  return { mintConfig, salePools };
}
