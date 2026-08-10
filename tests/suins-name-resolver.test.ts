import assert from 'node:assert/strict';
import { resolveDefaultSuinsNames } from '../netlify/lib/suins-name-resolver.ts';

const first = `0x${'a'.repeat(64)}`;
const second = `0x${'b'.repeat(64)}`;
const third = `0x${'c'.repeat(64)}`;
let calls = 0;
const success = await resolveDefaultSuinsNames([first, second, third, first, 'invalid'], {
  client: {
    core: {
      async defaultNameServiceName({ address }) {
        calls += 1;
        if (address === first) return { name: 'cryptoarborist.sui' };
        if (address === second) throw new Error('NOT_FOUND');
        throw new Error('name%20has%20expired');
      },
    },
  },
});
assert.equal(calls, 3);
assert.equal(success.requestedCount, 3);
assert.equal(success.resolvedCount, 1);
assert.equal(success.names[first], 'cryptoarborist.sui');
assert.equal(success.names[second], null);
assert.equal(success.names[third], null);
assert.equal(success.complete, true);

const numericNotFound = await resolveDefaultSuinsNames([first], {
  client: { core: { async defaultNameServiceName() { throw Object.assign(new Error('missing'), { code: 5 }); } } },
});
assert.equal(numericNotFound.complete, true);
assert.equal(numericNotFound.names[first], null);

const failed = await resolveDefaultSuinsNames([first], {
  client: { core: { async defaultNameServiceName() { throw new Error('transport unavailable'); } } },
});
assert.equal(failed.complete, false);
assert.match(failed.networkError || '', /transport unavailable/);

let active = 0;
let peak = 0;
await resolveDefaultSuinsNames([first, second, third], {
  concurrency: 2,
  client: {
    core: {
      async defaultNameServiceName() {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { name: null };
      },
    },
  },
});
assert.ok(peak <= 2);
console.log('SuiNS gRPC resolver: PASS (deduplication, expected missing names, bounded concurrency, and safe failure)');
