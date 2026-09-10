import assert from 'node:assert/strict';
import {
  NFTREE_SALE_POOL_IDS,
  calculateNftreeOverview,
} from '../netlify/lib/tree-nftree-overview.ts';

const id = (character: string) => `0x${character.repeat(64)}`;
const holderNodes = [
  { address: id('1'), owner: { __typename: 'AddressOwner', address: { address: id('a') } } },
  { address: id('2'), owner: { __typename: 'AddressOwner', address: { address: id('a') } } },
  { address: id('3'), owner: { __typename: 'ObjectOwner', address: { address: id('b') } } },
];
const salePools = NFTREE_SALE_POOL_IDS.map((poolId, index) => ({
  poolId,
  nfts: [{ id: id(String(index + 4)) }],
}));

const overview = calculateNftreeOverview({
  mintConfig: { mint_price_mist: '25000000000' },
  holderNodes,
  holderScanReachedEnd: true,
  salePools,
});
assert.equal(overview.mintPriceSui, 25);
assert.equal(overview.totalLoaded, 6);
assert.equal(overview.holderOwned, 3);
assert.equal(overview.salePool, 3);
assert.equal(overview.directHolderOwned, 2);
assert.equal(overview.marketplaceOrCustody, 1);
assert.equal(overview.directHolderWallets, 1);
assert.equal(overview.reconciliation.loadedEqualsHolderPlusPool, true);

assert.throws(() => calculateNftreeOverview({
  mintConfig: { mint_price_mist: '25000000000' }, holderNodes, holderScanReachedEnd: false, salePools,
}), /final page/);

assert.throws(() => calculateNftreeOverview({
  mintConfig: { mint_price_mist: '25000000000' },
  holderNodes,
  holderScanReachedEnd: true,
  salePools: salePools.map((pool, index) => index === 2 ? { ...pool, nfts: [{ id: id('4') }] } : pool),
}), /more than one sale pool/);

console.log('NFTree overview: PASS (live supply, ownership, pool, wallet, and reconciliation rules)');
