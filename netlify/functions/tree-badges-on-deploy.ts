import { readCompleteTreeBadgeSnapshot } from '../lib/tree-badge-cache.ts';
import { runTreeBadgeBackgroundWorker } from '../lib/tree-badge-background-worker.ts';

type DeploySucceededEvent = {
  deploy: {
    id: string;
    context: string;
    branch: string | null;
    commitRef: string | null;
  };
};

function enabled(value: string | undefined): boolean {
  return (value || '').trim().toLowerCase() === 'true';
}

export async function runTreeBadgeDeployBootstrap(
  event: DeploySucceededEvent,
  dependencies: {
    getEnv?: (name: string) => string | undefined;
    readSnapshot?: (context: string) => ReturnType<typeof readCompleteTreeBadgeSnapshot>;
    runWorker?: typeof runTreeBadgeBackgroundWorker;
    logger?: Pick<Console, 'info' | 'error'>;
  } = {},
) {
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const logger = dependencies.logger ?? console;
  if (event.deploy.context !== 'deploy-preview') return { attempted: false, outcome: 'skipped-context' as const };
  const expectedBranch = (getEnv('TREE_BADGE_PREVIEW_BRANCH') || '').trim();
  if (!expectedBranch || event.deploy.branch !== expectedBranch) return { attempted: false, outcome: 'skipped-branch' as const };
  if (!enabled(getEnv('TREE_BADGE_AUTO_BOOTSTRAP'))) return { attempted: false, outcome: 'disabled' as const };

  const readSnapshot = dependencies.readSnapshot
    ?? ((context) => readCompleteTreeBadgeSnapshot({ context }));
  if (await readSnapshot(event.deploy.context)) {
    logger.info(`TREE badge snapshot already exists for preview deploy ${event.deploy.id}.`);
    return { attempted: false, outcome: 'already-ready' as const };
  }

  const secret = getEnv('TREE_BADGE_REFRESH_SECRET')
    || getEnv('TREE_LEADERBOARD_REFRESH_SECRET')
    || '';
  if (!secret) return { attempted: false, outcome: 'missing-secret' as const };
  const request = new Request('https://internal.invalid/.netlify/functions/tree-badges-refresh-background', {
    method: 'POST',
    headers: { 'x-tree-badge-refresh-secret': secret },
  });
  const runWorker = dependencies.runWorker ?? runTreeBadgeBackgroundWorker;
  const result = await runWorker(request, {
    getEnv,
    deployContext: event.deploy.context,
    deployId: event.deploy.id,
    logger,
  });
  return { attempted: result.started, outcome: result.outcome };
}

export default {
  async deploySucceeded(event: DeploySucceededEvent): Promise<void> {
    const result = await runTreeBadgeDeployBootstrap(event);
    if (result.outcome === 'authentication-failed' || result.outcome === 'missing-secret') {
      throw new Error(`TREE badge preview bootstrap ended with ${result.outcome}.`);
    }
  },
};
