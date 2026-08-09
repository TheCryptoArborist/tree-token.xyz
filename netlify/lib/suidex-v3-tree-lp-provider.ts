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
import {
  CLMM_MAX_TICK,
  CLMM_MIN_TICK,
  amountsForLiquidityQ64,
  parseSignedI32,
  tickToSqrtPriceQ64,
} from './clmm-q64.ts';

export const SUIDEX_V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
export const SUIDEX_V3_POSITION_TYPE = `${SUIDEX_V3_PACKAGE}::position::Position`;
export const SUIDEX_V3_PROVIDER = 'suidex-v3-onchain';
export const SUIDEX_V3_METHODOLOGY_VERSION = 'suidex-v3-tree-principal-v1';
export const SUI_COIN_TYPE = '0x2::sui::SUI';

const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_GRPC_HOST = 'fullnode.mainnet.sui.io:443';
const DEFAULT_MAX_PAGES = 100;
const DEFAULT_PAGE_SIZE = 50;

const POSITION_SCAN_QUERY = `query ScanSuiDexV3Positions($first: Int!, $after: String, $type: String!) {
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

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;
type PoolObject = { type?: string | null; json?: unknown };

export type SuiDexV3TypeScan = {
  nodes: JsonRecord[];
  reachedEnd: boolean;
  pages: number;
};

export type SuiDexV3Coverage = {
  positionType: string;
  pagesScanned: number;
  objectsScanned: number;
  treePositionObjects: number;
  addressOwnedTreePositions: number;
  nonAddressOwnedTreePositions: number;
  uniqueOwners: number;
  uniquePools: number;
  verifiedPools: number;
  poolIds: string[];
  malformedObjects: number;
  malformedOwners: number;
  duplicateObjectIds: number;
  excludedObjects: number;
  excludedPrincipalTreeRaw: string;
  aggregatePrincipalTreeRaw: string;
  unclaimedTreeRawExcluded: string;
  reconciliationFailures: number;
  reachedEnd: boolean;
  scanComplete: boolean;
  networkError: string | null;
  graphqlErrors: string[];
};

export type SuiDexV3Result = ExposureVenueResult & {
  provider: typeof SUIDEX_V3_PROVIDER;
  methodologyVersion: typeof SUIDEX_V3_METHODOLOGY_VERSION;
  coverage: SuiDexV3Coverage;
};

export type SuiDexV3Options = {
  graphqlUrl?: string;
  grpcHost?: string;
  fetchImpl?: FetchLike;
  maxPages?: number;
  pageSize?: number;
  scanPositions?: () => Promise<SuiDexV3TypeScan>;
  getPoolObject?: (poolId: string) => Promise<PoolObject>;
  generatedAt?: string;
};

type ParsedTreePosition = {
  objectId: string;
  wallet: string;
  excluded: boolean;
  poolId: string;
  tokenX: string;
  tokenY: string;
  treeSide: 'x' | 'y';
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  unclaimedTreeRaw: bigint;
};

type VerifiedPool = {
  poolId: string;
  tokenX: string;
  tokenY: string;
  currentSqrtPrice: bigint;
  reserveX: bigint;
  reserveY: bigint;
};

type WalletAccumulator = {
  treeRaw: bigint;
  unclaimedTreeRaw: bigint;
  positionCount: number;
  poolIds: Set<string>;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeCoinType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  const parts = compact.split('::');
  if (parts.length !== 3 || !/^(0x)?[0-9a-f]+$/.test(parts[0]) || !parts[1] || !parts[2]) return null;
  const address = parts[0].replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${address}::${parts[1]}::${parts[2]}`;
}

const NORMALIZED_TREE = normalizeCoinType(TREE_COIN_TYPE)!;

function ownerAddress(node: JsonRecord): { kind: string; address: string | null } {
  const owner = record(node.owner);
  const addressValue = owner.address;
  const rawAddress = typeof addressValue === 'string' ? addressValue : record(addressValue).address;
  return {
    kind: typeof owner.__typename === 'string' ? owner.__typename : 'Unknown',
    address: normalizeSuiAddress(rawAddress),
  };
}

function optionalUnsigned(value: unknown): bigint | null {
  if (value === undefined || value === null) return 0n;
  return parseUnsignedRaw(value);
}

