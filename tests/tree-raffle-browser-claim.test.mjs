import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTreeRaffleBrowserClaim } from '../dapp/raffle-transaction-core.js';

class Transaction {
  calls = [];
  object(value) { return { object: value }; }
  pure = { vector: (type, value) => ({ type, value }) };
  moveCall(call) { this.calls.push(call); }
}

test('browser claim builder creates only the typed prize claim call', () => {
  const tx = buildTreeRaffleBrowserClaim(Transaction, {
    packageId: '0xab', poolId: '0xcd', onchainDrawId: 'daily:2026-08-20:main', tokenType: '0x2::sui::SUI',
  });
  assert.equal(tx.calls.length, 1);
  assert.equal(tx.calls[0].target, '0xab::prize_pool::claim');
  assert.deepEqual(tx.calls[0].typeArguments, ['0x2::sui::SUI']);
  assert.equal(new TextDecoder().decode(Uint8Array.from(tx.calls[0].arguments[1].value)), 'daily:2026-08-20:main');
});

test('browser claim builder rejects missing contract and token identities', () => {
  assert.throws(() => buildTreeRaffleBrowserClaim(Transaction, { packageId: '', poolId: '0xcd', onchainDrawId: 'draw', tokenType: '0x2::sui::SUI' }));
  assert.throws(() => buildTreeRaffleBrowserClaim(Transaction, { packageId: '0xab', poolId: '0xcd', onchainDrawId: 'draw', tokenType: 'SUI' }));
});
