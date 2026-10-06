import assert from 'node:assert/strict';
import { parseTreeV3Incentives, TREE_V3_POOL_ID, TREE_V3_REWARD_TOKENS, normalizeCoinType } from '../netlify/lib/tree-v3-overview.ts';
const coin = TREE_V3_REWARD_TOKENS[0].coinType;
const now = 1791322920, end = 1794029168;
const pool = { poolId: TREE_V3_POOL_ID, tokenX: '0x2::sui::sui', tokenY: '0x123::tree::tree', tvlUsdEstimate: 11482.62210372257 } as any;
const accounting = { rewards: [{ coinType: normalizeCoinType(coin), rewardPerSecondX64Raw: '861288819207598583795185', endsAtSeconds: end }] } as any;
const source = { pool_id: TREE_V3_POOL_ID, token_x_type: pool.tokenX, token_y_type: pool.tokenY,
  approved: true, fee_rate: 2500, tick_spacing: 60, tvl_usd: 11295.31, active_tvl_usd: 8034.57,
  volume_24h_usd: 0, fees_24h_usd: 0, fee_apr: 1.7396478738489602, total_apr: 4.708496602192357,
  rewards: [{ coin_type: coin, decimals: 6, per_day: '4034064422', price_usd: .000162, ended_at: end }] };
const payload = () => ({ pools: [structuredClone(source)], tokenPrices: { [coin]: .000162 } });
const result = parseTreeV3Incentives(payload(), pool, accounting, now)!;
assert.equal(result.status, 'estimated');
assert.equal(result.rewards[0].symbol, 'VICTORY');
assert.ok(Math.abs(result.rewardAprPercent - 2.968848728343396) < 1e-10);
assert.equal(result.denominator, 'suidex-active-tvl');
for (const mutate of [
  (p:any) => p.pools[0].rewards[0].per_day = '9999999999',
  (p:any) => p.pools[0].rewards[0].ended_at = end + 1,
  (p:any) => p.pools[0].rewards[0].decimals = 9,
  (p:any) => p.pools[0].rewards[0].price_usd = 1,
  (p:any) => p.pools[0].active_tvl_usd = 999999,
  (p:any) => p.pools[0].active_tvl_usd = null,
  (p:any) => p.pools[0].rewards = [],
  (p:any) => p.pools[0].token_x_type = '0x2::fake::FAKE',
]) { const p = payload(); mutate(p); assert.equal(parseTreeV3Incentives(p, pool, accounting, now), null); }
assert.equal(parseTreeV3Incentives(payload(), pool, null, now), null);
assert.equal(parseTreeV3Incentives(payload(), pool, accounting, end + 1)?.rewardAprPercent, 0);
console.log('Independent VICTORY emissions and denominator checks passed.');
