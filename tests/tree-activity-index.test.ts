import assert from 'node:assert/strict';
import {
  SUIDEX_V3_TREE_POOL_ID,
  TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION,
  refreshTreeActivityIndex,
  summarizeTreeActivity,
  validateTreeActivityIndex,
} from '../netlify/lib/tree-activity-index.ts';
import {
  TREE_ACTIVITY_WINDOW_MS,
} from '../netlify/lib/tree-badge-types.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';
import {
  SUIDEX_V2_PACKAGE,
  SUIDEX_V2_TREE_POOL_ID,
} from '../netlify/lib/suidex-v2-tree-lp-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
const zeroAddress = `0x${'0'.repeat(64)}`;
const sui = '0x2::sui::SUI';
const now = 1_800_000_000_000;
const windowStart = now - TREE_ACTIVITY_WINDOW_MS;
const startCheckpoint = 700;
const latestCheckpoint = 1_000;
const checkpointSpacing = TREE_ACTIVITY_WINDOW_MS / (latestCheckpoint - startCheckpoint);

function timestampForCheckpoint(sequenceNumber: number): number {
  return Math.round(windowStart + (sequenceNumber - startCheckpoint) * checkpointSpacing);
}

function moveCall(moduleName: string, functionName: string) {
  return {
    moveCall: {
      package: SUIDEX_V2_PACKAGE,
      module: moduleName,
      function: functionName,
      typeArguments: [sui, TREE_COIN_TYPE],
    },
  };
}

function transaction(
  digest: string,
  wallet: string,
  checkpoint: number,
  treeDeltaRaw: string,
  commands: unknown[],
  extraChanges: unknown[] = [],
) {
  return {
    digest,
    sender: { address: wallet },
    transactionJson: { kind: { programmableTransaction: { commands } } },
    effects: {
      status: 'SUCCESS',
      timestamp: new Date(timestampForCheckpoint(checkpoint)).toISOString(),
      checkpoint: { sequenceNumber: checkpoint },
      balanceChanges: {
        pageInfo: { hasNextPage: false },
        nodes: [
          { owner: { address: wallet }, coinType: { repr: TREE_COIN_TYPE }, amount: treeDeltaRaw },
          ...extraChanges,
        ],
      },
    },
  };
}

const transactions: unknown[] = [];
for (let index = 0; index < 10; index += 1) {
  transactions.push(transaction(
    `buy-${index}`,
    walletA,
    800 + index,
    '20000000000',
    [moveCall('router', 'swap_exact_tokens0_for_tokens1_composable')],
  ));
}
transactions.push(transaction(
  'sell-b',
  walletB,
  820,
  '-150000000000',
  [moveCall('router', 'swap_exact_tokens1_for_tokens0_composable')],
));
// Ordinary transfer: nonzero TREE delta but no recognized swap MoveCall.
transactions.push(transaction('transfer-a', walletA, 821, '1000000', []));
// LP join: contains a swap-like call but is disqualified by the TREE liquidity operation.
transactions.push(transaction(
  'lp-a',
  walletA,
  822,
  '-100000000000',
  [
    moveCall('router', 'swap_exact_tokens1_for_tokens0_composable'),
    moveCall('liquidity', 'add_liquidity'),
  ],
));
// Burn: recognized swap call plus positive TREE credit to the zero address must not be classified.
transactions.push(transaction(
  'burn-a',
  walletA,
  823,
  '-500000000000',
  [moveCall('router', 'swap_exact_tokens1_for_tokens0_composable')],
  [{ owner: { address: zeroAddress }, coinType: { repr: TREE_COIN_TYPE }, amount: '500000000000' }],
));
// Duplicate result from a routed transaction touching the same affected object.
transactions.push(transactions[0]);

