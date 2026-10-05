import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import '@mysten/dapp-kit-core/web';
import { EVM_CHAINS, isEvmAddress, readOnlyEvm, formatNative, sourceBalance, suiReviewAddress, commandCenterHost } from '../review-core.js';

const $ = id => document.getElementById(id);
const host = commandCenterHost(window);
const rocketxRoute = () => ['bsc', 'robinhood'].includes($('chain').value) && $('destination').value === 'SUI';
const kit = host ? null : createDAppKit({ networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false, createClient: network => new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }) });
if (kit) {
  const connectButton = document.createElement('mysten-dapp-kit-connect-button');
  connectButton.instance = kit;
  $('sui-connect-control').append(connectButton);
} else { $('host-wallet').hidden = false; $('sui-wallet-context').hidden = false; }
let currentQuote = null, simulationVersion = 0, bridgeVersion = 0, mayanVersion = 0;
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
  const rocketx = rocketxRoute();
  for (const id of ['check-bridges', 'bridge-check-status', 'simulate-mayan', 'mayan-simulation-status', 'simulate-tree', 'simulation-status']) $(id).hidden = rocketx;
  $('gas-check').textContent = rocketx ? 'Check source balance' : 'Check gas balances';
  $('wallet-balance-note').textContent = rocketx ? 'Use Brave or another EVM wallet for the source and Slush for your Sui receiving address. The balance check uses only your source wallet’s network provider. No Base balance check, order creation or signing. A balance does not confirm enough gas for a transfer.' : 'When you check balances, the connected public source address is sent to the network provider. Quotes still use a sample wallet and remain indicative.';
  $('source-address').textContent = sourceAddress || 'Source wallet not connected.';
  $('sui-address').textContent = suiAddress || 'Sui receiving wallet not connected.';
  $('source-connect').disabled = !expected;
  $('check-bridges').disabled = !sourceAddress || !['bsc', 'robinhood'].includes($('chain').value) || sourceChain !== EVM_CHAINS[$('chain').value];
  $('simulate-mayan').disabled = !suiAddress || !sourceAddress || sourceChain !== EVM_CHAINS[$('chain').value] || !currentQuote?.mayanAmountRaw || currentQuote.expiresAt <= Date.now();
  $('simulate-tree').disabled = !suiAddress || !currentQuote?.inputAmount || currentQuote.expiresAt <= Date.now();
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
window.addEventListener('gateway-route-change', () => { invalidate(); render(); });
$('gas-check').addEventListener('click', async () => {
  if (!request || !sourceAddress || sourceChain !== EVM_CHAINS[$('chain').value]) return;
  const current = ++generation, address = sourceAddress, activeRequest = request, chain = $('chain').value, rocketx = rocketxRoute();
  $('gas-check').disabled = true;
  $('gas-status').textContent = 'Reading native gas balances…';
  try {
    const raw = await sourceBalance(activeRequest, address, chain);
    if (!/^0x[0-9a-f]+$/i.test(raw)) throw Error();
    let text = `Source native balance: ${formatNative(raw)} ${chain === 'bsc' ? 'BNB' : 'ETH'}. `;
    if (!rocketx && ['bsc', 'robinhood'].includes(chain)) {
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
  mayanVersion++;
  $('mayan-simulation-status').textContent = 'Connect both wallets and get a fresh SUI-settlement quote from Base USDC, BNB or Robinhood Chain. Checks only the Base source transaction, using existing USDC, ETH and Mayan allowance. Addresses and amount go to Mayan and network providers. No approval, signing or transfer.';
  bridgeVersion++;
  $('bridge-check-status').textContent = 'Connect your source wallet on BNB or Robinhood Chain to check a fresh Relay deposit and current Base funds and allowance for Mayan. Your address and amount go to Relay and the network providers. No signing, approval or transfers.';
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
  if (!suiAddress || !currentQuote?.inputAmount || currentQuote.expiresAt <= Date.now()) return;
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

$('check-bridges').addEventListener('click', async () => {
  const chain = $('chain').value, amount = $('amount').value.trim(), address = sourceAddress, active = request;
  if (!active || !address || !['bsc', 'robinhood'].includes(chain) || sourceChain !== EVM_CHAINS[chain]) return;
  const version = ++bridgeVersion;
  $('check-bridges').disabled = true;
  $('bridge-check-status').textContent = 'Verifying the Relay order, simulating its source deposit and checking Base funds for Mayan…';
  try {
    const [accounts, network] = await Promise.all([active('eth_accounts'), active('eth_chainId')]);
    if (accounts?.[0]?.toLowerCase() !== address.toLowerCase() || BigInt(network) !== BigInt(EVM_CHAINS[chain])) throw Error();
    const response = await fetch('/api/tree-gateway-bridge-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chain, amount, address }), signal: AbortSignal.timeout(35000) });
    const data = await response.json();
    if (version !== bridgeVersion) return;
    const [afterAccounts, afterNetwork] = await Promise.all([active('eth_accounts'), active('eth_chainId')]);
    if (version !== bridgeVersion) return;
    if (afterAccounts?.[0]?.toLowerCase() !== address.toLowerCase() || BigInt(afterNetwork) !== BigInt(EVM_CHAINS[chain])) throw Error();
    if (!response.ok || data.address !== address.toLowerCase() || data.chain !== chain || data.amount !== amount || data.orderVerified !== true || data.signed !== false || data.submitted !== false || data.routeReady !== false || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) throw Error();
    let message = 'Relay order verified for this account and amount. ';
    message += data.relay?.status === 'passed' ? 'Source deposit simulation passed. ' : 'Source deposit simulation did not pass or was unavailable; check the current source funds and gas. ';
    if (data.mayan?.status === 'balances-only') {
      message += 'Mayan on Base: ' + (data.mayan.baseEthPresent === true ? 'ETH is present, but sufficient gas is not confirmed. ' : 'No Base ETH for gas. ');
      message += data.mayan.existingUsdcEnough === true ? 'Current Base USDC covers the quoted bridge minimum. ' : 'Current Base USDC is below the quoted bridge minimum. ';
      message += data.mayan.existingAllowanceEnough === true ? 'Existing Mayan allowance covers that amount. ' : 'Existing Mayan allowance is below that amount; no approval was requested. ';
    } else message += 'Base balance and allowance checks unavailable. ';
    $('bridge-check-status').textContent = message + 'Mayan and destination delivery were not simulated. Future bridge proceeds are not counted. This is not a ready-to-transfer result. Nothing signed or sent.';
    setTimeout(() => { if (version === bridgeVersion) { bridgeVersion++; $('bridge-check-status').textContent = 'Bridge check expired. Run it again for current conditions. Nothing was signed or transferred.'; render(); } }, Math.max(0, data.expiresAt - Date.now()));
  } catch { if (version === bridgeVersion) $('bridge-check-status').textContent = 'Bridge check did not complete or wallet details changed. No simulation pass can be claimed. No funds moved.'; }
  finally { if (version === bridgeVersion) render(); }
});

$('simulate-mayan').addEventListener('click', async () => {
  const quote = currentQuote, address = sourceAddress, recipient = suiAddress, active = request, chain = $('chain').value;
  if (!active || !address || !recipient || !quote?.mayanAmountRaw || quote.expiresAt <= Date.now() || sourceChain !== EVM_CHAINS[chain]) return;
  const version = ++mayanVersion;
  $('simulate-mayan').disabled = true;
  $('mayan-simulation-status').textContent = 'Verifying a fresh Mayan CCTP transaction and checking existing Base funds and allowance…';
  const verifyAccounts = async () => {
    const [accounts, network] = await Promise.all([active('eth_accounts'), active('eth_chainId')]);
    if (accounts?.[0]?.toLowerCase() !== address.toLowerCase() || BigInt(network) !== BigInt(EVM_CHAINS[chain])) throw Error();
    let actual;
    if (host) actual = suiReviewAddress(host.getWalletConnectionState?.());
    else { const c = kit.stores.$connection.get(); actual = suiReviewAddress({ connected: c.isConnected === true && c.account?.chains?.includes('sui:mainnet'), address: c.account?.address }); }
    if (actual !== recipient) throw Error();
  };
  try {
    await verifyAccounts();
    if (version !== mayanVersion) return;
    const response = await fetch('/api/tree-gateway-mayan-simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, recipient, amountRaw: quote.mayanAmountRaw }), signal: AbortSignal.timeout(28000) });
    const result = await response.json();
    await verifyAccounts();
    if (version !== mayanVersion || quote.expiresAt <= Date.now()) return;
    if (!response.ok || result.address !== address.toLowerCase() || result.recipient !== recipient || result.amountRaw !== quote.mayanAmountRaw || result.payloadVerified !== true || result.signed !== false || result.submitted !== false || result.routeReady !== false || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw Error();
    let message;
    if (result.status === 'passed' && result.simulated === true) message = 'Mayan Base USDC → SUI source transaction simulation passed for these addresses. ';
    else if (result.status === 'blocked' && result.simulated === false) {
      const missing = [];
      if (result.funds?.baseEthPresent !== true) missing.push('Base ETH');
      if (result.funds?.existingUsdcEnough !== true) missing.push('enough existing Base USDC');
      if (result.funds?.existingAllowanceEnough !== true) missing.push('an existing Mayan allowance for this amount');
      message = 'Transaction details verified; simulation not run. Missing: ' + missing.join(', ') + '. No approval requested. ';
    } else throw Error();
    $('mayan-simulation-status').textContent = message + 'Sui delivery, Relay and the TREE swap are not verified by this check. Future proceeds are not counted; total fees including Base L1 fees are not confirmed. Nothing signed or sent.';
    setTimeout(() => { if (version === mayanVersion) { mayanVersion++; $('mayan-simulation-status').textContent = 'Mayan check expired. Refresh the quote and check again. No funds moved.'; render(); } }, Math.max(0, Math.min(result.expiresAt, quote.expiresAt)-Date.now()));
  } catch { if (version === mayanVersion) $('mayan-simulation-status').textContent = 'Mayan simulation did not pass, was unavailable, or wallet details changed. No approval, signing or transfer occurred.'; }
  finally { if (version === mayanVersion) render(); }
});
