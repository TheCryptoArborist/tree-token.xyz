// wallet.js — TREE Website

import { getWallets } from 'https://esm.run/@mysten/wallet-standard@0.13.0';
import { SuiClient } from 'https://esm.run/@mysten/sui@1.43.0/client';

// ── Config ────────────────────────────────────────────────────────────────────
const NETWORK = 'mainnet';
const CHAIN = `sui:${NETWORK}`;
const RPC_URL = 'https://fullnode.mainnet.sui.io:443';
const SESSION_TTL_MS = 60 * 60 * 1000;

// Modern wallets use this first, legacy wallets may still expose the block version
const SIGN_FEATURES = [
  'sui:signAndExecuteTransaction',
  'sui:signAndExecuteTransactionBlock',
];

// ── In-memory session ─────────────────────────────────────────────────────────
const _mem = { address: null, name: null, expiry: 0 };

function _save(address, name) {
  const expiry = Date.now() + SESSION_TTL_MS;
  _mem.address = address;
  _mem.name = name;
  _mem.expiry = expiry;
  try { sessionStorage.setItem('suiAddr', address); } catch (_) {}
  try { sessionStorage.setItem('suiName', name); } catch (_) {}
  try { sessionStorage.setItem('suiExpiry', String(expiry)); } catch (_) {}
}

function _clear() {
  _mem.address = null;
  _mem.name = null;
  _mem.expiry = 0;
  try { sessionStorage.removeItem('suiAddr'); } catch (_) {}
  try { sessionStorage.removeItem('suiName'); } catch (_) {}
  try { sessionStorage.removeItem('suiExpiry'); } catch (_) {}
}

function _load() {
  if (_mem.address && Date.now() < _mem.expiry) {
    return { address: _mem.address, name: _mem.name };
  }
  try {
    const a = sessionStorage.getItem('suiAddr');
    const n = sessionStorage.getItem('suiName');
    const e = parseInt(sessionStorage.getItem('suiExpiry') || '0', 10);
    if (a && n && Date.now() < e) {
      _mem.address = a;
      _mem.name = n;
      _mem.expiry = e;
      return { address: a, name: n };
    }
  } catch (_) {}
  return null;
}

// ── State ─────────────────────────────────────────────────────────────────────
let _wallet = null;
let _address = null;
let _account = null;
let _suiClient = null;

function _getClient() {
  if (!_suiClient) _suiClient = new SuiClient({ url: RPC_URL });
  return _suiClient;
}

function _getSignFeature(wallet) {
  for (const f of SIGN_FEATURES) {
    if (wallet.features?.[f]) return f;
  }
  return null;
}

function _looksLikeSuiAccount(account) {
  const chains = account?.chains || [];
  return (
    chains.length === 0 ||
    chains.includes('sui') ||
    chains.some((c) => typeof c === 'string' && c.startsWith('sui:'))
  );
}

function _pickAccount(accounts, preferredAddress = null) {
  const list = accounts || [];
  if (!list.length) return null;

  if (preferredAddress) {
    const exact = list.find((a) => a.address === preferredAddress);
    if (exact) return exact;
  }

  const explicitMainnet = list.find((a) => (a.chains || []).includes(CHAIN));
  if (explicitMainnet) return explicitMainnet;

  const suiish = list.find((a) => _looksLikeSuiAccount(a));
  if (suiish) return suiish;

  return list[0];
}

