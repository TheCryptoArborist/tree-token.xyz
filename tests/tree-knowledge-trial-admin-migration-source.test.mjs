import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL(
  '../supabase/migrations/20260821003948_tree_knowledge_trial_admin_setup.sql',
  import.meta.url,
), 'utf8');

test('admin preparation is atomic, draft-only, and audited without answer content', () => {
  assert.match(migration, /create table private\.tree_knowledge_trial_admin_events/i);
  assert.match(migration, /if found and v_round\.state <> 'draft'/i);
  assert.match(migration, /insert into private\.tree_knowledge_trial_question_sets/i);
  assert.match(migration, /insert into private\.tree_knowledge_trial_rounds/i);
  assert.match(migration, /insert into private\.tree_knowledge_trial_tiebreak_questions/i);
  assert.match(migration, /request_sha256 text not null/i);
  assert.doesNotMatch(migration, /admin_events[\s\S]{0,400}correct_option_id/i);
});

test('admin setup tables and functions are server-only', () => {
  assert.match(migration, /alter table private\.tree_knowledge_trial_admin_events enable row level security/i);
  assert.match(migration, /revoke all on private\.tree_knowledge_trial_admin_events from public, anon, authenticated/i);
  for (const rpc of ['prepare_tree_knowledge_trial_round_v1', 'read_tree_knowledge_trial_round_setup_v1']) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${rpc}[\\s\\S]*?from public, anon, authenticated`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*?to service_role`, 'i'));
  }
});

test('database requires five daily and at least three sudden-death questions', () => {
  assert.match(migration, /jsonb_array_length\(p_questions\) <> 5/i);
  assert.match(migration, /jsonb_array_length\(p_tiebreak_questions\) not between 3 and 10/i);
  assert.match(migration, /duration_seconds, question_count,[\s\S]*180, 5/i);
  assert.match(migration, /minimum_qualifying_usd_cents[\s\S]*500/i);
});
