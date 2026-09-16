import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260820171000_tree_raffle_winner_claim_reconciliation.sql',
  import.meta.url,
), 'utf8');

test('winner publication is service-only and tied to the frozen ticket range', () => {
  assert.match(migration, /create or replace function public\.record_tree_raffle_winner/i);
  assert.match(migration, /jsonb_array_elements\(v_snapshot\.ticket_ranges\)/i);
  assert.match(migration, /TREE raffle winner wallet does not own the winning ticket/i);
  assert.match(migration, /on conflict \(round_id, prize_class\) do nothing/i);
  assert.match(migration, /TREE raffle winner conflicts with the recorded draw/i);
  assert.match(migration, /revoke all on function public\.record_tree_raffle_winner[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_tree_raffle_winner[\s\S]*to service_role/i);
});

test('claim reconciliation is idempotent and completes only a fully claimed round', () => {
  assert.match(migration, /create or replace function public\.record_tree_raffle_claim/i);
  assert.match(migration, /TREE raffle claim wallet does not match the winner/i);
  assert.match(migration, /TREE raffle claim conflicts with the recorded transaction/i);
  assert.match(migration, /count\(\*\) filter \(where claimed = false\)/i);
  assert.match(migration, /status = 'completed'/i);
  assert.match(migration, /revoke all on function public\.record_tree_raffle_claim[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_tree_raffle_claim[\s\S]*to service_role/i);
});
