import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/20260820214631_tree_knowledge_trial_wallet_security.sql', import.meta.url), 'utf8');

test('live question answers and wallet challenges remain private', () => {
  assert.match(migration, /create table private\.tree_knowledge_trial_question_sets/i);
  assert.match(migration, /create table private\.tree_knowledge_trial_wallet_challenges/i);
  assert.equal((migration.match(/enable row level security/gi) || []).length, 3);
  assert.match(migration, /revoke all on private\.tree_knowledge_trial_question_sets from public, anon, authenticated/i);
  assert.match(migration, /revoke all on private\.tree_knowledge_trial_wallet_challenges from public, anon, authenticated/i);
  assert.match(migration, /revoke all on private\.tree_knowledge_trial_tiebreak_qualifiers from public, anon, authenticated/i);
});

test('wallet challenges are single-use, expiring, and rate limited', () => {
  assert.match(migration, /consumed_at is null[\s\S]*expires_at > clock_timestamp\(\)/i);
  assert.match(migration, /created_at >= v_now - interval '10 minutes'/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /nonce_sha256 text not null unique/i);
});

test('attempt v2 calculates elapsed time from database timestamps', () => {
  assert.match(migration, /create or replace function public\.submit_tree_knowledge_trial_attempt_v2\([\s\S]*p_correct_count integer[\s\S]*v_elapsed_ms := greatest/i);
  assert.doesNotMatch(migration, /submit_tree_knowledge_trial_attempt_v2\([\s\S]{0,180}p_elapsed_ms/i);
  assert.match(migration, /revoke execute on function public\.submit_tree_knowledge_trial_attempt_v1[\s\S]*from service_role/i);
});

test('daily resolution records one winner or creates a sudden-death group', () => {
  assert.match(migration, /create or replace function public\.resolve_tree_knowledge_trial_round_v1/i);
  assert.match(migration, /if v_tie_count = 1 then[\s\S]*state = 'scored'[\s\S]*winner_wallet = v_leader\.wallet/i);
  assert.match(migration, /insert into private\.tree_knowledge_trial_tiebreak_qualifiers/i);
  assert.match(migration, /set state = 'tiebreak'/i);
  assert.doesNotMatch(migration, /split[-_ ]prize/i);
});

test('all new RPCs are restricted to the server role', () => {
  for (const name of [
    'create_tree_knowledge_trial_wallet_challenge_v1',
    'read_tree_knowledge_trial_wallet_challenge_v1',
    'consume_tree_knowledge_trial_wallet_challenge_v1',
    'start_tree_knowledge_trial_attempt_v2',
    'read_tree_knowledge_trial_attempt_context_v1',
    'read_tree_knowledge_trial_question_set_v1',
    'submit_tree_knowledge_trial_attempt_v2',
    'resolve_tree_knowledge_trial_round_v1',
    'read_tree_knowledge_trial_public_snapshot_v1',
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}[\\s\\S]*?from public, anon, authenticated`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*?to service_role`, 'i'));
  }
});
