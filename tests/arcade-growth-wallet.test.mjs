import assert from 'node:assert/strict';
import { createGrowthWalletClient } from '../vendor/arcade-growth-wallet/wallet-core.mjs';
const address = suffix => '0x' + suffix.repeat(64);
function setup({ chains = ['sui:mainnet'], accounts = [] } = {}) {
  const events = new Map();
  const account = { address: address('1'), chains, features: ['sui:signPersonalMessage'] };
  const state = { connectCalls: [], signCalls: [], disconnected: 0, signed: { signature: 'test-signature' } };
  let accountListener;
  const wallet = { name: 'Test Sui Wallet', chains, accounts,
    features: {
      'standard:connect': { connect: async options => { state.connectCalls.push(options); return { accounts: [account] }; } },
      'standard:disconnect': { disconnect: async () => { state.disconnected++; } },
      'standard:events': { on: (_name, callback) => { accountListener = callback; return () => { accountListener = null; }; } },
      'sui:signPersonalMessage': { signPersonalMessage: async value => { state.signCalls.push(value); return state.signed; } },
      'sui:signAndExecuteTransaction': { signAndExecuteTransaction: () => { throw Error('Transactions must never be called'); } },
    } };
  let available = [wallet];
  const registry = { get: () => available, on: (type, listener) => { events.set(type, listener); return () => events.delete(type); } };
  return { client: createGrowthWalletClient(registry), wallet, account, state,
    changeAccounts: accounts => { wallet.accounts = accounts; accountListener?.({ accounts }); },
    remove: () => { available = []; events.get('unregister')?.(); } };
}
let passed = 0;
async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
await check('initial discovery never connects or signs', async () => {
  const { client, state } = setup(); assert.equal(client.getAvailableWallets().length, 1);
  assert.equal(client.getWalletState().connected, false); assert.equal(state.connectCalls.length, 0); assert.equal(state.signCalls.length, 0);
});
await check('explicit connect and personal-message signing preserve exact account/message', async () => {
  const { client, account, state } = setup(); await client.connectWallet('Test Sui Wallet');
  const message = new TextEncoder().encode('TREE Arcade verification');
  assert.equal((await client.signPersonalMessage({ message })).signature, 'test-signature');
  assert.equal(state.signCalls[0].account, account); assert.deepEqual(state.signCalls[0].message, message);
});
await check('generic Sui chain metadata is supported', async () => {
  const { client } = setup({ chains: ['sui'] }); assert.equal((await client.connectWallet('Test Sui Wallet')).address, address('1'));
});
await check('account switch invalidates the existing connection', async () => {
  const { client, changeAccounts } = setup(); await client.connectWallet('Test Sui Wallet');
  changeAccounts([{ address: address('2'), chains: ['sui:mainnet'] }]);
  assert.equal(client.getWalletState().connected, false); await assert.rejects(client.signPersonalMessage({ message: new Uint8Array([1]) }), /Connect/);
});
await check('account changes during a signature discard the result', async () => {
  const { client, state, changeAccounts } = setup(); await client.connectWallet('Test Sui Wallet');
  let resolveSignature; state.signed = new Promise(resolve => { resolveSignature = resolve; });
  const pending = client.signPersonalMessage({ message: new Uint8Array([1]) });
  changeAccounts([]); resolveSignature({ signature: 'stale' }); await assert.rejects(pending, /changed/);
});
await check('same-account refreshes during signing keep one valid signature', async () => {
  const { client, account, state, changeAccounts } = setup();
  await client.connectWallet('Test Sui Wallet');
  let resolveSignature;
  state.signed = new Promise(resolve => { resolveSignature = resolve; });
  const pending = client.signPersonalMessage({ message: new Uint8Array([1]) });
  // Wallets may re-announce authorized accounts as the approval UI opens/closes.
  changeAccounts([{ ...account }]);
  changeAccounts([{ ...account }]);
  resolveSignature({ signature: 'valid-same-account-signature' });
  assert.equal((await pending).signature, 'valid-same-account-signature');
  assert.equal(state.signCalls.length, 1);
  assert.equal(state.connectCalls.length, 1);
});
await check('silent restoration uses exact saved account and never signs', async () => {
  const { client, state } = setup(); const result = await client.restoreWallet({ id: 'Test Sui Wallet', address: address('1') });
  assert.equal(result.connected, true); assert.deepEqual(state.connectCalls, [{ silent: true }]); assert.equal(state.signCalls.length, 0);
});
await check('silent restore cannot substitute a different account', async () => {
  const { client } = setup(); assert.equal((await client.restoreWallet({ id: 'Test Sui Wallet', address: address('2') })).connected, false);
});
await check('removed wallet clears the session', async () => {
  const { client, remove } = setup(); await client.connectWallet('Test Sui Wallet'); remove(); assert.equal(client.getWalletState().connected, false);
});
await check('disconnect clears local state before awaiting wallet', async () => {
  const { client, state } = setup(); await client.connectWallet('Test Sui Wallet'); await client.disconnectWallet();
  assert.equal(state.disconnected, 1); assert.equal(client.getWalletState().connected, false);
});
await check('cancelled connection or signature never creates progress', async () => {
  const { client, wallet } = setup(); wallet.features['standard:connect'].connect = async () => { throw Error('Cancelled'); };
  await assert.rejects(client.connectWallet('Test Sui Wallet'), /Cancelled/); assert.equal(client.getWalletState().connected, false);
});
console.log(`${passed} Daily Growth wallet behavior checks passed.`);
