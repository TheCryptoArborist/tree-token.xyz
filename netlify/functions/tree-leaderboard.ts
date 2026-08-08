import { createLeaderboardSnapshotResponse } from '../lib/leaderboard-snapshot-endpoint.ts';
import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';

type SnapshotResponseFactory = typeof createLeaderboardSnapshotResponse;

export async function handleTreeLeaderboardRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  createResponse: SnapshotResponseFactory = createLeaderboardSnapshotResponse,
) {
  return createResponse(request, {
    context: context?.deploy?.context || 'dev',
  });
}

export default async (request: Request, context: NetlifyRuntimeContext) => (
  handleTreeLeaderboardRequest(request, context)
);

export const config = { path: '/api/tree-leaderboard' };
