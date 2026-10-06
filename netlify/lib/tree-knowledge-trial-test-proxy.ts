const PRODUCTION_ORIGIN = 'https://tree-token.xyz';
const MAX_REQUEST_BYTES = 16_384;
const MAX_RESPONSE_BYTES = 262_144;

const TRIAL_ACTIONS = new Set([
  'status',
  'practice-submit',
  'eligibility',
  'challenge',
  'start',
  'submit',
  'tiebreak-challenge',
  'tiebreak-start',
  'tiebreak-submit',
]);

type ProxyTarget = 'trial' | 'claim';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function requestLength(request: Request) {
  const value = Number(request.headers.get('content-length') || '0');
  return Number.isFinite(value) ? value : 0;
}

export function createTreeKnowledgeTrialTestProxy(target: ProxyTarget, fetcher: typeof fetch = fetch) {
  return async (request: Request) => {
    const incoming = new URL(request.url);
    const action = incoming.searchParams.get('action') || 'status';
    const allowedMethod = target === 'trial'
      ? ((request.method === 'GET' && action === 'status') || (request.method === 'POST' && TRIAL_ACTIONS.has(action)))
      : request.method === 'POST';

    if (!allowedMethod) return json({ status: 'error', error: 'method-or-action-not-allowed' }, 405);
    if (requestLength(request) > MAX_REQUEST_BYTES) return json({ status: 'error', error: 'request-too-large' }, 413);

    let body: string | undefined;
    if (request.method === 'POST') {
      body = await request.text();
      if (!body || new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
        return json({ status: 'error', error: 'invalid-request' }, 400);
      }
    }

    const upstreamPath = target === 'trial'
      ? `/api/tree-knowledge-trial?action=${encodeURIComponent(action)}`
      : '/api/tree-knowledge-trial-claim';

    try {
      const upstream = await fetcher(`${PRODUCTION_ORIGIN}${upstreamPath}`, {
        method: request.method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await upstream.arrayBuffer();
      if (payload.byteLength > MAX_RESPONSE_BYTES) {
        return json({ status: 'error', error: 'upstream-response-too-large' }, 502);
      }
      return new Response(payload, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex',
        },
      });
    } catch (error) {
      console.error('TREE Knowledge Trial production relay failed', error);
      return json({
        status: 'error',
        error: 'knowledge-trial-service-unavailable',
        message: 'The live Knowledge Trial service is temporarily unavailable. Please try again shortly.',
      }, 502);
    }
  };
}

