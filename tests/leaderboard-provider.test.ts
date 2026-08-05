import assert from 'node:assert/strict';
import { buildDirectTreeLeaderboard } from '../netlify/lib/leaderboard-provider.ts';

const address = (digit: string) => `0x${digit.repeat(64)}`;
const fixture = [
  { address: '0x0000000000000000000000000000000000000000000000000000000000000000', quantity: '9999', percentage: 9 },
  { address: '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc', quantity: '8888', percentage: 8 },
  { address: 'not-a-sui-address', quantity: '7777', percentage: 7 },
  { address: address('a'), quantity: '10', percentage: 1 },
  { address: address('b').toUpperCase().replace('0X', '0x'), quantity: '30', percentage: 3 },
  { address: address('c'), quantity: '20', percentage: 2 },
];
const result = buildDirectTreeLeaderboard(fixture);
assert.equal(result.excludedCount, 3);
assert.equal(result.sharedProtocolExcludedCount, 1);
assert.equal(result.displayedCount, 3);
assert.deepEqual(result.entries.map((entry) => entry.directTree), ['30', '20', '10']);
assert.deepEqual(result.entries.map((entry) => entry.rank), [1, 2, 3]);
assert.ok(result.entries.every((entry) => entry.wallet !== '0x0000000000000000000000000000000000000000000000000000000000000000'));
console.log('Leaderboard exclusion fixture: PASS (3 excluded, valid entries reranked)');
