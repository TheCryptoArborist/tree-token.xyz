import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';
import {
  TREE_ACTIVITY_ACCUMULATOR_BUYS,
  TREE_ACTIVITY_MIN_VOLUME_RAW,
  TREE_ACTIVITY_WINDOW_MS,
} from './tree-badge-types.ts';
import { formatTreeRaw } from './tree-exposure-types.ts';
import {
  SUIDEX_V2_PACKAGE,
  SUIDEX_V2_TREE_POOL_ID,
} from './suidex-v2-tree-lp-provider.ts';
import { SUIDEX_V3_PACKAGE } from './suidex-v3-tree-lp-provider.ts';
import {
  TURBOS_PACKAGE,
  TURBOS_TREE_POOL_IDS,
} from './turbos-tree-lp-provider.ts';

export const TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION = 'sui-native-tree-trade-ledger-v3';
export const SUIDEX_V3_TREE_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
export const TURBOS_SWAP_PACKAGE = '0x626c8509478fe57ddf69e4141080b062911063f541c55cd0e8d602c6a0874573';
export const TURBOS_POSITION_MANAGER_PACKAGE = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';

const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES_PER_POOL = 2_000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MAX_SCAN_MS = 10 * 60 * 1000;
const SUI_ZERO_ADDRESS = `0x${'0'.repeat(64)}`;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;
type ActivityVenue = 'suidex-v2' | 'suidex-v3' | 'turbos';

type MoveCall = {
  packageId: string;
  moduleName: string;
  functionName: string;
  typeArguments: string[];
};

export type TreeActivitySource = {
  poolId: string;
  protocol: string;
  venue: ActivityVenue;
};

export const TREE_ACTIVITY_SOURCES: readonly TreeActivitySource[] = [
  { poolId: SUIDEX_V2_TREE_POOL_ID, protocol: 'suidex-v2', venue: 'suidex-v2' },
  { poolId: SUIDEX_V3_TREE_POOL_ID, protocol: 'suidex-v3', venue: 'suidex-v3' },
  ...TURBOS_TREE_POOL_IDS.map((poolId) => ({ poolId, protocol: 'turbos', venue: 'turbos' as const })),
];

const LATEST_CHECKPOINT_QUERY = `query LatestCheckpoint {
  checkpoints(last: 1) { nodes { sequenceNumber timestamp } }
}`;

const CHECKPOINT_AT_QUERY = `query CheckpointAt($sequenceNumber: UInt53!) {
  checkpoint(sequenceNumber: $sequenceNumber) { sequenceNumber timestamp }
}`;

const POOL_TRANSACTIONS_QUERY = `query PoolTransactions(
  $pool: SuiAddress!
  $first: Int!
  $after: String
  $afterCheckpoint: UInt53!
  $beforeCheckpoint: UInt53!
) {
  transactions(
    first: $first
    after: $after
    filter: {
      affectedObject: $pool
      afterCheckpoint: $afterCheckpoint
      beforeCheckpoint: $beforeCheckpoint
    }
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {
      digest
      sender { address }
      transactionJson
      effects {
        status
        timestamp
        checkpoint { sequenceNumber }
        balanceChanges(first: 50) {
          pageInfo { hasNextPage }
          nodes {
            owner { address }
            coinType { repr }
            amount
          }
        }
      }
    }
  }
}`;

export type IndexedTreeTrade = {
  wallet: string;
  digest: string;
  timestamp: number;
  checkpoint: string;
  source: string;
  legs: Record<string, string>;
};

export type TreeActivityPoolCursor = {
  protocol: string;
  indexedThroughMs: number;
  indexedThroughCheckpoint: string;
  rangeStartCheckpoint: string;
  rangeEndCheckpoint: string;
  nextCursor: string | null;
  inProgress: boolean;
};

export type TreeActivityIndex = {
  methodologyVersion: typeof TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  windowStartCheckpoint: string;
  indexedThroughCheckpoint: string;
  wallets: string[];
  pools: Record<string, TreeActivityPoolCursor>;
  transactions: Record<string, IndexedTreeTrade>;
};

