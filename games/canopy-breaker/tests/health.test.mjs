import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseHealth} from '../server/health.mjs';
test('hosted readiness requires all five saved-run and payment tables', async () => {
  for (const total of [0, 4, 5]) {
    const response = await databaseHealth({query: async () => ({rows: [{total}]})});
    assert.equal(response.status, total === 5 ? 200 : 503);
    assert.deepEqual(await response.json(), {ready: total === 5});
  }
});
test('database readiness never exposes connection errors or credentials', async () => {
  const response = await databaseHealth({query: async () => {throw Error('private database credentials');}});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {ready: false});
  assert.match(response.headers.get('cache-control'), /no-store/);
});
