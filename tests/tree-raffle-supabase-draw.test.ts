import test from 'node:test';
import assert from 'node:assert/strict';
import {
  treeRaffleLedgerCommitment,
  type TreeRaffleTicketRange,
} from '../netlify/lib/tree-raffle-draw-audit.ts';
import { SupabaseTreeRaffleDrawStore } from '../netlify/lib/tree-raffle-supabase-draw.ts';

const DRAW_ID = 'daily:2026-08-20:main';
const RANGES: TreeRaffleTicketRange[] = [{
  wallet: `0x${'1'.repeat(64)}`,
  tickets: '4',
  start: '0',
  endExclusive: '4',
}];

test('draw store locks through the service RPC and independently verifies the commitment', async () => {
  let capturedUrl = '';
  let capturedBody = '';
  const store = new SupabaseTreeRaffleDrawStore(
    { url: 'https://example.supabase.co', secretKey: 'server-secret', weeklyEnabled: false },
    (async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body);
      return Response.json({
        roundId: 'daily:2026-08-20',
        prizeClass: 'main',
        onchainDrawId: DRAW_ID,
        selectionScheme: 'wallet-asc-cumulative-v1',
        ticketRanges: RANGES,
        ledgerCommitment: treeRaffleLedgerCommitment(DRAW_ID, RANGES),
        totalTickets: '4',
      });
    }) as typeof fetch,
  );

  const snapshot = await store.lockDraw('daily:2026-08-20', 'main');
  assert.equal(snapshot.totalTickets, '4');
  assert.equal(capturedUrl, 'https://example.supabase.co/rest/v1/rpc/lock_tree_raffle_draw');
  assert.deepEqual(JSON.parse(capturedBody), {
    p_round_id: 'daily:2026-08-20',
    p_prize_class: 'main',
  });
});

test('draw store rejects tampered ticket totals and commitments', async () => {
  const response = (overrides: Record<string, unknown>) => Response.json({
    roundId: 'daily:2026-08-20',
    prizeClass: 'main',
    onchainDrawId: DRAW_ID,
    selectionScheme: 'wallet-asc-cumulative-v1',
    ticketRanges: RANGES,
    ledgerCommitment: treeRaffleLedgerCommitment(DRAW_ID, RANGES),
    totalTickets: '4',
    ...overrides,
  });

  const badTotal = new SupabaseTreeRaffleDrawStore(
    { url: 'https://example.supabase.co', secretKey: 'server-secret', weeklyEnabled: false },
    (async () => response({ totalTickets: '5' })) as typeof fetch,
  );
  await assert.rejects(() => badTotal.lockDraw('daily:2026-08-20', 'main'), /declared total/);

  const badCommitment = new SupabaseTreeRaffleDrawStore(
    { url: 'https://example.supabase.co', secretKey: 'server-secret', weeklyEnabled: false },
    (async () => response({ ledgerCommitment: '0'.repeat(64) })) as typeof fetch,
  );
  await assert.rejects(() => badCommitment.lockDraw('daily:2026-08-20', 'main'), /commitment does not match/);
});

test('winner and claim records round-trip only through their service RPCs', async () => {
  const wallet = `0x${'1'.repeat(64)}`;
  const drawTxDigest = '1'.repeat(40);
  const registerTxDigest = '2'.repeat(40);
  const claimTxDigest = '3'.repeat(40);
  const commitment = treeRaffleLedgerCommitment(DRAW_ID, RANGES);
  const called: string[] = [];
  const store = new SupabaseTreeRaffleDrawStore(
    { url: 'https://example.supabase.co', secretKey: 'server-secret', weeklyEnabled: false },
    (async (url, init) => {
      called.push(String(url));
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith('/record_tree_raffle_winner')) {
        return Response.json({
          outcome: 'recorded',
          roundId: body.p_round_id,
          prizeClass: body.p_prize_class,
          onchainDrawId: body.p_onchain_draw_id,
          ledgerCommitment: body.p_ledger_commitment,
          winningTicket: body.p_winning_ticket,
          totalTickets: '4',
          wallet: body.p_wallet,
          token: 'SUI',
          tokenType: '0x2::sui::SUI',
          amountRaw: '1000000000',
          decimals: 9,
          drawTxDigest: body.p_draw_tx_digest,
          registerTxDigest: body.p_register_tx_digest,
        });
      }
      return Response.json({
        outcome: 'recorded',
        roundId: body.p_round_id,
        prizeClass: body.p_prize_class,
        wallet: body.p_wallet,
        claimTxDigest: body.p_claim_tx_digest,
        claimedAt: '2026-08-20T17:30:00.000Z',
      });
    }) as typeof fetch,
  );

  const winner = await store.recordWinner({
    roundId: 'daily:2026-08-20',
    prizeClass: 'main',
    onchainDrawId: DRAW_ID,
    ledgerCommitment: commitment,
    winningTicket: '2',
    totalTickets: '4',
    wallet,
    token: 'SUI',
    tokenType: '0x2::sui::SUI',
    amountRaw: '1000000000',
    decimals: 9,
    drawTxDigest,
    registerTxDigest,
  });
  assert.equal(winner.outcome, 'recorded');

  const claim = await store.recordClaim({
    roundId: 'daily:2026-08-20',
    prizeClass: 'main',
    wallet,
    claimTxDigest,
  });
  assert.equal(claim.claimedAt, '2026-08-20T17:30:00.000Z');
  assert.deepEqual(called, [
    'https://example.supabase.co/rest/v1/rpc/record_tree_raffle_winner',
    'https://example.supabase.co/rest/v1/rpc/record_tree_raffle_claim',
  ]);
});

test('winner adapter rejects database output that differs from the verified chain result', async () => {
  const store = new SupabaseTreeRaffleDrawStore(
    { url: 'https://example.supabase.co', secretKey: 'server-secret', weeklyEnabled: false },
    (async () => Response.json({ outcome: 'recorded' })) as typeof fetch,
  );
  await assert.rejects(() => store.recordWinner({
    roundId: 'daily:2026-08-20',
    prizeClass: 'main',
    onchainDrawId: DRAW_ID,
    ledgerCommitment: treeRaffleLedgerCommitment(DRAW_ID, RANGES),
    winningTicket: '2',
    totalTickets: '4',
    wallet: `0x${'1'.repeat(64)}`,
    token: 'SUI',
    tokenType: '0x2::sui::SUI',
    amountRaw: '1000000000',
    decimals: 9,
    drawTxDigest: '1'.repeat(40),
    registerTxDigest: '2'.repeat(40),
  }), /invalid TREE raffle winner record/);
});