export type TreeActivityRefreshResult = {
  outcome: 'complete' | 'verification-incomplete' | 'error';
  index: TreeActivityIndex | null;
  warnings: string[];
  coverage: {
    poolsRequested: number;
    poolsCompleted: number;
    pagesScanned: number;
    eventsScanned: number;
    tradeTransactions: number;
    duplicateEvents: number;
    malformedEvents: number;
    retries: number;
    checkpointQueries: number;
    reachedEnd: boolean;
    timeLimitReached: boolean;
  };
};

export type WalletActivitySummary = {
  buyCount: number;
  sellCount: number;
  buyTreeRaw: string;
  buyTree: string;
  sellTreeRaw: string;
  sellTree: string;
};

export type TreeActivityIndexOptions = {
  fetchImpl?: FetchLike;
  getEnv?: (name: string) => string | undefined;
  now?: () => number;
  pageSize?: number;
  maxPagesPerPool?: number;
  maxRetries?: number;
  maxScanMs?: number;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  wallets?: string[];
  sources?: readonly TreeActivitySource[];
  onProgress?: (index: TreeActivityIndex) => Promise<void> | void;
  onPoolComplete?: (index: TreeActivityIndex) => Promise<void> | void;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function canonicalCoinType(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const nested = record(value);
    return canonicalCoinType(nested.repr ?? nested.coin_type ?? nested.coinType);
  }
  if (typeof value !== 'string') return null;
  const parts = value.trim().toLowerCase().split('::');
  if (parts.length !== 3) return null;
  const address = parts[0].replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(address)) return null;
  return `0x${address.padStart(64, '0')}::${parts[1]}::${parts[2]}`;
}

const NORMALIZED_TREE = canonicalCoinType(TREE_COIN_TYPE)!;

function containsTreeType(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase().replace(/0x0+/g, '0x');
  const tree = TREE_COIN_TYPE.toLowerCase().replace(/^0x0*/, '0x');
  return canonicalCoinType(value) === NORMALIZED_TREE || normalized.includes(tree);
}

