import {
  TREE_RAFFLE_RULES_VERSION,
  ticketPreviewFromUsdCents,
} from './tree-raffle-core.ts';

export const TREE_RAFFLE_LEDGER_VERSION = 'tree-raffle-ledger-v1';

export const TREE_RAFFLE_VERIFIED_ROUTES = Object.freeze([
  'suidex-v2',
  'suidex-v3',
  'turbos',
] as const);

export type TreeRaffleVerifiedRoute = typeof TREE_RAFFLE_VERIFIED_ROUTES[number];
export type TreeRaffleRoundKind = 'daily' | 'weekly';

export type VerifiedTreeBuy = {
  txDigest: string;
  buyer: string;
  treeAmountRaw: string;
  qualifyingUsdCents: number;
  route: TreeRaffleVerifiedRoute;
  finalizedCheckpoint: number;
  finalizedAt: string;
  raffleDate: string;
  dailyRoundId: string;
  weeklyRoundId: string;
};

export type TreeRaffleTicketAccount = {
  mainTickets: number;
  luckyLeafTickets: number;
  qualifyingTransactions: number;
};

export type TreeRaffleRoundAccount = {
  id: string;
  kind: TreeRaffleRoundKind;
  totalMainTickets: number;
  totalLuckyLeafTickets: number;
  qualifyingTransactions: number;
  wallets: Record<string, TreeRaffleTicketAccount>;
};

export type TreeRaffleDigestRecord = VerifiedTreeBuy & {
  fingerprint: string;
  rulesVersion: typeof TREE_RAFFLE_RULES_VERSION;
  qualifies: boolean;
  streakDays: number | null;
  mainTickets: number;
  luckyLeafTickets: number;
};

export type TreeRaffleLedgerState = {
  version: typeof TREE_RAFFLE_LEDGER_VERSION;
  revision: number;
  processedDigests: Record<string, TreeRaffleDigestRecord>;
  walletStreaks: Record<string, { lastRaffleDate: string; streakDays: number }>;
  rounds: Record<string, TreeRaffleRoundAccount>;
  journal: Array<{
    txDigest: string;
    buyer: string;
    qualifies: boolean;
    mainTickets: number;
    luckyLeafTickets: number;
    dailyRoundId: string;
    weeklyRoundId: string;
  }>;
};

export type TreeRaffleLedgerResult = {
  outcome: 'recorded' | 'duplicate';
  qualifies: boolean;
  streakDays: number | null;
  mainTickets: number;
  luckyLeafTickets: number;
  dailyRoundId: string;
  weeklyRoundId: string;
};

export type TreeRaffleLedgerTransition = {
  state: TreeRaffleLedgerState;
  result: TreeRaffleLedgerResult;
};

export interface TransactionalTreeRaffleLedger {
  /**
   * The durable implementation must execute this operation in one database
   * transaction and enforce a unique key on txDigest. A blob read followed by
   * a blob write is not sufficient for production raffle accounting.
   */
  recordVerifiedBuy(input: VerifiedTreeBuy): Promise<TreeRaffleLedgerResult>;
}

const SUI_DIGEST_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;
const SUI_ADDRESS_PATTERN = /^0x[0-9a-f]{64}$/;
const RAW_AMOUNT_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ROUND_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,95}$/;

export function emptyTreeRaffleLedger(): TreeRaffleLedgerState {
  return {
    version: TREE_RAFFLE_LEDGER_VERSION,
    revision: 0,
    processedDigests: {},
    walletStreaks: {},
    rounds: {},
    journal: [],
  };
}

