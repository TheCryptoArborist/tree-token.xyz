import assert from 'node:assert/strict';
import seed from '../data/tree-market-last-verified.json' with { type: 'json' };
import {
  TREE_DASHBOARD_LAST_VERIFIED_KEY,
  hasCoreMarketFields,
  mergeLiveFields,
  readCachedTreeMarket,
  validCachedTreeMarket,
  writeCachedTreeMarket,
  type TreeDashboardStore,
} from '../netlify/lib/tree-dashboard-cache.ts';

class MemoryStore implements TreeDashboardStore {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
}

assert.equal(validCachedTreeMarket(seed), true);
assert.equal(hasCoreMarketFields(seed.data), true);
assert.equal(hasCoreMarketFields({ ...seed.data, liquidity: null }), false);

const merged = mergeLiveFields({ price: 0.000024, priceChange24h: 10 }, seed.data);
assert.equal(merged.price, 0.000024);
assert.equal(merged.priceChange24h, 10);
assert.equal(merged.marketCap, 23408);
assert.equal(merged.liquidity, 16443);
assert.equal(merged.holderCount, 602);

const store = new MemoryStore();
assert.equal(await readCachedTreeMarket(store), null);
assert.equal(await writeCachedTreeMarket(seed, store), true);
assert.deepEqual(await readCachedTreeMarket(store), seed);
store.values.set(TREE_DASHBOARD_LAST_VERIFIED_KEY, { ...seed, data: { ...seed.data, holderCount: null } });
assert.equal(await readCachedTreeMarket(store), null);

console.log('TREE dashboard durable cache: PASS (complete-only writes and last-verified fallback)');
