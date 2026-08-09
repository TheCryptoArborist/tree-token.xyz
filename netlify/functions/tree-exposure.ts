import { createExposureSnapshotResponse } from '../lib/tree-exposure-snapshot-endpoint.ts';

type NetlifyRuntimeContext = {
  deploy?: {
    context?: string;
    id?: string;
  };
};

type SnapshotResponseFactory = typeof createExposureSnapshotResponse;

export async function handleTreeExposureRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  createResponse: SnapshotResponseFactory = createExposureSnapshotResponse,
) {
  return createResponse(request, {
    context: context?.deploy?.context || 'dev',
  });
}

export default async (request: Request, context: NetlifyRuntimeContext) => (
  handleTreeExposureRequest(request, context)
);

export const config = { path: '/api/tree-exposure' };
