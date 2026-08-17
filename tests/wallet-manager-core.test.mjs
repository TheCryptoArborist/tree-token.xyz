import assert from 'node:assert/strict';
import {
  compatibleSuiWallets,
  dedupeWallets,
  getSuiPersonalMessageFeature,
  getSuiSignFeature,
  isSlushWallet,
  isSlushWebWallet,
  pickSuiAccount,
  safeWalletIcon,
  shortenSuiAddress,
  slushBrowseUrl,
  walletKey,
} from '../scripts/wallet-manager-core.js';

const connect = { version: '1.0.0', connect: async () => ({ accounts: [] }) };
const sign = { version: '1.0.0', signAndExecuteTransaction: async () => ({}) };
const account = (address, chains = ['sui:mainnet']) => ({ address, chains });
const wallet = (name, options = {}) => ({
  id: options.id,
  name,
  version: options.version || '1.0.0',
  icon: options.icon,
  accounts: options.accounts || [],
  features: options.features || {
    'standard:connect': connect,
    'sui:signAndExecuteTransaction': sign,
  },
});

const slushWeb = wallet('Slush', { id: 'slush-web' });
const slushExtension = wallet('Slush', { id: 'slush-extension', accounts: [account('0x' + '1'.repeat(64))] });
const phantom = wallet('Phantom', { id: 'phantom-sui', accounts: [account('0x' + '2'.repeat(64))] });
const nonSui = wallet('Other Chain', { features: { 'standard:connect': connect } });

assert.equal(getSuiSignFeature(slushWeb), 'sui:signAndExecuteTransaction');
assert.equal(getSuiSignFeature(nonSui), null);
assert.equal(getSuiPersonalMessageFeature({ features: { 'sui:signPersonalMessage': {} } }), 'sui:signPersonalMessage');
assert.equal(getSuiPersonalMessageFeature({ features: { 'sui:signMessage': {} } }), 'sui:signMessage');
assert.equal(getSuiPersonalMessageFeature(nonSui), null);
assert.equal(isSlushWallet(slushWeb), true);
assert.equal(isSlushWebWallet({ id: 'com.mystenlabs.suiwallet.web', name: 'Slush' }), true);
assert.equal(isSlushWebWallet(slushExtension), false);
assert.equal(isSlushWallet(phantom), false);
assert.equal(walletKey(slushExtension), 'slush-extension');

const deduped = dedupeWallets([slushWeb, phantom, slushExtension]);
assert.equal(deduped.length, 2);
assert.equal(deduped.find((candidate) => candidate.name === 'Slush')?.id, 'slush-extension');

const compatible = compatibleSuiWallets([phantom, nonSui, slushWeb, slushExtension]);
assert.deepEqual(compatible.map((candidate) => candidate.name), ['Slush', 'Phantom']);
assert.equal(compatible.some((candidate) => candidate.name === 'Other Chain'), false);

const preferred = compatibleSuiWallets([slushExtension, phantom], 'phantom-sui');
assert.equal(preferred[0].name, 'Phantom');
assert.equal(preferred.some((candidate) => candidate.name === 'Slush'), true);

const testnet = account('0x' + '3'.repeat(64), ['sui:testnet']);
const mainnet = account('0x' + '4'.repeat(64), ['sui:mainnet']);
assert.equal(pickSuiAccount([testnet, mainnet])?.address, mainnet.address);
assert.equal(pickSuiAccount([mainnet, testnet], testnet.address)?.address, testnet.address);
assert.equal(pickSuiAccount([], null), null);

assert.equal(safeWalletIcon('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
assert.equal(safeWalletIcon('https://example.com/icon.png'), null);
assert.equal(shortenSuiAddress('0x1234567890abcdef', 6, 4), '0x1234…cdef');
assert.equal(slushBrowseUrl('https://tree-token.xyz/dapp/#leaderboard'), 'https://my.slush.app/browse/https://tree-token.xyz/dapp/');

console.log('TREE wallet manager core: PASS (Slush + Phantom selection, deduplication, Sui filtering, account preference, safe icons, and Slush mobile link)');
