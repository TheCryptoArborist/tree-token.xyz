import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseHealth} from '../server/health.mjs';
test('hosted readiness requires saved-run, payment and both leaderboard tables', async () => {
  for (const total of [0, 5, 6, 7]) {
    const response = await databaseHealth({query: async () => ({rows: [{total}]})});
    assert.equal(response.status, total === 7 ? 200 : 503);
    assert.deepEqual(await response.json(), {ready: total === 7});
  }
});
test('database readiness never exposes connection errors or credentials', async () => {
  const response = await databaseHealth({query: async () => {throw Error('private database credentials');}});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {ready: false});
  assert.match(response.headers.get('cache-control'), /no-store/);
});
