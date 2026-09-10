export type NetlifyScheduledContext = {
  deploy?: {
    context: string;
    id: string;
    published?: boolean;
  };
  site?: {
    url?: string;
  };
};

export type TreeSnapshotKind = 'exposure' | 'badges';

export type TreeSnapshotScheduledResult = {
  attempted: boolean;
  accepted: boolean;
  reason: 'disabled' | 'missing-secret' | 'accepted' | 'unexpected-status' | 'network-error' | 'timeout';
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
