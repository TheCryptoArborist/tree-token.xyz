import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/20260820211148_tree_knowledge_trial.sql', import.meta.url), 'utf8');

test('Knowledge Trial schema is private and client roles receive no table access', () => {
  assert.match(migration, /create table private\.tree_knowledge_trial_rounds/i);
  assert.match(migration, /create table private\.tree_knowledge_trial_passes/i);
  assert.match(migration, /create table private\.tree_knowledge_trial_attempts/i);
  assert.equal((migration.match(/enable row level security/gi) || []).length, 3);
  assert.equal((migration.match(/revoke all on private\.tree_knowledge_trial_/gi) || []).length, 3);
});

test('Knowledge Trial mutations are restricted to the server role', () => {
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /grant execute on function public\.issue_tree_knowledge_trial_pass_v1[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.start_tree_knowledge_trial_attempt_v1[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.submit_tree_knowledge_trial_attempt_v1[\s\S]*to service_role/i);
});

test('one wallet receives one pass and one attempt per round', () => {
  assert.match(migration, /unique \(round_id, wallet\)/i);
  assert.match(migration, /pass_id uuid not null unique/i);
  assert.match(migration, /qualifying_usd_cents >= 500/i);
  assert.match(migration, /question_count integer not null default 5/i);
  assert.match(migration, /correct_count integer check \(correct_count between 0 and 5\)/i);
});
