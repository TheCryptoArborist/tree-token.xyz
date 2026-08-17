import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';
import { proxyProductionSnapshotForPreview } from '../lib/production-snapshot-preview.ts';

export default async (request: Request, context: NetlifyRuntimeContext) => (
  proxyProductionSnapshotForPreview(
    request,
    context,
    'https://tree-token.xyz/api/tree-exposure',
    'TREE exposure',
  )
);

export const config = { path: '/api/tree-exposure-preview' };
