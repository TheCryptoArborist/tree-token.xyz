import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE_RAFFLE_DAILY_PRIZE,
  TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN,
  TREE_RAFFLE_RULES,
  dailyLuckyLeafBudgetUsdCents,
  raffleLaunchBlockers,
  streakMultiplierBasisPoints,
  ticketPreviewFromUsdCents,
} from '../netlify/lib/tree-raffle-core.ts';

test('raffle rules fail closed', () => {
  assert.equal(TREE_RAFFLE_RULES.acceptingEntries, false);
  assert.equal(TREE_RAFFLE_RULES.claimsEnabled, false);
  assert.equal(TREE_RAFFLE_RULES.prizesFunded, false);
  assert.equal(TREE_RAFFLE_RULES.dailyEnabled, true);
  assert.equal(TREE_RAFFLE_RULES.dailyLuckyLeafEnabled, false);
  assert.equal(TREE_RAFFLE_RULES.weeklyEnabled, false);
  assert.ok(raffleLaunchBlockers().length >= 3);
  assert.deepEqual(TREE_RAFFLE_RULES.prizes.dailyMain, TREE_RAFFLE_DAILY_PRIZE);
  assert.deepEqual(TREE_RAFFLE_RULES.prizes.dailyLuckyLeafPlan, TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN);
  assert.equal(TREE_RAFFLE_RULES.prizes.weeklyMain, null);
  assert.equal(TREE_RAFFLE_RULES.prizes.weeklyLuckyLeaf, null);
});

test('staged Lucky Leaf budget is $2.50 Monday through Saturday and $10 Sunday', () => {
  assert.equal(dailyLuckyLeafBudgetUsdCents('2026-08-17'), 250);
  assert.equal(dailyLuckyLeafBudgetUsdCents('2026-08-22'), 250);
  assert.equal(dailyLuckyLeafBudgetUsdCents('2026-08-23'), 1_000);
  assert.equal(6 * TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN.mondayThroughSaturdayUsdCents
    + TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN.sundayUsdCents, 2_500);
  assert.throws(() => dailyLuckyLeafBudgetUsdCents('2026-02-30'), /real calendar date/);
});

test('ticket preview uses the versioned sub-linear curve and minimum', () => {
  assert.deepEqual(ticketPreviewFromUsdCents(499), {
    qualifies: false, baseMainTickets: 0, streakAdjustedMainTickets: 0,
    milestoneBonusTickets: 0, totalMainTickets: 0,
    luckyLeafTickets: 0, multiplierBasisPoints: 10_000,
  });
  assert.equal(ticketPreviewFromUsdCents(500).baseMainTickets, 1);
  assert.equal(ticketPreviewFromUsdCents(2_500).baseMainTickets, 6);
  assert.equal(ticketPreviewFromUsdCents(10_000).baseMainTickets, 22);
  assert.equal(ticketPreviewFromUsdCents(50_000).baseMainTickets, 102);
  assert.equal(ticketPreviewFromUsdCents(100_000).baseMainTickets, 198);
  assert.throws(() => ticketPreviewFromUsdCents(5.5), /whole number/);
});

test('streak table, milestone bonuses, and 2.5x cap are deterministic', () => {
  assert.equal(streakMultiplierBasisPoints(1), 10_000);
  assert.equal(streakMultiplierBasisPoints(2), 11_000);
  assert.equal(streakMultiplierBasisPoints(3), 12_500);
  assert.equal(streakMultiplierBasisPoints(7), 17_500);
  assert.equal(streakMultiplierBasisPoints(15), 25_000);
  assert.equal(streakMultiplierBasisPoints(99), 25_000);
  assert.equal(ticketPreviewFromUsdCents(50_000, 15).streakAdjustedMainTickets, 257);
  const milestone = ticketPreviewFromUsdCents(500, 7, true);
  assert.equal(milestone.milestoneBonusTickets, 11);
  assert.equal(milestone.totalMainTickets, 13);
  assert.throws(() => streakMultiplierBasisPoints(0), /positive whole number/);
});
