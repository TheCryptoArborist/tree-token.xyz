import assert from 'node:assert/strict';
import { runTreeBadgeDeployBootstrap } from '../netlify/functions/tree-badges-on-deploy.ts';

const event = {
  deploy: {
    id: 'deploy-6',
    context: 'deploy-preview',
    branch: 'feature/leaderboard-badges-v1',
    commitRef: 'commit',
    url: 'https://deploy-preview-6--tree-token.netlify.app',
  },
};

const env = (name: string) => ({
  TREE_BADGE_PREVIEW_BRANCH: 'feature/leaderboard-badges-v1',
  TREE_BADGE_AUTO_BOOTSTRAP: 'true',
  TREE_BADGE_REFRESH_SECRET: 'fixture-secret',
  DEPLOY_PRIME_URL: 'https://deploy-preview-6--tree-token.netlify.app',
}[name]);

let fetchCalls = 0;
const accepted = await runTreeBadgeDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => null,
  fetchImpl: async (input, init) => {
    fetchCalls += 1;
    assert.equal(String(input), 'https://deploy-preview-6--tree-token.netlify.app/.netlify/functions/tree-badges-refresh-background');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('x-tree-badge-refresh-secret'), 'fixture-secret');
    return new Response(null, { status: 202 });
  },
  logger: { info() {}, error() {} },
});
assert.deepEqual(accepted, { attempted: true, outcome: 'accepted' });
assert.equal(fetchCalls, 1);

const alreadyReady = await runTreeBadgeDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => ({ complete: true }) as never,
  fetchImpl: async () => { throw new Error('must not trigger'); },
  logger: { info() {}, error() {} },
});
assert.deepEqual(alreadyReady, { attempted: false, outcome: 'already-ready' });

const missingSecret = await runTreeBadgeDeployBootstrap(event, {
  getEnv: (name) => name === 'TREE_BADGE_PREVIEW_BRANCH'
    ? 'feature/leaderboard-badges-v1'
    : name === 'TREE_BADGE_AUTO_BOOTSTRAP'
      ? 'true'
      : undefined,
  readSnapshot: async () => null,
  logger: { info() {}, error() {} },
});
assert.deepEqual(missingSecret, { attempted: false, outcome: 'missing-secret' });

const failed = await runTreeBadgeDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => null,
  fetchImpl: async () => new Response(null, { status: 500 }),
  logger: { info() {}, error() {} },
});
assert.deepEqual(failed, { attempted: true, outcome: 'trigger-failed' });

const production = await runTreeBadgeDeployBootstrap({ ...event, deploy: { ...event.deploy, context: 'production' } }, {
  getEnv: env,
  readSnapshot: async () => null,
  logger: { info() {}, error() {} },
});
assert.deepEqual(production, { attempted: false, outcome: 'skipped-context' });
console.log('TREE badge deploy bootstrap: PASS (202 background dispatch, guards, and no inline worker wait)');
