import { runLeaderboardBackgroundWorker } from '../lib/leaderboard-background-worker.ts';
import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';

type BackgroundWorker = typeof runLeaderboardBackgroundWorker;

export async function handleTreeLeaderboardBackgroundRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  runWorker: BackgroundWorker = runLeaderboardBackgroundWorker,
): Promise<void> {
  await runWorker(request, {
    deployContext: context?.deploy?.context || 'dev',
    deployId: context?.deploy?.id,
  });
}

export default async (request: Request, context: NetlifyRuntimeContext): Promise<void> => {
  await handleTreeLeaderboardBackgroundRequest(request, context);
};
