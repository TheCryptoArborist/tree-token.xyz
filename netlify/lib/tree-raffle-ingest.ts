import { createHash, timingSafeEqual } from 'node:crypto';
import { treeRaffleRulesForEnvironment } from './tree-raffle-core.ts';
import { fetchFinalizedTreeBuy } from './tree-raffle-buy-verifier.ts';
import type { FinalizedTreeBuy } from './tree-raffle-buy-verifier.ts';
import type { TransactionalTreeRaffleLedger, VerifiedTreeBuy } from './tree-raffle-ledger-core.ts';
import { configuredSupabaseTreeRaffleLedger } from './tree-raffle-supabase-ledger.ts';
import { fetchSuiUsdPriceScaled, qualifyingUsdCentsFromSuiRaw } from './tree-raffle-price.ts';

type Environment = Record<string, string | undefined>;
type Dependencies = {
  env?: Environment;
  allowEntries?: boolean;
  verifyBuy?: (digest: string) => Promise<FinalizedTreeBuy>;
  priceScaled?: () => Promise<bigint>;
  ledger?: TransactionalTreeRaffleLedger;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}

function secretMatches(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  const left = createHash('sha256').update(received).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

function weeklyRoundDate(raffleDate: string): string {
  const date = new Date(`${raffleDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  return date.toISOString().slice(0, 10);
}

export function completeVerifiedBuy(buy: FinalizedTreeBuy, qualifyingUsdCents: number): VerifiedTreeBuy {
  return {
    ...buy,
    qualifyingUsdCents,
    dailyRoundId: `daily:${buy.raffleDate}`,
    weeklyRoundId: `weekly:${weeklyRoundDate(buy.raffleDate)}`,
  };
}

export function createTreeRaffleIngestHandler(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  return async (request: Request) => {
    if (request.method !== 'POST') return json({ status: 'error', error: 'method-not-allowed' }, 405);
    const rules = treeRaffleRulesForEnvironment(env);
    const enabled = env.TREE_RAFFLE_INGEST_ENABLED === 'true'
      && (dependencies.allowEntries ?? rules.acceptingEntries);
    if (!enabled) return json({ status: 'disabled', error: 'raffle-entries-disabled' }, 503);
    const configuredSecret = env.TREE_RAFFLE_INGEST_SECRET?.trim() || '';
    if (!secretMatches(request.headers.get('x-tree-raffle-ingest-secret') || '', configuredSecret)) {
      return json({ status: 'error', error: 'unauthorized' }, 401);
    }

    let digest = '';
    try {
      const body = await request.json() as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 1 || typeof body.digest !== 'string') throw new Error('invalid');
      digest = body.digest.trim();
    } catch {
      return json({ status: 'error', error: 'invalid-request', message: 'Send one finalized Sui transaction digest.' }, 400);
    }

    try {
      const verify = dependencies.verifyBuy ?? fetchFinalizedTreeBuy;
      const readPrice = dependencies.priceScaled ?? (() => fetchSuiUsdPriceScaled());
      const ledger = dependencies.ledger ?? configuredSupabaseTreeRaffleLedger(env);
      const [buy, priceScaled] = await Promise.all([verify(digest), readPrice()]);
      const input = completeVerifiedBuy(buy, qualifyingUsdCentsFromSuiRaw(buy.suiSpentRaw, priceScaled));
      const result = await ledger.recordVerifiedBuy(input);
      return json({ status: 'ok', txDigest: buy.txDigest, ...result });
    } catch (error) {
      console.error('TREE raffle verified-buy ingestion failed', error);
      return json({ status: 'error', error: 'verification-failed', message: 'The finalized TREE buy could not be independently verified and recorded.' }, 422);
    }
  };
}

