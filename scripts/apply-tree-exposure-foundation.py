from pathlib import Path

Path('netlify/lib/tree-exposure-types.ts').write_text(r'''import { TREE_DECIMALS, TREE_TOTAL_SUPPLY_RAW } from './leaderboard-provider.ts';
import { formatBaseUnits, formatPercentFromRaw } from './sui-graphql-leaderboard-provider.ts';

export const TREE_EXPOSURE_METHODOLOGY_VERSION = 'verified-tree-exposure-v1';
export const LP_PROVIDER_BADGE = 'lp-provider';
export const LP_MAXI_BADGE = 'lp-maxi';

export type ExposureVenue = 'suiDexV2' | 'suiDexV3' | 'turbos';

export type WalletLpPosition = {
  wallet: string;
  lpTreeRaw: string;
  venue: ExposureVenue;
  positionCount: number;
  metadata?: Record<string, unknown>;
};

export type ExposureVenueResult = {
  venue: ExposureVenue;
  outcome: 'complete' | 'verification-incomplete' | 'error';
  generatedAt: string;
  positions: WalletLpPosition[];
  warnings: string[];
  coverage: Record<string, unknown>;
};

export type DirectExposureCandidate = {
  wallet: string;
  suinsName?: string | null;
  directTreeRaw: string;
  coinObjectCount?: number;
};

export type VerifiedExposureEntry = {
  rank: number;
  wallet: string;
  suinsName: string | null;
  liquidTreeRaw: string;
  liquidTree: string;
  lpTreeRaw: string;
  lpTree: string;
  totalExposureRaw: string;
  totalExposure: string;
  supplyPercent: string;
  liquidCoinObjectCount: number;
  lpPositionCount: number;
  lpBreakdown: {
    suiDexV2Raw: string;
    suiDexV2: string;
    suiDexV3Raw: string;
    suiDexV3: string;
    turbosRaw: string;
    turbos: string;
  };
  badges: string[];
};

export function formatTreeRaw(raw: bigint): string {
  return formatBaseUnits(raw, TREE_DECIMALS);
}

export function formatTreeSupplyPercent(raw: bigint): string {
  return formatPercentFromRaw(raw, TREE_TOTAL_SUPPLY_RAW);
}

export function parseUnsignedRaw(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}
''', encoding='utf-8')

Path('netlify/lib/suidex-v2-tree-lp-provider.ts').write_text(r'''import { ChannelCredentials } from '@grpc/grpc-js';
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
''', encoding='utf-8')

