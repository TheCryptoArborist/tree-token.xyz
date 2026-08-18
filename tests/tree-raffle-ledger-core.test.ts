import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVerifiedTreeBuy,
  emptyTreeRaffleLedger,
  type VerifiedTreeBuy,
} from '../netlify/lib/tree-raffle-ledger-core.ts';

const BUYER = `0x${'18'.repeat(32)}`;

function verifiedBuy(overrides: Partial<VerifiedTreeBuy> = {}): VerifiedTreeBuy {
  return {
    txDigest: '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5',
    buyer: BUYER,
    treeAmountRaw: '1000000000',
    qualifyingUsdCents: 2_500,
    route: 'suidex-v3',
    finalizedCheckpoint: 123_456,
    finalizedAt: '2026-08-17T14:00:00.000Z',
    raffleDate: '2026-08-17',
    dailyRoundId: 'daily:2026-08-17',
    weeklyRoundId: 'weekly:2026-08-23',
    ...overrides,
  };
}

test('a qualifying finalized buy credits daily and weekly rounds exactly once', () => {
  const first = applyVerifiedTreeBuy(emptyTreeRaffleLedger(), verifiedBuy());
  assert.equal(first.result.outcome, 'recorded');
  assert.equal(first.result.qualifies, true);
  assert.equal(first.result.mainTickets, 6);
  assert.equal(first.result.luckyLeafTickets, 1);
  assert.equal(first.state.revision, 1);
  assert.equal(first.state.rounds['daily:2026-08-17'].totalMainTickets, 6);
  assert.equal(first.state.rounds['daily:2026-08-17'].totalLuckyLeafTickets, 0);
  assert.equal(first.state.rounds['weekly:2026-08-23'].totalMainTickets, 6);
  assert.equal(first.state.rounds['weekly:2026-08-23'].totalLuckyLeafTickets, 1);

  const duplicate = applyVerifiedTreeBuy(first.state, verifiedBuy());
  assert.equal(duplicate.result.outcome, 'duplicate');
  assert.equal(duplicate.state, first.state);
  assert.equal(duplicate.state.revision, 1);
  assert.equal(duplicate.state.rounds['weekly:2026-08-23'].totalMainTickets, 6);
});

test('the same digest with changed verified data is rejected as a conflict', () => {
  const first = applyVerifiedTreeBuy(emptyTreeRaffleLedger(), verifiedBuy());
  assert.throws(
    () => applyVerifiedTreeBuy(first.state, verifiedBuy({ qualifyingUsdCents: 5_000 })),
    /Conflicting verified data/,
  );
});

test('non-qualifying buys are journaled for replay safety but receive no tickets or streak', () => {
  const transition = applyVerifiedTreeBuy(
    emptyTreeRaffleLedger(),
    verifiedBuy({ qualifyingUsdCents: 499 }),
  );
  assert.equal(transition.result.qualifies, false);
  assert.equal(transition.result.mainTickets, 0);
  assert.equal(transition.result.streakDays, null);
  assert.deepEqual(transition.state.rounds, {});
  assert.equal(transition.state.journal.length, 1);
  assert.equal(transition.state.processedDigests[verifiedBuy().txDigest].qualifies, false);
});

test('streaks advance by New York raffle date, stay stable on the same day, and reset after a gap', () => {
  let state = emptyTreeRaffleLedger();
  const dates = [
    ['2026-08-17', '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5'],
    ['2026-08-17', '6wVcpdjgkWd7zaihFWd4sCAKuFGo3Dm9qHCEqaW2U3T3'],
    ['2026-08-18', 'CPpd1cgM1HjM86DJ6rzkxejdhMYQm8t4a7fpo9L9CwHK'],
    ['2026-08-20', 'BEuVBY7S3hWzZCk1qRgFsYCn7MWJ9wJ4n3LJ5j2jQp2s'],
  ] as const;
  const streaks: Array<number | null> = [];
  for (const [raffleDate, txDigest] of dates) {
    const transition = applyVerifiedTreeBuy(state, verifiedBuy({
      raffleDate,
      txDigest,
      dailyRoundId: `daily:${raffleDate}`,
    }));
    state = transition.state;
    streaks.push(transition.result.streakDays);
  }
  assert.deepEqual(streaks, [1, 1, 2, 1]);
  assert.throws(
    () => applyVerifiedTreeBuy(state, verifiedBuy({
      raffleDate: '2026-08-19',
      txDigest: '7wVcpdjgkWd7zaihFWd4sCAKuFGo3Dm9qHCEqaW2U3T4',
      dailyRoundId: 'daily:2026-08-19',
    })),
    /raffle-date order/,
  );
});

test('ledger rejects malformed or non-allowlisted verified-buy input', () => {
  const state = emptyTreeRaffleLedger();
  assert.throws(
    () => applyVerifiedTreeBuy(state, verifiedBuy({ buyer: '0x1234' })),
    /32-byte Sui address/,
  );
  assert.throws(
    () => applyVerifiedTreeBuy(state, verifiedBuy({ route: 'unverified' as never })),
    /not allowlisted/,
  );
  assert.throws(
    () => applyVerifiedTreeBuy(state, verifiedBuy({ raffleDate: '2026-02-30' })),
    /real calendar date/,
  );
});
