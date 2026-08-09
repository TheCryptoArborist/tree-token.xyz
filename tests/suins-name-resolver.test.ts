import assert from 'node:assert/strict';
import { buildDefaultSuinsQuery, resolveDefaultSuinsNames } from '../netlify/lib/suins-name-resolver.ts';

const first = `0x${'a'.repeat(64)}`;
const second = `0x${'b'.repeat(64)}`;
const built = buildDefaultSuinsQuery([first, second]);
assert.match(built.query, /defaultSuinsName/);
assert.equal(built.variables.address0, first);
assert.equal(built.variables.address1, second);

let requests = 0;
const success = await resolveDefaultSuinsNames([first, second, first, 'invalid'], {
  fetchImpl: async (_url, init) => {
    requests += 1;
    const body = JSON.parse(String(init?.body));
    assert.equal(Object.keys(body.variables).length, 2);
    return new Response(JSON.stringify({ data: {
      name0: { defaultSuinsName: 'cryptoarborist.sui' },
      name1: { defaultSuinsName: null },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(requests, 1);
assert.equal(success.requestedCount, 2);
assert.equal(success.resolvedCount, 1);
assert.equal(success.names[first], 'cryptoarborist.sui');
assert.equal(success.names[second], null);
assert.equal(success.complete, true);

const partial = await resolveDefaultSuinsNames([first], {
  fetchImpl: async () => new Response(JSON.stringify({
    data: { name0: { defaultSuinsName: 'name.sui' } },
    errors: [{ message: 'partial fixture' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
});
assert.equal(partial.names[first], 'name.sui');
assert.equal(partial.complete, false);
assert.deepEqual(partial.graphqlErrors, ['partial fixture']);

const failed = await resolveDefaultSuinsNames([first], {
  fetchImpl: async () => new Response('', { status: 503 }),
});
assert.equal(failed.complete, false);
assert.match(failed.networkError || '', /503/);
console.log('SuiNS name resolver: PASS (batching, deduplication, fallback, and safe failure)');
