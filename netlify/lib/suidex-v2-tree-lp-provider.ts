import { ChannelCredentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  TREE_COIN_TYPE,
  excludedAddress,
  normalizeSuiAddress,
} from './leaderboard-provider.ts';
import {
  type ExposureVenueResult,
  type WalletLpPosition,
  parseUnsignedRaw,
} from './tree-exposure-types.ts';

export const SUIDEX_V2_PACKAGE = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
export const SUIDEX_V2_TREE_POOL_ID = '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';
export const SUI_COIN_TYPE = '0x2::sui::SUI';
export const SUIDEX_V2_TREE_LP_TYPE = `${SUIDEX_V2_PACKAGE}::pair::LPCoin<${SUI_COIN_TYPE},${TREE_COIN_TYPE}>`;
export const SUIDEX_V2_TREE_LP_COIN_TYPE = `0x2::coin::Coin<${SUIDEX_V2_TREE_LP_TYPE}>`;
export const SUIDEX_V2_TREE_FARM_POSITION_TYPE = `${SUIDEX_V2_PACKAGE}::farm::StakingPosition<${SUIDEX_V2_TREE_LP_TYPE}>`;
export const SUIDEX_V2_PROVIDER = 'suidex-v2-onchain';
export const SUIDEX_V2_METHODOLOGY_VERSION = 'suidex-v2-tree-lp-v1';
const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_GRPC_HOST = 'fullnode.mainnet.sui.io:443';

const TYPE_SCAN_QUERY = `query ScanTypedObjects($first: Int!, $after: String, $type: String!) {
  objects(first: $first, after: $after, filter: { type: $type }) {
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
          amountField: extract(path: "amount") { json }
        }
      }
    }
  }
}`;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;
type PoolObject = { type?: string | null; json?: unknown };
type TypeScan = { nodes: JsonRecord[]; reachedEnd: boolean; pages: number };

export type SuiDexV2Coverage = {
  poolVerified: boolean;
  poolId: string;
  reserveTreeRaw: string | null;
  totalLpSupplyRaw: string | null;
  pagesScanned: number;
  directLpCoinObjects: number;
  farmPositionObjects: number;
  uniqueOwners: number;
  directLpRaw: string;
  stakedLpRaw: string;
  attributedLpRaw: string;
  malformedOwners: number;
  malformedBalances: number;
  duplicateObjectIds: number;
  excludedObjects: number;
  reachedEnd: boolean;
  scanComplete: boolean;
  networkError: string | null;
  graphqlErrors: string[];
};

export type SuiDexV2Result = ExposureVenueResult & {
  provider: typeof SUIDEX_V2_PROVIDER;
  methodologyVersion: typeof SUIDEX_V2_METHODOLOGY_VERSION;
  coverage: SuiDexV2Coverage;
  pool: {
    poolId: string;
    reserveTreeRaw: string | null;
    totalLpSupplyRaw: string | null;
  };
};

export type SuiDexV2Options = {
  graphqlUrl?: string;
  grpcHost?: string;
  fetchImpl?: FetchLike;
  getPoolObject?: () => Promise<PoolObject>;
  scanType?: (type: string) => Promise<TypeScan>;
  generatedAt?: string;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function ownerAddress(node: JsonRecord): string | null {
  const owner = record(node.owner);
  if (owner.__typename !== 'AddressOwner') return null;
  const address = owner.address;
  return normalizeSuiAddress(typeof address === 'string' ? address : record(address).address);
}

function rawField(node: JsonRecord, field: 'balance' | 'amount'): bigint | null {
  const contents = record(record(node.asMoveObject).contents);
  const extracted = record(contents[`${field}Field`]).json;
  const json = record(contents.json);
  return parseUnsignedRaw(extracted ?? json[field]);
}

async function defaultPoolObject(grpcHost: string): Promise<PoolObject> {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: grpcHost.replace(/^https?:\/\//, ''),
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  const { object } = await client.core.getObject({ objectId: SUIDEX_V2_TREE_POOL_ID, include: { json: true } });
  return object ? { type: object.type, json: object.json } : {};
}

async function defaultScanType(type: string, endpoint: string, fetchImpl: FetchLike): Promise<TypeScan> {
  const nodes: JsonRecord[] = [];
  let after: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TYPE_SCAN_QUERY, variables: { first: 50, after, type } }),
    });
    if (!response.ok) throw new Error(`Sui GraphQL returned HTTP ${response.status}`);
    const payload = record(await response.json());
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (errors.length) throw new Error(errors.map((item) => String(record(item).message || 'GraphQL error')).join(' | '));
    const connection = record(record(payload.data).objects);
    const pageInfo = record(connection.pageInfo);
    const pageNodes = Array.isArray(connection.nodes) ? connection.nodes.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object')) : [];
    nodes.push(...pageNodes);
    if (pageInfo.hasNextPage !== true) return { nodes, reachedEnd: true, pages: page + 1 };
    if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor) return { nodes, reachedEnd: false, pages: page + 1 };
    after = pageInfo.endCursor;
  }
  return { nodes, reachedEnd: false, pages: 100 };
}

