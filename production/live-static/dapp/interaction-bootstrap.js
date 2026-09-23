const WALLET_BUTTON_SELECTOR = '#dappWallet, #rankWallet';

function walletManagerReady() {
  return typeof window.openWalletManager === 'function';
}

function restoreQueuedButton(button) {
  if (!button?.dataset.walletConnectQueued) return;
  const original = button.dataset.walletConnectOriginal || 'Connect Wallet';
  delete button.dataset.walletConnectQueued;
  delete button.dataset.walletConnectOriginal;
  button.textContent = original;
  button.removeAttribute('aria-busy');
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.(WALLET_BUTTON_SELECTOR);
  if (!button || walletManagerReady() || button.dataset.walletConnectQueued) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.walletConnectQueued = 'true';
  button.dataset.walletConnectOriginal = button.textContent || 'Connect Wallet';
  button.textContent = 'Loading wallets…';
  button.setAttribute('aria-busy', 'true');

  const resume = () => {
    restoreQueuedButton(button);
    button.click();
  };
  window.addEventListener('tree:wallet-manager-ready', resume, { once: true });
  window.setTimeout(() => {
    if (!button.dataset.walletConnectQueued) return;
    window.removeEventListener('tree:wallet-manager-ready', resume);
    restoreQueuedButton(button);
    document.getElementById('swapStatus')?.replaceChildren(document.createTextNode('Wallet choices are taking longer than expected. Tap Connect Wallet again.'));
  }, 10_000);
}, true);
