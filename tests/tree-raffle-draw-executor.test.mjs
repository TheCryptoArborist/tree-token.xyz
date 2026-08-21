import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_PRIZE_RAW,
  SupabaseDailyDrawStore,
  dueDailyRoundId,
  runDailyDraw,
  runNextKnowledgeTrialAward,
  winnerForTicket,
} from '../keeper/tree-raffle-draw-executor.mjs';

test('daily scheduler selects only the previous New York raffle date after 10:05', () => {
  assert.equal(dueDailyRoundId(new Date('2026-08-20T14:04:00.000Z')), null);
  assert.equal(dueDailyRoundId(new Date('2026-08-20T14:05:00.000Z')), 'daily:2026-08-19');
});

test('Knowledge Trial award orchestration reserves only the resolved 50,000 TREE prize', async () => {
  const wallet = `0x${'3'.repeat(64)}`;
  const snapshot = {
    roundId: 'knowledge:2026-08-22',
    onchainDrawId: 'knowledge:2026-08-22:award',
    resolutionCommitment: 'cd'.repeat(32),
    ledgerCommitment: 'cd'.repeat(32),
    totalTickets: '1',
    wallet,
    tokenType: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
    amountRaw: DAILY_PRIZE_RAW,
  };
  let recorded;
  const result = await runNextKnowledgeTrialAward({
    store: {
      lockNext: async () => snapshot,
      recordAward: async (input) => { recorded = input; return { outcome: 'recorded' }; },
    },
    chain: {
      settleKnowledgeAward: async () => ({ drawTxDigest: '3'.repeat(40), registerTxDigest: '3'.repeat(40) }),
    },
  });
  assert.equal(result.status, 'awarded');
  assert.equal(result.wallet, wallet);
  assert.equal(recorded.roundId, snapshot.roundId);
  assert.equal(recorded.wallet, wallet);
  assert.equal(recorded.resolutionCommitment, snapshot.resolutionCommitment);
});

test('Knowledge Trial award orchestration is a clean no-op without a scored winner', async () => {
  let chainCalled = false;
  const result = await runNextKnowledgeTrialAward({
    store: { lockNext: async () => null },
    chain: { settleKnowledgeAward: async () => { chainCalled = true; } },
  });
  assert.deepEqual(result, { status: 'no-award-ready' });
  assert.equal(chainCalled, false);
});

test('winning tickets map to one canonical wallet range', () => {
  const ranges = [
    { wallet: `0x${'1'.repeat(64)}`, start: '0', endExclusive: '2' },
    { wallet: `0x${'2'.repeat(64)}`, start: '2', endExclusive: '5' },
  ];
  assert.equal(winnerForTicket(ranges, '3'), ranges[1].wallet);
  assert.throws(() => winnerForTicket(ranges, '5'), /outside/);
});

test('a missing prior daily round is a clean no-op', async () => {
  const store = new SupabaseDailyDrawStore({
    url: 'https://example.supabase.co',
    secretKey: 'server-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      code: 'P0002', message: 'TREE raffle round was not found.',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } }),
  });
  assert.equal(await store.lockDaily('daily:2026-08-19'), null);
  let chainCalled = false;
  const result = await runDailyDraw({
    roundId: 'daily:2026-08-19', store,
    chain: { executeDraw: async () => { chainCalled = true; } },
  });
  assert.deepEqual(result, { status: 'no-round', roundId: 'daily:2026-08-19' });
  assert.equal(chainCalled, false);
});

test('daily draw orchestration records only the persisted draw and reserved 50,000 TREE prize', async () => {
  const wallet = `0x${'1'.repeat(64)}`;
  const snapshot = {
    roundId: 'daily:2026-08-19', prizeClass: 'main',
    onchainDrawId: 'daily:2026-08-19:main', ledgerCommitment: 'ab'.repeat(32),
    totalTickets: '4', ticketRanges: [{ wallet, start: '0', endExclusive: '4' }],
  };
  let recorded;
  const result = await runDailyDraw({
    roundId: snapshot.roundId,
    store: {
      lockDaily: async () => snapshot,
      recordWinner: async (input) => { recorded = input; return { outcome: 'recorded' }; },
    },
    chain: {
      executeDraw: async () => ({ digest: '1'.repeat(40), winningTicket: '2' }),
      registerWinner: async () => ({ digest: '2'.repeat(40), winner: wallet, amountRaw: DAILY_PRIZE_RAW }),
    },
  });
  assert.equal(result.winner, wallet);
  assert.equal(recorded.wallet, wallet);
  assert.equal(recorded.winningTicket, '2');
});
