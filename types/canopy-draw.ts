export type CanopyDrawKind = 'daily' | 'weekly';
export type CanopyDrawRoundStatus =
  | 'draft'
  | 'funding-pending'
  | 'funded'
  | 'closed'
  | 'randomness-pending'
  | 'winner-published'
  | 'claimable'
  | 'complete'
  | 'cancelled';

export interface CanopyPrizeConfiguration {
  amount: string;
  coinType: string;
  symbol: 'TREE' | 'SUI' | string;
  fundedTransactionDigest?: string;
}

export interface CanopyDrawRound {
  id: string;
  kind: CanopyDrawKind;
  status: CanopyDrawRoundStatus;
  opensAtMs: number;
  closesAtMs: number;
  prize: CanopyPrizeConfiguration | null;
  methodologyVersionId: string;
  randomnessTransactionDigest?: string;
  publishedAtMs?: number;
}

export interface CanopyDrawEntry {
  id: string;
  roundId: string;
  wallet: string;
  qualifyingTransactionDigest: string;
  qualifyingUsdSnapshot: string;
  mainTickets: number;
  luckyLeafTickets: number;
  streakDays: number;
  streakMultiplier: number;
  recordedAtMs: number;
}

export interface CanopyDrawWinner {
  id: string;
  roundId: string;
  entryId: string;
  wallet: string;
  prizeClass: 'main' | 'lucky';
  prize: CanopyPrizeConfiguration;
  selectionIndex: string;
  randomnessTransactionDigest: string;
  publishedAtMs: number;
}

export interface CanopyDrawClaim {
  id: string;
  roundId: string;
  winnerId: string;
  wallet: string;
  status: 'unavailable' | 'claimable' | 'submitted' | 'confirmed' | 'expired';
  claimTransactionDigest?: string;
  claimedAtMs?: number;
}

export interface CanopyDrawMethodologyVersion {
  id: string;
  version: number;
  effectiveAtMs: number;
  minimumQualifyingUsd: string;
  mainTicketFormula: string;
  luckyLeafTicketsPerQualifyingTransaction: number;
  mainPrizeSharePercent: number;
  luckyPrizeSharePercent: number;
  maximumStreakDays: number;
  maximumStreakMultiplier: number;
  randomnessProvider: 'planned-sui-on-chain';
  rulesDocumentHash?: string;
}

export interface CanopyDrawCoverage {
  roundId: string;
  eligibleTransactionCount: number;
  recordedEntryCount: number;
  distinctWalletCount: number;
  mainTicketCount: number;
  luckyLeafTicketCount: number;
  firstCoveredCheckpoint?: string;
  lastCoveredCheckpoint?: string;
  reconciledAtMs?: number;
  reconciliationStatus: 'not-started' | 'in-progress' | 'matched' | 'mismatch';
}
