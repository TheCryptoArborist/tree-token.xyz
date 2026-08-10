import { readCompleteTreeBadgeSnapshot } from '../lib/tree-badge-cache.ts';

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
  if (event.deploy.context !== 'deploy-preview') return { attempted: false, outcome: 'skipped-context' };

  const expectedBranch = (getEnv('TREE_BADGE_PREVIEW_BRANCH') || '').trim();
  if (!expectedBranch || event.deploy.branch !== expectedBranch) {
    return { attempted: false, outcome: 'skipped-branch' };
  }
  if (!enabled(getEnv('TREE_BADGE_AUTO_BOOTSTRAP'))) {
    return { attempted: false, outcome: 'disabled' };
  }

  const readSnapshot = dependencies.readSnapshot
    ?? ((context) => readCompleteTreeBadgeSnapshot({ context }));
  if (await readSnapshot(event.deploy.context)) {
    logger.info(`TREE badge snapshot already exists for preview deploy ${event.deploy.id}.`);
    return { attempted: false, outcome: 'already-ready' };
  }

  const secret = getEnv('TREE_BADGE_REFRESH_SECRET')
    || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
    || '';
  if (!secret) return { attempted: false, outcome: 'missing-secret' };

  const deployUrl = (getEnv('DEPLOY_PRIME_URL') || event.deploy.url || '').replace(/\/$/, '');
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

  logger.info(`TREE badge background refresh accepted for preview deploy ${event.deploy.id}.`);
  return { attempted: true, outcome: 'accepted' };
}

export default {
  async deploySucceeded(event: DeploySucceededEvent): Promise<void> {
    const result = await runTreeBadgeDeployBootstrap(event);
    if (result.outcome === 'missing-secret'
      || result.outcome === 'missing-deploy-url'
      || result.outcome === 'trigger-failed') {
      throw new Error(`TREE badge preview bootstrap ended with ${result.outcome}.`);
    }
  },
};
