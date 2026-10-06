import { createLeaderboardSnapshotResponse } from '../lib/leaderboard-snapshot-endpoint.ts';
import { runLeaderboardBackgroundWorker } from '../lib/leaderboard-background-worker.ts';
import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';

type SnapshotResponseFactory = typeof createLeaderboardSnapshotResponse;
type BackgroundWorker = typeof runLeaderboardBackgroundWorker;

export async function handleTreeLeaderboardRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  createResponse: SnapshotResponseFactory = createLeaderboardSnapshotResponse,
  runWorker: BackgroundWorker = runLeaderboardBackgroundWorker,
) {
  if (request.method === 'POST') {
    const result = await runWorker(request, {
      deployContext: context?.deploy?.context || 'dev',
      deployId: context?.deploy?.id,
    });
    if (!result.accepted) {
      return Response.json({ status: 'error', error: 'refresh-not-authorized' }, {
        status: 401, headers: { 'Cache-Control': 'no-store' },
      });
    }
    return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }
  return createResponse(request, {
    context: context?.deploy?.context || 'dev',
  });
}

export default async (request: Request, context: NetlifyRuntimeContext) => (
  handleTreeLeaderboardRequest(request, context)
);

export const config = { path: '/api/tree-leaderboard' };
