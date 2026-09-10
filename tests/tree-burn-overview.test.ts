import test from 'node:test';
import assert from 'node:assert/strict';
import { burnOverviewFromRaw } from '../netlify/functions/tree-burn-overview.ts';
import { TREE_BURN_HISTORY_SNAPSHOT, burnAge, verifiedBurnHistory } from '../netlify/lib/tree-burn-history-snapshot.ts';

test('live zero-address TREE balance derives effective supply and removal percentage', () => {
  const overview = burnOverviewFromRaw('60422789609865');
  assert.equal(overview.zeroAddressBalance, '60422789.609865');
  assert.equal(overview.totalSupply, '1000000000');
  assert.equal(overview.effectiveSupply, '939577210.390135');
  assert.equal(overview.removalPercentage, 6.042278);
});

test('burn overview rejects impossible balances', () => {
  assert.throws(() => burnOverviewFromRaw('1000000000000001'), /exceeds verified supply/);
  assert.throws(() => burnOverviewFromRaw('-1'), /Invalid TREE balance/);
});

test('verified burn history reconciles to the live zero-address balance', () => {
  const overview = burnOverviewFromRaw('60422789609865');
  const history = verifiedBurnHistory(Date.parse('2026-08-18T20:52:06.422Z'));
  assert.equal(history.totalBurned, overview.zeroAddressBalance);
  assert.equal(history.coinObjects, 1507);
  assert.equal(history.totalTransactions, 722);
  assert.equal(history.recentBurns.length, 3);
  assert.equal(history.recentBurns[0].digest, '45RWDeLWdMgy28kT1CASSft2SF5QgTV41BbZhSQ8Syhc');
  assert.equal(history.recentBurns[0].age, '2d');
});

test('burn ages remain safe for invalid or future timestamps', () => {
  const now = Date.parse(TREE_BURN_HISTORY_SNAPSHOT.generatedAt);
  assert.equal(burnAge('invalid', now), '—');
  assert.equal(burnAge('2027-01-01T00:00:00.000Z', now), '—');
});