Path('netlify/lib/tree-exposure-aggregator.ts').write_text(r'''import { normalizeSuiAddress, TREE_TOTAL_SUPPLY_RAW } from './leaderboard-provider.ts';
import {
  LP_MAXI_BADGE,
  LP_PROVIDER_BADGE,
  TREE_EXPOSURE_METHODOLOGY_VERSION,
  type DirectExposureCandidate,
  type ExposureVenue,
  type ExposureVenueResult,
  type VerifiedExposureEntry,
  formatTreeRaw,
  formatTreeSupplyPercent,
  parseUnsignedRaw,
} from './tree-exposure-types.ts';

export type ExposureSnapshot = {
  outcome: 'complete' | 'verification-incomplete';
  generatedAt: string;
  methodologyVersion: typeof TREE_EXPOSURE_METHODOLOGY_VERSION;
  entries: VerifiedExposureEntry[];
  eligibleOwnerCount: number | null;
  coverage: {
    directTreeComplete: boolean;
    suiDexV2Complete: boolean;
    suiDexV3Complete: boolean;
    turbosComplete: boolean;
    totalExposureComplete: boolean;
  };
  warnings: string[];
};

export type ExposureAggregationInput = {
  directEntries: DirectExposureCandidate[];
  directTreeComplete: boolean;
  venueResults: Record<ExposureVenue, ExposureVenueResult>;
  generatedAt?: string;
  limit?: number;
};

type Aggregate = {
  wallet: string;
  suinsName: string | null;
  liquidRaw: bigint;
  coinObjectCount: number;
  lpRaw: Record<ExposureVenue, bigint>;
  lpPositionCount: number;
};

export function buildVerifiedExposureSnapshot(input: ExposureAggregationInput): ExposureSnapshot {
  const coverage = {
    directTreeComplete: input.directTreeComplete,
    suiDexV2Complete: input.venueResults.suiDexV2.outcome === 'complete',
    suiDexV3Complete: input.venueResults.suiDexV3.outcome === 'complete',
    turbosComplete: input.venueResults.turbos.outcome === 'complete',
    totalExposureComplete: false,
  };
  coverage.totalExposureComplete = coverage.directTreeComplete
    && coverage.suiDexV2Complete
    && coverage.suiDexV3Complete
    && coverage.turbosComplete;
  const warnings = [
    ...Object.values(input.venueResults).flatMap((result) => result.warnings || []),
  ];
  if (!coverage.totalExposureComplete) {
    warnings.push('Total verified TREE exposure is incomplete; partial exposure rankings were not published.');
    return {
      outcome: 'verification-incomplete', generatedAt: input.generatedAt || new Date().toISOString(),
      methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION, entries: [], eligibleOwnerCount: null, coverage, warnings,
    };
  }

  const aggregates = new Map<string, Aggregate>();
  const ensure = (walletValue: unknown) => {
    const wallet = normalizeSuiAddress(walletValue);
    if (!wallet) return null;
    const prior = aggregates.get(wallet);
    if (prior) return prior;
    const created: Aggregate = {
      wallet, suinsName: null, liquidRaw: 0n, coinObjectCount: 0,
      lpRaw: { suiDexV2: 0n, suiDexV3: 0n, turbos: 0n }, lpPositionCount: 0,
    };
    aggregates.set(wallet, created);
    return created;
  };

  for (const entry of input.directEntries) {
    const aggregate = ensure(entry.wallet);
    const raw = parseUnsignedRaw(entry.directTreeRaw);
    if (!aggregate || raw === null) continue;
    aggregate.liquidRaw += raw;
    aggregate.coinObjectCount += Number(entry.coinObjectCount) || 0;
    if (!aggregate.suinsName && typeof entry.suinsName === 'string' && entry.suinsName.trim()) aggregate.suinsName = entry.suinsName.trim();
  }
  for (const [venue, result] of Object.entries(input.venueResults) as Array<[ExposureVenue, ExposureVenueResult]>) {
    for (const position of result.positions) {
      const aggregate = ensure(position.wallet);
      const raw = parseUnsignedRaw(position.lpTreeRaw);
      if (!aggregate || raw === null) continue;
      aggregate.lpRaw[venue] += raw;
      aggregate.lpPositionCount += Number(position.positionCount) || 0;
    }
  }

  const limit = Math.max(1, Math.min(500, Math.trunc(input.limit ?? 50)));
  const entries = [...aggregates.values()]
    .map((aggregate) => {
      const lpRaw = aggregate.lpRaw.suiDexV2 + aggregate.lpRaw.suiDexV3 + aggregate.lpRaw.turbos;
      const totalRaw = aggregate.liquidRaw + lpRaw;
      return { aggregate, lpRaw, totalRaw };
    })
    .filter(({ totalRaw }) => totalRaw > 0n && totalRaw <= TREE_TOTAL_SUPPLY_RAW)
    .sort((left, right) => left.totalRaw > right.totalRaw ? -1
      : left.totalRaw < right.totalRaw ? 1
        : left.aggregate.liquidRaw > right.aggregate.liquidRaw ? -1
          : left.aggregate.liquidRaw < right.aggregate.liquidRaw ? 1
            : left.aggregate.wallet.localeCompare(right.aggregate.wallet))
    .slice(0, limit)
    .map(({ aggregate, lpRaw, totalRaw }, index): VerifiedExposureEntry => {
      const badges: string[] = [];
      if (lpRaw > 0n) badges.push(LP_PROVIDER_BADGE);
      if (lpRaw > aggregate.liquidRaw && lpRaw > 0n) badges.push(LP_MAXI_BADGE);
      return {
        rank: index + 1,
        wallet: aggregate.wallet,
        suinsName: aggregate.suinsName,
        liquidTreeRaw: aggregate.liquidRaw.toString(),
        liquidTree: formatTreeRaw(aggregate.liquidRaw),
        lpTreeRaw: lpRaw.toString(),
        lpTree: formatTreeRaw(lpRaw),
        totalExposureRaw: totalRaw.toString(),
        totalExposure: formatTreeRaw(totalRaw),
        supplyPercent: formatTreeSupplyPercent(totalRaw),
        liquidCoinObjectCount: aggregate.coinObjectCount,
        lpPositionCount: aggregate.lpPositionCount,
        lpBreakdown: {
          suiDexV2Raw: aggregate.lpRaw.suiDexV2.toString(),
          suiDexV2: formatTreeRaw(aggregate.lpRaw.suiDexV2),
          suiDexV3Raw: aggregate.lpRaw.suiDexV3.toString(),
          suiDexV3: formatTreeRaw(aggregate.lpRaw.suiDexV3),
          turbosRaw: aggregate.lpRaw.turbos.toString(),
          turbos: formatTreeRaw(aggregate.lpRaw.turbos),
        },
        badges,
      };
    });

  return {
    outcome: 'complete', generatedAt: input.generatedAt || new Date().toISOString(),
    methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION, entries,
    eligibleOwnerCount: aggregates.size, coverage, warnings,
  };
}
''', encoding='utf-8')

