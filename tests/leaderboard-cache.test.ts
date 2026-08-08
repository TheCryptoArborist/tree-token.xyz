import assert from 'node:assert/strict';
import {
  COMPLETE_SNAPSHOT_KEY,
  REFRESH_LOCK_KEY,
  REFRESH_STATUS_KEY,
  clearRefreshLock,
  readCompleteLeaderboardSnapshot,
  selectLeaderboardStore,
  writeCompleteLeaderboardSnapshot,
  writeLeaderboardRefreshStatus,
  type LeaderboardStore,
} from '../netlify/lib/leaderboard-cache.ts';
import type { SuiGraphqlScanResult } from '../netlify/lib/sui-graphql-leaderboard-provider.ts';

class MemoryStore implements LeaderboardStore {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
  async delete(key: string) { this.values.delete(key); }
}

const productionStore = new MemoryStore();
const previewStore = new MemoryStore();
const calls: string[] = [];
const factories = {
  getStore(name: string, options: { consistency: 'strong' }) { calls.push(`site:${name}:${options.consistency}`); return productionStore; },
  getDeployStore(name: string) { calls.push(`deploy:${name}`); return previewStore; },
};
assert.equal(selectLeaderboardStore('production', factories), productionStore);
for (const context of ['deploy-preview', 'branch-deploy', 'dev', 'preview-server', 'unknown']) {
  assert.equal(selectLeaderboardStore(context, factories), previewStore);
}
assert.deepEqual(calls, ['site:tree-leaderboard:strong', ...Array(5).fill('deploy:tree-leaderboard')]);

const coverage = {
  pagesScanned: 2, objectsScanned: 3, addressOwnedCoinObjects: 3, uniqueAddressOwners: 2,
  objectOwnedObjectsSkipped: 0, sharedObjectsSkipped: 0, immutableObjectsSkipped: 0,
  consensusOwnedObjectsSkipped: 0, unknownOwnerObjectsSkipped: 0, malformedOwnerAddresses: 0,
  malformedBalances: 0, excludedAddresses: 0, duplicateObjectIds: 0, elapsedMs: 10,
  hasNextPage: false, endCursorPresent: false, reachedEnd: true, pageLimitReached: false,
  timeLimitReached: false, rateLimited: false, graphqlErrors: [], networkError: null,
  cursorInconsistent: false, requestAttempts: 2, retriedRequests: 0, rateLimitRetries: 0,
  networkRetries: 0, serverErrorRetries: 0, scanComplete: true,
};
const reconciliation = {
  valid: true, totalSupplyRaw: '1000000000000000000', addressOwnedRaw: '3', addressOwnedTree: '0.000000003',
  addressOwnedPercentOfTotal: '0', nonAddressOwnedOrEmbeddedRawEstimate: '999999999999999997',
  nonAddressOwnedOrEmbeddedTreeEstimate: '999999999.999999997',
  nonAddressOwnedOrEmbeddedLabel: 'TREE not represented by address-owned Coin<TREE> objects' as const,
};
const completeScan: SuiGraphqlScanResult = {
  outcome: 'complete', provider: 'sui-graphql', generatedAt: '2026-08-05T00:00:00.000Z',
  methodologyVersion: 'direct-tree-sui-graphql-poc-v1', coverage, reconciliation,
  holderCount: 2, displayedCount: 1, excludedCount: 0,
  entries: [{ rank: 1, wallet: `0x${'a'.repeat(64)}`, directTreeRaw: '3', directTree: '0.000000003', supplyPercent: '0', tier: 'Ancient Grove', coinObjectCount: 1, moonbagsLocks: null, suiDexV2: null, suiDexV3: null, turbos: null, nftreeCount: null }],
  warnings: [], sourceCheckpoint: { pagesScanned: 2, objectsScanned: 3, reachedEnd: true, endCursorPresent: false },
};
const incompleteScan: SuiGraphqlScanResult = {
  ...completeScan, outcome: 'verification-incomplete', holderCount: null, displayedCount: 0, entries: [],
  coverage: { ...coverage, hasNextPage: true, reachedEnd: false, pageLimitReached: true, scanComplete: false },
};

assert.equal(await writeCompleteLeaderboardSnapshot(completeScan, { store: productionStore }), true);
const saved = structuredClone(productionStore.values.get(COMPLETE_SNAPSHOT_KEY));
assert.equal(await writeCompleteLeaderboardSnapshot(incompleteScan, { store: productionStore }), false);
assert.deepEqual(productionStore.values.get(COMPLETE_SNAPSHOT_KEY), saved);
assert.ok(await readCompleteLeaderboardSnapshot({ store: productionStore }));

await writeLeaderboardRefreshStatus({
  state: 'running', runId: 'run', startedAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-05T00:00:01.000Z',
  completedAt: null, pagesScanned: 25, objectsScanned: 1250, addressOwnedCoinObjects: 1250,
  uniqueAddressOwners: 300, excludedAddresses: 2, elapsedMs: 1000, hasNextPage: true,
  reachedEnd: false, scanComplete: false, message: 'running', commitRef: null, deployId: null,
  entries: completeScan.entries, wallet: completeScan.entries[0].wallet,
} as never, { store: previewStore });
const storedStatus = previewStore.values.get(REFRESH_STATUS_KEY) as Record<string, unknown>;
assert.equal('entries' in storedStatus, false);
assert.equal('wallet' in storedStatus, false);

previewStore.values.set(REFRESH_LOCK_KEY, { runId: 'other' });
assert.equal(await clearRefreshLock('run', { store: previewStore }), false);
assert.equal(previewStore.values.has(REFRESH_LOCK_KEY), true);
previewStore.values.set(REFRESH_LOCK_KEY, { runId: 'run' });
assert.equal(await clearRefreshLock('run', { store: previewStore }), true);
assert.equal(previewStore.values.has(REFRESH_LOCK_KEY), false);
assert.notEqual(productionStore, previewStore);

console.log('Leaderboard cache behavior: PASS (complete-only writes and run-ID-safe locks)');
console.log('Leaderboard cache isolation: PASS (production site store and deploy store differ)');
