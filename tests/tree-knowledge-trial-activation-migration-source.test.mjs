import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL(
  '../supabase/migrations/20260821013850_tree_knowledge_trial_round_activation.sql',
  import.meta.url,
), 'utf8');

test('round scheduling requires a complete reviewed draft and prevents overlaps', () => {
  assert.match(migration, /create or replace function public\.schedule_tree_knowledge_trial_round_v1/i);
  assert.match(migration, /v_round\.state <> 'draft'/i);
  assert.match(migration, /v_daily_count <> 5/i);
  assert.match(migration, /v_tiebreak_count not between 3 and 10/i);
  assert.match(migration, /other\.state in \('open', 'tiebreak'\)/i);
  assert.match(migration, /set state = 'open'/i);
  assert.match(migration, /'round-scheduled'/i);
});

test('round scheduling RPC remains service-role only', () => {
  assert.match(migration, /revoke all on function public\.schedule_tree_knowledge_trial_round_v1\(text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.schedule_tree_knowledge_trial_round_v1\(text\)[\s\S]*to service_role/i);
});