Path('tests/suidex-v2-tree-lp-provider.test.ts').write_text(r'''import assert from 'node:assert/strict';
import {
  SUIDEX_V2_TREE_FARM_POSITION_TYPE,
  SUIDEX_V2_TREE_LP_COIN_TYPE,
  lpRawToTreeRaw,
  scanSuiDexV2TreeLp,
} from '../netlify/lib/suidex-v2-tree-lp-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
const zero = `0x${'0'.repeat(64)}`;
let scans = 0;
const result = await scanSuiDexV2TreeLp({
  generatedAt: '2026-08-09T00:00:00.000Z',
  getPoolObject: async () => ({
    type: '0xbfac::pair::Pair<0x2::sui::SUI,0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>',
    json: { reserve1: '50000000', total_supply: '1000', lp_supply: { value: '1000' } },
  }),
  scanType: async (type) => {
    scans += 1;
    if (type === SUIDEX_V2_TREE_LP_COIN_TYPE) return {
      reachedEnd: true, pages: 1, nodes: [
        { address: `0x${'1'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletA } }, asMoveObject: { contents: { balanceField: { json: '100' }, json: { balance: '100' } } } },
        { address: `0x${'2'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletB } }, asMoveObject: { contents: { balanceField: { json: '50' }, json: { balance: '50' } } } },
        { address: `0x${'3'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: zero } }, asMoveObject: { contents: { balanceField: { json: '20' }, json: { balance: '20' } } } },
      ],
    };
    assert.equal(type, SUIDEX_V2_TREE_FARM_POSITION_TYPE);
    return {
      reachedEnd: true, pages: 1, nodes: [
        { address: `0x${'4'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletA } }, asMoveObject: { contents: { amountField: { json: '200' }, json: { amount: '200' } } } },
      ],
    };
  },
});
assert.equal(scans, 2);
assert.equal(result.outcome, 'complete');
assert.equal(result.positions.length, 2);
const a = result.positions.find((position) => position.wallet === walletA)!;
const b = result.positions.find((position) => position.wallet === walletB)!;
assert.equal(a.lpTreeRaw, '15000000');
assert.equal(b.lpTreeRaw, '2500000');
assert.equal(a.metadata?.directLpRaw, '100');
assert.equal(a.metadata?.stakedLpRaw, '200');
assert.equal(result.coverage.excludedObjects, 1);
assert.equal(result.coverage.directLpRaw, '150');
assert.equal(result.coverage.stakedLpRaw, '200');
assert.equal(lpRawToTreeRaw(300n, 50_000_000n, 1_000n), 15_000_000n);

const malformed = await scanSuiDexV2TreeLp({
  getPoolObject: async () => ({ type: '0xbfac::pair::Pair<0x2::sui::SUI,0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>', json: { reserve1: '500', total_supply: '100', lp_supply: { value: '100' } } }),
  scanType: async (type) => type === SUIDEX_V2_TREE_LP_COIN_TYPE
    ? { reachedEnd: true, pages: 1, nodes: [{ address: `0x${'5'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletA } }, asMoveObject: { contents: { balanceField: { json: 'bad' }, json: {} } } }] }
    : { reachedEnd: true, pages: 1, nodes: [] },
});
assert.equal(malformed.outcome, 'verification-incomplete');
assert.equal(malformed.positions.length, 0);
assert.equal(malformed.coverage.malformedBalances, 1);
console.log('SuiDex V2 TREE LP provider: PASS (direct + farm aggregation, exclusion, exact share, fail closed)');
''', encoding='utf-8')

