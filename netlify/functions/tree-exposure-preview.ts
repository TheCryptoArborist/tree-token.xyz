import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';
import { proxyProductionSnapshotForPreview } from '../lib/production-snapshot-preview.ts';
import { resolveDefaultSuinsNames } from '../lib/suins-name-resolver.ts';

type ExposurePreviewDependencies = {
  fetchImpl?: typeof fetch;
  resolveNames?: typeof resolveDefaultSuinsNames;
};

function json(value: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

export async function handleTreeExposurePreviewRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  dependencies: ExposurePreviewDependencies = {},
) {
  const response = await proxyProductionSnapshotForPreview(
    request,
    context,
    'https://tree-token.xyz/api/tree-exposure',
    'TREE exposure',
    { fetchImpl: dependencies.fetchImpl },
  );
  if (!response.ok) return response;

  const payload = await response.json() as Record<string, unknown>;
  const entries = Array.isArray(payload.entries) ? payload.entries as Array<Record<string, unknown>> : [];
  if (!entries.length) return json(payload, 200, 'public, max-age=60, s-maxage=120');
  try {
    const resolveNames = dependencies.resolveNames || resolveDefaultSuinsNames;
    const resolution = await resolveNames(entries.map((entry) => String(entry.wallet || '')));
    const enriched = entries.map((entry) => {
      const wallet = String(entry.wallet || '').toLowerCase();
      return { ...entry, suinsName: resolution.names[wallet] || null };
    });
    return json({
      ...payload,
      entries: enriched,
      identityResolution: {
        provider: 'sui-grpc-reverse-name-record',
        requestedCount: resolution.requestedCount,
        resolvedCount: resolution.resolvedCount,
        complete: resolution.complete,
        generatedAt: resolution.generatedAt,
      },
      warnings: [
        ...(Array.isArray(payload.warnings) ? payload.warnings : []),
        ...(!resolution.complete ? ['Some SuiNS identities could not be resolved for this preview.'] : []),
      ],
    }, 200, resolution.complete ? 'public, max-age=120, s-maxage=300' : 'no-store');
  } catch {
    return json({
      ...payload,
      entries,
      warnings: [
        ...(Array.isArray(payload.warnings) ? payload.warnings : []),
        'SuiNS identity enrichment was unavailable for this preview.',
      ],
    });
  }
}

export default async (request: Request, context: NetlifyRuntimeContext) => (
  handleTreeExposurePreviewRequest(request, context)
);

export const config = { path: '/api/tree-exposure-preview' };
