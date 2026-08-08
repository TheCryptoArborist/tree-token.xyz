import assert from 'node:assert/strict';
import { mergeNoodlesFields, normalizeNoodlesCoinDetails, normalizeNoodlesPriceVolume } from '../netlify/lib/tree-dashboard-normalizer.ts';

const details = normalizeNoodlesCoinDetails({
  data: {
    coin: { liquidity: '14470.62', market_cap: '90000.12', fdv: '120000.50', holders: 321 },
    price_change: { price: '0.0000123456', price_change_1h: 1.1, price_change_1d: 2.2, price_change_7d: 3.3 },
  },
});
assert.deepEqual({
  price: details.price,
  priceChange1h: details.priceChange1h,
  priceChange24h: details.priceChange24h,
  priceChange7d: details.priceChange7d,
  liquidity: details.liquidity,
  marketCap: details.marketCap,
  fdv: details.fdv,
  holderCount: details.holderCount,
}, {
  price: 0.0000123456,
  priceChange1h: 1.1,
  priceChange24h: 2.2,
  priceChange7d: 3.3,
  liquidity: 14470.62,
  marketCap: 90000.12,
  fdv: 120000.5,
  holderCount: 321,
});

const volume = normalizeNoodlesPriceVolume({ data: { price: 0.000012, volume_24h: 9876.54, price_change_24h: -4.5 } });
assert.deepEqual(volume, { price: 0.000012, volume24h: 9876.54, priceChange24h: -4.5 });
assert.deepEqual(
  { price: mergeNoodlesFields(details, volume).price, volume24h: mergeNoodlesFields(details, volume).volume24h },
  { price: 0.0000123456, volume24h: 9876.54 },
);
console.log('Noodles normalizer fixture: PASS');
