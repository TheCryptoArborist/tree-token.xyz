import {
  SUI_COIN_TYPE, TREE_DECIMALS, SUI_DECIMALS, DEFAULT_SLIPPAGE_BPS, MIN_SUI_GAS_RESERVE_RAW,
  decimalToRaw, rawToDecimal, ticksFromDisplayedPrices, minimumAfterSlippage, validateVerifiedPool,
  buildCreateTreeV3Position, extractAddLiquidityEvent, simulationSucceeded,
} from './v3-transaction-core.js';

const PREVIEW_HOST_PATTERN = /^deploy-preview-\d+--tree-token\.netlify\.app$/;
const EXECUTION_ENABLED = PREVIEW_HOST_PATTERN.test(location.hostname) || ['localhost','127.0.0.1','::1'].includes(location.hostname);
const SDK_URL = 'https://esm.run/@mysten/sui@2.23.1/transactions';
let slippageBps = DEFAULT_SLIPPAGE_BPS;
let busy = false;

function validAddress(value) { return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value : null; }
function addressFrom(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 2) return null;
  for (const key of ['address','accountAddress','currentAddress','walletAddress','selectedAddress']) { const found = validAddress(value[key]); if (found) return found; }
  for (const key of ['account','currentAccount','selectedAccount','state','walletState']) { const found = addressFrom(value[key], depth + 1); if (found) return found; }
  for (const account of Array.isArray(value.accounts) ? value.accounts : []) { const found = addressFrom(account, depth + 1); if (found) return found; }
  return null;
}
function walletGlobals() {
  return Object.entries(window).filter(([name, value]) => value && (/(?:tree|sui).*wallet|wallet.*(?:tree|sui)|sign.*execute/i.test(name)));
}
async function connectedAddress() {
  for (const [name, value] of walletGlobals()) {
    const direct = addressFrom(value); if (direct) return direct;
    if (typeof value === 'function' && /(?:get|current|connected).*(?:address|account|wallet|state)/i.test(name)) {
      try { const result = await value(); const found = validAddress(result) || addressFrom(result); if (found) return found; } catch { }
    }
  }
  return validAddress(document.getElementById('dappWallet')?.dataset?.address);
}
async function suiClient() {
  if (typeof window.initSuiClient === 'function') return window.initSuiClient();
  for (const [name, value] of Object.entries(window)) {
    if (value?.core?.simulateTransaction) return value;
    if (typeof value === 'function' && /sui.*client|client.*sui/i.test(name)) { try { const client = await value(); if (client?.core?.simulateTransaction) return client; } catch { } }
  }
  throw new Error('The Sui Mainnet client is unavailable.');
}
async function signAndExecute(transaction) {
  for (const [name, value] of walletGlobals()) {
    if (typeof value === 'function' && /sign.*execute/i.test(name)) {
      try { return await value(transaction); } catch (first) {
        if (/reject|cancel|denied/i.test(String(first?.message || first))) throw first;
        try { return await value({ transaction }); } catch (second) { if (/reject|cancel|denied/i.test(String(second?.message || second))) throw second; }
      }
    }
    for (const object of [value, value?.wallet, value?.currentWallet, value?.selectedWallet, value?.state?.wallet].filter(Boolean)) {
      for (const methodName of ['signAndExecuteTransaction','signAndExecuteTransactionBlock']) {
        if (typeof object?.[methodName] !== 'function') continue;
        try { return await object[methodName]({ transaction }); } catch (first) {
          try { return await object[methodName](transaction); } catch (second) { if (/reject|cancel|denied/i.test(String(second?.message || second))) throw second; }
        }
      }
    }
  }
  throw new Error('The connected wallet does not expose a compatible signing method.');
}
async function simulate(client, transaction) {
  let lastError;
  for (const request of [
    { transaction, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } },
    { transaction, include: { effects: true, events: true, balanceChanges: true, commandResults: true } },
    { transaction, checksEnabled: true },
  ]) { try { return await client.core.simulateTransaction(request); } catch (error) { lastError = error; } }
  throw lastError || new Error('Sui Mainnet simulation failed.');
}
function digestFrom(result) { return result?.digest || result?.transactionDigest || result?.effects?.transactionDigest || result?.result?.digest || null; }
async function waitForFinality(client, digest) {
  if (!digest) throw new Error('The wallet returned no transaction digest.');
  if (client?.core?.waitForTransaction) return client.core.waitForTransaction({ digest, timeout: 60000, include: { effects: true, balanceChanges: true, events: true } });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { try { const result = await client.core.getTransaction({ digest, include: { effects: true, balanceChanges: true, events: true } }); if (result) return result; } catch { } await new Promise((resolve) => setTimeout(resolve, 1500)); }
  throw new Error('Transaction finality could not be confirmed within 60 seconds.');
}
function node(...ids) { for (const id of ids) { const found = document.getElementById(id); if (found) return found; } return null; }
function setStatus(message, kind = '') { const target = node('v3CreateStatus','v3AddStatus','v3Status'); if (!target) return; target.textContent = message; target.classList.remove('ok','error','warning'); if (kind) target.classList.add(kind); }
async function overview() { const response = await fetch('/api/tree-v3-overview', { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!response.ok) throw new Error(`V3 overview returned ${response.status}.`); const payload = await response.json(); validateVerifiedPool(payload?.pool); return payload; }
function createButton() { return node('v3CreatePosition') || document.querySelector('#v3 .v3-disabled-action') || [...document.querySelectorAll('#v3 button')].find((item) => /position transaction builder|create.*position/i.test(item.textContent || '')); }
function installControls(button) {
  if (!document.getElementById('v3TransactionControls')) {
    const wrapper = document.createElement('div'); wrapper.id = 'v3TransactionControls'; wrapper.className = 'v3-transaction-controls';
    wrapper.innerHTML = '<div class="v3-slippage-row"><span>Position slippage</span><div role="group" aria-label="V3 position slippage"><button type="button" data-v3-position-slippage="50">0.5%</button><button class="active" type="button" data-v3-position-slippage="100">1%</button><button type="button" data-v3-position-slippage="200">2%</button></div></div><p class="status" id="v3CreateStatus" role="status" aria-live="polite"></p>';
    button.parentNode?.insertBefore(wrapper, button);
    wrapper.querySelectorAll('[data-v3-position-slippage]').forEach((choice) => choice.addEventListener('click', () => { slippageBps = Number(choice.dataset.v3PositionSlippage); wrapper.querySelectorAll('[data-v3-position-slippage]').forEach((item) => item.classList.toggle('active', item === choice)); }));
  }
  button.id = 'v3CreatePosition'; button.dataset.v3TransactionsReady = 'true'; button.disabled = !EXECUTION_ENABLED;
  button.textContent = EXECUTION_ENABLED ? 'Create SUI/TREE V3 Position' : 'V3 position execution under review';
  if (EXECUTION_ENABLED) {
    const phaseBadge = document.querySelector('#v3 .section-heading .data-state');
    const plannerNote = document.querySelector('#v3 .v3-add-card .v3-status');
    if (phaseBadge) phaseBadge.textContent = 'Preview transaction review';
    if (plannerNote) plannerNote.textContent = 'Preview builder enabled. Nothing is signed or submitted until you approve the final wallet request.';
    button.classList.remove('v3-disabled-action', 'secondary'); button.classList.add('button', 'primary'); setStatus('Preview mode: every position transaction is simulated twice before wallet approval.');
  }
  else setStatus('Native V3 position execution remains disabled on production during review.');
}
function confirmText(data) {
  return ['Create this SUI/TREE V3 position?','',`Range ticks: ${data.tickLower} to ${data.tickUpper}`,`Maximum TREE supplied: ${rawToDecimal(data.treeRaw,TREE_DECIMALS,6)} TREE`,`Maximum SUI supplied: ${rawToDecimal(data.suiRaw,SUI_DECIMALS,9)} SUI`,`Simulated TREE deposit: ${rawToDecimal(data.preliminary.treeRaw,TREE_DECIMALS,6)} TREE`,`Simulated SUI deposit: ${rawToDecimal(data.preliminary.suiRaw,SUI_DECIMALS,9)} SUI`,`Minimum TREE deposit: ${rawToDecimal(data.minTreeRaw,TREE_DECIMALS,6)} TREE`,`Minimum SUI deposit: ${rawToDecimal(data.minSuiRaw,SUI_DECIMALS,9)} SUI`,`Slippage: ${(slippageBps/100).toFixed(2)}%`,'','The exact transaction was simulated again before this wallet request.'].join('\n');
}
async function createPosition(button) {
  if (busy) return; busy = true; button.disabled = true;
  try {
    if (!EXECUTION_ENABLED) throw new Error('Native V3 position execution is disabled on production during review.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before creating a position.');
    const client = await suiClient(); const data = await overview();
    const suiRaw = decimalToRaw(node('v3SuiAmount','v3AmountSui')?.value, SUI_DECIMALS); const treeRaw = decimalToRaw(node('v3TreeAmount','v3AmountTree')?.value, TREE_DECIMALS);
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE }); const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the position deposit.');
    const minPrice = Number(node('v3MinPrice','v3MinimumPrice')?.value); const maxPrice = Number(node('v3MaxPrice','v3MaximumPrice')?.value);
    const { lower: tickLower, upper: tickUpper } = ticksFromDisplayedPrices({ currentTick: Number(data.pool.currentTick), currentPrice: Number(data.pool.priceSuiPerTree), minPrice, maxPrice, tickSpacing: Number(data.pool.tickSpacing), displayedPriceIncreasesWithTick: false });
    const { Transaction } = await import(SDK_URL);
    setStatus('Building and simulating the proposed SUI/TREE position…','warning');
    const preliminaryTx = await buildCreateTreeV3Position({ Transaction, client, owner, treeRaw, suiRaw, tickLower, tickUpper });
    const preliminarySimulation = await simulate(client, preliminaryTx); if (!simulationSucceeded(preliminarySimulation)) throw new Error('The proposed V3 position failed Sui Mainnet simulation.');
    const preliminary = extractAddLiquidityEvent(preliminarySimulation); if (!preliminary) throw new Error('SuiDex did not return verified add-liquidity amounts during simulation.');
    const minTreeRaw = minimumAfterSlippage(preliminary.treeRaw, slippageBps); const minSuiRaw = minimumAfterSlippage(preliminary.suiRaw, slippageBps);
    const finalTx = await buildCreateTreeV3Position({ Transaction, client, owner, treeRaw, suiRaw, tickLower, tickUpper, minTreeRaw, minSuiRaw });
    const finalSimulation = await simulate(client, finalTx); if (!simulationSucceeded(finalSimulation)) throw new Error('The slippage-protected V3 transaction failed Sui Mainnet simulation.');
    if (!window.confirm(confirmText({ tickLower, tickUpper, treeRaw, suiRaw, minTreeRaw, minSuiRaw, preliminary }))) { setStatus('Position creation cancelled before wallet approval.'); return; }
    setStatus('Review the exact SUI/TREE position transaction in your wallet…','warning'); const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setStatus('Wallet approved. Waiting for Sui finality…','warning'); const finalized = await waitForFinality(client, digest); if (finalized?.effects && !simulationSucceeded(finalized)) throw new Error('The submitted V3 transaction did not finalize successfully.');
    setStatus(`Position created successfully. Digest: ${digest}`,'ok'); document.querySelector('[data-v3-tab="positions"],[data-v3-panel-target="positions"]')?.click(); node('v3RefreshPositions')?.click();
  } catch (error) { const message = String(error?.message || error || 'V3 position creation failed.'); setStatus(message,/reject|cancel|denied/i.test(message)?'':'error'); }
  finally { busy = false; button.disabled = !EXECUTION_ENABLED; }
}
function initialize() {
  const activate = () => { const button = createButton(); if (!button || button.dataset.v3TransactionsReady === 'true') return false; installControls(button); button.addEventListener('click', () => createPosition(button)); return true; };
  if (activate()) return; const observer = new MutationObserver(() => { if (activate()) observer.disconnect(); }); observer.observe(document.documentElement,{childList:true,subtree:true}); setTimeout(() => observer.disconnect(),30000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true}); else initialize();
