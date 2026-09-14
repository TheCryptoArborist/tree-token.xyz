import { treeRaffleSupabaseConfig } from './tree-raffle-supabase-ledger.ts';

type Environment = Record<string, string | undefined>;

export type TreeRafflePublicSnapshot = {
  rounds: Record<string, unknown>;
  history: unknown[];
  wallet: Record<string, unknown> | null;
};

function validSnapshot(value: unknown): value is TreeRafflePublicSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Boolean(candidate.rounds && typeof candidate.rounds === 'object' && !Array.isArray(candidate.rounds))
    && Array.isArray(candidate.history)
    && (candidate.wallet === null || (typeof candidate.wallet === 'object' && !Array.isArray(candidate.wallet)));
}

export class SupabaseTreeRaffleReadModel {
  private readonly config: { url: string; secretKey: string };
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: { url: string; secretKey: string },
    fetchImpl: typeof fetch = fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async snapshot(wallet: string | null): Promise<TreeRafflePublicSnapshot> {
    const response = await this.fetchImpl(
      `${this.config.url}/rest/v1/rpc/read_tree_raffle_public_snapshot`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.secretKey}`,
          apikey: this.config.secretKey,
          'X-Client-Info': 'tree-command-center-raffle-read/1',
        },
        body: JSON.stringify({ p_wallet: wallet }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) throw new Error(`Supabase raffle snapshot request failed with HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (!validSnapshot(payload)) throw new Error('Supabase returned an invalid raffle public snapshot.');
    return payload;
  }
}

export function configuredSupabaseTreeRaffleReadModel(
  env: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return new SupabaseTreeRaffleReadModel(treeRaffleSupabaseConfig(env), fetchImpl);
}
