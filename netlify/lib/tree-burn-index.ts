import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';
import { BURNED_BADGE_THRESHOLD_RAW, formatTreeRaw } from './tree-badge-types.ts';

export const TREE_BURN_INDEX_METHODOLOGY_VERSION = 'sui-sender-burn-checkpoints-v2';
export const SUI_ZERO_ADDRESS = `0x${'0'.repeat(64)}`;
const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES_PER_WALLET = 5_000;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 3;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export type WalletBurnIndexEntry = {
  burnedTreeRaw: string;
  indexedThroughCheckpoint: string;
  completeBackfill: boolean;
};

export type TreeBurnIndex = {
  methodologyVersion: typeof TREE_BURN_INDEX_METHODOLOGY_VERSION;
  generatedAt: string;
  indexedThroughCheckpoint: string;
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
  };
};

export type TreeBurnIndexOptions = {
  fetchImpl?: FetchLike;
  endpoint?: string;
  now?: () => number;
  pageSize?: number;
  maxPagesPerWallet?: number;
  concurrency?: number;
  maxRetries?: number;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  onWalletComplete?: (index: TreeBurnIndex, wallet: string) => Promise<void> | void;
};

const LATEST_CHECKPOINT_QUERY = `query LatestCheckpoint {
  checkpoints(last: 1) { nodes { sequenceNumber } }
}`;

