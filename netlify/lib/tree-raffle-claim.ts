import { raffleOperationalReadiness, treeRaffleRulesForEnvironment } from './tree-raffle-core.ts';
import { verifyTreeRaffleClaimTransaction } from './tree-raffle-sui-draw.ts';
import { configuredSupabaseTreeRaffleDrawStore } from './tree-raffle-supabase-draw.ts';
import { configuredSupabaseTreeRaffleReadModel } from './tree-raffle-supabase-read.ts';

const SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const SUI_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;

export const TREE_RAFFLE_CLAIM_QUERY = `query TreeRaffleClaim($digest: String!) {
  transaction(digest: $digest) {
    digest
    sender { address }
    effects {
      status
      events(first: 10) {
        pageInfo { hasNextPage }
        nodes { contents { type { repr } json } }
      }
    }
  }
}`;

type Environment = Record<string, string | undefined>;
type PrizeClass = 'main' | 'lucky';
type UnclaimedPrize = {
  roundId: string;
  prizeClass: PrizeClass;
  onchainDrawId: string;
  wallet: string;
  tokenType: string;
  amountRaw: string;
};

type ClaimTransaction = {
  digest: string;
  sender: string;
  effects: { status: 'success' };
  events: Array<{ type: string; json: Record<string, unknown> }>;
};

type Dependencies = {
  env?: Environment;
  allowClaims?: boolean;
  readWallet?: (wallet: string) => Promise<{ wallet: Record<string, unknown> | null }>;
  fetchClaim?: (digest: string) => Promise<ClaimTransaction>;
  recordClaim?: (input: {
    roundId: string;
    prizeClass: PrizeClass;
    wallet: string;
    claimTxDigest: string;
  }) => Promise<{ outcome: 'recorded' | 'duplicate'; claimedAt: string }>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}

function parsePrize(value: unknown, wallet: string): UnclaimedPrize | null {
  const prize = record(value);
  if (typeof prize.roundId !== 'string'
    || (prize.prizeClass !== 'main' && prize.prizeClass !== 'lucky')
    || typeof prize.onchainDrawId !== 'string'
    || typeof prize.tokenType !== 'string'
    || !prize.tokenType.includes('::')
    || typeof prize.amountRaw !== 'string'
    || !/^(?:0|[1-9][0-9]*)$/.test(prize.amountRaw)) return null;
  return { ...prize, wallet } as UnclaimedPrize;
}

export async function fetchFinalizedTreeRaffleClaim(
  digest: string,
  options: { fetchImpl?: typeof fetch; endpoint?: string; timeoutMs?: number } = {},
): Promise<ClaimTransaction> {
  if (!SUI_DIGEST.test(digest)) throw new Error('A valid Sui transaction digest is required.');
  const response = await (options.fetchImpl ?? fetch)(options.endpoint ?? SUI_GRAPHQL_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: TREE_RAFFLE_CLAIM_QUERY, variables: { digest } }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
  });
  if (!response.ok) throw new Error(`Sui claim verification returned ${response.status}.`);
  const payload = record(await response.json());
  if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('Sui claim verification returned a GraphQL error.');
  const transaction = record(record(payload.data).transaction);
  const effects = record(transaction.effects);
  const events = record(effects.events);
  const sender = String(record(transaction.sender).address || '').toLowerCase();
  if (transaction.digest !== digest
    || !SUI_ADDRESS.test(sender)
    || String(effects.status || '').toLowerCase() !== 'success'
    || record(events.pageInfo).hasNextPage === true
    || !Array.isArray(events.nodes)) {
    throw new Error('The Sui raffle claim was not found, successful, or complete.');
  }
  const parsedEvents = events.nodes.map((node) => {
    const contents = record(record(node).contents);
    return { type: String(record(contents.type).repr || ''), json: record(contents.json) };
  });
  return { digest, sender, effects: { status: 'success' }, events: parsedEvents };
}

export function createTreeRaffleClaimHandler(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  return async (request: Request) => {
    if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
    const rules = treeRaffleRulesForEnvironment(env);
    const readiness = raffleOperationalReadiness(env, rules);
    const enabled = dependencies.allowClaims
      ?? (rules.claimsEnabled && rules.prizesFunded && readiness.onchainPrizePoolConfigured);
    if (!enabled) return json({ status: 'disabled', error: 'raffle-claims-disabled' }, 503);

    let digest = '';
    let wallet = '';
    let roundId = '';
    let prizeClass: PrizeClass = 'main';
    try {
      const body = await request.json() as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 4
        || typeof body.digest !== 'string'
        || typeof body.wallet !== 'string'
        || typeof body.roundId !== 'string'
        || (body.prizeClass !== 'main' && body.prizeClass !== 'lucky')) throw new Error('invalid');
      digest = body.digest.trim();
      wallet = body.wallet.trim().toLowerCase();
      roundId = body.roundId.trim();
      prizeClass = body.prizeClass;
      if (!SUI_DIGEST.test(digest) || !SUI_ADDRESS.test(wallet) || !roundId) throw new Error('invalid');
    } catch {
      return json({ status: 'error', error: 'invalid-request' }, 400);
    }

    try {
      const snapshot = await (dependencies.readWallet
        ? dependencies.readWallet(wallet)
        : configuredSupabaseTreeRaffleReadModel(env).snapshot(wallet));
      if (snapshot.wallet?.address !== wallet) throw new Error('The claim snapshot does not match the requested wallet.');
      const unclaimed = Array.isArray(snapshot.wallet?.unclaimedPrizes)
        ? snapshot.wallet.unclaimedPrizes.map((value) => parsePrize(value, wallet)).filter((value): value is UnclaimedPrize => value !== null)
        : [];
      const prize = unclaimed.find((candidate) => candidate.roundId === roundId && candidate.prizeClass === prizeClass);
      if (!prize || prize.wallet !== wallet) return json({ status: 'error', error: 'prize-not-claimable' }, 404);

      const transaction = await (dependencies.fetchClaim ?? fetchFinalizedTreeRaffleClaim)(digest);
      if (transaction.sender !== wallet) throw new Error('The claim sender does not match the prize winner.');
      const verified = verifyTreeRaffleClaimTransaction({
        transaction,
        packageId: env.TREE_RAFFLE_PACKAGE_ID || '',
        onchainDrawId: prize.onchainDrawId,
        wallet,
        tokenType: prize.tokenType,
        amountRaw: prize.amountRaw,
      });
      const recorded = await (dependencies.recordClaim
        ? dependencies.recordClaim({ roundId, prizeClass, wallet, claimTxDigest: verified.digest })
        : configuredSupabaseTreeRaffleDrawStore(env).recordClaim({ roundId, prizeClass, wallet, claimTxDigest: verified.digest }));
      return json({ status: 'ok', roundId, prizeClass, wallet, digest: verified.digest, ...recorded });
    } catch (error) {
      console.error('TREE raffle prize claim reconciliation failed', error);
      return json({ status: 'error', error: 'verification-failed', message: 'The finalized raffle claim could not be independently verified and recorded.' }, 422);
    }
  };
}
