import {
  TREE_COIN_TYPE,
  normalizeSuiAddress,
} from './leaderboard-provider.ts';
import { SUIDEX_V2_TREE_POOL_ID } from './suidex-v2-tree-lp-provider.ts';
import { TURBOS_TREE_POOL_IDS } from './turbos-tree-lp-provider.ts';

export const TREE_ACTIVITY_METHODOLOGY_VERSION = 'noodles-recognized-tree-pool-trades-v1';
export const DIAMOND_HANDS_BADGE = 'diamond-hands';
export const PAPER_HANDS_BADGE = 'paper-hands';
export const ACCUMULATOR_BADGE = 'accumulator';
export const TREE_ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const TREE_ACTIVITY_MIN_VOLUME_RAW = 100_000_000_000n;
export const TREE_ACTIVITY_ACCUMULATOR_BUYS = 10;
export const SUIDEX_V3_TREE_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
export const RECOGNIZED_TREE_TRADE_POOL_IDS = [
  SUIDEX_V2_TREE_POOL_ID,
  SUIDEX_V3_TREE_POOL_ID,
  ...TURBOS_TREE_POOL_IDS,
] as const;

const DEFAULT_NOODLES_BASE_URL = 'https://api.noodles.fi';
const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_PAGES_PER_POOL = 100;
const TREE_SCALE = 1_000_000;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

type SignedTrade = {
  digest: string;
  wallet: string;
  signedTreeRaw: bigint;
};

export type WalletTradingActivity = {
  buyCount: number;
  sellCount: number;
  buyTreeRaw: string;
  sellTreeRaw: string;
  badges: string[];
};

export type TreeTradingActivityResult = {
  outcome: 'complete' | 'not-configured' | 'verification-incomplete' | 'error';
  generatedAt: string;
  methodologyVersion: typeof TREE_ACTIVITY_METHODOLOGY_VERSION;
  windowStart: string;
  windowEnd: string;
  wallets: Record<string, WalletTradingActivity>;
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
  warnings: string[];
};

export type TreeTradingActivityOptions = {
  fetchImpl?: FetchLike;
  getEnv?: (name: string) => string | undefined;
  now?: () => number;
  poolIds?: readonly string[];
  limit?: number;
  maxPagesPerPool?: number;
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

function decimalTreeToRaw(value: unknown): bigint | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const scaled = Math.round(amount * TREE_SCALE);
  if (!Number.isSafeInteger(scaled) || scaled < 0) return null;
  return BigInt(scaled);
}

function eventDirection(event: JsonRecord): { signedTreeRaw: bigint } | null {
  const coinA = canonicalCoinType(event.coin_a_type);
  const coinB = canonicalCoinType(event.coin_b_type);
  const aToB = event.a_to_b;
  if (typeof aToB !== 'boolean') return null;
  if (coinA === NORMALIZED_TREE) {
    const raw = decimalTreeToRaw(event.amount_a);
    if (raw === null || raw <= 0n) return null;
    return { signedTreeRaw: aToB ? -raw : raw };
  }
  if (coinB === NORMALIZED_TREE) {
    const raw = decimalTreeToRaw(event.amount_b);
    if (raw === null || raw <= 0n) return null;
    return { signedTreeRaw: aToB ? raw : -raw };
  }
  return null;
}

function initialWallets(targets: Set<string>): Record<string, WalletTradingActivity> {
  return Object.fromEntries([...targets].map((wallet) => [wallet, {
    buyCount: 0,
    sellCount: 0,
    buyTreeRaw: '0',
    sellTreeRaw: '0',
    badges: [],
  }]));
}

function failure(
  outcome: TreeTradingActivityResult['outcome'],
  generatedAt: string,
  windowStart: string,
  windowEnd: string,
  targets: Set<string>,
  coverage: TreeTradingActivityResult['coverage'],
  warnings: string[],
): TreeTradingActivityResult {
  return {
    outcome,
    generatedAt,
    methodologyVersion: TREE_ACTIVITY_METHODOLOGY_VERSION,
    windowStart,
    windowEnd,
    wallets: initialWallets(targets),
    coverage,
    warnings,
  };
}

