import assert from 'node:assert/strict';
import { handleTreeLeaderboardRequest } from '../netlify/functions/tree-leaderboard.ts';
import { handleTreeLeaderboardBackgroundRequest } from '../netlify/functions/tree-leaderboard-refresh-background.ts';
import { selectLeaderboardStore, type LeaderboardStore } from '../netlify/lib/leaderboard-cache.ts';
import type { NetlifyRuntimeContext } from '../netlify/lib/leaderboard-scheduled-trigger.ts';

const productionStore = {} as LeaderboardStore;
const previewStore = {} as LeaderboardStore;
const factories = {
  getStore() { return productionStore; },
  getDeployStore() { return previewStore; },
};
const runtimeContext = (deployContext: string): NetlifyRuntimeContext => ({
  deploy: { context: deployContext, id: `${deployContext}-id`, published: deployContext === 'production' },
  site: { url: 'https://tree-token.example' },
});

const unauthorized = await handleTreeLeaderboardRequest(
  new Request('https://tree-token.example/api/tree-leaderboard', { method: 'POST' }),
  runtimeContext('production'),
  async () => { throw new Error('must not read snapshot'); },
  async () => ({ accepted: false, started: false, outcome: 'authentication-failed' }),
);
assert.equal(unauthorized.status, 401);
assert.deepEqual(await unauthorized.json(), { status: 'error', error: 'refresh-not-authorized' });

for (const [deployContext, expectedStore] of [
  ['production', productionStore],
  ['deploy-preview', previewStore],
] as const) {
  let publicStore: LeaderboardStore | undefined;
  await handleTreeLeaderboardRequest(
    new Request('https://tree-token.example/api/tree-leaderboard'),
    runtimeContext(deployContext),
    async (_request, dependencies) => {
      publicStore = selectLeaderboardStore(dependencies.context, factories);
      return new Response(null, { status: 200 });
    },
  );
  assert.equal(publicStore, expectedStore);

  let stableWorkerStore: LeaderboardStore | undefined;
  let stableWorkerDeployId: string | undefined;
  const stableResponse = await handleTreeLeaderboardRequest(
    new Request('https://tree-token.example/api/tree-leaderboard', { method: 'POST' }),
    runtimeContext(deployContext),
    async () => new Response(null, { status: 500 }),
    async (_request, dependencies) => {
      stableWorkerStore = selectLeaderboardStore(dependencies.deployContext, factories);
      stableWorkerDeployId = dependencies.deployId;
      return { accepted: true, started: false, outcome: 'already-active' };
    },
  );
  assert.equal(stableResponse.status, 202);
  assert.equal(stableWorkerStore, expectedStore);
  assert.equal(stableWorkerDeployId, `${deployContext}-id`);

  let workerStore: LeaderboardStore | undefined;
  let capturedDeployId: string | undefined;
  await handleTreeLeaderboardBackgroundRequest(
    new Request('https://tree-token.example/.netlify/functions/tree-leaderboard-refresh-background', { method: 'POST' }),
    runtimeContext(deployContext),
    async (_request, dependencies) => {
      workerStore = selectLeaderboardStore(dependencies.deployContext, factories);
      capturedDeployId = dependencies.deployId;
      return { accepted: true, started: false, outcome: 'already-active' };
    },
  );
  assert.equal(workerStore, expectedStore);
  assert.equal(capturedDeployId, `${deployContext}-id`);
}

let missingContext = '';
await handleTreeLeaderboardRequest(
  new Request('https://tree-token.example/api/tree-leaderboard'),
  undefined as never,
  async (_request, dependencies) => {
    missingContext = dependencies.context || '';
    return new Response(null, { status: 200 });
  },
);
assert.equal(missingContext, 'dev');
assert.equal(selectLeaderboardStore(missingContext, factories), previewStore);

let missingWorkerContext = '';
let missingWorkerDeployId: string | undefined = 'unexpected';
await handleTreeLeaderboardBackgroundRequest(
  new Request('https://tree-token.example/.netlify/functions/tree-leaderboard-refresh-background', { method: 'POST' }),
  undefined as never,
  async (_request, dependencies) => {
    missingWorkerContext = dependencies.deployContext || '';
    missingWorkerDeployId = dependencies.deployId;
    return { accepted: true, started: false, outcome: 'already-active' };
  },
);
assert.equal(missingWorkerContext, 'dev');
assert.equal(missingWorkerDeployId, undefined);

console.log('Leaderboard function context: PASS (production and Deploy Preview contexts reach the correct Blob selector)');
