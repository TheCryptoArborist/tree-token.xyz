import assert from 'node:assert/strict';
import { runCompleteTreeExposureScan } from '../netlify/lib/tree-exposure-scan-runner.ts';
import { validateCompleteExposureSnapshot } from '../netlify/lib/tree-exposure-cache.ts';
import type { SuiGraphqlScanResult } from '../netlify/lib/sui-graphql-leaderboard-provider.ts';
import type { ExposureVenueResult } from '../netlify/lib/tree-exposure-types.ts';
import { fixtureAddress } from './fixtures/tree-exposure-fixture.ts';

const directCandidates = Array.from({ length: 50 }, (_, index) => {
  const rank = index + 1;
  let raw = 100_000_000_000n - BigInt(rank) * 1_000_000_000n;
  if (rank === 1) raw = 40_000_000_000n;
  else if (rank === 2) raw = 99_000_000_000n;
  else if (rank === 3) raw = 96_000_000_000n;
  return {
    wallet: fixtureAddress(rank),
    suinsName: null,
    directTreeRaw: raw.toString(),
    coinObjectCount: 1,
  };
});
const totalDirectRaw = directCandidates.reduce((sum, entry) => sum + BigInt(entry.directTreeRaw), 0n);

const completeDirect = {
  outcome: 'complete',
  provider: 'sui-graphql',
  generatedAt: '2026-08-09T04:40:00.000Z',
  methodologyVersion: 'direct-tree-sui-graphql-poc-v2',
  coverage: {
    pagesScanned: 2,
    objectsScanned: 50,
    uniqueAddressOwners: 50,
  },
  reconciliation: { addressOwnedRaw: totalDirectRaw.toString() },
  verifiedAddressOwners: 50,
  eligibleRankedOwners: 50,
  exposureCandidates: directCandidates,
  entries: [],
  warnings: [],
} as unknown as SuiGraphqlScanResult;

function venue(
  name: 'suiDexV2' | 'suiDexV3' | 'turbos',
  positions: ExposureVenueResult['positions'],
  outcome: ExposureVenueResult['outcome'] = 'complete',
): ExposureVenueResult {
  return {
    venue: name,
    outcome,
    generatedAt: '2026-08-09T04:41:00.000Z',
    positions: outcome === 'complete' ? positions : [],
    warnings: outcome === 'complete' ? [] : [`${name} incomplete`],
    coverage: { scanComplete: outcome === 'complete' },
  };
}

const v2 = venue('suiDexV2', [{
  wallet: fixtureAddress(3),
  venue: 'suiDexV2',
  lpTreeRaw: '1000000000',
  positionCount: 1,
}]);
const v3 = venue('suiDexV3', [{
  wallet: fixtureAddress(1),
  venue: 'suiDexV3',
  lpTreeRaw: '61000000000',
  positionCount: 1,
}]);
const turbos = venue('turbos', []);

const stages: string[] = [];
const complete = await runCompleteTreeExposureScan({
  getEnv: () => undefined,
  now: () => Date.parse('2026-08-09T04:45:09.542Z'),
  directScan: async () => completeDirect,
  suiDexV2Scan: async () => v2 as never,
  suiDexV3Scan: async () => v3 as never,
  turbosScan: async () => turbos as never,
  resolveSuins: async (wallets) => ({
    names: Object.fromEntries(wallets.map((wallet) => [wallet, wallet === fixtureAddress(1) ? 'leader.sui' : null])),
    requestedCount: wallets.length,
    resolvedCount: 1,
    complete: true,
    graphqlErrors: [],
    networkError: null,
    generatedAt: '2026-08-09T04:45:10.000Z',
  }),
  onProgress: (progress) => { stages.push(progress.stage); },
});
assert.equal(complete.outcome, 'complete');
assert.equal(complete.stage, 'complete');
assert.ok(complete.snapshot);
assert.equal(validateCompleteExposureSnapshot(complete.snapshot), true);
assert.equal(complete.snapshot.entries.length, 50);
assert.equal(complete.snapshot.entries[0].wallet, fixtureAddress(1));
assert.equal(complete.snapshot.entries[0].totalExposureRaw, '101000000000');
assert.equal(complete.snapshot.entries[0].suinsName, 'leader.sui');
assert.deepEqual(complete.snapshot.entries[0].badges, ['lp-provider', 'lp-maxi']);
assert.equal(complete.snapshot.entries[1].wallet, fixtureAddress(2));
assert.equal(complete.snapshot.entries[2].wallet, fixtureAddress(3));
assert.equal(complete.snapshot.source.direct.exposureCandidateCount, 50);
assert.equal(complete.snapshot.source.venues.suiDexV3.principalTreeRaw, '61000000000');
assert.ok(stages.includes('direct-tree'));
assert.ok(stages.includes('suidex-v2'));
assert.ok(stages.includes('suidex-v3'));
assert.ok(stages.includes('turbos'));
assert.ok(stages.includes('aggregate'));
assert.ok(stages.includes('suins'));
assert.equal(stages.at(-1), 'complete');

const suinsUnavailable = await runCompleteTreeExposureScan({
  getEnv: () => undefined,
  now: () => Date.parse('2026-08-09T04:45:09.542Z'),
  directScan: async () => completeDirect,
  suiDexV2Scan: async () => v2 as never,
  suiDexV3Scan: async () => v3 as never,
  turbosScan: async () => turbos as never,
  resolveSuins: async () => { throw new Error('fixture SuiNS outage'); },
});
assert.equal(suinsUnavailable.outcome, 'complete');
assert.ok(suinsUnavailable.snapshot);
assert.equal(suinsUnavailable.snapshot.entries[0].suinsName, null);
assert.equal(suinsUnavailable.snapshot.source.suins.complete, false);
assert.ok(suinsUnavailable.snapshot.warnings.some((warning) => warning.includes('SuiNS')));
assert.equal(validateCompleteExposureSnapshot(suinsUnavailable.snapshot), true);

let turbosCalls = 0;
const v3Incomplete = await runCompleteTreeExposureScan({
  getEnv: () => undefined,
  directScan: async () => completeDirect,
  suiDexV2Scan: async () => v2 as never,
  suiDexV3Scan: async () => venue('suiDexV3', [], 'verification-incomplete') as never,
  turbosScan: async () => { turbosCalls += 1; return turbos as never; },
});
assert.equal(v3Incomplete.outcome, 'verification-incomplete');
assert.equal(v3Incomplete.stage, 'suidex-v3');
assert.equal(v3Incomplete.snapshot, null);
assert.equal(turbosCalls, 0);

let v2Calls = 0;
const directIncomplete = await runCompleteTreeExposureScan({
  getEnv: () => undefined,
  directScan: async () => ({
    ...completeDirect,
    outcome: 'verification-incomplete',
    exposureCandidates: null,
    verifiedAddressOwners: null,
    eligibleRankedOwners: null,
    warnings: ['direct incomplete'],
  }),
  suiDexV2Scan: async () => { v2Calls += 1; return v2 as never; },
});
assert.equal(directIncomplete.outcome, 'verification-incomplete');
assert.equal(directIncomplete.stage, 'direct-tree');
assert.equal(directIncomplete.snapshot, null);
assert.equal(v2Calls, 0);

console.log('TREE exposure scan runner: PASS (complete direct + V2 + V3 + Turbos aggregation, SuiNS enrichment, fail-closed stages)');
