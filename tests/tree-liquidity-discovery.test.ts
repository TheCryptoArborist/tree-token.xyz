import assert from 'node:assert/strict';
import { KNOWN_TREE_POOLS, normalizeKnownPoolObject } from '../netlify/lib/tree-liquidity-discovery.ts';
import { TREE_PARTNER_TYPES } from '../netlify/lib/tree-liquidity-graph.ts';

assert.equal(KNOWN_TREE_POOLS.length, 5);
assert.equal(KNOWN_TREE_POOLS.filter((pool) => pool.venue === 'aftermath').length, 2);

const boomTree = normalizeKnownPoolObject('aftermath', KNOWN_TREE_POOLS[3].poolId, {
  type: `0xabc::pool::Pool<${TREE_PARTNER_TYPES.BOOM}, ${TREE_PARTNER_TYPES.TREE}>`,
});
assert.equal(boomTree.healthy, true);
assert.equal(boomTree.coinTypes.length, 2);

const treeOnly = normalizeKnownPoolObject('aftermath', '0xdead', {
  type: `0xabc::pool::Pool<${TREE_PARTNER_TYPES.TREE}, 0x999::unknown::UNKNOWN>`,
});
assert.equal(treeOnly.healthy, false);

console.log('TREE known-pool discovery normalization: PASS');
