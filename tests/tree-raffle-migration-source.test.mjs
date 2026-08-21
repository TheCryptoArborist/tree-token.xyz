import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260817235445_tree_raffle_ledger.sql',
  import.meta.url,
), 'utf8');

test('raffle migration keeps accounting private and exposes only the atomic service RPC', () => {
  assert.match(migration, /create schema if not exists private/i);
  assert.match(migration, /revoke all on schema private from public, anon, authenticated/i);
  assert.match(migration, /alter table private\.tree_raffle_verified_buys enable row level security/i);
  assert.match(migration, /security definer\s+set search_path = ''\s+set statement_timeout = '5s'/i);
  assert.match(migration, /revoke all on function public\.record_tree_raffle_verified_buy[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_tree_raffle_verified_buy[\s\S]*to service_role/i);
});

test('raffle migration enforces replay safety, consistent locks, and both round credits', () => {
  assert.match(migration, /tx_digest text primary key/i);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*tree-raffle-tx:/i);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*tree-raffle-wallet:/i);
  assert.ok(
    migration.indexOf('tree-raffle-tx:') < migration.indexOf('tree-raffle-wallet:'),
    'transaction locks must always be acquired before wallet locks',
  );
  assert.match(migration, /where round_id = p_daily_round_id/i);
  assert.match(migration, /where round_id = p_weekly_round_id/i);
  assert.match(migration, /Conflicting verified data for existing TREE raffle transaction digest/i);
});

test('raffle keeper cursors are private, service-role-only, and compare-and-set', () => {
  assert.match(migration, /create table private\.tree_raffle_keeper_cursors/i);
  assert.match(migration, /alter table private\.tree_raffle_keeper_cursors enable row level security/i);
  assert.match(migration, /tree-raffle-cursor:/i);
  assert.match(migration, /cursor is distinct from p_expected_cursor/i);
  assert.match(migration, /revoke all on function public\.load_tree_raffle_keeper_cursors\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.save_tree_raffle_keeper_cursor\(text, text, text, text\)[\s\S]*to service_role/i);
});
