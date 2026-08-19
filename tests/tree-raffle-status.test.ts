import test from 'node:test';
import assert from 'node:assert/strict';
import { treeRaffleStatus } from '../netlify/functions/tree-raffle-status.ts';

test('public raffle status exposes no active round, entries, or claims', () => {
  const status = treeRaffleStatus('2026-08-16T00:00:00.000Z');
  assert.equal(status.generatedAt, '2026-08-16T00:00:00.000Z');
  assert.equal(status.rules.acceptingEntries, false);
  assert.equal(status.rules.claimsEnabled, false);
  assert.equal(status.rounds.daily.state, 'not-scheduled');
  assert.equal(status.rounds.weekly.prize, null);
  assert.deepEqual(status.history, []);
  assert.deepEqual(status.safeguards, {
    replaySafeLedgerModel: true,
    finalizedBuyVerifierImplemented: true,
    transactionalLedgerConfigured: false,
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
    },
  );
  assert.equal(status.rules.acceptingEntries, true);
  assert.equal(status.safeguards.transactionalLedgerConfigured, true);
  assert.equal(status.safeguards.verifiedBuyIngestionEnabled, true);
  assert.equal(status.safeguards.entriesRecorded, true);
  assert.equal(status.launchBlockers.includes('Entry recording is disabled.'), false);
});
