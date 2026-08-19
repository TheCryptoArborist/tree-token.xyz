import {
  raffleLaunchBlockers,
  treeRaffleRulesForEnvironment,
} from '../lib/tree-raffle-core.ts';

export function treeRaffleStatus(
  generatedAt = new Date().toISOString(),
  env: Record<string, string | undefined> = process.env,
) {
  const rules = treeRaffleRulesForEnvironment(env);
  const hasConfiguredSupabaseUrl = Boolean((env.TREE_RAFFLE_SUPABASE_URL || '').trim());
  const hasConfiguredSupabaseSecret = Boolean((env.TREE_RAFFLE_SUPABASE_SECRET_KEY || '').trim());
  const transactionalLedgerConfigured = hasConfiguredSupabaseUrl && hasConfiguredSupabaseSecret;
  const verifiedBuyIngestionEnabled = (
    env.TREE_RAFFLE_INGEST_ENABLED === 'true'
    && rules.acceptingEntries
    && transactionalLedgerConfigured
  );
  const entriesRecorded = verifiedBuyIngestionEnabled;

  return {
    status: 'ok',
    generatedAt,
    rules,
    rounds: {
      daily: { state: 'not-scheduled', cadence: 'Daily at 10:00 America/New_York', prize: null, opensAt: null, closesAt: null },
      weekly: { state: 'not-scheduled', cadence: 'Sunday at 10:05 America/New_York', prize: null, opensAt: null, closesAt: null },
    },
    history: [],
    launchBlockers: raffleLaunchBlockers(rules),
    safeguards: {
      replaySafeLedgerModel: true,
      finalizedBuyVerifierImplemented: true,
      transactionalLedgerConfigured,
      verifiedBuyIngestionEnabled,
      entriesRecorded,
      paymentsAccepted: false,
      winnerSelectionEnabled: false,
    },
  };
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json(
      { status: 'error', error: 'method-not-allowed' },
      { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } },
    );
  }
  return Response.json(treeRaffleStatus(), {
    headers: {
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const config = { path: '/api/tree-raffle-status' };

