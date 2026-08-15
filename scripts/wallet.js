// wallet.js — TREE Command Center wallet selection and session management

import {
  getWallets,
  signAndExecuteTransaction as walletSignAndExecuteTransaction,
} from 'https://esm.run/@mysten/wallet-standard@0.21.14';
import { SuiGrpcClient } from 'https://esm.run/@mysten/sui@2.23.1/grpc';
import {
  SUI_MAINNET_CHAIN,
  compatibleSuiWallets,
  getSuiSignFeature,
  isSlushWallet,
  pickSuiAccount,
  safeWalletIcon,
  shortenSuiAddress,
  slushBrowseUrl,
  walletKey,
} from './wallet-manager-core.js';

const APP_NAME = 'TREE Command Center';
const NETWORK = 'mainnet';
const CHAIN = SUI_MAINNET_CHAIN;
const RPC_URL = 'https://fullnode.mainnet.sui.io:443';
const SESSION_TTL_MS = 60 * 60 * 1000;
const WALLET_STANDARD_URL = 'https://esm.run/@mysten/wallet-standard@0.21.14';
const SLUSH_WALLET_URL = 'https://esm.run/@mysten/slush-wallet@1.1.14';
const WALLET_CONNECT_TIMEOUT_MS = 12_000;
const SESSION_KEYS = {
  address: 'tree:sui:address',
  walletKey: 'tree:sui:wallet-key',
  walletName: 'tree:sui:wallet-name',
  expiry: 'tree:sui:expiry',
};

const registry = getWallets();
const _mem = { address: null, walletKey: null, walletName: null, expiry: 0 };
let _wallet = null;
let _address = null;
let _account = null;
let _suiClient = null;
let _walletEventsUnsubscribe = null;
let _managerPromise = null;
let _resolveManager = null;
let _managerResult = { action: 'cancel' };
let _managerMode = 'picker';
let _dialog = null;
let _dialogNodes = null;

const _slushReady = (async () => {
  try {
    const { registerSlushWallet } = await import(SLUSH_WALLET_URL);
    if (typeof registerSlushWallet === 'function') {
      registerSlushWallet(APP_NAME, { network: NETWORK });
    }
  } catch (error) {
    console.warn('Slush web-wallet registration was unavailable. Installed Sui wallets can still connect.', error);
  }
})();

function _getClient() {
  if (!_suiClient) {
    _suiClient = new SuiGrpcClient({ network: NETWORK, baseUrl: RPC_URL });
  }
  return _suiClient;
}

function _storageSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch (_) {}
}

function _storageRemove(key) {
  try { sessionStorage.removeItem(key); } catch (_) {}
}

function _save(address, wallet) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const key = walletKey(wallet);
  const name = wallet?.name || 'Sui Wallet';
  Object.assign(_mem, { address, walletKey: key, walletName: name, expiry });
  _storageSet(SESSION_KEYS.address, address);
  _storageSet(SESSION_KEYS.walletKey, key);
  _storageSet(SESSION_KEYS.walletName, name);
  _storageSet(SESSION_KEYS.expiry, String(expiry));

  // Keep the original keys synchronized during the transition to the wallet manager.
  _storageSet('suiAddr', address);
  _storageSet('suiName', name);
  _storageSet('suiExpiry', String(expiry));
}

function _clearSession() {
  Object.assign(_mem, { address: null, walletKey: null, walletName: null, expiry: 0 });
  Object.values(SESSION_KEYS).forEach(_storageRemove);
  ['suiAddr', 'suiName', 'suiExpiry'].forEach(_storageRemove);
}

function _load() {
  if (_mem.address && Date.now() < _mem.expiry) return { ..._mem };
  try {
    const address = sessionStorage.getItem(SESSION_KEYS.address) || sessionStorage.getItem('suiAddr');
    const walletName = sessionStorage.getItem(SESSION_KEYS.walletName) || sessionStorage.getItem('suiName');
    const storedKey = sessionStorage.getItem(SESSION_KEYS.walletKey) || '';
    const expiry = Number.parseInt(sessionStorage.getItem(SESSION_KEYS.expiry) || sessionStorage.getItem('suiExpiry') || '0', 10);
    if (address && walletName && Date.now() < expiry) {
      Object.assign(_mem, { address, walletKey: storedKey, walletName, expiry });
      return { ..._mem };
    }
  } catch (_) {}
  return null;
}

