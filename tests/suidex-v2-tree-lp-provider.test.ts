import assert from 'node:assert/strict';
import {
  SUIDEX_V2_TREE_FARM_POSITION_TYPE,
  SUIDEX_V2_TREE_LP_COIN_TYPE,
  lpRawToTreeRaw,
  scanSuiDexV2TreeLp,
} from '../netlify/lib/suidex-v2-tree-lp-provider.ts';

const walletA = `0x${'a'.repeat(64)}`;
const walletB = `0x${'b'.repeat(64)}`;
const zero = `0x${'0'.repeat(64)}`;
let scans = 0;
const result = await scanSuiDexV2TreeLp({
  generatedAt: '2026-08-09T00:00:00.000Z',
  getPoolObject: async () => ({
    type: '0xbfac::pair::Pair<0x2::sui::SUI,0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>',
    json: { reserve1: '50000000', total_supply: '1000', lp_supply: { value: '1000' } },
  }),
  scanType: async (type) => {
    scans += 1;
    if (type === SUIDEX_V2_TREE_LP_COIN_TYPE) return {
      reachedEnd: true, pages: 1, nodes: [
        { address: `0x${'1'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletA } }, asMoveObject: { contents: { balanceField: { json: '100' }, json: { balance: '100' } } } },
        { address: `0x${'2'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletB } }, asMoveObject: { contents: { balanceField: { json: '50' }, json: { balance: '50' } } } },
        { address: `0x${'3'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: zero } }, asMoveObject: { contents: { balanceField: { json: '20' }, json: { balance: '20' } } } },
      ],
    };
    assert.equal(type, SUIDEX_V2_TREE_FARM_POSITION_TYPE);
    return {
      reachedEnd: true, pages: 1, nodes: [
        { address: `0x${'4'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletA } }, asMoveObject: { contents: { amountField: { json: '200' }, json: { amount: '200' } } } },
      ],
    };
  },
});
assert.equal(scans, 2);
assert.equal(result.outcome, 'complete');
assert.equal(result.positions.length, 2);
const a = result.positions.find((position) => position.wallet === walletA)!;
const b = result.positions.find((position) => position.wallet === walletB)!;
assert.equal(a.lpTreeRaw, '15000000');
assert.equal(b.lpTreeRaw, '2500000');
assert.equal(a.metadata?.directLpRaw, '100');
assert.equal(a.metadata?.stakedLpRaw, '200');
assert.equal(result.coverage.excludedObjects, 1);
assert.equal(result.coverage.directLpRaw, '150');
assert.equal(result.coverage.stakedLpRaw, '200');
assert.equal(lpRawToTreeRaw(300n, 50_000_000n, 1_000n), 15_000_000n);

const malformed = await scanSuiDexV2TreeLp({
  getPoolObject: async () => ({ type: '0xbfac::pair::Pair<0x2::sui::SUI,0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>', json: { reserve1: '500', total_supply: '100', lp_supply: { value: '100' } } }),
  scanType: async (type) => type === SUIDEX_V2_TREE_LP_COIN_TYPE
    ? { reachedEnd: true, pages: 1, nodes: [{ address: `0x${'5'.repeat(64)}`, owner: { __typename: 'AddressOwner', address: { address: walletA } }, asMoveObject: { contents: { balanceField: { json: 'bad' }, json: {} } } }] }
    : { reachedEnd: true, pages: 1, nodes: [] },
});
assert.equal(malformed.outcome, 'verification-incomplete');
assert.equal(malformed.positions.length, 0);
assert.equal(malformed.coverage.malformedBalances, 1);
console.log('SuiDex V2 TREE LP provider: PASS (direct + farm aggregation, exclusion, exact share, fail closed)');
