export const SUI_MAINNET_CHAIN = 'sui:mainnet';

export const SUI_SIGN_FEATURES = [
  'sui:signAndExecuteTransaction',
  'sui:signAndExecuteTransactionBlock',
  'tree:phantomSui',
];

export const SUI_PERSONAL_MESSAGE_FEATURES = [
  'sui:signPersonalMessage',
  'sui:signMessage',
];

export function getSuiSignFeature(wallet) {
  for (const feature of SUI_SIGN_FEATURES) {
    if (wallet?.features?.[feature]) return feature;
  }
  return null;
}

export function looksLikeSuiAccount(account) {
  const chains = Array.isArray(account?.chains) ? account.chains : [];
  return chains.length === 0
    || chains.includes('sui')
    || chains.some((chain) => typeof chain === 'string' && chain.startsWith('sui:'));
}

export function pickSuiAccount(accounts, preferredAddress = null) {
  const list = Array.isArray(accounts) ? accounts.filter(Boolean) : [];
  if (!list.length) return null;

  if (preferredAddress) {
    const exact = list.find((account) => account.address === preferredAddress);
    if (exact) return exact;
  }

  const mainnet = list.find((account) => (account.chains || []).includes(SUI_MAINNET_CHAIN));
  if (mainnet) return mainnet;

  return list.find(looksLikeSuiAccount) || null;
}

export function walletKey(wallet) {
  if (!wallet) return '';
  const id = typeof wallet.id === 'string' ? wallet.id.trim() : '';
  if (id) return id;
  return `${wallet.name || 'Unknown Wallet'}::${wallet.version || 'unknown'}`;
}

export function isSlushWallet(wallet) {
  const identity = `${wallet?.id || ''} ${wallet?.name || ''}`.toLowerCase();
  return identity.includes('slush') || identity.includes('stashed') || identity.includes('sui wallet');
}

export function getSuiPersonalMessageFeature(wallet) {
  for (const feature of SUI_PERSONAL_MESSAGE_FEATURES) {
    if (wallet?.features?.[feature]) return feature;
  }
  return null;
}

export function isSlushWebWallet(wallet) {
  return wallet?.id === 'com.mystenlabs.suiwallet.web';
}

function preferredDuplicate(left, right) {
  const leftSui = Boolean(getSuiSignFeature(left));
  const rightSui = Boolean(getSuiSignFeature(right));
  if (rightSui !== leftSui) return rightSui ? right : left;

  const leftAccounts = Array.isArray(left?.accounts) ? left.accounts.length : 0;
  const rightAccounts = Array.isArray(right?.accounts) ? right.accounts.length : 0;
  if (rightAccounts !== leftAccounts) return rightAccounts > leftAccounts ? right : left;

  const leftConnect = Boolean(left?.features?.['standard:connect']);
  const rightConnect = Boolean(right?.features?.['standard:connect']);
  if (rightConnect !== leftConnect) return rightConnect ? right : left;

  return left;
}

export function dedupeWallets(wallets) {
  const byIdentity = new Map();
  for (const wallet of Array.isArray(wallets) ? wallets : []) {
    if (!wallet || !wallet.name) continue;
    const key = wallet.name.trim().toLowerCase();
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? preferredDuplicate(existing, wallet) : wallet);
  }
  return [...byIdentity.values()];
}

export function compatibleSuiWallets(wallets, preferredKey = '') {
  return dedupeWallets(wallets)
    .filter((wallet) => getSuiSignFeature(wallet) !== null)
    .sort((left, right) => {
      const leftPreferred = walletKey(left) === preferredKey;
      const rightPreferred = walletKey(right) === preferredKey;
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;

      const leftSlush = isSlushWallet(left);
      const rightSlush = isSlushWallet(right);
      if (leftSlush !== rightSlush) return leftSlush ? -1 : 1;

      return String(left.name).localeCompare(String(right.name));
    });
}

export function safeWalletIcon(icon) {
  return typeof icon === 'string' && /^data:image\/(?:svg\+xml|png|webp|gif|jpeg);/i.test(icon)
    ? icon
    : null;
}

export function shortenSuiAddress(address, leading = 6, trailing = 4) {
  if (typeof address !== 'string' || !address) return '';
  if (address.length <= leading + trailing + 1) return address;
  return `${address.slice(0, leading)}…${address.slice(-trailing)}`;
}

export function slushBrowseUrl(targetUrl = 'https://tree-token.xyz/dapp/') {
  const target = new URL(targetUrl, 'https://tree-token.xyz');
  target.hash = '';
  return `https://my.slush.app/browse/${target.origin}${target.pathname}${target.search}`;
}
