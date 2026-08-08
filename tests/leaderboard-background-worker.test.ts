import assert from 'node:assert/strict';
import {
  COMPLETE_SNAPSHOT_KEY,
  REFRESH_LOCK_KEY,
  REFRESH_STATUS_KEY,
  type LeaderboardStore,
} from '../netlify/lib/leaderboard-cache.ts';
import {
  runLeaderboardBackgroundWorker,
  timingSafeSecretEqual,
} from '../netlify/lib/leaderboard-background-worker.ts';
import type { ScanOptions, SuiGraphqlScanResult } from '../netlify/lib/sui-graphql-leaderboard-provider.ts';

class MemoryStore implements LeaderboardStore {
  values = new Map<string, unknown>();
  writes: Array<{ key: string; value: unknown }> = [];
  async get(key: string) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) {
    const copy = structuredClone(value);
    this.values.set(key, copy);
    this.writes.push({ key, value: copy });
  }
  async delete(key: string) { this.values.delete(key); }
}

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
  coverage: { ...coverage, reachedEnd: false, hasNextPage: true, pageLimitReached: true, scanComplete: false },
};
const integrityFailureScan: SuiGraphqlScanResult = {
  ...incompleteScan,
  coverage: { ...incompleteScan.coverage, reachedEnd: true, hasNextPage: false, pageLimitReached: false, malformedOwnerAddresses: 1 },
};

const secret = 'fixture-refresh-secret';
const baseEnv = (name: string) => ({
  TREE_LEADERBOARD_REFRESH_SECRET: secret, CONTEXT: 'deploy-preview', COMMIT_REF: 'commit', DEPLOY_ID: 'deploy',
}[name]);
const request = (value = secret) => new Request('https://example.test/.netlify/functions/tree-leaderboard-refresh-background', {
  method: 'POST', headers: value ? { 'x-tree-refresh-secret': value } : {},
});

assert.equal(timingSafeSecretEqual('same', 'same'), true);
assert.equal(timingSafeSecretEqual('short', 'a-different-length-secret'), false);

for (const fixture of [
  { getEnv: () => undefined, req: request(), label: 'missing server secret' },
  { getEnv: baseEnv, req: request(''), label: 'missing request secret' },
  { getEnv: baseEnv, req: request('incorrect'), label: 'incorrect request secret' },
]) {
  let scans = 0;
  const result = await runLeaderboardBackgroundWorker(fixture.req, {
    getEnv: fixture.getEnv, store: new MemoryStore(), scan: async () => { scans += 1; return completeScan; },
  });
  assert.equal(result.outcome, 'authentication-failed', fixture.label);
  assert.equal(scans, 0, fixture.label);
}

const activeStore = new MemoryStore();
activeStore.values.set(REFRESH_LOCK_KEY, { runId: 'active', expiresAt: '2026-08-05T00:20:00.000Z' });
let activeScans = 0;
const capturedLogs: string[] = [];
const active = await runLeaderboardBackgroundWorker(request(), {
  getEnv: baseEnv, store: activeStore, now: () => Date.parse('2026-08-05T00:00:00.000Z'),
  scan: async () => { activeScans += 1; return completeScan; },
  logger: { info: (message) => capturedLogs.push(String(message)), error: (message) => capturedLogs.push(String(message)) },
});
assert.equal(active.outcome, 'already-active');
assert.equal(activeScans, 0);
assert.equal(JSON.stringify(capturedLogs).includes('active'), true);
assert.equal(JSON.stringify(capturedLogs).includes(secret), false);

const successfulStore = new MemoryStore();
let successfulScans = 0;
const successful = await runLeaderboardBackgroundWorker(request(), {
  getEnv: baseEnv, store: successfulStore, now: () => Date.parse('2026-08-05T00:00:00.000Z'), createRunId: () => 'run-success',
  scan: async (options: ScanOptions) => {
    successfulScans += 1;
    await options.onProgress?.({ pagesScanned: 1, objectsScanned: 2, addressOwnedCoinObjects: 2, uniqueAddressOwners: 1, excludedAddresses: 0, elapsedMs: 5, hasNextPage: true });
    return completeScan;
  },
});
assert.equal(successful.outcome, 'complete');
assert.equal(successfulScans, 1);
assert.ok(successfulStore.values.get(COMPLETE_SNAPSHOT_KEY));
assert.equal(successfulStore.values.has(REFRESH_LOCK_KEY), false);
const statusStates = successfulStore.writes.filter(({ key }) => key === REFRESH_STATUS_KEY).map(({ value }) => (value as { state: string }).state);
assert.deepEqual(statusStates, ['queued', 'running', 'running', 'complete']);
assert.equal(JSON.stringify(successfulStore.values.get(REFRESH_STATUS_KEY)).includes('wallet'), false);
assert.equal(JSON.stringify(successfulStore.values.get(REFRESH_STATUS_KEY)).includes('entries'), false);

const expiredStore = new MemoryStore();
expiredStore.values.set(REFRESH_LOCK_KEY, { runId: 'expired', expiresAt: '2026-08-04T23:59:00.000Z' });
const expired = await runLeaderboardBackgroundWorker(request(), {
  getEnv: baseEnv, store: expiredStore, now: () => Date.parse('2026-08-05T00:00:00.000Z'), createRunId: () => 'new-run', scan: async () => completeScan,
});
assert.equal(expired.started, true);

for (const [scanResult, expected] of [[incompleteScan, 'verification-incomplete'], [integrityFailureScan, 'verification-incomplete'], [new Error('fixture'), 'error']] as const) {
  const store = new MemoryStore();
  store.values.set(COMPLETE_SNAPSHOT_KEY, { preserved: true });
  const result = await runLeaderboardBackgroundWorker(request(), {
    getEnv: baseEnv, store, now: () => Date.parse('2026-08-05T00:00:00.000Z'), createRunId: () => `run-${expected}`,
    scan: async () => { if (scanResult instanceof Error) throw scanResult; return scanResult; },
    logger: { info() {}, error() {} },
  });
  assert.equal(result.outcome, expected);
  assert.deepEqual(store.values.get(COMPLETE_SNAPSHOT_KEY), { preserved: true });
}

const foreignLockStore = new MemoryStore();
await runLeaderboardBackgroundWorker(request(), {
  getEnv: baseEnv, store: foreignLockStore, now: () => Date.parse('2026-08-05T00:00:00.000Z'), createRunId: () => 'own-run',
  scan: async () => { foreignLockStore.values.set(REFRESH_LOCK_KEY, { runId: 'foreign-run' }); return incompleteScan; },
});
assert.deepEqual(foreignLockStore.values.get(REFRESH_LOCK_KEY), { runId: 'foreign-run' });

console.log('Leaderboard background worker: PASS (auth, progress, complete-only writes, and run-ID-safe locking)');
