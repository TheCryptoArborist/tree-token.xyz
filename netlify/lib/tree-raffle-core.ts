export const TREE_RAFFLE_RULES_VERSION = 'canopy-draw-proposal-v2';

export const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const TREE_RAFFLE_WBTC_TYPE = '0xaafb102dd0902f5055cadecd687fb5b71ca82ef0e0285d90afde828ec58ca96b::btc::BTC';

export const TREE_RAFFLE_DAILY_PRIZE = Object.freeze({
  symbol: 'TREE',
  coinType: TREE_COIN_TYPE,
  amountRaw: '50000000000',
  decimals: 6,
});

export const TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN = Object.freeze({
  symbol: 'wBTC',
  coinType: TREE_RAFFLE_WBTC_TYPE,
  decimals: 8,
  mondayThroughSaturdayUsdCents: 250,
  sundayUsdCents: 1_000,
  weeklyBudgetUsdCents: 2_500,
});

export const TREE_RAFFLE_STREAK_MULTIPLIERS_BASIS_POINTS = Object.freeze([
  10_000, 11_000, 12_500, 14_000, 15_000,
  16_000, 17_500, 18_500, 19_500, 20_000,
  21_000, 22_000, 23_000, 24_000, 25_000,
]);

export type TreeRaffleRules = {
  version: typeof TREE_RAFFLE_RULES_VERSION;
  status: 'development';
  acceptingEntries: boolean;
  claimsEnabled: boolean;
  prizesFunded: boolean;
  dailyEnabled: boolean;
  dailyLuckyLeafEnabled: boolean;
  weeklyEnabled: boolean;
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
  prizes: {
    dailyMain: typeof TREE_RAFFLE_DAILY_PRIZE;
    dailyLuckyLeafPlan: typeof TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN;
    weeklyMain: null;
    weeklyLuckyLeaf: null;
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
  dailyEnabled: true,
  dailyLuckyLeafEnabled: false,
  weeklyEnabled: false,
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
  prizes: Object.freeze({
    dailyMain: TREE_RAFFLE_DAILY_PRIZE,
    dailyLuckyLeafPlan: TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN,
    weeklyMain: null,
    weeklyLuckyLeaf: null,
  }),
  eligibleTransaction: Object.freeze({
    network: 'sui-mainnet',
    direction: 'SUI_TO_TREE',
    requiresSuccessfulFinalizedTransaction: true,
    allowlistedRoutesRequired: true,
  }),
});

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function treeRaffleRulesForEnvironment(
  env: Record<string, string | undefined> = process.env,
): TreeRaffleRules {
  return {
    ...TREE_RAFFLE_RULES,
    acceptingEntries: parseBooleanEnv(env.TREE_RAFFLE_ACCEPTING_ENTRIES, TREE_RAFFLE_RULES.acceptingEntries),
    claimsEnabled: parseBooleanEnv(env.TREE_RAFFLE_CLAIMS_ENABLED, TREE_RAFFLE_RULES.claimsEnabled),
    prizesFunded: parseBooleanEnv(env.TREE_RAFFLE_PRIZES_FUNDED, TREE_RAFFLE_RULES.prizesFunded),
    dailyEnabled: parseBooleanEnv(env.TREE_RAFFLE_DAILY_ENABLED, TREE_RAFFLE_RULES.dailyEnabled),
    dailyLuckyLeafEnabled: parseBooleanEnv(
      env.TREE_RAFFLE_DAILY_LUCKY_ENABLED,
      TREE_RAFFLE_RULES.dailyLuckyLeafEnabled,
    ),
    weeklyEnabled: parseBooleanEnv(env.TREE_RAFFLE_WEEKLY_ENABLED, TREE_RAFFLE_RULES.weeklyEnabled),
  };
}

export function dailyLuckyLeafBudgetUsdCents(
  raffleDate: string,
  plan = TREE_RAFFLE_DAILY_LUCKY_LEAF_PLAN,
): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raffleDate)) {
    throw new Error('Lucky Leaf raffle date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${raffleDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== raffleDate) {
    throw new Error('Lucky Leaf raffle date must be a real calendar date.');
  }
  return parsed.getUTCDay() === 0
    ? plan.sundayUsdCents
    : plan.mondayThroughSaturdayUsdCents;
}

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
    !rules.prizesFunded && 'The prize pool must be funded and prizes reserved before rounds open.',
    !rules.claimsEnabled && 'The prize claim path is disabled.',
    !rules.acceptingEntries && 'Entry recording is disabled.',
  ];
  return blockers.filter((value): value is string => Boolean(value));
}

export function raffleOperationalReadiness(
  env: Record<string, string | undefined> = process.env,
  rules: TreeRaffleRules = treeRaffleRulesForEnvironment(env),
) {
  const transactionalLedgerConfigured = Boolean(
    (env.TREE_RAFFLE_SUPABASE_URL || '').trim()
    && (env.TREE_RAFFLE_SUPABASE_SECRET_KEY || '').trim(),
  );
  const onchainPrizePoolConfigured = Boolean(
    (env.TREE_RAFFLE_PACKAGE_ID || '').trim()
    && (env.TREE_RAFFLE_PRIZE_POOL_ID || '').trim()
    && (env.TREE_RAFFLE_OPERATOR_CAP_ID || '').trim(),
  );
  const drawExecutorConfigured = (
    env.TREE_RAFFLE_DRAW_EXECUTOR_READY === 'true'
    && onchainPrizePoolConfigured
  );
  const verifiedBuyIngestionEnabled = Boolean(
    env.TREE_RAFFLE_INGEST_ENABLED === 'true'
    && (rules.dailyEnabled || rules.weeklyEnabled)
    && rules.acceptingEntries
    && rules.claimsEnabled
    && rules.prizesFunded
    && transactionalLedgerConfigured
    && drawExecutorConfigured
  );
  const infrastructureBlockers = [
    !transactionalLedgerConfigured && 'The transactional raffle ledger is not connected.',
    !onchainPrizePoolConfigured && 'The on-chain prize pool is not published and configured.',
    !drawExecutorConfigured && 'The verifiable draw executor is not ready.',
  ].filter((value): value is string => Boolean(value));

  return {
    transactionalLedgerConfigured,
    onchainPrizePoolConfigured,
    drawExecutorConfigured,
    verifiedBuyIngestionEnabled,
    launchBlockers: [...raffleLaunchBlockers(rules), ...infrastructureBlockers],
  };
}
