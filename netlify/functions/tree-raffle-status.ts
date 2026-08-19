import {
  raffleOperationalReadiness,
  treeRaffleRulesForEnvironment,
} from '../lib/tree-raffle-core.ts';

export function treeRaffleStatus(
  generatedAt = new Date().toISOString(),
  env: Record<string, string | undefined> = process.env,
) {
  const rules = treeRaffleRulesForEnvironment(env);
  const readiness = raffleOperationalReadiness(env, rules);
  const {
    transactionalLedgerConfigured,
    onchainPrizePoolConfigured,
    drawExecutorConfigured,
    verifiedBuyIngestionEnabled,
  } = readiness;
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
    launchBlockers: readiness.launchBlockers,
    safeguards: {
      replaySafeLedgerModel: true,
      finalizedBuyVerifierImplemented: true,
      transactionalLedgerConfigured,
      onchainPrizePoolConfigured,
      drawExecutorConfigured,
      verifiedBuyIngestionEnabled,
      entriesRecorded,
      paymentsAccepted: false,
      winnerSelectionEnabled: drawExecutorConfigured,
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

