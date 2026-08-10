from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing expected text for {label}')
    return text.replace(old, new, 1)


# Route the public Command Center to the complete exposure and badge snapshots.
app_path = Path('dapp/app.js')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "const leaderboardUrl = isDeployPreview ? '/api/tree-exposure' : '/api/tree-leaderboard';\nconst badgeUrl = isDeployPreview ? '/api/tree-badges' : null;\nlet leaderboardMode = isDeployPreview ? 'exposure' : 'direct';",
    "const leaderboardUrl = '/api/tree-exposure';\nconst badgeUrl = '/api/tree-badges';\nlet leaderboardMode = 'exposure';",
    'production leaderboard routes',
)
app_path.write_text(app, encoding='utf-8')

# Document production controls and the staggered schedules.
env_path = Path('.env.example')
env_text = env_path.read_text(encoding='utf-8')
old_block = """# Preview-only total-exposure leaderboard controls.
TREE_EXPOSURE_AUTO_BOOTSTRAP=false
TREE_EXPOSURE_PREVIEW_BRANCH=feature/leaderboard-exposure-v1
TREE_BURN_BADGES_ENABLED=false

# TREE_BURN_BADGES_ENABLED is retained only for the legacy inline preview scanner and remains false.
# The isolated behavioral badge worker below uses Sui GraphQL for both activity and burn history.

# Separate behavioral badge index. Badge history never blocks exposure ranking.
TREE_BADGE_AUTO_BOOTSTRAP=false
TREE_BADGE_PREVIEW_BRANCH=feature/leaderboard-badges-v1
TREE_BADGE_REFRESH_SECRET=
TREE_BADGE_PRODUCTION_ENABLED=false
TREE_BADGE_STALE_AFTER_MS=21600000
TREE_TOKEN_CREATION_CHECKPOINT=169361209
"""
new_block = """# Complete-only Liquid TREE + verified LP exposure snapshot.
TREE_EXPOSURE_REFRESH_SECRET=
TREE_EXPOSURE_PRODUCTION_ENABLED=false
TREE_EXPOSURE_AUTO_BOOTSTRAP=false
TREE_EXPOSURE_PREVIEW_BRANCH=feature/leaderboard-exposure-v1
TREE_EXPOSURE_STALE_AFTER_MS=28800000
TREE_BURN_BADGES_ENABLED=false

# TREE_BURN_BADGES_ENABLED is retained only for the legacy inline preview scanner and remains false.
# The isolated behavioral badge worker below uses Sui GraphQL for both activity and burn history.

# Separate behavioral badge index. Badge history never blocks exposure ranking.
TREE_BADGE_AUTO_BOOTSTRAP=false
TREE_BADGE_PREVIEW_BRANCH=feature/leaderboard-badges-v1
TREE_BADGE_REFRESH_SECRET=
TREE_BADGE_PRODUCTION_ENABLED=false
TREE_BADGE_STALE_AFTER_MS=28800000
TREE_TOKEN_CREATION_CHECKPOINT=169361209

# Published production schedules are defined in code:
# - Direct fallback leaderboard: minute 17 every 6 hours
# - Verified exposure snapshot: minute 27 every 6 hours
# - Behavioral badge snapshot: minute 47 every 6 hours
"""
env_text = replace_once(env_text, old_block, new_block, 'environment controls')
env_path.write_text(env_text, encoding='utf-8')

