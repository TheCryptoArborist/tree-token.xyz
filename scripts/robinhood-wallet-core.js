export const ROBINHOOD_TESTNET = Object.freeze({
  chainId: 46630,
  chainIdHex: '0xb626',
  chainName: 'Robinhood Chain Testnet',
  rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
  nativeCurrency: Object.freeze({ name: 'Ether', symbol: 'ETH', decimals: 18 }),
});

export const SAFE_WALLET_METHODS = Object.freeze([
  'eth_accounts',
  'eth_chainId',
  'eth_requestAccounts',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
]);

export function normalizeChainId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value !== 'string' || !/^(0x[0-9a-f]+|[0-9]+)$/i.test(value)) return null;
  const parsed = Number.parseInt(value, value.toLowerCase().startsWith('0x') ? 16 : 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function isRobinhoodTestnet(value) {
  return normalizeChainId(value) === ROBINHOOD_TESTNET.chainId;
}

export function formatEvmAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{40}$/i.test(value)) return null;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function getWalletErrorMessage(error) {
  const code = Number(error?.code);
  if (code === 4001) return 'The wallet request was declined. Nothing changed.';
  if (code === -32002) return 'MetaMask already has a request waiting for your response.';
  return 'MetaMask could not complete the request. Check the wallet and try again.';
}
