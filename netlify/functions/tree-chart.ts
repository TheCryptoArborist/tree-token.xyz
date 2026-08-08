type ChartRange = '24h' | '7d' | '30d';

const RANGE_CONFIG: Record<ChartRange, { bucket: number; seconds: number; limit: number }> = {
  '24h': { bucket: 15, seconds: 24 * 60 * 60, limit: 96 },
  '7d': { bucket: 60, seconds: 7 * 24 * 60 * 60, limit: 168 },
  '30d': { bucket: 240, seconds: 30 * 24 * 60 * 60, limit: 180 },
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
  const base = { range, generatedAt, source: 'Noodles.fi' as const };
  if (!apiKey || !coinId) {
    return Response.json({ status: 'not-configured', ...base, candles: [], warnings: ['Noodles OHLCV is not configured.'] }, { headers: { 'Cache-Control': 'no-store' } });
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
    return Response.json({ status: 'ok', ...base, candles, warnings: candles.length ? [] : ['Noodles OHLCV returned no candles for this range.'] }, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('TREE chart request failed', error);
    return Response.json({ status: 'error', ...base, candles: [], warnings: ['Noodles OHLCV is temporarily unavailable.'] }, { headers: { 'Cache-Control': 'no-store' } });
  }
};

export const config = { path: '/api/tree-chart' };
