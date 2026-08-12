import { normalizeTreeSwapQuote, validateSwapRequest } from '../lib/tree-swap-route.ts';

const UPSTREAM_URL = 'https://dex.suidex.org/api/v3/route';

function json(body: unknown, status = 200, cacheControl = 'no-store') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ status: 'error', error: 'method-not-allowed' }, 405);
  const url = new URL(request.url);
  let validated;
  try {
    validated = validateSwapRequest({
      tokenIn: url.searchParams.get('tokenIn') || '',
      tokenOut: url.searchParams.get('tokenOut') || '',
      amountIn: url.searchParams.get('amountIn') || '',
      slippageBps: Number(url.searchParams.get('slippageBps') || '100'),
    });
  } catch (error) {
    return json({ status: 'error', error: 'invalid-request', message: error instanceof Error ? error.message : 'Invalid request.' }, 400);
  }

  const upstream = new URL(UPSTREAM_URL);
  upstream.searchParams.set('tokenIn', validated.tokenIn);
  upstream.searchParams.set('tokenOut', validated.tokenOut);
  upstream.searchParams.set('amountIn', validated.amountIn);
  upstream.searchParams.set('slippageBps', String(validated.slippageBps));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(upstream, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'TREE-Command-Center/1.0' },
    });
    if (!response.ok) throw new Error(`Route service returned ${response.status}.`);
    const normalized = normalizeTreeSwapQuote(await response.json(), { ...validated, generatedAt: new Date().toISOString() });
    return json(normalized);
  } catch (error) {
    console.error('TREE swap quote failed', error);
    return json({ status: 'error', error: 'quote-unavailable', message: 'The best-route quote is temporarily unavailable.' }, 502);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: '/api/tree-swap-quote' };
