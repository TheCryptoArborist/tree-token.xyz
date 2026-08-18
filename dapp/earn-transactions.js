import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import { SuiGrpcClient } from 'https://esm.run/@mysten/sui@2.23.1/grpc';
import {
  SUI_TYPE, TREE_TYPE, V2_LP_TYPE,
  buildV2StakeTransaction, buildV2ZapTransaction, getV2LpBalance,
  parseAmount,
} from './earn-transactions-core.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const EXECUTION_ENABLED = /^deploy-preview-\d+--tree-token\.netlify\.app$/i.test(location.hostname)
  || /^[a-f0-9]+--tree-token\.netlify\.app$/i.test(location.hostname)
  || ['localhost', '127.0.0.1'].includes(location.hostname);
const state = { token: 'SUI', amount: '', slippageBps: 100, quote: null, quoting: false, executing: false, timer: null, balances: { SUI: 0n, TREE: 0n } };
const el = {};

function typeFor(symbol) { return symbol === 'SUI' ? SUI_TYPE : TREE_TYPE; }
function decimalsFor(symbol) { return symbol === 'SUI' ? 9 : 6; }
function otherSymbol(symbol) { return symbol === 'SUI' ? 'TREE' : 'SUI'; }
function formatRaw(value, decimals, precision = 6) {
  const raw = BigInt(value || 0); const scale = 10n ** BigInt(decimals); const whole = raw / scale; const fraction = (raw % scale).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`;
}
function rawAmount() { try { return parseAmount(state.amount, decimalsFor(state.token), state.token); } catch { return null; } }
function setStatus(message, kind = '') { el.status.textContent = message; el.status.className = `status${kind ? ` ${kind}` : ''}`; }
function coreTransaction(result) { return result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction || null; }
function success(result) { return coreTransaction(result)?.effects?.status?.success === true; }
function failure(result, fallback) { return result?.FailedTransaction?.status?.error?.message || result?.FailedTransaction?.status?.error || coreTransaction(result)?.effects?.status?.error?.message || coreTransaction(result)?.effects?.status?.error || fallback; }
function digest(result) { return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionBlockDigest || null; }

async function balance(symbol) {
  if (!window.playerAddress) return 0n;
  const result = await client.core.getBalance({ owner: window.playerAddress, coinType: typeFor(symbol) });
  return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0);
}
async function loadBalances() {
  if (!window.playerAddress) { state.balances = { SUI: 0n, TREE: 0n }; render(); return; }
  try { const [SUI, TREE] = await Promise.all([balance('SUI'), balance('TREE')]); state.balances = { SUI, TREE }; } catch { setStatus('Wallet balances could not be refreshed.', 'error'); }
  render();
}

function render() {
  const amount = rawAmount();
  el.symbol.textContent = state.token;
  el.balance.textContent = window.playerAddress ? `Balance ${formatRaw(state.balances[state.token], decimalsFor(state.token), 6)} ${state.token}` : 'Balance —';
  el.swap.textContent = amount ? `≈ ${formatRaw(amount / 2n, decimalsFor(state.token), 6)} ${state.token}` : '—';
  el.liquidity.textContent = amount ? `≈ ${formatRaw(amount - amount / 2n, decimalsFor(state.token), 6)} ${state.token}` : '—';
  const route = state.quote;
  el.minimum.textContent = route ? `${formatRaw(route.minAmountOut, decimalsFor(otherSymbol(state.token)), 6)} ${otherSymbol(state.token)}` : '—';
  if (state.executing) { el.action.disabled = true; el.action.textContent = 'Working…'; return; }
  if (!window.playerAddress) { el.action.disabled = false; el.action.textContent = 'Connect Wallet'; return; }
  if (!EXECUTION_ENABLED) { el.action.disabled = true; el.action.textContent = 'Preview execution only'; return; }
  if (!amount || !route) { el.action.disabled = true; el.action.textContent = state.quoting ? 'Loading quote…' : 'Enter an amount'; return; }
  el.action.disabled = false; el.action.textContent = 'Review Zap & Stake';
}

async function requestQuote() {
  const amount = rawAmount(); state.quote = null;
  if (!amount) { setStatus('Enter an amount to build the verified SUI/TREE V2 zap.'); render(); return; }
  const swapRaw = amount / 2n;
  if (swapRaw <= 0n) { setStatus('The zap amount is too small.', 'error'); render(); return; }
  state.quoting = true; render();
  try {
    const query = new URLSearchParams({ tokenIn: typeFor(state.token), tokenOut: typeFor(otherSymbol(state.token)), amountIn: swapRaw.toString(), slippageBps: String(state.slippageBps) });
    const response = await fetch(`/api/tree-swap-quote?${query}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    const route = Array.isArray(payload.routes) ? payload.routes.find((candidate) => candidate.executionKind === 'suidex-v2-direct') : null;
    if (!response.ok || payload.status !== 'ok' || !route) throw new Error(payload.message || 'A verified V2 zap quote is unavailable.');
    if (BigInt(route.amountIn) !== swapRaw) throw new Error('The zap quote no longer matches the entered amount.');
    state.quote = route;
    setStatus(`Verified V2 quote ready. Approximately half will be swapped to ${otherSymbol(state.token)} before liquidity is created.`, 'success');
  } catch (error) { setStatus(`${error.message || error} No transaction was created.`, 'error'); }
  finally { state.quoting = false; render(); }
}
function scheduleQuote() { clearTimeout(state.timer); state.timer = setTimeout(requestQuote, 300); }

