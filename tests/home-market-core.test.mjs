import assert from 'node:assert/strict';
import { formatMarket, resolveHomeMarket, validMarketValue } from '../scripts/home-market-core.js';

assert.equal(validMarketValue(null), false);
assert.equal(validMarketValue(undefined), false);
assert.equal(validMarketValue(''), false);
assert.equal(validMarketValue(0), true);
assert.equal(formatMarket('marketCap', null), 'Unavailable');
assert.equal(formatMarket('liquidity', undefined), 'Unavailable');
assert.equal(formatMarket('holderCount', ''), 'Unavailable');

const partial = resolveHomeMarket({
  live: { data: { price: 0.0000234, priceChange24h: 12.5, marketCap: null, liquidity: null, holderCount: null } },
  snapshot: { tree: { totalSupply: 1_000_000_000 } },
}, { liquidity: 16_443, holderCount: 602 });

assert.equal(partial.marketCap, 23_400);
assert.equal(partial.liquidity, 16_443);
assert.equal(partial.holderCount, 602);
assert.equal(formatMarket('marketCap', partial.marketCap), '$23.4K');

const empty = resolveHomeMarket({ live: { data: null }, snapshot: { tree: {} } }, null);
assert.equal(empty.marketCap, null);
assert.equal(empty.liquidity, null);
assert.equal(empty.holderCount, null);
assert.equal(formatMarket('marketCap', empty.marketCap), 'Unavailable');

console.log('Homepage market resilience: PASS (no false zeroes, verified fallback behavior)');
