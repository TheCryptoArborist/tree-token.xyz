import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL(
  '../supabase/migrations/20260820235753_tree_knowledge_trial_sudden_death.sql',
  import.meta.url,
), 'utf8');

test('sudden-death questions and attempts remain private', () => {
  assert.match(migration, /create table private\.tree_knowledge_trial_tiebreak_questions/i);
  assert.match(migration, /create table private\.tree_knowledge_trial_tiebreak_attempts/i);
  assert.equal((migration.match(/enable row level security/gi) || []).length, 2);
  assert.equal((migration.match(/revoke all on private\.tree_knowledge_trial_tiebreak_/gi) || []).length, 2);
});

test('only qualified wallets can start one timed attempt per stage', () => {
  assert.match(migration, /state = 'pending'\s+and active_stage = p_stage/i);
  assert.match(migration, /unique \(round_id, wallet, stage\)/i);
  assert.match(migration, /duration_seconds integer not null default 30/i);
  assert.match(migration, /least\(v_now \+ make_interval\(secs => v_question\.duration_seconds\)/i);
});

test('database scores the private answer and advances only exact tied leaders', () => {
  assert.match(migration, /correct = p_selected_option_id = v_question\.correct_option_id/i);
  assert.match(migration, /order by correct desc, elapsed_ms asc, wallet asc/i);
  assert.match(migration, /v_next_stage := v_round\.tiebreak_stage \+ 1/i);
  assert.match(migration, /sudden-death-question-required/i);
});

test('sudden-death RPCs are server-only', () => {
  for (const rpc of [
    'create_tree_knowledge_trial_tiebreak_challenge_v1',
    'start_tree_knowledge_trial_tiebreak_attempt_v1',
    'submit_tree_knowledge_trial_tiebreak_attempt_v1',
    'resolve_tree_knowledge_trial_round_v2',
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${rpc}[\\s\\S]*?from public, anon, authenticated`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*?to service_role`, 'i'));
  }
});
