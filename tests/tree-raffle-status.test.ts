import test from 'node:test';
import assert from 'node:assert/strict';
import { treeRaffleStatus } from '../netlify/functions/tree-raffle-status.ts';

test('public raffle status exposes no active round, entries, or claims', () => {
  const status = treeRaffleStatus('2026-08-16T00:00:00.000Z');
  assert.equal(status.generatedAt, '2026-08-16T00:00:00.000Z');
  assert.equal(status.rules.acceptingEntries, false);
  assert.equal(status.rules.claimsEnabled, false);
  assert.equal(status.publicLaunchAt, null);
  assert.equal(status.rounds.daily.state, 'not-scheduled');
  assert.deepEqual(status.rounds.daily.prize, {
    symbol: 'TREE',
    coinType: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
    amountRaw: '50000000000',
    decimals: 6,
  });
  assert.equal(status.rounds.weekly.prize, null);
  assert.deepEqual(status.history, []);
  assert.deepEqual(status.safeguards, {
    replaySafeLedgerModel: true,
    finalizedBuyVerifierImplemented: true,
    transactionalLedgerConfigured: false,
    onchainPrizePoolConfigured: false,
    drawExecutorConfigured: false,
    verifiedBuyIngestionEnabled: false,
    entriesRecorded: false,
    paymentsAccepted: false,
    winnerSelectionEnabled: false,
  });
});

test('public raffle status reflects launch flags from env', () => {
  const status = treeRaffleStatus(
    '2026-08-16T00:00:00.000Z',
    {
      TREE_RAFFLE_SUPABASE_URL: 'https://example.supabase.co',
      TREE_RAFFLE_SUPABASE_SECRET_KEY: 'secret',
      TREE_RAFFLE_INGEST_ENABLED: 'true',
      TREE_RAFFLE_ACCEPTING_ENTRIES: 'true',
      TREE_RAFFLE_PUBLIC_LAUNCH_AT: '2026-08-24T14:00:00-04:00',
      TREE_RAFFLE_CLAIMS_ENABLED: 'true',
      TREE_RAFFLE_PRIZES_FUNDED: 'true',
      TREE_RAFFLE_PACKAGE_ID: '0xpackage',
      TREE_RAFFLE_PRIZE_POOL_ID: '0xpool',
      TREE_RAFFLE_OPERATOR_CAP_ID: '0xoperator',
      TREE_RAFFLE_DRAW_EXECUTOR_READY: 'true',
    },
  );
  assert.equal(status.rules.acceptingEntries, true);
  assert.equal(status.publicLaunchAt, '2026-08-24T18:00:00.000Z');
  assert.equal(status.safeguards.transactionalLedgerConfigured, true);
  assert.equal(status.safeguards.onchainPrizePoolConfigured, true);
  assert.equal(status.safeguards.drawExecutorConfigured, true);
  assert.equal(status.safeguards.verifiedBuyIngestionEnabled, true);
  assert.equal(status.safeguards.entriesRecorded, true);
  assert.equal(status.launchBlockers.includes('Entry recording is disabled.'), false);
});
