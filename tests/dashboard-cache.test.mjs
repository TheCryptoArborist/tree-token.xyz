import assert from 'node:assert/strict';
import { formatTreePrice, readDashboardCache, writeDashboardCache } from '../dapp/app.js';

const values = new Map([["tree-dashboard-last-success-v1", '{corrupt-json']]);
let removed = false;
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => { removed = true; values.delete(key); },
};
assert.equal(readDashboardCache(), null);
assert.equal(removed, true);
assert.equal(writeDashboardCache({ generatedAt: 'now', data: { price: 0.000000123456 } }), true);
assert.equal(readDashboardCache().data.price, 0.000000123456);
assert.notEqual(formatTreePrice(0.000000123456), '$0.00');
globalThis.localStorage.setItem = () => { throw new Error('quota'); };
assert.equal(writeDashboardCache({ data: {} }), false);
console.log('Dashboard cache safety fixture: PASS');
