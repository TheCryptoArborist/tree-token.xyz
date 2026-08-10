import { runTreeBadgeBackgroundWorker } from '../lib/tree-badge-background-worker.ts';

type NetlifyRuntimeContext = {
  deploy?: {
    context?: string;
    id?: string;
  };
};

export default async (request: Request, context: NetlifyRuntimeContext): Promise<void> => {
  await runTreeBadgeBackgroundWorker(request, {
    deployContext: context?.deploy?.context || 'dev',
    deployId: context?.deploy?.id,
  });
};
