import {
  createMintCoordinator,
  formatMist,
  isValidTransactionDigest,
  loadSaleInventory,
  NFTREE_GAS_BUDGET_MIST,
  validatePendingRecord,
} from './arcade-nftree-access-core.mjs';

// The arcade owns only this panel. Existing game and wallet integrations are untouched.
const panel = document.getElementById('nftree-mint-panel');
const triggers = [...document.querySelectorAll('[data-nftree-mint]')];
const byId = (id) => document.getElementById(id);
const ui = {
  close: byId('nftree-mint-close'), price: byId('nftree-mint-price'), inventory: byId('nftree-mint-inventory'),
  inventoryNote: byId('nftree-inventory-note'), fees: byId('nftree-mint-fees'), wallet: byId('nftree-wallet-state'),
  wallets: byId('nftree-wallet-options'), noWallet: byId('nftree-no-wallet'), balance: byId('nftree-wallet-balance'),
  review: byId('nftree-purchase-review'), reviewCopy: byId('nftree-review-copy'), ack: byId('nftree-purchase-ack'),
  prepare: byId('nftree-review-button'), purchase: byId('nftree-purchase-button'), check: byId('nftree-check-button'),
  refresh: byId('nftree-refresh-button'), disconnect: byId('nftree-disconnect-button'),
  digestEntry: byId('nftree-digest-entry'), digest: byId('nftree-transaction-digest'),
  status: byId('nftree-mint-status'), result: byId('nftree-mint-result'),
};
const STORAGE_KEY = 'tree-arcade:nftree-mint:pending:v1';
const PURCHASE_LOCK = 'tree-arcade:nftree-mint';
const BUSY_STATES = new Set(['reviewing', 'checking', 'signing']);
const STORAGE_BLOCKED_MESSAGE = 'The saved purchase record is unavailable. Purchasing is paused; check your wallet history before continuing.';
const INLINE_MINT_UNAVAILABLE = 'Inline minting is unavailable in this browser. Use the official NFTree mint page below. You can still check an existing purchase here.';
const inlineMintSupported = typeof navigator.locks?.request === 'function';
let wallet = null;
let coordinator = null;
let connection = null;
let unsubscribeConnection = () => {};
let bridgePromise = null;
let initialization = null;
let initializationError = '';
let storageBlocked = false;
let connectionEpoch = 0;
let inventoryEpoch = 0;
let inventoryAborter = null;
let inventory = null;
let inventoryLoading = false;
let actionRunning = false;
let connecting = false;
let lastTrigger = null;
let renderedQuote = '';
let renderedRecoveryDigest = '';
let refreshedReceipt = '';
let state = { status: 'idle', message: '', quote: null, pending: null, receipt: null };

function setStatus(message, kind = '') {
  if (storageBlocked || initializationError) {
    message = storageBlocked ? STORAGE_BLOCKED_MESSAGE : initializationError;
    kind = 'error';
  }
  ui.status.textContent = String(message || '');
  ui.status.className = `mint-status${kind ? ` is-${kind}` : ''}`;
}

function storageError() {
  storageBlocked = true;
  throw new Error(STORAGE_BLOCKED_MESSAGE);
}

function readPending() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return storageError(); }
  if (raw === null) return null;
  try {
    if (raw.length > 8_000) throw new Error('Oversized record');
    return validatePendingRecord(JSON.parse(raw));
  } catch { return storageError(); }
}

function persistPending(record) {
  try {
    const value = JSON.stringify(validatePendingRecord(record));
    localStorage.setItem(STORAGE_KEY, value);
    if (localStorage.getItem(STORAGE_KEY) !== value) return storageError();
  } catch { return storageError(); }
}

function clearPending() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(STORAGE_KEY) !== null) return storageError();
  } catch { return storageError(); }
}

function currentConnection() {
  if (!connection || !wallet) return null;
  let actual;
  try { actual = wallet.getConnectedWalletState(connection); } catch { return null; }
  if (!actual?.accountExists || !actual.canSign || actual.accountAddress?.toLowerCase() !== connection.accountAddress.toLowerCase()) return null;
  return { ...connection, accountAddress: actual.accountAddress.toLowerCase(), canSign: true };
}

