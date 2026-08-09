import assert from 'node:assert/strict';
import {
  COMPLETE_EXPOSURE_SNAPSHOT_KEY,
  EXPOSURE_REFRESH_LOCK_KEY,
  EXPOSURE_REFRESH_STATUS_KEY,
  type ExposureRefreshStatus,
  type ExposureStore,
} from '../netlify/lib/tree-exposure-cache.ts';
import { runExposureBackgroundWorker } from '../netlify/lib/tree-exposure-background-worker.ts';
import type { ExposureScanRunnerDependencies } from '../netlify/lib/tree-exposure-scan-runner.ts';
import { makeCompleteExposureSnapshot } from './fixtures/tree-exposure-fixture.ts';

class MemoryStore implements ExposureStore {
  values = new Map<string, unknown>();
  writes: Array<{ key: string; value: unknown }> = [];
  async get(key: string, _options: { type: 'json' }) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) {
    const copy = structuredClone(value);
    this.values.set(key, copy);
    this.writes.push({ key, value: copy });
  }
  async delete(key: string) { this.values.delete(key); }
}

const secret = 'fixture-exposure-secret';
const baseEnv = (name: string) => ({
  TREE_EXPOSURE_REFRESH_SECRET: secret,
  COMMIT_REF: 'commit',
  DEPLOY_ID: 'environment-deploy',
}[name]);
const request = (value = secret, method = 'POST') => new Request(
  'https://example.test/.netlify/functions/tree-exposure-refresh-background',
  {
    method,
    headers: value ? { 'x-tree-exposure-refresh-secret': value } : {},
  },
);

const productionDisabled = await runExposureBackgroundWorker(request(), {
  deployContext: 'production',
  getEnv: baseEnv,
  store: new MemoryStore(),
});
assert.equal(productionDisabled.outcome, 'production-disabled');
assert.equal(productionDisabled.accepted, false);

const productionEnabled = await runExposureBackgroundWorker(request(), {
  deployContext: 'production',
  getEnv: (name) => name === 'TREE_EXPOSURE_PRODUCTION_ENABLED' ? 'true' : baseEnv(name),
  store: new MemoryStore(),
  runScan: async () => ({ outcome: 'verification-incomplete', stage: 'direct-tree', snapshot: null, warnings: [] }),
});
assert.equal(productionEnabled.outcome, 'verification-incomplete');
assert.equal(productionEnabled.accepted, true);

const wrongMethod = await runExposureBackgroundWorker(request(secret, 'GET'), {
  getEnv: baseEnv,
  store: new MemoryStore(),
});
assert.equal(wrongMethod.outcome, 'method-not-allowed');

for (const fixture of [
  { getEnv: () => undefined, req: request(), label: 'missing server secret' },
  { getEnv: baseEnv, req: request(''), label: 'missing request secret' },
  { getEnv: baseEnv, req: request('incorrect'), label: 'incorrect request secret' },
]) {
  let scans = 0;
  const result = await runExposureBackgroundWorker(fixture.req, {
    getEnv: fixture.getEnv,
    store: new MemoryStore(),
    runScan: async () => {
      scans += 1;
      return { outcome: 'verification-incomplete', stage: 'direct-tree', snapshot: null, warnings: [] };
    },
  });
  assert.equal(result.outcome, 'authentication-failed', fixture.label);
  assert.equal(scans, 0, fixture.label);
}

const activeStore = new MemoryStore();
activeStore.values.set(EXPOSURE_REFRESH_LOCK_KEY, {
  runId: 'active',
  expiresAt: '2026-08-09T01:00:00.000Z',
});
let activeScans = 0;
const capturedLogs: string[] = [];
const active = await runExposureBackgroundWorker(request(), {
  getEnv: baseEnv,
  deployContext: 'deploy-preview',
  store: activeStore,
  now: () => Date.parse('2026-08-09T00:00:00.000Z'),
  runScan: async () => {
    activeScans += 1;
    return { outcome: 'verification-incomplete', stage: 'direct-tree', snapshot: null, warnings: [] };
  },
  logger: {
    info: (message) => capturedLogs.push(String(message)),
    error: (message) => capturedLogs.push(String(message)),
  },
});
assert.equal(active.outcome, 'already-active');
assert.equal(activeScans, 0);
assert.equal(JSON.stringify(capturedLogs).includes(secret), false);

