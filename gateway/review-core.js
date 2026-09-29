import { SOURCES, SUI, amountToRaw } from './options.js';
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
export async function sourceBalance(request, address, chain) {
  const expected = EVM_CHAINS[chain];
  if (!expected || !isEvmAddress(address)) throw Error('Invalid source wallet.');
  const verify = async () => {
    const [accounts, network] = await Promise.all([request('eth_accounts'), request('eth_chainId')]);
    if (accounts?.[0]?.toLowerCase() !== address.toLowerCase() || BigInt(network) !== BigInt(expected)) throw Error('Wallet changed.');
  };
  await verify();
  const raw = await request('eth_getBalance', [address, 'latest']);
  if (typeof raw !== 'string' || !/^0x[0-9a-f]+$/i.test(raw)) throw Error('Invalid balance.');
  await verify();
  return raw;
}
// A deliberately small connection adapter: it cannot request signatures or send transactions.
export function readOnlyEvm(provider) {
  const allowed = new Set(['eth_requestAccounts', 'eth_accounts', 'eth_chainId', 'eth_getBalance', 'wallet_switchEthereumChain']);
  return async (method, params = []) => {
    if (!allowed.has(method)) throw Error('Transactions and signatures are disabled in this preview.');
    return provider.request({ method, params });
  };
}

export function suiReviewAddress(state) {
  return state?.connected === true && typeof state.address === 'string' && /^0x[0-9a-f]{64}$/i.test(state.address) && !/^0x0+$/i.test(state.address) ? state.address.toLowerCase() : '';
}
export function commandCenterHost(win) {
  try {
    const host = win.parent;
    return host !== win && host.location.origin === win.location.origin && /^\/dapp\/?$/.test(host.location.pathname) && ['#tree-gateway-dock iframe', '#tree-gateway-bridge iframe'].some(selector => host.document.querySelector(selector) === win.frameElement && win.frameElement) ? host : null;
  } catch { return null; }
}

export function mayanReviewAmount(chain, asset, amount, data) {
  if (data?.settlement !== SUI) return null;
  let raw;
  try {
    if (['bsc', 'robinhood'].includes(chain)) raw = data.relay?.minimumRaw;
    else if (chain === 'base' && asset === 'USDC') raw = amountToRaw(amount, 6);
    if (typeof raw !== 'string' || !/^[1-9]\d{0,12}$/.test(raw) || BigInt(raw) > 1000000000000n) return null;
    return raw;
  } catch { return null; }
}