function appendText(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderReview(quote) {
  if (!quote || renderedQuote === quote.id) return;
  renderedQuote = quote.id;
  ui.ack.checked = false;
  ui.reviewCopy.replaceChildren();
  appendText(ui.reviewCopy, 'strong', `1 NFTree · ${quote.priceLabel}`);
  appendText(ui.reviewCopy, 'p', `Network gas budget: up to ${formatMist(quote.gasBudgetMist)}. Maximum total: ${formatMist(quote.maxTotalMist)}. Actual gas used may be lower.`);
  appendText(ui.reviewCopy, 'p', `Purchasing wallet: ${quote.walletName} · ${quote.accountAddress}`);
  appendText(ui.reviewCopy, 'p', 'You will receive the next available NFTree. Your wallet will ask you to approve this purchase on Sui mainnet.');
  ui.price.textContent = quote.priceLabel;
  ui.fees.textContent = `Up to ${formatMist(quote.gasBudgetMist)}`;
  ui.inventory.textContent = quote.totalAvailable.toLocaleString();
}

function renderResult() {
  ui.result.replaceChildren();
  const record = state.receipt || state.pending;
  const digest = record?.digest;
  const confirmed = state.status === 'confirmed';
  ui.result.hidden = !record;
  if (!record) return;
  if (confirmed) {
    appendText(ui.result, 'strong', 'Your NFTree is ready.');
    appendText(ui.result, 'p', `It is held in ${record.accountAddress}. Use that wallet when you enter a game.`);
    const play = appendText(ui.result, 'a', 'Choose a game ↓');
    play.href = '#cabinets';
  } else if (state.pending) {
    appendText(ui.result, 'p', `Purchasing wallet: ${record.accountAddress}. Check this purchase before starting another.`);
  }
  if (isValidTransactionDigest(digest)) {
    const receipt = appendText(ui.result, 'a', 'View transaction on SuiScan ↗');
    receipt.href = `https://suiscan.xyz/mainnet/tx/${encodeURIComponent(digest)}`;
    receipt.target = '_blank';
    receipt.rel = 'noopener noreferrer';
    appendText(ui.result, 'small', `Transaction: ${digest}`);
  }
}

function renderControls() {
  const busy = actionRunning || connecting || BUSY_STATES.has(state.status);
  const unresolved = Boolean(state.pending);
  const connected = Boolean(currentConnection());
  const reviewed = Boolean(state.quote) && ['ready', 'review-required'].includes(state.status);
  ui.review.hidden = !reviewed;
  if (reviewed) renderReview(state.quote);
  else if (!state.quote) { renderedQuote = ''; ui.ack.checked = false; }
  ui.prepare.hidden = reviewed || unresolved || !inlineMintSupported;
  ui.prepare.disabled = busy || inventoryLoading || storageBlocked || !inlineMintSupported || !coordinator || !connected || !inventory?.totalAvailable;
  ui.purchase.hidden = !reviewed || unresolved;
  ui.purchase.disabled = busy || inventoryLoading || storageBlocked || !inlineMintSupported || !connected || !ui.ack.checked;
  ui.check.hidden = !unresolved;
  ui.check.disabled = busy || storageBlocked;
  ui.digestEntry.hidden = !unresolved || Boolean(state.pending?.digest && state.pending.digestSource !== 'manual');
  const recoveryDigest = state.pending?.digest || '';
  if (renderedRecoveryDigest !== recoveryDigest) {
    ui.digest.value = recoveryDigest;
    renderedRecoveryDigest = recoveryDigest;
  }
  ui.digest.disabled = busy;
  ui.digest.setAttribute('aria-invalid', state.code === 'INVALID_DIGEST' ? 'true' : 'false');
  ui.refresh.disabled = busy || inventoryLoading || unresolved;
  ui.disconnect.hidden = !connection;
  ui.disconnect.disabled = busy;
  ui.close.disabled = connecting || ['checking', 'signing'].includes(state.status);
  ui.wallets.hidden = connected || unresolved || storageBlocked || !inlineMintSupported;
  for (const button of ui.wallets.querySelectorAll('button')) button.disabled = busy || storageBlocked || !inlineMintSupported || !inventory?.totalAvailable;
  ui.noWallet.hidden = !wallet || connected || unresolved || storageBlocked || !inlineMintSupported || wallet.availableWallets().length > 0;
  panel.querySelector('.mint-fallback:last-child').hidden = unresolved || storageBlocked;
  ui.wallet.textContent = connected
    ? `${connection.walletName} connected · ${connection.accountAddress}`
    : unresolved ? 'A purchase is awaiting confirmation.' : !inlineMintSupported ? 'Open the official NFTree mint page to purchase in this browser.'
      : connecting ? 'Waiting for your wallet…' : 'Connect your Sui wallet to review a purchase.';
}

function onState(next) {
  state = next;
  const kind = next.status === 'confirmed' ? 'success'
    : ['error', 'failed'].includes(next.status) ? 'error'
    : ['pending', 'signing', 'checking', 'reviewing'].includes(next.status) ? 'pending' : '';
  if (next.message) setStatus(next.message, kind);
  renderControls();
  renderResult();
  if (next.status === 'confirmed' && next.receipt?.digest !== refreshedReceipt) {
    refreshedReceipt = next.receipt.digest;
    void refreshInventory({ invalidateReview: false, announce: false });
    void updateBalance();
  }
}

function initializeCoordinator() {
  coordinator = createMintCoordinator({ wallet, getConnection: currentConnection,
    persistPending, readPending, clearPending, onState });
  onState(coordinator.getState());
}

function loadWalletBridge() {
  if (bridgePromise) return bridgePromise;
  bridgePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/arcade/nftree-wallet-mint.js';
    script.async = true;
    script.addEventListener('load', () => {
      const bridge = window.NFTreeWalletMint;
      if (!bridge || typeof bridge.confirmMintReceipt !== 'function') {
        script.remove();
        reject(new Error('The mint connection could not load. Use the official NFTree mint page.'));
        return;
      }
      resolve(bridge);
    }, { once: true });
    script.addEventListener('error', () => { script.remove(); reject(new Error('The mint connection could not load. Use the official NFTree mint page.')); }, { once: true });
    document.head.append(script);
  }).catch((error) => { bridgePromise = null; throw error; });
  return bridgePromise;
}

