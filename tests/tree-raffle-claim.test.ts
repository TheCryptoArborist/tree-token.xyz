import test from 'node:test';
import assert from 'node:assert/strict';
import { createTreeRaffleClaimHandler, fetchFinalizedTreeRaffleClaim } from '../netlify/lib/tree-raffle-claim.ts';

const WALLET = `0x${'18'.repeat(32)}`;
const PACKAGE = `0x${'ab'.repeat(32)}`;
const DIGEST = '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5';
const ROUND = 'daily:2026-08-20';
const DRAW = `${ROUND}:main`;
const TOKEN = '0x2::sui::SUI';
const DRAW_BYTES = [...new TextEncoder().encode(DRAW)];
const PRIZE = { roundId: ROUND, prizeClass: 'main', onchainDrawId: DRAW, tokenType: TOKEN, amountRaw: '1000000000' };

function request(body: unknown = { digest: DIGEST, wallet: WALLET, roundId: ROUND, prizeClass: 'main' }) {
  return new Request('https://tree-token.xyz/api/tree-raffle-claim', {
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
      json: { draw_id: DRAW_BYTES, winner: WALLET, amount: '1000000000' },
    }],
  };
}

test('claim endpoint remains disabled until claims and the prize pool are active', async () => {
  const handler = createTreeRaffleClaimHandler({ env: {}, allowClaims: false });
  assert.equal((await handler(request())).status, 503);
});

test('claim endpoint accepts only an exact winner claim request', async () => {
  const handler = createTreeRaffleClaimHandler({ env: {}, allowClaims: true });
  assert.equal((await handler(request({ digest: DIGEST, wallet: WALLET, roundId: ROUND, prizeClass: 'main', amount: '1' }))).status, 400);
  assert.equal((await handler(request({ digest: 'bad', wallet: WALLET, roundId: ROUND, prizeClass: 'main' }))).status, 400);
});

test('claim endpoint independently verifies and reconciles a configured unclaimed prize', async () => {
  let recorded: Record<string, unknown> | null = null;
  const handler = createTreeRaffleClaimHandler({
    env: { TREE_RAFFLE_PACKAGE_ID: PACKAGE }, allowClaims: true,
    readWallet: async (wallet) => ({ wallet: { address: wallet, unclaimedPrizes: [PRIZE] } }),
    fetchClaim: async (digest) => { assert.equal(digest, DIGEST); return finalizedClaim(); },
    recordClaim: async (input) => {
      recorded = input;
      return { outcome: 'recorded', claimedAt: '2026-08-20T17:00:00.000Z' };
    },
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(recorded, { roundId: ROUND, prizeClass: 'main', wallet: WALLET, claimTxDigest: DIGEST });
});

test('claim endpoint rejects a digest from another sender or prize', async () => {
  const handler = createTreeRaffleClaimHandler({
    env: { TREE_RAFFLE_PACKAGE_ID: PACKAGE }, allowClaims: true,
    readWallet: async () => ({ wallet: { address: WALLET, unclaimedPrizes: [PRIZE] } }),
    fetchClaim: async () => ({ ...finalizedClaim(), sender: `0x${'19'.repeat(32)}` }),
    recordClaim: async () => { throw new Error('must not record'); },
  });
  assert.equal((await handler(request())).status, 422);
  assert.equal((await handler(request({ digest: DIGEST, wallet: WALLET, roundId: 'daily:2026-08-19', prizeClass: 'main' }))).status, 404);
});

test('Sui claim fetcher rejects incomplete event pages and normalizes successful GraphQL data', async () => {
  const payload = (hasNextPage: boolean) => ({
    data: { transaction: {
      digest: DIGEST, sender: { address: WALLET }, effects: {
        status: 'SUCCESS', pageInfo: {}, events: { pageInfo: { hasNextPage }, nodes: [{ contents: { type: { repr: `${PACKAGE}::prize_pool::PrizeClaimed<${TOKEN}>` }, json: { draw_id: DRAW_BYTES, winner: WALLET, amount: '1000000000' } } }] },
      },
    } },
  });
  const fetchImpl = async () => new Response(JSON.stringify(payload(false)), { status: 200 });
  const transaction = await fetchFinalizedTreeRaffleClaim(DIGEST, { fetchImpl: fetchImpl as typeof fetch });
  assert.equal(transaction.sender, WALLET);
  await assert.rejects(() => fetchFinalizedTreeRaffleClaim(DIGEST, { fetchImpl: (async () => new Response(JSON.stringify(payload(true)), { status: 200 })) as typeof fetch }));
});