function _emitWalletChanged(status, reason) {
  const detail = {
    status,
    reason,
    walletName: _wallet?.name || null,
    walletKey: walletKey(_wallet) || null,
    address: _address,
    accountCount: Array.isArray(_wallet?.accounts) ? _wallet.accounts.length : 0,
  };
  window.dispatchEvent(new CustomEvent('tree:wallet-changed', { detail }));
}

function _unsubscribeWalletEvents() {
  try { _walletEventsUnsubscribe?.(); } catch (_) {}
  _walletEventsUnsubscribe = null;
}

function _validateAccountNetwork(account) {
  const chains = Array.isArray(account?.chains) ? account.chains : [];
  const explicitSuiChains = chains.filter((chain) => typeof chain === 'string' && chain.startsWith('sui:'));
  if (explicitSuiChains.length && !explicitSuiChains.includes(CHAIN)) {
    throw new Error('WRONG_NETWORK');
  }
}

function _bindWalletEvents(wallet) {
  _unsubscribeWalletEvents();
  const events = wallet?.features?.['standard:events'];
  if (!events?.on) return;

  try {
    _walletEventsUnsubscribe = events.on('change', ({ accounts } = {}) => {
      if (!Array.isArray(accounts)) return;
      if (!accounts.length) {
        _clearConnection({ clearSession: true, reason: 'wallet-accounts-cleared' });
        return;
      }

      const nextAccount = pickSuiAccount(accounts, _address) || pickSuiAccount(accounts);
      if (!nextAccount) return;
      try { _validateAccountNetwork(nextAccount); } catch (_) { return; }
      const changed = nextAccount.address !== _address;
      _account = nextAccount;
      _address = nextAccount.address;
      window.currentAccount = _account;
      window.playerAddress = _address;
      _save(_address, wallet);
      if (changed) _emitWalletChanged('connected', 'wallet-account-change');
      if (_dialog?.open) _renderWalletManager();
    });
  } catch (error) {
    console.warn('Wallet account-change subscription was unavailable.', error);
  }
}

function _setConnection(wallet, account, reason = 'connected') {
  _validateAccountNetwork(account);
  _wallet = wallet;
  _account = account;
  _address = account.address;
  window.currentWallet = wallet;
  window.currentWalletName = wallet.name;
  window.currentAccount = account;
  window.playerAddress = account.address;
  _save(account.address, wallet);
  _bindWalletEvents(wallet);
  _getClient();
  _emitWalletChanged('connected', reason);
}

function _clearConnection({ clearSession = true, reason = 'disconnected' } = {}) {
  _unsubscribeWalletEvents();
  _wallet = null;
  _account = null;
  _address = null;
  _suiClient = null;
  window.currentWallet = null;
  window.currentWalletName = null;
  window.currentAccount = null;
  window.playerAddress = null;
  if (clearSession) _clearSession();
  _emitWalletChanged('disconnected', reason);
}

async function _waitForWalletRegistration() {
  await _slushReady;
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function _compatibleWallets() {
  await _waitForWalletRegistration();
  const saved = _load();
  return compatibleSuiWallets(registry.get(), saved?.walletKey || '');
}

async function _requestWalletConnection(wallet, connect) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(isSlushWallet(wallet) ? 'SLUSH_CONNECT_TIMEOUT' : 'WALLET_CONNECT_TIMEOUT'));
    }, WALLET_CONNECT_TIMEOUT_MS);
  });
  try { return await Promise.race([connect(), timeout]); }
  finally { clearTimeout(timeoutId); }
}