function parseUnsignedCheckpoint(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function parseSignedRaw(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeWallets(values: string[]): string[] {
  return [...new Set(values
    .map(normalizeSuiAddress)
    .filter((value): value is string => Boolean(value)))]
    .sort();
}

function sameWalletSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((wallet, index) => wallet === right[index]);
}

function normalizeSources(values: readonly TreeActivitySource[]): TreeActivitySource[] {
  const sources = new Map<string, TreeActivitySource>();
  for (const value of values) {
    const poolId = normalizeSuiAddress(value.poolId);
    if (!poolId || !['suidex-v2', 'suidex-v3', 'turbos'].includes(value.venue)) continue;
    sources.set(poolId, {
      poolId,
      protocol: String(value.protocol || value.venue),
      venue: value.venue,
    });
  }
  return [...sources.values()].sort((a, b) => a.poolId.localeCompare(b.poolId));
}

function extractMoveCalls(value: unknown): MoveCall[] {
  const calls: MoveCall[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const object = record(node);
    const packageValue = object.package ?? object.packageId ?? object.package_id ?? object.packageAddress ?? object.package_address;
    const moduleValue = object.module ?? object.moduleName ?? object.module_name;
    const functionValue = object.function ?? object.functionName ?? object.function_name;
    const packageId = normalizeSuiAddress(packageValue);
    if (packageId && typeof moduleValue === 'string' && typeof functionValue === 'string') {
      const rawTypeArguments = object.typeArguments ?? object.type_arguments ?? object.typeArgs;
      calls.push({
        packageId,
        moduleName: moduleValue.toLowerCase(),
        functionName: functionValue.toLowerCase(),
        typeArguments: Array.isArray(rawTypeArguments)
          ? rawTypeArguments.filter((item): item is string => typeof item === 'string')
          : [],
      });
    }
    Object.values(object).forEach(visit);
  };
  visit(value);
  return calls;
}

function callContainsTree(call: MoveCall): boolean {
  return call.typeArguments.some(containsTreeType);
}

function recognizedSwapVenue(call: MoveCall): ActivityVenue | null {
  if (!callContainsTree(call)) return null;
  if (call.packageId === normalizeSuiAddress(SUIDEX_V2_PACKAGE)
    && call.moduleName === 'router'
    && call.functionName.includes('swap')) return 'suidex-v2';
  if (call.packageId === normalizeSuiAddress(SUIDEX_V3_PACKAGE)
    && call.moduleName === 'trade'
    && call.functionName.includes('swap')
    && !call.functionName.startsWith('repay')) return 'suidex-v3';
  if (call.packageId === normalizeSuiAddress(TURBOS_SWAP_PACKAGE)
    && call.moduleName === 'turbos'
    && call.functionName.includes('swap')) return 'turbos';
  return null;
}

function disqualifyingTreeAction(call: MoveCall): boolean {
  if (!callContainsTree(call)) return false;
  const recognizedPackages = new Set([
    normalizeSuiAddress(SUIDEX_V2_PACKAGE),
    normalizeSuiAddress(SUIDEX_V3_PACKAGE),
    normalizeSuiAddress(TURBOS_SWAP_PACKAGE),
    normalizeSuiAddress(TURBOS_PACKAGE),
    normalizeSuiAddress(TURBOS_POSITION_MANAGER_PACKAGE),
  ]);
  if (!recognizedPackages.has(call.packageId)) return false;
  const action = `${call.moduleName}::${call.functionName}`;
  return /(liquidity|position|farm|staking|reward|collect|deposit|withdraw|stake|unstake|mint|open_position|close_position|add_liquidity|remove_liquidity|burn_nft)/.test(action);
}

function sourcePoolForVenue(venue: ActivityVenue, queriedPool: string): string {
  if (venue === 'suidex-v2') return SUIDEX_V2_TREE_POOL_ID;
  if (venue === 'suidex-v3') return SUIDEX_V3_TREE_POOL_ID;
  return TURBOS_TREE_POOL_IDS.includes(queriedPool as typeof TURBOS_TREE_POOL_IDS[number])
    ? queriedPool
    : TURBOS_TREE_POOL_IDS[0];
}

function classifyTransaction(
  nodeValue: unknown,
  queriedPool: string,
  targetWallets: Set<string>,
  windowStartMs: number,
  windowEndMs: number,
): IndexedTreeTrade | null {
  const node = record(nodeValue);
  const digest = typeof node.digest === 'string' ? node.digest.trim() : '';
  const wallet = normalizeSuiAddress(record(node.sender).address);
  const effects = record(node.effects);
  const timestamp = Date.parse(String(effects.timestamp || ''));
  const checkpoint = parseUnsignedCheckpoint(record(effects.checkpoint).sequenceNumber);
  if (!digest || !wallet || !targetWallets.has(wallet)
    || effects.status !== 'SUCCESS'
    || !Number.isFinite(timestamp)
    || timestamp < windowStartMs
    || timestamp > windowEndMs
    || checkpoint === null) return null;

  const balanceChanges = record(effects.balanceChanges);
  if (record(balanceChanges.pageInfo).hasNextPage === true) return null;
  const changes = Array.isArray(balanceChanges.nodes) ? balanceChanges.nodes : [];
  let senderTreeDelta = 0n;
  let zeroAddressTreeCredit = 0n;
  for (const changeValue of changes) {
    const change = record(changeValue);
    if (canonicalCoinType(record(change.coinType).repr) !== NORMALIZED_TREE) continue;
    const owner = normalizeSuiAddress(record(change.owner).address);
    const amount = parseSignedRaw(change.amount);
    if (!owner || amount === null) return null;
    if (owner === wallet) senderTreeDelta += amount;
    if (owner === SUI_ZERO_ADDRESS && amount > 0n) zeroAddressTreeCredit += amount;
  }
  if (senderTreeDelta === 0n || zeroAddressTreeCredit > 0n) return null;

  const calls = extractMoveCalls(node.transactionJson);
  if (calls.some(disqualifyingTreeAction)) return null;
  const venues = [...new Set(calls.map(recognizedSwapVenue).filter((value): value is ActivityVenue => Boolean(value)))];
  if (!venues.length) return null;
  const source = sourcePoolForVenue(venues[0], queriedPool);
  return {
    wallet,
    digest,
    timestamp,
    checkpoint: String(checkpoint),
    source,
    legs: { [source]: senderTreeDelta.toString() },
  };
}

export function validateTreeActivityIndex(value: unknown): value is TreeActivityIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const index = value as TreeActivityIndex;
  if (index.methodologyVersion !== TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION
    || !validDate(index.generatedAt)
    || !validDate(index.windowStart)
    || !validDate(index.windowEnd)
    || Date.parse(index.windowStart) >= Date.parse(index.windowEnd)
    || typeof index.windowStartCheckpoint !== 'string'
    || !/^\d+$/.test(index.windowStartCheckpoint)
    || typeof index.indexedThroughCheckpoint !== 'string'
    || !/^\d+$/.test(index.indexedThroughCheckpoint)
    || !Array.isArray(index.wallets)
    || !sameWalletSet(index.wallets, normalizeWallets(index.wallets))
    || !index.pools || typeof index.pools !== 'object'
    || !index.transactions || typeof index.transactions !== 'object') return false;

  for (const [poolId, pool] of Object.entries(index.pools)) {
    if (normalizeSuiAddress(poolId) !== poolId
      || typeof pool.protocol !== 'string'
      || !Number.isSafeInteger(pool.indexedThroughMs)
      || pool.indexedThroughMs < 0
      || !/^\d+$/.test(pool.indexedThroughCheckpoint)
      || !/^\d+$/.test(pool.rangeStartCheckpoint)
      || !/^\d+$/.test(pool.rangeEndCheckpoint)
      || (pool.nextCursor !== null && typeof pool.nextCursor !== 'string')
      || typeof pool.inProgress !== 'boolean') return false;
  }

  const walletSet = new Set(index.wallets);
  for (const [key, transaction] of Object.entries(index.transactions)) {
    if (key !== `${transaction.wallet}:${transaction.digest}`
      || !walletSet.has(transaction.wallet)
      || normalizeSuiAddress(transaction.wallet) !== transaction.wallet
      || typeof transaction.digest !== 'string'
      || !transaction.digest
      || !Number.isSafeInteger(transaction.timestamp)
      || transaction.timestamp < 0
      || !/^\d+$/.test(transaction.checkpoint)
      || normalizeSuiAddress(transaction.source) !== transaction.source
      || !transaction.legs
      || typeof transaction.legs !== 'object') return false;
    const legs = Object.entries(transaction.legs);
    if (legs.length !== 1) return false;
    for (const [poolId, raw] of legs) {
      if (normalizeSuiAddress(poolId) !== poolId
        || typeof raw !== 'string'
        || !/^-?\d+$/.test(raw)
        || raw === '0') return false;
    }
  }
  return true;
}

