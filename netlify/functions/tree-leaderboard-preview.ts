import { resolveDefaultSuinsNames } from '../lib/suins-name-resolver.ts';
import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';

type PreviewDependencies = {
  fetchImpl?: typeof fetch;
  resolveNames?: typeof resolveDefaultSuinsNames;
  productionUrl?: string;
};

function json(value: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

export async function handleTreeLeaderboardPreviewRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  dependencies: PreviewDependencies = {},
) {
  if (request.method !== 'GET') return json({ status: 'error', message: 'Method not allowed.' }, 405);
  if (context?.deploy?.context !== 'deploy-preview') return json({ status: 'error', message: 'Not found.' }, 404);

  const fetchImpl = dependencies.fetchImpl || fetch;
  const resolveNames = dependencies.resolveNames || resolveDefaultSuinsNames;
  const productionUrl = dependencies.productionUrl || 'https://tree-token.xyz/api/tree-leaderboard';
  try {
    const response = await fetchImpl(productionUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) return json({ status: 'error', message: 'Production leaderboard snapshot is unavailable.' }, 502);
    const payload = await response.json() as Record<string, unknown>;
    const entries = Array.isArray(payload.entries) ? payload.entries as Array<Record<string, unknown>> : [];
    const wallets = entries.map((entry) => String(entry.wallet || ''));
    const resolution = await resolveNames(wallets);
    const enriched = entries.map((entry) => {
      const wallet = String(entry.wallet || '').toLowerCase();
      return { ...entry, suinsName: resolution.names[wallet] || null };
    });
    return json({
      ...payload,
      entries: enriched,
      identityResolution: {
        provider: 'sui-graphql-default-suins-name',
        requestedCount: resolution.requestedCount,
        resolvedCount: resolution.resolvedCount,
        complete: resolution.complete,
        generatedAt: resolution.generatedAt,
      },
      warnings: [
        ...(Array.isArray(payload.warnings) ? payload.warnings : []),
        ...(!resolution.complete ? ['Some default SuiNS names could not be resolved for this preview.'] : []),
      ],
    }, 200, 'public, max-age=120, s-maxage=300');
  } catch {
    return json({ status: 'error', message: 'Leaderboard preview enrichment failed.' }, 502);
  }
}

export default async (request: Request, context: NetlifyRuntimeContext) => (
  handleTreeLeaderboardPreviewRequest(request, context)
);

export const config = { path: '/api/tree-leaderboard-preview' };
