import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeLiquidity, USDC_COIN_TYPE, WBTC_COIN_TYPE } from '../netlify/lib/tree-liquidity-overview.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';
import { SUIDEX_V2_PACKAGE, SUIDEX_V2_TREE_POOL_ID } from '../netlify/lib/suidex-v2-tree-lp-provider.ts';
import { TURBOS_PACKAGE, TURBOS_TREE_POOL_IDS } from '../netlify/lib/turbos-tree-lp-provider.ts';
import { SUI_COIN_TYPE, TREE_V3_PACKAGE, TREE_V3_POOL_ID } from '../netlify/lib/tree-v3-overview.ts';

const prices = { suiUsd: 1, treeUsd: 0.01, usdcUsd: 1, wbtcUsd: 100_000 };
const objects = [
  { address: SUIDEX_V2_TREE_POOL_ID, type: `${SUIDEX_V2_PACKAGE}::pair::Pair<${SUI_COIN_TYPE},${TREE_COIN_TYPE}>`, json: { id: SUIDEX_V2_TREE_POOL_ID, reserve0: '1000000000', reserve1: '100000000' } },
  { address: TREE_V3_POOL_ID, type: `${TREE_V3_PACKAGE}::pool::Pool`, json: { id: TREE_V3_POOL_ID, type_x: SUI_COIN_TYPE, type_y: TREE_COIN_TYPE, tick_index: 0, sqrt_price: (1n << 64n).toString(), liquidity: '1', reserve_x: '2000000000', reserve_y: '200000000', tick_spacing: 60, swap_fee_rate: 2500 } },
  ...TURBOS_TREE_POOL_IDS.map((id, index) => ({
    address: id,
    type: `${TURBOS_PACKAGE}::pool::Pool<${TREE_COIN_TYPE},${index === 1 ? SUI_COIN_TYPE : index === 4 ? WBTC_COIN_TYPE : USDC_COIN_TYPE},0x1::fee::FEE>`,
    json: { id, coin_a: index === 1 ? '310000000' : '10', coin_b: index === 1 ? '2100000000' : '10', protocol_fees_a: index === 1 ? '10000000' : '10', protocol_fees_b: index === 1 ? '100000000' : '10', liquidity: index === 1 ? '1' : '0' },
  })),
];

test('combines verified live SuiDex V2, V3, and active Turbos reserves', () => {
  const result = calculateTreeLiquidity(objects, prices);
  assert.ok(result);
  assert.equal(result.suiDexV2TvlUsd, 2);
  assert.equal(result.suiDexV3TvlUsd, 4);
  assert.equal(result.turbosTvlUsd, 5);
  assert.equal(result.recognizedLiquidityUsd, 11);
  assert.equal(result.activeTurbosPools, 1);
});

test('fails closed when a recognized pool is missing', () => {
  assert.equal(calculateTreeLiquidity(objects.slice(0, -1), prices), null);
});
