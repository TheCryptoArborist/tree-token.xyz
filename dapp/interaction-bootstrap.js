// Keep wallet controls usable even when the main dashboard script fails to load.
(() => {
  const selector = '#dappWallet, #rankWallet';
  const pending = new WeakSet();
  function report(button, message, error = false) {
    const id = `${button.id}ConnectionStatus`;
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('p');node.id = id;
      node.className = 'wallet-connection-status';node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      (button.closest('.app-wallet-zone') || button.parentElement).append(node);
      button.setAttribute('aria-describedby', id);
    }
    node.textContent = message;node.hidden = !message;node.dataset.error = String(error);
  }
  function waitForManager() {
    if (typeof window.openWalletManager === 'function') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const ready = () => {clearTimeout(timer);window.removeEventListener('tree:wallet-manager-ready', ready);resolve();};
      const timer = setTimeout(() => {
        window.removeEventListener('tree:wallet-manager-ready', ready);
        reject(new Error('Wallet connection tools could not load. Refresh this page and try again. If it continues, check whether your browser or network is blocking wallet scripts.'));
      }, 8000);
      window.addEventListener('tree:wallet-manager-ready', ready);
    });
  }
  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.(selector);
    if (!button) return;
    event.preventDefault();event.stopImmediatePropagation();
    if (pending.has(button)) return;
    pending.add(button);button.setAttribute('aria-busy', 'true');
    report(button, 'Opening wallet picker…');
    try {
      await waitForManager();
      if (typeof window.openWalletManager !== 'function') throw new Error('Wallet connection tools are unavailable. Refresh this page and try again.');
      const result = await window.openWalletManager();
      report(button, result?.action === 'connected' ? `Connected with ${window.currentWallet?.name || 'Sui wallet'}.` : result?.action === 'disconnected' ? 'Wallet disconnected.' : '');
    } catch (error) {
      report(button, error?.code === 'CANCELLED' ? '' : error?.message || 'Wallet connection failed. Please try again.', true);
    } finally {pending.delete(button);button.removeAttribute('aria-busy');}
  }, true);
})();