function verifyPool(value: PoolObject) {
  const json = record(value.json);
  const reserveTreeRaw = parseUnsignedRaw(json.reserve1);
  const totalSupplyRaw = parseUnsignedRaw(json.total_supply);
  const lpSupplyRaw = parseUnsignedRaw(record(json.lp_supply).value);
  const type = typeof value.type === 'string' ? value.type.toLowerCase() : '';
  const expectedTree = TREE_COIN_TYPE.toLowerCase().replace(/^0x/, '');
  const validType = type.includes('::pair::pair<') && type.includes('::sui::sui') && type.includes(expectedTree);
  const validSupply = totalSupplyRaw !== null && totalSupplyRaw > 0n && lpSupplyRaw === totalSupplyRaw;
  return {
    valid: validType && reserveTreeRaw !== null && reserveTreeRaw >= 0n && validSupply,
    reserveTreeRaw,
    totalSupplyRaw,
  };
}

type WalletAccumulator = { directLpRaw: bigint; stakedLpRaw: bigint; positionCount: number };

export function lpRawToTreeRaw(lpRaw: bigint, reserveTreeRaw: bigint, totalLpSupplyRaw: bigint): bigint {
  if (lpRaw <= 0n || reserveTreeRaw <= 0n || totalLpSupplyRaw <= 0n) return 0n;
  return lpRaw * reserveTreeRaw / totalLpSupplyRaw;
}

