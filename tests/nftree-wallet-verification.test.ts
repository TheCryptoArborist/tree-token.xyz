import assert from 'node:assert/strict';
import { countNftreesForWallet, nftreeOwnerRoots, normalizeSuiAddress } from '../netlify/lib/nftree-wallet-verification.ts';

const id = (character: string) => `0x${character.repeat(64)}`;
const wallet = id('a');
const kiosk = id('b');
const other = id('c');
const nodes = [
  { address: id('1'), owner: { __typename: 'AddressOwner', address: { address: wallet } } },
  { address: id('2'), owner: { __typename: 'ObjectOwner', address: { address: kiosk } } },
  { address: id('3'), owner: { __typename: 'AddressOwner', address: { address: other } } },
];

assert.equal(normalizeSuiAddress('0xA'), `0x${'0'.repeat(63)}a`);
assert.equal(normalizeSuiAddress('not-an-address'), null);
assert.deepEqual(nftreeOwnerRoots(nodes), [kiosk]);
assert.deepEqual(countNftreesForWallet(nodes, new Map([[kiosk, wallet]]), wallet), {
  nftreeCount: 2, directCount: 1, objectOwnedCount: 1, objectsScanned: 3,
});
assert.throws(() => countNftreesForWallet(nodes, new Map(), wallet), /unresolved/);
assert.throws(() => nftreeOwnerRoots([...nodes, nodes[0]]), /identities/);

console.log('NFTree wallet verification: PASS (canonical address normalization, direct ownership, object-owned Kiosk resolution, duplicate rejection, and fail-closed unresolved owners)');
