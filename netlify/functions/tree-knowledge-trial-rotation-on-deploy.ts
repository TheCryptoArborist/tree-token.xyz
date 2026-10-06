import { ensureCurrentAndNextKnowledgeRounds } from './tree-knowledge-trial-rotation-scheduled.ts';

type DeploySucceededEvent = {
  deploy: {
    id: string;
    context: string;
  };
};

export async function runKnowledgeTrialDeployBootstrap(
  event: DeploySucceededEvent,
  dependencies: {
    ensure?: typeof ensureCurrentAndNextKnowledgeRounds;
    logger?: Pick<Console, 'info' | 'error'>;
  } = {},
) {
  const logger = dependencies.logger ?? console;
  if (!['production', 'deploy-preview'].includes(event.deploy.context)) {
    return { attempted: false, outcome: 'skipped-context' as const };
  }
  try {
    const result = await (dependencies.ensure ?? ensureCurrentAndNextKnowledgeRounds)();
    logger.info(`TREE Knowledge Trial rounds verified after deploy ${event.deploy.id}.`);
    return { attempted: true, outcome: 'ready' as const, result };
  } catch (error) {
    logger.error('TREE Knowledge Trial deploy bootstrap failed.', error);
    return { attempted: true, outcome: 'error' as const };
  }
}

export default {
  async deploySucceeded(event: DeploySucceededEvent): Promise<void> {
    const result = await runKnowledgeTrialDeployBootstrap(event);
    if (result.outcome === 'error') {
      console.error('TREE Knowledge Trial will retry its round check on the next hourly scheduler run.');
    }
  },
};
