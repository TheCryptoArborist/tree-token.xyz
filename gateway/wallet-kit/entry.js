import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import '@mysten/dapp-kit-core/web';
import { EVM_CHAINS, isEvmAddress, readOnlyEvm, formatNative, suiReviewAddress, commandCenterHost } from '../review-core.js';

const $ = id => document.getElementById(id);
const host = commandCenterHost(window);
const kit = host ? null : createDAppKit({ networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false, createClient: network => new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }) });
if (kit) {
  const connectButton = document.createElement('mysten-dapp-kit-connect-button');
  connectButton.instance = kit;
  $('sui-connect-control').append(connectButton);
} else { $('host-wallet').hidden = false; $('sui-wallet-context').hidden = false; }
let currentQuote = null, simulationVersion = 0;
let sourceAddress = '', sourceChain = '', suiAddress = '', provider, request, generation = 0;
let removeListeners = () => {};
const providers = new Map();
function invalidate() {
  clearSimulation();
  generation++;
  $('gas-status').textContent = 'Gas balance has not been checked. Exact transaction gas is not yet estimated.';
  window.dispatchEvent(new Event('gateway-wallet-change'));
}
function render() {
  const expected = EVM_CHAINS[$('chain').value];
  $('source-address').textContent = sourceAddress || 'Source wallet not connected.';
  $('sui-address').textContent = suiAddress || 'Sui receiving wallet not connected.';
  $('source-connect').disabled = !expected;
  $('simulate-tree').disabled = !suiAddress || !currentQuote || currentQuote.expiresAt <= Date.now();
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
const evmWindow = host || window;
evmWindow.addEventListener('eip6963:announceProvider', discover);
evmWindow.dispatchEvent(new evmWindow.Event('eip6963:requestProvider'));
window.addEventListener('pagehide', () => evmWindow.removeEventListener('eip6963:announceProvider', discover), { once: true });
if (evmWindow.ethereum?.request) { providers.set('legacy', evmWindow.ethereum); $('source-wallet').append(new Option('Default browser wallet', 'legacy')); }
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
kit?.stores.$connection.subscribe(connection => {
  const account = connection.account;
  suiAddress = suiReviewAddress({ connected: connection.isConnected === true && account?.chains?.includes('sui:mainnet'), address: account?.address });
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

function clearSimulation() {
  simulationVersion++;
  $('simulation-status').textContent = 'Get a fresh TREE quote after connecting your Sui wallet. Simulation checks only a fresh Turbos SUI → TREE swap using current SUI funds, not either bridge. Your address and amount are sent to the preview service and Sui network. No signing or transfers.';
}
window.addEventListener('gateway-quote-review', event => {
  currentQuote = event.detail;
  clearSimulation(); render();
});
if (host) {
  const syncHost = () => {
    try { suiAddress = suiReviewAddress(host.getWalletConnectionState?.()); } catch { suiAddress = ''; }
    invalidate(); render();
  };
  host.addEventListener('tree:wallet-changed', syncHost);
  host.addEventListener('tree:wallet-manager-ready', syncHost);
  window.addEventListener('pagehide', () => {
    host.removeEventListener('tree:wallet-changed', syncHost);
    host.removeEventListener('tree:wallet-manager-ready', syncHost);
  }, { once: true });
  $('host-wallet').addEventListener('click', () => {
    if (typeof host.openWalletManager === 'function') host.openWalletManager();
    else $('sui-address').textContent = 'Command Center wallet manager is still loading. Try its Connect Wallet button.';
  });
  syncHost();
}
$('simulate-tree').addEventListener('click', async () => {
  if (host) {
    const actual = suiReviewAddress(host.getWalletConnectionState?.());
    if (actual !== suiAddress) { suiAddress = actual; invalidate(); render(); return; }
  }
  if (!suiAddress || !currentQuote || currentQuote.expiresAt <= Date.now()) return;
  const version = ++simulationVersion, address = suiAddress, quote = currentQuote;
  $('simulate-tree').disabled = true;
  $('simulation-status').textContent = 'Simulating a fresh Turbos SUI → TREE swap. No signature requested…';
  try {
    const response = await fetch('/api/tree-gateway-simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, amount: quote.inputAmount }), signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    if (version !== simulationVersion || address !== suiAddress || quote.expiresAt <= Date.now()) return;
    $('simulation-status').textContent = response.ok && result.status === 'passed' && result.address === address && result.amount === quote.inputAmount && result.signed === false && result.submitted === false ? 'Turbos SUI → TREE simulation passed for ' + result.amount + ' SUI. Estimated net gas after storage rebate: ' + result.netGasSui + ' SUI. This does not validate either bridge, the displayed best-route venue, or future balances. Nothing was signed or transferred.' : (result.message || 'Simulation unavailable. No execution readiness can be confirmed.');
  } catch { if (version === simulationVersion) $('simulation-status').textContent = 'Simulation unavailable. No execution readiness can be confirmed. No funds moved.'; }
  finally { if (version === simulationVersion) render(); }
});
