import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROBINHOOD_TESTNET,
  SAFE_WALLET_METHODS,
  formatEvmAddress,
  getWalletErrorMessage,
  isRobinhoodTestnet,
  normalizeChainId,
} from '../scripts/robinhood-wallet-core.js';

test('uses Robinhood official testnet network parameters', () => {
  assert.deepEqual(ROBINHOOD_TESTNET, {
    chainId: 46630,
    chainIdHex: '0xb626',
    chainName: 'Robinhood Chain Testnet',
    rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
    explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  });
});

test('normalizes decimal and hexadecimal chain IDs safely', () => {
  assert.equal(normalizeChainId('0xb626'), 46630);
  assert.equal(normalizeChainId('46630'), 46630);
  assert.equal(normalizeChainId(46630), 46630);
  assert.equal(normalizeChainId('46630oops'), null);
  assert.equal(normalizeChainId(-1), null);
  assert.equal(isRobinhoodTestnet('0xb626'), true);
  assert.equal(isRobinhoodTestnet('0x1'), false);
});

test('displays only valid shortened EVM addresses', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  assert.equal(formatEvmAddress(address), '0x1234…5678');
  assert.equal(formatEvmAddress('0x1234'), null);
});

test('wallet method allowlist contains only connection and network methods', () => {
  assert.deepEqual(SAFE_WALLET_METHODS, [
    'eth_accounts',
    'eth_chainId',
    'eth_requestAccounts',
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
  ]);
});

test('wallet errors are clear and do not expose provider details', () => {
  assert.match(getWalletErrorMessage({ code: 4001 }), /declined/);
  assert.match(getWalletErrorMessage({ code: -32002 }), /already has a request/);
  assert.match(getWalletErrorMessage(new Error('secret provider detail')), /could not complete/);
  assert.equal(getWalletErrorMessage(new Error('secret provider detail')).includes('secret'), false);
});
