import type { NetlifyRuntimeContext } from './leaderboard-scheduled-trigger.ts';

type SnapshotPreviewDependencies = {
  fetchImpl?: typeof fetch;
};

function json(value: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
    },
  });
}

export async function proxyProductionSnapshotForPreview(
  request: Request,
  context: NetlifyRuntimeContext,
  productionUrl: string,
  label: string,
  dependencies: SnapshotPreviewDependencies = {},
) {
  if (request.method !== 'GET') return json({ status: 'error', message: 'Method not allowed.' }, 405);
  if (context?.deploy?.context !== 'deploy-preview') return json({ status: 'error', message: 'Not found.' }, 404);

  const fetchImpl = dependencies.fetchImpl || fetch;
  try {
    const response = await fetchImpl(productionUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) return json({ status: 'error', message: `Production ${label} snapshot is unavailable.` }, 502);
    const payload = await response.json() as Record<string, unknown>;
    return json({
      ...payload,
      previewSource: 'production-complete-snapshot',
      previewMessage: `Deploy Preview is displaying the current public production ${label} snapshot for review.`,
      warnings: [
        ...(Array.isArray(payload.warnings) ? payload.warnings : []),
        `Deploy Preview is displaying the current public production ${label} snapshot for review.`,
      ],
    }, 200, 'public, max-age=60, s-maxage=120');
  } catch {
    return json({ status: 'error', message: `Production ${label} preview proxy failed.` }, 502);
  }
}
