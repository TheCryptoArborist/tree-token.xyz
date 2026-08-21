import assert from 'node:assert/strict';
import { getNightlySuiWallet, isNightlySuiWallet } from '../scripts/nightly-sui-provider.js';

const nightly = {
  id: 'app.nightly',
  name: 'Nightly',
  accounts: [],
  features: {
    'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: [] }) },
    'sui:signAndExecuteTransactionBlock': { version: '1.0.0', signAndExecuteTransactionBlock: async () => ({}) },
  },
};

assert.equal(getNightlySuiWallet({ nightly: { sui: { standardWallet: nightly } } }), nightly);
assert.equal(getNightlySuiWallet({ nightly: { sui: nightly } }), nightly);
assert.equal(getNightlySuiWallet({ nightly: { sui: { standardWallet: { features: {} } } } }), null);
assert.equal(isNightlySuiWallet(nightly), true);
assert.equal(isNightlySuiWallet({ id: 'other-wallet', name: 'Other' }), false);

console.log('Nightly Sui provider: PASS (Wallet Standard detection, direct injected fallback, and identity)');
