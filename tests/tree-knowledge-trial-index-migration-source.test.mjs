import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL(
  '../supabase/migrations/20260821010141_tree_knowledge_trial_fk_indexes.sql',
  import.meta.url,
), 'utf8');

test('every advisor-reported Challenge foreign key has a covering index', () => {
  for (const columns of [
    'tree_knowledge_trial_passes (qualifying_tx_digest)',
    'tree_knowledge_trial_rounds (question_set_version)',
    'tree_knowledge_trial_rounds (winner_attempt_id)',
    'tree_knowledge_trial_rounds (winner_tiebreak_attempt_id)',
    'tree_knowledge_trial_wallet_challenges (qualifying_tx_digest)',
    'tree_knowledge_trial_wallet_challenges (round_id)',
  ]) {
    assert.match(migration, new RegExp(columns.replace(/[()]/g, '\\$&'), 'i'));
  }
});
