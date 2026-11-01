// Daily Growth uses personal-message signatures only. No transaction feature is called.
export function createGrowthWalletClient(registry) {
  const CONNECT = 'standard:connect';
  const DISCONNECT = 'standard:disconnect';
  const EVENTS = 'standard:events';
  const SIGN = 'sui:signPersonalMessage';
  const listeners = new Set();
  const walletListeners = new Set();
  let active = null;
  let unsubscribeAccount = null;
  let generation = 0;
  const address = value => typeof value === 'string' && /^0x[0-9a-f]{1,64}$/i.test(value)
    ? '0x' + value.slice(2).toLowerCase().padStart(64, '0') : '';
  const suiChain = chains => Array.isArray(chains) && chains.some(chain => chain === 'sui:mainnet' || chain === 'sui');
  const accountSupported = (account, wallet) => Boolean(address(account?.address)) &&
    (suiChain(account?.chains) || (!account?.chains?.length && suiChain(wallet?.chains)));
  const capable = wallet => typeof wallet?.name === 'string' && wallet.name.length > 0 && wallet.name.length <= 80 &&
    typeof wallet.features?.[CONNECT]?.connect === 'function' && typeof wallet.features?.[SIGN]?.signPersonalMessage === 'function' &&
    (suiChain(wallet.chains) || Array.from(wallet.accounts || []).some(account => accountSupported(account, wallet)));
  function wallets() {
    const available = registry.get().filter(capable);
    return available.filter(wallet => available.filter(other => other.name === wallet.name).length === 1);
  }
  function getAvailableWallets() {
    return wallets().map(wallet => ({ id: wallet.name, name: wallet.name,
      icon: typeof wallet.icon === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml);/i.test(wallet.icon) ? wallet.icon : undefined }));
  }
  function state() {
    return active ? { connected: true, address: active.address, walletName: active.wallet.name, walletId: active.wallet.name }
      : { connected: false, address: '', walletName: '', walletId: '' };
  }
  function notify() { const value = state(); for (const callback of listeners) callback({ ...value }); }
  function clear() {
    const changed = active !== null;
    generation += 1;
    unsubscribeAccount?.(); unsubscribeAccount = null;
    active = null; if (changed) notify();
  }
  function getWalletState() {
    if (active && !wallets().includes(active.wallet)) clear();
    return state();
  }
  function remember(wallet, account) {
    unsubscribeAccount?.(); unsubscribeAccount = null;
    active = { wallet, account, address: address(account.address) };
    const on = wallet.features?.[EVENTS]?.on;
    if (typeof on === 'function') {
      unsubscribeAccount = on('change', properties => {
        if (!active || active.wallet !== wallet || !Object.hasOwn(properties || {}, 'accounts')) return;
        const exact = Array.from(properties.accounts || []).find(candidate => address(candidate?.address) === active.address && accountSupported(candidate, wallet));
        if (!exact) clear();
        else { generation += 1; active.account = exact; notify(); }
      });
    }
    notify();
    return state();
  }
  async function connectWallet(id) {
    clear();
    const request = generation;
    const wallet = wallets().find(candidate => candidate.name === id);
    if (!wallet) throw new Error('This Sui wallet is not available. Choose an installed wallet.');
    const result = await wallet.features[CONNECT].connect();
    if (request !== generation || !wallets().includes(wallet)) throw new Error('The wallet changed while connecting. Please connect again.');
    const account = Array.from(result?.accounts || wallet.accounts || []).find(candidate => accountSupported(candidate, wallet));
    if (!account) throw new Error('The wallet did not provide a Sui mainnet account.');
    return remember(wallet, account);
  }
  async function restoreWallet({ id, address: expectedAddress } = {}) {
    const expected = address(expectedAddress);
    if (!expected || typeof id !== 'string') return getWalletState();
    clear();
    const request = generation;
    const wallet = wallets().find(candidate => candidate.name === id);
    if (!wallet) return state();
    let account = Array.from(wallet.accounts || []).find(candidate => address(candidate?.address) === expected && accountSupported(candidate, wallet));
    if (!account) {
      let result;
      try { result = await wallet.features[CONNECT].connect({ silent: true }); }
      catch { return state(); }
      if (request !== generation || !wallets().includes(wallet)) return state();
      account = Array.from(result?.accounts || wallet.accounts || []).find(candidate => address(candidate?.address) === expected && accountSupported(candidate, wallet));
    }
    if (!account || request !== generation) return state();
    return remember(wallet, account);
  }
  async function disconnectWallet() {
    const wallet = active?.wallet;
    clear();
    const disconnect = wallet?.features?.[DISCONNECT]?.disconnect;
    if (typeof disconnect === 'function') await disconnect();
  }
  async function signPersonalMessage({ message } = {}) {
    if (!(message instanceof Uint8Array) || message.byteLength < 1 || message.byteLength > 8192) throw new Error('The verification message is invalid.');
    const current = getWalletState();
    if (!current.connected || !active) throw new Error('Connect your Sui wallet first.');
    const selected = active;
    const request = generation;
    const result = await selected.wallet.features[SIGN].signPersonalMessage({ account: selected.account, message });
    if (request !== generation || active !== selected || !getWalletState().connected) throw new Error('The wallet changed during verification. Please connect again.');
    if (typeof result?.signature !== 'string' || result.signature.length < 1 || result.signature.length > 16_384) throw new Error('The wallet did not return a verification signature.');
    return { signature: result.signature };
  }
  function subscribeWalletState(callback) {
    if (typeof callback !== 'function') return () => {};
    listeners.add(callback);
    queueMicrotask(() => { if (listeners.has(callback)) callback(getWalletState()); });
    return () => listeners.delete(callback);
  }
  function subscribeWallets(callback) {
    if (typeof callback !== 'function') return () => {};
    walletListeners.add(callback);
    queueMicrotask(() => { if (walletListeners.has(callback)) callback(getAvailableWallets()); });
    return () => walletListeners.delete(callback);
  }
  const registryChanged = () => {
    getWalletState();
    const value = getAvailableWallets();
    for (const callback of walletListeners) callback(value);
  };
  registry.on?.('register', registryChanged);
  registry.on?.('unregister', registryChanged);
  return { getWalletState, getAvailableWallets, connectWallet, restoreWallet, disconnectWallet,
    signPersonalMessage, subscribeWalletState, subscribeWallets };
}
