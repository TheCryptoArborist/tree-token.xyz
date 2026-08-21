import assert from 'node:assert/strict';
import { handleTreeExposurePreviewRequest } from '../netlify/functions/tree-exposure-preview.ts';

const wallet = `0x${'a'.repeat(64)}`;
const context = { deploy: { context: 'deploy-preview', id: 'preview', published: false }, site: { url: 'https://preview.test' } } as never;
const response = await handleTreeExposurePreviewRequest(
  new Request('https://preview.test/api/tree-exposure-preview'),
  context,
  {
    fetchImpl: async () => new Response(JSON.stringify({
      status: 'ok', entries: [{ rank: 1, wallet, suinsName: null }], warnings: [],
    }), { status: 200 }),
    resolveNames: async () => ({
      names: { [wallet]: 'crypto-arborist.sui' }, requestedCount: 1, resolvedCount: 1, complete: true,
      graphqlErrors: [], networkError: null, generatedAt: '2026-08-18T00:00:00.000Z',
    }),
  },
);
assert.equal(response.status, 200);
const payload = await response.json() as {
  entries: Array<{ suinsName: string | null }>;
  identityResolution: { provider: string; resolvedCount: number };
};
assert.equal(payload.entries[0].suinsName, 'crypto-arborist.sui');
assert.equal(payload.identityResolution.provider, 'sui-graphql-default-name-record');
assert.equal(payload.identityResolution.resolvedCount, 1);
console.log('TREE exposure preview SuiNS enrichment: PASS');
