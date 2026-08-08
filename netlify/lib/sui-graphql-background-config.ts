export const DEFAULT_BACKGROUND_SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
export const DEFAULT_BACKGROUND_PAGE_SIZE = 50;
export const DEFAULT_BACKGROUND_MAX_PAGES = 5_000;
export const DEFAULT_BACKGROUND_MAX_SCAN_MS = 840_000;
export const DEFAULT_BACKGROUND_PROGRESS_PAGES = 25;
export const DEFAULT_BACKGROUND_MAX_RETRIES = 5;
export const DEFAULT_LEADERBOARD_STALE_AFTER_MS = 28_800_000;

export type SuiGraphqlBackgroundConfig = {
  endpoint: string;
  pageSize: number;
  maxPages: number;
  maxScanMs: number;
  progressIntervalPages: number;
  maxRetries: number;
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function endpoint(value: string | undefined): string {
  if (!value) return DEFAULT_BACKGROUND_SUI_GRAPHQL_URL;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : DEFAULT_BACKGROUND_SUI_GRAPHQL_URL;
  } catch {
    return DEFAULT_BACKGROUND_SUI_GRAPHQL_URL;
  }
}

export function readSuiGraphqlBackgroundConfig(getEnv: (name: string) => string | undefined): SuiGraphqlBackgroundConfig {
  return {
    endpoint: endpoint(getEnv('SUI_GRAPHQL_URL')),
    pageSize: boundedInteger(getEnv('SUI_GRAPHQL_BACKGROUND_PAGE_SIZE'), DEFAULT_BACKGROUND_PAGE_SIZE, 1, 50),
    maxPages: boundedInteger(getEnv('SUI_GRAPHQL_BACKGROUND_MAX_PAGES'), DEFAULT_BACKGROUND_MAX_PAGES, 100, 10_000),
    maxScanMs: boundedInteger(getEnv('SUI_GRAPHQL_BACKGROUND_MAX_SCAN_MS'), DEFAULT_BACKGROUND_MAX_SCAN_MS, 30_000, 840_000),
    progressIntervalPages: boundedInteger(getEnv('SUI_GRAPHQL_BACKGROUND_PROGRESS_PAGES'), DEFAULT_BACKGROUND_PROGRESS_PAGES, 1, 100),
    maxRetries: boundedInteger(getEnv('SUI_GRAPHQL_BACKGROUND_MAX_RETRIES'), DEFAULT_BACKGROUND_MAX_RETRIES, 0, 10),
  };
}

export function readLeaderboardStaleAfterMs(getEnv: (name: string) => string | undefined): number {
  return boundedInteger(getEnv('TREE_LEADERBOARD_STALE_AFTER_MS'), DEFAULT_LEADERBOARD_STALE_AFTER_MS, 300_000, 86_400_000);
}
