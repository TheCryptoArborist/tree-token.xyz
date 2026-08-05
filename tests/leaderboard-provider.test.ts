import assert from 'node:assert/strict';
import { excludedAddress, normalizeSuiAddress, tierForRank } from '../netlify/lib/leaderboard-provider.ts';

const pool = '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';
assert.equal(normalizeSuiAddress(pool.toUpperCase().replace('0X', '0x')), pool);
assert.equal(normalizeSuiAddress('not-an-address'), null);
assert.equal(excludedAddress(pool)?.category, 'shared-protocol-object');
assert.deepEqual([1, 6, 11, 21, 31].map(tierForRank), ['Ancient Grove', 'Giant Sequoia', 'Heritage Oak', 'Canopy Guardian', 'Forest Keeper']);
console.log('Leaderboard shared helpers: PASS');
