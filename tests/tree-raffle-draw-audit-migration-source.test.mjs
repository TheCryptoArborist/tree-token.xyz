import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260820170000_tree_raffle_draw_audit.sql',
  import.meta.url,
), 'utf8');

test('draw snapshots are private, immutable inputs with service-role-only locking', () => {
  assert.match(migration, /create table if not exists private\.tree_raffle_draw_snapshots/i);
  assert.match(migration, /primary key \(round_id, prize_class\)/i);
  assert.match(migration, /ledger_commitment text not null check \(ledger_commitment ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
  assert.match(migration, /alter table private\.tree_raffle_draw_snapshots enable row level security/i);
  assert.match(migration, /revoke all on private\.tree_raffle_draw_snapshots from public, anon, authenticated/i);
  assert.match(migration, /create or replace function public\.lock_tree_raffle_draw/i);
  assert.match(migration, /revoke all on function public\.lock_tree_raffle_draw\(text, text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.lock_tree_raffle_draw\(text, text\)[\s\S]*to service_role/i);
});

test('draw locking freezes ticket mutation and uses canonical wallet ordering', () => {
  assert.match(migration, /TREE raffle tickets cannot change after the round is locked/i);
  assert.match(migration, /TREE raffle totals cannot change after the round is locked/i);
  assert.match(migration, /order by wallet rows between unbounded preceding and 1 preceding/i);
  assert.match(migration, /tree-raffle-ledger-v1/i);
  assert.match(migration, /extensions\.digest[\s\S]*'sha256'/i);
  assert.match(migration, /TREE raffle canonical ticket ranges do not match the round total/i);
});

test('weekly prize classes bind to separate on-chain draw identifiers', () => {
  assert.match(migration, /v_onchain_draw_id := p_round_id \|\| ':' \|\| p_prize_class/i);
  assert.match(migration, /unique index if not exists tree_raffle_winners_onchain_draw_id_idx/i);
  assert.match(migration, /foreign key \(round_id, prize_class\)[\s\S]*tree_raffle_draw_snapshots/i);
});
