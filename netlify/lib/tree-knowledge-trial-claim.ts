import { fetchFinalizedTreeRaffleClaim } from './tree-raffle-claim.ts';
import { verifyTreeRaffleClaimTransaction } from './tree-raffle-sui-draw.ts';
import { configuredSupabaseTreeKnowledgeTrialStore } from './tree-knowledge-trial-supabase.ts';

const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const SUI_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;
const ROUND_ID = /^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

type Environment = Record<string, string | undefined>;
type Award = {
  roundId: string;
  onchainDrawId: string;
  wallet: string;
  tokenType: string;
  amountRaw: string;
  claimed: boolean;
};

type Dependencies = {
  env?: Environment;
  allowClaims?: boolean;
  readAward?: (roundId: string, wallet: string) => Promise<Record<string, unknown> | null>;
  fetchClaim?: typeof fetchFinalizedTreeRaffleClaim;
  recordClaim?: (roundId: string, wallet: string, digest: string) => Promise<Record<string, unknown>>;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}

function parseAward(value: Record<string, unknown> | null, roundId: string, wallet: string): Award | null {
  if (!value
    || value.roundId !== roundId
    || value.wallet !== wallet
    || typeof value.onchainDrawId !== 'string'
    || typeof value.tokenType !== 'string'
    || !value.tokenType.includes('::')
    || typeof value.amountRaw !== 'string'
    || !/^[1-9][0-9]*$/.test(value.amountRaw)
    || typeof value.claimed !== 'boolean') return null;
  return value as Award;
}

export function createTreeKnowledgeTrialClaimHandler(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  return async (request: Request) => {
    if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
    const enabled = dependencies.allowClaims ?? (
      env.TREE_KNOWLEDGE_TRIAL_CLAIMS_ENABLED === 'true'
      && env.TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY === 'true'
      && Boolean(env.TREE_RAFFLE_PACKAGE_ID?.trim())
      && Boolean(env.TREE_RAFFLE_PRIZE_POOL_ID?.trim())
    );
    if (!enabled) return json({ status: 'disabled', error: 'knowledge-trial-claims-disabled' }, 503);

    let digest = '';
    let wallet = '';
    let roundId = '';
    try {
      const body = await request.json() as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 3
        || typeof body.digest !== 'string'
        || typeof body.wallet !== 'string'
        || typeof body.roundId !== 'string') throw new Error('invalid');
      digest = body.digest.trim();
      wallet = body.wallet.trim().toLowerCase();
      roundId = body.roundId.trim();
      if (!SUI_DIGEST.test(digest) || !SUI_ADDRESS.test(wallet) || !ROUND_ID.test(roundId)) throw new Error('invalid');
    } catch {
      return json({ status: 'error', error: 'invalid-request' }, 400);
    }

    try {
      const store = (!dependencies.readAward || !dependencies.recordClaim)
        ? configuredSupabaseTreeKnowledgeTrialStore(env)
        : null;
      const award = parseAward(await (dependencies.readAward
        ? dependencies.readAward(roundId, wallet)
        : store!.readAward(roundId, wallet)), roundId, wallet);
      if (!award || award.claimed) return json({ status: 'error', error: 'award-not-claimable' }, 404);

      const transaction = await (dependencies.fetchClaim ?? fetchFinalizedTreeRaffleClaim)(digest);
      if (transaction.sender !== wallet) throw new Error('The claim sender does not match the Knowledge Trial winner.');
      const verified = verifyTreeRaffleClaimTransaction({
        transaction,
        packageId: env.TREE_RAFFLE_PACKAGE_ID || '',
        onchainDrawId: award.onchainDrawId,
        wallet,
        tokenType: award.tokenType,
        amountRaw: award.amountRaw,
      });
      const recorded = await (dependencies.recordClaim
        ? dependencies.recordClaim(roundId, wallet, verified.digest)
        : store!.recordClaim(roundId, wallet, verified.digest));
      return json({ status: 'ok', roundId, wallet, digest: verified.digest, ...recorded });
    } catch (error) {
      console.error('TREE Knowledge Trial prize claim reconciliation failed', error);
      return json({
        status: 'error',
        error: 'verification-failed',
        message: 'The finalized Knowledge Trial prize claim could not be independently verified and recorded.',
      }, 422);
    }
  };
}
