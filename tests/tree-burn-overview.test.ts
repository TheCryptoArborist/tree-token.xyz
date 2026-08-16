import test from 'node:test';
import assert from 'node:assert/strict';
import { burnOverviewFromRaw } from '../netlify/functions/tree-burn-overview.ts';

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
