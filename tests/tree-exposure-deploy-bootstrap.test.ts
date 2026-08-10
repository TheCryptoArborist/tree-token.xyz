import assert from 'node:assert/strict';
import { runExposureDeployBootstrap } from '../netlify/functions/tree-exposure-on-deploy.ts';

const event = {
  deploy: {
    id: 'deploy-preview-3-id',
    context: 'deploy-preview',
    branch: 'feature/leaderboard-exposure-v1',
    commitRef: 'commit-ref',
  },
  site: {
    id: 'site-id',
    name: 'tree-token',
  },
};

const secret = 'fixture-refresh-secret';
const env = (name: string) => ({
  TREE_EXPOSURE_PREVIEW_BRANCH: 'feature/leaderboard-exposure-v1',
  TREE_EXPOSURE_AUTO_BOOTSTRAP: 'true',
  TREE_LEADERBOARD_REFRESH_SECRET: secret,
}[name]);
const silentLogger = { info() {}, error() {} };

let workerCalls = 0;
const skippedContext = await runExposureDeployBootstrap({
  ...event,
  deploy: { ...event.deploy, context: 'production' },
}, {
  getEnv: env,
  readSnapshot: async () => null,
  runWorker: async () => {
    workerCalls += 1;
    return { accepted: true, started: true, outcome: 'complete' };
  },
  logger: silentLogger,
});
assert.deepEqual(skippedContext, { attempted: false, outcome: 'skipped-context' });
assert.equal(workerCalls, 0);

const skippedBranch = await runExposureDeployBootstrap({
  ...event,
  deploy: { ...event.deploy, branch: 'feature/other-preview' },
}, {
  getEnv: env,
  readSnapshot: async () => null,
  runWorker: async () => {
    workerCalls += 1;
    return { accepted: true, started: true, outcome: 'complete' };
  },
  logger: silentLogger,
});
assert.deepEqual(skippedBranch, { attempted: false, outcome: 'skipped-branch' });
assert.equal(workerCalls, 0);

const missingConfiguredBranch = await runExposureDeployBootstrap(event, {
  getEnv: (name) => name === 'TREE_EXPOSURE_AUTO_BOOTSTRAP' ? 'true' : undefined,
  readSnapshot: async () => null,
  logger: silentLogger,
});
assert.deepEqual(missingConfiguredBranch, { attempted: false, outcome: 'skipped-branch' });

const disabled = await runExposureDeployBootstrap(event, {
  getEnv: (name) => name === 'TREE_EXPOSURE_PREVIEW_BRANCH'
    ? 'feature/leaderboard-exposure-v1'
    : undefined,
  readSnapshot: async () => null,
  logger: silentLogger,
});
assert.deepEqual(disabled, { attempted: false, outcome: 'disabled' });

let snapshotReads = 0;
const existing = await runExposureDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async (context) => {
    snapshotReads += 1;
    assert.equal(context, 'deploy-preview');
    return { outcome: 'complete' };
  },
  runWorker: async () => {
    workerCalls += 1;
    return { accepted: true, started: true, outcome: 'complete' };
  },
  logger: silentLogger,
});
assert.deepEqual(existing, { attempted: false, outcome: 'already-ready' });
assert.equal(snapshotReads, 1);
assert.equal(workerCalls, 0);

const missingSecret = await runExposureDeployBootstrap(event, {
  getEnv: (name) => ({
    TREE_EXPOSURE_PREVIEW_BRANCH: 'feature/leaderboard-exposure-v1',
    TREE_EXPOSURE_AUTO_BOOTSTRAP: 'true',
  }[name]),
  readSnapshot: async () => null,
  logger: silentLogger,
});
assert.deepEqual(missingSecret, { attempted: false, outcome: 'missing-secret' });

let capturedSecret = '';
let capturedContext = '';
let capturedDeployId = '';
const complete = await runExposureDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => null,
  runWorker: async (request, dependencies) => {
    workerCalls += 1;
    assert.equal(request.method, 'POST');
    capturedSecret = request.headers.get('x-tree-exposure-refresh-secret') || '';
    capturedContext = dependencies.deployContext || '';
    capturedDeployId = dependencies.deployId || '';
    return { accepted: true, started: true, outcome: 'complete' };
  },
  logger: silentLogger,
});
assert.deepEqual(complete, { attempted: true, outcome: 'complete' });
assert.equal(capturedSecret, secret);
assert.equal(capturedContext, 'deploy-preview');
assert.equal(capturedDeployId, event.deploy.id);
assert.equal(workerCalls, 1);

const alreadyActive = await runExposureDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => null,
  runWorker: async () => ({ accepted: true, started: false, outcome: 'already-active' }),
  logger: silentLogger,
});
assert.deepEqual(alreadyActive, { attempted: false, outcome: 'already-active' });

const incomplete = await runExposureDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => null,
  runWorker: async () => ({ accepted: true, started: true, outcome: 'verification-incomplete' }),
  logger: silentLogger,
});
assert.deepEqual(incomplete, { attempted: true, outcome: 'verification-incomplete' });

const logs: string[] = [];
await runExposureDeployBootstrap(event, {
  getEnv: env,
  readSnapshot: async () => null,
  runWorker: async () => ({ accepted: true, started: true, outcome: 'complete' }),
  logger: {
    info: (message) => logs.push(String(message)),
    error: (message) => logs.push(String(message)),
  },
});
assert.equal(JSON.stringify(logs).includes(secret), false);

console.log('TREE exposure deploy bootstrap: PASS (platform-event context, branch and feature guards, secret isolation, deploy-specific worker invocation)');