const WALLET_TRANSACTIONS_QUERY = `query WalletTreeBurns($sender: SuiAddress!, $first: Int!, $after: String, $afterCheckpoint: UInt53) {
  transactions(first: $first, after: $after, filter: { sentAddress: $sender, afterCheckpoint: $afterCheckpoint }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      digest
      sender { address }
      effects {
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

export function validateTreeBurnIndex(value: unknown): value is TreeBurnIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const index = value as TreeBurnIndex;
  if (index.methodologyVersion !== TREE_BURN_INDEX_METHODOLOGY_VERSION
    || !validDate(index.generatedAt)
    || typeof index.indexedThroughCheckpoint !== 'string'
    || !/^\d+$/.test(index.indexedThroughCheckpoint)
    || !index.wallets || typeof index.wallets !== 'object') return false;
  for (const [wallet, entry] of Object.entries(index.wallets)) {
    if (normalizeSuiAddress(wallet) !== wallet
      || typeof entry.burnedTreeRaw !== 'string'
      || !/^\d+$/.test(entry.burnedTreeRaw)
      || typeof entry.indexedThroughCheckpoint !== 'string'
      || !/^\d+$/.test(entry.indexedThroughCheckpoint)
      || typeof entry.completeBackfill !== 'boolean') return false;
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
): Promise<JsonRecord> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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
): Promise<string> {
  const payload = await requestGraphql(endpoint, LATEST_CHECKPOINT_QUERY, {}, fetchImpl, maxRetries, sleepImpl, coverage);
  const nodes = record(record(payload.data).checkpoints).nodes;
  const node = Array.isArray(nodes) ? record(nodes[0]) : {};
  const sequence = node.sequenceNumber;
  if ((typeof sequence !== 'string' && typeof sequence !== 'number') || !/^\d+$/.test(String(sequence))) {
    throw new Error('The latest Sui checkpoint could not be resolved.');
  }
  return String(sequence);
}

function copyIndex(prior: TreeBurnIndex | null, generatedAt: string, checkpoint: string): TreeBurnIndex {
  return {
    methodologyVersion: TREE_BURN_INDEX_METHODOLOGY_VERSION,
    generatedAt,
    indexedThroughCheckpoint: checkpoint,
    wallets: Object.fromEntries(Object.entries(prior?.wallets || {}).map(([wallet, entry]) => [wallet, { ...entry }])),
  };
}

async function scanWallet(
  wallet: string,
  prior: WalletBurnIndexEntry | undefined,
  latest: string,
  endpoint: string,
  fetchImpl: FetchLike,
  pageSize: number,
  maxPages: number,
  maxRetries: number,
  sleepImpl: (milliseconds: number) => Promise<void>,
  coverage: TreeBurnRefreshResult['coverage'],
): Promise<WalletBurnIndexEntry> {
  if (prior?.completeBackfill && BigInt(prior.indexedThroughCheckpoint) >= BigInt(latest)) return { ...prior };
  const afterCheckpoint = prior?.completeBackfill ? prior.indexedThroughCheckpoint : null;
  let burnedRaw = prior?.completeBackfill ? BigInt(prior.burnedTreeRaw) : 0n;
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  const seenDigests = new Set<string>();
  let reachedEnd = false;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await requestGraphql(endpoint, WALLET_TRANSACTIONS_QUERY, {
      sender: wallet,
      first: pageSize,
      after: cursor,
      afterCheckpoint,
    }, fetchImpl, maxRetries, sleepImpl, coverage);
    const connection = record(record(payload.data).transactions);
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
    coverage.pagesScanned += 1;
    coverage.transactionsScanned += nodes.length;

    for (const nodeValue of nodes) {
      const node = record(nodeValue);
      const digest = typeof node.digest === 'string' ? node.digest.trim() : '';
      const sender = normalizeSuiAddress(record(node.sender).address);
      const effects = record(node.effects);
      const changes = record(effects.balanceChanges);
      const changeNodes = Array.isArray(changes.nodes) ? changes.nodes : [];
      if (!digest || sender !== wallet || changes.pageInfo && record(changes.pageInfo).hasNextPage === true) {
        coverage.malformedTransactions += 1;
        continue;
      }
      if (seenDigests.has(digest)) {
        coverage.duplicateTransactions += 1;
        continue;
      }
      seenDigests.add(digest);
      let transactionBurnRaw = 0n;
      for (const changeValue of changeNodes) {
        const change = record(changeValue);
        const owner = normalizeSuiAddress(record(change.owner).address);
        const coinType = canonicalCoinType(record(change.coinType).repr);
        const amount = typeof change.amount === 'string' && /^-?\d+$/.test(change.amount)
          ? BigInt(change.amount)
          : null;
        if (owner === SUI_ZERO_ADDRESS && coinType === NORMALIZED_TREE && amount !== null && amount > 0n) {
          transactionBurnRaw += amount;
        }
      }
      if (transactionBurnRaw > 0n) {
        burnedRaw += transactionBurnRaw;
        coverage.treeBurnTransactions += 1;
      }
    }

    const pageInfo = record(connection.pageInfo);
    if (pageInfo.hasNextPage !== true) {
      reachedEnd = true;
      break;
    }
    if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor || seenCursors.has(pageInfo.endCursor)) {
      break;
    }
    seenCursors.add(pageInfo.endCursor);
    cursor = pageInfo.endCursor;
  }

  if (!reachedEnd) throw new Error(`Burn history did not reach the natural end for ${wallet}.`);
  return {
    burnedTreeRaw: burnedRaw.toString(),
    indexedThroughCheckpoint: latest,
    completeBackfill: true,
  };
}

export async function refreshTreeBurnIndex(
  priorValue: unknown,
  walletValues: string[],
  options: TreeBurnIndexOptions = {},
): Promise<TreeBurnRefreshResult> {
  const now = options.now ?? Date.now;
  const generatedAt = new Date(now()).toISOString();
  const prior = validateTreeBurnIndex(priorValue) ? priorValue : null;
  const wallets = [...new Set(walletValues.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)))];
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
  };
  const endpoint = options.endpoint || DEFAULT_GRAPHQL_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(10_000, Math.trunc(options.maxPagesPerWallet ?? DEFAULT_MAX_PAGES_PER_WALLET)));
  const concurrency = Math.max(1, Math.min(10, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY)));
  const maxRetries = Math.max(0, Math.min(8, Math.trunc(options.maxRetries ?? DEFAULT_MAX_RETRIES)));
  const sleepImpl = options.sleepImpl ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  try {
    const latest = await latestCheckpoint(endpoint, fetchImpl, maxRetries, sleepImpl, coverage);
    coverage.latestCheckpoint = latest;
    const index = copyIndex(prior, generatedAt, latest);
    let nextWallet = 0;
    let failure: Error | null = null;

    const worker = async () => {
      while (!failure) {
        const current = nextWallet;
        nextWallet += 1;
        if (current >= wallets.length) return;
        const wallet = wallets[current];
        try {
          index.wallets[wallet] = await scanWallet(
            wallet,
            prior?.wallets[wallet],
            latest,
            endpoint,
            fetchImpl,
            pageSize,
            maxPages,
            maxRetries,
            sleepImpl,
            coverage,
          );
          coverage.walletsCompleted += 1;
          await options.onWalletComplete?.(index, wallet);
        } catch (error) {
          failure = error instanceof Error ? error : new Error(`Burn history failed for ${wallet}.`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, wallets.length || 1) }, () => worker()));
    if (failure) throw failure;
    coverage.reachedEnd = coverage.walletsCompleted === coverage.walletsRequested;
    return {
      outcome: 'complete', index, coverage,
      warnings: [
        'Burned badges use cumulative TREE credited to the Sui zero address in transactions sent by each ranked wallet.',
      ],
    };
  } catch (error) {
    return {
      outcome: 'error', index: null, coverage,
      warnings: [error instanceof Error ? error.message : 'TREE burn indexing failed.'],
    };
  }
}

export function burnEvidenceForWallet(index: TreeBurnIndex, walletValue: string) {
  const wallet = normalizeSuiAddress(walletValue);
  const entry = wallet ? index.wallets[wallet] : null;
  if (!entry || !entry.completeBackfill) return null;
  const raw = BigInt(entry.burnedTreeRaw);
  return {
    burnedTreeRaw: raw.toString(),
    burnedTree: formatTreeRaw(raw),
    indexedThroughCheckpoint: entry.indexedThroughCheckpoint,
    qualifies: raw >= BURNED_BADGE_THRESHOLD_RAW,
  };
}
