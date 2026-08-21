import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20260820172000_tree_raffle_public_claim_identity.sql', import.meta.url), 'utf8');

test('public wallet snapshot includes only the on-chain identity required to claim', () => {
  assert.match(sql, /'onchainDrawId', w\.onchain_draw_id/i);
  assert.match(sql, /where v_wallet is not null and w\.wallet = v_wallet and w\.claimed = false/i);
  assert.match(sql, /revoke all on function public\.read_tree_raffle_public_snapshot\(text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.read_tree_raffle_public_snapshot\(text\)[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /admin_cap/i);
});
