import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../supabase/migrations/20260821020506_tree_knowledge_trial_award_settlement.sql', import.meta.url), 'utf8');

test('Knowledge Trial award snapshot binds the resolved winner to one on-chain prize', () => {
  assert.match(source, /create table if not exists private\.tree_knowledge_trial_awards/);
  assert.match(source, /tree-knowledge-award-v1/);
  assert.match(source, /winner_attempt_id/);
  assert.match(source, /prize_amount_raw/);
  assert.match(source, /amount_raw <= 18446744073709551615/);
  assert.match(source, /state = 'awarded'/);
});

test('award locking, recording, lookup, and claim reconciliation remain server-only', () => {
  for (const signature of [
    'lock_next_tree_knowledge_trial_award_v1\\(\\)',
    'record_tree_knowledge_trial_award_v1\\(text, text, text, text, text, text\\)',
    'read_tree_knowledge_trial_award_v1\\(text, text\\)',
    'record_tree_knowledge_trial_claim_v1\\(text, text, text\\)',
  ]) {
    assert.match(source, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated`, 'i'));
    assert.match(source, new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to service_role`, 'i'));
  }
});

test('public snapshot exposes claim state without exposing the resolution commitment', () => {
  const snapshot = source.slice(source.indexOf('create or replace function public.read_tree_knowledge_trial_public_snapshot_v1'));
  assert.match(snapshot, /'claimable'/);
  assert.match(snapshot, /'claimed'/);
  assert.doesNotMatch(snapshot, /'resolutionCommitment'/);
});
