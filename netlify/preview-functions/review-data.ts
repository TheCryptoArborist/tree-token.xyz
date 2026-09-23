// Preview-only public reads. No credentials, writes, jobs, or wallet signatures
// are forwarded to production. This function is never a production replacement.
export const config = {
  path: [
    '/api/tree-dashboard', '/api/tree-chart', '/api/tree-burn-overview',
    '/api/tree-liquidity', '/api/tree-volume', '/api/tree-nftree',
    '/api/tree-v3-overview', '/api/tree-knowledge-trial',
    '/api/tree-exposure', '/api/tree-badges',
    '/api/tree-exposure-preview', '/api/tree-badges-preview',
  ],
};
const canopyReads: Record<string, string> = {
  '/api/tree-exposure': '/api/tree-exposure',
  '/api/tree-exposure-preview': '/api/tree-exposure',
  '/api/tree-badges': '/api/tree-badges',
  '/api/tree-badges-preview': '/api/tree-badges',
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return new Response('Read-only review preview', { status: 405, headers: { Allow: 'GET' } });
  if (!config.path.includes(url.pathname)) return new Response('Not found', { status: 404 });
  if (url.pathname === '/api/tree-knowledge-trial' && url.searchParams.has('action') && url.searchParams.get('action') !== 'status') {
    return new Response('Only public status is available in this preview', { status: 403 });
  }
  try {
    // Canopy needs no query parameters. Always read the production snapshots,
    // never the preview bootstrap endpoints or caller-supplied destinations.
    const target = canopyReads[url.pathname] || `${url.pathname}${url.search}`;
    const upstream = await fetch(`https://tree-token.xyz${target}`, {
      method: 'GET', credentials: 'omit', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return Response.json({ status: 'unavailable', error: 'Public review data is unavailable' }, { status: 502 });
  }
}
