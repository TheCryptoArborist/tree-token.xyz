const NIGHTLY_SUI_SIGN_FEATURES = [
  'sui:signAndExecuteTransaction',
  'sui:signAndExecuteTransactionBlock',
];

export function isNightlySuiWallet(wallet) {
  const identity = `${wallet?.id || ''} ${wallet?.name || ''}`.toLowerCase();
  return identity.includes('nightly');
}

export function getNightlySuiWallet(scope = globalThis) {
  const injected = scope?.nightly?.sui;
  const wallet = injected?.standardWallet || injected;
  if (!wallet?.features?.['standard:connect']?.connect) return null;
  if (!NIGHTLY_SUI_SIGN_FEATURES.some((feature) => wallet.features?.[feature])) return null;
  return wallet;
}