function emptyIndex(
  wallets: string[],
  windowStartMs: number,
  windowEndMs: number,
  windowStartCheckpoint: number,
): TreeActivityIndex {
  return {
    methodologyVersion: TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION,
    generatedAt: new Date(windowEndMs).toISOString(),
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    windowStartCheckpoint: String(windowStartCheckpoint),
    indexedThroughCheckpoint: String(Math.max(0, windowStartCheckpoint - 1)),
    wallets,
    pools: {},
    transactions: {},
  };
}

function copyIndex(
  prior: TreeActivityIndex | null,
  wallets: string[],
  windowStartMs: number,
  windowEndMs: number,
  windowStartCheckpoint: number,
): TreeActivityIndex {
  if (!prior || !sameWalletSet(prior.wallets, wallets)) {
    return emptyIndex(wallets, windowStartMs, windowEndMs, windowStartCheckpoint);
  }
  const transactions: Record<string, IndexedTreeTrade> = {};
  for (const [key, transaction] of Object.entries(prior.transactions)) {
    if (transaction.timestamp >= windowStartMs && transaction.timestamp <= windowEndMs) {
      transactions[key] = { ...transaction, legs: { ...transaction.legs } };
    }
  }
  return {
    ...prior,
    generatedAt: new Date(windowEndMs).toISOString(),
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    windowStartCheckpoint: String(windowStartCheckpoint),
    wallets,
    pools: Object.fromEntries(Object.entries(prior.pools).map(([poolId, pool]) => [poolId, { ...pool }])),
    transactions,
  };
}

