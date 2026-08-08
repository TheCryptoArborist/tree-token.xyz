import assert from 'node:assert/strict';
import {
  DEFAULT_BACKGROUND_MAX_PAGES,
  DEFAULT_BACKGROUND_MAX_RETRIES,
  DEFAULT_BACKGROUND_MAX_SCAN_MS,
  DEFAULT_BACKGROUND_PAGE_SIZE,
  DEFAULT_BACKGROUND_PROGRESS_PAGES,
  DEFAULT_LEADERBOARD_STALE_AFTER_MS,
  readLeaderboardStaleAfterMs,
  readSuiGraphqlBackgroundConfig,
} from '../netlify/lib/sui-graphql-background-config.ts';

const defaults = readSuiGraphqlBackgroundConfig(() => undefined);
assert.equal(defaults.pageSize, DEFAULT_BACKGROUND_PAGE_SIZE);
assert.equal(defaults.maxPages, DEFAULT_BACKGROUND_MAX_PAGES);
assert.equal(defaults.maxScanMs, DEFAULT_BACKGROUND_MAX_SCAN_MS);
assert.equal(defaults.progressIntervalPages, DEFAULT_BACKGROUND_PROGRESS_PAGES);
assert.equal(defaults.maxRetries, DEFAULT_BACKGROUND_MAX_RETRIES);
assert.equal(readLeaderboardStaleAfterMs(() => undefined), DEFAULT_LEADERBOARD_STALE_AFTER_MS);
assert.equal(DEFAULT_LEADERBOARD_STALE_AFTER_MS, 28_800_000);

const valid = readSuiGraphqlBackgroundConfig((name) => ({
  SUI_GRAPHQL_URL: 'https://example.com/graphql', SUI_GRAPHQL_BACKGROUND_PAGE_SIZE: '1',
  SUI_GRAPHQL_BACKGROUND_MAX_PAGES: '10000', SUI_GRAPHQL_BACKGROUND_MAX_SCAN_MS: '30000',
  SUI_GRAPHQL_BACKGROUND_PROGRESS_PAGES: '100', SUI_GRAPHQL_BACKGROUND_MAX_RETRIES: '0',
}[name]));
assert.equal(valid.endpoint, 'https://example.com/graphql');
assert.deepEqual({ ...valid, endpoint: undefined }, { endpoint: undefined, pageSize: 1, maxPages: 10000, maxScanMs: 30000, progressIntervalPages: 100, maxRetries: 0 });

const malformed = readSuiGraphqlBackgroundConfig(() => 'invalid');
assert.equal(malformed.pageSize, DEFAULT_BACKGROUND_PAGE_SIZE);
assert.equal(malformed.maxPages, DEFAULT_BACKGROUND_MAX_PAGES);
assert.equal(malformed.maxScanMs, DEFAULT_BACKGROUND_MAX_SCAN_MS);
assert.equal(readLeaderboardStaleAfterMs(() => '1'), DEFAULT_LEADERBOARD_STALE_AFTER_MS);
assert.equal(readLeaderboardStaleAfterMs(() => '28800000'), 28_800_000);
console.log('Leaderboard background configuration: PASS');
