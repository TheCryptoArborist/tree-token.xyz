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
    entriesRecorded: false,
    paymentsAccepted: false,
    winnerSelectionEnabled: false,
  });
});
