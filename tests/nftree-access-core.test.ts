import assert from 'node:assert/strict';
import { NftreeAccessRegistry, decideNftreeAccess } from '../netlify/lib/nftree-access-core.ts';

const sui = (character: string) => `0x${character.repeat(64)}`;
const evm = `0x${'12'.repeat(20)}`;
const registry = new NftreeAccessRegistry();

assert.deepEqual(decideNftreeAccess('free_play', { treeAccountId: null }), {
  allowed: true, level: 'free', source: 'public', reason: 'free-play',
});
assert.equal(decideNftreeAccess('canopy_credits', { treeAccountId: 'tree-account-1' }).allowed, false);
assert.equal(decideNftreeAccess('ranked_leaderboard', {
  treeAccountId: 'tree-account-1', directSuiNftreeCount: 1,
}).source, 'direct_sui');
assert.equal(decideNftreeAccess('daily_canopy', {
  treeAccountId: 'tree-account-1', linkedSuiNftreeCount: 1,
}).source, 'linked_sui');
assert.equal(decideNftreeAccess('achievements', {
  treeAccountId: 'tree-account-1', directSuiNftreeCount: -1,
}).reason, 'invalid-evidence');

assert.throws(() => registry.allocate({
  assignmentId: 'assignment-0001', treeAccountId: 'tree-account-1', evmAddress: evm,
  evmChain: 'bnb', nftreeObjectId: sui('1'), vaultSuiAddress: sui('a'),
  paymentReference: 'bnb:payment-0001', paymentFinalized: false,
}), /finalized/);

const assignment = registry.allocate({
  assignmentId: 'assignment-0001', treeAccountId: 'tree-account-1', evmAddress: evm,
  evmChain: 'bnb', nftreeObjectId: sui('1'), vaultSuiAddress: sui('a'),
  paymentReference: 'bnb:payment-0001', paymentFinalized: true,
  assignedAt: '2026-09-09T00:00:00.000Z',
});
assert.equal(assignment.status, 'active');
assert.equal(assignment.evmAddress, evm);
assert.equal(decideNftreeAccess('canopy_credits', {
  treeAccountId: 'tree-account-1', vaultAssignment: assignment,
}).source, 'evm_vault');
assert.equal(decideNftreeAccess('canopy_credits', {
  treeAccountId: 'tree-account-2', vaultAssignment: assignment,
}).allowed, false);

assert.throws(() => registry.allocate({
  assignmentId: 'assignment-0002', treeAccountId: 'tree-account-2', evmAddress: evm,
  evmChain: 'robinhood', nftreeObjectId: sui('1'), vaultSuiAddress: sui('a'),
  paymentReference: 'robinhood:payment-0002', paymentFinalized: true,
}), /already assigned/);
assert.throws(() => registry.allocate({
  assignmentId: 'assignment-0003', treeAccountId: 'tree-account-2', evmAddress: evm,
  evmChain: 'robinhood', nftreeObjectId: sui('2'), vaultSuiAddress: sui('a'),
  paymentReference: 'bnb:payment-0001', paymentFinalized: true,
}), /Payment reference was already used/);

const pending = registry.requestClaim('assignment-0001', 'tree-account-1', sui('b'));
assert.equal(pending.status, 'claim_pending');
assert.equal(decideNftreeAccess('garden_battles', {
  treeAccountId: 'tree-account-1', vaultAssignment: pending,
}).allowed, true);
assert.throws(() => registry.finalizeClaim('assignment-0001', sui('c')), /did not match/);
const claimed = registry.finalizeClaim('assignment-0001', sui('b'));
assert.equal(claimed.status, 'claimed');
assert.equal(decideNftreeAccess('arboretum', {
  treeAccountId: 'tree-account-1', vaultAssignment: claimed,
}).allowed, false);
assert.throws(() => registry.revoke('assignment-0001'), /cannot be revoked/);

console.log('NFTree multichain access core: PASS (free play, direct/linked ownership, EVM-only vault access, replay protection, and claims)');
