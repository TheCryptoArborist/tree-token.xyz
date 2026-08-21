import {
  TREE_RAFFLE_SELECTION_SCHEME,
  treeRaffleLedgerCommitment,
  validateTreeRaffleTicketRanges,
  type TreeRaffleTicketRange,
} from './tree-raffle-draw-audit.ts';
import {
  treeRaffleSupabaseConfig,
  type TreeRaffleSupabaseConfig,
} from './tree-raffle-supabase-ledger.ts';

export type TreeRafflePrizeClass = 'main' | 'lucky';

export type TreeRaffleDrawSnapshot = {
  roundId: string;
  prizeClass: TreeRafflePrizeClass;
  onchainDrawId: string;
  selectionScheme: typeof TREE_RAFFLE_SELECTION_SCHEME;
  ticketRanges: TreeRaffleTicketRange[];
  ledgerCommitment: string;
  totalTickets: string;
};

export type TreeRaffleWinnerRecord = {
  roundId: string;
  prizeClass: TreeRafflePrizeClass;
  onchainDrawId: string;
  ledgerCommitment: string;
  winningTicket: string;
  totalTickets: string;
  wallet: string;
  token: string;
  tokenType: string;
  amountRaw: string;
  decimals: number;
  drawTxDigest: string;
  registerTxDigest: string;
};

export type TreeRaffleClaimRecord = {
  roundId: string;
  prizeClass: TreeRafflePrizeClass;
  wallet: string;
  claimTxDigest: string;
  claimedAt: string;
};
export type TreeRaffleClaimInput = Omit<TreeRaffleClaimRecord, 'claimedAt'>;

type RpcOutcome<T> = T & { outcome: 'recorded' | 'duplicate' };

const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const SUI_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;
const UNSIGNED = /^(0|[1-9][0-9]*)$/;

