import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeKnowledgeTrialClaimHandler } from '../netlify/lib/tree-knowledge-trial-claim.ts';

const WALLET = `0x${'18'.repeat(32)}`;
const PACKAGE = `0x${'ab'.repeat(32)}`;
const POOL = `0x${'cd'.repeat(32)}`;
const DIGEST = '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5';
const ROUND = 'knowledge:2026-08-22';
const DRAW = `${ROUND}:award`;
const TOKEN = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const AMOUNT = '50000000000';

function request(body: unknown = { digest: DIGEST, wallet: WALLET, roundId: ROUND }) {
  return new Request('https://tree-token.xyz/api/tree-knowledge-trial-claim', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function finalizedClaim() {
  return {
    digest: DIGEST,
    sender: WALLET,
    effects: { status: 'success' as const },
    events: [{
      type: `${PACKAGE}::prize_pool::PrizeClaimed<${TOKEN}>`,
      json: { draw_id: [...new TextEncoder().encode(DRAW)], winner: WALLET, amount: AMOUNT },
    }],
  };
}

test('Knowledge Trial claim endpoint is disabled until settlement and claims are ready', async () => {
  const handler = createTreeKnowledgeTrialClaimHandler({ env: {}, allowClaims: false });
  assert.equal((await handler(request())).status, 503);
});

test('only the recorded Knowledge Trial winner can reconcile the exact on-chain claim', async () => {
  let recorded: unknown = null;
  const handler = createTreeKnowledgeTrialClaimHandler({
    env: { TREE_RAFFLE_PACKAGE_ID: PACKAGE, TREE_RAFFLE_PRIZE_POOL_ID: POOL },
    allowClaims: true,
    readAward: async () => ({
      roundId: ROUND, onchainDrawId: DRAW, wallet: WALLET,
      tokenType: TOKEN, amountRaw: AMOUNT, claimed: false,
    }),
    fetchClaim: async () => finalizedClaim(),
    recordClaim: async (roundId, wallet, digest) => {
      recorded = { roundId, wallet, digest };
      return { outcome: 'recorded' };
    },
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(recorded, { roundId: ROUND, wallet: WALLET, digest: DIGEST });
});

test('Knowledge Trial claim rejects extra fields, another wallet, and already-claimed awards', async () => {
  const base = {
    env: { TREE_RAFFLE_PACKAGE_ID: PACKAGE, TREE_RAFFLE_PRIZE_POOL_ID: POOL },
    allowClaims: true,
    fetchClaim: async () => finalizedClaim(),
    recordClaim: async () => ({ outcome: 'recorded' }),
  };
  const invalid = createTreeKnowledgeTrialClaimHandler({
    ...base,
    readAward: async () => null,
  });
  assert.equal((await invalid(request({ digest: DIGEST, wallet: WALLET, roundId: ROUND, amount: AMOUNT }))).status, 400);
  assert.equal((await invalid(request())).status, 404);

  const claimed = createTreeKnowledgeTrialClaimHandler({
    ...base,
    readAward: async () => ({
      roundId: ROUND, onchainDrawId: DRAW, wallet: WALLET,
      tokenType: TOKEN, amountRaw: AMOUNT, claimed: true,
    }),
  });
  assert.equal((await claimed(request())).status, 404);
});
