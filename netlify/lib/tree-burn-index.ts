import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';
import { BURNED_BADGE_THRESHOLD_RAW } from './tree-badge-types.ts';
import { formatTreeRaw } from './tree-exposure-types.ts';

export const TREE_BURN_INDEX_METHODOLOGY_VERSION = 'sui-sender-burn-checkpoints-v3';
export const SUI_ZERO_ADDRESS = `0x${'0'.repeat(64)}`;
export const TREE_TOKEN_CREATION_CHECKPOINT = '169361209';

const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES_PER_WALLET = 5_000;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MAX_SCAN_MS = 10 * 60 * 1000;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export type WalletBurnProgress = {
  rangeStartCheckpoint: string;
  rangeEndCheckpoint: string;
  nextCursor: string | null;
  accumulatedBurnedTreeRaw: string;
};

export type WalletBurnIndexEntry = {
  burnedTreeRaw: string;
  indexedThroughCheckpoint: string;
  completeBackfill: boolean;
  progress: WalletBurnProgress | null;
};

export type TreeBurnIndex = {
  methodologyVersion: typeof TREE_BURN_INDEX_METHODOLOGY_VERSION;
  generatedAt: string;
  indexedThroughCheckpoint: string;
  creationCheckpoint: string;
  wallets: Record<string, WalletBurnIndexEntry>;
};

export type TreeBurnRefreshResult = {
  outcome: 'complete' | 'verification-incomplete' | 'error';
  index: TreeBurnIndex | null;
  warnings: string[];
  coverage: {
    latestCheckpoint: string | null;
    walletsRequested: number;
    walletsCompleted: number;
    pagesScanned: number;
    transactionsScanned: number;
    treeBurnTransactions: number;
    duplicateTransactions: number;
    malformedTransactions: number;
    retries: number;
    reachedEnd: boolean;
    timeLimitReached: boolean;
  };
};

export type TreeBurnIndexOptions = {
  fetchImpl?: FetchLike;
  endpoint?: string;
  getEnv?: (name: string) => string | undefined;
  now?: () => number;
  pageSize?: number;
  maxPagesPerWallet?: number;
  concurrency?: number;
  maxRetries?: number;
  maxScanMs?: number;
  creationCheckpoint?: string;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  onProgress?: (index: TreeBurnIndex, wallet: string) => Promise<void> | void;
  onWalletComplete?: (index: TreeBurnIndex, wallet: string) => Promise<void> | void;
};

const LATEST_CHECKPOINT_QUERY = `query LatestCheckpoint {
  checkpoints(last: 1) { nodes { sequenceNumber } }
}`;

