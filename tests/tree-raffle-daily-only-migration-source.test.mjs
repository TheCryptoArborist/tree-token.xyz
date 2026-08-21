import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260820190000_tree_raffle_daily_only.sql',
  import.meta.url,
), 'utf8');

test('daily-only RPC reuses audited validation and removes weekly credits once', () => {
  assert.match(migration, /public\.record_tree_raffle_verified_buy\(/i);
  assert.match(migration, /v_result->>'outcome' = 'recorded'/i);
  assert.match(migration, /where round_id = p_weekly_round_id and kind = 'weekly'/i);
  assert.match(migration, /update private\.tree_raffle_verified_buys[\s\S]*lucky_leaf_tickets = 0/i);
  assert.match(migration, /prize_amount_raw = 50000000000/i);
  assert.match(migration, /where round_id = p_daily_round_id[\s\S]*kind = 'daily'/i);
  assert.match(migration, /p_raffle_date \+ 1 \+ time '10:00'[\s\S]*America\/New_York/i);
});

test('daily-only RPC remains private and service-role-only', () => {
  assert.match(migration, /security definer\s+set search_path = ''\s+set statement_timeout = '5s'/i);
  assert.match(migration, /revoke all on function public\.record_tree_raffle_verified_buy_daily_only[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_tree_raffle_verified_buy_daily_only[\s\S]*to service_role/i);
});
