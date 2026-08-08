import { runLeaderboardBackgroundWorker } from '../lib/leaderboard-background-worker.ts';

export default async (request: Request): Promise<void> => {
  await runLeaderboardBackgroundWorker(request);
};