// ── connectWallet ─────────────────────────────────────────────────────────────
async function connectWallet() {
  const allWallets = getWallets().get();

  console.log('🔍 All wallets detected:', allWallets.map((w) => ({
    name: w.name,
    features: Object.keys(w.features || {}),
    accounts: (w.accounts || []).length,
  })));

  const suiWallets = allWallets.filter((w) => _getSignFeature(w) !== null);
  console.log('✅ Sui-compatible:', suiWallets.map((w) => w.name));

  if (suiWallets.length === 0) {
    throw new Error('NO_WALLET');
  }

  const wallet = suiWallets.find((w) => (w.accounts || []).length > 0) || suiWallets[0];
  console.log('Connecting to:', wallet.name, '| feature:', _getSignFeature(wallet));

  if (wallet.features['standard:connect']) {
    await wallet.features['standard:connect'].connect();
  }

  if (!wallet.accounts || wallet.accounts.length === 0) {
    throw new Error('No accounts found. Please unlock your wallet and approve access.');
  }

  const account = _pickAccount(wallet.accounts);

  if (!account) {
    throw new Error('No suitable Sui account found.');
  }

  const chains = account.chains || [];
  if (chains.length > 0) {
    const hasMainnet = chains.includes(CHAIN);
    const looksSui = _looksLikeSuiAccount(account);
    if (!hasMainnet && !looksSui) {
      throw new Error('WRONG_NETWORK');
    }
  }

  _wallet = wallet;
  _account = account;
  _address = account.address;

  window.currentWallet = _wallet;
  window.currentAccount = _account;
  window.playerAddress = _address;

  _save(_address, wallet.name);
  console.log('✅ Wallet connected:', _address, 'via', wallet.name, '| chains:', account.chains);

  return { wallet: _wallet, address: _address, account: _account };
}

// ── disconnectWallet ──────────────────────────────────────────────────────────
async function disconnectWallet() {
  try {
    if (_wallet?.features['standard:disconnect']) {
      await _wallet.features['standard:disconnect'].disconnect();
    }
  } catch (_) {}

  _wallet = null;
  _account = null;
  _address = null;
  _suiClient = null;

  window.currentWallet = null;
  window.currentAccount = null;
  window.playerAddress = null;

  _clear();
  console.log('Wallet disconnected');
}

// ── getBalance ────────────────────────────────────────────────────────────────
async function getBalance() {
  if (!window.playerAddress) throw new Error('Wallet not connected');
  const client = _getClient();
  const balance = await client.getBalance({
    owner: window.playerAddress,
    coinType: '0x2::sui::SUI',
  });
  return BigInt(balance.totalBalance);
}

// ── signAndExecuteTransactionBlock ────────────────────────────────────────────
async function signAndExecuteTransactionBlock(txb) {
  if (!_wallet || !_address || !_account) {
    throw new Error('Wallet not connected');
  }

  const featName = _getSignFeature(_wallet);
  if (!featName) {
    throw new Error('Wallet does not support Sui transaction signing.');
  }

  const feat = _wallet.features[featName];

  if (featName === 'sui:signAndExecuteTransaction') {
    return await feat.signAndExecuteTransaction({
      account: _account,
      chain: CHAIN,
      transaction: txb,
      options: { showEffects: true, showEvents: true },
    });
  }

  return await feat.signAndExecuteTransactionBlock({
    account: _account,
    chain: CHAIN,
    transactionBlock: txb,
    options: { showEffects: true, showEvents: true },
  });
}

// ── initializeWallet ──────────────────────────────────────────────────────────
async function initializeWallet() {
  const saved = _load();
  if (!saved) return;

  try {
    const allWallets = getWallets().get();
    const wallet = allWallets.find((w) => w.name === saved.name);
    if (!wallet) return;

    const account = _pickAccount(wallet.accounts || [], saved.address);
    if (!account) return;

    _wallet = wallet;
    _account = account;
    _address = account.address;

    window.currentWallet = _wallet;
    window.currentAccount = _account;
    window.playerAddress = _address;

    _getClient();
    console.log('✅ Session restored:', _address, '| chains:', account.chains);
  } catch (e) {
    console.warn('Session restore skipped:', e.message);
  }
}

async function checkBalanceAndNFT() {
  try {
    return Number(await getBalance()) > 0;
  } catch {
    return false;
  }
}

// ── Expose globals ────────────────────────────────────────────────────────────
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.initializeWallet = initializeWallet;
window.getBalance = getBalance;
window.signAndExecuteTransactionBlock = signAndExecuteTransactionBlock;
window.checkBalanceAndNFT = checkBalanceAndNFT;
window.initSuiClient = _getClient;