function renderWalletChoices() {
  ui.wallets.replaceChildren();
  for (const entry of wallet?.availableWallets() || []) {
    const button = appendText(ui.wallets, 'button', `Connect ${entry.name}`);
    button.type = 'button';
    button.className = 'mint-wallet-option';
    button.addEventListener('click', () => void connect(entry.name));
  }
  renderControls();
}

async function initialize() {
  if (coordinator) return;
  if (initialization) return initialization;
  initializationError = '';
  initialization = (async () => {
    wallet = await loadWalletBridge();
    initializeCoordinator();
    wallet.onWalletsChanged(renderWalletChoices);
    renderWalletChoices();
    if (inventory && !state.pending) announceInventory();
  })().catch((error) => { initializationError = error.message; setStatus(error.message, 'error'); renderControls(); })
    .finally(() => { initialization = null; });
  return initialization;
}

function announceInventory() {
  if (!inventory || state.pending || !coordinator) return;
  setStatus(inventory.totalAvailable > 0
    ? !inlineMintSupported ? INLINE_MINT_UNAVAILABLE
      : currentConnection() ? 'Live inventory is ready. Review your purchase when you’re ready.'
      : wallet.availableWallets().length ? 'Live inventory is ready. Choose your Sui wallet to continue.'
        : 'Live inventory is ready. A compatible Sui wallet is required to mint here.'
    : 'The sales pools are sold out. You can browse available NFTrees on TradePort.');
}

async function refreshInventory({ invalidateReview = true, announce = true } = {}) {
  const epoch = ++inventoryEpoch;
  inventoryAborter?.abort();
  inventoryAborter = new AbortController();
  inventoryLoading = true;
  if (invalidateReview && coordinator && !state.pending && !BUSY_STATES.has(state.status)) coordinator.resetReview();
  if (announce && !state.pending) setStatus('Checking live price and sales-pool inventory…', 'pending');
  renderControls();
  try {
    const fresh = await loadSaleInventory({ signal: inventoryAborter.signal });
    if (epoch !== inventoryEpoch) return;
    inventory = fresh;
    ui.price.textContent = formatMist(fresh.mintPriceMist);
    ui.inventory.textContent = fresh.totalAvailable.toLocaleString();
    ui.fees.textContent = `Up to ${formatMist(NFTREE_GAS_BUDGET_MIST)}`;
    ui.inventoryNote.textContent = fresh.totalAvailable > 0 ? 'Verified from the live sales pools' : 'Sales pools are currently sold out';
    if (announce) announceInventory();
  } catch (error) {
    if (epoch !== inventoryEpoch) return;
    inventory = null;
    ui.price.textContent = 'Unavailable';
    ui.inventory.textContent = 'Not verified';
    ui.inventoryNote.textContent = 'Refresh to check the current inventory';
    if (announce && !state.pending) setStatus(error.message, 'error');
  } finally {
    if (epoch === inventoryEpoch) { inventoryLoading = false; renderControls(); }
  }
}

