import {
  runLeaderboardScheduledTrigger,
  type NetlifyRuntimeContext,
} from '../lib/leaderboard-scheduled-trigger.ts';

export default async (_request: Request, context: NetlifyRuntimeContext): Promise<void> => {
  await runLeaderboardScheduledTrigger(context);
};

export const config = {
  schedule: '17 */6 * * *',
};
