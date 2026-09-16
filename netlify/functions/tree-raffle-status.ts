import {
  raffleOperationalReadiness,
  treeRaffleRulesForEnvironment,
} from '../lib/tree-raffle-core.ts';
import {
  configuredSupabaseTreeRaffleReadModel,
  type TreeRafflePublicSnapshot,
} from '../lib/tree-raffle-supabase-read.ts';

function publicLaunchAt(env: Record<string, string | undefined>): string | null {
  const configured = String(env.TREE_RAFFLE_PUBLIC_LAUNCH_AT || '').trim();
  if (!configured) return null;
  const parsed = new Date(configured);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

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
    publicLaunchAt: publicLaunchAt(env),
    rules,
    contracts: onchainPrizePoolConfigured ? {
      packageId: env.TREE_RAFFLE_PACKAGE_ID!.trim(),
      poolId: env.TREE_RAFFLE_PRIZE_POOL_ID!.trim(),
    } : null,
    rounds: {
      daily: { state: 'not-scheduled', cadence: 'Daily at 10:00 America/New_York', prize: rules.prizes.dailyMain, opensAt: null, closesAt: null },
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

function normalizedWallet(request: Request): string | null {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!wallet) return null;
  const normalized = wallet.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) throw new Error('invalid-wallet');
  return normalized;
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json(
      { status: 'error', error: 'method-not-allowed' },
      { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } },
    );
  }
  let wallet: string | null;
  try {
    wallet = normalizedWallet(request);
  } catch {
    return Response.json(
      { status: 'error', error: 'invalid-wallet' },
      { status: 400, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  }
  const status = treeRaffleStatus();
  let snapshot: TreeRafflePublicSnapshot | null = null;
  let snapshotError: string | null = null;
  try {
    if (status.safeguards.transactionalLedgerConfigured) {
      snapshot = await configuredSupabaseTreeRaffleReadModel().snapshot(wallet);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const httpStatus = message.match(/HTTP (\d{3})/i)?.[1];
    snapshotError = httpStatus ? `http-${httpStatus}` : /timeout|aborted/i.test(message) ? 'timeout' : 'invalid-response';
    console.error(`TREE raffle public snapshot unavailable: ${message}`);
  }
  return Response.json({
    ...status,
    rounds: snapshot?.rounds && Object.keys(snapshot.rounds).length ? {
      ...status.rounds,
      ...snapshot.rounds,
      daily: {
        ...status.rounds.daily,
        ...(snapshot.rounds.daily as Record<string, unknown> | undefined),
        prize: (snapshot.rounds.daily as Record<string, unknown> | undefined)?.prize
          ?? status.rounds.daily.prize,
      },
    } : status.rounds,
    history: snapshot?.history ?? status.history,
    wallet: snapshot?.wallet ?? (wallet ? { address: wallet, streak: null, unclaimedPrizes: [] } : null),
    safeguards: {
      ...status.safeguards,
      publicLedgerReadAvailable: snapshot !== null,
      publicLedgerReadError: snapshotError,
    },
  }, {
    headers: {
      'Cache-Control': wallet
        ? 'private, no-store'
        : 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const config = { path: '/api/tree-raffle-status' };

