type ChartRange = '24h' | '7d' | '30d';
type Candle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };

const RANGE_CONFIG: Record<ChartRange, { bucket: number; seconds: number; limit: number; days: number }> = {
  '24h': { bucket: 15, seconds: 24 * 60 * 60, limit: 96, days: 1 },
  '7d': { bucket: 60, seconds: 7 * 24 * 60 * 60, limit: 168, days: 7 },
  '30d': { bucket: 240, seconds: 30 * 24 * 60 * 60, limit: 180, days: 30 },
};

function coinIdFromDetailsUrl(apiUrl: string): string | null {
  try { return new URL(apiUrl).searchParams.get('coin_id'); } catch { return null; }
}

function normalizeCandles(payload: unknown) {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const rows = Array.isArray(root.data) ? root.data : Array.isArray(payload) ? payload : [];
  return rows.flatMap((row) => {
    if (!Array.isArray(row) || row.length < 6) return [];
    const values = row.slice(0, 6).map(Number);
    if (!values.every(Number.isFinite)) return [];
    return [{ timestamp: values[0], open: values[1], high: values[2], low: values[3], close: values[4], volume: values[5] }];
  }).sort((a, b) => a.timestamp - b.timestamp);
}

export function sampleChartCandles(candles: Candle[], limit: number) {
  if (candles.length <= limit) return candles;
  const step = Math.ceil(candles.length / limit);
  const sampled = candles.filter((_, index) => index % step === 0);
  const last = candles.at(-1);
  if (last && sampled.at(-1)?.timestamp !== last.timestamp) sampled.push(last);
  return sampled.slice(-limit);
}

export function normalizeCoinGeckoCandles(payload: unknown, limit: number): Candle[] {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const prices = Array.isArray(root.prices) ? root.prices : [];
  const volumes = new Map((Array.isArray(root.total_volumes) ? root.total_volumes : []).flatMap((row) => {
    if (!Array.isArray(row) || row.length < 2) return [];
    const timestamp = Number(row[0]);
    const volume = Number(row[1]);
    return Number.isFinite(timestamp) && Number.isFinite(volume) ? [[timestamp, volume] as const] : [];
  }));
  const candles = prices.flatMap((row) => {
    if (!Array.isArray(row) || row.length < 2) return [];
    const timestamp = Number(row[0]);
    const price = Number(row[1]);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) return [];
    return [{ timestamp, open: price, high: price, low: price, close: price, volume: volumes.get(timestamp) || 0 }];
  }).sort((a, b) => a.timestamp - b.timestamp);
  return sampleChartCandles(candles, limit);
}

async function coinGeckoCandles(config: (typeof RANGE_CONFIG)[ChartRange]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const url = new URL('https://api.coingecko.com/api/v3/coins/thickquidity/market_chart');
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('days', String(config.days));
    url.searchParams.set('precision', 'full');
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`CoinGecko chart returned ${response.status}`);
    const candles = normalizeCoinGeckoCandles(await response.json(), config.limit);
    if (!candles.length) throw new Error('CoinGecko chart returned no TREE prices.');
    return candles;
  } finally {
    clearTimeout(timeout);
  }
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json({ error: 'method-not-allowed' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  }
  const requestedRange = new URL(request.url).searchParams.get('range') || '24h';
  if (!(requestedRange in RANGE_CONFIG)) {
    return Response.json({ error: 'invalid-range', allowed: Object.keys(RANGE_CONFIG) }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const range = requestedRange as ChartRange;
  const generatedAt = new Date().toISOString();
  const apiKey = Netlify.env.get('NOODLES_API_KEY') || '';
  const detailsUrl = Netlify.env.get('NOODLES_API_URL') || '';
  const coinId = detailsUrl ? coinIdFromDetailsUrl(detailsUrl) : null;
  const base = { range, generatedAt };
  if (!apiKey || !coinId) {
    try {
      const candles = await coinGeckoCandles(RANGE_CONFIG[range]);
      return Response.json({ status: 'ok', ...base, source: 'CoinGecko', candles, warnings: ['Noodles OHLCV is not configured; CoinGecko history is shown.'] }, {
        headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' },
      });
    } catch {
      return Response.json({ status: 'not-configured', ...base, source: 'Noodles.fi + CoinGecko', candles: [], warnings: ['Market chart providers are not configured or available.'] }, { headers: { 'Cache-Control': 'no-store' } });
    }
  }
  const config = RANGE_CONFIG[range];
  const to = Math.floor(Date.now() / 1000);
  const url = new URL('https://api.noodles.fi/api/v1/partner/ohlcv');
  url.searchParams.set('coin_id', coinId);
  url.searchParams.set('bucket', String(config.bucket));
  url.searchParams.set('from', String(to - config.seconds));
  url.searchParams.set('to', String(to));
  url.searchParams.set('limit', String(config.limit));
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'x-api-key': apiKey, 'x-chain': 'sui' } });
    if (!response.ok) throw new Error(`Noodles OHLCV returned ${response.status}`);
    const candles = normalizeCandles(await response.json());
    if (candles.length) {
      return Response.json({ status: 'ok', ...base, source: 'Noodles.fi', candles, warnings: [] }, {
        headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' },
      });
    }
    throw new Error('Noodles OHLCV returned no candles for this range.');
  } catch (error) {
    console.error('TREE chart request failed', error);
    try {
      const candles = await coinGeckoCandles(config);
      return Response.json({ status: 'ok', ...base, source: 'CoinGecko', candles, warnings: ['Noodles OHLCV is temporarily unavailable; CoinGecko history is shown.'] }, {
        headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' },
      });
    } catch (fallbackError) {
      console.error('TREE chart fallback failed', fallbackError);
      return Response.json({ status: 'error', ...base, source: 'Noodles.fi + CoinGecko', candles: [], warnings: ['Market chart data is temporarily unavailable.'] }, { headers: { 'Cache-Control': 'no-store' } });
    }
  }
};

export const config = { path: '/api/tree-chart' };
