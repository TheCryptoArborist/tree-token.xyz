import assert from 'node:assert/strict';
import { buildVerifiedExposureSnapshot } from '../netlify/lib/tree-exposure-aggregator.ts';
import type { ExposureVenue, ExposureVenueResult } from '../netlify/lib/tree-exposure-types.ts';

const a = `0x${'a'.repeat(64)}`;
const b = `0x${'b'.repeat(64)}`;
const complete = (venue: ExposureVenue, positions: ExposureVenueResult['positions'] = []): ExposureVenueResult => ({
  venue, outcome: 'complete', generatedAt: '2026-08-09T00:00:00.000Z', positions, warnings: [], coverage: {},
});
const venues = {
  suiDexV2: complete('suiDexV2', [{ wallet: a, venue: 'suiDexV2', lpTreeRaw: '200000000', positionCount: 2 }]),
  suiDexV3: complete('suiDexV3'),
  turbos: complete('turbos'),
};
const result = buildVerifiedExposureSnapshot({
  generatedAt: '2026-08-09T00:00:00.000Z', directTreeComplete: true, venueResults: venues,
  directEntries: [
    { wallet: a, suinsName: 'alpha.sui', directTreeRaw: '100000000', coinObjectCount: 1 },
    { wallet: b, directTreeRaw: '250000000', coinObjectCount: 1 },
  ],
});
assert.equal(result.outcome, 'complete');
assert.equal(result.entries[0].wallet, a);
assert.equal(result.entries[0].liquidTreeRaw, '100000000');
assert.equal(result.entries[0].lpTreeRaw, '200000000');
assert.equal(result.entries[0].totalExposureRaw, '300000000');
assert.deepEqual(result.entries[0].badges, ['lp-provider', 'lp-maxi']);
assert.equal(result.entries[0].lpBreakdown.suiDexV2Raw, '200000000');
assert.equal(result.entries[1].wallet, b);

const incomplete = buildVerifiedExposureSnapshot({
  directTreeComplete: true,
  directEntries: [{ wallet: a, directTreeRaw: '100' }],
  venueResults: { ...venues, turbos: { ...venues.turbos, outcome: 'verification-incomplete' } },
});
assert.equal(incomplete.outcome, 'verification-incomplete');
assert.equal(incomplete.entries.length, 0);
assert.match(incomplete.warnings.at(-1) || '', /partial exposure rankings were not published/);

const tie = buildVerifiedExposureSnapshot({
  directTreeComplete: true,
  directEntries: [{ wallet: a, directTreeRaw: '100' }, { wallet: b, directTreeRaw: '150' }],
  venueResults: {
    suiDexV2: complete('suiDexV2', [{ wallet: a, venue: 'suiDexV2', lpTreeRaw: '100', positionCount: 1 }, { wallet: b, venue: 'suiDexV2', lpTreeRaw: '50', positionCount: 1 }]),
    suiDexV3: complete('suiDexV3'), turbos: complete('turbos'),
  },
});
assert.equal(tie.entries[0].wallet, b, 'Higher liquid TREE breaks equal total-exposure ties.');
console.log('TREE exposure aggregator: PASS (total ranking, Liquid + LP breakdown, LP badges, complete-only publication)');
