import { readCompleteExposureSnapshot } from '../lib/tree-exposure-cache.ts';
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
