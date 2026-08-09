import assert from 'node:assert/strict';
import {
  createExposureSnapshotResponse,
  resolveExposureSnapshotPayload,
} from '../netlify/lib/tree-exposure-snapshot-endpoint.ts';
import type { ExposureRefreshStatus } from '../netlify/lib/tree-exposure-cache.ts';
import { makeCompleteExposureSnapshot } from './fixtures/tree-exposure-fixture.ts';

const snapshot = makeCompleteExposureSnapshot();
const runningStatus: ExposureRefreshStatus = {
  state: 'running',
  stage: 'turbos',
  runId: 'private-run-id',
  startedAt: '2026-08-09T04:40:00.000Z',
  updatedAt: '2026-08-09T04:44:00.000Z',
  completedAt: null,
  directPagesScanned: 387,
  directObjectsScanned: 19302,
  directUniqueOwners: 2197,
  venueOutcomes: { suiDexV2: 'complete', suiDexV3: 'complete', turbos: 'pending' },
  totalExposureComplete: false,
  displayedCount: 0,
  message: 'Turbos running.',
  commitRef: 'private-commit',
  deployId: 'private-deploy',
};

const disabled = await resolveExposureSnapshotPayload({
  context: 'production',
  getEnv: () => undefined,
  now: () => Date.parse('2026-08-09T04:45:10.000Z'),
});
assert.equal(disabled.status, 'disabled');

const enabledProduction = await resolveExposureSnapshotPayload({
  context: 'production',
  getEnv: (name) => name === 'TREE_EXPOSURE_PRODUCTION_ENABLED' ? 'true' : undefined,
  readSnapshot: async () => snapshot,
  readRefreshStatus: async () => null,
  now: () => Date.parse('2026-08-09T04:45:10.000Z'),
});
assert.equal(enabledProduction.status, 'ok');

const notReady = await resolveExposureSnapshotPayload({
  context: 'deploy-preview',
  readSnapshot: async () => null,
  readRefreshStatus: async () => null,
  now: () => Date.parse('2026-08-09T04:45:10.000Z'),
});
assert.equal(notReady.status, 'not-ready');
assert.deepEqual(notReady.entries, []);
assert.equal(notReady.displayedCount, 0);

const refreshing = await resolveExposureSnapshotPayload({
  context: 'deploy-preview',
  readSnapshot: async () => null,
  readRefreshStatus: async () => runningStatus,
  now: () => Date.parse('2026-08-09T04:45:10.000Z'),
});
assert.equal(refreshing.status, 'refreshing');
assert.deepEqual(refreshing.entries, []);
assert.equal(refreshing.refreshStatus?.stage, 'turbos');
assert.equal(JSON.stringify(refreshing.refreshStatus).includes('private-run-id'), false);
assert.equal(JSON.stringify(refreshing.refreshStatus).includes('private-commit'), false);
assert.equal(JSON.stringify(refreshing.refreshStatus).includes('private-deploy'), false);

const ok = await resolveExposureSnapshotPayload({
  context: 'deploy-preview',
  getEnv: () => undefined,
  readSnapshot: async () => snapshot,
  readRefreshStatus: async () => runningStatus,
  now: () => Date.parse('2026-08-09T04:45:10.000Z'),
});
assert.equal(ok.status, 'ok');
assert.equal(ok.displayedCount, 50);
assert.equal(ok.entries.length, 50);
assert.deepEqual(ok.summary, snapshot.summary);
assert.deepEqual(ok.coverage, snapshot.coverage);
assert.equal(ok.refreshStatus?.state, 'running');

const stale = await resolveExposureSnapshotPayload({
  context: 'deploy-preview',
  getEnv: (name) => name === 'TREE_EXPOSURE_STALE_AFTER_MS' ? '60000' : undefined,
  readSnapshot: async () => snapshot,
  readRefreshStatus: async () => null,
  now: () => Date.parse('2026-08-09T04:47:10.000Z'),
});
assert.equal(stale.status, 'stale');
assert.ok(stale.warnings.some((warning) => warning.includes(snapshot.generatedAt)));

const methodResponse = await createExposureSnapshotResponse(
  new Request('https://example.test/api/tree-exposure', { method: 'POST' }),
  { context: 'deploy-preview' },
);
assert.equal(methodResponse.status, 405);
assert.equal(methodResponse.headers.get('allow'), 'GET');

const disabledResponse = await createExposureSnapshotResponse(
  new Request('https://example.test/api/tree-exposure'),
  { context: 'production', getEnv: () => undefined },
);
assert.equal(disabledResponse.status, 404);
assert.equal((await disabledResponse.json() as { status: string }).status, 'disabled');

const okResponse = await createExposureSnapshotResponse(
  new Request('https://example.test/api/tree-exposure'),
  {
    context: 'deploy-preview',
    readSnapshot: async () => snapshot,
    readRefreshStatus: async () => null,
    now: () => Date.parse('2026-08-09T04:45:10.000Z'),
  },
);
assert.equal(okResponse.status, 200);
assert.match(okResponse.headers.get('cache-control') || '', /s-maxage=30/);
assert.equal((await okResponse.json() as { entries: unknown[] }).entries.length, 50);

const errorResponse = await createExposureSnapshotResponse(
  new Request('https://example.test/api/tree-exposure'),
  {
    context: 'deploy-preview',
    readSnapshot: async () => { throw new Error('fixture blob error'); },
    readRefreshStatus: async () => null,
    now: () => Date.parse('2026-08-09T04:45:10.000Z'),
  },
);
assert.equal(errorResponse.status, 503);
const errorPayload = await errorResponse.json() as { status: string; entries: unknown[] };
assert.equal(errorPayload.status, 'error');
assert.deepEqual(errorPayload.entries, []);

console.log('TREE exposure snapshot endpoint: PASS (preview-only guard, Blob-read states, no partial ranks, public-status sanitization, stale handling)');