async function defaultScanPositions(
  endpoint: string,
  fetchImpl: FetchLike,
  pageSize: number,
  maxPages: number,
): Promise<SuiDexV3TypeScan> {
  const nodes: JsonRecord[] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: POSITION_SCAN_QUERY,
        variables: { first: pageSize, after, type: SUIDEX_V3_POSITION_TYPE },
      }),
    });
    if (!response.ok) throw new Error(`Sui GraphQL returned HTTP ${response.status}`);
    const payload = record(await response.json());
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (errors.length) throw new Error(errors.map((item) => String(record(item).message || 'GraphQL error')).join(' | '));
    const connection = record(record(payload.data).objects);
    const pageInfo = record(connection.pageInfo);
    const pageNodes = Array.isArray(connection.nodes)
      ? connection.nodes.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'))
      : [];
    nodes.push(...pageNodes);
    if (pageInfo.hasNextPage !== true) return { nodes, reachedEnd: true, pages: page + 1 };
    if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor) return { nodes, reachedEnd: false, pages: page + 1 };
    after = pageInfo.endCursor;
  }
  return { nodes, reachedEnd: false, pages: maxPages };
}

function defaultPoolGetter(grpcHost: string) {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: grpcHost.replace(/^https?:\/\//, ''),
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  return async (poolId: string): Promise<PoolObject> => {
    const { object } = await client.core.getObject({ objectId: poolId, include: { json: true } });
    return object ? { type: object.type, json: object.json } : {};
  };
}

function poolObjectTypeVerified(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const compact = value.toLowerCase().replace(/\s+/g, '');
  return compact.includes(SUIDEX_V3_PACKAGE.slice(2).toLowerCase()) && compact.includes('::pool::pool<');
}

function verifyPool(
  poolId: string,
  value: PoolObject,
  expectedTokenX: string,
  expectedTokenY: string,
): VerifiedPool | null {
  const json = record(value.json);
  const id = normalizeSuiAddress(json.id);
  const tokenX = normalizeCoinType(json.type_x);
  const tokenY = normalizeCoinType(json.type_y);
  const currentSqrtPrice = parseUnsignedRaw(json.sqrt_price);
  const currentTick = parseSignedI32(json.tick_index);
  const reserveX = parseUnsignedRaw(json.reserve_x);
  const reserveY = parseUnsignedRaw(json.reserve_y);
  const poolLiquidity = parseUnsignedRaw(json.liquidity);
  if (!poolObjectTypeVerified(value.type)
    || id !== poolId
    || tokenX !== expectedTokenX
    || tokenY !== expectedTokenY
    || (tokenX !== NORMALIZED_TREE && tokenY !== NORMALIZED_TREE)
    || tokenX === tokenY
    || currentSqrtPrice === null
    || currentSqrtPrice <= 0n
    || currentTick === null
    || currentTick < CLMM_MIN_TICK
    || currentTick > CLMM_MAX_TICK
    || reserveX === null
    || reserveY === null
    || poolLiquidity === null) return null;

  const lowerBoundary = tickToSqrtPriceQ64(currentTick);
  const upperBoundary = currentTick < CLMM_MAX_TICK
    ? tickToSqrtPriceQ64(currentTick + 1)
    : currentSqrtPrice + 1n;
  if (currentSqrtPrice < lowerBoundary || currentSqrtPrice >= upperBoundary) return null;
  return { poolId, tokenX, tokenY, currentSqrtPrice, reserveX, reserveY };
}

export async function scanSuiDexV3TreeLp(options: SuiDexV3Options = {}): Promise<SuiDexV3Result> {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const coverage: SuiDexV3Coverage = {
    positionType: SUIDEX_V3_POSITION_TYPE,
    pagesScanned: 0,
    objectsScanned: 0,
    treePositionObjects: 0,
    addressOwnedTreePositions: 0,
    nonAddressOwnedTreePositions: 0,
    uniqueOwners: 0,
    uniquePools: 0,
    verifiedPools: 0,
    poolIds: [],
    malformedObjects: 0,
    malformedOwners: 0,
    duplicateObjectIds: 0,
    excludedObjects: 0,
    excludedPrincipalTreeRaw: '0',
    aggregatePrincipalTreeRaw: '0',
    unclaimedTreeRawExcluded: '0',
    reconciliationFailures: 0,
    reachedEnd: false,
    scanComplete: false,
    networkError: null,
    graphqlErrors: [],
  };
  const warnings = ['SuiDex V3 exposure includes current principal liquidity only; unclaimed fees and incentive rewards are excluded.'];

  try {
    const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE)));
    const maxPages = Math.max(1, Math.min(500, Math.trunc(options.maxPages ?? DEFAULT_MAX_PAGES)));
    const scan = await (options.scanPositions || (() => defaultScanPositions(
      options.graphqlUrl || DEFAULT_GRAPHQL_URL,
      options.fetchImpl || fetch,
      pageSize,
      maxPages,
    )))();
    coverage.pagesScanned = scan.pages;
    coverage.objectsScanned = scan.nodes.length;
    coverage.reachedEnd = scan.reachedEnd;

    const seenObjectIds = new Set<string>();
    const expectedPools = new Map<string, { tokenX: string; tokenY: string }>();
    const parsedPositions: ParsedTreePosition[] = [];

    for (const node of scan.nodes) {
      const objectId = normalizeSuiAddress(node.address);
      if (!objectId) { coverage.malformedObjects += 1; continue; }
      if (seenObjectIds.has(objectId)) { coverage.duplicateObjectIds += 1; continue; }
      seenObjectIds.add(objectId);

      const json = record(record(record(node.asMoveObject).contents).json);
      const tokenX = normalizeCoinType(json.type_x);
      const tokenY = normalizeCoinType(json.type_y);
      if (!tokenX || !tokenY) { coverage.malformedObjects += 1; continue; }
      const treeSide = tokenX === NORMALIZED_TREE ? 'x' : tokenY === NORMALIZED_TREE ? 'y' : null;
      if (!treeSide) continue;
      coverage.treePositionObjects += 1;
      if (tokenX === tokenY) { coverage.malformedObjects += 1; continue; }

      const owner = ownerAddress(node);
      if (owner.kind !== 'AddressOwner') {
        coverage.nonAddressOwnedTreePositions += 1;
        continue;
      }
      if (!owner.address) { coverage.malformedOwners += 1; continue; }
      coverage.addressOwnedTreePositions += 1;

      const poolId = normalizeSuiAddress(json.pool_id);
      const liquidity = parseUnsignedRaw(json.liquidity);
      const tickLower = parseSignedI32(json.tick_lower_index);
      const tickUpper = parseSignedI32(json.tick_upper_index);
      const unclaimedTreeRaw = optionalUnsigned(treeSide === 'x' ? json.owed_coin_x : json.owed_coin_y);
      if (!poolId
        || liquidity === null
        || tickLower === null
        || tickUpper === null
        || tickLower < CLMM_MIN_TICK
        || tickUpper > CLMM_MAX_TICK
        || tickLower >= tickUpper
        || unclaimedTreeRaw === null) {
        coverage.malformedObjects += 1;
        continue;
      }

      const expected = expectedPools.get(poolId);
      if (expected && (expected.tokenX !== tokenX || expected.tokenY !== tokenY)) {
        coverage.malformedObjects += 1;
        continue;
      }
      expectedPools.set(poolId, { tokenX, tokenY });
      parsedPositions.push({
        objectId,
        wallet: owner.address,
        excluded: Boolean(excludedAddress(owner.address)),
        poolId,
        tokenX,
        tokenY,
        treeSide,
        tickLower,
        tickUpper,
        liquidity,
        unclaimedTreeRaw,
      });
    }

    coverage.uniquePools = expectedPools.size;
    coverage.poolIds = [...expectedPools.keys()].sort();
    const getPoolObject = options.getPoolObject || defaultPoolGetter(options.grpcHost || DEFAULT_GRPC_HOST);
    const verifiedPools = new Map<string, VerifiedPool>();
    for (const [poolId, expected] of expectedPools) {
      const verified = verifyPool(poolId, await getPoolObject(poolId), expected.tokenX, expected.tokenY);
      if (!verified) {
        coverage.malformedObjects += 1;
        continue;
      }
      verifiedPools.set(poolId, verified);
    }
    coverage.verifiedPools = verifiedPools.size;

    const walletTotals = new Map<string, WalletAccumulator>();
    const poolTotals = new Map<string, { amountX: bigint; amountY: bigint }>();
    let aggregatePrincipalTreeRaw = 0n;
    let excludedPrincipalTreeRaw = 0n;
    let unclaimedTreeRawExcluded = 0n;

    for (const position of parsedPositions) {
      const pool = verifiedPools.get(position.poolId);
      if (!pool) continue;
      const lowerSqrtPrice = tickToSqrtPriceQ64(position.tickLower);
      const upperSqrtPrice = tickToSqrtPriceQ64(position.tickUpper);
      const amounts = amountsForLiquidityQ64(
        pool.currentSqrtPrice,
        lowerSqrtPrice,
        upperSqrtPrice,
        position.liquidity,
      );
      const poolTotal = poolTotals.get(position.poolId) || { amountX: 0n, amountY: 0n };
      poolTotal.amountX += amounts.amountX;
      poolTotal.amountY += amounts.amountY;
      poolTotals.set(position.poolId, poolTotal);

      const principalTreeRaw = position.treeSide === 'x' ? amounts.amountX : amounts.amountY;
      aggregatePrincipalTreeRaw += principalTreeRaw;
      unclaimedTreeRawExcluded += position.unclaimedTreeRaw;
      if (position.excluded) {
        coverage.excludedObjects += 1;
        excludedPrincipalTreeRaw += principalTreeRaw;
        continue;
      }
      if (principalTreeRaw <= 0n) continue;
      const prior = walletTotals.get(position.wallet) || {
        treeRaw: 0n,
        unclaimedTreeRaw: 0n,
        positionCount: 0,
        poolIds: new Set<string>(),
      };
      prior.treeRaw += principalTreeRaw;
      prior.unclaimedTreeRaw += position.unclaimedTreeRaw;
      prior.positionCount += 1;
      prior.poolIds.add(position.poolId);
      walletTotals.set(position.wallet, prior);
    }

    for (const [poolId, totals] of poolTotals) {
      const pool = verifiedPools.get(poolId);
      if (!pool || totals.amountX > pool.reserveX || totals.amountY > pool.reserveY) {
        coverage.reconciliationFailures += 1;
      }
    }

    coverage.uniqueOwners = walletTotals.size;
    coverage.aggregatePrincipalTreeRaw = aggregatePrincipalTreeRaw.toString();
    coverage.excludedPrincipalTreeRaw = excludedPrincipalTreeRaw.toString();
    coverage.unclaimedTreeRawExcluded = unclaimedTreeRawExcluded.toString();

    const integrityValid = coverage.malformedObjects === 0
      && coverage.malformedOwners === 0
      && coverage.duplicateObjectIds === 0
      && coverage.nonAddressOwnedTreePositions === 0
      && coverage.verifiedPools === coverage.uniquePools
      && coverage.reconciliationFailures === 0;
    coverage.scanComplete = coverage.reachedEnd && integrityValid;

    if (!coverage.reachedEnd) warnings.push('The SuiDex V3 position scan did not reach its natural end; partial exposure was not published.');
    if (coverage.nonAddressOwnedTreePositions) warnings.push('One or more TREE positions were not directly address-owned; owner attribution was incomplete.');
    if (!integrityValid) warnings.push('SuiDex V3 TREE position integrity verification failed; partial exposure was not published.');

    const positions: WalletLpPosition[] = coverage.scanComplete
      ? [...walletTotals.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([wallet, value]) => ({
          wallet,
          venue: 'suiDexV3' as const,
          lpTreeRaw: value.treeRaw.toString(),
          positionCount: value.positionCount,
          metadata: {
            principalOnly: true,
            poolIds: [...value.poolIds].sort(),
            unclaimedTreeRawExcluded: value.unclaimedTreeRaw.toString(),
          },
        }))
      : [];

    return {
      venue: 'suiDexV3',
      outcome: coverage.scanComplete ? 'complete' : 'verification-incomplete',
      provider: SUIDEX_V3_PROVIDER,
      methodologyVersion: SUIDEX_V3_METHODOLOGY_VERSION,
      generatedAt,
      positions,
      coverage,
      warnings,
    };
  } catch (error) {
    coverage.networkError = error instanceof Error ? error.message : 'SuiDex V3 TREE LP scan failed.';
    warnings.push('The SuiDex V3 provider failed; no partial exposure was published.');
    return {
      venue: 'suiDexV3',
      outcome: 'error',
      provider: SUIDEX_V3_PROVIDER,
      methodologyVersion: SUIDEX_V3_METHODOLOGY_VERSION,
      generatedAt,
      positions: [],
      coverage,
      warnings,
    };
  }
}
