import assert from 'node:assert/strict';
import {
  SUI_ZERO_ADDRESS,
  burnEvidenceForWallet,
  refreshTreeBurnIndex,
  validateTreeBurnIndex,
} from '../netlify/lib/tree-burn-index.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
const requests: Array<Record<string, unknown>> = [];
const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  requests.push(body.variables || {});
  if (body.query?.includes('LatestCheckpoint')) {
    return new Response(JSON.stringify({ data: { checkpoints: { nodes: [{ sequenceNumber: '100' }] } } }), { status: 200 });
  }
  const sender = String(body.variables?.sender || '');
  const burnAmount = sender === walletA ? '500000000000' : '0';
  const changes = burnAmount === '0' ? [] : [{
    owner: { address: SUI_ZERO_ADDRESS },
    coinType: { repr: TREE_COIN_TYPE },
    amount: burnAmount,
  }];
  return new Response(JSON.stringify({ data: { transactions: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [{
      digest: `digest-${sender.slice(2, 4)}`,
      sender: { address: sender },
      effects: {
        checkpoint: { sequenceNumber: '99' },
        balanceChanges: { pageInfo: { hasNextPage: false }, nodes: changes },
      },
    }],
  } } }), { status: 200 });
};

let checkpointWrites = 0;
const first = await refreshTreeBurnIndex(null, [walletA, walletB], {
  fetchImpl: fetchImpl as typeof fetch,
  now: () => 1_800_000_000_000,
  concurrency: 2,
  sleepImpl: async () => {},
  onWalletComplete: () => { checkpointWrites += 1; },
});
assert.equal(first.outcome, 'complete');
assert.ok(first.index);
assert.equal(validateTreeBurnIndex(first.index), true);
assert.equal(first.coverage.walletsCompleted, 2);
assert.equal(checkpointWrites, 2);
assert.equal(burnEvidenceForWallet(first.index, walletA)?.qualifies, true);
assert.equal(burnEvidenceForWallet(first.index, walletA)?.burnedTree, '500000');
assert.equal(burnEvidenceForWallet(first.index, walletB)?.qualifies, false);

let incrementalTransactionQueries = 0;
const incrementalFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  if (body.query?.includes('LatestCheckpoint')) {
    return new Response(JSON.stringify({ data: { checkpoints: { nodes: [{ sequenceNumber: '105' }] } } }), { status: 200 });
  }
  incrementalTransactionQueries += 1;
  assert.equal(body.variables?.afterCheckpoint, '100');
  return new Response(JSON.stringify({ data: { transactions: {
    pageInfo: { hasNextPage: false, endCursor: null }, nodes: [],
  } } }), { status: 200 });
};
const second = await refreshTreeBurnIndex(first.index, [walletA, walletB], {
  fetchImpl: incrementalFetch as typeof fetch,
  now: () => 1_800_000_060_000,
  concurrency: 2,
  sleepImpl: async () => {},
});
assert.equal(second.outcome, 'complete');
assert.equal(incrementalTransactionQueries, 2);
assert.equal(second.index?.wallets[walletA].burnedTreeRaw, '500000000000');
assert.equal(second.index?.wallets[walletA].indexedThroughCheckpoint, '105');
console.log('TREE burn index: PASS (lifetime backfill, per-wallet checkpoints, and incremental updates)');