const WALLET_TRANSACTIONS_QUERY = `query WalletTreeBurns(
  $sender: SuiAddress!
  $first: Int!
  $after: String
  $afterCheckpoint: UInt53!
  $beforeCheckpoint: UInt53!
) {
  transactions(
    first: $first
    after: $after
    filter: {
      sentAddress: $sender
      afterCheckpoint: $afterCheckpoint
      beforeCheckpoint: $beforeCheckpoint
    }
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {
      digest
      sender { address }
      effects {
        status
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

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function canonicalCoinType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parts = value.trim().toLowerCase().split('::');
  if (parts.length !== 3) return null;
  const address = parts[0].replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(address)) return null;
  return `0x${address.padStart(64, '0')}::${parts[1]}::${parts[2]}`;
}

const NORMALIZED_TREE = canonicalCoinType(TREE_COIN_TYPE)!;

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseCheckpoint(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function parseUnsignedRaw(value: unknown): bigint | null {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function parseSignedRaw(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function normalizeWallets(values: string[]): string[] {
  return [...new Set(values
    .map(normalizeSuiAddress)
    .filter((value): value is string => Boolean(value)))]
    .sort();
}

function validProgress(value: unknown): value is WalletBurnProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const progress = value as WalletBurnProgress;
  return /^\d+$/.test(progress.rangeStartCheckpoint)
    && /^\d+$/.test(progress.rangeEndCheckpoint)
    && BigInt(progress.rangeEndCheckpoint) >= BigInt(progress.rangeStartCheckpoint)
    && (progress.nextCursor === null || typeof progress.nextCursor === 'string')
    && /^\d+$/.test(progress.accumulatedBurnedTreeRaw);
}

export function validateTreeBurnIndex(value: unknown): value is TreeBurnIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const index = value as TreeBurnIndex;
  if (index.methodologyVersion !== TREE_BURN_INDEX_METHODOLOGY_VERSION
    || !validDate(index.generatedAt)
    || !/^\d+$/.test(index.indexedThroughCheckpoint)
    || !/^\d+$/.test(index.creationCheckpoint)
    || !index.wallets
    || typeof index.wallets !== 'object') return false;
  for (const [wallet, entry] of Object.entries(index.wallets)) {
    if (normalizeSuiAddress(wallet) !== wallet
      || typeof entry.burnedTreeRaw !== 'string'
      || !/^\d+$/.test(entry.burnedTreeRaw)
      || typeof entry.indexedThroughCheckpoint !== 'string'
      || !/^\d+$/.test(entry.indexedThroughCheckpoint)
      || typeof entry.completeBackfill !== 'boolean'
      || (entry.progress !== null && !validProgress(entry.progress))
      || (entry.completeBackfill && entry.progress !== null)) return false;
  }
  return true;
}

async function requestGraphql(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: FetchLike,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeBurnRefreshResult['coverage'],
  deadline: number,
): Promise<JsonRecord> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (Date.now() >= deadline) {
      coverage.timeLimitReached = true;
      throw new Error('The TREE burn scan reached its bounded deadline.');
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
  coverage: TreeBurnRefreshResult['coverage'],
  deadline: number,
): Promise<string> {
  const payload = await requestGraphql(endpoint, LATEST_CHECKPOINT_QUERY, {}, fetchImpl, maxRetries, sleepImpl, coverage, deadline);
  const nodes = record(record(payload.data).checkpoints).nodes;
  const node = Array.isArray(nodes) ? record(nodes[0]) : {};
  const sequence = parseCheckpoint(node.sequenceNumber);
  if (sequence === null) throw new Error('The latest Sui checkpoint could not be resolved.');
  return String(sequence);
}

function copyIndex(
  prior: TreeBurnIndex | null,
  generatedAt: string,
  creationCheckpoint: string,
  wallets: string[],
): TreeBurnIndex {
  const minimumCheckpoint = String(Math.max(0, Number(creationCheckpoint) - 1));
  const entries: Record<string, WalletBurnIndexEntry> = {};
  for (const wallet of wallets) {
    const existing = prior?.creationCheckpoint === creationCheckpoint ? prior.wallets[wallet] : null;
    entries[wallet] = existing
      ? {
        ...existing,
        progress: existing.progress ? { ...existing.progress } : null,
      }
      : {
        burnedTreeRaw: '0',
        indexedThroughCheckpoint: minimumCheckpoint,
        completeBackfill: false,
        progress: null,
      };
  }
  return {
    methodologyVersion: TREE_BURN_INDEX_METHODOLOGY_VERSION,
    generatedAt,
    indexedThroughCheckpoint: prior?.creationCheckpoint === creationCheckpoint
      ? prior.indexedThroughCheckpoint
      : minimumCheckpoint,
    creationCheckpoint,
    wallets: entries,
  };
}

async function persistProgress(
  index: TreeBurnIndex,
  wallet: string,
  options: TreeBurnIndexOptions,
  enqueue: (work: () => Promise<void>) => Promise<void>,
): Promise<void> {
  const callback = options.onProgress ?? options.onWalletComplete;
  if (!callback) return;
  await enqueue(async () => callback(index, wallet));
}

async function scanWallet(
  index: TreeBurnIndex,
  wallet: string,
  latest: number,
  endpoint: string,
  fetchImpl: FetchLike,
  pageSize: number,
  maxPages: number,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeBurnRefreshResult['coverage'],
  deadline: number,
  options: TreeBurnIndexOptions,
  enqueue: (work: () => Promise<void>) => Promise<void>,
): Promise<void> {
  while (true) {
    let entry = index.wallets[wallet];
    let rangeStart: number;
    let rangeEnd: number;
    let cursor: string | null;
    let accumulated: bigint;

    if (entry.progress) {
      rangeStart = Number(entry.progress.rangeStartCheckpoint);
      rangeEnd = Number(entry.progress.rangeEndCheckpoint);
      cursor = entry.progress.nextCursor;
      accumulated = BigInt(entry.progress.accumulatedBurnedTreeRaw);
    } else {
      rangeStart = Number(entry.indexedThroughCheckpoint);
      if (rangeStart >= latest) {
        index.wallets[wallet] = {
          ...entry,
          indexedThroughCheckpoint: String(latest),
          completeBackfill: true,
          progress: null,
        };
        await persistProgress(index, wallet, options, enqueue);
        return;
      }
      rangeEnd = latest;
      cursor = null;
      accumulated = BigInt(entry.burnedTreeRaw);
      entry = {
        ...entry,
        completeBackfill: false,
        progress: {
          rangeStartCheckpoint: String(rangeStart),
          rangeEndCheckpoint: String(rangeEnd),
          nextCursor: null,
          accumulatedBurnedTreeRaw: accumulated.toString(),
        },
      };
      index.wallets[wallet] = entry;
      await persistProgress(index, wallet, options, enqueue);
    }

    let reachedEnd = false;
    const seenCursors = new Set<string>();
    for (let page = 0; page < maxPages; page += 1) {
      if (Date.now() >= deadline) {
        coverage.timeLimitReached = true;
        throw new Error(`Burn history reached its deadline while scanning ${wallet}.`);
      }
      const payload = await requestGraphql(
        endpoint,
        WALLET_TRANSACTIONS_QUERY,
        {
          sender: wallet,
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
      coverage.transactionsScanned += nodes.length;
      const pageDigests = new Set<string>();

      for (const nodeValue of nodes) {
        const node = record(nodeValue);
        const digest = typeof node.digest === 'string' ? node.digest.trim() : '';
        const sender = normalizeSuiAddress(record(node.sender).address);
        const effects = record(node.effects);
        const checkpoint = parseCheckpoint(record(effects.checkpoint).sequenceNumber);
        const changes = record(effects.balanceChanges);
        const changeNodes = Array.isArray(changes.nodes) ? changes.nodes : [];
        if (!digest
          || sender !== wallet
          || effects.status !== 'SUCCESS'
          || checkpoint === null
          || checkpoint <= rangeStart
          || checkpoint > rangeEnd
          || record(changes.pageInfo).hasNextPage === true) {
          coverage.malformedTransactions += 1;
          continue;
        }
        if (pageDigests.has(digest)) {
          coverage.duplicateTransactions += 1;
          continue;
        }
        pageDigests.add(digest);
        let transactionBurnRaw = 0n;
        for (const changeValue of changeNodes) {
          const change = record(changeValue);
          const owner = normalizeSuiAddress(record(change.owner).address);
          const coinType = canonicalCoinType(record(change.coinType).repr);
          const amount = parseSignedRaw(change.amount);
          if (!owner || amount === null) {
            coverage.malformedTransactions += 1;
            continue;
          }
          if (owner === SUI_ZERO_ADDRESS && coinType === NORMALIZED_TREE && amount > 0n) {
            transactionBurnRaw += amount;
          }
        }
        if (transactionBurnRaw > 0n) {
          accumulated += transactionBurnRaw;
          coverage.treeBurnTransactions += 1;
        }
      }

      const pageInfo = record(connection.pageInfo);
      if (pageInfo.hasNextPage !== true) {
        reachedEnd = true;
        cursor = null;
      } else if (typeof pageInfo.endCursor !== 'string'
        || !pageInfo.endCursor
        || pageInfo.endCursor === cursor
        || seenCursors.has(pageInfo.endCursor)) {
        throw new Error(`Burn history cursor was missing or repeated for ${wallet}.`);
      } else {
        cursor = pageInfo.endCursor;
        seenCursors.add(cursor);
      }

      index.wallets[wallet] = {
        burnedTreeRaw: entry.burnedTreeRaw,
        indexedThroughCheckpoint: entry.indexedThroughCheckpoint,
        completeBackfill: false,
        progress: {
          rangeStartCheckpoint: String(rangeStart),
          rangeEndCheckpoint: String(rangeEnd),
          nextCursor: cursor,
          accumulatedBurnedTreeRaw: accumulated.toString(),
        },
      };
      await persistProgress(index, wallet, options, enqueue);
      if (reachedEnd) break;
    }

    if (!reachedEnd) throw new Error(`Burn history did not reach the natural end for ${wallet}.`);
    index.wallets[wallet] = {
      burnedTreeRaw: accumulated.toString(),
      indexedThroughCheckpoint: String(rangeEnd),
      completeBackfill: true,
      progress: null,
    };
    await persistProgress(index, wallet, options, enqueue);
    if (rangeEnd >= latest) return;
  }
}

export async function refreshTreeBurnIndex(
  priorValue: unknown,
  walletValues: string[],
  options: TreeBurnIndexOptions = {},
): Promise<TreeBurnRefreshResult> {
  const now = options.now ?? Date.now;
  const generatedAt = new Date(now()).toISOString();
  const prior = validateTreeBurnIndex(priorValue) ? priorValue : null;
  const wallets = normalizeWallets(walletValues);
  const coverage: TreeBurnRefreshResult['coverage'] = {
    latestCheckpoint: null,
    walletsRequested: wallets.length,
    walletsCompleted: 0,
    pagesScanned: 0,
    transactionsScanned: 0,
    treeBurnTransactions: 0,
    duplicateTransactions: 0,
    malformedTransactions: 0,
    retries: 0,
    reachedEnd: false,
    timeLimitReached: false,
  };
  if (!wallets.length) {
    return {
      outcome: 'error', index: null, coverage,
      warnings: ['The TREE burn index requires the current ranked wallet set.'],
    };
  }

  const getEnv = options.getEnv ?? ((name) => Netlify.env.get(name));
  const creationCheckpointValue = options.creationCheckpoint
    || getEnv('TREE_TOKEN_CREATION_CHECKPOINT')
    || TREE_TOKEN_CREATION_CHECKPOINT;
  const creationCheckpoint = parseCheckpoint(creationCheckpointValue);
  if (creationCheckpoint === null || creationCheckpoint < 1) {
    return {
      outcome: 'error', index: null, coverage,
      warnings: ['TREE_TOKEN_CREATION_CHECKPOINT is invalid.'],
    };
  }

  const endpoint = options.endpoint || getEnv('SUI_GRAPHQL_URL') || DEFAULT_GRAPHQL_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(10_000, Math.trunc(options.maxPagesPerWallet ?? DEFAULT_MAX_PAGES_PER_WALLET)));
  const concurrency = Math.max(1, Math.min(10, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY)));
  const maxRetries = Math.max(0, Math.min(8, Math.trunc(options.maxRetries ?? DEFAULT_MAX_RETRIES)));
  const maxScanMs = Math.max(30_000, Math.trunc(options.maxScanMs ?? DEFAULT_MAX_SCAN_MS));
  const sleepImpl = options.sleepImpl ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = Date.now() + maxScanMs;
  let index: TreeBurnIndex | null = null;
  let persistQueue = Promise.resolve();
  const enqueue = async (work: () => Promise<void>) => {
    persistQueue = persistQueue.then(work, work);
    await persistQueue;
  };

  try {
    const latest = await latestCheckpoint(endpoint, fetchImpl, maxRetries, sleepImpl, coverage, deadline);
    coverage.latestCheckpoint = latest;
    index = copyIndex(prior, generatedAt, String(creationCheckpoint), wallets);
    let nextWallet = 0;
    let failure: Error | null = null;

    const worker = async () => {
      while (!failure) {
        const current = nextWallet;
        nextWallet += 1;
        if (current >= wallets.length) return;
        const wallet = wallets[current];
        try {
          await scanWallet(
            index!,
            wallet,
            Number(latest),
            endpoint,
            fetchImpl,
            pageSize,
            maxPages,
            maxRetries,
            sleepImpl,
            coverage,
            deadline,
            options,
            enqueue,
          );
          coverage.walletsCompleted += 1;
        } catch (error) {
          failure = error instanceof Error ? error : new Error(`Burn history failed for ${wallet}.`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, wallets.length) }, () => worker()));
    await persistQueue;
    if (failure) throw failure;
    index.generatedAt = generatedAt;
    index.indexedThroughCheckpoint = latest;
    coverage.reachedEnd = coverage.walletsCompleted === coverage.walletsRequested
      && wallets.every((wallet) => index!.wallets[wallet]?.completeBackfill
        && index!.wallets[wallet]?.progress === null
        && index!.wallets[wallet]?.indexedThroughCheckpoint === latest);
    if (!coverage.reachedEnd || !validateTreeBurnIndex(index)) {
      return {
        outcome: 'verification-incomplete', index, coverage,
        warnings: ['The TREE burn index failed final completeness or integrity validation.'],
      };
    }
    return {
      outcome: 'complete', index, coverage,
      warnings: [
        `Burned badges use cumulative TREE credited to the Sui zero address in successful transactions sent by each ranked wallet from checkpoint ${creationCheckpoint}.`,
        'Per-wallet page cursors and accumulated TREE totals are persisted so interrupted backfills resume instead of restarting.',
      ],
    };
  } catch (error) {
    await persistQueue;
    const message = error instanceof Error ? error.message : 'TREE burn indexing failed.';
    const incomplete = coverage.timeLimitReached || /natural end|deadline|cursor/i.test(message);
    return {
      outcome: incomplete ? 'verification-incomplete' : 'error',
      index,
      coverage,
      warnings: [message],
    };
  }
}

export function burnEvidenceForWallet(index: TreeBurnIndex, walletValue: string) {
  const wallet = normalizeSuiAddress(walletValue);
  const entry = wallet ? index.wallets[wallet] : null;
  if (!entry
    || !entry.completeBackfill
    || entry.progress !== null
    || entry.indexedThroughCheckpoint !== index.indexedThroughCheckpoint) return null;
  const raw = parseUnsignedRaw(entry.burnedTreeRaw);
  if (raw === null) return null;
  return {
    burnedTreeRaw: raw.toString(),
    burnedTree: formatTreeRaw(raw),
    indexedThroughCheckpoint: entry.indexedThroughCheckpoint,
    qualifies: raw >= BURNED_BADGE_THRESHOLD_RAW,
  };
}
