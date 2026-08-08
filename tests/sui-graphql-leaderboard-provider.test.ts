import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_SCAN_MS,
  DEFAULT_PAGE_SIZE,
  compareBigIntDescending,
  formatBaseUnits,
  formatPercentFromRaw,
  parseRawBalance,
  readSuiGraphqlConfig,
  reconcile,
  verifyTreeCoinMetadata,
  scanSuiGraphqlLeaderboard,
} from '../netlify/lib/sui-graphql-leaderboard-provider.ts';

const address = (digit: string) => `0x${digit.repeat(64)}`;
const pool = '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';
let objectCounter = 0;
function coinNode(ownerKind: string, ownerAddress: unknown, balance: unknown, options: { id?: string; fallback?: boolean } = {}) {
  const contents = options.fallback
    ? { json: { balance } }
    : { json: {}, balanceField: { json: balance } };
  return {
    address: options.id || `0xobject${++objectCounter}`,
    owner: { __typename: ownerKind, address: { address: ownerAddress } },
    asMoveObject: { contents },
  };
}
function graphPage(nodes: unknown[], hasNextPage: boolean, endCursor: string | null, errors?: unknown[]) {
  return errors
    ? { errors }
    : { data: { objects: { pageInfo: { hasNextPage, endCursor }, nodes } } };
}
const liveMetadata = { name: 'Thickquidity', symbol: 'Tree', decimals: 6, supply: '1000000000000000' };
const metadataPayload = (metadata: unknown = liveMetadata) => ({ data: { coinMetadata: metadata } });
function queuedFetch(
  payloads: Array<{ payload?: unknown; status?: number; headers?: Record<string, string> }>,
  metadata: unknown = metadataPayload(),
) {
  const requests: Array<Record<string, unknown>> = [];
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    requests.push(request);
    if (String(request.query).includes('GetTreeCoinMetadata')) {
      return new Response(JSON.stringify(metadata), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const next = payloads.shift();
    if (!next) throw new Error('Unexpected request');
    return new Response(JSON.stringify(next.payload ?? {}), { status: next.status ?? 200, headers: { 'Content-Type': 'application/json', ...next.headers } });
  };
  return { fetchImpl: fetchImpl as typeof fetch, requests };
}

assert.equal(parseRawBalance('1234567890123'), 1234567890123n);
assert.equal(parseRawBalance(123), null);
assert.equal(parseRawBalance('-1'), null);
assert.equal(parseRawBalance('1.5'), null);
assert.equal(formatBaseUnits(1234567890123n, 6), '1234567.890123');
assert.equal(formatBaseUnits(1_000_000n, 6), '1');
assert.equal(formatPercentFromRaw(500_000_000_000_000n, 1_000_000_000_000_000n), '50');
assert.equal(formatBaseUnits(458_434_574_514_958n, 6), '458434574.514958');
assert.equal(formatPercentFromRaw(458_434_574_514_958n, 1_000_000_000_000_000n), '45.843457451');
assert.equal(formatBaseUnits(1_000_000_000_000_000n - 458_434_574_514_958n, 6), '541565425.485042');
const correctedCompletedScan = reconcile(458_434_574_514_958n, 6, 1_000_000_000_000_000n);
assert.equal(correctedCompletedScan.addressOwnedTree, '458434574.514958');
assert.equal(correctedCompletedScan.addressOwnedPercentOfTotal, '45.843457451');
assert.equal(correctedCompletedScan.nonAddressOwnedOrEmbeddedTreeEstimate, '541565425.485042');
const verifiedLiveMetadata = verifyTreeCoinMetadata(liveMetadata);
assert.ok(verifiedLiveMetadata);
assert.equal(verifiedLiveMetadata.name, 'Thickquidity');
assert.equal(verifiedLiveMetadata.symbol, 'Tree');
assert.equal(verifiedLiveMetadata.decimals, 6);
assert.equal(verifiedLiveMetadata.supplyRaw, 1_000_000_000_000_000n);
assert.deepEqual([3n, 1n, 2n].sort(compareBigIntDescending), [3n, 2n, 1n]);

const malformedConfig = readSuiGraphqlConfig((name) => ({
  SUI_GRAPHQL_URL: 'not a url',
  SUI_GRAPHQL_PAGE_SIZE: '500',
  SUI_GRAPHQL_MAX_PAGES: 'zero',
  SUI_GRAPHQL_MAX_SCAN_MS: '999',
}[name]));
assert.equal(malformedConfig.pageSize, DEFAULT_PAGE_SIZE);
assert.equal(malformedConfig.maxPages, DEFAULT_MAX_PAGES);
assert.equal(malformedConfig.maxScanMs, DEFAULT_MAX_SCAN_MS);

objectCounter = 0;
const exactA = 400_000_000_000_001n + 7n;
const equalBalance = 200_000_000_000_000n;
const pageOne = [
  coinNode('AddressOwner', address('a'), '400000000000001'),
  coinNode('AddressOwner', address('a'), '7'),
  coinNode('AddressOwner', address('b'), equalBalance.toString()),
  coinNode('ObjectOwner', address('d'), '100'),
  coinNode('Shared', null, '100'),
  coinNode('Immutable', null, '100'),
  coinNode('ConsensusAddressOwner', address('e'), '100'),
  coinNode('AddressOwner', pool, '1000', { fallback: true }),
];
const pageTwo = [
  coinNode('AddressOwner', address('c'), equalBalance.toString()),
  coinNode('AddressOwner', pool, '500'),
];
const twoPages = queuedFetch([
  { payload: graphPage(pageOne, true, 'opaque-cursor-1') },
  { payload: graphPage(pageTwo, false, null) },
]);
const complete = await scanSuiGraphqlLeaderboard({ fetchImpl: twoPages.fetchImpl, pageSize: 50, maxPages: 4, maxScanMs: 10_000 });
assert.equal(complete.outcome, 'complete');
assert.equal(complete.coverage.scanComplete, true);
assert.equal(complete.coverage.reachedEnd, true);
assert.equal(complete.coverage.pagesScanned, 2);
assert.equal(complete.coverage.objectsScanned, 10);
assert.equal(complete.coverage.coinMetadataVerified, true);
assert.equal(complete.coverage.coinSymbol, 'Tree');
assert.equal(complete.coinSymbol, 'Tree');
assert.equal(complete.coverage.coinDecimals, 6);
assert.equal(complete.coverage.totalSupplyRaw, '1000000000000000');
assert.equal(complete.coverage.objectOwnedObjectsSkipped, 1);
assert.equal(complete.coverage.sharedObjectsSkipped, 1);
assert.equal(complete.coverage.immutableObjectsSkipped, 1);
assert.equal(complete.coverage.consensusOwnedObjectsSkipped, 1);
assert.equal(complete.coverage.unknownOwnerObjectsSkipped, 0);
assert.equal(complete.coverage.malformedOwnerAddresses, 0);
assert.equal(complete.coverage.malformedBalances, 0);
assert.equal(complete.coverage.duplicateObjectIds, 0);
assert.equal(complete.coverage.excludedCoinObjects, 2);
assert.equal(complete.coverage.excludedUniqueOwners, 1);
assert.equal(complete.coverage.excludedAddresses, 2);
assert.equal(complete.holderCount, 4);
assert.equal(complete.verifiedAddressOwners, 4);
assert.equal(complete.eligibleRankedOwners, 3);
assert.equal(complete.entries.length, 3);
assert.equal(complete.entries[0].wallet, address('a'));
assert.equal(complete.entries[0].directTreeRaw, exactA.toString());
assert.equal(complete.entries[0].directTree, '400000000.000008');
assert.equal(complete.entries[0].coinObjectCount, 2);
assert.deepEqual(complete.entries.slice(1).map((entry) => entry.wallet), [address('b'), address('c')]);
assert.deepEqual(complete.entries.map((entry) => entry.rank), [1, 2, 3]);
assert.equal(complete.entries.some((entry) => entry.wallet === pool), false);
assert.equal(twoPages.requests[1].variables.after, null);
assert.equal(twoPages.requests[2].variables.after, 'opaque-cursor-1');
const expectedAddressOwnedRaw = exactA + equalBalance + equalBalance + 1500n;
assert.equal(complete.reconciliation.valid, true);
assert.equal(complete.reconciliation.addressOwnedRaw, expectedAddressOwnedRaw.toString());
assert.equal(complete.reconciliation.nonAddressOwnedOrEmbeddedRawEstimate, (1_000_000_000_000_000n - expectedAddressOwnedRaw).toString());

const malformedOwnerFetch = queuedFetch([{ payload: graphPage([
  coinNode('AddressOwner', 'malformed', '100'),
], false, null) }]);
const malformedOwner = await scanSuiGraphqlLeaderboard({ fetchImpl: malformedOwnerFetch.fetchImpl });
assert.equal(malformedOwner.coverage.reachedEnd, true);
assert.equal(malformedOwner.coverage.malformedOwnerAddresses, 1);
assert.equal(malformedOwner.coverage.scanComplete, false);
assert.equal(malformedOwner.outcome, 'verification-incomplete');
assert.deepEqual(malformedOwner.entries, []);
assert.ok(malformedOwner.warnings.includes('Malformed address-owned wallet data prevented complete verification.'));

const malformedBalanceFetch = queuedFetch([{ payload: graphPage([
  coinNode('AddressOwner', address('f'), 'bad-balance'),
], false, null) }]);
const malformedBalance = await scanSuiGraphqlLeaderboard({ fetchImpl: malformedBalanceFetch.fetchImpl });
assert.equal(malformedBalance.coverage.reachedEnd, true);
assert.equal(malformedBalance.coverage.malformedBalances, 1);
assert.equal(malformedBalance.coverage.scanComplete, false);
assert.equal(malformedBalance.outcome, 'verification-incomplete');
assert.deepEqual(malformedBalance.entries, []);
assert.ok(malformedBalance.warnings.includes('Malformed TREE balance data prevented complete verification.'));

const unknownOwnerFetch = queuedFetch([{ payload: graphPage([
  coinNode('MysteryOwner', null, '100'),
], false, null) }]);
const unknownOwner = await scanSuiGraphqlLeaderboard({ fetchImpl: unknownOwnerFetch.fetchImpl });
assert.equal(unknownOwner.coverage.reachedEnd, true);
assert.equal(unknownOwner.coverage.unknownOwnerObjectsSkipped, 1);
assert.equal(unknownOwner.coverage.scanComplete, false);
assert.equal(unknownOwner.outcome, 'verification-incomplete');
assert.deepEqual(unknownOwner.entries, []);
assert.ok(unknownOwner.warnings.includes('An unknown Sui owner variant prevented complete verification.'));

const duplicateId = '0xduplicate';
const duplicateObjectFetch = queuedFetch([{ payload: graphPage([
  coinNode('AddressOwner', address('a'), '100', { id: duplicateId }),
  coinNode('AddressOwner', address('a'), '100', { id: duplicateId }),
], false, null) }]);
const duplicateObject = await scanSuiGraphqlLeaderboard({ fetchImpl: duplicateObjectFetch.fetchImpl });
assert.equal(duplicateObject.coverage.reachedEnd, true);
assert.equal(duplicateObject.coverage.duplicateObjectIds, 1);
assert.equal(duplicateObject.coverage.scanComplete, false);
assert.equal(duplicateObject.outcome, 'verification-incomplete');
assert.deepEqual(duplicateObject.entries, []);
assert.ok(duplicateObject.warnings.includes('Duplicate Coin<TREE> object IDs prevented complete verification.'));

const limitedFetch = queuedFetch([{ payload: graphPage([coinNode('AddressOwner', address('a'), '1')], true, 'more') }]);
const pageLimited = await scanSuiGraphqlLeaderboard({ fetchImpl: limitedFetch.fetchImpl, maxPages: 1, maxScanMs: 10_000 });
assert.equal(pageLimited.outcome, 'verification-incomplete');
assert.equal(pageLimited.coverage.pageLimitReached, true);
assert.deepEqual(pageLimited.entries, []);

const timedFetch = queuedFetch([{ payload: graphPage([coinNode('AddressOwner', address('a'), '1')], true, 'more') }]);
const times = [0, 0, 2000, 2000, 2000];
const timeLimited = await scanSuiGraphqlLeaderboard({ fetchImpl: timedFetch.fetchImpl, maxPages: 4, maxScanMs: 1000, now: () => times.shift() ?? 2000 });
assert.equal(timeLimited.outcome, 'verification-incomplete');
assert.equal(timeLimited.coverage.timeLimitReached, true);
assert.deepEqual(timeLimited.entries, []);

const graphErrorFetch = queuedFetch([{ payload: graphPage([], false, null, [{ message: 'fixture error' }]) }]);
const graphError = await scanSuiGraphqlLeaderboard({ fetchImpl: graphErrorFetch.fetchImpl });
assert.equal(graphError.outcome, 'error');
assert.deepEqual(graphError.entries, []);
assert.deepEqual(graphError.coverage.graphqlErrors, ['fixture error']);
assert.equal(graphError.coverage.requestAttempts, 2);

const rateFetch = queuedFetch([{ status: 429 }]);
const rateLimited = await scanSuiGraphqlLeaderboard({ fetchImpl: rateFetch.fetchImpl });
assert.equal(rateLimited.outcome, 'error');
assert.equal(rateLimited.coverage.rateLimited, true);
assert.deepEqual(rateLimited.entries, []);

const networkError = await scanSuiGraphqlLeaderboard({ fetchImpl: (async () => { throw new Error('fixture network failure'); }) as typeof fetch });
assert.equal(networkError.outcome, 'verification-incomplete');
assert.equal(networkError.coverage.networkError, 'fixture network failure');
assert.deepEqual(networkError.entries, []);

const invalidJson = await scanSuiGraphqlLeaderboard({ fetchImpl: (async () => new Response('not-json')) as typeof fetch });
assert.equal(invalidJson.outcome, 'verification-incomplete');
assert.match(invalidJson.coverage.networkError || '', /unreadable JSON/);
assert.deepEqual(invalidJson.entries, []);

const invalidSupplyFetch = queuedFetch([{ payload: graphPage([
  coinNode('AddressOwner', address('a'), '1000000000000001'),
], false, null) }]);
const invalidSupply = await scanSuiGraphqlLeaderboard({ fetchImpl: invalidSupplyFetch.fetchImpl });
assert.equal(invalidSupply.coverage.scanComplete, true);
assert.equal(invalidSupply.reconciliation.valid, false);
assert.equal(invalidSupply.outcome, 'verification-incomplete');
assert.deepEqual(invalidSupply.entries, []);

let retryClock = 0;
const retryDelays: number[] = [];
const retryAfterFetch = queuedFetch([
  { status: 429, headers: { 'Retry-After': '2' } },
  { payload: graphPage([coinNode('AddressOwner', address('a'), '1')], false, null) },
]);
const retryAfter = await scanSuiGraphqlLeaderboard({
  fetchImpl: retryAfterFetch.fetchImpl, maxRetries: 1, maxScanMs: 10_000, now: () => retryClock,
  sleepImpl: async (milliseconds) => { retryDelays.push(milliseconds); retryClock += milliseconds; }, randomImpl: () => 0,
});
assert.equal(retryAfter.outcome, 'complete');
assert.deepEqual(retryDelays, [2000]);
assert.equal(retryAfter.coverage.rateLimitRetries, 1);

retryClock = 0;
const unreasonableDelays: number[] = [];
const unreasonableFetch = queuedFetch([
  { status: 429, headers: { 'Retry-After': '999999' } },
  { payload: graphPage([coinNode('AddressOwner', address('a'), '1')], false, null) },
]);
const unreasonable = await scanSuiGraphqlLeaderboard({
  fetchImpl: unreasonableFetch.fetchImpl, maxRetries: 1, maxScanMs: 3_000, now: () => retryClock,
  sleepImpl: async (milliseconds) => { unreasonableDelays.push(milliseconds); retryClock += milliseconds; }, randomImpl: () => 0,
});
assert.equal(unreasonable.outcome, 'complete');
assert.deepEqual(unreasonableDelays, [1000]);

const exhaustedFetch = queuedFetch([{ status: 429 }, { status: 429 }, { status: 429 }]);
const exhausted = await scanSuiGraphqlLeaderboard({ fetchImpl: exhaustedFetch.fetchImpl, maxRetries: 2, maxScanMs: 10_000, sleepImpl: async () => {}, randomImpl: () => 0 });
assert.equal(exhausted.outcome, 'error');
assert.equal(exhausted.coverage.rateLimited, true);
assert.equal(exhausted.coverage.requestAttempts, 4);
assert.deepEqual(exhausted.entries, []);

const serverFetch = queuedFetch([
  { status: 503 },
  { payload: graphPage([coinNode('AddressOwner', address('a'), '1')], false, null) },
]);
const serverRecovered = await scanSuiGraphqlLeaderboard({ fetchImpl: serverFetch.fetchImpl, maxRetries: 1, maxScanMs: 10_000, sleepImpl: async () => {}, randomImpl: () => 0 });
assert.equal(serverRecovered.outcome, 'complete');
assert.equal(serverRecovered.coverage.serverErrorRetries, 1);

let networkAttempts = 0;
const networkRecovered = await scanSuiGraphqlLeaderboard({
  fetchImpl: (async (_url, init) => {
    networkAttempts += 1;
    if (networkAttempts === 1) throw new TypeError('transient');
    const request = JSON.parse(String(init?.body));
    if (String(request.query).includes('GetTreeCoinMetadata')) {
      return new Response(JSON.stringify(metadataPayload()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(graphPage([coinNode('AddressOwner', address('a'), '1')], false, null)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch,
  maxRetries: 1, maxScanMs: 10_000, sleepImpl: async () => {}, randomImpl: () => 0,
});
assert.equal(networkRecovered.outcome, 'complete');
assert.equal(networkRecovered.coverage.networkRetries, 1);

const progressEvents: unknown[] = [];
const progressFetch = queuedFetch([
  { payload: graphPage([coinNode('AddressOwner', address('a'), '1')], true, 'cursor') },
  { payload: graphPage([coinNode('AddressOwner', address('b'), '2')], false, null) },
]);
await scanSuiGraphqlLeaderboard({ fetchImpl: progressFetch.fetchImpl, progressIntervalPages: 1, onProgress: (progress) => progressEvents.push(progress) });
assert.ok(progressEvents.length >= 2);
assert.equal(JSON.stringify(progressEvents).includes('cursor'), false);
assert.equal(JSON.stringify(progressEvents).includes(address('a')), false);

for (const [label, responsePayload] of [
  ['missing metadata', metadataPayload(null)],
  ['missing name', metadataPayload({ symbol: 'Tree', decimals: 6, supply: '1000000000000000' })],
  ['missing decimals', metadataPayload({ name: 'Thickquidity', symbol: 'Tree', supply: '1000000000000000' })],
  ['missing supply', metadataPayload({ name: 'Thickquidity', symbol: 'Tree', decimals: 6 })],
  ['malformed decimals', metadataPayload({ ...liveMetadata, decimals: '6' })],
  ['malformed raw supply', metadataPayload({ ...liveMetadata, supply: 'not-a-raw-supply' })],
  ['wrong decimals', metadataPayload({ ...liveMetadata, decimals: 9 })],
  ['wrong raw supply', metadataPayload({ ...liveMetadata, supply: '1000000000000001' })],
  ['symbol mismatch', metadataPayload({ ...liveMetadata, symbol: 'NOT_TREE' })],
  ['GraphQL metadata error', { errors: [{ message: 'metadata fixture error' }] }],
] as const) {
  const fixture = queuedFetch([], responsePayload);
  const result = await scanSuiGraphqlLeaderboard({ fetchImpl: fixture.fetchImpl });
  assert.equal(result.outcome, 'verification-incomplete', label);
  assert.equal(result.coverage.coinMetadataVerified, false, label);
  assert.equal(result.coverage.pagesScanned, 0, label);
  assert.equal(result.holderCount, null, label);
  assert.deepEqual(result.entries, [], label);
  assert.equal(fixture.requests.length, 1, label);
  assert.ok(result.warnings.some((warning) => warning.includes('metadata')), label);
}

console.log(`Sui GraphQL provider fixtures: PASS (exact aggregate ${exactA.toString()} raw)`);
console.log('Sui GraphQL retry fixtures: PASS (bounded deadline-aware retries)');
console.log(`Reconciliation fixture: PASS (${complete.reconciliation.addressOwnedRaw} raw address-owned)`);