# Enable safe first-snapshot bootstrap for both Deploy Preview and production.
Path('netlify/functions/tree-exposure-on-deploy.ts').write_text(r'''import { readCompleteExposureSnapshot } from '../lib/tree-exposure-cache.ts';
import {
  runExposureBackgroundWorker,
  type ExposureBackgroundWorkerResult,
} from '../lib/tree-exposure-background-worker.ts';

type DeploySucceededEvent = {
  deploy: {
    id: string;
    context: string;
    branch: string | null;
    commitRef: string | null;
  };
  site: {
    id: string;
    name: string;
  };
};

type BootstrapDependencies = {
  getEnv?: (name: string) => string | undefined;
  readSnapshot?: (context: string) => Promise<unknown | null>;
  runWorker?: typeof runExposureBackgroundWorker;
  logger?: Pick<Console, 'info' | 'error'>;
};

export type ExposureDeployBootstrapResult = {
  attempted: boolean;
  outcome:
    | 'skipped-context'
    | 'skipped-branch'
    | 'disabled'
    | 'already-ready'
    | 'missing-secret'
    | ExposureBackgroundWorkerResult['outcome'];
};

function enabled(value: string | undefined): boolean {
  return (value || '').trim().toLowerCase() === 'true';
}

export async function runExposureDeployBootstrap(
  event: DeploySucceededEvent,
  dependencies: BootstrapDependencies = {},
): Promise<ExposureDeployBootstrapResult> {
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const logger = dependencies.logger ?? console;
  const context = event.deploy.context;
  const isPreview = context === 'deploy-preview';
  const isProduction = context === 'production';
  if (!isPreview && !isProduction) {
    return { attempted: false, outcome: 'skipped-context' };
  }

  if (isPreview) {
    const expectedBranch = (getEnv('TREE_EXPOSURE_PREVIEW_BRANCH') || '').trim();
    if (!expectedBranch || event.deploy.branch !== expectedBranch) {
      return { attempted: false, outcome: 'skipped-branch' };
    }
  }
  if (isProduction && !enabled(getEnv('TREE_EXPOSURE_PRODUCTION_ENABLED'))) {
    return { attempted: false, outcome: 'disabled' };
  }
  if (!enabled(getEnv('TREE_EXPOSURE_AUTO_BOOTSTRAP'))) {
    return { attempted: false, outcome: 'disabled' };
  }

  const readSnapshot = dependencies.readSnapshot
    ?? ((deployContext) => readCompleteExposureSnapshot({ context: deployContext }));
  const existing = await readSnapshot(context);
  if (existing) {
    logger.info(`TREE exposure snapshot already exists for ${context} deploy ${event.deploy.id}.`);
    return { attempted: false, outcome: 'already-ready' };
  }

  const secret = getEnv('TREE_EXPOSURE_REFRESH_SECRET')
    || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
    || '';
  if (!secret) {
    logger.error('TREE exposure bootstrap has no configured refresh secret.');
    return { attempted: false, outcome: 'missing-secret' };
  }

  const request = new Request('https://internal.invalid/.netlify/functions/tree-exposure-refresh-background', {
    method: 'POST',
    headers: { 'x-tree-exposure-refresh-secret': secret },
  });
  const runWorker = dependencies.runWorker ?? runExposureBackgroundWorker;
  logger.info(`Starting TREE exposure bootstrap for ${context} deploy ${event.deploy.id}.`);
  const result = await runWorker(request, {
    getEnv,
    deployContext: context,
    deployId: event.deploy.id,
    logger,
  });
  return { attempted: result.started, outcome: result.outcome };
}

export default {
  async deploySucceeded(event: DeploySucceededEvent): Promise<void> {
    const result = await runExposureDeployBootstrap(event);
    const failed = result.outcome === 'verification-incomplete'
      || result.outcome === 'error'
      || result.outcome === 'authentication-failed'
      || result.outcome === 'missing-secret';
    if (!failed) return;
    if (event.deploy.context === 'deploy-preview') {
      throw new Error(`TREE exposure preview bootstrap ended with ${result.outcome}.`);
    }
    console.error(`TREE exposure production bootstrap ended with ${result.outcome}; scheduled refresh will retry.`);
  },
};
''', encoding='utf-8')

