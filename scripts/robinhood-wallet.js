import {
  SAFE_WALLET_METHODS,
  SUPPORTED_NETWORKS,
  formatEvmAddress,
  getSupportedNetwork,
  getWalletErrorMessage,
  normalizeChainId,
} from './robinhood-wallet-core.js';

const root = document.querySelector('[data-robinhood-wallet]');

if (root instanceof HTMLElement) {
  const heading = root.querySelector('[data-wallet-heading]');
  const status = root.querySelector('[data-wallet-status]');
  const light = root.querySelector('[data-wallet-light]');
  const details = root.querySelector('[data-wallet-details]');
  const addressOutput = root.querySelector('[data-wallet-address]');
  const networkOutput = root.querySelector('[data-wallet-network]');
  const connectButton = root.querySelector('[data-wallet-connect]');
  const switchButtons = [...root.querySelectorAll('[data-wallet-switch]')];

  const safeMethods = new Set(SAFE_WALLET_METHODS);
  let provider = null;
  let account = null;
  let chainId = null;
  let busy = false;
  let notice = null;

  const findMetaMask = () => {
    const injected = window.ethereum;
    if (!injected) return null;
    if (Array.isArray(injected.providers)) {
      return injected.providers.find((candidate) => candidate?.isMetaMask === true) ?? null;
    }
    return injected.isMetaMask === true ? injected : null;
  };

  const request = async (method, params) => {
    if (!provider || typeof provider.request !== 'function' || !safeMethods.has(method)) {
      throw new Error('Unsupported wallet request');
    }
    return provider.request(params === undefined ? { method } : { method, params });
  };

  const setText = (element, value) => {
    if (element) element.textContent = value;
  };

  const render = () => {
    const connected = Boolean(account);
    const activeNetwork = getSupportedNetwork(chainId);
    const detectedChain = normalizeChainId(chainId);

    root.dataset.walletState = !provider ? 'missing' : connected && activeNetwork ? 'ready' : connected ? 'wrong-network' : 'available';
    setText(heading, !provider ? 'MetaMask not detected' : connected && activeNetwork ? `${activeNetwork.chainName} ready` : connected ? 'Wallet connected' : 'MetaMask available');
    setText(status, notice ?? (!provider
      ? 'Install or enable MetaMask to use this connection preview.'
      : connected && activeNetwork
        ? `Connected to ${activeNetwork.chainName}. No signature or transaction was requested.`
        : connected
          ? 'Your wallet is connected. Choose a supported test network below.'
          : 'Connect MetaMask to read your public address and current network.'));
    setText(addressOutput, formatEvmAddress(account) ?? 'Not connected');
    setText(networkOutput, activeNetwork ? `${activeNetwork.chainName} (${activeNetwork.chainId})` : detectedChain === null ? 'Unknown' : `Chain ID ${detectedChain}`);

    if (details instanceof HTMLElement) details.hidden = !connected;
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = busy || !provider;
      connectButton.textContent = connected ? 'REFRESH CONNECTION' : 'CONNECT METAMASK';
    }
    switchButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const network = SUPPORTED_NETWORKS[button.dataset.walletSwitch];
      button.disabled = busy || !provider || activeNetwork?.key === network?.key;
    });
    if (light instanceof HTMLElement) light.setAttribute('aria-label', connected && activeNetwork ? 'Ready' : 'Not ready');
  };

  const refresh = async ({ requestAccess = false, preserveNotice = false } = {}) => {
    if (!provider) return render();
    if (!preserveNotice) notice = null;
    busy = true;
    render();
    try {
      const accounts = await request(requestAccess ? 'eth_requestAccounts' : 'eth_accounts');
      chainId = await request('eth_chainId');
      account = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
    } catch (error) {
      notice = getWalletErrorMessage(error);
    } finally {
      busy = false;
      render();
    }
  };

  connectButton?.addEventListener('click', () => refresh({ requestAccess: true }));

  switchButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const network = SUPPORTED_NETWORKS[button.dataset.walletSwitch];
      if (!provider || !network) return;
      notice = null;
      busy = true;
      render();
      try {
        await request('wallet_switchEthereumChain', [{ chainId: network.chainIdHex }]);
      } catch (error) {
        if (Number(error?.code) === 4902) {
          try {
            await request('wallet_addEthereumChain', [{
              chainId: network.chainIdHex,
              chainName: network.chainName,
              nativeCurrency: network.nativeCurrency,
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: [network.explorerUrl],
            }]);
          } catch (addError) {
            notice = getWalletErrorMessage(addError);
          }
        } else {
          notice = getWalletErrorMessage(error);
        }
      } finally {
        busy = false;
        await refresh({ preserveNotice: Boolean(notice) });
      }
    });
  });

  provider = findMetaMask();
  if (provider?.on) {
    provider.on('accountsChanged', (accounts) => {
      notice = null;
      account = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      render();
    });
    provider.on('chainChanged', (nextChainId) => {
      notice = null;
      chainId = nextChainId;
      render();
    });
  }

  render();
  refresh();
}
