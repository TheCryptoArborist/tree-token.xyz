import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the shipped module through the same Wallet Standard registration and
// change events used by browser wallets. These fixtures never contact a chain.
const moduleURL = new URL('../production/arcade-organization-static/runtime/assets/arcade/arcade-growth-wallet.js', import.meta.url);
const A = '0x' + 'a'.repeat(64);
const B = '0x' + 'b'.repeat(64);
const C = '0x' + 'c'.repeat(64);
const account = (address, extra = {}) => ({ address, chains: ['sui:mainnet'], features: ['sui:signPersonalMessage'], ...extra });
let imports = 0;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function mockWallet({ name = 'Test Slush', accounts = [account(A), account(B)], returnedAccounts, connect, sign, disconnect } = {}) {
  let shared = accounts;
  const listeners = new Set();
  const calls = { connect: 0, disconnect: 0, signed: [], transactions: 0 };
  const wallet = {
    version: '1.0.0', name, icon: 'data:image/png;base64,', chains: ['sui:mainnet'],
    get accounts() { return shared; },
    features: {
      'standard:connect': { version: '1.0.0', async connect(options) { calls.connect++; return connect ? connect(options) : { accounts: returnedAccounts || shared }; } },
      'standard:disconnect': { version: '1.0.0', async disconnect() { calls.disconnect++; return disconnect?.(); } },
      'standard:events': { version: '1.0.0', on(event, handler) { assert.equal(event, 'change'); listeners.add(handler); return () => listeners.delete(handler); } },
      'sui:signPersonalMessage': { version: '1.0.0', async signPersonalMessage(input) { calls.signed.push(input.account.address); return sign ? sign(input) : { signature: 'synthetic-message-signature' }; } },
      'sui:signTransaction': { version: '2.0.0', signTransaction() { calls.transactions++; throw Error('No transaction is authorized by this test.'); } },
      'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction() { calls.transactions++; throw Error('No transaction is authorized by this test.'); } },
    },
  };
  return { wallet, calls, change(next) { shared = next; for (const listener of [...listeners]) listener({ accounts: next }); } };
}

async function fixture(options) {
  const mock = mockWallet(options);
  const previousWindow = globalThis.window;
  const view = new EventTarget();
  let unregister;
  view.addEventListener('wallet-standard:app-ready', event => { unregister = event.detail.register(mock.wallet); });
  globalThis.window = view;
  const bridge = await import(`${moduleURL.href}?accounts-test=${++imports}`);
  return { ...mock, bridge, unregister: () => unregister(), close() { unregister?.(); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; } };
}

test('a single-account provider keeps the existing connect and message-only sign-in behavior', async () => {
  const x = await fixture({ accounts: [account(A, { label: 'My account' })] });
  try {
    assert.deepEqual(x.bridge.getAvailableAccounts(), []);
    assert.equal((await x.bridge.connectWallet('Test Slush')).address, A);
    assert.deepEqual(x.bridge.getAvailableAccounts(), [{ address: A, label: 'My account' }]);
    assert.equal(x.calls.signed.length, 0, 'Connecting never signs a message by itself.');
    await x.bridge.signPersonalMessage({ message: new TextEncoder().encode('Synthetic login') });
    assert.deepEqual(x.calls.signed, [A]);
    assert.equal(x.calls.transactions, 0);
  } finally { x.close(); }
});

test('two accounts from one provider can be selected explicitly, including accounts from a fresh connect result', async () => {
  const x = await fixture({ accounts: [account(A)], returnedAccounts: [account(A), account(B, { label: 'Arcade wallet' })] });
  try {
    await x.bridge.connectWallet('Test Slush');
    assert.deepEqual(x.bridge.getAvailableAccounts('Test Slush'), [{ address: A }, { address: B, label: 'Arcade wallet' }]);
    const selected = x.bridge.selectAccount({ walletId: 'Test Slush', address: B });
    assert.equal(selected.address, B);
    assert.equal(selected.walletId, 'Test Slush');
    assert.equal(x.calls.connect, 1, 'Choosing an already shared account does not reconnect.');
    assert.equal(x.calls.signed.length, 0, 'Choosing an account does not sign a message.');
    await x.bridge.signPersonalMessage({ message: new TextEncoder().encode('Synthetic login') });
    assert.deepEqual(x.calls.signed, [B]);
    assert.equal(x.calls.transactions, 0);
  } finally { x.close(); }
});

