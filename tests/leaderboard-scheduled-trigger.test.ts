import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { config } from '../netlify/functions/tree-leaderboard-refresh-scheduled.ts';
import {
  runLeaderboardScheduledTrigger,
  type NetlifyRuntimeContext,
} from '../netlify/lib/leaderboard-scheduled-trigger.ts';

const secret = 'scheduled-fixture-secret';
const context = (deployContext = 'production', published = true): NetlifyRuntimeContext => ({
  deploy: { context: deployContext, id: 'deploy-id', published },
  site: { url: 'https://tree-token.example/base/path' },
});
const getEnv = (name: string) => name === 'TREE_LEADERBOARD_REFRESH_SECRET' ? secret : undefined;

let calls = 0;
let capturedUrl = '';
let capturedMethod = '';
let capturedSecret = '';
const logs: string[] = [];
const accepted = await runLeaderboardScheduledTrigger(context(), {
  getEnv,
  fetchImpl: async (input, init) => {
    calls += 1;
    capturedUrl = String(input);
    capturedMethod = String(init?.method);
    capturedSecret = new Headers(init?.headers).get('x-tree-refresh-secret') || '';
    return new Response(null, { status: 202 });
  },
  logger: { info: (message) => logs.push(String(message)), error: (message) => logs.push(String(message)) },
});
assert.equal(calls, 1);
assert.equal(capturedMethod, 'POST');
assert.equal(capturedUrl, 'https://tree-token.example/.netlify/functions/tree-leaderboard-refresh-background');
assert.equal(capturedSecret, secret);
assert.deepEqual(accepted, { attempted: true, accepted: true, reason: 'accepted' });
assert.equal(JSON.stringify({ logs, accepted }).includes(secret), false);

const unexpected = await runLeaderboardScheduledTrigger(context(), {
  getEnv, fetchImpl: async () => new Response(null, { status: 503 }), logger: { info() {}, error() {} },
});
assert.deepEqual(unexpected, { attempted: true, accepted: false, reason: 'unexpected-status' });

for (const [fixtureContext, fixtureEnv, reason] of [
  [context(), () => undefined, 'missing-secret'],
  [context('deploy-preview'), getEnv, 'not-production'],
  [context('production', false), getEnv, 'not-published'],
] as const) {
  let requests = 0;
  const result = await runLeaderboardScheduledTrigger(fixtureContext, {
    getEnv: fixtureEnv,
    fetchImpl: async () => { requests += 1; return new Response(null, { status: 202 }); },
    logger: { info() {}, error() {} },
  });
  assert.equal(requests, 0);
  assert.equal(result.reason, reason);
  assert.equal(result.attempted, false);
}

const networkFailure = await runLeaderboardScheduledTrigger(context(), {
  getEnv, fetchImpl: async () => { throw new TypeError('fixture network failure'); }, logger: { info() {}, error() {} },
});
assert.deepEqual(networkFailure, { attempted: true, accepted: false, reason: 'network-error' });

let timeoutCleared = false;
const timeout = await runLeaderboardScheduledTrigger(context(), {
  getEnv,
  fetchImpl: async (_input, init) => {
    if (init?.signal?.aborted) throw Object.assign(new Error('fixture abort'), { name: 'AbortError' });
    return new Response(null, { status: 202 });
  },
  setTimeoutImpl: ((callback: () => void) => { callback(); return 1 as never; }) as typeof setTimeout,
  clearTimeoutImpl: (() => { timeoutCleared = true; }) as typeof clearTimeout,
  logger: { info() {}, error() {} },
});
assert.deepEqual(timeout, { attempted: true, accepted: false, reason: 'timeout' });
assert.equal(timeoutCleared, true);

assert.equal(config.schedule, '17 */6 * * *');
const scheduledSource = await readFile('netlify/functions/tree-leaderboard-refresh-scheduled.ts', 'utf8');
const publicSource = await readFile('netlify/functions/tree-leaderboard.ts', 'utf8');
const workerSource = await readFile('netlify/lib/leaderboard-background-worker.ts', 'utf8');
assert.equal(scheduledSource.includes('scanSuiGraphqlLeaderboard'), false);
assert.equal(scheduledSource.includes('sui-graphql-leaderboard-provider'), false);
assert.equal(publicSource.includes('scanSuiGraphqlLeaderboard'), false);
assert.equal(workerSource.includes('scanSuiGraphqlLeaderboard'), true);

console.log('Leaderboard scheduled trigger: PASS (production-only POST, safe authentication, timeout, and failure handling)');
