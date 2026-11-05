import assert from 'node:assert/strict';
import { aftermathPoolToCandidate } from '../netlify/lib/aftermath-tree-discovery.ts';
import { TREE_TYPE } from '../netlify/lib/tree-swap-route.ts';
import { TREE_PARTNER_TYPES } from '../netlify/lib/tree-liquidity-graph.ts';

const boomTree = aftermathPoolToCandidate({
  pool: {
    objectId: '0x2EB0',
    coins: {
      [TREE_TYPE]: { balance: 1n },
      [TREE_PARTNER_TYPES.BOOM]: { balance: 1n },
    },
  },
});
assert.ok(boomTree);
assert.equal(boomTree?.venue, 'aftermath');
assert.equal(boomTree?.poolId, '0x2eb0');
assert.equal(boomTree?.coinTypes.length, 2);

const unrelated = aftermathPoolToCandidate({
  pool: {
    objectId: '0x123',
    coins: {
      '0x2::sui::SUI': { balance: 1n },
      [TREE_PARTNER_TYPES.BOOM]: { balance: 1n },
    },
  },
});
assert.equal(unrelated, null);
console.log('Aftermath TREE venue discovery adapter: PASS');
