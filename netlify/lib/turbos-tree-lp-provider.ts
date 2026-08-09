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

export const TURBOS_PACKAGE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
export const TURBOS_POSITION_NFT_TYPE = `${TURBOS_PACKAGE}::position_nft::TurbosPositionNFT`;
export const TURBOS_POSITION_TYPE = `${TURBOS_PACKAGE}::position_manager::Position`;
export const TURBOS_PROVIDER = 'turbos-onchain';
export const TURBOS_METHODOLOGY_VERSION = 'turbos-tree-principal-pool-index-v2';
export const TURBOS_POOL_POSITION_VALUE_TYPE = `${TURBOS_PACKAGE}::pool::Position`;
export const TURBOS_TREE_POOL_IDS = [
  '0x4a8c450d393fee360fc8c2a2ed30bf6f9e4de5077024e9628cd3510e272bf490',
  '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
  '0xc327fdc9b129602e91df9bd59cf3e4a921ce5509844a3b6c8adddc5ed320636d',
  '0xd5d7d9a614327feed096a437f416aa98f440393d9ac52d97c87e6e0dd6e719bb',
  '0xe1468ece8e4d2940b30dec776eaee9b235b23458868027da871bc42817263a12',
] as const;

const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_GRPC_HOST = 'fullnode.mainnet.sui.io:443';
const DEFAULT_MAX_PAGES = 2_000;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_RETRIES = 6;


type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;
type ChainObject = { type?: string | null; json?: unknown };

export type TurbosNftScan = {
  treeNodes: JsonRecord[];
  reachedEnd: boolean;
  pages: number;
  objectsScanned: number;
  malformedTypeObjects: number;
  malformedObjectIds: number;
  duplicateObjectIds: number;
};

export type TurbosCoverage = {
  nftType: string;
  pagesScanned: number;
  objectsScanned: number;
  treePositionNfts: number;
  addressOwnedTreePositions: number;
  nonAddressOwnedTreePositions: number;
  uniqueOwners: number;
  uniquePools: number;
  verifiedPools: number;
  verifiedPositions: number;
  poolIds: string[];
  malformedObjects: number;
  malformedOwners: number;
  malformedObjectIds: number;
  duplicateObjectIds: number;
  duplicatePositionIds: number;
  excludedObjects: number;
  excludedPrincipalTreeRaw: string;
  aggregatePrincipalTreeRaw: string;
  unclaimedTreeRawExcluded: string;
  reconciliationFailures: number;
  reachedEnd: boolean;
  scanComplete: boolean;
  requestAttempts: number;
  retriedRequests: number;
  rateLimitRetries: number;
  networkRetries: number;
  serverErrorRetries: number;
  rateLimited: boolean;
  networkError: string | null;
  graphqlErrors: string[];
};

export type TurbosResult = ExposureVenueResult & {
  provider: typeof TURBOS_PROVIDER;
  methodologyVersion: typeof TURBOS_METHODOLOGY_VERSION;
  coverage: TurbosCoverage;
};

export type TurbosOptions = {
  graphqlUrl?: string;
  grpcHost?: string;
  fetchImpl?: FetchLike;
  maxPages?: number;
  pageSize?: number;
  maxRetries?: number;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  scanNfts?: () => Promise<TurbosNftScan>;
  getPoolObject?: (poolId: string) => Promise<ChainObject>;
  getPositionObject?: (positionId: string) => Promise<ChainObject>;
  generatedAt?: string;
};

type ParsedNft = {
  nftId: string;
  wallet: string;
  excluded: boolean;
  poolId: string;
  positionId: string;
  tokenA: string;
  tokenB: string;
  feeType: string;
  treeSide: 'a' | 'b';
};

type VerifiedPool = {
  poolId: string;
  tokenA: string;
  tokenB: string;
  feeType: string;
  currentSqrtPrice: bigint;
  reserveA: bigint;
  reserveB: bigint;
};

