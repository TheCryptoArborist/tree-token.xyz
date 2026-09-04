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
  const nftreeResult = root.querySelector('[data-sui-nftree-result]');
  const connectButton = root.querySelector('[data-sui-wallet-connect]');
  const refreshButton = root.querySelector('[data-sui-nftree-refresh]');
  let busy = true;
  let notice = null;
  let verification = { state: 'idle', address: null, count: null };
  let verificationController = null;

  const setText = (element, value) => {
    if (element) element.textContent = value;
  };

  const publishVerification = () => {
    window.treeNftreeVerification = { ...verification };
    window.dispatchEvent(new CustomEvent('tree:nftree-verification', { detail: { ...verification } }));
  };

  const render = () => {
    const address = typeof window.playerAddress === 'string' ? window.playerAddress : null;
    const name = window.currentWallet?.name || window.currentWalletName || 'Sui Wallet';
    const connected = Boolean(address);
    const verificationCurrent = connected && verification.address === address;
    const accessText = !verificationCurrent || verification.state === 'loading'
      ? 'Checking…'
      : verification.state === 'verified'
        ? `Holder verified · ${verification.count} NFTree${verification.count === 1 ? '' : 's'}`
        : verification.state === 'none'
          ? 'No NFTree detected'
          : 'Verification unavailable';

    root.dataset.suiWalletState = notice || (verificationCurrent && verification.state === 'error') ? 'error' : connected ? 'connected' : busy ? 'loading' : 'disconnected';
    setText(heading, connected ? `${name} connected` : 'Sui wallet not connected');
    setText(status, notice || (connected
      ? 'Connected to Sui Mainnet. No signature or transaction was requested.'
      : busy
        ? 'Checking for a saved Sui wallet connection…'
        : 'Connect Slush, Phantom, Nightly, or another compatible Sui wallet.'));
    setText(walletName, name);
    setText(walletAddress, address ? shortenSuiAddress(address) : '—');
    setText(network, 'Sui Mainnet');
    setText(nftreeResult, accessText);
    if (details instanceof HTMLElement) details.hidden = !connected;
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = busy;
      connectButton.textContent = connected ? 'MANAGE SUI WALLET' : 'CONNECT SUI WALLET';
    }
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.hidden = !connected;
      refreshButton.disabled = busy || (verificationCurrent && verification.state === 'loading');
    }
  };

  const verifyNftreeOwnership = async (address) => {
    verificationController?.abort();
    if (!address) {
      verification = { state: 'idle', address: null, count: null };
      render();
      publishVerification();
      return;
    }
    const controller = new AbortController();
    verificationController = controller;
    verification = { state: 'loading', address, count: null };
    render();
    try {
      const response = await fetch(`/api/nftree-wallet?address=${encodeURIComponent(address)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.status !== 'ok' || payload?.address !== address || !Number.isSafeInteger(payload?.nftreeCount) || payload.nftreeCount < 0) {
        throw new Error('NFTree ownership could not be verified.');
      }
      verification = {
        state: payload.nftreeCount > 0 ? 'verified' : 'none',
        address,
        count: payload.nftreeCount,
      };
    } catch (error) {
      if (error?.name === 'AbortError') return;
      verification = { state: 'error', address, count: null };
    } finally {
      if (verificationController === controller) verificationController = null;
      render();
      publishVerification();
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

  refreshButton?.addEventListener('click', () => verifyNftreeOwnership(window.playerAddress));

  window.addEventListener('tree:wallet-changed', (event) => {
    notice = null;
    busy = false;
    render();
    verifyNftreeOwnership(event?.detail?.address || null);
  });

  render();
  try {
    await window.initializeWallet?.();
  } catch (error) {
    console.warn('Saved Sui wallet connection could not be restored.', error);
  } finally {
    busy = false;
    render();
    await verifyNftreeOwnership(window.playerAddress);
  }
}
