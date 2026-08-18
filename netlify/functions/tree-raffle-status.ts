import {
  TREE_RAFFLE_RULES,
  raffleLaunchBlockers,
} from '../lib/tree-raffle-core.ts';

export function treeRaffleStatus(generatedAt = new Date().toISOString()) {
  return {
    status: 'ok',
    generatedAt,
    rules: TREE_RAFFLE_RULES,
    rounds: {
      daily: { state: 'not-scheduled', cadence: 'Daily at 10:00 America/New_York', prize: null, opensAt: null, closesAt: null },
      weekly: { state: 'not-scheduled', cadence: 'Sunday at 10:05 America/New_York', prize: null, opensAt: null, closesAt: null },
    },
    history: [],
    launchBlockers: raffleLaunchBlockers(),
    safeguards: {
      replaySafeLedgerModel: true,
      finalizedBuyVerifierImplemented: true,
      transactionalLedgerConfigured: false,
      verifiedBuyIngestionEnabled: false,
      entriesRecorded: false,
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