function graphqlResponse(body: { query?: string; variables?: Record<string, unknown> }, currentLatest: number, txNodes: unknown[]) {
  if (body.query?.includes('LatestCheckpoint')) {
    return new Response(JSON.stringify({
      data: { checkpoints: { nodes: [{ sequenceNumber: currentLatest, timestamp: new Date(currentLatest === latestCheckpoint ? now : now + 60_000).toISOString() }] } },
    }), { status: 200 });
  }
  if (body.query?.includes('CheckpointAt')) {
    const sequenceNumber = Number(body.variables?.sequenceNumber);
    return new Response(JSON.stringify({
      data: { checkpoint: { sequenceNumber, timestamp: new Date(timestampForCheckpoint(sequenceNumber)).toISOString() } },
    }), { status: 200 });
  }
  if (body.query?.includes('PoolTransactions')) {
    return new Response(JSON.stringify({
      data: { transactions: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: txNodes } },
    }), { status: 200 });
  }
  return new Response(JSON.stringify({ errors: [{ message: 'Unexpected fixture query.' }] }), { status: 200 });
}

const requestVariables: Array<Record<string, unknown>> = [];
const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  if (body.query?.includes('PoolTransactions')) requestVariables.push(body.variables || {});
  return graphqlResponse(body, latestCheckpoint, transactions);
};

let progressWrites = 0;
const first = await refreshTreeActivityIndex(null, {
  fetchImpl: fetchImpl as typeof fetch,
  now: () => now,
  wallets: [walletA, walletB],
  sources: [{ poolId: SUIDEX_V2_TREE_POOL_ID, protocol: 'suidex-v2', venue: 'suidex-v2' }],
  sleepImpl: async () => {},
  onProgress: () => { progressWrites += 1; },
});
assert.equal(first.outcome, 'complete');
assert.ok(first.index);
assert.equal(first.index.methodologyVersion, TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION);
assert.equal(validateTreeActivityIndex(first.index), true);
assert.equal(first.index.windowStartCheckpoint, String(startCheckpoint));
assert.equal(first.index.indexedThroughCheckpoint, String(latestCheckpoint));
assert.equal(first.coverage.poolsCompleted, 1);
assert.equal(first.coverage.duplicateEvents, 1);
assert.ok(progressWrites >= 3);
assert.equal(requestVariables[0].afterCheckpoint, startCheckpoint - 1);
assert.equal(requestVariables[0].beforeCheckpoint, latestCheckpoint + 1);

const summary = summarizeTreeActivity(first.index, [walletA, walletB]);
assert.equal(summary[walletA].buyCount, 10);
assert.equal(summary[walletA].sellCount, 0);
assert.equal(summary[walletA].buyTreeRaw, '200000000000');
assert.equal(summary[walletB].buyCount, 0);
assert.equal(summary[walletB].sellCount, 1);
assert.equal(summary[walletB].sellTreeRaw, '150000000000');
assert.equal(Object.keys(first.index.transactions).length, 11);

let incrementalQueries = 0;
const incrementalFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as { query?: string; variables?: Record<string, unknown> };
  if (body.query?.includes('PoolTransactions')) {
    incrementalQueries += 1;
    assert.equal(body.variables?.afterCheckpoint, latestCheckpoint);
    assert.equal(body.variables?.beforeCheckpoint, latestCheckpoint + 2);
  }
  return graphqlResponse(body, latestCheckpoint + 1, []);
};
const second = await refreshTreeActivityIndex(first.index, {
  fetchImpl: incrementalFetch as typeof fetch,
  now: () => now + 60_000,
  wallets: [walletA, walletB],
  sources: [{ poolId: SUIDEX_V2_TREE_POOL_ID, protocol: 'suidex-v2', venue: 'suidex-v2' }],
  sleepImpl: async () => {},
});
assert.equal(second.outcome, 'complete');
assert.ok(second.index);
assert.equal(incrementalQueries, 1);
assert.equal(Object.keys(second.index.transactions).length, Object.keys(first.index.transactions).length);
assert.equal(second.index.indexedThroughCheckpoint, String(latestCheckpoint + 1));

assert.equal(typeof SUIDEX_V3_TREE_POOL_ID, 'string');
console.log('TREE activity index: PASS (Sui-native checkpoints, exact TREE deltas, swap classification, exclusions, resume state, and incremental updates)');
