import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import { SuiGrpcClient } from 'https://esm.run/@mysten/sui@2.23.1/grpc';
import {
  SUI_COIN_TYPE, TREE_COIN_TYPE, SUI_DECIMALS, TREE_DECIMALS, MIN_SUI_GAS_RESERVE_RAW,
  TREE_V3_FULL_RANGE, buildCreateTreeV3ZapPosition, decimalToRaw, extractAddLiquidityEvent,
  isTreeV3ExecutionHost, minimumAfterSlippage, optimalV3ZapSwapRaw, ticksFromDisplayedPrices, validateVerifiedPool,
} from './v3-transaction-core.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const EXECUTION_ENABLED = isTreeV3ExecutionHost(location.hostname);
const state = { token: 'SUI', amount: '', range: '20', slippageBps: 100, quote: null, swapRaw: null, pool: null, quoting: false, executing: false, timer: null, balances: { SUI: 0n, TREE: 0n } };
const el = {};

function typeFor(symbol) { return symbol === 'SUI' ? SUI_COIN_TYPE : TREE_COIN_TYPE; }
function decimalsFor(symbol) { return symbol === 'SUI' ? SUI_DECIMALS : TREE_DECIMALS; }
function otherSymbol(symbol) { return symbol === 'SUI' ? 'TREE' : 'SUI'; }
function formatRaw(value, decimals, precision = 6) { const raw = BigInt(value || 0); const scale = 10n ** BigInt(decimals); const whole = raw / scale; const fraction = (raw % scale).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, ''); return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`; }
function rawAmount() { try { return decimalToRaw(state.amount, decimalsFor(state.token)); } catch { return null; } }
function coreTransaction(result) { return result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction || null; }
function succeeded(result) { return coreTransaction(result)?.effects?.status?.success === true || coreTransaction(result)?.status?.success === true; }
function failure(result, fallback) { return result?.FailedTransaction?.status?.error?.message || result?.FailedTransaction?.status?.error || coreTransaction(result)?.effects?.status?.error?.message || coreTransaction(result)?.effects?.status?.error || fallback; }
function digest(result) { return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionBlockDigest || null; }
function setStatus(message, kind = '') { el.status.textContent = message; el.status.className = `status${kind ? ` ${kind}` : ''}`; }

function selectedTicks() {
  if (!state.pool) throw new Error('The verified V3 pool is still loading.');
  if (state.range === 'full') return TREE_V3_FULL_RANGE;
  const currentPrice = Number(state.pool.priceSuiPerTree); const percentage = Number(state.range) / 100;
  return ticksFromDisplayedPrices({ currentTick: Number(state.pool.currentTick), currentPrice, minPrice: currentPrice * (1 - percentage), maxPrice: currentPrice * (1 + percentage), tickSpacing: Number(state.pool.tickSpacing), displayedPriceIncreasesWithTick: false });
}
function rangeText() {
  if (!state.pool) return '—';
  if (state.range === 'full') return 'Full protocol range';
  const price = Number(state.pool.priceSuiPerTree); const ratio = Number(state.range) / 100;
  return `${(price * (1 - ratio)).toPrecision(6)} – ${(price * (1 + ratio)).toPrecision(6)} SUI/TREE`;
}
async function balance(symbol) { if (!window.playerAddress) return 0n; const result = await client.core.getBalance({ owner: window.playerAddress, coinType: typeFor(symbol) }); return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0); }
async function loadBalances() { if (!window.playerAddress) { state.balances = { SUI: 0n, TREE: 0n }; render(); return; } try { const [SUI, TREE] = await Promise.all([balance('SUI'), balance('TREE')]); state.balances = { SUI, TREE }; } catch { setStatus('Wallet balances could not be refreshed.', 'error'); } render(); }
async function loadPool() { try { const response = await fetch('/api/tree-v3-overview', { cache: 'no-store', headers: { Accept: 'application/json' } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`The verified V3 pool service returned ${response.status}.`); validateVerifiedPool(payload?.pool); state.pool = payload.pool; setStatus('Verified SUI/TREE V3 pool ready. Enter an amount to create a position.', 'success'); } catch (error) { setStatus(String(error?.message || error), 'error'); } render(); }

function render() {
  if (!el.action) return;
  const amount = rawAmount(); const route = state.quote;
  el.symbol.textContent = state.token;
  el.balance.textContent = window.playerAddress ? `Balance ${formatRaw(state.balances[state.token], decimalsFor(state.token), 6)} ${state.token}` : 'Balance —';
  el.current.textContent = state.pool ? `${state.pool.priceSuiPerTree} SUI / TREE` : 'Loading…';
  el.rangeText.textContent = rangeText();
  el.swap.textContent = amount && state.swapRaw ? `≈ ${formatRaw(state.swapRaw, decimalsFor(state.token), 6)} ${state.token}` : amount ? 'Calculating…' : '—';
  el.minimum.textContent = route ? `${formatRaw(route.minAmountOut, decimalsFor(otherSymbol(state.token)), 6)} ${otherSymbol(state.token)}` : '—';
  if (state.executing) { el.action.disabled = true; el.action.textContent = 'Working…'; return; }
  if (!window.playerAddress) { el.action.disabled = false; el.action.textContent = 'Connect Wallet'; return; }
  if (!EXECUTION_ENABLED) { el.action.disabled = true; el.action.textContent = 'V3 transactions unavailable'; return; }
  if (!state.pool || !amount || !route) { el.action.disabled = true; el.action.textContent = state.quoting ? 'Loading quote…' : 'Enter an amount'; return; }
  el.action.disabled = false; el.action.textContent = 'Review V3 Zap';
}

async function requestQuote() {
  const amount = rawAmount(); state.quote = null; state.swapRaw = null;
  if (!amount) { setStatus('Enter an amount to build the verified SUI/TREE V3 zap.'); render(); return; }
  const probeRaw = amount / 2n; if (probeRaw <= 0n) { setStatus('The zap amount is too small.', 'error'); render(); return; }
  state.quoting = true; render();
  try {
    if (!state.pool) throw new Error('The verified V3 pool is still loading.');
    const fetchRoute = async (swapAmount) => {
      const query = new URLSearchParams({ tokenIn: typeFor(state.token), tokenOut: typeFor(otherSymbol(state.token)), amountIn: swapAmount.toString(), slippageBps: String(state.slippageBps) });
      const response = await fetch(`/api/tree-swap-quote?${query}`, { cache: 'no-store', headers: { Accept: 'application/json' } }); const payload = await response.json().catch(() => ({}));
      const route = Array.isArray(payload.routes) ? payload.routes.find((candidate) => candidate.executionKind === 'suidex-v3-direct') : null;
      if (!response.ok || payload.status !== 'ok' || !route) throw new Error(payload.message || 'A verified V3 zap quote is unavailable.');
      if (String(route.pairId).toLowerCase() !== '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf' || BigInt(route.amountIn) !== swapAmount || BigInt(route.amountOut) <= 0n || BigInt(route.minAmountOut) <= 0n) throw new Error('The V3 quote does not match the verified SUI/TREE pool and amount.');
      return route;
    };
    const probe = await fetchRoute(probeRaw); const { lower: tickLower, upper: tickUpper } = selectedTicks();
    const optimizedRaw = optimalV3ZapSwapRaw({ amountIn: amount, inputType: typeFor(state.token), tickLower, tickUpper, sqrtPriceRaw: state.pool.sqrtPriceRaw, probeAmountIn: probeRaw, probeAmountOut: BigInt(probe.amountOut) });
    const route = optimizedRaw === probeRaw ? probe : await fetchRoute(optimizedRaw);
    state.swapRaw = optimizedRaw; state.quote = route; setStatus(`Optimized V3 ratio ready. One approval will create the ${rangeText()} position with minimal unused tokens.`, 'success');
  } catch (error) { setStatus(`${error.message || error} No transaction was created.`, 'error'); }
  finally { state.quoting = false; render(); }
}
function scheduleQuote() { clearTimeout(state.timer); state.timer = setTimeout(requestQuote, 300); }
async function simulate(transaction) { const bytes = await transaction.build({ client }); return client.core.simulateTransaction({ transaction: bytes, include: { effects: true, balanceChanges: true, events: true } }); }
async function signAndFinalize(transaction) { if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.'); const signed = await window.signAndExecuteTransactionBlock(transaction); const txDigest = digest(signed); if (!txDigest) throw new Error('The wallet returned no transaction digest.'); const finalized = await client.core.waitForTransaction({ digest: txDigest, timeout: 60_000, include: { effects: true, balanceChanges: true, events: true } }); if (!succeeded(finalized)) throw new Error(failure(finalized, 'The V3 zap did not finalize successfully.')); return txDigest; }

async function execute() {
  if (!window.playerAddress) { await window.openWalletManager?.({ mode: 'picker' }); await loadBalances(); return; }
  if (!EXECUTION_ENABLED || state.executing) return;
  if (!state.quote) { await requestQuote(); if (!state.quote) return; }
  const amountIn = rawAmount(); if (!amountIn) return;
  if (state.token === 'SUI' && state.balances.SUI < amountIn + MIN_SUI_GAS_RESERVE_RAW) { setStatus('Keep at least 0.05 SUI available for transaction gas.', 'error'); return; }
  if (state.token === 'TREE' && state.balances.TREE < amountIn) { setStatus('Insufficient TREE balance.', 'error'); return; }
  state.executing = true; render(); el.success.hidden = true;
  try {
    const owner = window.playerAddress; const swapRaw = state.swapRaw; const { lower: tickLower, upper: tickUpper } = selectedTicks();
    if (!swapRaw || BigInt(state.quote.amountIn) !== swapRaw) throw new Error('The optimized V3 ratio quote has expired. Refresh the amount and try again.');
    const base = { Transaction, client, owner, inputType: typeFor(state.token), amountIn, swapRaw, minSwapOutRaw: BigInt(state.quote.minAmountOut), tickLower, tickUpper };
    setStatus('Running a preliminary Sui Mainnet simulation to measure the exact position deposits…', 'warning');
    const preliminaryTx = await buildCreateTreeV3ZapPosition(base); const preliminarySimulation = await simulate(preliminaryTx);
    if (!succeeded(preliminarySimulation)) throw new Error(failure(preliminarySimulation, 'The proposed V3 zap failed Sui Mainnet simulation.'));
    const added = extractAddLiquidityEvent(preliminarySimulation); if (!added) throw new Error('SuiDex did not return verified V3 deposit amounts during simulation.');
    const finalTx = await buildCreateTreeV3ZapPosition({ ...base, minSuiRaw: minimumAfterSlippage(added.suiRaw, state.slippageBps), minTreeRaw: minimumAfterSlippage(added.treeRaw, state.slippageBps) });
    setStatus('Running two final Sui Mainnet safety simulations…', 'warning');
    for (let pass = 0; pass < 2; pass += 1) { const result = await simulate(finalTx); if (!succeeded(result) || !extractAddLiquidityEvent(result)) throw new Error(failure(result, `Final V3 simulation ${pass + 1} failed.`)); }
    const summary = `${formatRaw(amountIn, decimalsFor(state.token), 6)} ${state.token}`;
    if (!window.confirm(`Create a SUI/TREE V3 position from ${summary}?\n\nRange: ${rangeText()}\nTicks: ${tickLower} to ${tickUpper}\nWallet approvals: 1\n\nThe exact transaction passed two final Sui Mainnet simulations.`)) { setStatus('V3 zap cancelled before wallet approval.'); return; }
    setStatus('Review the verified V3 zap and position transaction in your wallet…', 'warning'); const txDigest = await signAndFinalize(finalTx);
    el.success.hidden = false; el.success.innerHTML = `<strong>V3 position confirmed on Sui Mainnet.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(txDigest)}" target="_blank" rel="noopener noreferrer">View ${txDigest.slice(0, 12)}… ↗</a><small>V3 incentives are attached directly to this position.</small>`;
    setStatus('Your SUI/TREE V3 position was created successfully.', 'success'); state.amount = ''; el.amount.value = ''; state.quote = null; state.swapRaw = null; await loadBalances();
  } catch (error) { const message = String(error?.message || error || 'V3 zap failed.'); setStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled.' : message, 'error'); }
  finally { state.executing = false; render(); }
}

