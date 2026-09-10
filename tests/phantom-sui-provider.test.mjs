import assert from 'node:assert/strict';
import {
  PHANTOM_SUI_FEATURE,
  createPhantomSuiWallet,
  getPhantomSuiProvider,
  isPhantomSuiWallet,
  phantomSignature,
  phantomSuiAccountAddress,
  phantomTransactionBytes,
} from '../scripts/phantom-sui-provider.js';

const address = `0x${'a'.repeat(64)}`;
const eventListeners = new Map();
const provider = {
  isPhantom: true,
  requestAccount: async () => ({ publicKey: { toString: () => address } }),
  signTransaction: async () => ({ bytes: 'AA==', signature: 'transaction-signature' }),
  signMessage: async () => ({ signature: 'message-signature' }),
  on(event, listener) { eventListeners.set(event, listener); },
  off(event, listener) { if (eventListeners.get(event) === listener) eventListeners.delete(event); },
};

assert.equal(getPhantomSuiProvider({ phantom: { sui: provider } }), provider);
assert.equal(getPhantomSuiProvider({ phantom: { sui: { isPhantom: true } } }), null);
assert.equal(phantomSuiAccountAddress({ publicKey: { toString: () => address } }), address);
assert.equal(phantomSuiAccountAddress({ accounts: [{ address }] }), address);
assert.equal(phantomSignature('direct-signature'), 'direct-signature');
assert.equal(phantomSignature({ signedTransaction: { signature: 'nested-signature' } }), 'nested-signature');
assert.equal(phantomTransactionBytes({ transactionBlockBytes: 'AA==' }), 'AA==');

const wallet = createPhantomSuiWallet(provider);
assert.equal(wallet.id, 'phantom-sui-direct');
assert.equal(wallet.name, 'Phantom');
assert.equal(isPhantomSuiWallet(wallet), true);
assert.equal(wallet.features[PHANTOM_SUI_FEATURE].provider, provider);

const connected = await wallet.features['standard:connect'].connect();
assert.equal(connected.accounts[0].address, address);
assert.deepEqual(connected.accounts[0].chains, ['sui:mainnet']);
assert.equal(wallet.accounts[0].address, address);

let changedAddress = null;
const unsubscribe = wallet.features['standard:events'].on('change', ({ accounts }) => {
  changedAddress = accounts[0]?.address || null;
});
const replacement = `0x${'b'.repeat(64)}`;
eventListeners.get('accountChanged')?.({ address: replacement });
assert.equal(changedAddress, replacement);
assert.equal(wallet.accounts[0].address, replacement);
unsubscribe();
assert.equal(eventListeners.size, 0);

console.log('Phantom Sui provider adapter: PASS (provider detection, direct connection, signatures, bytes, and account changes)');
