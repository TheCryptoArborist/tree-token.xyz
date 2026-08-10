import assert from 'node:assert/strict';
import {
  ACCUMULATOR_BADGE,
  DIAMOND_HANDS_BADGE,
  PAPER_HANDS_BADGE,
  scanTreeTradingActivity,
} from '../netlify/lib/tree-trading-activity-provider.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
const walletC = `0x${'c'.repeat(64)}`;
const pool = `0x${'1'.repeat(64)}`;
const SUI = '0x2::sui::SUI';
const events: unknown[] = [];
for (let index = 0; index < 10; index += 1) {
  events.push({ timestamp: 10 + index, action: 'trade', pool_address: pool, coin_a_type: SUI, coin_b_type: TREE_COIN_TYPE, amount_a: 1, amount_b: 20_000, a_to_b: true, tx_digest: `buy-${index}`, sender: walletA });
}
events.push({ timestamp: 30, action: 'trade', pool_address: pool, coin_a_type: TREE_COIN_TYPE, coin_b_type: SUI, amount_a: 150_000, amount_b: 1, a_to_b: true, tx_digest: 'sell-b', sender: walletB });
events.push({ timestamp: 31, action: 'trade', pool_address: pool, coin_a_type: SUI, coin_b_type: TREE_COIN_TYPE, amount_a: 1, amount_b: 10_000, a_to_b: true, tx_digest: 'buy-b', sender: walletB });
// Two events in one routed transaction net to one 25K buy.
events.push({ timestamp: 32, action: 'trade', pool_address: pool, coin_a_type: SUI, coin_b_type: TREE_COIN_TYPE, amount_a: 1, amount_b: 30_000, a_to_b: true, tx_digest: 'route-c', sender: walletC });
events.push({ timestamp: 32, action: 'trade', pool_address: pool, coin_a_type: TREE_COIN_TYPE, coin_b_type: SUI, amount_a: 5_000, amount_b: 1, a_to_b: true, tx_digest: 'route-c', sender: walletC });

const fetchImpl = async () => new Response(JSON.stringify({ code: 200, data: events, pagination: { last_cursor: null, limit: 500 } }), { status: 200 });
const result = await scanTreeTradingActivity([walletA, walletB, walletC], {
  fetchImpl: fetchImpl as typeof fetch,
  getEnv: (name) => name === 'NOODLES_API_KEY' ? 'fixture' : undefined,
  now: () => 1_800_000_000_000,
  poolIds: [pool],
});
assert.equal(result.outcome, 'complete');
assert.deepEqual(result.wallets[walletA].badges, [DIAMOND_HANDS_BADGE, ACCUMULATOR_BADGE]);
assert.deepEqual(result.wallets[walletB].badges, [PAPER_HANDS_BADGE]);
assert.deepEqual(result.wallets[walletC].badges, [DIAMOND_HANDS_BADGE]);
assert.equal(result.wallets[walletC].buyCount, 1);
assert.equal(result.wallets[walletC].buyTreeRaw, '25000000000');
const missing = await scanTreeTradingActivity([walletA], { getEnv: () => undefined });
assert.equal(missing.outcome, 'not-configured');
assert.equal(missing.wallets[walletA].badges.length, 0);
console.log('TREE trading activity provider: PASS');
