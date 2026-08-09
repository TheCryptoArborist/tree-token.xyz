import assert from 'node:assert/strict';
import {
  refreshTreeActivityIndex,
  summarizeTreeActivity,
  validateTreeActivityIndex,
} from '../netlify/lib/tree-activity-index.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
const pool = `0x${'1'.repeat(64)}`;
const sui = '0x2::sui::SUI';
const now = 1_800_000_000_000;
const events = [];
for (let index = 0; index < 10; index += 1) {
  events.push({
    id: index + 1,
    timestamp: now - 1_000_000 + index,
    action: 'trade',
    pool_address: pool,
    coin_a_type: sui,
    coin_b_type: TREE_COIN_TYPE,
    amount_a: 1,
    amount_b: 20_000,
    a_to_b: true,
    tx_digest: `buy-${index}`,
    sender: walletA,
  });
}
events.push({
  id: 20,
  timestamp: now - 500_000,
  action: 'trade',
  pool_address: pool,
  coin_a_type: TREE_COIN_TYPE,
  coin_b_type: sui,
  amount_a: 150_000,
  amount_b: 1,
  a_to_b: true,
  tx_digest: 'sell-b',
  sender: walletB,
});

const fetchImpl = async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/coin/liquidity')) {
    return new Response(JSON.stringify({
      code: 200,
      data: {
        dex_liquidity: [{ pool_id: pool, protocol: 'fixture-cpmm', coin_a: sui, coin_b: TREE_COIN_TYPE }],
      },
    }), { status: 200 });
  }
  if (url.pathname.endsWith('/pool/event/all')) {
    assert.equal(url.searchParams.get('limit'), '50');
    return new Response(JSON.stringify({
      code: 200,
      data: events,
      pagination: { last_cursor: null, limit: 100 },
    }), { status: 200 });
  }
  return new Response('not found', { status: 404 });
};

let checkpoints = 0;
const first = await refreshTreeActivityIndex(null, {
  fetchImpl: fetchImpl as typeof fetch,
  getEnv: (name) => name === 'NOODLES_API_KEY' ? 'fixture' : undefined,
  now: () => now,
  onPoolComplete: () => { checkpoints += 1; },
});
assert.equal(first.outcome, 'complete');
assert.ok(first.index);
assert.equal(validateTreeActivityIndex(first.index), true);
assert.equal(checkpoints, 1);
assert.equal(first.coverage.poolsCompleted, 1);
const summary = summarizeTreeActivity(first.index, [walletA, walletB]);
assert.equal(summary[walletA].buyCount, 10);
assert.equal(summary[walletA].sellCount, 0);
assert.equal(summary[walletA].buyTreeRaw, '200000000000');
assert.equal(summary[walletB].sellCount, 1);
assert.equal(summary[walletB].sellTreeRaw, '150000000000');

let eventRequests = 0;
const incrementalFetch = async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/coin/liquidity')) return fetchImpl(input);
  if (url.pathname.endsWith('/pool/event/all')) {
    eventRequests += 1;
    assert.equal(Number(url.searchParams.get('from')), now + 1);
    return new Response(JSON.stringify({ code: 200, data: [], pagination: { last_cursor: null, limit: 100 } }), { status: 200 });
  }
  return new Response('not found', { status: 404 });
};
const second = await refreshTreeActivityIndex(first.index, {
  fetchImpl: incrementalFetch as typeof fetch,
  getEnv: (name) => name === 'NOODLES_API_KEY' ? 'fixture' : undefined,
  now: () => now + 60_000,
});
assert.equal(second.outcome, 'complete');
assert.equal(eventRequests, 1);
assert.equal(Object.keys(second.index!.transactions).length, Object.keys(first.index.transactions).length);
console.log('TREE activity index: PASS (pool discovery, full window, checkpoints, and incremental cursor)');
