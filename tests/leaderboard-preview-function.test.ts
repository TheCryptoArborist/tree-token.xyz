import assert from 'node:assert/strict';
import { handleTreeLeaderboardPreviewRequest } from '../netlify/functions/tree-leaderboard-preview.ts';

const wallet = `0x${'a'.repeat(64)}`;
const context = { deploy: { context: 'deploy-preview', id: 'preview', published: false }, site: { url: 'https://preview.test' } };
const response = await handleTreeLeaderboardPreviewRequest(new Request('https://preview.test/api/tree-leaderboard-preview'), context, {
  fetchImpl: async () => new Response(JSON.stringify({ status: 'ok', entries: [{ rank: 1, wallet }], warnings: [] }), { status: 200 }),
  resolveNames: async () => ({
    names: { [wallet]: 'cryptoarborist.sui' }, requestedCount: 1, resolvedCount: 1, complete: true,
    graphqlErrors: [], networkError: null, generatedAt: '2026-08-09T00:00:00.000Z',
  }),
});
assert.equal(response.status, 200);
const payload = await response.json() as { entries: Array<{ suinsName: string }>; identityResolution: { resolvedCount: number } };
assert.equal(payload.entries[0].suinsName, 'cryptoarborist.sui');
assert.equal(payload.identityResolution.resolvedCount, 1);

const hidden = await handleTreeLeaderboardPreviewRequest(new Request('https://example.test/api/tree-leaderboard-preview'), {
  ...context, deploy: { ...context.deploy, context: 'production' },
});
assert.equal(hidden.status, 404);
console.log('Leaderboard preview function: PASS (preview-only production snapshot enrichment)');
