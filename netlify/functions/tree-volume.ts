import { TREE_VOLUME_SOURCES, parseVolumeTransaction, type VolumePrices, type VolumeSource } from '../lib/tree-volume-overview.ts';

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const PAGE_SIZE = 50;
const MAX_PAGES_PER_POOL = 20;
const QUERY = `query RecentPoolTransactions($pool: SuiAddress!, $last: Int!, $before: String) {
  transactions(last: $last, before: $before, filter: { affectedObject: $pool }) {
    pageInfo { hasPreviousPage startCursor }
    nodes {
      digest
      effects {
        status timestamp
        events(first: 50) {
          pageInfo { hasNextPage }
          nodes { contents { type { repr } json } }
        }
      }
    }
  }
}`;

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }

async function requestPool(source: VolumeSource, prices: VolumePrices, start: number, end: number) {
  let before: string | null = null;
  let volumeUsd = 0;
  let swaps = 0;
  let transactions = 0;
  let pages = 0;
  let complete = false;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES_PER_POOL; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let response: Response;
    try {
      response = await fetch(GRAPHQL_URL, {
        method: 'POST', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { pool: source.poolId, last: PAGE_SIZE, before } }),
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error(`Sui GraphQL returned HTTP ${response.status}.`);
    const payload = record(await response.json());
    if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('Sui GraphQL returned transaction errors.');
    const connection = record(record(payload.data).transactions);
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
    pages += 1;
    let oldest = Number.POSITIVE_INFINITY;
    for (const nodeValue of nodes) {
      const node = record(nodeValue);
      const digest = typeof node.digest === 'string' ? node.digest : '';
      const timestamp = Date.parse(String(record(node.effects).timestamp || ''));
      if (Number.isFinite(timestamp)) oldest = Math.min(oldest, timestamp);
      if (!digest || seen.has(digest)) continue;
      seen.add(digest);
      const parsed = parseVolumeTransaction(node, source, prices, start, end);
      if (!parsed) continue;
      volumeUsd += parsed.volumeUsd;
      swaps += parsed.swaps;
      transactions += 1;
    }
    const pageInfo = record(connection.pageInfo);
    if (pageInfo.hasPreviousPage !== true || oldest <= start) { complete = true; break; }
    const cursor = typeof pageInfo.startCursor === 'string' ? pageInfo.startCursor : '';
    if (!cursor || cursor === before) throw new Error('Sui transaction cursor was missing or repeated.');
    before = cursor;
  }
  if (!complete) throw new Error(`The 24-hour scan exceeded its verified bound for ${source.poolId}.`);
  return { source, volumeUsd, swaps, transactions, pages };
}

async function getPrices(): Promise<VolumePrices> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const result = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=sui,bitcoin,usd-coin&vs_currencies=usd', { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!result.ok) throw new Error(`CoinGecko returned HTTP ${result.status}.`);
    const payload = record(await result.json());
    const prices = { suiUsd: Number(record(payload.sui).usd), wbtcUsd: Number(record(payload.bitcoin).usd), usdcUsd: Number(record(payload['usd-coin']).usd) };
    if (Object.values(prices).some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Volume reference prices were incomplete.');
    return prices;
  } finally { clearTimeout(timeout); }
}

function response(body: unknown, status = 200, cache = 'public, max-age=30, s-maxage=60, stale-while-revalidate=120') {
  return Response.json(body, { status, headers: { 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
}

export default async (request: Request) => {
  if (request.method !== 'GET') return response({ status: 'error', error: 'method-not-allowed' }, 405, 'no-store');
  const windowEndMs = Date.now();
  const windowStartMs = windowEndMs - 24 * 60 * 60 * 1000;
  try {
    const prices = await getPrices();
    const results = await Promise.all(TREE_VOLUME_SOURCES.map((source) => requestPool(source, prices, windowStartMs, windowEndMs)));
    const venues = { suiDexV2: 0, suiDexV3: 0, turbos: 0 };
    let swaps = 0;
    let transactions = 0;
    let pages = 0;
    for (const result of results) {
      venues[result.source.venue] += result.volumeUsd;
      swaps += result.swaps; transactions += result.transactions; pages += result.pages;
    }
    const volume24hUsd = venues.suiDexV2 + venues.suiDexV3 + venues.turbos;
    return response({
      status: 'ok', generatedAt: new Date(windowEndMs).toISOString(), network: 'sui-mainnet',
      source: 'Verified Sui Mainnet swap events', methodology: 'recognized-tree-swap-volume-v1',
      windowStart: new Date(windowStartMs).toISOString(), windowEnd: new Date(windowEndMs).toISOString(),
      volume24hUsd, venues, prices, coverage: { poolsChecked: TREE_VOLUME_SOURCES.length, swaps, transactions, pages, complete: true },
      warnings: ['USD volume uses the non-TREE side of each successful recognized swap and current external reference prices.'],
    });
  } catch (error) {
    console.error('TREE volume overview failed:', error);
    return response({ status: 'error', generatedAt: new Date().toISOString(), error: 'volume-verification-unavailable', message: error instanceof Error ? error.message : String(error) }, 503, 'no-store');
  }
};

export const config = { path: '/api/tree-volume' };
