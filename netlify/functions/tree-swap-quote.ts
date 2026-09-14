import { normalizeTreeSwapQuote, validateSwapRequest } from '../lib/tree-swap-route.ts';
import { quoteTurbosTreeSwap } from '../lib/turbos-tree-swap.ts';

const UPSTREAM_URL = 'https://dex.suidex.org/api/v3/route';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

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
    const [suiDexResult, turbosResult] = await Promise.allSettled([
      fetch(upstream, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json', 'User-Agent': 'TREE-Command-Center/1.0' },
      }).then(async (response) => {
        if (!response.ok) throw new Error(`SuiDex route service returned ${response.status}.`);
        return response.json();
      }),
      withTimeout(quoteTurbosTreeSwap(validated), 12_000, 'The Turbos quote timed out.'),
    ]);
    const suiDexPayload = suiDexResult.status === 'fulfilled' ? suiDexResult.value : {};
    const additionalRoutes = turbosResult.status === 'fulfilled' ? [turbosResult.value] : [];
    const normalized = normalizeTreeSwapQuote(suiDexPayload, { ...validated, generatedAt: new Date().toISOString() }, additionalRoutes);
    if (suiDexResult.status === 'rejected') normalized.warnings.push('SuiDex quotes were temporarily unavailable.');
    if (turbosResult.status === 'rejected') normalized.warnings.push('The Turbos quote was temporarily unavailable.');
    return json(normalized);
  } catch (error) {
    console.error('TREE swap quote failed', error);
    return json({ status: 'error', error: 'quote-unavailable', message: 'The best-route quote is temporarily unavailable.' }, 502);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: '/api/tree-swap-quote' };