Path('netlify/functions/tree-badges-on-deploy.ts').write_text(r'''import { readCompleteTreeBadgeSnapshot } from '../lib/tree-badge-cache.ts';

type DeploySucceededEvent = {
  deploy: {
    id: string;
    context: string;
    branch: string | null;
    commitRef: string | null;
    url?: string | null;
  };
};

type BootstrapOutcome =
  | 'skipped-context'
  | 'skipped-branch'
  | 'disabled'
  | 'already-ready'
  | 'missing-secret'
  | 'missing-deploy-url'
  | 'accepted'
  | 'trigger-failed';

function enabled(value: string | undefined): boolean {
  return (value || '').trim().toLowerCase() === 'true';
}

export async function runTreeBadgeDeployBootstrap(
  event: DeploySucceededEvent,
  dependencies: {
    getEnv?: (name: string) => string | undefined;
    readSnapshot?: (context: string) => ReturnType<typeof readCompleteTreeBadgeSnapshot>;
    fetchImpl?: typeof fetch;
    logger?: Pick<Console, 'info' | 'error'>;
  } = {},
): Promise<{ attempted: boolean; outcome: BootstrapOutcome }> {
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const logger = dependencies.logger ?? console;
  const context = event.deploy.context;
  const isPreview = context === 'deploy-preview';
  const isProduction = context === 'production';
  if (!isPreview && !isProduction) return { attempted: false, outcome: 'skipped-context' };

  if (isPreview) {
    const expectedBranch = (getEnv('TREE_BADGE_PREVIEW_BRANCH') || '').trim();
    if (!expectedBranch || event.deploy.branch !== expectedBranch) {
      return { attempted: false, outcome: 'skipped-branch' };
    }
  }
  if (isProduction && !enabled(getEnv('TREE_BADGE_PRODUCTION_ENABLED'))) {
    return { attempted: false, outcome: 'disabled' };
  }
  if (!enabled(getEnv('TREE_BADGE_AUTO_BOOTSTRAP'))) {
    return { attempted: false, outcome: 'disabled' };
  }

  const readSnapshot = dependencies.readSnapshot
    ?? ((deployContext) => readCompleteTreeBadgeSnapshot({ context: deployContext }));
  if (await readSnapshot(context)) {
    logger.info(`TREE badge snapshot already exists for ${context} deploy ${event.deploy.id}.`);
    return { attempted: false, outcome: 'already-ready' };
  }

  const secret = getEnv('TREE_BADGE_REFRESH_SECRET')
    || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
    || '';
  if (!secret) return { attempted: false, outcome: 'missing-secret' };

  const deployUrl = (getEnv('DEPLOY_PRIME_URL')
    || (isProduction ? getEnv('URL') : '')
    || event.deploy.url
    || '').replace(/\/$/, '');
  if (!deployUrl) return { attempted: false, outcome: 'missing-deploy-url' };

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const response = await fetchImpl(`${deployUrl}/.netlify/functions/tree-badges-refresh-background`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-tree-badge-refresh-secret': secret,
    },
  });
  if (response.status !== 202) {
    logger.error(`TREE badge background trigger returned ${response.status}.`);
    return { attempted: true, outcome: 'trigger-failed' };
  }

  logger.info(`TREE badge background refresh accepted for ${context} deploy ${event.deploy.id}.`);
  return { attempted: true, outcome: 'accepted' };
}

export default {
  async deploySucceeded(event: DeploySucceededEvent): Promise<void> {
    const result = await runTreeBadgeDeployBootstrap(event);
    const failed = result.outcome === 'missing-secret'
      || result.outcome === 'missing-deploy-url'
      || result.outcome === 'trigger-failed';
    if (!failed) return;
    if (event.deploy.context === 'deploy-preview') {
      throw new Error(`TREE badge preview bootstrap ended with ${result.outcome}.`);
    }
    console.error(`TREE badge production bootstrap ended with ${result.outcome}; scheduled refresh will retry.`);
  },
};
''', encoding='utf-8')

# Allow the production bootstrap badge worker to wait for the exposure bootstrap.
worker_path = Path('netlify/lib/tree-badge-background-worker.ts')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(
    worker,
    "    const waitMs = context === 'deploy-preview' ? 5 * 60 * 1000 : 0;",
    "    const waitForExposure = context === 'deploy-preview' || enabled(getEnv('TREE_BADGE_AUTO_BOOTSTRAP'));\n    const waitMs = waitForExposure ? 5 * 60 * 1000 : 0;",
    'badge exposure wait',
)
worker_path.write_text(worker, encoding='utf-8')

