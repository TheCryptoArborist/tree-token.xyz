import { getStore } from '@netlify/blobs';
import { makeEvmMessage, verifyWalletProof } from '../lib/tree-account-signatures.mjs';
import { createAccountService, digest } from '../lib/tree-account-core.mjs';

export default async (request: Request, context: { ip?: string }) => {
  const origin = Netlify.env.get('TREE_ACCOUNT_PREVIEW_ORIGIN');
  const gameOrigin = Netlify.env.get('TREE_ACCOUNT_GAME_ORIGIN');
  // Opt-in on one exact preview hostname. A merge cannot silently enable production auth.
  if (Netlify.env.get('TREE_ACCOUNT_PREVIEW_ENABLED') !== 'true' || !origin || !gameOrigin || new URL(request.url).origin !== origin) {
    return Response.json({ status: 'error', error: 'preview-not-configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const store = getStore({ name: `tree-account-preview-v1-${digest(origin).slice(0, 12)}`, consistency: 'strong' });
  const service = createAccountService({
    store, origin, gameOrigin,
    evmMessage: makeEvmMessage, verifySignature: verifyWalletProof,
  });
  return service(request, { ip: context.ip || 'unknown' });
};
export const config = { path: '/api/tree-account' };
