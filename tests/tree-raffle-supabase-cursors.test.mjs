import test from 'node:test';
import assert from 'node:assert/strict';
import {
  keeperSupabaseConfig,
  SupabaseKeeperCursorStore,
} from '../keeper/tree-raffle-supabase-cursors.mjs';

test('keeper Supabase config requires server-only HTTPS credentials', () => {
  assert.throws(() => keeperSupabaseConfig({}), /URL is not configured/);
  assert.throws(() => keeperSupabaseConfig({
    TREE_RAFFLE_SUPABASE_URL: 'http://example.com',
    TREE_RAFFLE_SUPABASE_SECRET_KEY: 'secret',
  }), /must use HTTPS/);
  assert.deepEqual(keeperSupabaseConfig({
    TREE_RAFFLE_SUPABASE_URL: 'https://example.supabase.co/path',
    TREE_RAFFLE_SUPABASE_SECRET_KEY: 'secret',
  }), { url: 'https://example.supabase.co', secretKey: 'secret' });
});

test('cursor store loads and compare-and-sets through service-role RPCs', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    const isLoad = url.endsWith('/load_tree_raffle_keeper_cursors');
    return Response.json(isLoad ? [{
      streamId: 'suidex-v2', eventType: 'event-type', cursor: 'cursor-1', version: 1,
    }] : {
      streamId: 'suidex-v2', eventType: 'event-type', cursor: 'cursor-2', version: 2,
    });
  };
  const store = new SupabaseKeeperCursorStore({ url: 'https://example.supabase.co', secretKey: 'secret' }, fetchImpl);
  assert.equal((await store.load())[0].cursor, 'cursor-1');
  assert.equal((await store.compareAndSet({
    streamId: 'suidex-v2', eventType: 'event-type', expectedCursor: 'cursor-1', nextCursor: 'cursor-2',
  })).cursor, 'cursor-2');
  assert.equal(requests[0].init.headers.apikey, 'secret');
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    p_stream_id: 'suidex-v2', p_event_type: 'event-type', p_expected_cursor: 'cursor-1', p_next_cursor: 'cursor-2',
  });
});

test('cursor store fails closed on malformed and conflicting RPC responses', async () => {
  const malformed = new SupabaseKeeperCursorStore(
    { url: 'https://example.supabase.co', secretKey: 'secret' },
    async () => Response.json({ cursor: 'missing-fields' }),
  );
  await assert.rejects(() => malformed.load(), /invalid keeper cursor list/);

  const conflict = new SupabaseKeeperCursorStore(
    { url: 'https://example.supabase.co', secretKey: 'secret' },
    async () => Response.json({ message: 'TREE raffle keeper cursor changed concurrently.' }, { status: 409 }),
  );
  await assert.rejects(() => conflict.compareAndSet({
    streamId: 'suidex-v2', eventType: 'event-type', expectedCursor: null, nextCursor: 'cursor-1',
  }), /changed concurrently/);
});