# Add a shared, production-only scheduled background trigger.
Path('netlify/lib/tree-snapshot-scheduled-trigger.ts').write_text(r'''export type NetlifyScheduledContext = {
  deploy: {
    context: string;
    id: string;
    published?: boolean;
  };
  site: {
    url: string;
  };
};

export type TreeSnapshotKind = 'exposure' | 'badges';

export type TreeSnapshotScheduledResult = {
  attempted: boolean;
  accepted: boolean;
  reason: 'not-production' | 'disabled' | 'missing-secret' | 'accepted' | 'unexpected-status' | 'network-error' | 'timeout';
};

export type TreeSnapshotScheduledDependencies = {
  getEnv?: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, 'info' | 'error'>;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  requestTimeoutMs?: number;
};

const CONFIG = {
  exposure: {
    label: 'TREE exposure',
    enabledEnv: 'TREE_EXPOSURE_PRODUCTION_ENABLED',
    secretEnvs: ['TREE_EXPOSURE_REFRESH_SECRET', 'TREE_LEADERBOARD_REFRESH_SECRET'],
    header: 'x-tree-exposure-refresh-secret',
    path: '/.netlify/functions/tree-exposure-refresh-background',
  },
  badges: {
    label: 'TREE behavioral badge',
    enabledEnv: 'TREE_BADGE_PRODUCTION_ENABLED',
    secretEnvs: ['TREE_BADGE_REFRESH_SECRET', 'TREE_LEADERBOARD_REFRESH_SECRET'],
    header: 'x-tree-badge-refresh-secret',
    path: '/.netlify/functions/tree-badges-refresh-background',
  },
} as const;

function enabled(value: string | undefined): boolean {
  return (value || '').trim().toLowerCase() === 'true';
}

export async function runTreeSnapshotScheduledTrigger(
  kind: TreeSnapshotKind,
  context: NetlifyScheduledContext,
  dependencies: TreeSnapshotScheduledDependencies = {},
): Promise<TreeSnapshotScheduledResult> {
  const settings = CONFIG[kind];
  const logger = dependencies.logger ?? console;
  if (context?.deploy?.context !== 'production' || context?.deploy?.published === false) {
    logger.info(`${settings.label} scheduled refresh skipped outside published production.`);
    return { attempted: false, accepted: false, reason: 'not-production' };
  }

  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  if (!enabled(getEnv(settings.enabledEnv))) {
    logger.info(`${settings.label} scheduled refresh is disabled.`);
    return { attempted: false, accepted: false, reason: 'disabled' };
  }
  const secret = settings.secretEnvs.map((name) => getEnv(name) || '').find(Boolean) || '';
  if (!secret) {
    logger.error(`${settings.label} scheduled refresh has no configured secret.`);
    return { attempted: false, accepted: false, reason: 'missing-secret' };
  }

  const siteUrl = context?.site?.url || getEnv('URL') || 'https://tree-token.xyz';
  let endpoint: URL;
  try {
    endpoint = new URL(settings.path, siteUrl);
  } catch {
    logger.error(`${settings.label} scheduled refresh could not resolve its endpoint.`);
    return { attempted: false, accepted: false, reason: 'network-error' };
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const setTimeoutImpl = dependencies.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = dependencies.clearTimeoutImpl ?? clearTimeout;
  const controller = new AbortController();
  const timeout = setTimeoutImpl(() => controller.abort(), dependencies.requestTimeoutMs ?? 20_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { [settings.header]: secret },
      signal: controller.signal,
    });
    if (response.status !== 202) {
      logger.error(`${settings.label} scheduled refresh was not accepted.`);
      return { attempted: true, accepted: false, reason: 'unexpected-status' };
    }
    logger.info(`${settings.label} scheduled refresh was accepted.`);
    return { attempted: true, accepted: true, reason: 'accepted' };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      logger.error(`${settings.label} scheduled refresh timed out.`);
      return { attempted: true, accepted: false, reason: 'timeout' };
    }
    logger.error(`${settings.label} scheduled refresh request failed.`);
    return { attempted: true, accepted: false, reason: 'network-error' };
  } finally {
    clearTimeoutImpl(timeout);
  }
}
''', encoding='utf-8')

Path('netlify/functions/tree-exposure-refresh-scheduled.ts').write_text(r'''import {
  runTreeSnapshotScheduledTrigger,
  type NetlifyScheduledContext,
} from '../lib/tree-snapshot-scheduled-trigger.ts';

export default async (_request: Request, context: NetlifyScheduledContext): Promise<void> => {
  await runTreeSnapshotScheduledTrigger('exposure', context);
};

export const config = {
  schedule: '27 */6 * * *',
};
''', encoding='utf-8')

Path('netlify/functions/tree-badges-refresh-scheduled.ts').write_text(r'''import {
  runTreeSnapshotScheduledTrigger,
  type NetlifyScheduledContext,
} from '../lib/tree-snapshot-scheduled-trigger.ts';

export default async (_request: Request, context: NetlifyScheduledContext): Promise<void> => {
  await runTreeSnapshotScheduledTrigger('badges', context);
};

export const config = {
  schedule: '47 */6 * * *',
};
''', encoding='utf-8')

