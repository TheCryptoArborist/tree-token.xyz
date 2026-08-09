import assert from 'node:assert/strict';
import {
  BURNED_BADGE_THRESHOLD_RAW,
  SUI_ZERO_ADDRESS,
  scanTreeBurnContributions,
} from '../netlify/lib/tree-burn-badge-provider.ts';
import { TREE_COIN_TYPE } from '../netlify/lib/leaderboard-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
let request = 0;
const fetchImpl = async () => {
  request += 1;
  return new Response(JSON.stringify({ data: { transactions: {
    pageInfo: { hasNextPage: request === 1, endCursor: request === 1 ? 'next' : null },
    nodes: request === 1 ? [{
      digest: 'burn-a', sender: { address: walletA }, effects: { balanceChanges: { nodes: [
        { owner: { address: SUI_ZERO_ADDRESS }, coinType: { repr: TREE_COIN_TYPE }, amount: BURNED_BADGE_THRESHOLD_RAW.toString() },
        { owner: { address: walletA }, coinType: { repr: TREE_COIN_TYPE }, amount: `-${BURNED_BADGE_THRESHOLD_RAW}` },
      ] } },
    }] : [{
      digest: 'burn-b', sender: { address: walletB }, effects: { balanceChanges: { nodes: [
        { owner: { address: SUI_ZERO_ADDRESS }, coinType: { repr: TREE_COIN_TYPE }, amount: '1000000' },
      ] } },
    }],
  } } }), { status: 200 });
};
const result = await scanTreeBurnContributions([walletA, walletB], { fetchImpl: fetchImpl as typeof fetch, now: () => 1_800_000_000_000 });
assert.equal(result.outcome, 'complete');
assert.equal(result.wallets[walletA].qualifies, true);
assert.equal(result.wallets[walletA].burnedTreeRaw, BURNED_BADGE_THRESHOLD_RAW.toString());
assert.equal(result.wallets[walletB].qualifies, false);
assert.equal(result.coverage.pagesScanned, 2);
console.log('TREE burn badge provider: PASS');
