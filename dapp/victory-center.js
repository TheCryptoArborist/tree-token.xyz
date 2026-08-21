import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import { SuiGrpcClient } from 'https://esm.run/@mysten/sui@2.23.1/grpc';
import { bcs } from 'https://esm.run/@mysten/sui@2.23.1/bcs';
import { confirmTransaction } from './transaction-review.js';
import {
  SUI_TYPE, V2_POOL, VICTORY_DECIMALS, VICTORY_SUI_POOL, VICTORY_TYPE,
  buildV2StakeTransaction, buildVictoryV2ReinvestTransaction, extractPositiveV2Lp, getV2LpBalance,
  parseAmount, quoteVictoryV2Reinvest,
} from './earn-transactions-core.js';
import {
  VICTORY_LOCKER, VICTORY_LOCKED_VAULT, VICTORY_REWARD_VAULT, VICTORY_SUI_REWARD_VAULT,
  buildSuiClaimPreviewTransaction, buildSuiRewardsClaimTransaction, buildVictoryEmissionPreviewTransaction,
  buildVictoryLockTransaction, buildVictoryRewardsClaimTransaction, buildVictoryUnlockTransaction, buildVictoryV2SustainableReinvestTransaction, calculateVictoryAprs, decodeSuiClaimPreview,
  decodeVictoryEmissionRate, extractSuiClaimedFromEvents, extractVictoryClaimEvents, extractVictoryClaimed,
  extractVictoryLockEvent, extractVictoryLocked, extractVictoryUnlockEvent, getVictoryLocks, parseVictoryLockerSnapshot,
} from './victory-transaction-core.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const EXECUTION_ENABLED = ['tree-token.xyz', 'www.tree-token.xyz'].includes(location.hostname.toLowerCase())
  || /^deploy-preview-\d+--tree-token\.netlify\.app$/i.test(location.hostname)
  || /^[a-f0-9]+--tree-token\.netlify\.app$/i.test(location.hostname)
  || ['localhost', '127.0.0.1'].includes(location.hostname);
const LOCAL_LOCKS_PREVIEW = ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).get('victory-locks-preview') === '1';
const state = {
  amount: '', lockDays: 90, activeView: 'locker', victoryBalance: 0n, suiBalance: 0n,
  snapshot: null, emissionRateRaw: null, aprs: null, locks: [], victoryByLock: new Map(), suiClaims: [],
  claimableVictoryRaw: null, claimableSuiRaw: null, victoryPreviewError: '', suiPreviewError: '',
  loading: false, executing: false, claiming: '', unlockingLockId: '',
  reinvest: { amount: '', mode: 'complete', reinvestBps: 5_000, lockDays: 90, slippageBps: 100, quote: null, quoting: false, executing: false, timer: null },
};
const el = {};
const TERM_LABELS = Object.freeze({ 7: '7 days', 90: '90 days', 365: '1 year', 1095: '3 years' });

