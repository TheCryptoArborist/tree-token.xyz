import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import '@mysten/dapp-kit-core/web';
import { EVM_CHAINS, isEvmAddress, readOnlyEvm, formatNative } from '../review-core.js';

const $ = id => document.getElementById(id);
const kit = createDAppKit({ networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false, createClient: network => new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }) });
document.querySelector('mysten-dapp-kit-connect-button').instance = kit;
let sourceAddress = '', sourceChain = '', suiAddress = '', provider, request, generation = 0;
let removeListeners = () => {};
const providers = new Map();
function invalidate() {
  generation++;
  $('gas-status').textContent = 'Gas balance has not been checked. Exact transaction gas is not yet estimated.';
  window.dispatchEvent(new Event('gateway-wallet-change'));
}
function render() {
  const expected = EVM_CHAINS[$('chain').value];
  $('source-address').textContent = sourceAddress || 'Source wallet not connected.';
  $('sui-address').textContent = suiAddress || 'Sui receiving wallet not connected.';
  $('source-connect').disabled = !expected;
  $('source-network').textContent = !expected ? 'Solana wallet connection is not included in this wallet-review step. Solana quotes remain available.' : !sourceAddress ? 'Choose a browser wallet to connect.' : sourceChain === expected ? 'Wallet is on the selected source network.' : 'Wallet network differs from the selected source. Switch before reviewing balances.';
  $('source-switch').hidden = !sourceAddress || !expected || sourceChain === expected;
  $('gas-check').disabled = !sourceAddress || !expected || sourceChain !== expected;
  $('wallet-summary').textContent = sourceAddress && suiAddress && sourceChain === expected ? 'Both addresses selected. Verify them below. Transfers remain disabled.' : 'Connect both wallets to review their addresses. No signatures or transfers are requested.';
}
function disconnectSource() {
  removeListeners(); removeListeners = () => {};
  sourceAddress = ''; sourceChain = ''; request = undefined; provider = undefined;
  invalidate(); render();
}
function discover(event) {
  const item = event.detail;
  if (!item?.provider?.request || typeof item?.info?.uuid !== 'string' || providers.has(item.info.uuid)) return;
  providers.set(item.info.uuid, item.provider);
  $('source-wallet').append(new Option(String(item.info.name || 'Browser wallet').slice(0, 80), item.info.uuid));
}
window.addEventListener('eip6963:announceProvider', discover);
window.dispatchEvent(new Event('eip6963:requestProvider'));
if (window.ethereum?.request) { providers.set('legacy', window.ethereum); $('source-wallet').append(new Option('Default browser wallet', 'legacy')); }
$('source-wallet').addEventListener('change', disconnectSource);
$('source-connect').addEventListener('click', async () => {
  disconnectSource();
  provider = providers.get($('source-wallet').value);
  if (!provider) { $('source-network').textContent = 'No browser wallet detected. Open this preview in a browser with your wallet extension. WalletConnect is not enabled here.'; return; }
  request = readOnlyEvm(provider);
  const current = generation;
  const active = provider;
  $('source-connect').disabled = true;
  try {
    await request('eth_requestAccounts');
    if (current !== generation) return;
    const changed = () => disconnectSource();
    active.on?.('accountsChanged', changed); active.on?.('chainChanged', changed); active.on?.('disconnect', changed);
    removeListeners = () => { active.removeListener?.('accountsChanged', changed); active.removeListener?.('chainChanged', changed); active.removeListener?.('disconnect', changed); };
    const [accounts, chain] = await Promise.all([request('eth_accounts'), request('eth_chainId')]);
    if (current !== generation) return;
    if (!Array.isArray(accounts) || !isEvmAddress(accounts[0]) || !/^0x[0-9a-f]+$/i.test(chain)) throw Error('Wallet returned an invalid account or network.');
    sourceAddress = accounts[0]; sourceChain = `0x${BigInt(chain).toString(16)}`;
    invalidate(); render();
  } catch { if (current === generation) { disconnectSource(); $('source-network').textContent = 'Connection was declined or unavailable. Try again in your wallet browser.'; } }
  finally { $('source-connect').disabled = !EVM_CHAINS[$('chain').value]; }
});
$('source-disconnect').addEventListener('click', disconnectSource);
$('source-switch').addEventListener('click', async () => {
  if (!request || !Object.hasOwn(EVM_CHAINS, $('chain').value)) return;
  try { await request('wallet_switchEthereumChain', [{ chainId: EVM_CHAINS[$('chain').value] }]); disconnectSource(); $('source-network').textContent = 'Reconnect to verify the selected wallet network.'; }
  catch { $('source-network').textContent = 'Network switch was declined or unavailable. Select the network in your wallet, then reconnect.'; }
});
kit.stores.$connection.subscribe(connection => {
  const account = connection.account;
  suiAddress = account?.chains?.includes('sui:mainnet') ? account.address : '';
  invalidate(); render();
});
$('chain').addEventListener('change', () => { invalidate(); render(); });
$('gas-check').addEventListener('click', async () => {
  if (!request || !sourceAddress || sourceChain !== EVM_CHAINS[$('chain').value]) return;
  const current = ++generation, address = sourceAddress, activeRequest = request;
  $('gas-check').disabled = true;
  $('gas-status').textContent = 'Reading native gas balances…';
  try {
    const raw = await activeRequest('eth_getBalance', [address, 'latest']);
    if (!/^0x[0-9a-f]+$/i.test(raw)) throw Error();
    let text = `Source native balance: ${formatNative(raw)} ${$('chain').value === 'bsc' ? 'BNB' : 'ETH'}. `;
    if (['bsc', 'robinhood'].includes($('chain').value)) {
      const response = await fetch(`/api/tree-gateway-gas?address=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(10_000) });
      const data = await response.json();
      if (!response.ok || data.address?.toLowerCase() !== address.toLowerCase() || !/^0x[0-9a-f]+$/i.test(data.balance)) throw Error();
      text += `Base balance: ${formatNative(data.balance)} ETH. ${BigInt(data.balance) === 0n ? 'Base ETH is needed before the second bridge.' : 'Base ETH is present; this does not confirm enough gas for a transaction.'} `;
    }
    if (current === generation) $('gas-status').textContent = text + 'Exact gas costs are not yet estimated. No funds moved.';
  } catch { if (current === generation) $('gas-status').textContent = 'Balance check unavailable. No gas sufficiency conclusion can be made. Retry later.'; }
  finally { if (current === generation) render(); }
});
render();
