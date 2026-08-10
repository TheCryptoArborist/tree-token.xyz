import {
  runTreeSnapshotScheduledTrigger,
  type NetlifyScheduledContext,
} from '../lib/tree-snapshot-scheduled-trigger.ts';

export default async (_request: Request, context: NetlifyScheduledContext): Promise<void> => {
  await runTreeSnapshotScheduledTrigger('exposure', context);
};

export const config = {
  schedule: '27 */6 * * *',
};