function formatRaw(value, decimals, precision = 2) {
  const raw = BigInt(value || 0); const scale = 10n ** BigInt(decimals); const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`;
}
function formatApr(value) {
  if (value === null || value === undefined) return '—';
  const hundredths = BigInt(value); return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}%`;
}
function formatDate(timestampSeconds) {
  return new Date(Number(BigInt(timestampSeconds) * 1000n)).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
function coreTransaction(result) { return result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction || null; }
function success(result) { return coreTransaction(result)?.effects?.status?.success === true || coreTransaction(result)?.status?.success === true; }
function failure(result, fallback) { return result?.FailedTransaction?.status?.error?.message || result?.FailedTransaction?.status?.error || coreTransaction(result)?.effects?.status?.error?.message || coreTransaction(result)?.effects?.status?.error || coreTransaction(result)?.status?.error?.message || coreTransaction(result)?.status?.error || fallback; }
function digest(result) { return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionBlockDigest || null; }
function setStatus(message, kind = '') { el.status.textContent = message; el.status.className = `status${kind ? ` ${kind}` : ''}`; }
function rawAmount() { try { return parseAmount(state.amount, VICTORY_DECIMALS, 'VICTORY'); } catch { return null; } }
function unlockDateForDays(days) { return new Date(Date.now() + Number(days) * 86_400_000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
function unlockDate() { return unlockDateForDays(state.lockDays); }
function objectJson(result) { return result?.object?.json ?? result?.json ?? null; }
function totalSuiEpochs() { return state.suiClaims.reduce((total, claim) => total + claim.epochs.length, 0); }

function updateLocksBackToTop() {
  if (!el.backToTop || !el.centerCard || !el.lockList) return;
  const viewingLocks = state.activeView === 'locks' && !el.locksView.hidden;
  const longList = el.lockList.scrollHeight > window.innerHeight * 0.8;
  const pastTop = el.centerCard.getBoundingClientRect().top < -180;
  el.backToTop.hidden = !(viewingLocks && longList && pastTop);
}

function scrollLocksToTop() {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.centerCard.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  el.locksTab.focus({ preventScroll: true });
}

function showVictoryView(view) {
  state.activeView = ['locks', 'reinvest'].includes(view) ? view : 'locker';
  el.lockerView.hidden = state.activeView !== 'locker'; el.locksView.hidden = state.activeView !== 'locks'; el.reinvestView.hidden = state.activeView !== 'reinvest';
  for (const [name, tab] of [['locker', el.lockerTab], ['locks', el.locksTab], ['reinvest', el.reinvestTab]]) {
    const active = name === state.activeView; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active));
  }
  queueMicrotask(updateLocksBackToTop);
}

function renderAprs() {
  document.querySelectorAll('[data-victory-apr]').forEach((target) => {
    const entry = state.aprs?.[Number(target.dataset.victoryApr)]; target.textContent = entry ? formatApr(entry.aprHundredths) : '—';
  });
  document.querySelectorAll('[data-victory-term]').forEach((button) => button.classList.toggle('active', Number(button.dataset.victoryTerm) === state.lockDays));
  document.querySelectorAll('[data-victory-term-option]').forEach((option) => {
    const term = Number(option.dataset.victoryTermOption); const apr = state.aprs?.[term];
    option.textContent = `${TERM_LABELS[term]}${apr ? ` · ${formatApr(apr.aprHundredths)} VICTORY APR` : ''}`;
  });
  el.emissionRate.textContent = state.emissionRateRaw === null ? '—' : `${formatRaw(state.emissionRateRaw, VICTORY_DECIMALS, 6)} VICTORY/sec`;
}

function renderLocks() {
  const connected = Boolean(window.playerAddress);
  el.myLockCount.textContent = connected ? state.locks.length.toLocaleString() : '—';
  el.claimableVictory.textContent = state.claimableVictoryRaw === null ? '—' : `${formatRaw(state.claimableVictoryRaw, VICTORY_DECIMALS, 6)} VICTORY`;
  el.claimableSui.textContent = state.claimableSuiRaw === null ? '—' : `${formatRaw(state.claimableSuiRaw, 9, 6)} SUI`;
  if (!connected) { el.lockList.innerHTML = '<p class="victory-lock-empty">Connect your wallet to load its current VICTORY locks and rewards.</p>'; }
  else if (state.loading && !state.locks.length) { el.lockList.innerHTML = '<p class="victory-lock-empty">Loading your VICTORY locks and reward previews from Sui Mainnet…</p>'; }
  else if (!state.locks.length) { el.lockList.innerHTML = '<p class="victory-lock-empty">No current xVICTORY locks were found for this wallet.</p>'; }
  else {
    const now = BigInt(Math.floor(Date.now() / 1000));
    el.lockList.innerHTML = state.locks.map((lock) => {
      const lockId = lock.id.toString(); const victoryRaw = state.victoryByLock.get(lockId); const sui = state.suiClaims.find((claim) => claim.lockId === lock.id);
      const unlockReady = now >= lock.lockEnd;
      const unlocking = state.unlockingLockId === lockId;
      const action = unlockReady ? `<div class="victory-user-lock-actions"><button class="button gold victory-unlock-action" type="button" data-victory-unlock="${lockId}" ${state.loading || state.executing || state.claiming || state.unlockingLockId ? 'disabled' : ''}>${unlocking ? 'Unlocking…' : 'Unlock & Collect'}</button><small>Claims this lock's available weekly SUI first, then returns its VICTORY principal and final emission reward in the same wallet transaction.</small></div>` : '';
      return `<article class="victory-user-lock"><div class="victory-user-lock-head"><strong>Lock #${lockId}</strong><span class="${unlockReady ? 'unlock-ready' : ''}">${unlockReady ? 'Unlock ready' : 'Locked'}</span></div><div class="victory-user-lock-grid"><div><span>Principal</span><strong>${formatRaw(lock.amountRaw, VICTORY_DECIMALS, 6)} VICTORY</strong></div><div><span>Term</span><strong>${TERM_LABELS[lock.lockPeriod] || `${lock.lockPeriod} days`}</strong></div><div><span>Exact unlock date</span><strong>${formatDate(lock.lockEnd)}</strong></div><div><span>Claimable VICTORY</span><strong>${victoryRaw === undefined ? '—' : `${formatRaw(victoryRaw, VICTORY_DECIMALS, 6)} VICTORY`}</strong></div><div><span>Claimable weekly SUI</span><strong>${sui ? `${formatRaw(sui.totalRaw, 9, 6)} SUI` : '—'}</strong></div><div><span>Claimable SUI epochs</span><strong>${sui ? sui.epochs.length.toLocaleString() : '—'}</strong></div><div><span>VICTORY claimed to date</span><strong>${formatRaw(lock.totalVictoryClaimedRaw, VICTORY_DECIMALS, 6)} VICTORY</strong></div><div><span>SUI epochs claimed</span><strong>${lock.claimedSuiEpochs.length.toLocaleString()}</strong></div></div>${action}</article>`;
    }).join('');
  }
}

function openLocalLocksPreview() {
  if (!LOCAL_LOCKS_PREVIEW) return false;
  showVictoryView('locks'); el.myLockCount.textContent = '14'; el.claimableVictory.textContent = 'Preview'; el.claimableSui.textContent = 'Preview';
  el.lockList.innerHTML = Array.from({ length: 14 }, (_, index) => `<article class="victory-user-lock"><div class="victory-user-lock-head"><strong>Preview lock #${index + 1}</strong><span>Locked</span></div><div class="victory-user-lock-grid"><div><span>Principal</span><strong>${(10_000 + index * 500).toLocaleString()} VICTORY</strong></div><div><span>Exact unlock date</span><strong>November 19, 2026</strong></div></div></article>`).join('');
  queueMicrotask(updateLocksBackToTop); return true;
}

function reinvestRawAmount() { try { return parseAmount(state.reinvest.amount, VICTORY_DECIMALS, 'VICTORY'); } catch { return null; } }
function reinvestAmounts() {
  const totalRaw = reinvestRawAmount(); if (!totalRaw) return { totalRaw: null, reinvestRaw: null, lockRaw: 0n };
  if (state.reinvest.mode !== 'sustainable') return { totalRaw, reinvestRaw: totalRaw, lockRaw: 0n };
  const reinvestRaw = totalRaw * BigInt(state.reinvest.reinvestBps) / 10_000n;
  return { totalRaw, reinvestRaw, lockRaw: totalRaw - reinvestRaw };
}
function setReinvestStatus(message, kind = '') { el.reinvestStatus.textContent = message; el.reinvestStatus.className = `status${kind ? ` ${kind}` : ''}`; }
function formatImpactBps(value) { const bps = BigInt(value || 0); return `${bps / 100n}.${(bps % 100n).toString().padStart(2, '0')}%`; }
function renderReinvest() {
  const connected = Boolean(window.playerAddress); const amounts = reinvestAmounts(); const amount = amounts.totalRaw; const quote = state.reinvest.quote; const sustainable = state.reinvest.mode === 'sustainable';
  el.reinvestBalance.textContent = connected ? `Available ${formatRaw(state.victoryBalance, VICTORY_DECIMALS, 6)} VICTORY` : 'Available —';
  el.reinvestAmountLabel.textContent = sustainable ? 'Wallet VICTORY to split' : 'Wallet VICTORY to reinvest';
  el.sustainableControls.hidden = !sustainable; el.reinvestPercent.textContent = `${state.reinvest.reinvestBps / 100}%`; el.lockPercent.textContent = `${100 - state.reinvest.reinvestBps / 100}%`;
  el.reinvestSplit.value = String(state.reinvest.reinvestBps / 100); el.sustainableLockTerm.value = String(state.reinvest.lockDays); el.sustainableUnlockDate.textContent = sustainable ? unlockDateForDays(state.reinvest.lockDays) : '—';
  el.reinvestAllocation.textContent = amounts.reinvestRaw ? `${formatRaw(amounts.reinvestRaw, VICTORY_DECIMALS, 6)} VICTORY` : '—'; el.lockAllocation.textContent = amounts.lockRaw > 0n ? `${formatRaw(amounts.lockRaw, VICTORY_DECIMALS, 6)} VICTORY` : 'None';
  el.reinvestApprovals.textContent = sustainable ? '2 · Split + lock + liquidity, then stake' : '2 · Liquidity, then stake';
  document.querySelectorAll('[data-victory-reinvest-mode]').forEach((button) => { const active = button.dataset.victoryReinvestMode === state.reinvest.mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  document.querySelectorAll('[data-victory-reinvest-split]').forEach((button) => button.classList.toggle('active', Number(button.dataset.victoryReinvestSplit) * 100 === state.reinvest.reinvestBps));
  el.reinvestSuiMin.textContent = quote ? `${formatRaw(quote.victoryToSui.minAmountOut, 9, 9)} SUI` : '—';
  el.reinvestTreeMin.textContent = quote ? `${formatRaw(quote.suiToTree.minAmountOut, 6, 6)} TREE` : '—';
  el.reinvestImpact.textContent = quote ? formatImpactBps(quote.victoryToSui.priceImpactBps + quote.suiToTree.priceImpactBps) : '—';
  document.querySelectorAll('[data-victory-reinvest-slippage]').forEach((button) => button.classList.toggle('active', Number(button.dataset.victoryReinvestSlippage) === state.reinvest.slippageBps));
  if (state.reinvest.executing) { el.reinvestAction.disabled = true; el.reinvestAction.textContent = 'Reinvesting…'; }
  else if (!connected) { el.reinvestAction.disabled = false; el.reinvestAction.textContent = 'Connect Wallet'; }
  else if (!EXECUTION_ENABLED) { el.reinvestAction.disabled = true; el.reinvestAction.textContent = 'Reinvest unavailable'; }
  else if (!amount) { el.reinvestAction.disabled = true; el.reinvestAction.textContent = state.reinvest.quoting ? 'Loading quote…' : 'Enter an amount'; }
  else if (amount > state.victoryBalance) { el.reinvestAction.disabled = true; el.reinvestAction.textContent = 'Insufficient VICTORY'; }
  else if (state.reinvest.quoting || !quote) { el.reinvestAction.disabled = true; el.reinvestAction.textContent = 'Loading quote…'; }
  else { el.reinvestAction.disabled = false; el.reinvestAction.textContent = sustainable ? 'Review Sustainable Reinvest' : 'Review Complete Reinvest'; }
}

function render() {
  const connected = Boolean(window.playerAddress); const amount = rawAmount(); const busy = state.loading || state.executing || Boolean(state.claiming) || Boolean(state.unlockingLockId) || state.reinvest.executing;
  el.walletBalance.textContent = connected ? `${formatRaw(state.victoryBalance, VICTORY_DECIMALS, 4)} VICTORY` : 'Connect wallet';
  el.totalLocked.textContent = state.snapshot ? `${formatRaw(state.snapshot.totalLockedRaw, VICTORY_DECIMALS, 0)} VICTORY` : '—';
  el.activeLocks.textContent = state.snapshot ? state.snapshot.activeLocks.toLocaleString() : '—';
  el.rewardVault.textContent = state.snapshot ? `${formatRaw(state.snapshot.victoryRewardsRaw, VICTORY_DECIMALS, 0)} VICTORY` : '—';
  el.suiVault.textContent = state.snapshot ? `${formatRaw(state.snapshot.suiRewardsRaw, 9, 2)} SUI` : '—';
  el.unlockDate.textContent = unlockDate(); el.balance.textContent = connected ? `Available ${formatRaw(state.victoryBalance, VICTORY_DECIMALS, 4)} VICTORY` : 'Available —';
  el.refresh.disabled = busy; renderAprs(); renderLocks();
  if (state.executing) { el.action.disabled = true; el.action.textContent = 'Locking…'; }
  else if (!connected) { el.action.disabled = false; el.action.textContent = 'Connect Wallet'; }
  else if (!EXECUTION_ENABLED) { el.action.disabled = true; el.action.textContent = 'VICTORY locking unavailable'; }
  else if (!amount) { el.action.disabled = true; el.action.textContent = 'Enter an amount'; }
  else if (amount > state.victoryBalance) { el.action.disabled = true; el.action.textContent = 'Insufficient VICTORY'; }
  else { el.action.disabled = busy; el.action.textContent = 'Review VICTORY Lock'; }
  el.claimRewards.disabled = busy || (connected && (state.claimableVictoryRaw === null || state.claimableVictoryRaw <= 0n));
  el.claimRewards.textContent = state.claiming === 'victory' ? 'Claiming…' : !connected ? 'Connect Wallet' : state.victoryPreviewError ? 'Preview unavailable' : 'Claim VICTORY Rewards';
  el.claimSui.disabled = busy || (connected && (state.claimableSuiRaw === null || state.claimableSuiRaw <= 0n));
  el.claimSui.textContent = state.claiming === 'sui' ? 'Claiming…' : !connected ? 'Connect Wallet' : state.suiPreviewError ? 'Preview unavailable' : 'Claim Weekly SUI';
  renderReinvest();
}

async function balance(owner, coinType) {
  if (!owner) return 0n;
  const result = await client.core.getBalance({ owner, coinType });
  return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0);
}
async function simulateNoGas(transaction, include) {
  const result = await client.core.simulateTransaction({ transaction, checksEnabled: false, include });
  if (!success(result)) throw new Error(failure(result, 'The read-only Sui Mainnet preview failed.'));
  return result;
}

async function load() {
  if (state.loading) return;
  const requestedOwner = window.playerAddress || null; state.loading = true;
  state.victoryPreviewError = ''; state.suiPreviewError = ''; render();
  try {
    const emissionTransaction = buildVictoryEmissionPreviewTransaction({ Transaction });
    const [locker, vault, victoryRewards, suiRewards, emission, victoryBalance, suiBalance] = await Promise.all([
      client.core.getObject({ objectId: VICTORY_LOCKER, include: { json: true } }),
      client.core.getObject({ objectId: VICTORY_LOCKED_VAULT, include: { json: true } }),
      client.core.getObject({ objectId: VICTORY_REWARD_VAULT, include: { json: true } }),
      client.core.getObject({ objectId: VICTORY_SUI_REWARD_VAULT, include: { json: true } }),
      simulateNoGas(emissionTransaction, { effects: true, commandResults: true }),
      requestedOwner ? balance(requestedOwner, VICTORY_TYPE) : 0n,
      requestedOwner ? balance(requestedOwner, SUI_TYPE) : 0n,
    ]);
    const lockerJson = objectJson(locker);
    state.snapshot = parseVictoryLockerSnapshot({ lockerJson, vaultJson: objectJson(vault), victoryRewardJson: objectJson(victoryRewards), suiRewardJson: objectJson(suiRewards) });
    state.emissionRateRaw = decodeVictoryEmissionRate(emission, bcs); state.aprs = calculateVictoryAprs(state.snapshot, state.emissionRateRaw);
    state.victoryBalance = BigInt(victoryBalance); state.suiBalance = BigInt(suiBalance); state.locks = []; state.victoryByLock = new Map(); state.suiClaims = [];
    state.claimableVictoryRaw = requestedOwner ? 0n : null; state.claimableSuiRaw = requestedOwner ? 0n : null;
    if (requestedOwner) {
      state.locks = await getVictoryLocks({ client, owner: requestedOwner, lockerJson, bcs });
      if (state.locks.length) {
        const rewardPreview = buildVictoryRewardsClaimTransaction({ Transaction, owner: requestedOwner, locks: state.locks });
        const suiPreview = buildSuiClaimPreviewTransaction({ Transaction, owner: requestedOwner, locks: state.locks });
        const [rewardResult, suiResult] = await Promise.allSettled([
          simulateNoGas(rewardPreview, { effects: true, balanceChanges: true, events: true }),
          simulateNoGas(suiPreview, { effects: true, commandResults: true }),
        ]);
        if (rewardResult.status === 'fulfilled') {
          state.claimableVictoryRaw = extractVictoryClaimed(rewardResult.value, requestedOwner);
          state.victoryByLock = extractVictoryClaimEvents(rewardResult.value, requestedOwner);
        } else { state.claimableVictoryRaw = null; state.victoryPreviewError = 'VICTORY reward preview unavailable.'; }
        if (suiResult.status === 'fulfilled') {
          state.suiClaims = decodeSuiClaimPreview(suiResult.value, state.locks, bcs);
          state.claimableSuiRaw = state.suiClaims.reduce((total, claim) => total + claim.totalRaw, 0n);
        } else { state.claimableSuiRaw = null; state.suiPreviewError = 'Weekly SUI preview unavailable.'; }
      }
    }
    const previewWarning = [state.victoryPreviewError, state.suiPreviewError].filter(Boolean).join(' ');
    setStatus(previewWarning || `Live Sui Mainnet locker, APR, lock, and reward data loaded · epoch ${state.snapshot.currentEpoch.toLocaleString()}.`, previewWarning ? 'warning' : 'success');
  } catch (error) { setStatus(String(error?.message || error || 'Live VICTORY locker data could not be loaded.'), 'error'); }
  finally {
    state.loading = false; render();
    if ((window.playerAddress || null) !== requestedOwner) queueMicrotask(load);
  }
}

async function simulateTwice(transaction) {
  const bytes = await transaction.build({ client }); let verified = null;
  for (let pass = 0; pass < 2; pass += 1) {
    const result = await client.core.simulateTransaction({ transaction: bytes, include: { effects: true, balanceChanges: true, events: true } });
    if (!success(result)) throw new Error(failure(result, `Sui Mainnet simulation ${pass + 1} failed.`)); verified = result;
  }
  return verified;
}
async function submitAndFinalize(transaction) {
  if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
  const signed = await window.signAndExecuteTransactionBlock(transaction); const txDigest = digest(signed);
  if (!txDigest) throw new Error('The wallet returned no transaction digest.');
  const finalized = await client.core.waitForTransaction({ digest: txDigest, timeout: 60_000, include: { effects: true, balanceChanges: true, events: true } });
  if (!success(finalized)) throw new Error(failure(finalized, 'The transaction did not finalize successfully.'));
  return { txDigest, finalized };
}
async function connectIfNeeded() { if (!window.playerAddress) { await window.openWalletManager?.({ mode: 'picker' }); if (window.playerAddress) await load(); } return Boolean(window.playerAddress); }

async function executeLock() {
  if (!(await connectIfNeeded()) || !EXECUTION_ENABLED || state.executing) return;
  const amount = rawAmount(); if (!amount) return;
  if (amount > state.victoryBalance) { setStatus('Insufficient VICTORY balance.', 'error'); return; }
  if (state.suiBalance < 50_000_000n) { setStatus('Keep at least 0.05 SUI available for network gas.', 'error'); return; }
  state.executing = true; el.success.hidden = true; render();
  try {
    const owner = window.playerAddress; const built = await buildVictoryLockTransaction({ Transaction, client, owner, amount, lockDays: state.lockDays });
    setStatus('Simulating the exact VICTORY lock twice on Sui Mainnet…', 'warning'); const simulation = await simulateTwice(built.transaction);
    if (extractVictoryLocked(simulation, owner) !== amount) throw new Error('The simulation did not verify the exact VICTORY amount being locked.');
    const readable = formatRaw(amount, VICTORY_DECIMALS, VICTORY_DECIMALS); const apr = state.aprs?.[state.lockDays];
    if (!(await confirmTransaction(`Lock ${readable} VICTORY for ${state.lockDays.toLocaleString()} days?\n\nCurrent VICTORY emissions APR: ${apr ? formatApr(apr.aprHundredths) : 'unavailable'}\nEstimated unlock: ${unlockDate()}\n\nLocked VICTORY cannot be withdrawn early. The exact transaction passed two Sui Mainnet simulations.`, { title: 'Create xVICTORY Lock', confirmLabel: 'Continue to Wallet' }))) { setStatus('VICTORY lock cancelled before wallet approval.'); return; }
    if (window.playerAddress !== owner) throw new Error('The connected wallet changed before approval.');
    setStatus(`Review the ${readable} VICTORY lock in your wallet…`, 'warning'); const { txDigest, finalized } = await submitAndFinalize(built.transaction);
    if (extractVictoryLocked(finalized, owner) !== amount) throw new Error('The transaction finalized without the exact verified VICTORY lock balance change.');
    el.success.hidden = false; el.success.innerHTML = `<strong>${readable} VICTORY locked for ${state.lockDays.toLocaleString()} days.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(txDigest)}" target="_blank" rel="noopener noreferrer">View ${txDigest.slice(0, 12)}… ↗</a>`;
    state.amount = ''; el.amount.value = ''; setStatus('Your VICTORY lock was confirmed on Sui Mainnet.', 'success'); await load(); showVictoryView('locks');
  } catch (error) { const message = String(error?.message || error || 'VICTORY lock failed.'); setStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled.' : message, 'error'); }
  finally { state.executing = false; render(); }
}

async function unlockVictoryLock(lock) {
  if (!(await connectIfNeeded()) || !EXECUTION_ENABLED || state.unlockingLockId || state.executing || state.claiming) return;
  if (!lock || BigInt(Math.floor(Date.now() / 1000)) < lock.lockEnd) { setStatus('This VICTORY lock has not reached its exact on-chain unlock time.', 'error'); return; }
  const pendingSui = state.suiClaims.find((claim) => claim.lockId === lock.id);
  const expectedSuiRaw = pendingSui?.totalRaw > 0n ? pendingSui.totalRaw : 0n;
  if (state.suiBalance < 50_000_000n) { setStatus('Keep at least 0.05 SUI available for unlock gas.', 'error'); return; }
  const lockId = lock.id.toString(); state.unlockingLockId = lockId; el.success.hidden = true; render();
  try {
    const owner = window.playerAddress; const transaction = buildVictoryUnlockTransaction({ Transaction, owner, lock, suiClaim: expectedSuiRaw > 0n ? pendingSui : null });
    setStatus(`Simulating the exact unlock for lock #${lockId} twice on Sui Mainnet…`, 'warning'); const simulation = await simulateTwice(transaction);
    const unlocked = extractVictoryUnlockEvent(simulation, owner, lock.id);
    if (!unlocked || unlocked.amountRaw !== lock.amountRaw || unlocked.suiRewardsRaw !== 0n) throw new Error('The unlock simulation did not return the exact verified VICTORY principal.');
    const received = extractVictoryClaimed(simulation, owner); const expected = unlocked.amountRaw + unlocked.victoryRewardsRaw;
    if (received !== expected) throw new Error('The unlock simulation did not reconcile the returned principal and final VICTORY reward.');
    const simulatedSui = extractSuiClaimedFromEvents(simulation, owner);
    if (simulatedSui !== expectedSuiRaw) throw new Error('The unlock simulation did not reconcile the weekly SUI collected before unlocking.');
    const principal = formatRaw(unlocked.amountRaw, VICTORY_DECIMALS, VICTORY_DECIMALS);
    const rewards = formatRaw(unlocked.victoryRewardsRaw, VICTORY_DECIMALS, VICTORY_DECIMALS);
    const suiLine = expectedSuiRaw > 0n ? `\nWeekly SUI collected first: ${formatRaw(expectedSuiRaw, 9, 9)} SUI` : '\nWeekly SUI collected first: none currently available';
    if (!(await confirmTransaction(`Unlock ${principal} VICTORY from lock #${lockId} and collect ${rewards} VICTORY in final emission rewards?${suiLine}\n\nThe combined claim-and-unlock transaction passed two Sui Mainnet simulations.`, { title: 'Unlock & Collect', confirmLabel: 'Continue to Wallet' }))) { setStatus('VICTORY unlock cancelled before wallet approval.'); return; }
    if (window.playerAddress !== owner) throw new Error('The connected wallet changed before approval.');
    setStatus(`Review the unlock for lock #${lockId} in your wallet…`, 'warning'); const { txDigest, finalized } = await submitAndFinalize(transaction);
    const completed = extractVictoryUnlockEvent(finalized, owner, lock.id);
    if (!completed || completed.amountRaw !== lock.amountRaw || completed.suiRewardsRaw !== 0n) throw new Error('The finalized transaction did not contain the exact verified unlock event.');
    const finalizedReceived = extractVictoryClaimed(finalized, owner); const finalizedExpected = completed.amountRaw + completed.victoryRewardsRaw;
    if (finalizedReceived !== finalizedExpected) throw new Error('The finalized unlock did not reconcile the returned principal and final VICTORY reward.');
    const finalizedSui = extractSuiClaimedFromEvents(finalized, owner);
    if (finalizedSui !== expectedSuiRaw) throw new Error('The finalized unlock did not reconcile the weekly SUI claim.');
    const suiResult = finalizedSui > 0n ? ` + ${formatRaw(finalizedSui, 9, 9)} weekly SUI` : '';
    el.success.hidden = false; el.success.innerHTML = `<strong>Lock #${lockId} unlocked: ${formatRaw(completed.amountRaw, VICTORY_DECIMALS, VICTORY_DECIMALS)} VICTORY principal + ${formatRaw(completed.victoryRewardsRaw, VICTORY_DECIMALS, VICTORY_DECIMALS)} VICTORY rewards${suiResult}.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(txDigest)}" target="_blank" rel="noopener noreferrer">View ${txDigest.slice(0, 12)}… ↗</a>`;
    setStatus('Your weekly SUI, VICTORY principal, and final emission rewards were collected successfully.', 'success'); await load(); showVictoryView('locks');
  } catch (error) { const message = String(error?.message || error || 'VICTORY unlock failed.'); setStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled.' : message, 'error'); }
  finally { state.unlockingLockId = ''; render(); }
}

async function claimVictoryRewards() {
  if (!(await connectIfNeeded()) || !EXECUTION_ENABLED || state.claiming) return;
  if (state.claimableVictoryRaw === null || state.claimableVictoryRaw <= 0n) { setStatus('No verified VICTORY locker rewards are claimable right now.', 'success'); return; }
  if (state.suiBalance < 50_000_000n) { setStatus('Keep at least 0.05 SUI available for reward-claim gas.', 'error'); return; }
  state.claiming = 'victory'; el.success.hidden = true; render();
  try {
    const owner = window.playerAddress; const transaction = buildVictoryRewardsClaimTransaction({ Transaction, owner, locks: state.locks });
    setStatus('Simulating the exact all-lock VICTORY claim twice on Sui Mainnet…', 'warning'); const simulation = await simulateTwice(transaction);
    const amount = extractVictoryClaimed(simulation, owner); const events = extractVictoryClaimEvents(simulation, owner); const eventTotal = [...events.values()].reduce((total, item) => total + item, 0n);
    if (amount <= 0n || eventTotal !== amount) throw new Error('The VICTORY claim simulation did not reconcile exactly.');
    const readable = formatRaw(amount, VICTORY_DECIMALS, VICTORY_DECIMALS);
    if (!(await confirmTransaction(`Claim ${readable} VICTORY across ${events.size.toLocaleString()} current lock${events.size === 1 ? '' : 's'}?\n\nThe exact all-lock claim passed two Sui Mainnet simulations.`, { title: 'Claim VICTORY Rewards', confirmLabel: 'Continue to Wallet' }))) { setStatus('VICTORY reward claim cancelled before wallet approval.'); return; }
    if (window.playerAddress !== owner) throw new Error('The connected wallet changed before approval.');
    setStatus(`Review the ${readable} VICTORY reward claim in your wallet…`, 'warning'); const { txDigest, finalized } = await submitAndFinalize(transaction);
    const claimed = extractVictoryClaimed(finalized, owner); const finalizedEvents = extractVictoryClaimEvents(finalized, owner); const finalizedTotal = [...finalizedEvents.values()].reduce((total, item) => total + item, 0n);
    if (claimed <= 0n || finalizedTotal !== claimed) throw new Error('The finalized VICTORY reward claim did not reconcile exactly.');
    el.success.hidden = false; el.success.innerHTML = `<strong>${formatRaw(claimed, VICTORY_DECIMALS, VICTORY_DECIMALS)} VICTORY claimed from the locker.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(txDigest)}" target="_blank" rel="noopener noreferrer">View ${txDigest.slice(0, 12)}… ↗</a>`;
    setStatus('VICTORY locker rewards were claimed successfully.', 'success'); await load();
  } catch (error) { const message = String(error?.message || error || 'VICTORY reward claim failed.'); setStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled.' : message, 'error'); }
  finally { state.claiming = ''; render(); }
}

async function claimWeeklySui() {
  if (!(await connectIfNeeded()) || !EXECUTION_ENABLED || state.claiming) return;
  const claims = state.suiClaims.filter((claim) => claim.epochs.length && claim.totalRaw > 0n);
  if (!claims.length || !state.claimableSuiRaw) { setStatus('No completed weekly SUI epochs are claimable right now.', 'success'); return; }
  if (state.suiBalance < 50_000_000n) { setStatus('Keep at least 0.05 SUI available for weekly-claim gas.', 'error'); return; }
  state.claiming = 'sui'; el.success.hidden = true; render();
  try {
    const owner = window.playerAddress; const transaction = buildSuiRewardsClaimTransaction({ Transaction, owner, claims });
    setStatus('Simulating the exact weekly SUI claim twice on Sui Mainnet…', 'warning'); const simulation = await simulateTwice(transaction);
    const amount = extractSuiClaimedFromEvents(simulation, owner);
    if (amount <= 0n || amount !== state.claimableSuiRaw) throw new Error('The weekly SUI claim simulation did not reconcile with the live epoch preview.');
    const readable = formatRaw(amount, 9, 9); const epochs = totalSuiEpochs();
    if (!(await confirmTransaction(`Claim ${readable} SUI from ${epochs.toLocaleString()} completed weekly epoch${epochs === 1 ? '' : 's'} across ${claims.length.toLocaleString()} lock${claims.length === 1 ? '' : 's'}?\n\nThe exact batch claim passed two Sui Mainnet simulations.`, { title: 'Claim Weekly SUI', confirmLabel: 'Continue to Wallet' }))) { setStatus('Weekly SUI claim cancelled before wallet approval.'); return; }
    if (window.playerAddress !== owner) throw new Error('The connected wallet changed before approval.');
    setStatus(`Review the ${readable} SUI weekly-revenue claim in your wallet…`, 'warning'); const { txDigest, finalized } = await submitAndFinalize(transaction);
    const claimed = extractSuiClaimedFromEvents(finalized, owner);
    if (claimed !== amount) throw new Error('The finalized weekly SUI claim did not match the verified simulation.');
    el.success.hidden = false; el.success.innerHTML = `<strong>${formatRaw(claimed, 9, 9)} SUI claimed from completed weekly epochs.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(txDigest)}" target="_blank" rel="noopener noreferrer">View ${txDigest.slice(0, 12)}… ↗</a>`;
    setStatus('Weekly SUI revenue was claimed successfully.', 'success'); await load();
  } catch (error) { const message = String(error?.message || error || 'Weekly SUI claim failed.'); setStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled.' : message, 'error'); }
  finally { state.claiming = ''; render(); }
}

async function requestReinvestQuote() {
  const amounts = reinvestAmounts(); const amount = amounts.reinvestRaw; state.reinvest.quote = null;
  if (!amount) { setReinvestStatus('Enter a VICTORY amount to build the verified V2 reinvest route.'); render(); return; }
  if (amount < 1_000n || (state.reinvest.mode === 'sustainable' && amounts.lockRaw <= 0n)) { setReinvestStatus('The selected sustainable split is too small for the verified route.', 'error'); render(); return; }
  state.reinvest.quoting = true; render();
  try {
    const [victoryPool, treePool] = await Promise.all([
      client.core.getObject({ objectId: VICTORY_SUI_POOL, include: { json: true } }),
      client.core.getObject({ objectId: V2_POOL, include: { json: true } }),
    ]);
    const quote = quoteVictoryV2Reinvest({ victorySuiPoolJson: objectJson(victoryPool), suiTreePoolJson: objectJson(treePool), amountIn: amount, slippageBps: state.reinvest.slippageBps });
    if (reinvestAmounts().reinvestRaw !== amount) return;
    state.reinvest.quote = quote;
    setReinvestStatus(state.reinvest.mode === 'sustainable' ? 'Verified sustainable split ready. The lock and liquidity route will be atomic in the first approval.' : 'Verified VICTORY → SUI → SUI/TREE V2 route ready. Minimum outputs include your selected slippage protection.', 'success');
  } catch (error) { setReinvestStatus(`${String(error?.message || error || 'The V2 reinvest quote is unavailable.')} No transaction was created.`, 'error'); }
  finally { state.reinvest.quoting = false; render(); }
}
function scheduleReinvestQuote() { clearTimeout(state.reinvest.timer); state.reinvest.timer = setTimeout(requestReinvestQuote, 300); }

async function executeVictoryReinvest() {
  if (!(await connectIfNeeded()) || !EXECUTION_ENABLED || state.reinvest.executing) return;
  let amounts = reinvestAmounts(); if (!amounts.totalRaw || !amounts.reinvestRaw) return;
  if (amounts.totalRaw > state.victoryBalance) { setReinvestStatus('Insufficient wallet VICTORY. Claim rewards first or enter a smaller amount.', 'error'); return; }
  if (state.suiBalance < 100_000_000n) { setReinvestStatus('Keep at least 0.1 SUI available for the liquidity and staking transaction fees.', 'error'); return; }
  if (!state.reinvest.quote || Date.now() - Number(state.reinvest.quote.generatedAt || 0) > 15_000) { await requestReinvestQuote(); if (!state.reinvest.quote) return; }
  amounts = reinvestAmounts();
  state.reinvest.executing = true; el.reinvestSuccess.hidden = true; render();
  try {
    const owner = window.playerAddress; const quote = state.reinvest.quote; const beforeLp = await getV2LpBalance(client, owner);
    const sustainable = state.reinvest.mode === 'sustainable'; const reinvestBps = state.reinvest.reinvestBps; const lockDays = state.reinvest.lockDays;
    const built = sustainable
      ? await buildVictoryV2SustainableReinvestTransaction({ Transaction, client, owner, totalAmount: amounts.totalRaw, reinvestBps, lockDays, quote, slippageBps: state.reinvest.slippageBps })
      : await buildVictoryV2ReinvestTransaction({ Transaction, client, owner, amountIn: amounts.totalRaw, quote, slippageBps: state.reinvest.slippageBps });
    setReinvestStatus(sustainable ? 'Simulating the exact split, xVICTORY lock, and V2 liquidity transaction twice on Sui Mainnet…' : 'Simulating the exact VICTORY conversion and V2 liquidity transaction twice on Sui Mainnet…', 'warning');
    const simulation = await simulateTwice(built.transaction); const simulatedLp = extractPositiveV2Lp(simulation, owner);
    const simulatedLock = sustainable ? extractVictoryLockEvent(simulation, owner, { amountRaw: amounts.lockRaw, lockDays }) : null;
    if (extractVictoryLocked(simulation, owner) !== amounts.totalRaw || simulatedLp <= 0n || (sustainable && !simulatedLock)) throw new Error('The simulation did not verify the exact VICTORY split, lock, and positive SUI/TREE LP output.');
    const readable = formatRaw(amounts.totalRaw, VICTORY_DECIMALS, VICTORY_DECIMALS); const reinvestReadable = formatRaw(amounts.reinvestRaw, VICTORY_DECIMALS, VICTORY_DECIMALS); const lockReadable = formatRaw(amounts.lockRaw, VICTORY_DECIMALS, VICTORY_DECIMALS);
    const headline = sustainable ? `Process ${readable} VICTORY with Sustainable Reinvest?` : `Reinvest ${readable} VICTORY into SUI/TREE V2 liquidity?`;
    const splitCopy = sustainable ? `\nReinvest: ${reinvestReadable} VICTORY (${reinvestBps / 100}%)\nLock: ${lockReadable} VICTORY for ${TERM_LABELS[lockDays] || `${lockDays} days`}\nEstimated unlock: ${unlockDateForDays(lockDays)}\n` : '';
    if (!(await confirmTransaction(`${headline}\n${splitCopy}\nMinimum SUI from VICTORY: ${formatRaw(quote.victoryToSui.minAmountOut, 9, 9)} SUI\nMinimum TREE for liquidity: ${formatRaw(quote.suiToTree.minAmountOut, 6, 6)} TREE\nCombined quoted impact: ${formatImpactBps(quote.victoryToSui.priceImpactBps + quote.suiToTree.priceImpactBps)}\n\nStep 1 ${sustainable ? 'atomically locks the selected portion and creates liquidity' : 'creates liquidity'}. Step 2 offers to stake only the new LP. The exact transaction passed two Mainnet simulations.`, { title: sustainable ? 'Sustainable Reinvest' : 'Complete Reinvest', confirmLabel: 'Continue to Wallet' }))) { setReinvestStatus(`${sustainable ? 'Sustainable' : 'Complete'} reinvest cancelled before wallet approval.`); return; }
    if (window.playerAddress !== owner) throw new Error('The connected wallet changed before approval.');
    if (state.reinvest.mode !== (sustainable ? 'sustainable' : 'complete') || state.reinvest.reinvestBps !== reinvestBps || state.reinvest.lockDays !== lockDays) throw new Error('The reinvest settings changed before approval. Review the updated route again.');
    setReinvestStatus(sustainable ? 'Review the verified VICTORY split, xVICTORY lock, and liquidity transaction in your wallet…' : 'Review the verified VICTORY conversion and liquidity transaction in your wallet…', 'warning');
    const { txDigest: liquidityDigest, finalized } = await submitAndFinalize(built.transaction);
    const finalizedLock = sustainable ? extractVictoryLockEvent(finalized, owner, { amountRaw: amounts.lockRaw, lockDays }) : null;
    if (extractVictoryLocked(finalized, owner) !== amounts.totalRaw || extractPositiveV2Lp(finalized, owner) <= 0n || (sustainable && !finalizedLock)) throw new Error('The transaction finalized without the verified VICTORY split, lock, and positive LP output.');
    const afterLp = await getV2LpBalance(client, owner); const newLp = afterLp - beforeLp;
    if (newLp <= 0n) throw new Error('Liquidity was created, but the new LP balance could not be isolated for staking. The LP remains safely in your wallet.');
    const stakeTransaction = await buildV2StakeTransaction({ Transaction, client, owner, amount: newLp });
    setReinvestStatus('Liquidity confirmed. Simulating the new-LP farm stake twice on Sui Mainnet…', 'warning'); await simulateTwice(stakeTransaction);
    if (!(await confirmTransaction(`Stake the ${newLp.toLocaleString()} newly created raw SUI/TREE LP units in the verified V2 farm?\n\nThis is the second and final wallet approval. Cancelling leaves the LP safely in your wallet.`, { title: 'Stake New V2 Liquidity', confirmLabel: 'Continue to Wallet' }))) {
      el.reinvestSuccess.hidden = false; el.reinvestSuccess.innerHTML = `<strong>${sustainable ? `${lockReadable} VICTORY was locked and ${reinvestReadable} VICTORY created SUI/TREE V2 liquidity.` : 'VICTORY was reinvested into SUI/TREE V2 liquidity.'} The new LP remains unstaked in your wallet.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(liquidityDigest)}" target="_blank" rel="noopener noreferrer">View ${liquidityDigest.slice(0, 12)}… ↗</a>`;
      setReinvestStatus(`${sustainable ? 'The xVICTORY lock and liquidity were' : 'Liquidity was'} created successfully; staking was cancelled.`, 'success'); await load(); return;
    }
    if (window.playerAddress !== owner) throw new Error('The connected wallet changed before staking approval.');
    setReinvestStatus('Review the verified SUI/TREE LP stake in your wallet…', 'warning'); const { txDigest: stakeDigest } = await submitAndFinalize(stakeTransaction);
    el.reinvestSuccess.hidden = false; el.reinvestSuccess.innerHTML = `<strong>${sustainable ? `${lockReadable} VICTORY locked; ${reinvestReadable} VICTORY reinvested into SUI/TREE V2` : `${readable} VICTORY reinvested into SUI/TREE V2`} and the new LP was staked.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(stakeDigest)}" target="_blank" rel="noopener noreferrer">View stake ${stakeDigest.slice(0, 12)}… ↗</a><small>Liquidity transaction: ${liquidityDigest.slice(0, 12)}…</small>`;
    state.reinvest.amount = ''; state.reinvest.quote = null; el.reinvestAmount.value = ''; setReinvestStatus(`${sustainable ? 'Sustainable' : 'Complete'} V2 reinvest and staking confirmed on Sui Mainnet.`, 'success'); await load(); showVictoryView('reinvest');
  } catch (error) { const message = String(error?.message || error || 'VICTORY reinvest failed.'); setReinvestStatus(/reject|cancel|denied/i.test(message) ? 'Wallet approval was cancelled. Any confirmed lock or liquidity remains safely recorded on-chain.' : message, 'error'); }
  finally { state.reinvest.executing = false; render(); }
}

function init() {
  Object.assign(el, {
    walletBalance: document.getElementById('victoryWalletBalance'), totalLocked: document.getElementById('victoryTotalLocked'), activeLocks: document.getElementById('victoryActiveLocks'), rewardVault: document.getElementById('victoryRewardVault'), suiVault: document.getElementById('victorySuiVault'), refresh: document.getElementById('victoryRefresh'),
    amount: document.getElementById('victoryLockAmount'), max: document.getElementById('victoryLockMax'), balance: document.getElementById('victoryLockBalance'), term: document.getElementById('victoryLockTerm'), unlockDate: document.getElementById('victoryUnlockDate'), action: document.getElementById('victoryLockAction'), status: document.getElementById('victoryStatus'), success: document.getElementById('victorySuccess'), emissionRate: document.getElementById('victoryEmissionRate'),
    centerCard: document.getElementById('victoryCenterCard'), lockerTab: document.getElementById('victoryLockerTab'), locksTab: document.getElementById('victoryLocksTab'), reinvestTab: document.getElementById('victoryReinvestTab'), lockerView: document.getElementById('victoryLockerView'), locksView: document.getElementById('victoryLocksView'), reinvestView: document.getElementById('victoryReinvestView'), myLockCount: document.getElementById('victoryMyLockCount'), claimableVictory: document.getElementById('victoryClaimableTotal'), claimableSui: document.getElementById('victorySuiClaimableTotal'), claimRewards: document.getElementById('victoryClaimRewards'), claimSui: document.getElementById('victoryClaimSui'), lockList: document.getElementById('victoryLockList'), backToTop: document.getElementById('victoryBackToTop'),
    reinvestAmount: document.getElementById('victoryReinvestAmount'), reinvestAmountLabel: document.getElementById('victoryReinvestAmountLabel'), reinvestBalance: document.getElementById('victoryReinvestBalance'), reinvestMax: document.getElementById('victoryReinvestMax'), reinvestSuiMin: document.getElementById('victoryReinvestSuiMin'), reinvestTreeMin: document.getElementById('victoryReinvestTreeMin'), reinvestImpact: document.getElementById('victoryReinvestImpact'), reinvestAction: document.getElementById('victoryReinvestAction'), reinvestStatus: document.getElementById('victoryReinvestStatus'), reinvestSuccess: document.getElementById('victoryReinvestSuccess'),
    sustainableControls: document.getElementById('victorySustainableControls'), reinvestPercent: document.getElementById('victoryReinvestPercent'), lockPercent: document.getElementById('victoryLockPercent'), reinvestSplit: document.getElementById('victoryReinvestSplit'), sustainableLockTerm: document.getElementById('victorySustainableLockTerm'), sustainableUnlockDate: document.getElementById('victorySustainableUnlockDate'), reinvestAllocation: document.getElementById('victoryReinvestAllocation'), lockAllocation: document.getElementById('victoryLockAllocation'), reinvestApprovals: document.getElementById('victoryReinvestApprovals'),
  });
  if (!el.action) return;
  el.amount.addEventListener('input', () => { state.amount = el.amount.value; render(); });
  el.max.addEventListener('click', () => { state.amount = formatRaw(state.victoryBalance, VICTORY_DECIMALS, VICTORY_DECIMALS); el.amount.value = state.amount; render(); });
  el.term.addEventListener('change', () => { state.lockDays = Number(el.term.value); render(); });
  document.querySelectorAll('[data-victory-term]').forEach((button) => button.addEventListener('click', () => { state.lockDays = Number(button.dataset.victoryTerm); el.term.value = String(state.lockDays); render(); }));
  el.lockerTab.addEventListener('click', () => showVictoryView('locker')); el.locksTab.addEventListener('click', () => showVictoryView('locks')); el.reinvestTab.addEventListener('click', () => showVictoryView('reinvest'));
  el.reinvestAmount.addEventListener('input', () => { state.reinvest.amount = el.reinvestAmount.value; state.reinvest.quote = null; render(); scheduleReinvestQuote(); });
  el.reinvestMax.addEventListener('click', () => { state.reinvest.amount = formatRaw(state.victoryBalance, VICTORY_DECIMALS, VICTORY_DECIMALS); el.reinvestAmount.value = state.reinvest.amount; state.reinvest.quote = null; render(); scheduleReinvestQuote(); });
  document.querySelectorAll('[data-victory-reinvest-mode]').forEach((button) => button.addEventListener('click', () => { state.reinvest.mode = button.dataset.victoryReinvestMode === 'sustainable' ? 'sustainable' : 'complete'; state.reinvest.quote = null; render(); scheduleReinvestQuote(); }));
  el.reinvestSplit.addEventListener('input', () => { state.reinvest.reinvestBps = Number(el.reinvestSplit.value) * 100; state.reinvest.quote = null; render(); scheduleReinvestQuote(); });
  document.querySelectorAll('[data-victory-reinvest-split]').forEach((button) => button.addEventListener('click', () => { state.reinvest.reinvestBps = Number(button.dataset.victoryReinvestSplit) * 100; state.reinvest.quote = null; render(); scheduleReinvestQuote(); }));
  el.sustainableLockTerm.addEventListener('change', () => { state.reinvest.lockDays = Number(el.sustainableLockTerm.value); render(); });
  document.querySelectorAll('[data-victory-reinvest-slippage]').forEach((button) => button.addEventListener('click', () => { state.reinvest.slippageBps = Number(button.dataset.victoryReinvestSlippage); state.reinvest.quote = null; render(); scheduleReinvestQuote(); }));
  el.action.addEventListener('click', executeLock); el.claimRewards.addEventListener('click', claimVictoryRewards); el.claimSui.addEventListener('click', claimWeeklySui); el.reinvestAction.addEventListener('click', executeVictoryReinvest); el.refresh.addEventListener('click', load);
  el.backToTop.addEventListener('click', scrollLocksToTop); window.addEventListener('scroll', updateLocksBackToTop, { passive: true }); window.addEventListener('resize', updateLocksBackToTop);
  el.lockList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-victory-unlock]'); if (!button) return;
    const lock = state.locks.find((item) => item.id.toString() === button.dataset.victoryUnlock); if (lock) unlockVictoryLock(lock);
  });
  document.getElementById('earnVictoryTab')?.addEventListener('click', () => { if (LOCAL_LOCKS_PREVIEW) openLocalLocksPreview(); else load(); });
  window.addEventListener('tree:wallet-changed', () => { state.victoryBalance = 0n; state.suiBalance = 0n; state.locks = []; state.claimableVictoryRaw = null; state.claimableSuiRaw = null; state.unlockingLockId = ''; state.reinvest.quote = null; load(); });
  showVictoryView('locker'); render(); if (!openLocalLocksPreview()) load();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();

export { EXECUTION_ENABLED };
