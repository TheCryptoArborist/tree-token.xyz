import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseTreeRaffleReadModel } from '../netlify/lib/tree-raffle-supabase-read.ts';

test('public raffle read model calls only the server-side snapshot RPC', async () => {
  let capturedUrl = '';
  let capturedBody = '';
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body || '');
    return Response.json({ rounds: {}, history: [], wallet: null });
  };
  const reader = new SupabaseTreeRaffleReadModel(
    { url: 'https://example.supabase.co', secretKey: 'server-secret' },
    fetchImpl as typeof fetch,
  );
  assert.deepEqual(await reader.snapshot(null), { rounds: {}, history: [], wallet: null });
  assert.equal(capturedUrl, 'https://example.supabase.co/rest/v1/rpc/read_tree_raffle_public_snapshot');
  assert.equal(capturedBody, JSON.stringify({ p_wallet: null }));
});

test('public raffle read model rejects malformed database output', async () => {
  const reader = new SupabaseTreeRaffleReadModel(
    { url: 'https://example.supabase.co', secretKey: 'server-secret' },
    async () => Response.json({ rounds: [], history: 'bad', wallet: null }) as unknown as Promise<Response>,
  );
  await assert.rejects(() => reader.snapshot(null), /invalid raffle public snapshot/);
});
