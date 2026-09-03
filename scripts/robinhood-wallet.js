import {
  ROBINHOOD_TESTNET,
  SAFE_WALLET_METHODS,
  formatEvmAddress,
  getWalletErrorMessage,
  isRobinhoodTestnet,
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
  const switchButton = root.querySelector('[data-wallet-switch]');

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
    const onTestnet = isRobinhoodTestnet(chainId);
    const detectedChain = normalizeChainId(chainId);

    root.dataset.walletState = !provider ? 'missing' : connected && onTestnet ? 'ready' : connected ? 'wrong-network' : 'available';
    setText(heading, !provider ? 'MetaMask not detected' : connected && onTestnet ? 'Robinhood testnet ready' : connected ? 'Wallet connected' : 'MetaMask available');
    setText(status, notice ?? (!provider
      ? 'Install or enable MetaMask to use this connection preview.'
      : connected && onTestnet
        ? 'Connected to Robinhood Chain Testnet. No signature or transaction was requested.'
        : connected
          ? 'Your wallet is connected, but Robinhood Chain Testnet is not active.'
          : 'Connect MetaMask to read your public address and current network.'));
    setText(addressOutput, formatEvmAddress(account) ?? 'Not connected');
    setText(networkOutput, onTestnet ? 'Robinhood Chain Testnet (46630)' : detectedChain === null ? 'Unknown' : `Chain ID ${detectedChain}`);

    if (details instanceof HTMLElement) details.hidden = !connected;
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = busy || !provider;
      connectButton.textContent = connected ? 'REFRESH CONNECTION' : 'CONNECT METAMASK';
    }
    if (switchButton instanceof HTMLButtonElement) switchButton.disabled = busy || !provider || onTestnet;
    if (light instanceof HTMLElement) light.setAttribute('aria-label', connected && onTestnet ? 'Ready' : 'Not ready');
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

  switchButton?.addEventListener('click', async () => {
    if (!provider) return;
    notice = null;
    busy = true;
    render();
    try {
      await request('wallet_switchEthereumChain', [{ chainId: ROBINHOOD_TESTNET.chainIdHex }]);
    } catch (error) {
      if (Number(error?.code) === 4902) {
        try {
          await request('wallet_addEthereumChain', [{
            chainId: ROBINHOOD_TESTNET.chainIdHex,
            chainName: ROBINHOOD_TESTNET.chainName,
            nativeCurrency: ROBINHOOD_TESTNET.nativeCurrency,
            rpcUrls: [ROBINHOOD_TESTNET.rpcUrl],
            blockExplorerUrls: [ROBINHOOD_TESTNET.explorerUrl],
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
