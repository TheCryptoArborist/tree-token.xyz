import test from 'node:test';
import assert from 'node:assert/strict';
import { KEEPER_STREAMS, isExactPoolCandidate } from '../keeper/tree-raffle-keeper.mjs';

test('keeper watches only the three allowlisted venue event types', () => {
  assert.deepEqual(KEEPER_STREAMS.map((stream) => stream.id), ['suidex-v2', 'suidex-v3', 'turbos']);
  assert.ok(KEEPER_STREAMS.every((stream) => typeof stream.eventType === 'string'));
});

test('V3 and Turbos discovery filters exact TREE pools before ingestion', () => {
  assert.equal(isExactPoolCandidate('suidex-v3', { parsedJson: { pool_id: '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf' } }), true);
  assert.equal(isExactPoolCandidate('suidex-v3', { parsedJson: { pool_id: '0x1' } }), false);
  assert.equal(isExactPoolCandidate('turbos', { parsedJson: { pool: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee' } }), true);
  assert.equal(isExactPoolCandidate('turbos', { parsedJson: { pool: '0x1' } }), false);
  assert.equal(isExactPoolCandidate('suidex-v2', { parsedJson: {} }), true);
});

test('Fly configuration is explicitly staging-only and cannot autostop', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../fly.keeper.toml', import.meta.url), 'utf8');
  assert.match(source, /app = "tree-raffle-keeper-staging"/);
  assert.match(source, /KEEPER_DRY_RUN = "true"/);
  assert.match(source, /auto_stop_machines = "off"/);
  assert.match(source, /min_machines_running = 1/);
  assert.match(source, /size = "shared-cpu-1x"/);
  assert.match(source, /memory = "256mb"/);
});
