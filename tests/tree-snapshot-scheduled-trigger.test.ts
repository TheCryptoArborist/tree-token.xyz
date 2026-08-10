import assert from 'node:assert/strict';
import { runTreeSnapshotScheduledTrigger } from '../netlify/lib/tree-snapshot-scheduled-trigger.ts';

const productionContext = {
  deploy: { context: 'production', id: 'deploy-id', published: true },
  site: { url: 'https://tree-token.xyz' },
};
const silent = { info() {}, error() {} };

const outside = await runTreeSnapshotScheduledTrigger('exposure', {
  ...productionContext,
  deploy: { ...productionContext.deploy, context: 'deploy-preview' },
}, { logger: silent });
assert.deepEqual(outside, { attempted: false, accepted: false, reason: 'not-production' });

const disabled = await runTreeSnapshotScheduledTrigger('exposure', productionContext, {
  getEnv: () => undefined,
  logger: silent,
});
assert.deepEqual(disabled, { attempted: false, accepted: false, reason: 'disabled' });

const missingSecret = await runTreeSnapshotScheduledTrigger('exposure', productionContext, {
  getEnv: (name) => name === 'TREE_EXPOSURE_PRODUCTION_ENABLED' ? 'true' : undefined,
  logger: silent,
});
assert.deepEqual(missingSecret, { attempted: false, accepted: false, reason: 'missing-secret' });

let exposureCalls = 0;
const exposureAccepted = await runTreeSnapshotScheduledTrigger('exposure', productionContext, {
  getEnv: (name) => ({
    TREE_EXPOSURE_PRODUCTION_ENABLED: 'true',
    TREE_EXPOSURE_REFRESH_SECRET: 'exposure-secret',
  }[name]),
  fetchImpl: async (input, init) => {
    exposureCalls += 1;
    assert.equal(String(input), 'https://tree-token.xyz/.netlify/functions/tree-exposure-refresh-background');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('x-tree-exposure-refresh-secret'), 'exposure-secret');
    return new Response(null, { status: 202 });
  },
  logger: silent,
});
assert.deepEqual(exposureAccepted, { attempted: true, accepted: true, reason: 'accepted' });
assert.equal(exposureCalls, 1);

const badgeAccepted = await runTreeSnapshotScheduledTrigger('badges', productionContext, {
  getEnv: (name) => ({
    TREE_BADGE_PRODUCTION_ENABLED: 'true',
    TREE_BADGE_REFRESH_SECRET: 'badge-secret',
  }[name]),
  fetchImpl: async (input, init) => {
    assert.equal(String(input), 'https://tree-token.xyz/.netlify/functions/tree-badges-refresh-background');
    assert.equal(new Headers(init?.headers).get('x-tree-badge-refresh-secret'), 'badge-secret');
    return new Response(null, { status: 202 });
  },
  logger: silent,
});
assert.deepEqual(badgeAccepted, { attempted: true, accepted: true, reason: 'accepted' });

const unexpected = await runTreeSnapshotScheduledTrigger('badges', productionContext, {
  getEnv: (name) => ({ TREE_BADGE_PRODUCTION_ENABLED: 'true', TREE_BADGE_REFRESH_SECRET: 'secret' }[name]),
  fetchImpl: async () => new Response(null, { status: 500 }),
  logger: silent,
});
assert.deepEqual(unexpected, { attempted: true, accepted: false, reason: 'unexpected-status' });

const network = await runTreeSnapshotScheduledTrigger('badges', productionContext, {
  getEnv: (name) => ({ TREE_BADGE_PRODUCTION_ENABLED: 'true', TREE_BADGE_REFRESH_SECRET: 'secret' }[name]),
  fetchImpl: async () => { throw new Error('network'); },
  logger: silent,
});
assert.deepEqual(network, { attempted: true, accepted: false, reason: 'network-error' });

const timeout = await runTreeSnapshotScheduledTrigger('exposure', productionContext, {
  getEnv: (name) => ({ TREE_EXPOSURE_PRODUCTION_ENABLED: 'true', TREE_EXPOSURE_REFRESH_SECRET: 'secret' }[name]),
  requestTimeoutMs: 1,
  fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }),
  logger: silent,
});
assert.deepEqual(timeout, { attempted: true, accepted: false, reason: 'timeout' });

console.log('TREE snapshot scheduled triggers: PASS (production guards, dedicated secrets, accepted dispatch, timeout and failure handling)');