type VerifiedPosition = ParsedNft & {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  unclaimedTreeRaw: bigint;
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

function canonicalAddress(value: string): string {
  const address = value.toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${address}`;
}

function normalizeStructType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  const parts = compact.split('::');
  if (parts.length !== 3 || !/^(0x)?[0-9a-f]+$/.test(parts[0]) || !parts[1] || !parts[2]) return null;
  return `${canonicalAddress(parts[0])}::${parts[1]}::${parts[2]}`;
}

function canonicalizeMoveType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!compact) return null;
  return compact.replace(/(^|[<,])((?:0x)?[0-9a-f]+)(?=::)/g, (_match, prefix: string, address: string) => `${prefix}${canonicalAddress(address)}`);
}

const NORMALIZED_TREE = normalizeStructType(TREE_COIN_TYPE)!;
const NORMALIZED_PACKAGE = canonicalAddress(TURBOS_PACKAGE);
const NORMALIZED_POSITION_TYPE = canonicalizeMoveType(TURBOS_POSITION_TYPE)!;
const NORMALIZED_POOL_POSITION_VALUE_TYPE = canonicalizeMoveType(TURBOS_POOL_POSITION_VALUE_TYPE)!;

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

function graphqlErrors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(record(item).message || 'GraphQL error'));
}

async function defaultScanNfts(
  grpcHost: string,
  maxPages: number,
  coverage: TurbosCoverage,
): Promise<TurbosNftScan> {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: grpcHost.replace(/^https?:\/\//, ''),
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  const positionFieldIds: string[] = [];
  let pages = 0;
  let objectsScanned = 0;
  let malformedTypeObjects = 0;
  let malformedObjectIds = 0;
  let duplicateObjectIds = 0;

  for (const poolId of TURBOS_TREE_POOL_IDS) {
    let cursor: string | undefined;
    let reachedPoolEnd = false;
    for (let page = 0; page < maxPages; page += 1) {
      const result = await client.core.listDynamicFields({
        parentId: poolId,
        cursor,
        limit: 1_000,
      });
      coverage.requestAttempts += 1;
      pages += 1;
      const fields = Array.isArray(result.dynamicFields) ? result.dynamicFields : [];
      objectsScanned += fields.length;
      for (const field of fields) {
        if (canonicalizeMoveType(field.valueType) !== NORMALIZED_POOL_POSITION_VALUE_TYPE) continue;
        const fieldId = normalizeSuiAddress(field.fieldId);
        if (!fieldId) {
          malformedObjectIds += 1;
          continue;
        }
        positionFieldIds.push(fieldId);
      }
      if (!result.hasNextPage) {
        reachedPoolEnd = true;
        break;
      }
      if (typeof result.cursor !== 'string' || !result.cursor) break;
      cursor = result.cursor;
    }
    if (!reachedPoolEnd) {
      return {
        treeNodes: [],
        reachedEnd: false,
        pages,
        objectsScanned,
        malformedTypeObjects,
        malformedObjectIds,
        duplicateObjectIds,
      };
    }
  }

  const nftReferences: Array<{ nftId: string; poolId: string }> = [];
  const seenReferences = new Set<string>();
  for (let index = 0; index < positionFieldIds.length; index += 50) {
    const { objects } = await client.core.getObjects({
      objectIds: positionFieldIds.slice(index, index + 50),
      include: { json: true },
    });
    coverage.requestAttempts += 1;
    for (const object of objects) {
      if (object instanceof Error) throw object;
      const json = record(object.json);
      const nameValue = record(json.name).name;
      const name = typeof nameValue === 'string' ? nameValue.trim().toLowerCase() : '';
      const match = name.match(/^(?:0x)?([0-9a-f]{1,64})-/);
      if (!match) {
        malformedObjectIds += 1;
        continue;
      }
      const nftId = normalizeSuiAddress(`0x${match[1].padStart(64, '0')}`);
      const value = record(json.value);
      const poolId = normalizeSuiAddress(value.pool_id ?? value.poolId);
      if (!nftId) {
        malformedObjectIds += 1;
        continue;
      }
      const referenceKey = `${nftId}:${poolId || ''}`;
      if (seenReferences.has(referenceKey)) {
        duplicateObjectIds += 1;
        continue;
      }
      seenReferences.add(referenceKey);
      nftReferences.push({ nftId, poolId: poolId || '' });
    }
  }

  const treeNodes: JsonRecord[] = [];
  const seenLiveNfts = new Set<string>();
  for (let index = 0; index < nftReferences.length; index += 50) {
    const batch = nftReferences.slice(index, index + 50);
    const { objects } = await client.core.getObjects({
      objectIds: batch.map((item) => item.nftId),
      include: { json: true },
    });
    coverage.requestAttempts += 1;
    for (let offset = 0; offset < objects.length; offset += 1) {
      const object = objects[offset];
      const reference = batch[offset];
      if (object instanceof Error) {
        if (/not found/i.test(object.message)) continue;
        throw object;
      }
      const nftId = normalizeSuiAddress(object.objectId);
      if (!nftId || nftId !== reference.nftId) {
        malformedObjectIds += 1;
        continue;
      }
      if (seenLiveNfts.has(nftId)) {
        duplicateObjectIds += 1;
        continue;
      }
      seenLiveNfts.add(nftId);
      if (canonicalizeMoveType(object.type) !== canonicalizeMoveType(TURBOS_POSITION_NFT_TYPE)) {
        malformedTypeObjects += 1;
        continue;
      }
      const json = record(object.json);
      const poolId = normalizeSuiAddress(json.pool_id);
      if (!poolId || !TURBOS_TREE_POOL_IDS.includes(poolId as typeof TURBOS_TREE_POOL_IDS[number])) {
        malformedTypeObjects += 1;
        continue;
      }
      if (reference.poolId && reference.poolId !== poolId) {
        malformedTypeObjects += 1;
        continue;
      }
      const ownerRecord = record(object.owner);
      const ownerKind = typeof ownerRecord.$kind === 'string' ? ownerRecord.$kind : 'Unknown';
      const ownerValue = ownerRecord[ownerKind];
      const ownerAddressValue = typeof ownerValue === 'string' ? ownerValue : record(ownerValue).address;
      treeNodes.push({
        address: nftId,
        owner: {
          __typename: ownerKind,
          address: ownerAddressValue ? { address: ownerAddressValue } : undefined,
        },
        asMoveObject: { contents: { json } },
      });
    }
  }

  return {
    treeNodes,
    reachedEnd: true,
    pages,
    objectsScanned,
    malformedTypeObjects,
    malformedObjectIds,
    duplicateObjectIds,
  };
}

function defaultObjectGetters(grpcHost: string) {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: grpcHost.replace(/^https?:\/\//, ''),
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  const getObject = async (objectId: string): Promise<ChainObject> => {
    const { object } = await client.core.getObject({ objectId, include: { json: true } });
    return object ? { type: object.type, json: object.json } : {};
  };
  return { getPoolObject: getObject, getPositionObject: getObject };
}

function verifyPool(
  poolId: string,
  value: ChainObject,
  tokenA: string,
  tokenB: string,
  feeType: string,
): VerifiedPool | null {
  const expectedType = `${NORMALIZED_PACKAGE}::pool::pool<${tokenA},${tokenB},${feeType}>`;
  const json = record(value.json);
  const id = normalizeSuiAddress(json.id);
  const currentSqrtPrice = parseUnsignedRaw(json.sqrt_price);
  const currentTick = parseSignedI32(json.tick_current_index);
  const reserveA = parseUnsignedRaw(json.coin_a);
  const reserveB = parseUnsignedRaw(json.coin_b);
  const poolLiquidity = parseUnsignedRaw(json.liquidity);
  if (canonicalizeMoveType(value.type) !== expectedType
    || id !== poolId
    || currentSqrtPrice === null
    || currentSqrtPrice <= 0n
    || currentTick === null
    || currentTick < CLMM_MIN_TICK
    || currentTick > CLMM_MAX_TICK
    || reserveA === null
    || reserveB === null
    || poolLiquidity === null) return null;
  const lowerBoundary = tickToSqrtPriceQ64(currentTick);
  const upperBoundary = currentTick < CLMM_MAX_TICK
    ? tickToSqrtPriceQ64(currentTick + 1)
    : currentSqrtPrice + 1n;
  if (currentSqrtPrice < lowerBoundary || currentSqrtPrice >= upperBoundary) return null;
  return { poolId, tokenA, tokenB, feeType, currentSqrtPrice, reserveA, reserveB };
}

function verifyPosition(nft: ParsedNft, value: ChainObject): VerifiedPosition | null {
  if (canonicalizeMoveType(value.type) !== NORMALIZED_POSITION_TYPE) return null;
  const json = record(value.json);
  const id = normalizeSuiAddress(json.id);
  const liquidity = parseUnsignedRaw(json.liquidity);
  const tickLower = parseSignedI32(json.tick_lower_index);
  const tickUpper = parseSignedI32(json.tick_upper_index);
  const unclaimedTreeRaw = optionalUnsigned(nft.treeSide === 'a' ? json.tokens_owed_a : json.tokens_owed_b);
  if (id !== nft.positionId
    || liquidity === null
    || tickLower === null
    || tickUpper === null
    || tickLower < CLMM_MIN_TICK
    || tickUpper > CLMM_MAX_TICK
    || tickLower >= tickUpper
    || unclaimedTreeRaw === null) return null;
  return { ...nft, liquidity, tickLower, tickUpper, unclaimedTreeRaw };
}

export async function scanTurbosTreeLp(options: TurbosOptions = {}): Promise<TurbosResult> {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const coverage: TurbosCoverage = {
    nftType: TURBOS_POSITION_NFT_TYPE,
    pagesScanned: 0,
    objectsScanned: 0,
    treePositionNfts: 0,
    addressOwnedTreePositions: 0,
    nonAddressOwnedTreePositions: 0,
    uniqueOwners: 0,
    uniquePools: 0,
    verifiedPools: 0,
    verifiedPositions: 0,
    poolIds: [],
    malformedObjects: 0,
    malformedOwners: 0,
    malformedObjectIds: 0,
    duplicateObjectIds: 0,
    duplicatePositionIds: 0,
    excludedObjects: 0,
    excludedPrincipalTreeRaw: '0',
    aggregatePrincipalTreeRaw: '0',
    unclaimedTreeRawExcluded: '0',
    reconciliationFailures: 0,
    reachedEnd: false,
    scanComplete: false,
    requestAttempts: 0,
    retriedRequests: 0,
    rateLimitRetries: 0,
    networkRetries: 0,
    serverErrorRetries: 0,
    rateLimited: false,
    networkError: null,
    graphqlErrors: [],
  };
  const warnings = ['Turbos exposure includes current principal liquidity only; unclaimed fees and incentive rewards are excluded.'];

  try {
    const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE)));
    const maxPages = Math.max(1, Math.min(5_000, Math.trunc(options.maxPages ?? DEFAULT_MAX_PAGES)));
    const maxRetries = Math.max(0, Math.min(10, Math.trunc(options.maxRetries ?? DEFAULT_MAX_RETRIES)));
    const sleepImpl = options.sleepImpl || ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    const scan = await (options.scanNfts || (() => defaultScanNfts(
      options.grpcHost || DEFAULT_GRPC_HOST,
      maxPages,
      coverage,
    )))();
    coverage.pagesScanned = scan.pages;
    coverage.objectsScanned = scan.objectsScanned;
    coverage.reachedEnd = scan.reachedEnd;
    coverage.malformedObjects += scan.malformedTypeObjects;
    coverage.malformedObjectIds += scan.malformedObjectIds;
    coverage.duplicateObjectIds += scan.duplicateObjectIds;
    coverage.treePositionNfts = scan.treeNodes.length;

    const parsedNfts: ParsedNft[] = [];
    const expectedPools = new Map<string, { tokenA: string; tokenB: string; feeType: string }>();
    const seenPositionIds = new Set<string>();
    for (const node of scan.treeNodes) {
      const nftId = normalizeSuiAddress(node.address);
      if (!nftId) { coverage.malformedObjectIds += 1; continue; }
      const owner = ownerAddress(node);
      if (owner.kind !== 'AddressOwner') {
        coverage.nonAddressOwnedTreePositions += 1;
        continue;
      }
      if (!owner.address) { coverage.malformedOwners += 1; continue; }
      coverage.addressOwnedTreePositions += 1;

      const json = record(record(record(node.asMoveObject).contents).json);
      const poolId = normalizeSuiAddress(json.pool_id);
      const positionId = normalizeSuiAddress(json.position_id);
      const tokenA = normalizeStructType(json.coin_type_a);
      const tokenB = normalizeStructType(json.coin_type_b);
      const feeType = normalizeStructType(json.fee_type);
      const treeSide = tokenA === NORMALIZED_TREE ? 'a' : tokenB === NORMALIZED_TREE ? 'b' : null;
      if (!poolId || !positionId || !tokenA || !tokenB || !feeType || !treeSide || tokenA === tokenB) {
        coverage.malformedObjects += 1;
        continue;
      }
      if (seenPositionIds.has(positionId)) {
        coverage.duplicatePositionIds += 1;
        continue;
      }
      seenPositionIds.add(positionId);
      const expected = expectedPools.get(poolId);
      if (expected && (expected.tokenA !== tokenA || expected.tokenB !== tokenB || expected.feeType !== feeType)) {
        coverage.malformedObjects += 1;
        continue;
      }
      expectedPools.set(poolId, { tokenA, tokenB, feeType });
      parsedNfts.push({
        nftId,
        wallet: owner.address,
        excluded: Boolean(excludedAddress(owner.address)),
        poolId,
        positionId,
        tokenA,
        tokenB,
        feeType,
        treeSide,
      });
    }

    coverage.uniquePools = expectedPools.size;
    coverage.poolIds = [...expectedPools.keys()].sort();
    const defaults = defaultObjectGetters(options.grpcHost || DEFAULT_GRPC_HOST);
    const getPoolObject = options.getPoolObject || defaults.getPoolObject;
    const getPositionObject = options.getPositionObject || defaults.getPositionObject;

    const verifiedPools = new Map<string, VerifiedPool>();
    for (const [poolId, expected] of expectedPools) {
      const pool = verifyPool(poolId, await getPoolObject(poolId), expected.tokenA, expected.tokenB, expected.feeType);
      if (!pool) {
        coverage.malformedObjects += 1;
        continue;
      }
      verifiedPools.set(poolId, pool);
    }
    coverage.verifiedPools = verifiedPools.size;

    const verifiedPositions: VerifiedPosition[] = [];
    for (const nft of parsedNfts) {
      const position = verifyPosition(nft, await getPositionObject(nft.positionId));
      if (!position) {
        coverage.malformedObjects += 1;
        continue;
      }
      verifiedPositions.push(position);
    }
    coverage.verifiedPositions = verifiedPositions.length;

    const walletTotals = new Map<string, WalletAccumulator>();
    const poolTotals = new Map<string, { amountA: bigint; amountB: bigint }>();
    let aggregatePrincipalTreeRaw = 0n;
    let excludedPrincipalTreeRaw = 0n;
    let unclaimedTreeRawExcluded = 0n;

    for (const position of verifiedPositions) {
      const pool = verifiedPools.get(position.poolId);
      if (!pool) continue;
      const amounts = amountsForLiquidityQ64(
        pool.currentSqrtPrice,
        tickToSqrtPriceQ64(position.tickLower),
        tickToSqrtPriceQ64(position.tickUpper),
        position.liquidity,
      );
      const poolTotal = poolTotals.get(position.poolId) || { amountA: 0n, amountB: 0n };
      poolTotal.amountA += amounts.amountX;
      poolTotal.amountB += amounts.amountY;
      poolTotals.set(position.poolId, poolTotal);

      const principalTreeRaw = position.treeSide === 'a' ? amounts.amountX : amounts.amountY;
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
      if (!pool || totals.amountA > pool.reserveA || totals.amountB > pool.reserveB) {
        coverage.reconciliationFailures += 1;
      }
    }

    coverage.uniqueOwners = walletTotals.size;
    coverage.aggregatePrincipalTreeRaw = aggregatePrincipalTreeRaw.toString();
    coverage.excludedPrincipalTreeRaw = excludedPrincipalTreeRaw.toString();
    coverage.unclaimedTreeRawExcluded = unclaimedTreeRawExcluded.toString();

    const integrityValid = coverage.malformedObjects === 0
      && coverage.malformedOwners === 0
      && coverage.malformedObjectIds === 0
      && coverage.duplicateObjectIds === 0
      && coverage.duplicatePositionIds === 0
      && coverage.nonAddressOwnedTreePositions === 0
      && coverage.verifiedPools === coverage.uniquePools
      && coverage.verifiedPositions === parsedNfts.length
      && coverage.reconciliationFailures === 0
      && coverage.graphqlErrors.length === 0
      && !coverage.networkError
      && !coverage.rateLimited;
    coverage.scanComplete = coverage.reachedEnd && integrityValid;

    if (!coverage.reachedEnd) warnings.push('The Turbos position NFT scan did not reach its natural end; partial exposure was not published.');
    if (coverage.nonAddressOwnedTreePositions) warnings.push('One or more Turbos TREE position NFTs were not directly address-owned; owner attribution was incomplete.');
    if (!integrityValid) warnings.push('Turbos TREE position integrity verification failed; partial exposure was not published.');

    const positions: WalletLpPosition[] = coverage.scanComplete
      ? [...walletTotals.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([wallet, value]) => ({
          wallet,
          venue: 'turbos' as const,
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
      venue: 'turbos',
      outcome: coverage.scanComplete ? 'complete' : 'verification-incomplete',
      provider: TURBOS_PROVIDER,
      methodologyVersion: TURBOS_METHODOLOGY_VERSION,
      generatedAt,
      positions,
      coverage,
      warnings,
    };
  } catch (error) {
    coverage.networkError = error instanceof Error ? error.message : 'Turbos TREE LP scan failed.';
    warnings.push('The Turbos provider failed; no partial exposure was published.');
    return {
      venue: 'turbos',
      outcome: 'error',
      provider: TURBOS_PROVIDER,
      methodologyVersion: TURBOS_METHODOLOGY_VERSION,
      generatedAt,
      positions: [],
      coverage,
      warnings,
    };
  }
}