async function simulateTwice(transaction) {
  const bytes = await transaction.build({ client });
  for (let pass = 0; pass < 2; pass += 1) {
    const result = await client.core.simulateTransaction({ transaction: bytes, include: { effects: true, balanceChanges: true, events: true } });
    if (!success(result)) throw new Error(failure(result, `Sui Mainnet simulation ${pass + 1} failed.`));
  }
}
async function signAndFinalize(transaction) {
  if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
  const signed = await window.signAndExecuteTransactionBlock(transaction); const txDigest = digest(signed);
  if (!txDigest) throw new Error('The wallet returned no transaction digest.');
  const finalized = await client.core.waitForTransaction({ digest: txDigest, timeout: 60_000, include: { effects: true, balanceChanges: true, events: true } });
  if (!success(finalized)) throw new Error(failure(finalized, 'The transaction did not finalize successfully.'));
  return txDigest;
}

async function stakeAmount(amount, statusTarget = el.status) {
  const owner = window.playerAddress;
  const transaction = await buildV2StakeTransaction({ Transaction, client, owner, amount });
  statusTarget.textContent = 'Simulating the exact farm stake twice on Sui Mainnet…'; statusTarget.className = 'status warning';
  await simulateTwice(transaction);
  if (!window.confirm(`Stake ${amount.toString()} raw SUI/TREE LP units in the verified TREE farm?\n\nThis is the second and final wallet approval. The exact transaction passed two Mainnet simulations.`)) return null;
  statusTarget.textContent = 'Review the verified SUI/TREE LP stake in your wallet…'; statusTarget.className = 'status warning';
  return signAndFinalize(transaction);
}

