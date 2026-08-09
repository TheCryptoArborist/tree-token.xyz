import { runExposureBackgroundWorker } from '../lib/tree-exposure-background-worker.ts';

type NetlifyRuntimeContext = {
  deploy?: {
    context?: string;
    id?: string;
  };
};

type BackgroundWorker = typeof runExposureBackgroundWorker;

export async function handleTreeExposureBackgroundRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  runWorker: BackgroundWorker = runExposureBackgroundWorker,
): Promise<void> {
  await runWorker(request, {
    deployContext: context?.deploy?.context || 'dev',
    deployId: context?.deploy?.id,
  });
}

export default async (request: Request, context: NetlifyRuntimeContext): Promise<void> => {
  await handleTreeExposureBackgroundRequest(request, context);
};
