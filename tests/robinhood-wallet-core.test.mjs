import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BNB_TESTNET,
  ROBINHOOD_TESTNET,
  SAFE_WALLET_METHODS,
  formatEvmAddress,
  getSupportedNetwork,
  getWalletErrorMessage,
  isRobinhoodTestnet,
  normalizeChainId,
} from '../scripts/robinhood-wallet-core.js';

test('uses Robinhood official testnet network parameters', () => {
  assert.deepEqual(ROBINHOOD_TESTNET, {
    key: 'robinhood',
    chainId: 46630,
    chainIdHex: '0xb626',
    chainName: 'Robinhood Chain Testnet',
    rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
    explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  });
});

test('uses BNB official testnet network parameters', () => {
  assert.deepEqual(BNB_TESTNET, {
    key: 'bnb',
    chainId: 97,
    chainIdHex: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://bsc-testnet-dataseed.bnbchain.org',
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: { name: 'Testnet BNB', symbol: 'tBNB', decimals: 18 },
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
  assert.equal(getSupportedNetwork('0x61'), BNB_TESTNET);
  assert.equal(getSupportedNetwork('0xb626'), ROBINHOOD_TESTNET);
  assert.equal(getSupportedNetwork('0x1'), null);
});

test('displays only valid shortened EVM addresses', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  assert.equal(formatEvmAddress(address), '0x1234…5678');
  assert.equal(formatEvmAddress('0x1234'), null);
});

test('wallet method allowlist contains only connection, network, and explicit message-signing methods', () => {
  assert.deepEqual(SAFE_WALLET_METHODS, [
    'eth_accounts',
    'eth_chainId',
    'eth_requestAccounts',
    'personal_sign',
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