function objectRow(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Supabase returned an invalid TREE raffle ${label}.`);
  }
  return value as Record<string, unknown>;
}

function validOutcome(row: Record<string, unknown>): row is Record<string, unknown> & { outcome: 'recorded' | 'duplicate' } {
  return row.outcome === 'recorded' || row.outcome === 'duplicate';
}

function parseDrawSnapshot(value: unknown): TreeRaffleDrawSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Supabase returned an invalid TREE raffle draw snapshot.');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.roundId !== 'string'
    || (row.prizeClass !== 'main' && row.prizeClass !== 'lucky')
    || typeof row.onchainDrawId !== 'string'
    || row.selectionScheme !== TREE_RAFFLE_SELECTION_SCHEME
    || !Array.isArray(row.ticketRanges)
    || typeof row.ledgerCommitment !== 'string'
    || !/^[0-9a-f]{64}$/.test(row.ledgerCommitment)
    || typeof row.totalTickets !== 'string') {
    throw new Error('Supabase returned an invalid TREE raffle draw snapshot.');
  }

  const ticketRanges = row.ticketRanges as TreeRaffleTicketRange[];
  const totalTickets = validateTreeRaffleTicketRanges(row.onchainDrawId, ticketRanges);
  if (totalTickets.toString() !== row.totalTickets) {
    throw new Error('Supabase TREE raffle ticket ranges do not match the declared total.');
  }
  if (treeRaffleLedgerCommitment(row.onchainDrawId, ticketRanges) !== row.ledgerCommitment) {
    throw new Error('Supabase TREE raffle ledger commitment does not match its ticket ranges.');
  }

  return {
    roundId: row.roundId,
    prizeClass: row.prizeClass,
    onchainDrawId: row.onchainDrawId,
    selectionScheme: row.selectionScheme,
    ticketRanges,
    ledgerCommitment: row.ledgerCommitment,
    totalTickets: row.totalTickets,
  };
}

export class SupabaseTreeRaffleDrawStore {
  private readonly config: TreeRaffleSupabaseConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: TreeRaffleSupabaseConfig,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async lockDraw(roundId: string, prizeClass: TreeRafflePrizeClass): Promise<TreeRaffleDrawSnapshot> {
    const response = await this.fetchImpl(
      `${this.config.url}/rest/v1/rpc/lock_tree_raffle_draw`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.secretKey}`,
          apikey: this.config.secretKey,
          'X-Client-Info': 'tree-command-center-raffle-draw/1',
        },
        body: JSON.stringify({ p_round_id: roundId, p_prize_class: prizeClass }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Supabase TREE raffle draw lock failed with HTTP ${response.status}.`);
    return parseDrawSnapshot(payload);
  }

  private async rpc(functionName: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.secretKey}`,
        apikey: this.config.secretKey,
        'X-Client-Info': 'tree-command-center-raffle-draw/1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Supabase TREE raffle ${functionName} failed with HTTP ${response.status}.`);
    return payload;
  }

  async recordWinner(input: TreeRaffleWinnerRecord): Promise<RpcOutcome<TreeRaffleWinnerRecord>> {
    const payload = await this.rpc('record_tree_raffle_winner', {
      p_round_id: input.roundId,
      p_prize_class: input.prizeClass,
      p_onchain_draw_id: input.onchainDrawId,
      p_ledger_commitment: input.ledgerCommitment,
      p_winning_ticket: input.winningTicket,
      p_wallet: input.wallet,
      p_draw_tx_digest: input.drawTxDigest,
      p_register_tx_digest: input.registerTxDigest,
    });
    const row = objectRow(payload, 'winner record');
    if (!validOutcome(row)
      || row.roundId !== input.roundId
      || row.prizeClass !== input.prizeClass
      || row.onchainDrawId !== input.onchainDrawId
      || row.ledgerCommitment !== input.ledgerCommitment
      || row.winningTicket !== input.winningTicket
      || row.totalTickets !== input.totalTickets
      || row.wallet !== input.wallet
      || row.token !== input.token
      || row.tokenType !== input.tokenType
      || row.amountRaw !== input.amountRaw
      || row.decimals !== input.decimals
      || row.drawTxDigest !== input.drawTxDigest
      || row.registerTxDigest !== input.registerTxDigest
      || !SUI_ADDRESS.test(input.wallet)
      || !SUI_DIGEST.test(input.drawTxDigest)
      || !SUI_DIGEST.test(input.registerTxDigest)
      || !UNSIGNED.test(input.winningTicket)
      || !UNSIGNED.test(input.totalTickets)
      || !UNSIGNED.test(input.amountRaw)) {
      throw new Error('Supabase returned an invalid TREE raffle winner record.');
    }
    return { ...input, outcome: row.outcome };
  }

  async recordClaim(input: TreeRaffleClaimInput): Promise<RpcOutcome<TreeRaffleClaimRecord>> {
    const payload = await this.rpc('record_tree_raffle_claim', {
      p_round_id: input.roundId,
      p_prize_class: input.prizeClass,
      p_wallet: input.wallet,
      p_claim_tx_digest: input.claimTxDigest,
    });
    const row = objectRow(payload, 'claim record');
    if (!validOutcome(row)
      || row.roundId !== input.roundId
      || row.prizeClass !== input.prizeClass
      || row.wallet !== input.wallet
      || row.claimTxDigest !== input.claimTxDigest
      || typeof row.claimedAt !== 'string'
      || !SUI_ADDRESS.test(input.wallet)
      || !SUI_DIGEST.test(input.claimTxDigest)
      || !Number.isFinite(Date.parse(row.claimedAt))) {
      throw new Error('Supabase returned an invalid TREE raffle claim record.');
    }
    return { ...input, claimedAt: row.claimedAt, outcome: row.outcome };
  }
}

export function configuredSupabaseTreeRaffleDrawStore(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return new SupabaseTreeRaffleDrawStore(treeRaffleSupabaseConfig(env), fetchImpl);
}