function assertIsoTimestamp(value: string, field: string) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be a valid ISO timestamp.`);
  }
}

function assertDateKey(value: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error('raffleDate must use YYYY-MM-DD in America/New_York.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('raffleDate must be a real calendar date.');
  }
}

function assertVerifiedBuy(input: VerifiedTreeBuy) {
  if (!SUI_DIGEST_PATTERN.test(input.txDigest)) {
    throw new Error('txDigest must be a Sui transaction digest.');
  }
  if (!SUI_ADDRESS_PATTERN.test(input.buyer)) {
    throw new Error('buyer must be a normalized 32-byte Sui address.');
  }
  if (!RAW_AMOUNT_PATTERN.test(input.treeAmountRaw) || BigInt(input.treeAmountRaw) <= 0n) {
    throw new Error('treeAmountRaw must be a positive base-unit amount.');
  }
  if (!Number.isSafeInteger(input.qualifyingUsdCents) || input.qualifyingUsdCents < 0) {
    throw new Error('qualifyingUsdCents must be a non-negative whole number.');
  }
  if (!(TREE_RAFFLE_VERIFIED_ROUTES as readonly string[]).includes(input.route)) {
    throw new Error('route is not allowlisted for TREE raffle buys.');
  }
  if (!Number.isSafeInteger(input.finalizedCheckpoint) || input.finalizedCheckpoint < 1) {
    throw new Error('finalizedCheckpoint must be a positive whole number.');
  }
  assertIsoTimestamp(input.finalizedAt, 'finalizedAt');
  assertDateKey(input.raffleDate);
  if (!ROUND_ID_PATTERN.test(input.dailyRoundId) || !ROUND_ID_PATTERN.test(input.weeklyRoundId)) {
    throw new Error('Round IDs must be normalized durable identifiers.');
  }
  if (input.dailyRoundId === input.weeklyRoundId) {
    throw new Error('Daily and weekly round IDs must be different.');
  }
}

function canonicalInput(input: VerifiedTreeBuy): VerifiedTreeBuy {
  return {
    txDigest: input.txDigest,
    buyer: input.buyer.toLowerCase(),
    treeAmountRaw: input.treeAmountRaw,
    qualifyingUsdCents: input.qualifyingUsdCents,
    route: input.route,
    finalizedCheckpoint: input.finalizedCheckpoint,
    finalizedAt: new Date(input.finalizedAt).toISOString(),
    raffleDate: input.raffleDate,
    dailyRoundId: input.dailyRoundId,
    weeklyRoundId: input.weeklyRoundId,
  };
}

function fingerprint(input: VerifiedTreeBuy): string {
  return JSON.stringify(input);
}

function cloneLedger(state: TreeRaffleLedgerState): TreeRaffleLedgerState {
  return structuredClone(state);
}

function daysBetween(previousDate: string, nextDate: string): number {
  const previous = Date.parse(`${previousDate}T00:00:00.000Z`);
  const next = Date.parse(`${nextDate}T00:00:00.000Z`);
  return Math.round((next - previous) / 86_400_000);
}

function nextStreak(
  current: { lastRaffleDate: string; streakDays: number } | undefined,
  raffleDate: string,
) {
  if (!current) return { streakDays: 1, reachedMilestone: false };
  const difference = daysBetween(current.lastRaffleDate, raffleDate);
  if (difference < 0) {
    throw new Error('Verified buys must be applied in raffle-date order for each wallet.');
  }
  if (difference === 0) {
    return { streakDays: current.streakDays, reachedMilestone: false };
  }
  const streakDays = difference === 1 ? current.streakDays + 1 : 1;
  return { streakDays, reachedMilestone: streakDays === 7 || streakDays === 15 };
}

function ensureRound(state: TreeRaffleLedgerState, id: string, kind: TreeRaffleRoundKind) {
  const existing = state.rounds[id];
  if (existing && existing.kind !== kind) {
    throw new Error(`Round ${id} already exists with a different cadence.`);
  }
  if (!existing) {
    state.rounds[id] = {
      id,
      kind,
      totalMainTickets: 0,
      totalLuckyLeafTickets: 0,
      qualifyingTransactions: 0,
      wallets: {},
    };
  }
  return state.rounds[id];
}

function creditRound(
  round: TreeRaffleRoundAccount,
  buyer: string,
  mainTickets: number,
  luckyLeafTickets: number,
) {
  const wallet = round.wallets[buyer] ?? {
    mainTickets: 0,
    luckyLeafTickets: 0,
    qualifyingTransactions: 0,
  };
  wallet.mainTickets += mainTickets;
  wallet.luckyLeafTickets += luckyLeafTickets;
  wallet.qualifyingTransactions += 1;
  round.wallets[buyer] = wallet;
  round.totalMainTickets += mainTickets;
  round.totalLuckyLeafTickets += luckyLeafTickets;
  round.qualifyingTransactions += 1;
}

export function applyVerifiedTreeBuy(
  currentState: TreeRaffleLedgerState,
  rawInput: VerifiedTreeBuy,
): TreeRaffleLedgerTransition {
  if (currentState.version !== TREE_RAFFLE_LEDGER_VERSION) {
    throw new Error('Unsupported TREE raffle ledger version.');
  }
  assertVerifiedBuy(rawInput);
  const input = canonicalInput(rawInput);
  const inputFingerprint = fingerprint(input);
  const existing = currentState.processedDigests[input.txDigest];
  if (existing) {
    if (existing.fingerprint !== inputFingerprint) {
      throw new Error('Conflicting verified data was supplied for an existing transaction digest.');
    }
    return {
      state: currentState,
      result: {
        outcome: 'duplicate',
        qualifies: existing.qualifies,
        streakDays: existing.streakDays,
        mainTickets: existing.mainTickets,
        luckyLeafTickets: existing.luckyLeafTickets,
        dailyRoundId: existing.dailyRoundId,
        weeklyRoundId: existing.weeklyRoundId,
      },
    };
  }

  const state = cloneLedger(currentState);
  const initialPreview = ticketPreviewFromUsdCents(input.qualifyingUsdCents);
  let streakDays: number | null = null;
  let mainTickets = 0;
  let luckyLeafTickets = 0;

  if (initialPreview.qualifies) {
    const streak = nextStreak(state.walletStreaks[input.buyer], input.raffleDate);
    streakDays = streak.streakDays;
    const preview = ticketPreviewFromUsdCents(
      input.qualifyingUsdCents,
      streakDays,
      streak.reachedMilestone,
    );
    mainTickets = preview.totalMainTickets;
    luckyLeafTickets = preview.luckyLeafTickets;
    state.walletStreaks[input.buyer] = {
      lastRaffleDate: input.raffleDate,
      streakDays,
    };

    creditRound(ensureRound(state, input.dailyRoundId, 'daily'), input.buyer, mainTickets, 0);
    creditRound(
      ensureRound(state, input.weeklyRoundId, 'weekly'),
      input.buyer,
      mainTickets,
      luckyLeafTickets,
    );
  }

  state.processedDigests[input.txDigest] = {
    ...input,
    fingerprint: inputFingerprint,
    rulesVersion: TREE_RAFFLE_RULES_VERSION,
    qualifies: initialPreview.qualifies,
    streakDays,
    mainTickets,
    luckyLeafTickets,
  };
  state.journal.push({
    txDigest: input.txDigest,
    buyer: input.buyer,
    qualifies: initialPreview.qualifies,
    mainTickets,
    luckyLeafTickets,
    dailyRoundId: input.dailyRoundId,
    weeklyRoundId: input.weeklyRoundId,
  });
  state.revision += 1;

  return {
    state,
    result: {
      outcome: 'recorded',
      qualifies: initialPreview.qualifies,
      streakDays,
      mainTickets,
      luckyLeafTickets,
      dailyRoundId: input.dailyRoundId,
      weeklyRoundId: input.weeklyRoundId,
    },
  };
}
