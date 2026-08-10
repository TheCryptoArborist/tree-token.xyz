import {
  runTreeSnapshotScheduledTrigger,
  type NetlifyScheduledContext,
} from '../lib/tree-snapshot-scheduled-trigger.ts';

export default async (_request: Request, context: NetlifyScheduledContext): Promise<void> => {
  await runTreeSnapshotScheduledTrigger('badges', context);
};

export const config = {
  schedule: '47 */6 * * *',
};
