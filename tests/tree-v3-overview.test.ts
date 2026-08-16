import assert from 'node:assert/strict';
import {
  SUI_COIN_TYPE,
  TREE_V3_POOL_ID,
  formatRawAmount,
  normalizeCoinType,
  parseSignedI32,
  parseSuiDexV3Analytics,
  parseTreeV3PoolAccounting,
  parseTreeV3TickState,
  parseTreeV3Pool,
  parseTreeV3Position,
  valueTreeV3Position,
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
  tick_spacing: 60,
  swap_fee_rate: 2500,
}, { suiUsd: 1, treeUsd: 0.001 });

assert.ok(pool);
assert.equal(pool.priceSuiPerTree, '0.001');
assert.equal(pool.priceTreePerSui, '1000');
assert.equal(pool.reserveTree, '25');
assert.equal(pool.reserveSui, '25');
assert.equal(pool.tvlUsdEstimate, 25.025);
assert.equal(pool.feePercent, 0.25);
assert.equal(pool.tickSpacing, 60);
assert.equal(pool.verified, true);
assert.equal(parseSignedI32({ bits: 4294967246 }), -50);
assert.equal(parseSignedI32({ bits: '4294967246' }), -50);

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
    fee_growth_inside_x_last: '800',
    fee_growth_inside_y_last: '1700',
    reward_infos: [{ reward_growth_inside_last: '4900', coins_owed_reward: '7' }],
  } } },
}, owner, pool);

assert.ok(position);
assert.equal(position.inRange, true);
assert.equal(position.owedTreeRaw, '500000');
assert.equal(position.owedSuiRaw, '100000000');
assert.equal(position.tickLower, -10);
assert.equal(position.tickUpper, 10);

const accounting = parseTreeV3PoolAccounting({
  id: TREE_V3_POOL_ID,
  ticks: { id: `0x${'d'.repeat(64)}` },
  fee_growth_global_x: '1000',
  fee_growth_global_y: '2000',
  reward_infos: [{
    reward_coin_type: '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::victory_token::VICTORY_TOKEN',
    reward_growth_global: '5000', reward_per_seconds: '0', last_update_time: '2000', ended_at_seconds: '2000',
  }],
}, pool);
assert.ok(accounting);
const lowerTick = parseTreeV3TickState({ bits: 4294967286 }, {
  fee_growth_outside_x: '100', fee_growth_outside_y: '200', reward_growths_outside: ['10'],
});
const upperTick = parseTreeV3TickState({ bits: 10 }, {
  fee_growth_outside_x: '20', fee_growth_outside_y: '30', reward_growths_outside: ['5'],
});
assert.ok(lowerTick);
assert.ok(upperTick);
const valued = valueTreeV3Position({ ...position, liquidityRaw: Q64.toString() }, pool, accounting, new Map([
  [-10, lowerTick], [10, upperTick],
]), {
  suiUsd: 1,
  treeUsd: 0.001,
  rewardsUsd: { [accounting.rewards[0].coinType]: 2 },
}, 2000);
assert.equal(valued.accountingStatus, 'verified');
assert.equal(valued.pendingFeeTreeRaw, '500080');
assert.equal(valued.pendingFeeSuiRaw, '100000070');
assert.equal(valued.rewards?.[0].amountRaw, '92');
assert.equal(valued.rewards?.[0].symbol, 'VICTORY');
assert.ok(Number(valued.principalSui) > 0);
assert.ok(Number(valued.principalTree) > 0);
assert.ok(valued.valueUsd !== null && valued.valueUsd > 0);

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
  liquidity: '1', reserve_x: '1', reserve_y: '1', tick_spacing: 60, swap_fee_rate: 2500,
}), null);

const victoryType = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::victory_token::VICTORY_TOKEN';
const analyticsTvl = pool.tvlUsdEstimate!;
const analyticsFees = 2.5;
const feeApr = analyticsFees * 365 / analyticsTvl * 100;
const rewardApr = 100 * 1 * 365 / analyticsTvl * 100;
const analytics = parseSuiDexV3Analytics({
  pools: [{
    pool_id: TREE_V3_POOL_ID,
    token_x_type: TREE_COIN_TYPE,
    token_y_type: SUI_COIN_TYPE,
    fee_rate: 2500,
    tick_spacing: 60,
    approved: true,
    tvl_usd: analyticsTvl,
    volume_24h_usd: 1000,
    fees_24h_usd: analyticsFees,
    fee_apr: feeApr,
    reward_apr: rewardApr,
    total_apr: feeApr + rewardApr,
    rewards: [{
      coin_type: victoryType,
      symbol: 'VICTORY_TOKEN',
      decimals: 6,
      per_day: '100000000',
      price_usd: 1,
      ended_at: 2_000_000_000,
    }],
  }],
  tokenPrices: { [victoryType]: 1 },
}, pool, 1_900_000_000);

assert.ok(analytics);
assert.equal(analytics.volume24hUsd, 1000);
assert.equal(analytics.fees24hUsd, 2.5);
assert.equal(analytics.rewards.length, 1);
assert.equal(analytics.rewards[0].symbol, 'VICTORY');
assert.equal(analytics.rewards[0].perDay, 100);
assert.equal(analytics.aprPercent, feeApr + rewardApr);

assert.equal(parseSuiDexV3Analytics({ pools: [{
  pool_id: TREE_V3_POOL_ID, token_x_type: TREE_COIN_TYPE, token_y_type: SUI_COIN_TYPE,
  fee_rate: 2500, tick_spacing: 60, approved: true, tvl_usd: analyticsTvl,
  volume_24h_usd: 1000, fees_24h_usd: 999, fee_apr: 0, reward_apr: 0, total_apr: 0, rewards: [],
}], tokenPrices: {} }, pool, 1_900_000_000), null);

console.log('TREE V3 overview fixtures passed.');
