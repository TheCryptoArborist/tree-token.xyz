const root = document.querySelector('[data-arcade-wallet-link]');

if (root instanceof HTMLElement) {
  const heading = root.querySelector('[data-link-heading]');
  const status = root.querySelector('[data-link-status]');
  const suiOutput = root.querySelector('[data-link-sui]');
  const evmOutput = root.querySelector('[data-link-evm]');
  const accessOutput = root.querySelector('[data-link-access]');
  const button = root.querySelector('[data-link-button]');
  const clearButton = root.querySelector('[data-link-clear]');
  const STORAGE_KEY = 'tree:arcade:wallet-link:v1';
  let suiAddress = typeof window.playerAddress === 'string' ? window.playerAddress : null;
  let evmAddress = window.treeEvmWallet?.address || null;
  let nftree = window.treeNftreeVerification || { state: 'idle', address: null, count: null };
  let link = { state: 'idle', proof: null, count: null };
  let busy = false;

  const short = (value) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
  const setText = (element, value) => { if (element) element.textContent = value; };
  const loadProof = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  };
  const saveProof = (proof) => {
    try {
      if (proof) localStorage.setItem(STORAGE_KEY, JSON.stringify(proof));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };
  const proofMatches = (proof) => Boolean(
    proof?.fields?.suiAddress === suiAddress
    && proof?.fields?.evmAddress?.toLowerCase() === evmAddress?.toLowerCase()
    && Date.parse(proof?.fields?.expiresAt || '') > Date.now()
  );

  const render = () => {
    const nftreeReady = nftree.state === 'verified' && nftree.address === suiAddress && nftree.count > 0;
    const ready = Boolean(suiAddress && evmAddress && nftreeReady);
    const linked = link.state === 'linked';
    root.dataset.linkState = linked ? 'linked' : link.state === 'error' ? 'error' : ready ? 'ready' : 'waiting';
    setText(heading, linked ? 'TREE Account linked' : ready ? 'Wallets ready to link' : 'Connect both wallets');
    setText(status, linked
      ? 'Both signatures were verified and current NFTree ownership was confirmed.'
      : link.state === 'error'
        ? 'The wallet link could not be verified. Nothing was signed or transferred on-chain.'
        : !suiAddress
          ? 'Connect your Sui wallet first.'
          : !nftreeReady
            ? 'A verified NFTree holder wallet is required.'
            : !evmAddress
              ? 'Connect MetaMask to continue.'
              : 'Sign the same access statement with both wallets.');
    setText(suiOutput, short(suiAddress));
    setText(evmOutput, short(evmAddress));
    setText(accessOutput, linked ? `Verified · ${link.count} NFTree${link.count === 1 ? '' : 's'}` : 'Not linked');
    if (button instanceof HTMLButtonElement) {
      button.disabled = busy || !ready;
      button.textContent = busy ? 'VERIFYING…' : linked ? 'REVERIFY WALLET LINK' : 'LINK SUI + METAMASK';
    }
    if (clearButton instanceof HTMLButtonElement) clearButton.hidden = !linked && !loadProof();
  };

  const post = async (body) => {
    const response = await fetch('/api/arcade-wallet-link', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status !== 'ok') throw new Error(payload?.error || 'wallet-link-failed');
    return payload;
  };

  const verifyProof = async (proof, { persist = true } = {}) => {
    const result = await post({ action: 'verify', ...proof });
    if (result.suiAddress !== suiAddress || result.evmAddress?.toLowerCase() !== evmAddress?.toLowerCase() || result.linked !== true) {
      throw new Error('wallet-link-address-mismatch');
    }
    link = { state: 'linked', proof, count: result.nftreeCount };
    if (persist) saveProof(proof);
  };

  const clearLink = () => {
    saveProof(null);
    link = { state: 'idle', proof: null, count: null };
    render();
  };

  button?.addEventListener('click', async () => {
    busy = true;
    link = { state: 'idle', proof: null, count: null };
    render();
    try {
      const challenge = await post({ action: 'challenge', suiAddress, evmAddress });
      const bytes = new TextEncoder().encode(challenge.message);
      const suiSigned = await window.signTreePersonalMessage?.(bytes);
      if (!suiSigned?.signature) throw new Error('sui-signature-unavailable');
      const evmSignature = await window.signTreeEvmMessage?.(challenge.message);
      if (!evmSignature) throw new Error('evm-signature-unavailable');
      await verifyProof({
        fields: challenge.fields,
        message: challenge.message,
        suiSignature: suiSigned.signature,
        evmSignature,
      });
    } catch (error) {
      console.warn('TREE Arcade wallet link was not completed.', error);
      link = { state: 'error', proof: null, count: null };
    } finally {
      busy = false;
      render();
    }
  });

  clearButton?.addEventListener('click', clearLink);
  window.addEventListener('tree:wallet-changed', (event) => {
    const next = event?.detail?.address || null;
    if (next !== suiAddress) clearLink();
    suiAddress = next;
    render();
  });
  window.addEventListener('tree:evm-wallet-changed', (event) => {
    const next = event?.detail?.address || null;
    if (next?.toLowerCase() !== evmAddress?.toLowerCase()) clearLink();
    evmAddress = next;
    render();
  });
  window.addEventListener('tree:nftree-verification', async (event) => {
    nftree = event?.detail || { state: 'idle', address: null, count: null };
    const saved = loadProof();
    if (nftree.state === 'verified' && proofMatches(saved) && link.state !== 'linked' && !busy) {
      busy = true;
      render();
      try { await verifyProof(saved, { persist: false }); }
      catch { clearLink(); }
      finally { busy = false; }
    }
    render();
  });

  render();
}
