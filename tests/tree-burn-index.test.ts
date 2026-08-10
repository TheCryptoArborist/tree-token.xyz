import assert from 'node:assert/strict';
import {
  SUI_ZERO_ADDRESS,
  TREE_BURN_INDEX_METHODOLOGY_VERSION,
  burnEvidenceForWallet,
  refreshTreeBurnIndex,
  validateTreeBurnIndex,
} from '../netlify/lib/tree-burn-index.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const creationCheckpoint = '10';

function latestResponse(sequenceNumber: string) {
  return new Response(JSON.stringify({
    data: { checkpoints: { nodes: [{ sequenceNumber }] } },
  }), { status: 200 });
}

function burnNode(digest: string, checkpoint: number, amount: string) {
  return {
    digest,
    sender: { address: walletA },
    effects: {
      status: 'SUCCESS',
      checkpoint: { sequenceNumber: checkpoint },
      balanceChanges: {
        pageInfo: { hasNextPage: false },
        nodes: amount === '0' ? [] : [{
          owner: { address: SUI_ZERO_ADDRESS },
          coinType: { repr: TREE_COIN_TYPE },
          amount,
        }],
      },
    },
  };
}

const firstRequests: Array<Record<string, unknown>> = [];
const firstFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  if (body.query?.includes('LatestCheckpoint')) return latestResponse('100');
  firstRequests.push(body.variables || {});
  return new Response(JSON.stringify({ data: { transactions: {
    pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
    nodes: [burnNode('burn-page-1', 20, '300000000000')],
  } } }), { status: 200 });
};

let progressWrites = 0;
const partial = await refreshTreeBurnIndex(null, [walletA], {
  fetchImpl: firstFetch as typeof fetch,
  now: () => 1_800_000_000_000,
  creationCheckpoint,
  concurrency: 1,
  maxPagesPerWallet: 1,
  sleepImpl: async () => {},
  onProgress: () => { progressWrites += 1; },
});
assert.equal(partial.outcome, 'verification-incomplete');
assert.ok(partial.index);
assert.equal(partial.index.methodologyVersion, TREE_BURN_INDEX_METHODOLOGY_VERSION);
assert.equal(validateTreeBurnIndex(partial.index), true);
assert.equal(partial.index.wallets[walletA].completeBackfill, false);
assert.equal(partial.index.wallets[walletA].progress?.nextCursor, 'cursor-1');
assert.equal(partial.index.wallets[walletA].progress?.accumulatedBurnedTreeRaw, '300000000000');
assert.equal(firstRequests[0].afterCheckpoint, 9);
assert.equal(firstRequests[0].beforeCheckpoint, 101);
assert.ok(progressWrites >= 2);

const resumeRequests: Array<Record<string, unknown>> = [];
const resumeFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  if (body.query?.includes('LatestCheckpoint')) return latestResponse('100');
  resumeRequests.push(body.variables || {});
  return new Response(JSON.stringify({ data: { transactions: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [burnNode('burn-page-2', 30, '200000000000')],
  } } }), { status: 200 });
};
const completed = await refreshTreeBurnIndex(partial.index, [walletA], {
  fetchImpl: resumeFetch as typeof fetch,
  now: () => 1_800_000_060_000,
  creationCheckpoint,
  concurrency: 1,
  sleepImpl: async () => {},
});
assert.equal(completed.outcome, 'complete');
assert.ok(completed.index);
assert.equal(resumeRequests[0].after, 'cursor-1');
assert.equal(resumeRequests[0].afterCheckpoint, 9);
assert.equal(resumeRequests[0].beforeCheckpoint, 101);
assert.equal(completed.index.wallets[walletA].progress, null);
assert.equal(completed.index.wallets[walletA].indexedThroughCheckpoint, '100');
assert.equal(completed.index.wallets[walletA].burnedTreeRaw, '500000000000');
assert.equal(burnEvidenceForWallet(completed.index, walletA)?.qualifies, true);
assert.equal(burnEvidenceForWallet(completed.index, walletA)?.burnedTree, '500000');

let incrementalQueries = 0;
const incrementalFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  if (body.query?.includes('LatestCheckpoint')) return latestResponse('105');
  incrementalQueries += 1;
  assert.equal(body.variables?.afterCheckpoint, 100);
  assert.equal(body.variables?.beforeCheckpoint, 106);
  assert.equal(body.variables?.after, null);
  return new Response(JSON.stringify({ data: { transactions: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [],
  } } }), { status: 200 });
};
const incremental = await refreshTreeBurnIndex(completed.index, [walletA], {
  fetchImpl: incrementalFetch as typeof fetch,
  now: () => 1_800_000_120_000,
  creationCheckpoint,
  concurrency: 1,
  sleepImpl: async () => {},
});
assert.equal(incremental.outcome, 'complete');
assert.equal(incrementalQueries, 1);
assert.equal(incremental.index?.wallets[walletA].burnedTreeRaw, '500000000000');
assert.equal(incremental.index?.wallets[walletA].indexedThroughCheckpoint, '105');
assert.equal(incremental.index?.indexedThroughCheckpoint, '105');
console.log('TREE burn index: PASS (creation checkpoint, per-page cursor persistence, interrupted resume, exact burn totals, and incremental updates)');