async function updateBalance() {
  const expected = currentConnection();
  if (!expected) { ui.balance.hidden = true; return; }
  ui.balance.hidden = false;
  ui.balance.textContent = 'Checking SUI balance…';
  try {
    const balance = await wallet.getSuiBalance(expected);
    if (currentConnection()?.accountAddress !== expected.accountAddress) return;
    ui.balance.textContent = `Available in this wallet: ${formatMist(balance.balanceMist)}.`;
  } catch {
    if (currentConnection()?.accountAddress === expected.accountAddress) ui.balance.textContent = 'Your SUI balance will be checked before a purchase can be reviewed.';
  }
}

async function connect(walletName) {
  if (!wallet || connecting || actionRunning || state.pending || storageBlocked || !inlineMintSupported) return;
  connecting = true;
  const epoch = ++connectionEpoch;
  setStatus('Choose an account and approve the connection in your wallet.', 'pending');
  renderControls();
  try {
    const result = await wallet.connectWallet({ walletName });
    if (epoch !== connectionEpoch) return;
    connection = { walletName: result.walletName, accountAddress: result.account };
    unsubscribeConnection();
    unsubscribeConnection = wallet.onConnectedWalletChange(connection, (change) => {
      if (!change.connected || change.account?.toLowerCase() !== connection?.accountAddress.toLowerCase()) {
        connectionEpoch++;
        connection = null;
        coordinator?.resetReview();
        ui.balance.hidden = true;
        if (!state.pending) setStatus('The wallet account changed or disconnected. Connect again to review a purchase.');
        renderControls();
      }
    });
    coordinator?.resetReview();
    setStatus('Wallet connected. Review the current price before continuing.');
    void updateBalance();
  } catch (error) {
    if (epoch === connectionEpoch) setStatus(String(error?.message || 'The wallet could not connect.').slice(0, 450), 'error');
  } finally {
    connecting = false;
    renderControls();
  }
}

async function runAction(action) {
  if (actionRunning || storageBlocked || !coordinator) return;
  actionRunning = true;
  renderControls();
  try { await action(); }
  catch (error) {
    if (!state.pending) setStatus(String(error?.message || 'The action could not complete.').slice(0, 450), 'error');
  } finally { actionRunning = false; renderControls(); }
}

async function submitReviewedPurchase() {
  if (!inlineMintSupported) { setStatus(INLINE_MINT_UNAVAILABLE); return; }
  if (!ui.ack.checked || !state.quote) return;
  const quoteId = state.quote.id;
  await runAction(async () => {
    const submit = async () => {
      // Re-read storage inside the cross-tab lock before entering the signing path.
      if (readPending()) { initializeCoordinator(); return; }
      await coordinator.submit(quoteId);
    };
    await navigator.locks.request(PURCHASE_LOCK, { ifAvailable: true }, async (lock) => {
      if (!lock) { setStatus('Another arcade tab is handling this purchase. Check that tab before continuing.', 'pending'); return; }
      await submit();
    });
  });
}

async function openPanel(trigger) {
  lastTrigger = trigger;
  panel.hidden = false;
  for (const link of triggers) link.setAttribute('aria-expanded', 'true');
  panel.focus({ preventScroll: true });
  panel.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const tasks = [initialize()];
  if (!actionRunning && !BUSY_STATES.has(state.status)) tasks.push(refreshInventory({ announce: !state.pending }));
  await Promise.allSettled(tasks);
}

function closePanel() {
  if (ui.close.disabled) return;
  panel.hidden = true;
  for (const link of triggers) link.setAttribute('aria-expanded', 'false');
  lastTrigger?.focus({ preventScroll: true });
}

for (const trigger of triggers) trigger.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  void openPanel(trigger);
});
ui.close.addEventListener('click', closePanel);
panel.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); closePanel(); }
});
ui.ack.addEventListener('change', renderControls);
ui.prepare.addEventListener('click', () => void runAction(() => coordinator.prepare()));
ui.purchase.addEventListener('click', () => void submitReviewedPurchase());
ui.check.addEventListener('click', () => void runAction(() => coordinator.checkStatus(
  state.pending?.digest && state.pending.digestSource !== 'manual' ? {} : { digest: ui.digest.value.trim() },
)));
ui.refresh.addEventListener('click', () => void refreshInventory());
ui.disconnect.addEventListener('click', () => void runAction(async () => {
  const previous = connection;
  connectionEpoch++;
  connection = null;
  unsubscribeConnection();
  unsubscribeConnection = () => {};
  coordinator.resetReview();
  ui.balance.hidden = true;
  try { if (previous) await wallet.disconnectWallet(previous); }
  finally { if (!state.pending) setStatus('Wallet disconnected.'); renderControls(); }
}));
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || !coordinator || actionRunning) return;
  try { initializeCoordinator(); }
  catch (error) { setStatus(error.message, 'error'); renderControls(); }
});
