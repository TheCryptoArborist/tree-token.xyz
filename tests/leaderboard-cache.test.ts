import assert from 'node:assert/strict';
import {
  leaderboardCacheKey,
  readCompleteLeaderboardSnapshot,
  resolveLeaderboardRefresh,
  writeCompleteLeaderboardSnapshot,
  type LeaderboardStore,
} from '../netlify/lib/leaderboard-cache.ts';
import type { SuiGraphqlScanResult } from '../netlify/lib/sui-graphql-leaderboard-provider.ts';

class MemoryStore implements LeaderboardStore {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
}

const coverage = {
  pagesScanned: 2, objectsScanned: 3, addressOwnedCoinObjects: 3, uniqueAddressOwners: 2,
  objectOwnedObjectsSkipped: 0, sharedObjectsSkipped: 0, immutableObjectsSkipped: 0,
  consensusOwnedObjectsSkipped: 0, unknownOwnerObjectsSkipped: 0, malformedOwnerAddresses: 0,
  malformedBalances: 0, excludedAddresses: 0, duplicateObjectIds: 0, elapsedMs: 10,
  hasNextPage: false, endCursorPresent: false, reachedEnd: true, pageLimitReached: false,
  timeLimitReached: false, rateLimited: false, graphqlErrors: [], networkError: null,
  cursorInconsistent: false, scanComplete: true,
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
  ...completeScan,
  outcome: 'verification-incomplete',
  generatedAt: '2026-08-05T00:01:00.000Z',
  coverage: { ...coverage, hasNextPage: true, reachedEnd: false, pageLimitReached: true, scanComplete: false },
  reconciliation: { ...reconciliation }, holderCount: null, displayedCount: 0, entries: [],
  warnings: ['fixture incomplete'],
};

assert.equal(leaderboardCacheKey('production', 'main'), 'complete:production:main');
assert.equal(leaderboardCacheKey('deploy-preview', 'feature/tree-command-center'), 'complete:deploy-preview:feature-tree-command-center');
assert.notEqual(leaderboardCacheKey('production', 'main'), leaderboardCacheKey('deploy-preview', 'feature/tree-command-center'));

const store = new MemoryStore();
assert.equal(await writeCompleteLeaderboardSnapshot(completeScan, { context: 'production', branch: 'main', store }), true);
assert.equal(await writeCompleteLeaderboardSnapshot(completeScan, { context: 'deploy-preview', branch: 'feature/tree-command-center', store }), true);
const productionKey = leaderboardCacheKey('production', 'main');
const savedProduction = structuredClone(store.values.get(productionKey));
assert.equal(await writeCompleteLeaderboardSnapshot(incompleteScan, { context: 'production', branch: 'main', store }), false);
assert.deepEqual(store.values.get(productionKey), savedProduction);

const cached = await readCompleteLeaderboardSnapshot({ context: 'production', branch: 'main', store });
assert.ok(cached);
const stale = resolveLeaderboardRefresh(incompleteScan, cached);
assert.equal(stale.status, 'stale');
assert.equal(stale.provider, 'sui-graphql-cached');
assert.equal(stale.entries.length, 1);
assert.equal(stale.snapshotGeneratedAt, completeScan.generatedAt);
assert.equal(stale.refreshCoverage.pageLimitReached, true);
const noCache = resolveLeaderboardRefresh(incompleteScan, null);
assert.equal(noCache.status, 'verification-incomplete');
assert.deepEqual(noCache.entries, []);
const errorNoCache = resolveLeaderboardRefresh({ ...incompleteScan, outcome: 'error' }, null);
assert.equal(errorNoCache.status, 'error');
assert.deepEqual(errorNoCache.entries, []);

console.log('Leaderboard cache behavior: PASS (complete-only writes and stale fallback)');
console.log('Leaderboard cache isolation: PASS (production and preview keys differ)');
