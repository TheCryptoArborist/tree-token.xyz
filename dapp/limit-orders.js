import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import {
  LIMIT_EXPIRIES, LIMIT_EXECUTION_GAS_RAW, LIMIT_MIN_WALLET_GAS_RAW, LIMIT_SUI_DECIMALS, LIMIT_SUI_TYPE,
  LIMIT_TREE_DECIMALS, LIMIT_TREE_TYPE, assertAllowedLimitTransaction, cancelLimitMessage,
  createLimitAccountMessage, encodeLimitMessage, estimateLimitOutput, extractCreatedLimitOrder,
  isFavorableLimitTarget, limitDecimalToRaw, limitDirection, limitRawToDecimal, limitSimulationSucceeded,
  minimumLimitInput, normalizeLimitAddress, treeLimitOrderDirection, validateLimitBalanceChanges, validateLimitTargetPrice,
} from './limit-orders-core.js';

const API = '/api/tree-limit-orders';
const state = { direction: 'buy-tree', currentPrice: 0, minUsd: null, coinPricesUsd: { sui: null, tree: null }, balances: { sui: 0n, tree: 0n }, balanceOwner: null, busy: false, tab: 'active', orders: [], accountProof: null };
const el = {};

function setStatus(message, kind = '') { el.status.textContent = message; el.status.className = `status${kind ? ` ${kind}` : ''}`; }
function compact(value) { const text = String(value || ''); return text.length > 18 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text; }
function numberText(value, digits = 9) { return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits }); }
function balanceValue(result) { return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0); }
function digestFrom(result) { return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionDigest || null; }
function transactionRecord(value) { return value?.Transaction || value?.transaction || value; }
function currentWallet() { return normalizeLimitAddress(window.playerAddress); }
async function client() { if (typeof window.initSuiClient !== 'function') throw new Error('The Sui Mainnet client is unavailable.'); return window.initSuiClient(); }