function init() {
  Object.assign(el, { open: document.getElementById('earnV3ZapOpen'), panel: document.getElementById('earnV3ZapPanel'), token: document.getElementById('earnV3ZapToken'), amount: document.getElementById('earnV3ZapAmount'), max: document.getElementById('earnV3ZapMax'), symbol: document.getElementById('earnV3ZapSymbol'), balance: document.getElementById('earnV3ZapBalance'), range: document.getElementById('earnV3ZapRange'), current: document.getElementById('earnV3ZapCurrent'), rangeText: document.getElementById('earnV3ZapRangeText'), swap: document.getElementById('earnV3ZapSwap'), minimum: document.getElementById('earnV3ZapMinimum'), action: document.getElementById('earnV3ZapAction'), status: document.getElementById('earnV3ZapStatus'), success: document.getElementById('earnV3ZapSuccess') });
  if (!el.open || !el.action || el.open.dataset.v3ZapBound === 'true') return;
  el.open.dataset.v3ZapBound = 'true';
  el.open.addEventListener('click', () => { el.panel.hidden = !el.panel.hidden; el.open.setAttribute('aria-expanded', String(!el.panel.hidden)); if (!el.panel.hidden) { loadPool(); loadBalances(); } });
  el.token.addEventListener('change', () => { state.token = el.token.value; state.amount = ''; el.amount.value = ''; state.quote = null; state.swapRaw = null; setStatus('Enter an amount to build the verified SUI/TREE V3 zap.'); render(); });
  el.amount.addEventListener('input', () => { state.amount = el.amount.value; state.quote = null; state.swapRaw = null; render(); scheduleQuote(); });
  el.max.addEventListener('click', () => { let value = state.balances[state.token]; if (state.token === 'SUI') value = value > MIN_SUI_GAS_RESERVE_RAW ? value - MIN_SUI_GAS_RESERVE_RAW : 0n; state.amount = formatRaw(value, decimalsFor(state.token), decimalsFor(state.token)); el.amount.value = state.amount; state.quote = null; state.swapRaw = null; render(); scheduleQuote(); });
  el.range.addEventListener('change', () => { state.range = el.range.value; state.quote = null; state.swapRaw = null; render(); scheduleQuote(); });
  document.querySelectorAll('[data-earn-v3-slippage]').forEach((button) => button.addEventListener('click', () => { state.slippageBps = Number(button.dataset.earnV3Slippage); document.querySelectorAll('[data-earn-v3-slippage]').forEach((item) => item.classList.toggle('active', item === button)); state.quote = null; state.swapRaw = null; scheduleQuote(); }));
  el.action.addEventListener('click', execute); window.addEventListener('tree:wallet-changed', loadBalances); render();
  if (!el.panel.hidden) { loadPool(); loadBalances(); }
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();
document.addEventListener('tree:v3-workspace-ready', init);