test('the picker exposes only unique authorized mainnet accounts and rejects unshared addresses or providers', async () => {
  const x = await fixture({ accounts: [account(A), account(A.toUpperCase().replace('0X', '0x')), account(B, { chains: ['sui:testnet'] })] });
  try {
    await x.bridge.connectWallet('Test Slush');
    assert.deepEqual(x.bridge.getAvailableAccounts(), [{ address: A }]);
    assert.deepEqual(x.bridge.getAvailableAccounts('Another wallet'), []);
    assert.throws(() => x.bridge.selectAccount({ walletId: 'Test Slush', address: C }), /not shared/);
    assert.throws(() => x.bridge.selectAccount({ walletId: 'Another wallet', address: A }), /Connect this Sui wallet/);
    assert.throws(() => x.bridge.selectAccount({ walletId: 'Test Slush', address: 'invalid' }), /Connect this Sui wallet/);
    assert.equal(x.bridge.getWalletState().address, A);
  } finally { x.close(); }
});

test('authorization changes refresh the account list and remove access to revoked addresses', async () => {
  const x = await fixture();
  try {
    await x.bridge.connectWallet('Test Slush');
    x.change([account(A), account(C)]);
    assert.equal(x.bridge.getWalletState().address, A, 'The current authorized account is retained.');
    assert.deepEqual(x.bridge.getAvailableAccounts().map(item => item.address), [A, C]);
    assert.throws(() => x.bridge.selectAccount({ address: B }), /not shared/);
    x.bridge.selectAccount({ address: C });
    x.change([account(A)]);
    assert.equal(x.bridge.getWalletState().connected, false);
    assert.deepEqual(x.bridge.getAvailableAccounts('Test Slush'), []);
    await assert.rejects(x.bridge.signPersonalMessage({ message: new Uint8Array([1]) }), /Connect your Sui wallet first/);
  } finally { x.close(); }
});

test('an old signature is rejected when its selected account changes before the wallet responds', async () => {
  const pending = deferred();
  const x = await fixture({ sign: () => pending.promise });
  try {
    await x.bridge.connectWallet('Test Slush');
    const signature = x.bridge.signPersonalMessage({ message: new Uint8Array([1]) });
    x.bridge.selectAccount({ address: B });
    pending.resolve({ signature: 'synthetic-old-account-signature' });
    await assert.rejects(signature, /wallet changed during verification/);
    assert.equal(x.bridge.getWalletState().address, B);
    assert.equal(x.calls.transactions, 0);
  } finally { x.close(); }
});

test('disconnect clears the local account immediately even when the provider refuses notification', async () => {
  const pending = deferred();
  const x = await fixture({ sign: () => pending.promise, disconnect: () => { throw Error('Provider disconnect unavailable'); } });
  try {
    await x.bridge.connectWallet('Test Slush');
    const signature = x.bridge.signPersonalMessage({ message: new Uint8Array([1]) });
    const disconnect = x.bridge.disconnectWallet();
    assert.equal(x.bridge.getWalletState().connected, false);
    assert.deepEqual(x.bridge.getAvailableAccounts('Test Slush'), []);
    await assert.rejects(disconnect, /Provider disconnect unavailable/);
    pending.resolve({ signature: 'synthetic-old-signature' });
    await assert.rejects(signature, /wallet changed during verification/);
    assert.equal(x.calls.transactions, 0);
  } finally { x.close(); }
});

test('a connect response arriving after disconnect cannot restore the previous selection', async () => {
  const pending = deferred();
  const x = await fixture({ connect: () => pending.promise });
  try {
    const connecting = x.bridge.connectWallet('Test Slush');
    await x.bridge.disconnectWallet();
    pending.resolve({ accounts: [account(A), account(B)] });
    await assert.rejects(connecting, /wallet changed while connecting/);
    assert.equal(x.bridge.getWalletState().connected, false);
    assert.deepEqual(x.bridge.getAvailableAccounts('Test Slush'), []);
  } finally { x.close(); }
});

test('silent restoration retains all authorized accounts while restoring only the saved address', async () => {
  const x = await fixture();
  try {
    const state = await x.bridge.restoreWallet({ id: 'Test Slush', address: B });
    assert.equal(state.address, B);
    assert.deepEqual(x.bridge.getAvailableAccounts().map(item => item.address), [A, B]);
    assert.equal(x.calls.signed.length, 0);
    assert.equal(x.calls.transactions, 0);
    x.unregister();
    assert.equal(x.bridge.getWalletState().connected, false);
    assert.deepEqual(x.bridge.getAvailableAccounts(), []);
  } finally { x.close(); }
});