async function requestGraphql(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: FetchLike,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeActivityRefreshResult['coverage'],
  deadline: number,
): Promise<JsonRecord> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (Date.now() >= deadline) {
      coverage.timeLimitReached = true;
      throw new Error('The TREE activity scan reached its bounded deadline.');
    }
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Sui GraphQL returned ${response.status}.`);
      }
      if (!response.ok) throw new Error(`Sui GraphQL returned ${response.status}.`);
      const payload = record(await response.json());
      const errors = Array.isArray(payload.errors) ? payload.errors : [];
      if (errors.length) {
        throw new Error(errors.map((error) => String(record(error).message || 'Sui GraphQL error')).join(' '));
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Sui GraphQL request failed.');
      if (attempt >= maxRetries) break;
      coverage.retries += 1;
      await sleepImpl(Math.min(4_000, 250 * 2 ** attempt));
    }
  }
  throw lastError || new Error('Sui GraphQL request failed.');
}

async function latestCheckpoint(
  endpoint: string,
  fetchImpl: FetchLike,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeActivityRefreshResult['coverage'],
  deadline: number,
): Promise<{ sequenceNumber: number; timestamp: number }> {
  coverage.checkpointQueries += 1;
  const payload = await requestGraphql(endpoint, LATEST_CHECKPOINT_QUERY, {}, fetchImpl, maxRetries, sleepImpl, coverage, deadline);
  const nodes = record(record(payload.data).checkpoints).nodes;
  const node = Array.isArray(nodes) ? record(nodes[0]) : {};
  const sequenceNumber = parseUnsignedCheckpoint(node.sequenceNumber);
  const timestamp = Date.parse(String(node.timestamp || ''));
  if (sequenceNumber === null || !Number.isFinite(timestamp)) {
    throw new Error('The latest Sui checkpoint could not be resolved.');
  }
  return { sequenceNumber, timestamp };
}

async function checkpointAt(
  sequenceNumber: number,
  endpoint: string,
  fetchImpl: FetchLike,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeActivityRefreshResult['coverage'],
  deadline: number,
): Promise<{ sequenceNumber: number; timestamp: number }> {
  coverage.checkpointQueries += 1;
  const payload = await requestGraphql(
    endpoint,
    CHECKPOINT_AT_QUERY,
    { sequenceNumber },
    fetchImpl,
    maxRetries,
    sleepImpl,
    coverage,
    deadline,
  );
  const node = record(record(payload.data).checkpoint);
  const resolvedSequence = parseUnsignedCheckpoint(node.sequenceNumber);
  const timestamp = Date.parse(String(node.timestamp || ''));
  if (resolvedSequence === null || resolvedSequence !== sequenceNumber || !Number.isFinite(timestamp)) {
    throw new Error(`Sui checkpoint ${sequenceNumber} could not be resolved.`);
  }
  return { sequenceNumber: resolvedSequence, timestamp };
}

async function resolveWindowStartCheckpoint(
  targetTimestamp: number,
  latest: { sequenceNumber: number; timestamp: number },
  endpoint: string,
  fetchImpl: FetchLike,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeActivityRefreshResult['coverage'],
  deadline: number,
): Promise<number> {
  if (targetTimestamp >= latest.timestamp) return latest.sequenceNumber;
  let low = 0;
  let high = latest.sequenceNumber;
  while (low < high) {
    const midpoint = Math.floor((low + high) / 2);
    const checkpoint = await checkpointAt(midpoint, endpoint, fetchImpl, maxRetries, sleepImpl, coverage, deadline);
    if (checkpoint.timestamp < targetTimestamp) low = midpoint + 1;
    else high = midpoint;
  }
  return low;
}

async function persistProgress(index: TreeActivityIndex, options: TreeActivityIndexOptions): Promise<void> {
  const callback = options.onProgress ?? options.onPoolComplete;
  await callback?.(index);
}

async function scanSource(
  index: TreeActivityIndex,
  source: TreeActivitySource,
  targetWallets: Set<string>,
  windowStartMs: number,
  windowEndMs: number,
  windowStartCheckpoint: number,
  latestCheckpointNumber: number,
  endpoint: string,
  fetchImpl: FetchLike,
  pageSize: number,
  maxPages: number,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeActivityRefreshResult['coverage'],
  deadline: number,
  options: TreeActivityIndexOptions,
): Promise<boolean> {
  const minimumExclusiveCheckpoint = Math.max(0, windowStartCheckpoint - 1);

  while (true) {
    let state = index.pools[source.poolId];
    if (!state || !state.inProgress) {
      const indexedThrough = state ? Number(state.indexedThroughCheckpoint) : minimumExclusiveCheckpoint;
      const rangeStart = Math.max(minimumExclusiveCheckpoint, Number.isSafeInteger(indexedThrough) ? indexedThrough : minimumExclusiveCheckpoint);
      if (rangeStart >= latestCheckpointNumber) {
        index.pools[source.poolId] = {
          protocol: source.protocol,
          indexedThroughMs: windowEndMs,
          indexedThroughCheckpoint: String(latestCheckpointNumber),
          rangeStartCheckpoint: String(rangeStart),
          rangeEndCheckpoint: String(latestCheckpointNumber),
          nextCursor: null,
          inProgress: false,
        };
        await persistProgress(index, options);
        return true;
      }
      state = {
        protocol: source.protocol,
        indexedThroughMs: state?.indexedThroughMs ?? windowStartMs,
        indexedThroughCheckpoint: String(rangeStart),
        rangeStartCheckpoint: String(rangeStart),
        rangeEndCheckpoint: String(latestCheckpointNumber),
        nextCursor: null,
        inProgress: true,
      };
      index.pools[source.poolId] = state;
      await persistProgress(index, options);
    }

    const rangeStart = Number(state.rangeStartCheckpoint);
    const rangeEnd = Number(state.rangeEndCheckpoint);
    let cursor = state.nextCursor;
    let reachedEnd = false;

    for (let page = 0; page < maxPages; page += 1) {
      if (Date.now() >= deadline) {
        coverage.timeLimitReached = true;
        return false;
      }
      const payload = await requestGraphql(
        endpoint,
        POOL_TRANSACTIONS_QUERY,
        {
          pool: source.poolId,
          first: pageSize,
          after: cursor,
          afterCheckpoint: rangeStart,
          beforeCheckpoint: rangeEnd + 1,
        },
        fetchImpl,
        maxRetries,
        sleepImpl,
        coverage,
        deadline,
      );
      const connection = record(record(payload.data).transactions);
      const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
      coverage.pagesScanned += 1;
      coverage.eventsScanned += nodes.length;

      for (const node of nodes) {
        const transaction = classifyTransaction(node, source.poolId, targetWallets, windowStartMs, windowEndMs);
        if (!transaction) continue;
        const key = `${transaction.wallet}:${transaction.digest}`;
        const previous = index.transactions[key];
        if (previous) {
          const previousRaw = Object.values(previous.legs)[0];
          const currentRaw = Object.values(transaction.legs)[0];
          if (previous.wallet !== transaction.wallet
            || previous.timestamp !== transaction.timestamp
            || previous.checkpoint !== transaction.checkpoint
            || previousRaw !== currentRaw) {
            coverage.malformedEvents += 1;
            throw new Error(`Conflicting duplicate TREE trade ${transaction.digest}.`);
          }
          coverage.duplicateEvents += 1;
          continue;
        }
        index.transactions[key] = transaction;
      }

      const pageInfo = record(connection.pageInfo);
      if (pageInfo.hasNextPage !== true) {
        reachedEnd = true;
        cursor = null;
      } else if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor || pageInfo.endCursor === cursor) {
        throw new Error(`The Sui transaction cursor was missing or repeated for ${source.poolId}.`);
      } else {
        cursor = pageInfo.endCursor;
      }

      index.pools[source.poolId] = {
        ...state,
        nextCursor: cursor,
        inProgress: !reachedEnd,
      };
      await persistProgress(index, options);
      if (reachedEnd) break;
    }

    if (!reachedEnd) return false;
    index.pools[source.poolId] = {
      protocol: source.protocol,
      indexedThroughMs: windowEndMs,
      indexedThroughCheckpoint: String(rangeEnd),
      rangeStartCheckpoint: String(rangeEnd),
      rangeEndCheckpoint: String(rangeEnd),
      nextCursor: null,
      inProgress: false,
    };
    await persistProgress(index, options);
    if (rangeEnd >= latestCheckpointNumber) return true;
  }
}

export async function refreshTreeActivityIndex(
  priorValue: unknown,
  options: TreeActivityIndexOptions = {},
): Promise<TreeActivityRefreshResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const windowEndMs = startedAt;
  const windowStartMs = windowEndMs - TREE_ACTIVITY_WINDOW_MS;
  const coverage: TreeActivityRefreshResult['coverage'] = {
    poolsRequested: 0,
    poolsCompleted: 0,
    pagesScanned: 0,
    eventsScanned: 0,
    tradeTransactions: 0,
    duplicateEvents: 0,
    malformedEvents: 0,
    retries: 0,
    checkpointQueries: 0,
    reachedEnd: false,
    timeLimitReached: false,
  };
  const wallets = normalizeWallets(options.wallets || (validateTreeActivityIndex(priorValue) ? priorValue.wallets : []));
  if (!wallets.length) {
    return {
      outcome: 'error',
      index: null,
      coverage,
      warnings: ['The Sui-native TREE activity index requires the current ranked wallet set.'],
    };
  }

  const getEnv = options.getEnv ?? ((name) => typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined);
  const endpoint = getEnv('SUI_GRAPHQL_URL') || DEFAULT_GRAPHQL_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(10_000, Math.trunc(options.maxPagesPerPool ?? DEFAULT_MAX_PAGES_PER_POOL)));
  const maxRetries = Math.max(0, Math.min(8, Math.trunc(options.maxRetries ?? DEFAULT_MAX_RETRIES)));
  const maxScanMs = Math.max(30_000, Math.trunc(options.maxScanMs ?? DEFAULT_MAX_SCAN_MS));
  const sleepImpl = options.sleepImpl ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const sources = normalizeSources(options.sources || TREE_ACTIVITY_SOURCES);
  coverage.poolsRequested = sources.length;
  const deadline = Date.now() + maxScanMs;
  let index: TreeActivityIndex | null = null;

  try {
    const latest = await latestCheckpoint(endpoint, fetchImpl, maxRetries, sleepImpl, coverage, deadline);
    const windowStartCheckpoint = await resolveWindowStartCheckpoint(
      windowStartMs,
      latest,
      endpoint,
      fetchImpl,
      maxRetries,
      sleepImpl,
      coverage,
      deadline,
    );
    const prior = validateTreeActivityIndex(priorValue) ? priorValue : null;
    index = copyIndex(prior, wallets, windowStartMs, windowEndMs, windowStartCheckpoint);
    const targetWallets = new Set(wallets);

    for (const source of sources) {
      const complete = await scanSource(
        index,
        source,
        targetWallets,
        windowStartMs,
        windowEndMs,
        windowStartCheckpoint,
        latest.sequenceNumber,
        endpoint,
        fetchImpl,
        pageSize,
        maxPages,
        maxRetries,
        sleepImpl,
        coverage,
        deadline,
        options,
      );
      if (!complete) {
        return {
          outcome: 'verification-incomplete',
          index,
          coverage,
          warnings: [
            coverage.timeLimitReached
              ? 'The Sui-native TREE activity scan reached its deadline; stored cursors will resume the same bounded range.'
              : `The Sui-native TREE activity scan did not reach the natural end for ${source.poolId}; stored cursors will resume it.`,
          ],
        };
      }
      coverage.poolsCompleted += 1;
    }

    index.generatedAt = new Date(windowEndMs).toISOString();
    index.indexedThroughCheckpoint = String(latest.sequenceNumber);
    coverage.tradeTransactions = Object.keys(index.transactions).length;
    coverage.reachedEnd = coverage.poolsCompleted === coverage.poolsRequested;
    if (!coverage.reachedEnd || !validateTreeActivityIndex(index)) {
      return {
        outcome: 'verification-incomplete',
        index,
        coverage,
        warnings: ['The Sui-native TREE activity index failed final integrity validation.'],
      };
    }
    return {
      outcome: 'complete',
      index,
      coverage,
      warnings: [
        'The rolling activity index uses successful Sui transactions, exact sender TREE balance changes, and recognized SuiDex V2, SuiDex V3, and Turbos swap calls.',
        'Transfers, LP joins and exits, staking, farming, fee and reward collection, and burns are excluded from buy/sell classification.',
      ],
    };
  } catch (error) {
    return {
      outcome: coverage.timeLimitReached ? 'verification-incomplete' : 'error',
      index,
      coverage,
      warnings: [error instanceof Error ? error.message : 'The Sui-native TREE activity index failed.'],
    };
  }
}

export function summarizeTreeActivity(
  index: TreeActivityIndex,
  walletValues: string[],
): Record<string, WalletActivitySummary> {
  const wallets = normalizeWallets(walletValues);
  const mutable = new Map(wallets.map((wallet) => [wallet, {
    buyCount: 0,
    sellCount: 0,
    buyRaw: 0n,
    sellRaw: 0n,
  }]));
  for (const transaction of Object.values(index.transactions)) {
    const stats = mutable.get(transaction.wallet);
    if (!stats) continue;
    const net = Object.values(transaction.legs).reduce((sum, raw) => sum + BigInt(raw), 0n);
    if (net > 0n) {
      stats.buyCount += 1;
      stats.buyRaw += net;
    } else if (net < 0n) {
      stats.sellCount += 1;
      stats.sellRaw += -net;
    }
  }
  return Object.fromEntries([...mutable.entries()].map(([wallet, stats]) => [wallet, {
    buyCount: stats.buyCount,
    sellCount: stats.sellCount,
    buyTreeRaw: stats.buyRaw.toString(),
    buyTree: formatTreeRaw(stats.buyRaw),
    sellTreeRaw: stats.sellRaw.toString(),
    sellTree: formatTreeRaw(stats.sellRaw),
  }]));
}

export function activityQualifiesForAccumulator(summary: WalletActivitySummary): boolean {
  const buyRaw = BigInt(summary.buyTreeRaw);
  const sellRaw = BigInt(summary.sellTreeRaw);
  return summary.buyCount >= TREE_ACTIVITY_ACCUMULATOR_BUYS
    && buyRaw >= TREE_ACTIVITY_MIN_VOLUME_RAW
    && buyRaw > sellRaw;
}