# Update bootstrap fixtures for explicit production activation.
exposure_test_path = Path('tests/tree-exposure-deploy-bootstrap.test.ts')
exposure_test = exposure_test_path.read_text(encoding='utf-8')
old_production = """let workerCalls = 0;
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
"""
new_production = """let workerCalls = 0;
const skippedContext = await runExposureDeployBootstrap({
  ...event,
  deploy: { ...event.deploy, context: 'branch-deploy' },
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

const productionDisabled = await runExposureDeployBootstrap({
  ...event,
  deploy: { ...event.deploy, context: 'production', branch: 'main' },
}, {
  getEnv: env,
  readSnapshot: async () => null,
  logger: silentLogger,
});
assert.deepEqual(productionDisabled, { attempted: false, outcome: 'disabled' });

const productionComplete = await runExposureDeployBootstrap({
  ...event,
  deploy: { ...event.deploy, context: 'production', branch: 'main' },
}, {
  getEnv: (name) => ({
    TREE_EXPOSURE_PRODUCTION_ENABLED: 'true',
    TREE_EXPOSURE_AUTO_BOOTSTRAP: 'true',
    TREE_EXPOSURE_REFRESH_SECRET: secret,
  }[name]),
  readSnapshot: async (context) => {
    assert.equal(context, 'production');
    return null;
  },
  runWorker: async (request, dependencies) => {
    workerCalls += 1;
    assert.equal(request.headers.get('x-tree-exposure-refresh-secret'), secret);
    assert.equal(dependencies.deployContext, 'production');
    return { accepted: true, started: true, outcome: 'complete' };
  },
  logger: silentLogger,
});
assert.deepEqual(productionComplete, { attempted: true, outcome: 'complete' });
"""
exposure_test = replace_once(exposure_test, old_production, new_production, 'exposure production fixture')
exposure_test_path.write_text(exposure_test, encoding='utf-8')

badge_test_path = Path('tests/tree-badge-deploy-bootstrap.test.ts')
badge_test = badge_test_path.read_text(encoding='utf-8')
old_badge_production = """const production = await runTreeBadgeDeployBootstrap({ ...event, deploy: { ...event.deploy, context: 'production' } }, {
  getEnv: env,
  readSnapshot: async () => null,
  logger: { info() {}, error() {} },
});
assert.deepEqual(production, { attempted: false, outcome: 'skipped-context' });
"""
new_badge_production = """const productionDisabled = await runTreeBadgeDeployBootstrap({ ...event, deploy: { ...event.deploy, context: 'production', branch: 'main' } }, {
  getEnv: env,
  readSnapshot: async () => null,
  logger: { info() {}, error() {} },
});
assert.deepEqual(productionDisabled, { attempted: false, outcome: 'disabled' });

const productionAccepted = await runTreeBadgeDeployBootstrap({ ...event, deploy: { ...event.deploy, context: 'production', branch: 'main', url: 'https://tree-token.xyz' } }, {
  getEnv: (name) => ({
    TREE_BADGE_PRODUCTION_ENABLED: 'true',
    TREE_BADGE_AUTO_BOOTSTRAP: 'true',
    TREE_BADGE_REFRESH_SECRET: 'production-secret',
    URL: 'https://tree-token.xyz',
  }[name]),
  readSnapshot: async (context) => {
    assert.equal(context, 'production');
    return null;
  },
  fetchImpl: async (input, init) => {
    assert.equal(String(input), 'https://tree-token.xyz/.netlify/functions/tree-badges-refresh-background');
    assert.equal(new Headers(init?.headers).get('x-tree-badge-refresh-secret'), 'production-secret');
    return new Response(null, { status: 202 });
  },
  logger: { info() {}, error() {} },
});
assert.deepEqual(productionAccepted, { attempted: true, outcome: 'accepted' });
"""
badge_test = replace_once(badge_test, old_badge_production, new_badge_production, 'badge production fixture')
badge_test_path.write_text(badge_test, encoding='utf-8')

Path('tests/tree-snapshot-scheduled-trigger.test.ts').write_text(r'''import assert from 'node:assert/strict';
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
''', encoding='utf-8')

# Extend the UI fixture to assert the production route switch.
ui_test_path = Path('tests/leaderboard-ui-state.test.mjs')
ui_test = ui_test_path.read_text(encoding='utf-8')
anchor = "const dappMarkup = await readFile('dapp/index.html', 'utf8');\n"
replacement = anchor + "const dappScript = await readFile('dapp/app.js', 'utf8');\nassert.equal(dappScript.includes(\"const leaderboardUrl = '/api/tree-exposure';\"), true);\nassert.equal(dappScript.includes(\"const badgeUrl = '/api/tree-badges';\"), true);\n"
ui_test = replace_once(ui_test, anchor, replacement, 'production UI route assertions')
ui_test_path.write_text(ui_test, encoding='utf-8')
