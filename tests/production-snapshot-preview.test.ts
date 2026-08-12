import assert from 'node:assert/strict';
import { proxyProductionSnapshotForPreview } from '../netlify/lib/production-snapshot-preview.ts';

const previewContext = { deploy: { context: 'deploy-preview' } } as never;
const productionContext = { deploy: { context: 'production' } } as never;
const payload = {
  status: 'ok',
  entries: [{ rank: 1, wallet: `0x${'a'.repeat(64)}` }],
  warnings: ['Existing warning.'],
};
let requestedUrl = '';
const fetchImpl = async (input: RequestInfo | URL) => {
  requestedUrl = String(input);
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const response = await proxyProductionSnapshotForPreview(
  new Request('https://preview.example/api/tree-exposure-preview'),
  previewContext,
  'https://tree-token.xyz/api/tree-exposure',
  'TREE exposure',
  { fetchImpl: fetchImpl as typeof fetch },
);
assert.equal(response.status, 200);
assert.equal(requestedUrl, 'https://tree-token.xyz/api/tree-exposure');
const result = await response.json() as Record<string, unknown>;
assert.equal(result.status, 'ok');
assert.equal(result.previewSource, 'production-complete-snapshot');
assert.match(String(result.previewMessage), /production TREE exposure snapshot/i);
assert.equal((result.warnings as string[]).length, 2);
assert.deepEqual(result.entries, payload.entries);

const guarded = await proxyProductionSnapshotForPreview(
  new Request('https://tree-token.xyz/api/tree-exposure-preview'),
  productionContext,
  'https://tree-token.xyz/api/tree-exposure',
  'TREE exposure',
  { fetchImpl: fetchImpl as typeof fetch },
);
assert.equal(guarded.status, 404);

const method = await proxyProductionSnapshotForPreview(
  new Request('https://preview.example/api/tree-exposure-preview', { method: 'POST' }),
  previewContext,
  'https://tree-token.xyz/api/tree-exposure',
  'TREE exposure',
  { fetchImpl: fetchImpl as typeof fetch },
);
assert.equal(method.status, 405);

const failed = await proxyProductionSnapshotForPreview(
  new Request('https://preview.example/api/tree-exposure-preview'),
  previewContext,
  'https://tree-token.xyz/api/tree-exposure',
  'TREE exposure',
  { fetchImpl: (async () => new Response('no', { status: 503 })) as typeof fetch },
);
assert.equal(failed.status, 502);
console.log('Production snapshot Deploy Preview proxy: PASS');
