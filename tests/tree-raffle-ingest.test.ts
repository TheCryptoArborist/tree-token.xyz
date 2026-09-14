import test from 'node:test';
import assert from 'node:assert/strict';
import { createTreeRaffleIngestHandler, completeVerifiedBuy } from '../netlify/lib/tree-raffle-ingest.ts';
import { qualifyingUsdCentsFromSuiRaw } from '../netlify/lib/tree-raffle-price.ts';
import type { VerifiedTreeBuy } from '../netlify/lib/tree-raffle-ledger-core.ts';

const DIGEST = '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5';
const BUY = {
  txDigest: DIGEST, buyer: `0x${'18'.repeat(32)}`, route: 'suidex-v3' as const,
  suiSpentRaw: '3000000000', treeAmountRaw: '106080000000', finalizedCheckpoint: 123456,
  finalizedAt: '2026-08-17T14:00:00.000Z', raffleDate: '2026-08-17',
};

function request(secret = 'ingest-secret', body: unknown = { digest: DIGEST }) {
  return new Request('https://tree-token.netlify.app/api/tree-raffle-ingest-buy', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-tree-raffle-ingest-secret': secret },
    body: JSON.stringify(body),
  });
}

test('ingestion remains disabled when either the environment or public raffle rules are closed', async () => {
  const environmentOff = createTreeRaffleIngestHandler({ env: { TREE_RAFFLE_INGEST_ENABLED: 'false' }, allowEntries: true });
  assert.equal((await environmentOff(request())).status, 503);
  const rulesOff = createTreeRaffleIngestHandler({ env: { TREE_RAFFLE_INGEST_ENABLED: 'true' }, allowEntries: false });
  assert.equal((await rulesOff(request())).status, 503);
});

test('enabled ingestion accepts only its secret and a digest-only body', async () => {
  const handler = createTreeRaffleIngestHandler({
    env: { TREE_RAFFLE_INGEST_ENABLED: 'true', TREE_RAFFLE_INGEST_SECRET: 'ingest-secret' }, allowEntries: true,
    verifyBuy: async () => BUY, priceScaled: async () => 68_000_000n,
    ledger: { recordVerifiedBuy: async () => ({ outcome: 'recorded', qualifies: false, streakDays: null, mainTickets: 0, luckyLeafTickets: 0, dailyRoundId: 'daily:2026-08-17', weeklyRoundId: 'weekly:2026-08-23' }) },
  });
  assert.equal((await handler(request('wrong'))).status, 401);
  assert.equal((await handler(request('ingest-secret', { digest: DIGEST, buyer: BUY.buyer }))).status, 400);
});

test('independently verified amount and price are recorded through the transactional ledger', async () => {
  let recorded: VerifiedTreeBuy | null = null;
  const handler = createTreeRaffleIngestHandler({
    env: { TREE_RAFFLE_INGEST_ENABLED: 'true', TREE_RAFFLE_INGEST_SECRET: 'ingest-secret' }, allowEntries: true,
    verifyBuy: async (digest) => { assert.equal(digest, DIGEST); return BUY; },
    priceScaled: async () => 68_000_000n,
    ledger: { recordVerifiedBuy: async (input) => {
      recorded = input;
      return { outcome: 'recorded', qualifies: false, streakDays: null, mainTickets: 0, luckyLeafTickets: 0, dailyRoundId: input.dailyRoundId, weeklyRoundId: input.weeklyRoundId };
    } },
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(recorded?.qualifyingUsdCents, 204);
  assert.equal(recorded?.dailyRoundId, 'daily:2026-08-17');
  assert.equal(recorded?.weeklyRoundId, 'weekly:2026-08-23');
});

test('USD conversion floors to independently priced whole cents and round IDs are deterministic', () => {
  assert.equal(qualifyingUsdCentsFromSuiRaw('3000000000', 67_999_999n), 203);
  assert.equal(completeVerifiedBuy(BUY, 204).weeklyRoundId, 'weekly:2026-08-23');
});
