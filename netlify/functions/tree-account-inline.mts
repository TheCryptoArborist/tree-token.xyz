import { getStore } from '@netlify/blobs';
import { digest } from '../lib/tree-account-core.mjs';
import { makeEvmMessage, verifyWalletProof } from '../lib/tree-account-signatures.mjs';
import { createInlineAccountHandler } from '../lib/tree-account-inline.mjs';
export default async (request: Request, context: { ip?: string }) => {
  const origin = Netlify.env.get('TREE_ACCOUNT_PREVIEW_ORIGIN');
  const gameOrigin = Netlify.env.get('TREE_ACCOUNT_GAME_ORIGIN');
  if (Netlify.env.get('TREE_ACCOUNT_PREVIEW_ENABLED') !== 'true' || !origin || !gameOrigin || new URL(request.url).origin !== origin || !new URL(origin).hostname.startsWith('deploy-preview-')) {
    return Response.json({ error: 'preview-not-configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  // Deliberately reuse the existing namespace so UUIDs and test CC balances survive.
  const store = getStore({ name: `tree-account-preview-v1-${digest(origin).slice(0, 12)}`, consistency: 'strong' });
  return createInlineAccountHandler({ store, origin, gameOrigin, verifySignature: verifyWalletProof, evmMessage: makeEvmMessage })(request, { ip: context.ip || 'unknown' });
};
export const config = { path: '/api/tree-account-inline' };