const snapshot = makeCompleteExposureSnapshot();
const successfulStore = new MemoryStore();
const successful = await runExposureBackgroundWorker(request(), {
  getEnv: baseEnv,
  deployContext: 'deploy-preview',
  deployId: 'context-deploy',
  store: successfulStore,
  now: () => Date.parse('2026-08-09T00:00:00.000Z'),
  createRunId: () => 'run-success',
  runScan: async (dependencies: ExposureScanRunnerDependencies) => {
    await dependencies.onProgress?.({
      stage: 'suidex-v2',
      message: 'V2 running',
      directPagesScanned: 387,
      directObjectsScanned: 19302,
      directUniqueOwners: 2197,
      venueOutcomes: { suiDexV2: 'pending', suiDexV3: 'pending', turbos: 'pending' },
    });
    await dependencies.onProgress?.({
      stage: 'complete',
      message: 'complete',
      directPagesScanned: 387,
      directObjectsScanned: 19302,
      directUniqueOwners: 2197,
      venueOutcomes: { suiDexV2: 'complete', suiDexV3: 'complete', turbos: 'complete' },
    });
    return { outcome: 'complete', stage: 'complete', snapshot, warnings: snapshot.warnings };
  },
  logger: { info() {}, error() {} },
});
assert.equal(successful.outcome, 'complete');
assert.equal(successful.started, true);
assert.deepEqual(successfulStore.values.get(COMPLETE_EXPOSURE_SNAPSHOT_KEY), snapshot);
assert.equal(successfulStore.values.has(EXPOSURE_REFRESH_LOCK_KEY), false);
const finalStatus = successfulStore.values.get(EXPOSURE_REFRESH_STATUS_KEY) as ExposureRefreshStatus;
assert.equal(finalStatus.state, 'complete');
assert.equal(finalStatus.stage, 'complete');
assert.equal(finalStatus.totalExposureComplete, true);
assert.equal(finalStatus.displayedCount, 50);
assert.equal(finalStatus.directPagesScanned, 387);
assert.deepEqual(finalStatus.venueOutcomes, { suiDexV2: 'complete', suiDexV3: 'complete', turbos: 'complete' });
assert.equal(JSON.stringify(finalStatus).includes('entries'), false);
assert.equal(JSON.stringify(finalStatus).includes('wallet'), false);
const lockWrite = successfulStore.writes.find(({ key }) => key === EXPOSURE_REFRESH_LOCK_KEY)?.value as { deployId?: string };
assert.equal(lockWrite.deployId, 'context-deploy');

const preservedStore = new MemoryStore();
preservedStore.values.set(COMPLETE_EXPOSURE_SNAPSHOT_KEY, structuredClone(snapshot));
const incomplete = await runExposureBackgroundWorker(request(), {
  getEnv: baseEnv,
  deployContext: 'deploy-preview',
  store: preservedStore,
  now: () => Date.parse('2026-08-09T00:00:00.000Z'),
  createRunId: () => 'run-incomplete',
  runScan: async () => ({
    outcome: 'verification-incomplete',
    stage: 'turbos',
    snapshot: null,
    warnings: ['Turbos incomplete'],
  }),
  logger: { info() {}, error() {} },
});
assert.equal(incomplete.outcome, 'verification-incomplete');
assert.deepEqual(preservedStore.values.get(COMPLETE_EXPOSURE_SNAPSHOT_KEY), snapshot);
assert.equal((preservedStore.values.get(EXPOSURE_REFRESH_STATUS_KEY) as ExposureRefreshStatus).state, 'verification-incomplete');

const invalidStore = new MemoryStore();
invalidStore.values.set(COMPLETE_EXPOSURE_SNAPSHOT_KEY, { preserved: true });
const invalidSnapshot = structuredClone(snapshot);
invalidSnapshot.entries[0].totalExposureRaw = '1';
const invalidResult = await runExposureBackgroundWorker(request(), {
  getEnv: baseEnv,
  deployContext: 'deploy-preview',
  store: invalidStore,
  now: () => Date.parse('2026-08-09T00:00:00.000Z'),
  createRunId: () => 'run-invalid',
  runScan: async () => ({ outcome: 'complete', stage: 'complete', snapshot: invalidSnapshot, warnings: [] }),
  logger: { info() {}, error() {} },
});
assert.equal(invalidResult.outcome, 'verification-incomplete');
assert.deepEqual(invalidStore.values.get(COMPLETE_EXPOSURE_SNAPSHOT_KEY), { preserved: true });

const errorStore = new MemoryStore();
errorStore.values.set(COMPLETE_EXPOSURE_SNAPSHOT_KEY, { preserved: true });
const errorResult = await runExposureBackgroundWorker(request(), {
  getEnv: baseEnv,
  deployContext: 'deploy-preview',
  store: errorStore,
  now: () => Date.parse('2026-08-09T00:00:00.000Z'),
  createRunId: () => 'run-error',
  runScan: async () => { throw new Error('fixture failure'); },
  logger: { info() {}, error() {} },
});
assert.equal(errorResult.outcome, 'error');
assert.deepEqual(errorStore.values.get(COMPLETE_EXPOSURE_SNAPSHOT_KEY), { preserved: true });
assert.equal((errorStore.values.get(EXPOSURE_REFRESH_STATUS_KEY) as ExposureRefreshStatus).state, 'error');

const foreignLockStore = new MemoryStore();
await runExposureBackgroundWorker(request(), {
  getEnv: baseEnv,
  deployContext: 'deploy-preview',
  store: foreignLockStore,
  now: () => Date.parse('2026-08-09T00:00:00.000Z'),
  createRunId: () => 'own-run',
  runScan: async () => {
    foreignLockStore.values.set(EXPOSURE_REFRESH_LOCK_KEY, { runId: 'foreign-run' });
    return { outcome: 'verification-incomplete', stage: 'direct-tree', snapshot: null, warnings: [] };
  },
  logger: { info() {}, error() {} },
});
assert.deepEqual(foreignLockStore.values.get(EXPOSURE_REFRESH_LOCK_KEY), { runId: 'foreign-run' });

console.log('TREE exposure background worker: PASS (preview guard, auth, progress, complete-only writes, prior-snapshot preservation, run-ID-safe locking)');