async function _connectToWallet(wallet, preferredAddress = null) {
  if (!wallet || getSuiSignFeature(wallet) === null) throw new Error('Wallet does not support Sui transaction signing.');
  if (_wallet && walletKey(_wallet) !== walletKey(wallet)) await disconnectWallet({ reason: 'switch-wallet' });

  const connectFeature = wallet.features?.['standard:connect'];
  if (!connectFeature?.connect) throw new Error('This wallet does not expose a connection request.');

  const result = await _requestWalletConnection(wallet, () => connectFeature.connect());
  const accounts = Array.isArray(result?.accounts) && result.accounts.length
    ? result.accounts
    : wallet.accounts;
  const account = pickSuiAccount(accounts, preferredAddress);
  if (!account) throw new Error('No suitable Sui account was returned. Unlock the wallet and approve access.');

  _setConnection(wallet, account, 'connected');
  return { wallet, address: account.address, account };
}

async function connectWallet(walletReference = null) {
  if (!walletReference) {
    const result = await openWalletManager({ mode: 'picker' });
    if (result?.connection) return result.connection;
    const error = new Error('Wallet connection cancelled.');
    error.code = 'CANCELLED';
    throw error;
  }

  if (typeof walletReference === 'object') return _connectToWallet(walletReference);
  const wallets = await _compatibleWallets();
  const wallet = wallets.find((candidate) => walletKey(candidate) === walletReference || candidate.name === walletReference);
  if (!wallet) throw new Error('The selected wallet is no longer available.');
  return _connectToWallet(wallet);
}

async function disconnectWallet({ reason = 'disconnect-and-forget' } = {}) {
  const wallet = _wallet;
  try {
    if (wallet?.features?.['standard:disconnect']?.disconnect) {
      await wallet.features['standard:disconnect'].disconnect();
    }
  } catch (error) {
    console.warn('The wallet did not acknowledge the disconnect request; local connection data was still cleared.', error);
  } finally {
    _clearConnection({ clearSession: true, reason });
  }
}

async function switchWalletAccount(address) {
  if (!_wallet) throw new Error('Wallet not connected.');
  const account = pickSuiAccount(_wallet.accounts || [], address);
  if (!account || account.address !== address) throw new Error('That account is not available in the connected wallet.');
  _setConnection(_wallet, account, 'account-switched');
  return { wallet: _wallet, address: account.address, account };
}

function _injectWalletStyles() {
  if (document.getElementById('treeWalletManagerStyles')) return;
  const link = document.createElement('link');
  link.id = 'treeWalletManagerStyles';
  link.rel = 'stylesheet';
  link.href = new URL('../dapp/wallet-manager.css', import.meta.url).href;
  document.head.append(link);
}

