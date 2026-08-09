import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';
import {
  TREE_ACTIVITY_ACCUMULATOR_BUYS,
  TREE_ACTIVITY_MIN_VOLUME_RAW,
  TREE_ACTIVITY_WINDOW_MS
} from './tree-badge-types.ts';
import { formatTreeRaw } from './tree-exposure-types.ts';

export const TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION = 'noodles-tree-trade-ledger-v2';
const DEFAULT_NOODLES_BASE_URL = 'https://api.noodles.fi';
const DEFAULT_EVENT_LIMIT = 100;
const DEFAULT_MAX_PAGES_PER_POOL = 500;
const TREE_SCALE = 1_000_000;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export type IndexedTreeTrade = {
  wallet: string;
  digest: string;
  timestamp: number;
  legs: Record<string, string>;
};

export type TreeActivityPoolCursor = {
  protocol: string;
  indexedThroughMs: number;
};

export type TreeActivityIndex = {
  methodologyVersion: typeof TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  pools: Record<string, TreeActivityPoolCursor>;
  transactions: Record<string, IndexedTreeTrade>;
};

export type TreeActivityRefreshResult = {
  outcome: 'complete' | 'not-configured' | 'verification-incomplete' | 'error';
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
    reachedEnd: boolean;
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
  limit?: number;
  maxPagesPerPool?: number;
  onPoolComplete?: (index: TreeActivityIndex) => Promise<void> | void;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function canonicalCoinType(value: unknown): string | null {
  if (value && typeof value === 'object') return canonicalCoinType(record(value).coin_type);
  if (typeof value !== 'string') return null;
  const parts = value.trim().toLowerCase().split('::');
  if (parts.length !== 3) return null;
  const address = parts[0].replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(address)) return null;
  return `0x${address.padStart(64, '0')}::${parts[1]}::${parts[2]}`;
}

const NORMALIZED_TREE = canonicalCoinType(TREE_COIN_TYPE)!;

function decimalTreeToRaw(value: unknown): bigint | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const scaled = Math.round(amount * TREE_SCALE);
  return Number.isSafeInteger(scaled) && scaled >= 0 ? BigInt(scaled) : null;
}

function signedTreeLeg(event: JsonRecord): bigint | null {
  const coinA = canonicalCoinType(event.coin_a_type);
  const coinB = canonicalCoinType(event.coin_b_type);
  const aToB = event.a_to_b;
  if (typeof aToB !== 'boolean') return null;
  if (coinA === NORMALIZED_TREE) {
    const raw = decimalTreeToRaw(event.amount_a);
    if (raw === null || raw <= 0n) return null;
    return aToB ? -raw : raw;
  }
  if (coinB === NORMALIZED_TREE) {
    const raw = decimalTreeToRaw(event.amount_b);
    if (raw === null || raw <= 0n) return null;
    return aToB ? raw : -raw;
  }
  return null;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function validateTreeActivityIndex(value: unknown): value is TreeActivityIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const index = value as TreeActivityIndex;
  if (index.methodologyVersion !== TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION
    || !validDate(index.generatedAt)
    || !validDate(index.windowStart)
    || !validDate(index.windowEnd)
    || Date.parse(index.windowStart) >= Date.parse(index.windowEnd)
    || !index.pools || typeof index.pools !== 'object'
    || !index.transactions || typeof index.transactions !== 'object') return false;
  for (const [poolId, pool] of Object.entries(index.pools)) {
    if (normalizeSuiAddress(poolId) !== poolId
      || typeof pool.protocol !== 'string'
      || !Number.isSafeInteger(pool.indexedThroughMs)
      || pool.indexedThroughMs < 0) return false;
  }
  for (const [key, transaction] of Object.entries(index.transactions)) {
    if (typeof key !== 'string'
      || normalizeSuiAddress(transaction.wallet) !== transaction.wallet
      || typeof transaction.digest !== 'string'
      || !transaction.digest
      || !Number.isSafeInteger(transaction.timestamp)
      || transaction.timestamp < 0
      || !transaction.legs
      || typeof transaction.legs !== 'object') return false;
    for (const [poolId, raw] of Object.entries(transaction.legs)) {
      if (normalizeSuiAddress(poolId) !== poolId
        || typeof raw !== 'string'
        || !/^-?\d+$/.test(raw)) return false;
    }
  }
  return true;
}

