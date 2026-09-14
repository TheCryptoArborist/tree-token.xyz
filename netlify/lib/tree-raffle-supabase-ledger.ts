import type {
  TransactionalTreeRaffleLedger,
  TreeRaffleLedgerResult,
  VerifiedTreeBuy,
} from './tree-raffle-ledger-core.ts';

type FetchLike = typeof fetch;

export type TreeRaffleSupabaseConfig = {
  url: string;
  secretKey: string;
  weeklyEnabled: boolean;
};

function requiredConfigValue(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is not configured.`);
  return normalized;
}

export function treeRaffleSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): TreeRaffleSupabaseConfig {
  const url = requiredConfigValue(env.TREE_RAFFLE_SUPABASE_URL, 'TREE_RAFFLE_SUPABASE_URL');
  const secretKey = requiredConfigValue(
    env.TREE_RAFFLE_SUPABASE_SECRET_KEY,
    'TREE_RAFFLE_SUPABASE_SECRET_KEY',
  );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TREE_RAFFLE_SUPABASE_URL must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('TREE_RAFFLE_SUPABASE_URL must use HTTPS.');
  }
  return {
    url: parsed.origin,
    secretKey,
    weeklyEnabled: env.TREE_RAFFLE_WEEKLY_ENABLED === 'true',
  };
}

function integerResult(value: unknown, label: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 0) {
    throw new Error(`Supabase returned an invalid ${label}.`);
  }
  return parsed as number;
}

function parseLedgerResult(value: unknown): TreeRaffleLedgerResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Supabase returned an invalid raffle ledger response.');
  }
  const row = value as Record<string, unknown>;
  if (row.outcome !== 'recorded' && row.outcome !== 'duplicate') {
    throw new Error('Supabase returned an invalid raffle ledger outcome.');
  }
  if (typeof row.qualifies !== 'boolean') {
    throw new Error('Supabase returned an invalid raffle qualification state.');
  }
  const streakDays = row.streakDays === null
    ? null
    : integerResult(row.streakDays, 'streak day count');
  if (typeof row.dailyRoundId !== 'string' || typeof row.weeklyRoundId !== 'string') {
    throw new Error('Supabase returned invalid raffle round identifiers.');
  }
  return {
    outcome: row.outcome,
    qualifies: row.qualifies,
    streakDays,
    mainTickets: integerResult(row.mainTickets, 'main ticket count'),
    luckyLeafTickets: integerResult(row.luckyLeafTickets, 'Lucky Leaf ticket count'),
    dailyRoundId: row.dailyRoundId,
    weeklyRoundId: row.weeklyRoundId,
  };
}

export class SupabaseTreeRaffleLedger implements TransactionalTreeRaffleLedger {
  private readonly config: TreeRaffleSupabaseConfig;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: TreeRaffleSupabaseConfig,
    fetchImpl: FetchLike = fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async recordVerifiedBuy(input: VerifiedTreeBuy): Promise<TreeRaffleLedgerResult> {
    const rpc = this.config.weeklyEnabled
      ? 'record_tree_raffle_verified_buy'
      : 'record_tree_raffle_verified_buy_daily_only';
    const response = await this.fetchImpl(
      `${this.config.url}/rest/v1/rpc/${rpc}`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.secretKey,
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
          'X-Client-Info': 'tree-command-center-raffle/1',
        },
        body: JSON.stringify({
          p_tx_digest: input.txDigest,
          p_buyer: input.buyer,
          p_tree_amount_raw: input.treeAmountRaw,
          p_qualifying_usd_cents: input.qualifyingUsdCents,
          p_route: input.route,
          p_finalized_checkpoint: input.finalizedCheckpoint,
          p_finalized_at: input.finalizedAt,
          p_raffle_date: input.raffleDate,
          p_daily_round_id: input.dailyRoundId,
          p_weekly_round_id: input.weeklyRoundId,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === 'object'
        && typeof (payload as Record<string, unknown>).message === 'string'
        ? (payload as Record<string, string>).message
        : `Supabase raffle ledger request failed with HTTP ${response.status}.`;
      throw new Error(message);
    }
    return parseLedgerResult(payload);
  }
}

export function configuredSupabaseTreeRaffleLedger(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
) {
  return new SupabaseTreeRaffleLedger(treeRaffleSupabaseConfig(env), fetchImpl);
}