function _createDialog() {
  if (_dialog) return _dialog;
  _injectWalletStyles();
  const dialog = document.createElement('dialog');
  dialog.id = 'treeWalletDialog';
  dialog.className = 'tree-wallet-dialog';
  dialog.setAttribute('aria-labelledby', 'treeWalletTitle');
  dialog.innerHTML = `
    <div class="tree-wallet-shell">
      <header class="tree-wallet-header">
        <div><h2 id="treeWalletTitle">Wallet Manager</h2><p id="treeWalletSubtitle">Choose which Sui wallet connects to TREE.</p></div>
        <button class="tree-wallet-close" type="button" aria-label="Close wallet manager">×</button>
      </header>
      <div class="tree-wallet-body">
        <section class="tree-wallet-section" data-wallet-panel="picker">
          <p class="tree-wallet-subheading">Available Sui wallets</p>
          <div class="tree-wallet-list" data-wallet-list></div>
          <button class="tree-wallet-refresh" type="button" data-wallet-refresh>Refresh wallet list</button>
          <a class="tree-wallet-slush-link" data-slush-link target="_blank" rel="noopener noreferrer">
            <span class="tree-wallet-slush-mark" aria-hidden="true">S</span>
            <span><strong>Open this site in Slush</strong><small>Best option for the Slush mobile app or web wallet</small></span>
            <span aria-hidden="true">↗</span>
          </a>
          <p class="tree-wallet-note">Only Sui-compatible wallets are shown. Slush is registered as a web-wallet option, while installed wallets such as Slush and Phantom are detected through the Sui Wallet Standard.</p>
        </section>
        <section class="tree-wallet-section" data-wallet-panel="manage" hidden>
          <div class="tree-wallet-current" data-wallet-current></div>
          <div data-wallet-accounts></div>
          <div class="tree-wallet-actions">
            <button class="tree-wallet-action" type="button" data-wallet-switch>Switch wallet</button>
            <button class="tree-wallet-action danger" type="button" data-wallet-disconnect>Disconnect &amp; forget</button>
          </div>
          <p class="tree-wallet-note">Disconnect &amp; forget clears this site's saved wallet and asks the wallet to disconnect. Some wallet apps retain Connected Apps permission until it is also removed in the wallet's own settings.</p>
        </section>
        <p class="tree-wallet-status" data-wallet-status role="status" aria-live="polite"></p>
      </div>
    </div>`;
  document.body.append(dialog);

  _dialog = dialog;
  _dialogNodes = {
    title: dialog.querySelector('#treeWalletTitle'),
    subtitle: dialog.querySelector('#treeWalletSubtitle'),
    picker: dialog.querySelector('[data-wallet-panel="picker"]'),
    manage: dialog.querySelector('[data-wallet-panel="manage"]'),
    list: dialog.querySelector('[data-wallet-list]'),
    current: dialog.querySelector('[data-wallet-current]'),
    accounts: dialog.querySelector('[data-wallet-accounts]'),
    status: dialog.querySelector('[data-wallet-status]'),
    slushLink: dialog.querySelector('[data-slush-link]'),
  };

  dialog.querySelector('.tree-wallet-close').addEventListener('click', () => _closeWalletManager({ action: 'cancel' }));
  dialog.querySelector('[data-wallet-refresh]').addEventListener('click', () => _renderWalletManager());
  dialog.querySelector('[data-wallet-switch]').addEventListener('click', async () => {
    _setManagerStatus('Disconnecting the current wallet before switching…');
    await disconnectWallet({ reason: 'switch-wallet' });
    _managerMode = 'picker';
    await _renderWalletManager();
  });
  dialog.querySelector('[data-wallet-disconnect]').addEventListener('click', async () => {
    _setManagerStatus('Disconnecting and removing the saved wallet…');
    await disconnectWallet({ reason: 'disconnect-and-forget' });
    _closeWalletManager({ action: 'disconnected' });
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    _closeWalletManager({ action: 'cancel' });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) _closeWalletManager({ action: 'cancel' });
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('tree-wallet-modal-open');
    const resolve = _resolveManager;
    const result = _managerResult;
    _resolveManager = null;
    _managerPromise = null;
    _managerResult = { action: 'cancel' };
    resolve?.(result);
  });
  return dialog;
}

function _setManagerStatus(message = '', state = '') {
  if (!_dialogNodes?.status) return;
  _dialogNodes.status.textContent = message;
  _dialogNodes.status.className = `tree-wallet-status${state ? ` ${state}` : ''}`;
}

function _walletIconNode(wallet, className) {
  const shell = document.createElement('span');
  shell.className = className;
  const icon = safeWalletIcon(wallet?.icon);
  if (icon) {
    const image = document.createElement('img');
    image.src = icon;
    image.alt = '';
    shell.append(image);
  } else {
    shell.textContent = String(wallet?.name || 'W').slice(0, 1).toUpperCase();
  }
  return shell;
}