async function api(action, options = {}) {
  const safeToRetry = ['config', 'past', 'user-key', 'create', 'active'].includes(action);
  let lastPayload = {};
  for (let attempt = 0; attempt < (safeToRetry ? 2 : 1); attempt += 1) {
    const response = await fetch(`${API}?action=${encodeURIComponent(action)}${options.query || ''}`, {
      method: options.body ? 'POST' : 'GET', headers: options.body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined, cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.status === 'ok') return payload;
    lastPayload = payload;
    if (!safeToRetry || payload.retryable === false || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  const labels = { create: 'The order builder', 'user-key': 'Wallet registration lookup', active: 'Active-order lookup', past: 'Past-order lookup', config: 'The limit-order service' };
  throw new Error(lastPayload.message || `${labels[action] || 'The TREE limit-order service'} could not complete this request. Please try again.`);
}

async function connectIfNeeded() {
  if (currentWallet()) return currentWallet();
  await window.openWalletManager?.({ mode: 'picker' });
  const owner = currentWallet();
  if (!owner) throw new Error('Connect a Sui wallet to continue.');
  state.accountProof = null;
  await loadBalances(true);
  return owner;
}

async function signProof(message) {
  if (typeof window.signTreePersonalMessage !== 'function') throw new Error('This wallet cannot authorize TREE limit orders.');
  const expectedBytes = encodeLimitMessage(message);
  const signed = await window.signTreePersonalMessage(expectedBytes);
  if (!signed?.bytes || !signed?.signature) throw new Error('The wallet returned an incomplete authorization.');
  return { walletAddress: currentWallet(), bytes: signed.bytes, signature: signed.signature };
}

async function accountProof() {
  const owner = await connectIfNeeded();
  if (state.accountProof?.walletAddress === owner) return state.accountProof;
  state.accountProof = await signProof(createLimitAccountMessage());
  return state.accountProof;
}

async function ensureAftermathUser() {
  const owner = await connectIfNeeded();
  const status = await api('user-key', { body: { walletAddress: owner } });
  if (status.registered) return;
  setStatus('Approve the wallet-ownership message. This does not move funds or submit a transaction.');
  const proof = await accountProof();
  const result = await api('register-user', { body: proof });
  if (!result.registered) throw new Error('Aftermath wallet registration did not complete.');
}

function expiryMs() { const value = LIMIT_EXPIRIES[el.expiry.value]; if (!value) throw new Error('Choose a supported expiration period.'); return value; }
function formPlan() {
  const owner = currentWallet();
  if (!owner) throw new Error('Connect a Sui wallet to continue.');
  const direction = limitDirection(state.direction);
  const amountText = el.amount.value.trim();
  const allocateCoinAmount = limitDecimalToRaw(amountText, direction.inputDecimals);
  const target = validateLimitTargetPrice(el.target.value);
  if (state.currentPrice > 0 && !isFavorableLimitTarget(state.direction, target.numeric, state.currentPrice)) {
    throw new Error(state.direction === 'buy-tree' ? 'A buy target must be below the current TREE price.' : 'A sell target must be above the current TREE price.');
  }
  const inputPriceUsd = state.direction === 'buy-tree' ? state.coinPricesUsd.sui : state.coinPricesUsd.tree;
  const requiredInput = minimumLimitInput({ minOrderSizeUsd: state.minUsd, inputPriceUsd });
  const numericAmount = Number(amountText.replace(/,/g, ''));
  if (requiredInput && numericAmount + Number.EPSILON < requiredInput) {
    throw new Error(`The $${Number(state.minUsd).toFixed(2)} protocol minimum currently requires at least ${numberText(requiredInput, direction.inputDecimals === 9 ? 3 : 0)} ${direction.inputSymbol}.`);
  }
  return { walletAddress: owner, direction: state.direction, allocateCoinAmount: allocateCoinAmount.toString(), targetPriceSuiPerTree: target.text, expiryDurationMs: expiryMs(), amountText, inputSymbol: direction.inputSymbol, outputSymbol: direction.outputSymbol };
}

function renderForm() {
  const direction = limitDirection(state.direction);
  document.querySelectorAll('[data-limit-direction]').forEach((button) => button.classList.toggle('active', button.dataset.limitDirection === state.direction));
  el.amountLabel.textContent = `You allocate (${direction.inputSymbol})`;
  el.inputSymbol.textContent = direction.inputSymbol;
  const balance = state.direction === 'buy-tree' ? state.balances.sui : state.balances.tree;
  el.balance.textContent = currentWallet() ? `Balance ${limitRawToDecimal(balance, direction.inputDecimals, direction.inputDecimals === 9 ? 4 : 2)} ${direction.inputSymbol}` : 'Balance —';
  el.currentPrice.textContent = state.currentPrice > 0 ? `${numberText(state.currentPrice, 12)} SUI` : 'Unavailable';
  const inputPriceUsd = state.direction === 'buy-tree' ? state.coinPricesUsd.sui : state.coinPricesUsd.tree;
  const requiredInput = minimumLimitInput({ minOrderSizeUsd: state.minUsd, inputPriceUsd });
  el.minimum.textContent = state.minUsd ? `≈ $${Number(state.minUsd).toFixed(2)}${requiredInput ? ` (at least ${numberText(requiredInput, direction.inputDecimals === 9 ? 3 : 0)} ${direction.inputSymbol})` : ''}` : '≈ $5.00';
  try {
    const target = validateLimitTargetPrice(el.target.value).numeric;
    const amount = Number(el.amount.value.replace(/,/g, ''));
    const estimate = estimateLimitOutput({ direction: state.direction, amount, targetPrice: target });
    el.estimated.textContent = estimate ? `${numberText(estimate, direction.outputDecimals)} ${direction.outputSymbol}` : '—';
    const favorable = state.currentPrice > 0 && isFavorableLimitTarget(state.direction, target, state.currentPrice);
    el.condition.textContent = favorable ? (state.direction === 'buy-tree' ? 'Fills at or below target' : 'Fills at or above target') : 'Target must be beyond market';
    el.condition.className = favorable ? 'swap-positive' : 'swap-warning';
  } catch { el.estimated.textContent = '—'; el.condition.textContent = 'Enter a target'; el.condition.className = ''; }
  updateAction();
}

function updateAction() {
  el.create.disabled = state.busy;
  el.refresh.disabled = state.busy;
  if (state.busy) { el.create.textContent = 'Working…'; return; }
  el.create.textContent = currentWallet() ? 'Review Limit Order' : 'Connect Wallet';
}

async function loadBalances(force = false) {
  const owner = currentWallet();
  if (!owner) { state.balances = { sui: 0n, tree: 0n }; state.balanceOwner = null; renderForm(); return; }
  if (!force && state.balanceOwner === owner) return;
  const suiClient = await client();
  const [sui, tree] = await Promise.all([suiClient.core.getBalance({ owner, coinType: LIMIT_SUI_TYPE }), suiClient.core.getBalance({ owner, coinType: LIMIT_TREE_TYPE })]);
  state.balances = { sui: balanceValue(sui), tree: balanceValue(tree) };
  state.balanceOwner = owner;
  renderForm();
}

function assertBalance(plan) {
  const amount = BigInt(plan.allocateCoinAmount);
  if (plan.direction === 'buy-tree' && state.balances.sui < amount + LIMIT_MIN_WALLET_GAS_RAW) throw new Error('Not enough SUI for the allocation, execution reserve, and network gas.');
  if (plan.direction === 'sell-tree' && state.balances.tree < amount) throw new Error('Not enough TREE for this allocation.');
  if (plan.direction === 'sell-tree' && state.balances.sui < LIMIT_MIN_WALLET_GAS_RAW) throw new Error('Keep at least 0.1 SUI available for execution and network gas.');
}

async function simulatePlan(serialized, plan) {
  const transaction = Transaction.from(serialized);
  assertAllowedLimitTransaction(transaction, plan);
  const suiClient = await client();
  const bytes = await transaction.build({ client: suiClient });
  const simulation = await suiClient.core.simulateTransaction({ transaction: bytes, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
  if (!limitSimulationSucceeded(simulation)) throw new Error('Sui Mainnet simulation rejected this order.');
  const created = extractCreatedLimitOrder(simulation, plan);
  if (!created || !validateLimitBalanceChanges(simulation, plan)) throw new Error('The simulated order did not match the reviewed SUI/TREE allocation.');
  return { transaction, created };
}

async function createOrder() {
  if (!currentWallet()) { try { await connectIfNeeded(); } catch (error) { setStatus(error.message, 'error'); } renderForm(); return; }
  state.busy = true; updateAction();
  try {
    await loadBalances(true);
    const plan = formPlan();
    assertBalance(plan);
    await ensureAftermathUser();
    setStatus('Running the first Sui Mainnet simulation. Nothing is being signed yet.');
    const first = await api('create', { body: plan });
    await simulatePlan(first.transaction, plan);
    setStatus('First simulation passed. Building and checking a fresh transaction.');
    const finalBuild = await api('create', { body: plan });
    const verified = await simulatePlan(finalBuild.transaction, plan);
    const estimate = estimateLimitOutput({ direction: plan.direction, amount: plan.amountText, targetPrice: plan.targetPriceSuiPerTree });
    const expiryLabel = el.expiry.options[el.expiry.selectedIndex].textContent;
    const confirmed = window.confirm(`Review TREE limit order\n\nEscrow: ${plan.amountText} ${plan.inputSymbol}\nTarget: ${plan.targetPriceSuiPerTree} SUI per TREE\nEstimated receive: ${numberText(estimate, limitDirection(plan.direction).outputDecimals)} ${plan.outputSymbol}\nExpires: ${expiryLabel}\nProvider: Aftermath Mainnet\nExecution gas held: 0.05 SUI plus normal network gas\n\nThe order can be canceled to return unspent funds. Continue to wallet approval?`);
    if (!confirmed) throw new Error('Order review was canceled. No transaction was submitted.');
    setStatus('Both simulations passed. Review the exact order in your wallet.');
    const submitted = await window.signAndExecuteTransactionBlock(verified.transaction);
    const digest = digestFrom(submitted);
    if (!digest) throw new Error('The wallet returned no transaction digest.');
    setStatus(`Order submitted. Waiting for Sui finality: ${compact(digest)}…`);
    const suiClient = await client();
    const final = await suiClient.core.waitForTransaction({ digest, timeout: 60_000, include: { effects: true, events: true, balanceChanges: true } });
    if (!limitSimulationSucceeded(final) || !extractCreatedLimitOrder(final, plan)) throw new Error('The order did not finalize with the expected Aftermath event.');
    const successMessage = `Limit order confirmed on Sui Mainnet. Transaction ${compact(digest)}.`;
    el.amount.value = '';
    await loadBalances(true).catch(() => {});
    if (state.accountProof) await refreshOrders('active', false).catch(() => {});
    setStatus(successMessage, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Limit order failed.';
    setStatus(/reject|cancel|denied/i.test(message) ? `${message} No funds were moved.` : message, 'error');
  } finally { state.busy = false; updateAction(); }
}

function orderDetails(order) {
  const direction = treeLimitOrderDirection(order);
  if (!direction) return null;
  const meta = limitDirection(direction);
  const inputRaw = order?.allocatedCoin?.amount ?? order?.allocatedCoinAmount ?? 0;
  const outputRaw = order?.buyCoin?.amount ?? order?.buyCoinAmount ?? 0;
  let target = null;
  try {
    const input = Number(limitRawToDecimal(inputRaw, meta.inputDecimals));
    const output = Number(limitRawToDecimal(outputRaw, meta.outputDecimals));
    target = direction === 'buy-tree' ? input / output : output / input;
  } catch { }
  return { direction, meta, inputRaw, outputRaw, target, id: normalizeLimitAddress(order.objectId || order.orderId || order.id) };
}

function renderOrders() {
  el.orders.replaceChildren();
  if (!state.orders.length) { const empty = document.createElement('p'); empty.className = 'limit-empty'; empty.textContent = `No ${state.tab} TREE limit orders found for this wallet.`; el.orders.append(empty); return; }
  for (const order of state.orders) {
    const details = orderDetails(order); if (!details) continue;
    const card = document.createElement('article'); card.className = 'limit-order';
    const head = document.createElement('div'); head.className = 'limit-order-head';
    const title = document.createElement('h4'); title.textContent = details.direction === 'buy-tree' ? 'Buy TREE' : 'Sell TREE';
    const badge = document.createElement('span'); badge.className = `data-state ${state.tab === 'active' ? 'ok' : 'snapshot'}`; badge.textContent = state.tab === 'active' ? 'Active' : String(order.status || 'Past'); head.append(title, badge);
    const grid = document.createElement('div'); grid.className = 'limit-order-grid';
    const rows = [['Order', compact(details.id)], ['Allocated', `${limitRawToDecimal(details.inputRaw, details.meta.inputDecimals, details.meta.inputDecimals)} ${details.meta.inputSymbol}`], ['Target', details.target && Number.isFinite(details.target) ? `${numberText(details.target, 12)} SUI/TREE` : 'Recorded on-chain']];
    for (const [label, value] of rows) { const span = document.createElement('span'); span.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; grid.append(span, strong); }
    card.append(head, grid);
    if (state.tab === 'active' && details.id) { const actions = document.createElement('div'); actions.className = 'limit-order-actions'; const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'button secondary'; cancel.textContent = 'Cancel & Return Funds'; cancel.addEventListener('click', () => cancelOrder(details.id)); actions.append(cancel); card.append(actions); }
    el.orders.append(card);
  }
}

async function refreshOrders(tab = state.tab, authorize = true) {
  const owner = currentWallet();
  if (!owner) { state.orders = []; renderOrders(); return; }
  state.tab = tab; el.activeTab.classList.toggle('active', tab === 'active'); el.pastTab.classList.toggle('active', tab === 'past'); el.activeTab.setAttribute('aria-selected', String(tab === 'active')); el.pastTab.setAttribute('aria-selected', String(tab === 'past'));
  if (tab === 'past') state.orders = (await api('past', { query: `&owner=${encodeURIComponent(owner)}` })).orders || [];
  else { if (authorize) setStatus('Approve the read-only wallet-ownership message. No transaction will be submitted.'); state.orders = (await api('active', { body: await accountProof() })).orders || []; }
  renderOrders();
}

async function refreshFromButton() { state.busy = true; updateAction(); try { await connectIfNeeded(); await refreshOrders(state.tab, true); setStatus(`${state.orders.length} ${state.tab} TREE limit order${state.orders.length === 1 ? '' : 's'} loaded.`, 'success'); } catch (error) { setStatus(error.message, 'error'); } finally { state.busy = false; updateAction(); } }

async function cancelOrder(orderId) {
  if (!window.confirm(`Cancel order ${compact(orderId)} and return its unspent funds?`)) return;
  state.busy = true; updateAction();
  try {
    setStatus('Approve the cancellation message in your wallet.');
    const proof = await signProof(cancelLimitMessage(orderId));
    const result = await api('cancel', { body: { ...proof, orderId } });
    if (!result.canceled) throw new Error('Aftermath did not confirm the cancellation.');
    state.accountProof = null;
    state.orders = state.orders.filter((order) => normalizeLimitAddress(order.objectId || order.orderId || order.id) !== orderId);
    renderOrders();
    await loadBalances(true).catch(() => {});
    setStatus('Order canceled. Unspent funds were returned by Aftermath.', 'success');
  } catch (error) { setStatus(error.message, 'error'); } finally { state.busy = false; updateAction(); }
}

async function initialize() {
  Object.assign(el, { amount: document.getElementById('limitAmount'), amountLabel: document.getElementById('limitAmountLabel'), balance: document.getElementById('limitInputBalance'), inputSymbol: document.getElementById('limitInputSymbol'), target: document.getElementById('limitTarget'), expiry: document.getElementById('limitExpiry'), currentPrice: document.getElementById('limitCurrentPrice'), estimated: document.getElementById('limitEstimatedOutput'), condition: document.getElementById('limitCondition'), minimum: document.getElementById('limitMinimum'), create: document.getElementById('limitCreate'), status: document.getElementById('limitStatus'), refresh: document.getElementById('limitRefresh'), orders: document.getElementById('limitOrders'), activeTab: document.getElementById('limitActiveTab'), pastTab: document.getElementById('limitPastTab'), max: document.getElementById('limitMax') });
  if (!el.create) return;
  document.querySelectorAll('[data-limit-direction]').forEach((button) => button.addEventListener('click', () => { state.direction = button.dataset.limitDirection; el.amount.value = ''; renderForm(); }));
  el.amount.addEventListener('input', renderForm); el.target.addEventListener('input', renderForm); el.create.addEventListener('click', createOrder); el.refresh.addEventListener('click', refreshFromButton);
  el.activeTab.addEventListener('click', () => { state.tab = 'active'; refreshFromButton(); }); el.pastTab.addEventListener('click', () => { state.tab = 'past'; refreshFromButton(); });
  el.max.addEventListener('click', () => { const meta = limitDirection(state.direction); let raw = state.direction === 'buy-tree' ? state.balances.sui - LIMIT_MIN_WALLET_GAS_RAW : state.balances.tree; if (raw < 0n) raw = 0n; el.amount.value = limitRawToDecimal(raw, meta.inputDecimals, meta.inputDecimals); renderForm(); });
  window.addEventListener('tree:wallet-changed', () => { state.accountProof = null; loadBalances(true).catch(() => {}); });
  try {
    const [config, overview] = await Promise.all([api('config'), fetch('/api/tree-v3-overview', { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((response) => response.ok ? response.json() : null)]);
    state.minUsd = config.minOrderSizeUsd;
    const price = Number(overview?.pool?.priceSuiPerTree ?? overview?.priceSuiPerTree ?? overview?.market?.priceSuiPerTree ?? 0);
    state.currentPrice = Number.isFinite(price) ? price : 0;
    const suiUsd = Number(overview?.market?.suiUsd) || null;
    const treeUsd = Number(overview?.market?.treeUsd) || (suiUsd && state.currentPrice > 0 ? suiUsd * state.currentPrice : null);
    state.coinPricesUsd = {
      sui: suiUsd,
      tree: treeUsd,
    };
    setStatus('Ready. Orders are restricted to TREE/SUI through Aftermath Mainnet.');
  } catch (error) { setStatus(error.message, 'error'); }
  await loadBalances(true).catch(() => {}); renderForm();
}

initialize();
