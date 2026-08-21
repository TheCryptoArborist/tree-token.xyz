export const PHANTOM_SUI_FEATURE = 'tree:phantomSui';

const PHANTOM_WALLET_ID = 'phantom-sui-direct';
const SUI_MAINNET_CHAIN = 'sui:mainnet';

function addressFromValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.address === 'string') return value.address;
  if (typeof value.publicKey === 'string') return value.publicKey;
  if (value.publicKey && typeof value.publicKey.toString === 'function') {
    const address = value.publicKey.toString();
    if (address && address !== '[object Object]') return address;
  }
  return null;
}

export function phantomSuiAccountAddress(value) {
  const direct = addressFromValue(value);
  if (direct) return direct;

  const candidates = Array.isArray(value?.accounts) ? value.accounts : Array.isArray(value) ? value : [];
  for (const candidate of candidates) {
    const address = addressFromValue(candidate);
    if (address) return address;
  }
  return null;
}

export function getPhantomSuiProvider(scope = globalThis) {
  const provider = scope?.phantom?.sui;
  return provider?.isPhantom
    && typeof provider.requestAccount === 'function'
    && typeof provider.signTransaction === 'function'
    ? provider
    : null;
}

export function isPhantomSuiWallet(wallet) {
  return wallet?.id === PHANTOM_WALLET_ID || Boolean(wallet?.features?.[PHANTOM_SUI_FEATURE]);
}

export function phantomSignature(value) {
  if (typeof value === 'string' && value) return value;
  return value?.signature
    || value?.serializedSignature
    || value?.signedTransaction?.signature
    || value?.result?.signature
    || null;
}

export function phantomTransactionBytes(value) {
  return value?.bytes
    || value?.transactionBytes
    || value?.transactionBlockBytes
    || value?.signedTransaction?.bytes
    || value?.result?.bytes
    || null;
}

export function createPhantomSuiWallet(provider) {
  if (!provider) return null;

  let accounts = [];
  const accountListeners = new Set();

  const setAccount = (value) => {
    const address = phantomSuiAccountAddress(value);
    accounts = address ? [{ address, chains: [SUI_MAINNET_CHAIN], features: [] }] : [];
    for (const listener of accountListeners) listener({ accounts });
    return accounts;
  };

  const connect = async () => ({ accounts: setAccount(await provider.requestAccount()) });
  const events = {
    version: '1.0.0',
    on(event, listener) {
      if (event !== 'change' || typeof listener !== 'function') return () => {};
      accountListeners.add(listener);

      const handleAccountChange = (value) => setAccount(value);
      const providerEvents = ['accountChanged', 'accountsChanged'];
      for (const providerEvent of providerEvents) {
        try { provider.on?.(providerEvent, handleAccountChange); } catch (_) {}
      }

      return () => {
        accountListeners.delete(listener);
        for (const providerEvent of providerEvents) {
          try { provider.off?.(providerEvent, handleAccountChange); } catch (_) {}
          try { provider.removeListener?.(providerEvent, handleAccountChange); } catch (_) {}
        }
      };
    },
  };

  return {
    id: PHANTOM_WALLET_ID,
    name: 'Phantom',
    version: '1.0.0',
    get accounts() { return accounts; },
    features: {
      'standard:connect': { version: '1.0.0', connect },
      'standard:events': events,
      [PHANTOM_SUI_FEATURE]: { version: '1.0.0', provider },
    },
  };
}
