export const TREE_RAFFLE_RULES_VERSION = 'canopy-draw-proposal-v2';

export const TREE_RAFFLE_STREAK_MULTIPLIERS_BASIS_POINTS = Object.freeze([
  10_000, 11_000, 12_500, 14_000, 15_000,
  16_000, 17_500, 18_500, 19_500, 20_000,
  21_000, 22_000, 23_000, 24_000, 25_000,
]);

export type TreeRaffleRules = {
  version: typeof TREE_RAFFLE_RULES_VERSION;
  status: 'development';
  acceptingEntries: false;
  claimsEnabled: false;
  prizesFunded: false;
  minimumQualifyingUsdCents: number;
  ticketExponent: number;
  ticketCoefficient: number;
  luckyLeafTicketsPerQualifyingTransaction: number;
  maxStreakDays: number;
  maxStreakMultiplierBasisPoints: number;
  streakMultipliersBasisPoints: readonly number[];
  milestoneBonusUsdCents: Readonly<Record<number, number>>;
  schedule: {
    timezone: 'America/New_York';
    daily: '10:00';
    weekly: 'Sunday 10:05';
  };
  eligibleTransaction: {
    network: 'sui-mainnet';
    direction: 'SUI_TO_TREE';
    requiresSuccessfulFinalizedTransaction: true;
    allowlistedRoutesRequired: true;
  };
};

export const TREE_RAFFLE_RULES: TreeRaffleRules = Object.freeze({
  version: TREE_RAFFLE_RULES_VERSION,
  status: 'development',
  acceptingEntries: false,
  claimsEnabled: false,
  prizesFunded: false,
  minimumQualifyingUsdCents: 500,
  ticketExponent: 0.9457,
  ticketCoefficient: 0.288368,
  luckyLeafTicketsPerQualifyingTransaction: 1,
  maxStreakDays: 15,
  maxStreakMultiplierBasisPoints: 25_000,
  streakMultipliersBasisPoints: TREE_RAFFLE_STREAK_MULTIPLIERS_BASIS_POINTS,
  milestoneBonusUsdCents: Object.freeze({ 7: 5_000, 15: 20_000 }),
  schedule: Object.freeze({
    timezone: 'America/New_York',
    daily: '10:00',
    weekly: 'Sunday 10:05',
  }),
  eligibleTransaction: Object.freeze({
    network: 'sui-mainnet',
    direction: 'SUI_TO_TREE',
    requiresSuccessfulFinalizedTransaction: true,
    allowlistedRoutesRequired: true,
  }),
});

export function streakMultiplierBasisPoints(
  streakDays: number,
  rules: TreeRaffleRules = TREE_RAFFLE_RULES,
): number {
  if (!Number.isSafeInteger(streakDays) || streakDays < 1) {
    throw new Error('Streak days must be a positive whole number.');
  }
  const cappedDays = Math.min(streakDays, rules.maxStreakDays);
  return rules.streakMultipliersBasisPoints[cappedDays - 1]
    ?? rules.maxStreakMultiplierBasisPoints;
}

function baseTicketsFromUsdCents(qualifyingUsdCents: number, rules: TreeRaffleRules): number {
  const qualifyingUsd = qualifyingUsdCents / 100;
  return Math.max(1, Math.floor(
    qualifyingUsd ** rules.ticketExponent * rules.ticketCoefficient,
  ));
}

function streakAdjustedTicketsFromUsdCents(
  qualifyingUsdCents: number,
  multiplierBasisPoints: number,
  rules: TreeRaffleRules,
): number {
  const qualifyingUsd = qualifyingUsdCents / 100;
  return Math.max(1, Math.floor(
    qualifyingUsd ** rules.ticketExponent
      * rules.ticketCoefficient
      * multiplierBasisPoints
      / 10_000,
  ));
}

export function ticketPreviewFromUsdCents(
  qualifyingUsdCents: number,
  streakDays = 1,
  includeNewMilestoneBonus = false,
  rules: TreeRaffleRules = TREE_RAFFLE_RULES,
) {
  if (!Number.isSafeInteger(qualifyingUsdCents) || qualifyingUsdCents < 0) {
    throw new Error('Qualifying USD cents must be a non-negative whole number.');
  }
  const qualifies = qualifyingUsdCents >= rules.minimumQualifyingUsdCents;
  const multiplierBasisPoints = streakMultiplierBasisPoints(streakDays, rules);
  if (!qualifies) {
    return {
      qualifies, baseMainTickets: 0, streakAdjustedMainTickets: 0,
      milestoneBonusTickets: 0, totalMainTickets: 0,
      luckyLeafTickets: 0, multiplierBasisPoints,
    };
  }
  const baseMainTickets = baseTicketsFromUsdCents(qualifyingUsdCents, rules);
  const streakAdjustedMainTickets = streakAdjustedTicketsFromUsdCents(
    qualifyingUsdCents,
    multiplierBasisPoints,
    rules,
  );
  const milestoneUsdCents = includeNewMilestoneBonus
    ? rules.milestoneBonusUsdCents[streakDays] ?? 0
    : 0;
  const milestoneBonusTickets = milestoneUsdCents
    ? baseTicketsFromUsdCents(milestoneUsdCents, rules)
    : 0;
  return {
    qualifies,
    baseMainTickets,
    streakAdjustedMainTickets,
    milestoneBonusTickets,
    totalMainTickets: streakAdjustedMainTickets + milestoneBonusTickets,
    luckyLeafTickets: rules.luckyLeafTicketsPerQualifyingTransaction,
    multiplierBasisPoints,
  };
}

export function raffleLaunchBlockers(rules: TreeRaffleRules = TREE_RAFFLE_RULES): string[] {
  const blockers = [
    !rules.prizesFunded && 'Prize funding and escrow are not configured.',
    'Official eligibility, jurisdictions, entry methods, and prize terms are not approved.',
    'The prize pool must be funded and prizes reserved before each round opens.',
    'Every buy must be independently verified from finalized Sui effects; webhook amounts cannot be trusted.',
    'A permanent transaction-digest ledger and atomic ticket accounting are not implemented.',
    'The ticket snapshot must be publicly committed before randomness is requested.',
    'The contract must enforce one draw per round and bind the winning ticket to its wallet proof.',
    'The on-chain randomness, winner selection, prize reservation, and claim contract require security review.',
    !rules.claimsEnabled && 'The prize claim path is disabled.',
    !rules.acceptingEntries && 'Entry recording is disabled.',
  ];
  return blockers.filter((value): value is string => Boolean(value));
}
