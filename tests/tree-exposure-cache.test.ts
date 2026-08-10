import assert from 'node:assert/strict';
import {
  COMPLETE_EXPOSURE_SNAPSHOT_KEY,
  EXPOSURE_REFRESH_LOCK_KEY,
  EXPOSURE_REFRESH_STATUS_KEY,
  clearExposureRefreshLock,
  readCompleteExposureSnapshot,
  selectExposureStore,
  validateCompleteExposureSnapshot,
  writeCompleteExposureSnapshot,
  writeExposureRefreshStatus,
  type ExposureStore,
} from '../netlify/lib/tree-exposure-cache.ts';
import { makeCompleteExposureSnapshot } from './fixtures/tree-exposure-fixture.ts';

class MemoryStore implements ExposureStore {
  values = new Map<string, unknown>();
  async get(key: string, _options: { type: 'json' }) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
  async delete(key: string) { this.values.delete(key); }
}

const productionStore = new MemoryStore();
const previewStore = new MemoryStore();
const calls: string[] = [];
const factories = {
  getStore(name: string, options: { consistency: 'strong' }) {
    calls.push(`site:${name}:${options.consistency}`);
    return productionStore;
  },
  getDeployStore(name: string) {
    calls.push(`deploy:${name}`);
    return previewStore;
  },
};
assert.equal(selectExposureStore('production', factories), productionStore);
for (const context of ['deploy-preview', 'branch-deploy', 'dev', 'preview-server', 'unknown']) {
  assert.equal(selectExposureStore(context, factories), previewStore);
}
assert.deepEqual(calls, ['site:tree-exposure:strong', ...Array(5).fill('deploy:tree-exposure')]);

const valid = makeCompleteExposureSnapshot();
assert.equal(validateCompleteExposureSnapshot(valid), true);
assert.equal(await writeCompleteExposureSnapshot(valid, { store: productionStore }), true);
assert.deepEqual(await readCompleteExposureSnapshot({ store: productionStore }), valid);
const saved = structuredClone(productionStore.values.get(COMPLETE_EXPOSURE_SNAPSHOT_KEY));

const wrongTotal = structuredClone(valid);
wrongTotal.entries[0].totalExposureRaw = '1';
assert.equal(validateCompleteExposureSnapshot(wrongTotal), false);
assert.equal(await writeCompleteExposureSnapshot(wrongTotal, { store: productionStore }), false);
assert.deepEqual(productionStore.values.get(COMPLETE_EXPOSURE_SNAPSHOT_KEY), saved);

const wrongBreakdown = structuredClone(valid);
wrongBreakdown.entries[0].lpBreakdown.suiDexV3Raw = '1';
assert.equal(validateCompleteExposureSnapshot(wrongBreakdown), false);

const wrongBadge = structuredClone(valid);
wrongBadge.entries[0].badges = [];
assert.equal(validateCompleteExposureSnapshot(wrongBadge), false);

const duplicateWallet = structuredClone(valid);
duplicateWallet.entries[1].wallet = duplicateWallet.entries[0].wallet;
assert.equal(validateCompleteExposureSnapshot(duplicateWallet), false);

const wrongRankOrder = structuredClone(valid);
[wrongRankOrder.entries[0], wrongRankOrder.entries[1]] = [wrongRankOrder.entries[1], wrongRankOrder.entries[0]];
wrongRankOrder.entries[0].rank = 1;
wrongRankOrder.entries[1].rank = 2;
wrongRankOrder.summary.rank50CutoffRaw = wrongRankOrder.entries[49].totalExposureRaw;
assert.equal(validateCompleteExposureSnapshot(wrongRankOrder), false);

const incompleteCoverage = structuredClone(valid);
incompleteCoverage.coverage.turbosComplete = false;
assert.equal(validateCompleteExposureSnapshot(incompleteCoverage), false);

const shortSnapshot = structuredClone(valid);
shortSnapshot.entries.pop();
assert.equal(validateCompleteExposureSnapshot(shortSnapshot), false);

const overSupply = structuredClone(valid);
overSupply.entries[0].liquidTreeRaw = '1000000000000001';
overSupply.entries[0].liquidTree = '1000000000.000001';
overSupply.entries[0].lpTreeRaw = '0';
overSupply.entries[0].lpTree = '0';
overSupply.entries[0].totalExposureRaw = '1000000000000001';
overSupply.entries[0].totalExposure = '1000000000.000001';
overSupply.entries[0].badges = [];
assert.equal(validateCompleteExposureSnapshot(overSupply), false);

await writeExposureRefreshStatus({
  state: 'running',
  stage: 'suidex-v3',
  runId: 'run',
  startedAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:01:00.000Z',
  completedAt: null,
  directPagesScanned: 387,
  directObjectsScanned: 19302,
  directUniqueOwners: 2197,
  venueOutcomes: { suiDexV2: 'complete', suiDexV3: 'pending', turbos: 'pending' },
  totalExposureComplete: false,
  displayedCount: 0,
  message: 'running',
  commitRef: 'commit',
  deployId: 'deploy',
  entries: valid.entries,
  wallet: valid.entries[0].wallet,
} as never, { store: previewStore });
const storedStatus = previewStore.values.get(EXPOSURE_REFRESH_STATUS_KEY) as Record<string, unknown>;
assert.equal('entries' in storedStatus, false);
assert.equal('wallet' in storedStatus, false);

previewStore.values.set(EXPOSURE_REFRESH_LOCK_KEY, { runId: 'other' });
assert.equal(await clearExposureRefreshLock('run', { store: previewStore }), false);
assert.equal(previewStore.values.has(EXPOSURE_REFRESH_LOCK_KEY), true);
previewStore.values.set(EXPOSURE_REFRESH_LOCK_KEY, { runId: 'run' });
assert.equal(await clearExposureRefreshLock('run', { store: previewStore }), true);
assert.equal(previewStore.values.has(EXPOSURE_REFRESH_LOCK_KEY), false);
assert.notEqual(productionStore, previewStore);

console.log('TREE exposure cache: PASS (complete-only validation, deterministic ranking, store isolation, status sanitization, run-ID-safe locking)');
