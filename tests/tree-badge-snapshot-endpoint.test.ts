import assert from 'node:assert/strict';
import { createTreeBadgeResponse } from '../netlify/lib/tree-badge-snapshot-endpoint.ts';

const request = new Request('https://deploy-preview-6--tree-token.netlify.app/api/tree-badges', { method: 'GET' });
let triggers = 0;
const accepted = await createTreeBadgeResponse(request, {
  context: 'deploy-preview',
  now: () => Date.parse('2026-08-09T14:30:00.000Z'),
  getEnv: (name) => ({
    TREE_BADGE_AUTO_BOOTSTRAP: 'true',
    TREE_BADGE_REFRESH_SECRET: 'fixture',
  }[name]),
  readSnapshot: async () => null,
  readStatus: async () => null,
  triggerRefresh: async (incoming, secret) => {
    triggers += 1;
    assert.equal(incoming.url, request.url);
    assert.equal(secret, 'fixture');
    return 202;
  },
});
assert.equal(accepted.status, 200);
const acceptedPayload = await accepted.json();
assert.equal(acceptedPayload.status, 'refreshing');
assert.equal(acceptedPayload.refreshState, 'queued');
assert.match(acceptedPayload.message, /accepted/i);
assert.equal(triggers, 1);

const running = await createTreeBadgeResponse(request, {
  context: 'deploy-preview',
  getEnv: (name) => name === 'TREE_BADGE_AUTO_BOOTSTRAP' ? 'true' : 'fixture',
  readSnapshot: async () => null,
  readStatus: async () => ({
    state: 'running',
    stage: 'activity',
    runId: 'run',
    startedAt: '2026-08-09T14:00:00.000Z',
    updatedAt: '2026-08-09T14:01:00.000Z',
    completedAt: null,
    exposureSnapshotGeneratedAt: '2026-08-09T14:00:30.000Z',
    activityOutcome: 'pending',
    burnOutcome: 'pending',
    displayedCount: 0,
    message: 'running',
    commitRef: null,
    deployId: null,
  }),
  triggerRefresh: async () => { throw new Error('must not retrigger a running refresh'); },
});
const runningPayload = await running.json();
assert.equal(runningPayload.status, 'refreshing');
assert.equal(runningPayload.refreshState, 'running');

const failedTrigger = await createTreeBadgeResponse(request, {
  context: 'deploy-preview',
  getEnv: (name) => ({ TREE_BADGE_AUTO_BOOTSTRAP: 'true', TREE_BADGE_REFRESH_SECRET: 'fixture' }[name]),
  readSnapshot: async () => null,
  readStatus: async () => null,
  triggerRefresh: async () => 500,
});
const failedPayload = await failedTrigger.json();
assert.equal(failedPayload.status, 'not-ready');
assert.match(failedPayload.warnings.join(' '), /500/);

const production = await createTreeBadgeResponse(new Request('https://tree-token.xyz/api/tree-badges'), {
  context: 'production',
  getEnv: () => undefined,
  readSnapshot: async () => null,
  readStatus: async () => null,
});
assert.equal(production.status, 404);

const method = await createTreeBadgeResponse(new Request(request.url, { method: 'POST' }), {
  context: 'deploy-preview',
});
assert.equal(method.status, 405);
console.log('TREE badge snapshot endpoint: PASS (preview self-bootstrap, idempotent running state, and production guard)');
