export type NetlifyRuntimeContext = {
  deploy: {
    context: string;
    id: string;
    published: boolean;
  };
  site: {
    url: string;
  };
};

export type ScheduledTriggerResult = {
  attempted: boolean;
  accepted: boolean;
  reason: 'not-production' | 'missing-secret' | 'accepted' | 'unexpected-status' | 'network-error' | 'timeout';
};

export type ScheduledTriggerDependencies = {
  getEnv?: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, 'info' | 'error'>;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
};

const BACKGROUND_FUNCTION_PATH = '/.netlify/functions/tree-leaderboard-refresh-background';
const REQUEST_TIMEOUT_MS = 20_000;

export async function runLeaderboardScheduledTrigger(
  context: NetlifyRuntimeContext,
  dependencies: ScheduledTriggerDependencies = {},
): Promise<ScheduledTriggerResult> {
  const logger = dependencies.logger ?? console;
  if (context?.deploy?.context !== 'production') {
    logger.info('TREE leaderboard scheduled refresh skipped outside production.');
    return { attempted: false, accepted: false, reason: 'not-production' };
  }

  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const secret = getEnv('TREE_LEADERBOARD_REFRESH_SECRET') || '';
  if (!secret) {
    logger.error('TREE leaderboard scheduled refresh is not configured.');
    return { attempted: false, accepted: false, reason: 'missing-secret' };
  }

  const siteUrl = context?.site?.url || getEnv('URL') || 'https://tree-token.xyz';
  let endpoint: URL;
  try {
    endpoint = new URL(BACKGROUND_FUNCTION_PATH, siteUrl);
  } catch {
    logger.error('TREE leaderboard scheduled refresh could not start.');
    return { attempted: false, accepted: false, reason: 'network-error' };
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const setTimeoutImpl = dependencies.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = dependencies.clearTimeoutImpl ?? clearTimeout;
  const controller = new AbortController();
  const timeout = setTimeoutImpl(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'x-tree-refresh-secret': secret },
      signal: controller.signal,
    });
    if (response.status !== 202) {
      logger.error('TREE leaderboard scheduled refresh was not accepted.');
      return { attempted: true, accepted: false, reason: 'unexpected-status' };
    }
    logger.info('TREE leaderboard scheduled refresh was accepted.');
    return { attempted: true, accepted: true, reason: 'accepted' };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      logger.error('TREE leaderboard scheduled refresh timed out.');
      return { attempted: true, accepted: false, reason: 'timeout' };
    }
    logger.error('TREE leaderboard scheduled refresh request failed.');
    return { attempted: true, accepted: false, reason: 'network-error' };
  } finally {
    clearTimeoutImpl(timeout);
  }
}
