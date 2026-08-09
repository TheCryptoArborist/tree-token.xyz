import {
  TREE_COIN_TYPE,
  normalizeSuiAddress,
} from './leaderboard-provider.ts';

export const TREE_BURN_METHODOLOGY_VERSION = 'zero-address-tree-balance-changes-v1';
export const BURNED_BADGE = 'burned';
export const BURNED_BADGE_THRESHOLD_RAW = 500_000_000_000n;
export const SUI_ZERO_ADDRESS = `0x${'0'.repeat(64)}`;

const DEFAULT_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 2_000;
const DEFAULT_MAX_SCAN_MS = 120_000;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

const BURN_TRANSACTION_QUERY = `query TreeBurnTransactions($first: Int!, $after: String, $zero: SuiAddress!) {
  transactions(first: $first, after: $after, filter: { affectedAddress: $zero }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      digest
      sender { address }
      effects {
        balanceChanges(first: 50) {
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

export type WalletBurnActivity = {
  burnedTreeRaw: string;
  qualifies: boolean;
};

export type TreeBurnBadgeResult = {
  outcome: 'complete' | 'verification-incomplete' | 'error';
  generatedAt: string;
  methodologyVersion: typeof TREE_BURN_METHODOLOGY_VERSION;
  wallets: Record<string, WalletBurnActivity>;
  coverage: {
    pagesScanned: number;
    transactionsScanned: number;
    treeBurnTransactions: number;
    duplicateTransactions: number;
    malformedTransactions: number;
    reachedEnd: boolean;
    timeLimitReached: boolean;
    graphqlErrors: string[];
    networkError: string | null;
  };
  warnings: string[];
};

export type TreeBurnBadgeOptions = {
  fetchImpl?: FetchLike;
  endpoint?: string;
  now?: () => number;
  pageSize?: number;
  maxPages?: number;
  maxScanMs?: number;
  getEnv?: (name: string) => string | undefined;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
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

function initialWallets(targets: Set<string>): Record<string, WalletBurnActivity> {
  return Object.fromEntries([...targets].map((wallet) => [wallet, {
    burnedTreeRaw: '0',
    qualifies: false,
  }]));
}

function finish(
  outcome: TreeBurnBadgeResult['outcome'],
  generatedAt: string,
  targets: Set<string>,
  totals: Map<string, bigint>,
  coverage: TreeBurnBadgeResult['coverage'],
  warnings: string[],
): TreeBurnBadgeResult {
  const wallets = initialWallets(targets);
  if (outcome === 'complete') {
    for (const wallet of targets) {
      const raw = totals.get(wallet) || 0n;
      wallets[wallet] = {
        burnedTreeRaw: raw.toString(),
        qualifies: raw >= BURNED_BADGE_THRESHOLD_RAW,
      };
    }
  }
  return {
    outcome,
    generatedAt,
    methodologyVersion: TREE_BURN_METHODOLOGY_VERSION,
    wallets,
    coverage,
    warnings,
  };
}

export async function scanTreeBurnContributions(
  walletValues: string[],
  options: TreeBurnBadgeOptions = {},
): Promise<TreeBurnBadgeResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const generatedAt = new Date(startedAt).toISOString();
  const targets = new Set(walletValues.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)));
  const totals = new Map<string, bigint>();
  const coverage: TreeBurnBadgeResult['coverage'] = {
    pagesScanned: 0,
    transactionsScanned: 0,
    treeBurnTransactions: 0,
    duplicateTransactions: 0,
    malformedTransactions: 0,
    reachedEnd: false,
    timeLimitReached: false,
    graphqlErrors: [],
    networkError: null,
  };
  const getEnv = options.getEnv ?? ((name) => Netlify.env.get(name));
  const enabled = Boolean(options.fetchImpl) || (getEnv('TREE_BURN_BADGES_ENABLED') || '').trim().toLowerCase() === 'true';
  if (!enabled) {
    return finish('verification-incomplete', generatedAt, targets, totals, coverage, [
      'Lifetime TREE burn verification is disabled for this environment.',
    ]);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint || DEFAULT_GRAPHQL_URL;
  const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(10_000, Math.trunc(options.maxPages ?? DEFAULT_MAX_PAGES)));
  const maxScanMs = Math.max(1_000, Math.trunc(options.maxScanMs ?? DEFAULT_MAX_SCAN_MS));
  const seenDigests = new Set<string>();
  let after: string | null = null;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      if (now() - startedAt >= maxScanMs) {
        coverage.timeLimitReached = true;
        return finish('verification-incomplete', generatedAt, targets, totals, coverage, [
          'TREE burn verification reached its bounded scan deadline before natural completion.',
        ]);
      }
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: BURN_TRANSACTION_QUERY,
          variables: { first: pageSize, after, zero: SUI_ZERO_ADDRESS },
        }),
      });
      if (!response.ok) throw new Error(`Sui GraphQL burn scan returned ${response.status}.`);
      const payload = record(await response.json());
      const errors = Array.isArray(payload.errors) ? payload.errors : [];
      if (errors.length) {
        coverage.graphqlErrors = errors.map((value) => String(record(value).message || 'Sui GraphQL error'));
        return finish('error', generatedAt, targets, totals, coverage, coverage.graphqlErrors);
      }
      const connection = record(record(payload.data).transactions);
      const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
      coverage.pagesScanned += 1;
      coverage.transactionsScanned += nodes.length;
      for (const nodeValue of nodes) {
        const node = record(nodeValue);
        const digest = typeof node.digest === 'string' ? node.digest.trim() : '';
        if (!digest) {
          coverage.malformedTransactions += 1;
          continue;
        }
        if (seenDigests.has(digest)) {
          coverage.duplicateTransactions += 1;
          continue;
        }
        seenDigests.add(digest);
        const sender = normalizeSuiAddress(record(node.sender).address);
        const changes = record(record(node.effects).balanceChanges);
        const changeNodes = Array.isArray(changes.nodes) ? changes.nodes : [];
        let burnedRaw = 0n;
        for (const changeValue of changeNodes) {
          const change = record(changeValue);
          const owner = normalizeSuiAddress(record(change.owner).address);
          const coinType = canonicalCoinType(record(change.coinType).repr);
          const amount = typeof change.amount === 'string' && /^-?\d+$/.test(change.amount)
            ? BigInt(change.amount)
            : null;
          if (owner === SUI_ZERO_ADDRESS && coinType === NORMALIZED_TREE && amount !== null && amount > 0n) {
            burnedRaw += amount;
          }
        }
        if (burnedRaw <= 0n) continue;
        coverage.treeBurnTransactions += 1;
        if (!sender) {
          coverage.malformedTransactions += 1;
          continue;
        }
        if (targets.has(sender)) totals.set(sender, (totals.get(sender) || 0n) + burnedRaw);
      }
      const pageInfo = record(connection.pageInfo);
      if (pageInfo.hasNextPage !== true) {
        coverage.reachedEnd = true;
        return finish('complete', generatedAt, targets, totals, coverage, [
          'Burned badges are based on cumulative TREE credited to the Sui zero address by the transaction sender.',
        ]);
      }
      if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor || pageInfo.endCursor === after) {
        return finish('verification-incomplete', generatedAt, targets, totals, coverage, [
          'TREE burn verification could not continue because the transaction cursor was missing or repeated.',
        ]);
      }
      after = pageInfo.endCursor;
    }
    return finish('verification-incomplete', generatedAt, targets, totals, coverage, [
      'TREE burn verification reached its page limit before natural completion.',
    ]);
  } catch (error) {
    coverage.networkError = error instanceof Error ? error.message : 'TREE burn verification failed.';
    return finish('error', generatedAt, targets, totals, coverage, [coverage.networkError]);
  }
}