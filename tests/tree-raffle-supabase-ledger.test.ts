import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SupabaseTreeRaffleLedger,
  treeRaffleSupabaseConfig,
} from '../netlify/lib/tree-raffle-supabase-ledger.ts';

const BUY = {
  txDigest: '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5',
  buyer: `0x${'18'.repeat(32)}`,
  treeAmountRaw: '1000000000',
  qualifyingUsdCents: 2_500,
  route: 'suidex-v3' as const,
  finalizedCheckpoint: 123_456,
  finalizedAt: '2026-08-17T14:00:00.000Z',
  raffleDate: '2026-08-17',
  dailyRoundId: 'daily:2026-08-17',
  weeklyRoundId: 'weekly:2026-08-23',
};

test('server-only Supabase config requires HTTPS and isolated raffle credentials', () => {
  assert.deepEqual(treeRaffleSupabaseConfig({
    TREE_RAFFLE_SUPABASE_URL: 'https://example.supabase.co/path',
    TREE_RAFFLE_SUPABASE_SECRET_KEY: 'secret-key',
  }), {
    url: 'https://example.supabase.co',
    secretKey: 'secret-key',
  });
  assert.throws(() => treeRaffleSupabaseConfig({}), /URL is not configured/);
  assert.throws(() => treeRaffleSupabaseConfig({
    TREE_RAFFLE_SUPABASE_URL: 'http://example.test',
    TREE_RAFFLE_SUPABASE_SECRET_KEY: 'secret-key',
  }), /must use HTTPS/);
});

test('ledger adapter calls only the atomic RPC and parses bigint JSON values safely', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return Response.json({
      outcome: 'recorded',
      qualifies: true,
      streakDays: 1,
      mainTickets: '6',
      luckyLeafTickets: '1',
      dailyRoundId: BUY.dailyRoundId,
      weeklyRoundId: BUY.weeklyRoundId,
    });
  };
  const ledger = new SupabaseTreeRaffleLedger(
    { url: 'https://example.supabase.co', secretKey: 'server-secret' },
    fakeFetch as typeof fetch,
  );
  const result = await ledger.recordVerifiedBuy(BUY);
  assert.equal(capturedUrl, 'https://example.supabase.co/rest/v1/rpc/record_tree_raffle_verified_buy');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal((capturedInit?.headers as Record<string, string>).apikey, 'server-secret');
  assert.equal(JSON.parse(String(capturedInit?.body)).p_tx_digest, BUY.txDigest);
  assert.deepEqual(result, {
    outcome: 'recorded',
    qualifies: true,
    streakDays: 1,
    mainTickets: 6,
    luckyLeafTickets: 1,
    dailyRoundId: BUY.dailyRoundId,
    weeklyRoundId: BUY.weeklyRoundId,
  });
});

test('ledger adapter fails closed on RPC errors and malformed responses', async () => {
  const failed = new SupabaseTreeRaffleLedger(
    { url: 'https://example.supabase.co', secretKey: 'server-secret' },
    (async () => Response.json({ message: 'digest conflict' }, { status: 409 })) as typeof fetch,
  );
  await assert.rejects(() => failed.recordVerifiedBuy(BUY), /digest conflict/);

  const malformed = new SupabaseTreeRaffleLedger(
    { url: 'https://example.supabase.co', secretKey: 'server-secret' },
    (async () => Response.json({ outcome: 'maybe' })) as typeof fetch,
  );
  await assert.rejects(() => malformed.recordVerifiedBuy(BUY), /invalid raffle ledger outcome/);
});
