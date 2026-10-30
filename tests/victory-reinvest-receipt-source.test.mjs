import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../dapp/victory-center.js', import.meta.url), 'utf8');

test('receipt uses finalized events and displays exact lock and liquidity values', () => {
  assert.match(source, /function showVictoryV3ReinvestReceipt/);
  for (const field of ['VICTORY locked', 'Lock ID', 'Unlock date', 'VICTORY reinvested', 'TREE added to liquidity', 'SUI added to liquidity', 'Venue', 'Position']) {
    assert.ok(source.includes(field), field);
  }
  assert.match(source, /showVictoryV3ReinvestReceipt\(\{ digest: txDigest, sustainable, lock: finalizedLock, reinvestRaw: amounts\.reinvestRaw, added: finalizedAdded/);
  assert.match(source, /if \(!finalizedAdded \|\| extractVictoryLocked\(finalized, owner\) !== amounts\.totalRaw \|\| \(sustainable && !finalizedLock\)\)/);
  assert.doesNotMatch(source, /reinvestSuccess\.innerHTML/);
  assert.match(source, /root\.replaceChildren\(\)/);
  assert.match(source, /Liquidity addition does not mean the position was staked/);
});
