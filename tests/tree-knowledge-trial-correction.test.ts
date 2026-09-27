import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTreeKnowledgeTrialCorrectionHandler,
  readSupplementalCorrection,
  SEPTEMBER_22_CORRECTION,
} from '../netlify/lib/tree-knowledge-trial-correction.ts';

const PACKAGE = `0x${'ab'.repeat(32)}`;
const DIGEST = '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5';
const ENV = { TREE_RAFFLE_PACKAGE_ID: PACKAGE };
const registeredType = `${PACKAGE}::prize_pool::WinnerRegistered<${SEPTEMBER_22_CORRECTION.tokenType}>`;
const claimedType = `${PACKAGE}::prize_pool::PrizeClaimed<${SEPTEMBER_22_CORRECTION.tokenType}>`;

function event(type: string, digest = DIGEST) {
  return {
    type,
    digest,
    json: {
      draw_id: [...new TextEncoder().encode(SEPTEMBER_22_CORRECTION.onchainDrawId)],
      winner: SEPTEMBER_22_CORRECTION.wallet,
      amount: SEPTEMBER_22_CORRECTION.amountRaw,
    },
  };
}

test('supplemental correction is pending, claimable, then claimed from exact Sui events', async () => {
  const pending = await readSupplementalCorrection({ env: ENV, readEvents: async () => [] });
  assert.equal(pending.status, 'pending-registration');

  const claimable = await readSupplementalCorrection({
    env: ENV,
    readEvents: async (type) => type === registeredType ? [event(type)] : [],
  });
  assert.equal(claimable.status, 'claimable');
  assert.equal(claimable.amountRaw, '49000000000');

  const claimed = await readSupplementalCorrection({
    env: ENV,
    readEvents: async (type) => type === claimedType ? [event(type)] : type === registeredType ? [event(type)] : [],
  });
  assert.equal(claimed.status, 'claimed');
  assert.equal(claimed.claimTxDigest, DIGEST);
});

test('supplemental correction reconciliation accepts only the exact approved claim', async () => {
  const handler = createTreeKnowledgeTrialCorrectionHandler({
    env: ENV,
    fetchClaim: async () => ({
      digest: DIGEST,
      sender: SEPTEMBER_22_CORRECTION.wallet,
      effects: { status: 'success' as const },
      events: [{ type: claimedType, json: event(claimedType).json }],
    }),
  });
  const exact = new Request('https://tree-token.xyz/api/tree-knowledge-trial-correction', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ digest: DIGEST, wallet: SEPTEMBER_22_CORRECTION.wallet }),
  });
  assert.equal((await handler(exact)).status, 200);

  const wrongWallet = new Request('https://tree-token.xyz/api/tree-knowledge-trial-correction', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ digest: DIGEST, wallet: `0x${'ff'.repeat(32)}` }),
  });
  assert.equal((await handler(wrongWallet)).status, 400);
});
