// A small, independent loader keeps Get STI usable when a module cannot load.
// The shared wallet module is loaded once by the page, never imported again here.
(() => {
  if (window.treeStiRecovery) return;
  const script = new URL(document.currentScript.src);
  const widgetURL = new URL('sti-widget.js', script);
  widgetURL.search = script.search;
  const el = Object.fromEntries(['OpenBuy', 'CloseBuy', 'Purchase', 'WalletButton',
    'QuoteButton', 'BuyButton', 'Amount', 'PurchaseStatus', 'ReloadWallet']
    .map(key => [key, document.getElementById('sti' + key)]));
  const DRAFT_KEY = 'tree:sti:reload-draft';
  const WAIT_MS = 8_000;
  let widgetReady = false, loadFailed = false, purchasePending = false, walletWait = null;
  let restored = false;

  function status(message, error = false) {
    el.PurchaseStatus.textContent = message;
    el.PurchaseStatus.dataset.error = String(error);
  }
  function showWalletRecovery() { el.ReloadWallet.hidden = false; }
  function hideWalletRecovery() { el.ReloadWallet.hidden = true; }
  function loadingStatus() {
    status(loadFailed
      ? 'Purchase tools could not load. Use Reload wallet tools to try again.'
      : 'Loading purchase tools...', loadFailed);
  }
  function disableActions() {
    for (const key of ['WalletButton', 'QuoteButton', 'BuyButton']) el[key].disabled = true;
  }
  function waitForWalletManager() {
    if (typeof window.openWalletManager === 'function') return Promise.resolve();
    if (walletWait) return walletWait;
    walletWait = new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        window.removeEventListener('tree:wallet-manager-ready', ready);
        if (error) reject(error); else resolve();
      };
      const ready = () => {
        if (typeof window.openWalletManager === 'function') finish();
      };
      const timer = setTimeout(() => {
        if (typeof window.openWalletManager === 'function') finish();
        else finish(new Error('Wallet connection tools could not load. Retry wallet connection, or use Reload wallet tools.'));
      }, WAIT_MS);
      window.addEventListener('tree:wallet-manager-ready', ready);
      ready();
    }).finally(() => { walletWait = null; });
    return walletWait;
  }
  window.treeStiRecovery = {
    waitForWalletManager, showWalletRecovery, hideWalletRecovery,
    setPurchasePending(value) {
      purchasePending = Boolean(value);
      el.ReloadWallet.disabled = purchasePending;
    },
    get state() { return widgetReady ? 'ready' : loadFailed ? 'unavailable' : 'loading'; },
  };

  // A deliberate reload may retain only the typed amount, never a quote, consent,
  // prepared transaction, wallet authorization or an automatic purchase action.
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    const saved = JSON.parse(raw || 'null');
    if (saved && Number.isFinite(saved.at) && Date.now() >= saved.at && Date.now() - saved.at < 600_000 &&
        typeof saved.amount === 'string' && saved.amount.length <= 80 && /^[\d.]*$/.test(saved.amount) && saved.open === true) {
      el.Amount.value = saved.amount;
      el.Purchase.hidden = false;
      el.OpenBuy.setAttribute('aria-expanded', 'true');
      restored = true;
    }
  } catch { /* The panel remains usable when browser storage is unavailable. */ }

  el.ReloadWallet.addEventListener('click', () => {
    // Check at click time as well as disabling the control: a wallet approval or
    // submitted digest must not be discarded by the recovery action.
    if (purchasePending) return;
    try {
      const amount = el.Amount.value;
      if (amount.length <= 80 && /^[\d.]*$/.test(amount)) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ amount, open: !el.Purchase.hidden, at: Date.now() }));
      } else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* Reload does not depend on storage access. */ }
    window.location.reload(); // Preserves the current path, query and Stats tab.
  });

  // Before successful module initialization, Get STI and Close still work and
  // purchase actions stay disabled. A failed or stalled import never leaves an
  // inert button, nor can partially initialized handlers submit a purchase.
  document.addEventListener('click', event => {
    if (widgetReady) return;
    const button = event.target.closest?.('#stiOpenBuy, #stiCloseBuy, #stiWalletButton, #stiQuoteButton, #stiBuyButton');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (button === el.CloseBuy) {
      el.Purchase.hidden = true;
      el.OpenBuy.setAttribute('aria-expanded', 'false');
      el.OpenBuy.focus();
      return;
    }
    el.Purchase.hidden = false;
    el.OpenBuy.setAttribute('aria-expanded', 'true');
    disableActions(); loadingStatus();
  }, true);

  disableActions();
  const loadingTimer = setTimeout(() => {
    if (widgetReady) return;
    loadFailed = true;
    disableActions(); loadingStatus(); showWalletRecovery();
  }, WAIT_MS);
  import(widgetURL.href).then(() => {
    clearTimeout(loadingTimer);
    widgetReady = true;
    hideWalletRecovery();
    if (restored) status('Wallet tools reloaded. Connect your wallet and get a fresh quote to continue.');
    else if (!el.Purchase.hidden) status('Enter an amount to see what you will receive.');
    window.dispatchEvent(new CustomEvent('tree:sti-ready'));
  }).catch(() => {
    clearTimeout(loadingTimer);
    loadFailed = true;
    disableActions(); loadingStatus(); showWalletRecovery();
  });
})();
