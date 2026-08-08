import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createLeaderboardSnapshotResponse,
  resolveLeaderboardSnapshotPayload,
} from '../netlify/lib/leaderboard-snapshot-endpoint.ts';
import type { CompleteLeaderboardSnapshot, LeaderboardRefreshStatus } from '../netlify/lib/leaderboard-cache.ts';

const now = Date.parse('2026-08-05T06:00:00.000Z');
const coverage = {
  pagesScanned: 120, objectsScanned: 6000, addressOwnedCoinObjects: 6000, uniqueAddressOwners: 500,
  objectOwnedObjectsSkipped: 0, sharedObjectsSkipped: 0, immutableObjectsSkipped: 0,
  consensusOwnedObjectsSkipped: 0, unknownOwnerObjectsSkipped: 0, malformedOwnerAddresses: 0,
  malformedBalances: 0, excludedAddresses: 10, duplicateObjectIds: 0, elapsedMs: 10000,
  hasNextPage: false, endCursorPresent: false, reachedEnd: true, pageLimitReached: false,
  timeLimitReached: false, rateLimited: false, graphqlErrors: [], networkError: null,
  cursorInconsistent: false, requestAttempts: 120, retriedRequests: 0, rateLimitRetries: 0,
  networkRetries: 0, serverErrorRetries: 0, scanComplete: true,
};
const snapshot: CompleteLeaderboardSnapshot = {
  generatedAt: '2026-08-05T05:30:00.000Z', provider: 'sui-graphql', methodologyVersion: 'direct-tree-sui-graphql-poc-v1',
  entries: [{ rank: 1, wallet: `0x${'a'.repeat(64)}`, directTreeRaw: '3', directTree: '0.000000003', supplyPercent: '0', tier: 'Ancient Grove', coinObjectCount: 1, moonbagsLocks: null, suiDexV2: null, suiDexV3: null, turbos: null, nftreeCount: null }],
  holderCount: 500, displayedCount: 1, excludedCount: 10, coverage,
  reconciliation: { valid: true, totalSupplyRaw: '1000000000000000000', addressOwnedRaw: '3', addressOwnedTree: '0.000000003', addressOwnedPercentOfTotal: '0', nonAddressOwnedOrEmbeddedRawEstimate: '999999999999999997', nonAddressOwnedOrEmbeddedTreeEstimate: '999999999.999999997', nonAddressOwnedOrEmbeddedLabel: 'TREE not represented by address-owned Coin<TREE> objects' },
  sourceCheckpoint: { pagesScanned: 120, objectsScanned: 6000, reachedEnd: true, endCursorPresent: false },
};
const running: LeaderboardRefreshStatus = {
  state: 'running', runId: 'run', startedAt: '2026-08-05T05:55:00.000Z', updatedAt: '2026-08-05T05:59:00.000Z', completedAt: null,
  pagesScanned: 25, objectsScanned: 1250, addressOwnedCoinObjects: 1250, uniqueAddressOwners: 300, excludedAddresses: 5,
  elapsedMs: 4000, hasNextPage: true, reachedEnd: false, scanComplete: false, message: 'running', commitRef: null, deployId: null,
};
const getEnv = (name: string) => name === 'TREE_LEADERBOARD_STALE_AFTER_MS' ? '21600000' : undefined;
let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => { fetchCalls += 1; throw new Error('GraphQL must not be called'); }) as typeof fetch;

const notReady = await resolveLeaderboardSnapshotPayload({ now: () => now, getEnv, readSnapshot: async () => null, readRefreshStatus: async () => null });
assert.equal(notReady.status, 'not-ready');
assert.deepEqual(notReady.entries, []);

const refreshing = await resolveLeaderboardSnapshotPayload({ now: () => now, getEnv, readSnapshot: async () => null, readRefreshStatus: async () => running });
assert.equal(refreshing.status, 'refreshing');
assert.deepEqual(refreshing.entries, []);
assert.equal(JSON.stringify(refreshing).includes(snapshot.entries[0].wallet), false);

const fresh = await resolveLeaderboardSnapshotPayload({ now: () => now, getEnv, readSnapshot: async () => snapshot, readRefreshStatus: async () => null });
assert.equal(fresh.status, 'ok');
assert.equal(fresh.provider, 'sui-graphql-snapshot');
assert.equal(fresh.entries.length, 1);

const stale = await resolveLeaderboardSnapshotPayload({ now: () => now, getEnv: (name) => name === 'TREE_LEADERBOARD_STALE_AFTER_MS' ? '300000' : undefined, readSnapshot: async () => snapshot, readRefreshStatus: async () => null });
assert.equal(stale.status, 'stale');
assert.equal(stale.entries.length, 1);

const refreshingWithSnapshot = await resolveLeaderboardSnapshotPayload({ now: () => now, getEnv, readSnapshot: async () => snapshot, readRefreshStatus: async () => running });
assert.equal(refreshingWithSnapshot.status, 'ok');
assert.equal(refreshingWithSnapshot.refreshState, 'running');
assert.equal(refreshingWithSnapshot.entries.length, 1);

const response = await createLeaderboardSnapshotResponse(new Request('https://example.test/api/tree-leaderboard'), {
  now: () => now, getEnv, readSnapshot: async () => null, readRefreshStatus: async () => ({ ...running, state: 'verification-incomplete' }),
});
const responseText = await response.text();
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(responseText.includes('refresh-lock'), false);
assert.equal(responseText.includes('endCursor'), false);
assert.equal(fetchCalls, 0);
const publicFunctionSource = await readFile('netlify/functions/tree-leaderboard.ts', 'utf8');
const backgroundWorkerSource = await readFile('netlify/lib/leaderboard-background-worker.ts', 'utf8');
assert.equal(publicFunctionSource.includes('scanSuiGraphqlLeaderboard'), false);
assert.equal(publicFunctionSource.includes('fetch('), false);
assert.equal(backgroundWorkerSource.includes('scanSuiGraphqlLeaderboard'), true);
globalThis.fetch = originalFetch;

console.log('Leaderboard snapshot endpoint: PASS (Blob-read only, safe states, and no partial ranks)');
