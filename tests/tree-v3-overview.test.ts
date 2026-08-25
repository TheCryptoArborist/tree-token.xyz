import assert from 'node:assert/strict';
import {
  SUI_COIN_TYPE,
  TREE_V3_POOL_ID,
  formatRawAmount,
  normalizeCoinType,
  parseTreeV3Pool,
  parseTreeV3Position,
} from '../netlify/lib/tree-v3-overview.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';

const Q64 = 1n << 64n;
const owner = `0x${'a'.repeat(64)}`;

assert.equal(normalizeCoinType('0x0002::sui::SUI'), '0x2::sui::sui');
assert.equal(formatRawAmount(1234567890n, 9), '1.23456789');

const pool = parseTreeV3Pool({
  id: TREE_V3_POOL_ID,
  type_x: TREE_COIN_TYPE,
  type_y: SUI_COIN_TYPE,
  tick_index: '0',
  sqrt_price: Q64.toString(),
  liquidity: '9007199254741000',
  reserve_x: '25000000',
  reserve_y: '25000000000',
}, { suiUsd: 1, treeUsd: 0.001 });

assert.ok(pool);
assert.equal(pool.priceSuiPerTree, '0.001');
assert.equal(pool.priceTreePerSui, '1000');
assert.equal(pool.reserveTree, '25');
assert.equal(pool.reserveSui, '25');
assert.equal(pool.tvlUsdEstimate, 25.025);
assert.equal(pool.feePercent, 0.25);

const position = parseTreeV3Position({
  address: `0x${'b'.repeat(64)}`,
  owner: { __typename: 'AddressOwner', address: { address: owner } },
  asMoveObject: { contents: { json: {
    pool_id: TREE_V3_POOL_ID,
    type_x: TREE_COIN_TYPE,
    type_y: SUI_COIN_TYPE,
    liquidity: '123456789',
    tick_lower_index: '-10',
    tick_upper_index: '10',
    owed_coin_x: '500000',
    owed_coin_y: '100000000',
  } } },
}, owner, pool);

assert.ok(position);
assert.equal(position.inRange, true);
assert.equal(position.owedTreeRaw, '500000');
assert.equal(position.owedSuiRaw, '100000000');
assert.equal(position.tickLower, -10);
assert.equal(position.tickUpper, 10);

assert.equal(parseTreeV3Position({
  address: `0x${'c'.repeat(64)}`,
  owner: { __typename: 'ObjectOwner', address: { address: owner } },
  asMoveObject: { contents: { json: {} } },
}, owner, pool), null);

assert.equal(parseTreeV3Pool({
  id: TREE_V3_POOL_ID,
  type_x: TREE_COIN_TYPE,
  type_y: TREE_COIN_TYPE,
  tick_index: 0,
  sqrt_price: Q64.toString(),
  liquidity: '1', reserve_x: '1', reserve_y: '1',
}), null);

console.log('TREE V3 overview fixtures passed.');
