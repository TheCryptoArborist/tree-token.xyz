import { shortenSuiAddress } from './wallet-manager-core.js';
import './wallet.js';

const root = document.querySelector('[data-arcade-sui-wallet]');

if (root instanceof HTMLElement) {
  const heading = root.querySelector('[data-sui-wallet-heading]');
  const status = root.querySelector('[data-sui-wallet-status]');
  const details = root.querySelector('[data-sui-wallet-details]');
  const walletName = root.querySelector('[data-sui-wallet-name]');
  const walletAddress = root.querySelector('[data-sui-wallet-address]');
  const network = root.querySelector('[data-sui-wallet-network]');
  const connectButton = root.querySelector('[data-sui-wallet-connect]');
  let busy = true;
  let notice = null;

  const setText = (element, value) => {
    if (element) element.textContent = value;
  };

  const render = () => {
    const address = typeof window.playerAddress === 'string' ? window.playerAddress : null;
    const name = window.currentWallet?.name || window.currentWalletName || 'Sui Wallet';
    const connected = Boolean(address);

    root.dataset.suiWalletState = notice ? 'error' : connected ? 'connected' : busy ? 'loading' : 'disconnected';
    setText(heading, connected ? `${name} connected` : 'Sui wallet not connected');
    setText(status, notice || (connected
      ? 'Connected to Sui Mainnet. No signature or transaction was requested.'
      : busy
        ? 'Checking for a saved Sui wallet connection…'
        : 'Connect Slush, Phantom, Nightly, or another compatible Sui wallet.'));
    setText(walletName, name);
    setText(walletAddress, address ? shortenSuiAddress(address) : '—');
    setText(network, 'Sui Mainnet');
    if (details instanceof HTMLElement) details.hidden = !connected;
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = busy;
      connectButton.textContent = connected ? 'MANAGE SUI WALLET' : 'CONNECT SUI WALLET';
    }
  };

  connectButton?.addEventListener('click', async () => {
    notice = null;
    busy = true;
    render();
    try {
      await window.openWalletManager?.({ mode: window.playerAddress ? 'manage' : 'picker' });
    } catch (error) {
      notice = error?.message || 'The Sui wallet manager could not be opened.';
    } finally {
      busy = false;
      render();
    }
  });

  window.addEventListener('tree:wallet-changed', () => {
    notice = null;
    busy = false;
    render();
  });

  render();
  try {
    await window.initializeWallet?.();
  } catch (error) {
    console.warn('Saved Sui wallet connection could not be restored.', error);
  } finally {
    busy = false;
    render();
  }
}
