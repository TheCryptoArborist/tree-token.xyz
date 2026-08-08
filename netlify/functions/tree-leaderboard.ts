import { createLeaderboardSnapshotResponse } from '../lib/leaderboard-snapshot-endpoint.ts';

export default async (request: Request) => createLeaderboardSnapshotResponse(request);

export const config = { path: '/api/tree-leaderboard' };
