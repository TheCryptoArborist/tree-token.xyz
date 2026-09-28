import { SOURCES, amountToRaw } from './options.js';
export const EVM_CHAINS = { base: '0x2105', ethereum: '0x1', bsc: '0x38', robinhood: '0x1237' };
export const isEvmAddress = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
export function routeDraft(value) {
  if (!value || !Object.hasOwn(SOURCES, value.chain) || !Object.hasOwn(SOURCES[value.chain], value.asset) || !['TREE', 'SUI', 'USDC'].includes(value.destination) || !['SUI', 'USDC'].includes(value.settlement)) throw Error('Saved route is not supported.');
  amountToRaw(value.amount, SOURCES[value.chain][value.asset][1]);
  return { version: 1, chain: value.chain, asset: value.asset, amount: value.amount, destination: value.destination, settlement: value.settlement };
}
export function readDraft(text) {
  const value = JSON.parse(text);
  if (value.version !== 1) throw Error('Saved route version is not supported.');
  return routeDraft(value);
}
export function formatNative(raw) {
  const n = BigInt(raw);
  return `${n / 10n ** 18n}.${(n % 10n ** 18n).toString().padStart(18, '0').slice(0, 8)}`;
}
// A deliberately small connection adapter: it cannot request signatures or send transactions.
export function readOnlyEvm(provider) {
  const allowed = new Set(['eth_requestAccounts', 'eth_accounts', 'eth_chainId', 'eth_getBalance', 'wallet_switchEthereumChain']);
  return async (method, params = []) => {
    if (!allowed.has(method)) throw Error('Transactions and signatures are disabled in this preview.');
    return provider.request({ method, params });
  };
}