async function _renderPicker() {
  const wallets = await _compatibleWallets();
  _dialogNodes.list.replaceChildren();
  _dialogNodes.title.textContent = 'Connect a Sui Wallet';
  _dialogNodes.subtitle.textContent = 'Select Slush, Phantom, or another compatible Sui wallet.';
  _dialogNodes.slushLink.href = slushBrowseUrl(`${location.origin}/dapp/`);

  if (!wallets.length) {
    const empty = document.createElement('div');
    empty.className = 'tree-wallet-empty';
    empty.textContent = 'No injected Sui wallet was detected. Use the Slush option below or unlock an installed wallet, then refresh this list.';
    _dialogNodes.list.append(empty);
    return;
  }

  for (const wallet of wallets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tree-wallet-option${isSlushWallet(wallet) ? ' is-slush' : ''}`;
    button.dataset.walletKey = walletKey(wallet);
    button.append(_walletIconNode(wallet, 'tree-wallet-option-icon'));

    const copy = document.createElement('span');
    copy.className = 'tree-wallet-option-copy';
    const name = document.createElement('strong');
    name.textContent = wallet.name;
    const detail = document.createElement('span');
    detail.textContent = isSlushWallet(wallet)
      ? 'Slush extension or secure Slush web wallet'
      : `${wallet.accounts?.length || 0} authorized account${wallet.accounts?.length === 1 ? '' : 's'}`;
    copy.append(name, detail);

    const action = document.createElement('span');
    action.className = 'tree-wallet-option-action';
    action.textContent = 'Connect';
    button.append(copy, action);
    button.addEventListener('click', async () => {
      _setManagerStatus(`Connecting to ${wallet.name}…`);
      button.disabled = true;
      try {
        const connection = await _connectToWallet(wallet);
        _setManagerStatus(`Connected with ${wallet.name}.`, 'success');
        _closeWalletManager({ action: 'connected', connection });
      } catch (error) {
        const message = error?.message === 'WRONG_NETWORK'
          ? 'Switch the wallet to Sui Mainnet and try again.'
          : error?.message === 'SLUSH_CONNECT_TIMEOUT'
            ? 'Slush did not open a connection window. Use “Open this site in Slush” below, or unlock the Slush extension and refresh the wallet list.'
            : error?.message === 'WALLET_CONNECT_TIMEOUT'
              ? `${wallet.name} did not respond. Unlock the wallet extension, refresh the wallet list, and try again.`
          : error?.message || 'Wallet connection failed.';
        _setManagerStatus(message, 'error');
        button.disabled = false;
      }
    });
    _dialogNodes.list.append(button);
  }
}

function _renderManage() {
  const wallet = _wallet;
  const account = _account;
  _dialogNodes.title.textContent = 'Manage Wallet';
  _dialogNodes.subtitle.textContent = 'Switch accounts, choose another wallet, or disconnect completely from this site.';
  _dialogNodes.current.replaceChildren();
  _dialogNodes.current.append(_walletIconNode(wallet, 'tree-wallet-current-icon'));

  const copy = document.createElement('span');
  const name = document.createElement('strong');
  name.textContent = wallet?.name || 'Sui Wallet';
  const address = document.createElement('span');
  address.textContent = account?.address || 'No account selected';
  address.title = account?.address || '';
  copy.append(name, address);
  _dialogNodes.current.append(copy);

  _dialogNodes.accounts.replaceChildren();
  const accounts = Array.isArray(wallet?.accounts) ? wallet.accounts.filter((candidate) => pickSuiAccount([candidate])) : [];
  if (accounts.length > 1) {
    const heading = document.createElement('p');
    heading.className = 'tree-wallet-subheading';
    heading.textContent = 'Accounts in this wallet';
    const list = document.createElement('div');
    list.className = 'tree-wallet-account-list';
    for (const candidate of accounts) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tree-wallet-account';
      button.setAttribute('aria-current', candidate.address === _address ? 'true' : 'false');
      const accountCopy = document.createElement('span');
      accountCopy.className = 'tree-wallet-account-copy';
      const short = document.createElement('strong');
      short.textContent = shortenSuiAddress(candidate.address, 10, 8);
      const full = document.createElement('span');
      full.textContent = candidate.address;
      accountCopy.append(short, full);
      const state = document.createElement('span');
      state.className = 'tree-wallet-account-state';
      state.textContent = candidate.address === _address ? 'Active' : 'Use';
      button.append(accountCopy, state);
      button.addEventListener('click', async () => {
        if (candidate.address === _address) return;
        try {
          await switchWalletAccount(candidate.address);
          _setManagerStatus('Active account changed.', 'success');
          _renderManage();
        } catch (error) {
          _setManagerStatus(error?.message || 'Account switch failed.', 'error');
        }
      });
      list.append(button);
    }
    _dialogNodes.accounts.append(heading, list);
  }
}

async function _renderWalletManager() {
  if (!_dialogNodes) return;
  const manage = _managerMode === 'manage' && Boolean(_wallet && _address);
  _dialogNodes.picker.hidden = manage;
  _dialogNodes.manage.hidden = !manage;
  _setManagerStatus('');
  if (manage) _renderManage();
  else await _renderPicker();
}

function _closeWalletManager(result = { action: 'cancel' }) {
  if (!_dialog) return;
  _managerResult = result;
  if (_dialog.open) _dialog.close();
}

async function openWalletManager({ mode = null } = {}) {
  await _waitForWalletRegistration();
  const dialog = _createDialog();
  if (dialog.open && _managerPromise) return _managerPromise;

  _managerMode = mode || (_wallet && _address ? 'manage' : 'picker');
  _managerResult = { action: 'cancel' };
  _managerPromise = new Promise((resolve) => { _resolveManager = resolve; });
  await _renderWalletManager();
  document.body.classList.add('tree-wallet-modal-open');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  return _managerPromise;
}

async function getAvailableWallets() {
  const wallets = await _compatibleWallets();
  return wallets.map((wallet) => ({
    id: walletKey(wallet),
    name: wallet.name,
    isSlush: isSlushWallet(wallet),
    accountCount: wallet.accounts?.length || 0,
  }));
}

async function getBalance() {
  if (!window.playerAddress) throw new Error('Wallet not connected');
  const { balance } = await _getClient().core.getBalance({
    owner: window.playerAddress,
    coinType: '0x2::sui::SUI',
  });
  return BigInt(balance.balance);
}

async function signAndExecuteTransactionBlock(transaction) {
  if (!_wallet || !_address || !_account) throw new Error('Wallet not connected');
  if (!getSuiSignFeature(_wallet)) throw new Error('Wallet does not support Sui transaction signing.');
  return walletSignAndExecuteTransaction(_wallet, {
    account: _account,
    chain: CHAIN,
    transaction,
  });
}

async function initializeWallet() {
  await _waitForWalletRegistration();
  const saved = _load();
  if (!saved) return null;

  try {
    const wallets = compatibleSuiWallets(registry.get(), saved.walletKey || '');
    const wallet = wallets.find((candidate) => walletKey(candidate) === saved.walletKey)
      || wallets.find((candidate) => candidate.name === saved.walletName);
    if (!wallet) return null;

    const account = pickSuiAccount(wallet.accounts || [], saved.address);
    if (!account) return null;
    _setConnection(wallet, account, 'session-restored');
    return { wallet, address: account.address, account };
  } catch (error) {
    console.warn('Wallet session restore skipped.', error);
    return null;
  }
}

async function checkBalanceAndNFT() {
  try { return Number(await getBalance()) > 0; } catch { return false; }
}

function _refreshOpenPicker() {
  if (_dialog?.open && _managerMode === 'picker') _renderWalletManager();
}

try { registry.on?.('register', _refreshOpenPicker); } catch (_) {}
try { registry.on?.('unregister', _refreshOpenPicker); } catch (_) {}

window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.openWalletManager = openWalletManager;
window.switchWalletAccount = switchWalletAccount;
window.getAvailableWallets = getAvailableWallets;
window.initializeWallet = initializeWallet;
window.getBalance = getBalance;
window.signAndExecuteTransactionBlock = signAndExecuteTransactionBlock;
window.checkBalanceAndNFT = checkBalanceAndNFT;
window.initSuiClient = _getClient;
window.TREE_WALLET_STANDARD_URL = WALLET_STANDARD_URL;