export async function scanSuiDexV2TreeLp(options: SuiDexV2Options = {}): Promise<SuiDexV2Result> {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const coverage: SuiDexV2Coverage = {
    poolVerified: false,
    poolId: SUIDEX_V2_TREE_POOL_ID,
    reserveTreeRaw: null,
    totalLpSupplyRaw: null,
    pagesScanned: 0,
    directLpCoinObjects: 0,
    farmPositionObjects: 0,
    uniqueOwners: 0,
    directLpRaw: '0',
    stakedLpRaw: '0',
    attributedLpRaw: '0',
    malformedOwners: 0,
    malformedBalances: 0,
    duplicateObjectIds: 0,
    excludedObjects: 0,
    reachedEnd: false,
    scanComplete: false,
    networkError: null,
    graphqlErrors: [],
  };
  const warnings: string[] = [];
  const positions: WalletLpPosition[] = [];
  try {
    const pool = verifyPool(await (options.getPoolObject || (() => defaultPoolObject(options.grpcHost || DEFAULT_GRPC_HOST)))());
    coverage.poolVerified = pool.valid;
    coverage.reserveTreeRaw = pool.reserveTreeRaw?.toString() ?? null;
    coverage.totalLpSupplyRaw = pool.totalSupplyRaw?.toString() ?? null;
    if (!pool.valid || pool.reserveTreeRaw === null || pool.totalSupplyRaw === null) {
      warnings.push('The SuiDex V2 TREE/SUI pool could not be verified; no LP exposure was published.');
      return {
        venue: 'suiDexV2', outcome: 'verification-incomplete', provider: SUIDEX_V2_PROVIDER,
        methodologyVersion: SUIDEX_V2_METHODOLOGY_VERSION, generatedAt, positions, coverage,
        pool: { poolId: SUIDEX_V2_TREE_POOL_ID, reserveTreeRaw: coverage.reserveTreeRaw, totalLpSupplyRaw: coverage.totalLpSupplyRaw }, warnings,
      };
    }

    const scan = options.scanType || ((type: string) => defaultScanType(type, options.graphqlUrl || DEFAULT_GRAPHQL_URL, options.fetchImpl || fetch));
    const [direct, farm] = await Promise.all([scan(SUIDEX_V2_TREE_LP_COIN_TYPE), scan(SUIDEX_V2_TREE_FARM_POSITION_TYPE)]);
    coverage.pagesScanned = direct.pages + farm.pages;
    coverage.directLpCoinObjects = direct.nodes.length;
    coverage.farmPositionObjects = farm.nodes.length;
    coverage.reachedEnd = direct.reachedEnd && farm.reachedEnd;
    const seen = new Set<string>();
    const wallets = new Map<string, WalletAccumulator>();

    const consume = (node: JsonRecord, field: 'balance' | 'amount') => {
      const objectId = normalizeSuiAddress(node.address);
      if (!objectId || seen.has(objectId)) {
        coverage.duplicateObjectIds += seen.has(objectId || '') ? 1 : 0;
        return;
      }
      seen.add(objectId);
      const wallet = ownerAddress(node);
      if (!wallet) { coverage.malformedOwners += 1; return; }
      if (excludedAddress(wallet)) { coverage.excludedObjects += 1; return; }
      const raw = rawField(node, field);
      if (raw === null) { coverage.malformedBalances += 1; return; }
      const prior = wallets.get(wallet) || { directLpRaw: 0n, stakedLpRaw: 0n, positionCount: 0 };
      if (field === 'balance') prior.directLpRaw += raw;
      else prior.stakedLpRaw += raw;
      prior.positionCount += 1;
      wallets.set(wallet, prior);
    };
    direct.nodes.forEach((node) => consume(node, 'balance'));
    farm.nodes.forEach((node) => consume(node, 'amount'));

    let directLpRaw = 0n;
    let stakedLpRaw = 0n;
    for (const [wallet, value] of wallets) {
      directLpRaw += value.directLpRaw;
      stakedLpRaw += value.stakedLpRaw;
      const totalLpRaw = value.directLpRaw + value.stakedLpRaw;
      const lpTreeRaw = lpRawToTreeRaw(totalLpRaw, pool.reserveTreeRaw, pool.totalSupplyRaw);
      if (lpTreeRaw > 0n) positions.push({
        wallet,
        venue: 'suiDexV2',
        lpTreeRaw: lpTreeRaw.toString(),
        positionCount: value.positionCount,
        metadata: {
          directLpRaw: value.directLpRaw.toString(),
          stakedLpRaw: value.stakedLpRaw.toString(),
          totalLpRaw: totalLpRaw.toString(),
        },
      });
    }
    const attributedLpRaw = directLpRaw + stakedLpRaw;
    coverage.uniqueOwners = positions.length;
    coverage.directLpRaw = directLpRaw.toString();
    coverage.stakedLpRaw = stakedLpRaw.toString();
    coverage.attributedLpRaw = attributedLpRaw.toString();
    const integrityValid = coverage.malformedOwners === 0
      && coverage.malformedBalances === 0
      && coverage.duplicateObjectIds === 0
      && attributedLpRaw <= pool.totalSupplyRaw;
    coverage.scanComplete = coverage.poolVerified && coverage.reachedEnd && integrityValid;
    if (!coverage.reachedEnd) warnings.push('The SuiDex V2 LP scan did not reach the natural end; partial exposure was not published.');
    if (!integrityValid) warnings.push('SuiDex V2 LP data integrity verification failed; partial exposure was not published.');
    if (!coverage.scanComplete) positions.length = 0;
    return {
      venue: 'suiDexV2', outcome: coverage.scanComplete ? 'complete' : 'verification-incomplete',
      provider: SUIDEX_V2_PROVIDER, methodologyVersion: SUIDEX_V2_METHODOLOGY_VERSION,
      generatedAt, positions, coverage,
      pool: { poolId: SUIDEX_V2_TREE_POOL_ID, reserveTreeRaw: coverage.reserveTreeRaw, totalLpSupplyRaw: coverage.totalLpSupplyRaw }, warnings,
    };
  } catch (error) {
    coverage.networkError = error instanceof Error ? error.message : 'SuiDex V2 LP scan failed.';
    warnings.push('The SuiDex V2 LP provider failed; no partial exposure was published.');
    return {
      venue: 'suiDexV2', outcome: 'error', provider: SUIDEX_V2_PROVIDER,
      methodologyVersion: SUIDEX_V2_METHODOLOGY_VERSION, generatedAt, positions: [], coverage,
      pool: { poolId: SUIDEX_V2_TREE_POOL_ID, reserveTreeRaw: coverage.reserveTreeRaw, totalLpSupplyRaw: coverage.totalLpSupplyRaw }, warnings,
    };
  }
}
