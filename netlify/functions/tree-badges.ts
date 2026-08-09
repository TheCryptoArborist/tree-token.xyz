import { createTreeBadgeResponse } from '../lib/tree-badge-snapshot-endpoint.ts';

type NetlifyRuntimeContext = {
  deploy?: {
    context?: string;
  };
};

export default async (request: Request, context: NetlifyRuntimeContext) => (
  createTreeBadgeResponse(request, {
    context: context?.deploy?.context || 'dev',
  })
);

export const config = { path: '/api/tree-badges' };
