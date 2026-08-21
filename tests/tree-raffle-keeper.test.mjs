import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPHQL_PAGE_SIZE,
  KEEPER_STREAMS,
  isExactPoolCandidate,
  keeperHealthStatus,
} from '../keeper/tree-raffle-keeper.mjs';

test('keeper watches only the three allowlisted venue event types', () => {
  assert.deepEqual(KEEPER_STREAMS.map((stream) => stream.id), ['suidex-v2', 'suidex-v3', 'turbos']);
  assert.ok(KEEPER_STREAMS.every((stream) => typeof stream.eventType === 'string'));
});

test('keeper respects the Sui GraphQL event page limit', () => {
  assert.equal(GRAPHQL_PAGE_SIZE, 50);
});

test('V3 and Turbos discovery filters exact TREE pools before ingestion', () => {
  assert.equal(isExactPoolCandidate('suidex-v3', { parsedJson: { pool_id: '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf' } }), true);
  assert.equal(isExactPoolCandidate('suidex-v3', { parsedJson: { pool_id: '0x1' } }), false);
  assert.equal(isExactPoolCandidate('turbos', { parsedJson: { pool: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee' } }), true);
  assert.equal(isExactPoolCandidate('turbos', { parsedJson: { pool: '0x1' } }), false);
  assert.equal(isExactPoolCandidate('suidex-v2', { parsedJson: {} }), true);
});

test('health tolerates one transient stream failure and fails only after all streams are stale', () => {
  const now = Date.parse('2026-08-20T12:00:00.000Z');
  const streams = new Map([
    ['suidex-v2', { lastSuccessAt: '2026-08-20T11:59:30.000Z', lastError: null }],
    ['suidex-v3', { lastSuccessAt: '2026-08-20T11:59:20.000Z', lastError: 'timeout' }],
    ['turbos', { lastSuccessAt: '2026-08-20T11:59:10.000Z', lastError: null }],
  ]);
  assert.equal(keeperHealthStatus({ streams, lastError: 'suidex-v3: timeout' }, now, 120_000), 'degraded');
  assert.equal(keeperHealthStatus({ streams, lastError: null }, now, 120_000), 'ok');
  assert.equal(keeperHealthStatus({ streams, lastError: 'timeout' }, now + 180_000, 120_000), 'unavailable');
});

test('Fly keeps raffle ingestion and random draws staged while skill awards stay always-on', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../fly.keeper.toml', import.meta.url), 'utf8');
  assert.match(source, /app = "tree-raffle-keeper-staging"/);
  assert.match(source, /KEEPER_DRY_RUN = "true"/);
  assert.match(source, /KEEPER_DRAW_ENABLED = "false"/);
  assert.match(source, /KEEPER_DRAW_DRY_RUN = "true"/);
  assert.match(source, /KEEPER_KNOWLEDGE_AWARD_ENABLED = "true"/);
  assert.match(source, /KEEPER_KNOWLEDGE_AWARD_DRY_RUN = "false"/);
  assert.match(source, /KEEPER_CURSOR_BACKEND = "supabase"/);
  assert.doesNotMatch(source, /TREE_RAFFLE_SUPABASE_SECRET_KEY/);
  assert.match(source, /auto_stop_machines = "off"/);
  assert.match(source, /min_machines_running = 1/);
  assert.match(source, /POLL_INTERVAL_MS = "15000"/);
  assert.match(source, /GRAPHQL_TIMEOUT_MS = "20000"/);
  assert.match(source, /HEALTH_STALE_AFTER_MS = "120000"/);
  assert.match(source, /size = "shared-cpu-1x"/);
  assert.match(source, /memory = "256mb"/);
});