export async function scanTreeTradingActivity(
  walletValues: string[],
  options: TreeTradingActivityOptions = {},
): Promise<TreeTradingActivityResult> {
  const now = options.now ?? Date.now;
  const windowEndMs = now();
  const windowStartMs = windowEndMs - TREE_ACTIVITY_WINDOW_MS;
  const windowEnd = new Date(windowEndMs).toISOString();
  const windowStart = new Date(windowStartMs).toISOString();
  const generatedAt = windowEnd;
  const targets = new Set(walletValues.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)));
  const coverage: TreeTradingActivityResult['coverage'] = {
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
    return failure('not-configured', generatedAt, windowStart, windowEnd, targets, coverage, [
      'TREE trading-activity badges were not calculated because the Noodles API is not configured.',
    ]);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (getEnv('NOODLES_API_BASE_URL') || DEFAULT_NOODLES_BASE_URL).replace(/\/$/, '');
  const poolIds = [...new Set((options.poolIds || RECOGNIZED_TREE_TRADE_POOL_IDS)
    .map(normalizeSuiAddress)
    .filter((value): value is string => Boolean(value)))];
  coverage.poolsRequested = poolIds.length;
  const limit = Math.max(1, Math.min(1_000, Math.trunc(options.limit ?? DEFAULT_LIMIT)));
  const maxPagesPerPool = Math.max(1, Math.min(1_000, Math.trunc(options.maxPagesPerPool ?? DEFAULT_MAX_PAGES_PER_POOL)));
  const signedByTransaction = new Map<string, SignedTrade>();
  const eventKeys = new Set<string>();

  try {
    for (const poolId of poolIds) {
      let cursor: string | null = null;
      let reachedEnd = false;
      const seenCursors = new Set<string>();
      for (let page = 0; page < maxPagesPerPool; page += 1) {
        const url = new URL('/api/v1/partner/pool/event/all', baseUrl);
        url.searchParams.set('pool_address', poolId);
        url.searchParams.set('action', 'buy,sell');
        url.searchParams.set('from', String(windowStartMs));
        url.searchParams.set('to', String(windowEndMs));
        url.searchParams.set('desc', 'true');
        url.searchParams.set('limit', String(limit));
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await fetchImpl(url, {
          headers: { Accept: 'application/json', 'x-api-key': apiKey },
        });
        if (!response.ok) throw new Error(`Noodles pool events returned ${response.status} for ${poolId}.`);
        const rawText = await response.text();
        const payload = record(JSON.parse(rawText));
        const events = Array.isArray(payload.data) ? payload.data : [];
        coverage.pagesScanned += 1;
        coverage.eventsScanned += events.length;
        for (const eventValue of events) {
          const event = record(eventValue);
          const wallet = normalizeSuiAddress(event.sender);
          const digest = typeof event.tx_digest === 'string' ? event.tx_digest.trim() : '';
          const direction = eventDirection(event);
          if (!wallet || !digest || !direction) {
            coverage.malformedEvents += 1;
            continue;
          }
          if (!targets.has(wallet)) continue;
          const eventKey = `${poolId}:${digest}:${String(event.timestamp || '')}:${direction.signedTreeRaw.toString()}`;
          if (eventKeys.has(eventKey)) {
            coverage.duplicateEvents += 1;
            continue;
          }
          eventKeys.add(eventKey);
          const transactionKey = `${wallet}:${digest}`;
          const previous = signedByTransaction.get(transactionKey);
          signedByTransaction.set(transactionKey, {
            digest,
            wallet,
            signedTreeRaw: (previous?.signedTreeRaw || 0n) + direction.signedTreeRaw,
          });
        }

        const cursorMatch = rawText.match(/"last_cursor"\s*:\s*(\d+)/);
        const nextCursor = cursorMatch?.[1] || null;
        if (!nextCursor || events.length === 0) {
          reachedEnd = true;
          break;
        }
        if (seenCursors.has(nextCursor)) throw new Error(`Noodles cursor repeated for ${poolId}.`);
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }
      if (!reachedEnd) {
        return failure('verification-incomplete', generatedAt, windowStart, windowEnd, targets, coverage, [
          `TREE trading-activity verification did not reach the natural end for pool ${poolId}.`,
        ]);
      }
      coverage.poolsCompleted += 1;
    }

    const mutable = new Map<string, { buyCount: number; sellCount: number; buyRaw: bigint; sellRaw: bigint }>();
    for (const wallet of targets) mutable.set(wallet, { buyCount: 0, sellCount: 0, buyRaw: 0n, sellRaw: 0n });
    for (const trade of signedByTransaction.values()) {
      const stats = mutable.get(trade.wallet);
      if (!stats || trade.signedTreeRaw === 0n) continue;
      coverage.tradeTransactions += 1;
      if (trade.signedTreeRaw > 0n) {
        stats.buyCount += 1;
        stats.buyRaw += trade.signedTreeRaw;
      } else {
        stats.sellCount += 1;
        stats.sellRaw += -trade.signedTreeRaw;
      }
    }

    const wallets: Record<string, WalletTradingActivity> = {};
    for (const [wallet, stats] of mutable.entries()) {
      const badges: string[] = [];
      if (stats.sellCount === 0) badges.push(DIAMOND_HANDS_BADGE);
      if (stats.sellRaw > stats.buyRaw && stats.sellRaw >= TREE_ACTIVITY_MIN_VOLUME_RAW) badges.push(PAPER_HANDS_BADGE);
      if (stats.buyCount >= TREE_ACTIVITY_ACCUMULATOR_BUYS
        && stats.buyRaw >= TREE_ACTIVITY_MIN_VOLUME_RAW
        && stats.buyRaw > stats.sellRaw) badges.push(ACCUMULATOR_BADGE);
      wallets[wallet] = {
        buyCount: stats.buyCount,
        sellCount: stats.sellCount,
        buyTreeRaw: stats.buyRaw.toString(),
        sellTreeRaw: stats.sellRaw.toString(),
        badges,
      };
    }
    coverage.reachedEnd = coverage.poolsCompleted === coverage.poolsRequested;
    return {
      outcome: 'complete',
      generatedAt,
      methodologyVersion: TREE_ACTIVITY_METHODOLOGY_VERSION,
      windowStart,
      windowEnd,
      wallets,
      coverage,
      warnings: [
        'Trading-activity badges cover indexed swaps in recognized TREE pools; transfers, LP joins/exits, staking, rewards, and burns are excluded.',
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TREE trading-activity scan failed.';
    return failure('error', generatedAt, windowStart, windowEnd, targets, coverage, [message]);
  }
}