Path('tests/tree-exposure-aggregator.test.ts').write_text(r'''import assert from 'node:assert/strict';
import { buildVerifiedExposureSnapshot } from '../netlify/lib/tree-exposure-aggregator.ts';
import type { ExposureVenue, ExposureVenueResult } from '../netlify/lib/tree-exposure-types.ts';

const a = `0x${'a'.repeat(64)}`;
const b = `0x${'b'.repeat(64)}`;
const complete = (venue: ExposureVenue, positions: ExposureVenueResult['positions'] = []): ExposureVenueResult => ({
  venue, outcome: 'complete', generatedAt: '2026-08-09T00:00:00.000Z', positions, warnings: [], coverage: {},
});
const venues = {
  suiDexV2: complete('suiDexV2', [{ wallet: a, venue: 'suiDexV2', lpTreeRaw: '200000000', positionCount: 2 }]),
  suiDexV3: complete('suiDexV3'),
  turbos: complete('turbos'),
};
const result = buildVerifiedExposureSnapshot({
  generatedAt: '2026-08-09T00:00:00.000Z', directTreeComplete: true, venueResults: venues,
  directEntries: [
    { wallet: a, suinsName: 'alpha.sui', directTreeRaw: '100000000', coinObjectCount: 1 },
    { wallet: b, directTreeRaw: '250000000', coinObjectCount: 1 },
  ],
});
assert.equal(result.outcome, 'complete');
assert.equal(result.entries[0].wallet, a);
assert.equal(result.entries[0].liquidTreeRaw, '100000000');
assert.equal(result.entries[0].lpTreeRaw, '200000000');
assert.equal(result.entries[0].totalExposureRaw, '300000000');
assert.deepEqual(result.entries[0].badges, ['lp-provider', 'lp-maxi']);
assert.equal(result.entries[0].lpBreakdown.suiDexV2Raw, '200000000');
assert.equal(result.entries[1].wallet, b);

const incomplete = buildVerifiedExposureSnapshot({
  directTreeComplete: true,
  directEntries: [{ wallet: a, directTreeRaw: '100' }],
  venueResults: { ...venues, turbos: { ...venues.turbos, outcome: 'verification-incomplete' } },
});
assert.equal(incomplete.outcome, 'verification-incomplete');
assert.equal(incomplete.entries.length, 0);
assert.match(incomplete.warnings.at(-1) || '', /partial exposure rankings were not published/);

const tie = buildVerifiedExposureSnapshot({
  directTreeComplete: true,
  directEntries: [{ wallet: a, directTreeRaw: '100' }, { wallet: b, directTreeRaw: '150' }],
  venueResults: {
    suiDexV2: complete('suiDexV2', [{ wallet: a, venue: 'suiDexV2', lpTreeRaw: '100', positionCount: 1 }, { wallet: b, venue: 'suiDexV2', lpTreeRaw: '50', positionCount: 1 }]),
    suiDexV3: complete('suiDexV3'), turbos: complete('turbos'),
  },
});
assert.equal(tie.entries[0].wallet, b, 'Higher liquid TREE breaks equal total-exposure ties.');
console.log('TREE exposure aggregator: PASS (total ranking, Liquid + LP breakdown, LP badges, complete-only publication)');
''', encoding='utf-8')
