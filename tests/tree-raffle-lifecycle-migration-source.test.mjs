import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260820162000_tree_raffle_round_lifecycle.sql',
  import.meta.url,
), 'utf8');

test('round lifecycle and winners remain private and replay-safe', () => {
  assert.match(migration, /create table if not exists private\.tree_raffle_winners/i);
  assert.match(migration, /primary key \(round_id, prize_class\)/i);
  assert.match(migration, /alter table private\.tree_raffle_winners enable row level security/i);
  assert.match(migration, /revoke all on private\.tree_raffle_winners from public, anon, authenticated/i);
  assert.match(migration, /winning_ticket < total_tickets/i);
});

test('only service role can read the sanitized raffle snapshot RPC', () => {
  assert.match(migration, /create or replace function public\.read_tree_raffle_public_snapshot/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function public\.read_tree_raffle_public_snapshot\(text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.read_tree_raffle_public_snapshot\(text\)[\s\S]*to service_role/i);
});