function copyIndex(prior: TreeActivityIndex | null, windowStartMs: number, windowEndMs: number): TreeActivityIndex {
  const transactions: Record<string, IndexedTreeTrade> = {};
  if (prior) {
    for (const [key, transaction] of Object.entries(prior.transactions)) {
      if (transaction.timestamp >= windowStartMs && transaction.timestamp <= windowEndMs) {
        transactions[key] = { ...transaction, legs: { ...transaction.legs } };
      }
    }
  }
  return {
    methodologyVersion: TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION,
    generatedAt: new Date(windowEndMs).toISOString(),
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    pools: Object.fromEntries(Object.entries(prior?.pools || {}).map(([poolId, pool]) => [poolId, { ...pool }])),
    transactions,
  };
}

async function discoverTreePools(
  baseUrl: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<Array<{ poolId: string; protocol: string }>> {
  const url = new URL('/api/v1/partner/coin/liquidity', baseUrl);
  url.searchParams.set('coin_type', TREE_COIN_TYPE);
  url.searchParams.set('pool_type', 'dex');
  url.searchParams.set('limit', '100');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'x-api-key': apiKey, 'x-chain': 'sui' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Noodles TREE liquidity discovery returned ${response.status}.`);
  const payload = record(JSON.parse(text));
  const data = record(payload.data);
  const pools = Array.isArray(data.dex_liquidity) ? data.dex_liquidity : [];
  const discovered = new Map<string, string>();
  for (const poolValue of pools) {
    const pool = record(poolValue);
    const poolId = normalizeSuiAddress(pool.pool_id);
    const coinA = canonicalCoinType(pool.coin_a);
    const coinB = canonicalCoinType(pool.coin_b);
    if (!poolId || (coinA !== NORMALIZED_TREE && coinB !== NORMALIZED_TREE)) continue;
    discovered.set(poolId, typeof pool.protocol === 'string' ? pool.protocol : 'unknown');
  }
  if (!discovered.size) throw new Error('Noodles returned no indexed TREE liquidity pools.');
  return [...discovered.entries()].map(([poolId, protocol]) => ({ poolId, protocol }));
}

function nextCursorFromText(text: string): string | null {
  const match = text.match(/"last_cursor"\s*:\s*(?:"(\d+)"|(\d+))/);
  return match?.[1] || match?.[2] || null;
}

export async function refreshTreeActivityIndex(
  priorValue: unknown,
  options: TreeActivityIndexOptions = {},
): Promise<TreeActivityRefreshResult> {
  const now = options.now ?? Date.now;
  const windowEndMs = now();
  const windowStartMs = windowEndMs - TREE_ACTIVITY_WINDOW_MS;
  const prior = validateTreeActivityIndex(priorValue) ? priorValue : null;
  const index = copyIndex(prior, windowStartMs, windowEndMs);
  const coverage: TreeActivityRefreshResult['coverage'] = {
    poolsRequested: 0,
    poolsCompleted: 0,
    pagesScanned: 0,
    eventsScanned: 0,
    tradeTransactions: 0,
    duplicateEvents: 0,
    malformedEvents: 0,
    reachedEnd: false,
  };
  const getEnv = options.getEnv ?? ((name) => Netlify.env.get(name));
  const apiKey = (getEnv('NOODLES_API_KEY') || '').trim();
  if (!apiKey) {
    return {
      outcome: 'not-configured', index: null, coverage,
      warnings: ['The 30-day TREE activity index requires the server-side Noodles API key.'],
    };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (getEnv('NOODLES_API_BASE_URL') || DEFAULT_NOODLES_BASE_URL).replace(/\/$/, '');
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? DEFAULT_EVENT_LIMIT)));
  const maxPages = Math.max(1, Math.min(2_000, Math.trunc(options.maxPagesPerPool ?? DEFAULT_MAX_PAGES_PER_POOL)));
  const eventFingerprints = new Set<string>();

  try {
    const discovered = await discoverTreePools(baseUrl, apiKey, fetchImpl);
    const pools = new Map<string, string>(Object.entries(prior?.pools || {}).map(([poolId, pool]) => [poolId, pool.protocol]));
    for (const pool of discovered) pools.set(pool.poolId, pool.protocol);
    coverage.poolsRequested = pools.size;

    for (const [poolId, protocol] of pools.entries()) {
      const previousThrough = prior?.pools[poolId]?.indexedThroughMs;
      const fromMs = previousThrough === undefined
        ? windowStartMs
        : Math.max(windowStartMs, previousThrough + 1);
      let cursor: string | null = null;
      let reachedEnd = fromMs > windowEndMs;
      const seenCursors = new Set<string>();

      for (let page = 0; !reachedEnd && page < maxPages; page += 1) {
        const url = new URL('/api/v1/partner/pool/event/all', baseUrl);
        url.searchParams.set('pool_address', poolId);
        url.searchParams.set('action', 'buy,sell');
        url.searchParams.set('from', String(fromMs));
        url.searchParams.set('to', String(windowEndMs));
        url.searchParams.set('desc', 'true');
        url.searchParams.set('limit', String(limit));
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await fetchImpl(url, {
          headers: { Accept: 'application/json', 'x-api-key': apiKey },
        });
        const text = await response.text();
        if (!response.ok) {
          let detail = '';
          try {
            const errorPayload = record(JSON.parse(text));
            if (typeof errorPayload.message === 'string') detail = `: ${errorPayload.message}`;
          } catch { /* status-only fallback */ }
          throw new Error(`Noodles pool events returned ${response.status} for ${poolId}${detail}.`);
        }
        const payload = record(JSON.parse(text));
        const events = Array.isArray(payload.data) ? payload.data : [];
        coverage.pagesScanned += 1;
        coverage.eventsScanned += events.length;

        for (const eventValue of events) {
          const event = record(eventValue);
          const wallet = normalizeSuiAddress(event.sender);
          const digest = typeof event.tx_digest === 'string' ? event.tx_digest.trim() : '';
          const timestamp = Number(event.timestamp);
          const leg = signedTreeLeg(event);
          if (!wallet || !digest || !Number.isSafeInteger(timestamp) || timestamp < fromMs || timestamp > windowEndMs || leg === null) {
            coverage.malformedEvents += 1;
            continue;
          }
          const fingerprint = `${poolId}:${digest}:${timestamp}:${leg.toString()}`;
          if (eventFingerprints.has(fingerprint)) {
            coverage.duplicateEvents += 1;
            continue;
          }
          eventFingerprints.add(fingerprint);
          const key = `${wallet}:${digest}`;
          const transaction = index.transactions[key] || { wallet, digest, timestamp, legs: {} };
          transaction.timestamp = Math.min(transaction.timestamp, timestamp);
          transaction.legs[poolId] = ((BigInt(transaction.legs[poolId] || '0')) + leg).toString();
          index.transactions[key] = transaction;
        }

        const nextCursor = nextCursorFromText(text);
        if (!nextCursor || events.length === 0) {
          reachedEnd = true;
          break;
        }
        if (seenCursors.has(nextCursor)) throw new Error(`Noodles cursor repeated for ${poolId}.`);
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }

      if (!reachedEnd) {
        return {
          outcome: 'verification-incomplete', index: null, coverage,
          warnings: [`The TREE activity index did not reach the natural end for ${poolId}.`],
        };
      }
      index.pools[poolId] = { protocol, indexedThroughMs: windowEndMs };
      coverage.poolsCompleted += 1;
      await options.onPoolComplete?.(index);
    }

    coverage.tradeTransactions = Object.keys(index.transactions).length;
    coverage.reachedEnd = coverage.poolsCompleted === coverage.poolsRequested;
    return {
      outcome: 'complete', index, coverage,
      warnings: [
        'The rolling activity index includes Noodles-indexed TREE swaps and excludes transfers, LP joins/exits, staking, rewards, and burns.',
      ],
    };
  } catch (error) {
    return {
      outcome: 'error', index: null, coverage,
      warnings: [error instanceof Error ? error.message : 'TREE activity indexing failed.'],
    };
  }
}

export function summarizeTreeActivity(
  index: TreeActivityIndex,
  walletValues: string[],
): Record<string, WalletActivitySummary> {
  const wallets = [...new Set(walletValues.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)))];
  const mutable = new Map(wallets.map((wallet) => [wallet, { buyCount: 0, sellCount: 0, buyRaw: 0n, sellRaw: 0n }]));
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