async function executeZapAndStake() {
  if (!window.playerAddress) { await window.openWalletManager?.({ mode: 'picker' }); await loadBalances(); return; }
  if (!EXECUTION_ENABLED || state.executing) return;
  if (!state.quote) { await requestQuote(); if (!state.quote) return; }
  const amount = rawAmount(); if (!amount) return;
  if (state.token === 'SUI' && state.balances.SUI < amount + 100_000_000n) { setStatus('Keep at least 0.1 SUI available for both transaction fees.', 'error'); return; }
  if (state.token === 'TREE' && state.balances.TREE < amount) { setStatus('Insufficient TREE balance.', 'error'); return; }
  state.executing = true; render(); el.success.hidden = true;
  try {
    const owner = window.playerAddress; const beforeLp = await getV2LpBalance(client, owner);
    const built = await buildV2ZapTransaction({ Transaction, client, owner, inputType: typeFor(state.token), amountIn: amount, quote: state.quote, slippageBps: state.slippageBps });
    setStatus('Simulating the exact swap-and-liquidity transaction twice on Sui Mainnet…', 'warning');
    await simulateTwice(built.transaction);
    const summary = `${formatRaw(amount, decimalsFor(state.token), 6)} ${state.token}`;
    if (!window.confirm(`Create SUI/TREE V2 liquidity from ${summary}?\n\nStep 1 of 2: swap approximately half and create LP.\nStep 2: after confirmation, TREE will verify and offer to stake only the newly created LP.\n\nThe exact transaction passed two Mainnet simulations.`)) { setStatus('Zap cancelled before wallet approval.'); return; }
    setStatus('Review the verified swap-and-liquidity transaction in your wallet…', 'warning');
    const zapDigest = await signAndFinalize(built.transaction);
    setStatus('Liquidity confirmed. Verifying the newly created LP before staking…', 'warning');
    const afterLp = await getV2LpBalance(client, owner); const newLp = afterLp - beforeLp;
    if (newLp <= 0n) throw new Error('Liquidity was confirmed, but the newly created LP balance could not be verified for staking. Your LP remains safely in your wallet.');
    const stakeDigest = await stakeAmount(newLp);
    if (!stakeDigest) { setStatus('Liquidity was created successfully. Staking was cancelled, so the new LP remains in your wallet.', 'success'); return; }
    el.success.hidden = false;
    el.success.innerHTML = `<strong>Zap &amp; Stake confirmed on Sui Mainnet.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(stakeDigest)}" target="_blank" rel="noopener noreferrer">View stake ${stakeDigest.slice(0, 12)}… ↗</a><small>Liquidity transaction: ${zapDigest.slice(0, 12)}…</small>`;
    setStatus('SUI/TREE liquidity was created and the new LP was staked successfully.', 'success');
    state.amount = ''; el.amount.value = ''; state.quote = null; await loadBalances();
  } catch (error) { const message = String(error?.message || error || 'Zap & Stake failed.'); setStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled. No unconfirmed step was recorded.' : message, 'error'); }
  finally { state.executing = false; render(); }
}

async function stakeExisting() {
  const status = document.getElementById('earnStakeStatus');
  try {
    if (!window.playerAddress) { await window.openWalletManager?.({ mode: 'picker' }); return; }
    if (!EXECUTION_ENABLED) throw new Error('Farm execution is enabled only in the transaction-review preview.');
    const amount = await getV2LpBalance(client, window.playerAddress);
    if (amount <= 0n) throw new Error('No unstaked SUI/TREE V2 LP was found in this wallet.');
    const txDigest = await stakeAmount(amount, status);
    if (!txDigest) { status.textContent = 'Stake cancelled before wallet approval.'; status.className = 'status'; return; }
    status.textContent = `Existing SUI/TREE LP staked successfully. ${txDigest.slice(0, 12)}…`; status.className = 'status success';
  } catch (error) { status.textContent = String(error?.message || error); status.className = 'status error'; }
}

function init() {
  Object.assign(el, { open: document.getElementById('earnV2ZapOpen'), panel: document.getElementById('earnV2ZapPanel'), token: document.getElementById('earnZapToken'), amount: document.getElementById('earnZapAmount'), max: document.getElementById('earnZapMax'), symbol: document.getElementById('earnZapSymbol'), balance: document.getElementById('earnZapBalance'), swap: document.getElementById('earnZapSwap'), liquidity: document.getElementById('earnZapLiquidity'), minimum: document.getElementById('earnZapMinimum'), action: document.getElementById('earnZapAction'), status: document.getElementById('earnZapStatus'), success: document.getElementById('earnZapSuccess') });
  if (!el.open || !el.action) return;
  el.open.addEventListener('click', () => { el.panel.hidden = !el.panel.hidden; el.open.setAttribute('aria-expanded', String(!el.panel.hidden)); if (!el.panel.hidden) loadBalances(); });
  el.token.addEventListener('change', () => { state.token = el.token.value; state.amount = ''; el.amount.value = ''; state.quote = null; setStatus('Enter an amount to build the verified SUI/TREE V2 zap.'); render(); });
  el.amount.addEventListener('input', () => { state.amount = el.amount.value; state.quote = null; render(); scheduleQuote(); });
  el.max.addEventListener('click', () => { let value = state.balances[state.token]; if (state.token === 'SUI') value = value > 100_000_000n ? value - 100_000_000n : 0n; state.amount = formatRaw(value, decimalsFor(state.token), decimalsFor(state.token)); el.amount.value = state.amount; state.quote = null; render(); scheduleQuote(); });
  document.querySelectorAll('[data-earn-slippage]').forEach((button) => button.addEventListener('click', () => { state.slippageBps = Number(button.dataset.earnSlippage); document.querySelectorAll('[data-earn-slippage]').forEach((item) => item.classList.toggle('active', item === button)); state.quote = null; scheduleQuote(); }));
  el.action.addEventListener('click', executeZapAndStake);
  document.getElementById('earnStakeExisting')?.addEventListener('click', stakeExisting);
  document.querySelectorAll('[data-open-panel]').forEach((button) => button.addEventListener('click', () => { location.hash = `#${button.dataset.openPanel}`; }));
  window.addEventListener('tree:wallet-changed', loadBalances);
  render();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();

export { EXECUTION_ENABLED };
