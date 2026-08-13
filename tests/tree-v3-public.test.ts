import assert from 'node:assert/strict';
import {
  mergeTreeV3PageStats,
  normalizeSuiAddress,
  parseCompactNumber,
  parseSuiDexAnalyticsPage,
  parseSuiDexPoolPage,
  parseTreeV3PositionNode,
  visibleTextFromHtml,
} from '../netlify/lib/tree-v3-public.ts';
import { SUI_TYPE, TREE_TYPE, SUIDEX_V3_TREE_POOL } from '../netlify/lib/tree-swap-route.ts';

const poolHtml = `<!doctype html><html><body>
  <h1>SUI / Tree</h1><div>Pool APR</div><strong>45.0%</strong>
  <div>TVL</div><strong>$6.8K</strong>
  <div>Volume 24H</div><strong>$207.76</strong>
  <div>Fees 24H</div><strong>$0.52</strong>
  <div>Current:</div><strong>0.0000282189</strong><span>SUI per Tree</span>
  <div>Farm rewards: VICTORY TOKEN (4,472/day)</div>
  <div>Farm rewards: BTC (0.00011/day)</div>
  <div>Pool APR: 45.0% Fees 2.8% Rewards 42.2%</div>
</body></html>`;
const analyticsText = 'Pool Breakdown SUI/Tree 0.25% $6.97K $109.77 $0.27 9 SUI/SUITRUMP 0.25% $6.05K $2.40K $6.00 118';

assert.match(visibleTextFromHtml(poolHtml), /SUI \/ Tree/);
assert.equal(parseCompactNumber('$6.97K'), 6970);
assert.equal(parseCompactNumber('4,559'), 4559);

const pool = parseSuiDexPoolPage(poolHtml);
assert.equal(pool.tvlUsd, 6800);
assert.equal(pool.volume24hUsd, 207.76);
assert.equal(pool.fees24hUsd, 0.52);
assert.equal(pool.aprPercent, 45);
assert.equal(pool.feeAprPercent, 2.8);
assert.equal(pool.rewardAprPercent, 42.2);
assert.equal(pool.currentPriceSuiPerTree, 0.0000282189);
assert.deepEqual(pool.rewards, [
  { token: 'VICTORY TOKEN', amountPerDay: '4,472' },
  { token: 'BTC', amountPerDay: '0.00011' },
]);

const analytics = parseSuiDexAnalyticsPage(analyticsText);
assert.equal(analytics.feePercent, 0.25);
assert.equal(analytics.tvlUsd, 6970);
assert.equal(analytics.volume24hUsd, 109.77);
assert.equal(analytics.fees24hUsd, 0.27);
assert.equal(analytics.swaps24h, 9);

const merged = mergeTreeV3PageStats(pool, analytics);
assert.equal(merged.tvlUsd, 6970);
assert.equal(merged.volume24hUsd, 109.77);
assert.equal(merged.currentPriceSuiPerTree, 0.0000282189);
assert.equal(merged.aprPercent, 45);
assert.equal(merged.feePercent, 0.25);

const owner = normalizeSuiAddress('0x123');
assert.equal(owner, `0x${'123'.padStart(64, '0')}`);
assert.equal(normalizeSuiAddress('not-an-address'), null);

const position = parseTreeV3PositionNode({
  address: '0xabc',
  owner: { __typename: 'AddressOwner', address: { address: '0x123' } },
  asMoveObject: {
    contents: {
      json: {
        pool_id: SUIDEX_V3_TREE_POOL,
        type_x: SUI_TYPE,
        type_y: TREE_TYPE,
        liquidity: '1000000',
        tick_lower_index: -100,
        tick_upper_index: 100,
        owed_coin_x: '500000000',
        owed_coin_y: '2500000',
      },
    },
  },
}, 0);
assert.ok(position);
assert.equal(position.owner, owner);
assert.equal(position.inRange, true);
assert.equal(position.treeSide, 'y');
assert.equal(position.owedTreeRaw, '2500000');
assert.equal(position.owedSuiRaw, '500000000');

assert.equal(parseTreeV3PositionNode({
  address: '0xabc',
  owner: { __typename: 'ObjectOwner', address: { address: '0x123' } },
  asMoveObject: { contents: { json: { pool_id: SUIDEX_V3_TREE_POOL } } },
}, 0), null);

console.log('TREE V3 public provider: PASS (page stats, analytics row, exact pool/owner validation, position range and owed-token mapping)');
