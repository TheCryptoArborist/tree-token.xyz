const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const handoff = { clientOrigin: params.get('clientOrigin'), state: params.get('state'), codeChallenge: params.get('codeChallenge') };
let identity = null, busy = false, suiReady = false, provider = null, evmAddress = null;
const wallets = new Map();
const short = a => `${a.slice(0, 8)}…${a.slice(-6)}`;
function status(message, error = false) { $('status').textContent = message; $('status').dataset.error = String(error); }
async function api(body) {
  const r = await fetch('/api/tree-account', { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), credentials: 'same-origin', cache: 'no-store' });
  const p = await r.json(); if (!r.ok || p.status !== 'ok') throw new Error(p.error || 'Sign-in service is unavailable.'); return p;
}
function render() {
  $('identity').hidden = !identity; $('choices').hidden = !!identity;
  if (identity) {
    $('wallet').textContent = `${identity.wallet.family.toUpperCase()} · ${short(identity.wallet.address)}`;
    $('account-id').textContent = `TREE Account: ${identity.accountId}`;
    $('expiry').textContent = `Preview session expires at ${new Date(identity.expiresAt).toLocaleTimeString()}.`;
    $('continue').hidden = !(handoff.clientOrigin && handoff.state && handoff.codeChallenge);
  }
  $('sign-sui').disabled = busy || !suiReady || !window.playerAddress;
  $('sign-evm').disabled = busy || !evmAddress;
  for (const id of ['connect-sui','connect-evm','evm-wallet','network','continue','logout']) $(id).disabled = busy;
  $('sui-address').textContent = window.playerAddress ? short(window.playerAddress) : '';
  $('evm-address').textContent = evmAddress ? short(evmAddress) : '';
}
async function task(fn) {
  if (busy) return; busy = true; render();
  try { await fn(); } catch (e) {
    status(Number(e?.code) === 4001 ? 'Signature declined. No transaction was made.' : e.message || 'Sign-in was not completed. Please try again.', true);
  } finally { busy = false; render(); }
}
const networks = {
  97: { chainId: '0x61', chainName: 'BNB Smart Chain Testnet', rpcUrls: ['https://bsc-testnet-dataseed.bnbchain.org'], nativeCurrency: { name: 'Testnet BNB', symbol: 'tBNB', decimals: 18 }, blockExplorerUrls: ['https://testnet.bscscan.com'] },
  46630: { chainId: '0xb626', chainName: 'Robinhood Chain Testnet', rpcUrls: ['https://rpc.testnet.chain.robinhood.com'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://explorer.testnet.chain.robinhood.com'] },
};
function addWallet(id, name, p) {
  if (!p?.request || wallets.has(id)) return; wallets.set(id, p);
  if (wallets.size === 1) $('evm-wallet').replaceChildren();
  const option = document.createElement('option'); option.value = id; option.textContent = String(name).slice(0, 50); $('evm-wallet').append(option);
}
window.addEventListener('eip6963:announceProvider', event => {
  const { info, provider: p } = event.detail || {}; if (info?.uuid) addWallet(info.uuid, info.name || 'EVM Wallet', p);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
setTimeout(() => {
  if (!wallets.size && window.ethereum) addWallet('injected', 'Installed EVM wallet', window.ethereum);
  if (!wallets.size) { $('evm-wallet').options[0].textContent = 'No EVM wallet detected'; $('connect-evm').disabled = true; }
}, 350);
function evmChanged() { evmAddress = null; render(); if (!identity) status('EVM wallet changed. Reconnect to sign in.'); }
$('evm-wallet').addEventListener('change', evmChanged); $('network').addEventListener('change', evmChanged);
$('connect-evm').addEventListener('click', () => task(async () => {
  provider?.removeListener?.('accountsChanged', evmChanged); provider?.removeListener?.('chainChanged', evmChanged);
  provider = wallets.get($('evm-wallet').value); if (!provider) throw new Error('Open this preview in a browser with an EVM wallet installed.');
  const network = networks[Number($('network').value)];
  const addresses = await provider.request({ method: 'eth_requestAccounts' });
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainId }] }); }
  catch (error) { if (Number(error.code) !== 4902) throw error; await provider.request({ method: 'wallet_addEthereumChain', params: [network] }); await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainId }] }); }
  evmAddress = addresses?.[0]; if (!/^0x[0-9a-f]{40}$/i.test(evmAddress || '')) throw new Error('No EVM wallet address returned.');
  provider.on?.('accountsChanged', evmChanged); provider.on?.('chainChanged', evmChanged);
  status('Wallet connected. Use Sign in with EVM to verify ownership.');
}));
$('connect-sui').addEventListener('click', () => task(async () => {
  if (!suiReady) { await import('./wallet.js'); suiReady = true; }
  await window.openWalletManager?.({ mode: 'picker' });
  status(window.playerAddress ? 'Wallet connected. Use Sign in with Sui to verify ownership.' : 'No Sui wallet selected.');
}));
window.addEventListener('tree:wallet-changed', render);
$('sign-sui').addEventListener('click', () => task(async () => {
  const address = window.playerAddress; if (!address) throw new Error('Choose your Sui wallet first.');
  status('Requesting a one-time Sui sign-in signature…');
  const proof = await api({ action: 'challenge', family: 'sui', address, chainId: 'sui:mainnet' });
  const signed = await window.signTreePersonalMessage(new TextEncoder().encode(proof.message));
  if (window.playerAddress !== address) throw new Error('Wallet changed. Start sign-in again.');
  identity = (await api({ action: 'verify', nonce: proof.nonce, signature: signed.signature })).identity;
  status('Sui account verified. No on-chain transaction was made.');
}));
$('sign-evm').addEventListener('click', () => task(async () => {
  const address = evmAddress, chainId = Number($('network').value);
  if (!address || Number(await provider.request({ method: 'eth_chainId' })) !== chainId) throw new Error('Reconnect to the selected network first.');
  status('Requesting a one-time EVM sign-in signature…');
  const proof = await api({ action: 'challenge', family: 'evm', address, chainId });
  const bytes = new TextEncoder().encode(proof.message), hex = '0x' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const signature = await provider.request({ method: 'personal_sign', params: [hex, address] });
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (accounts[0]?.toLowerCase() !== address.toLowerCase() || Number(await provider.request({ method: 'eth_chainId' })) !== chainId) throw new Error('Wallet or network changed. Start sign-in again.');
  identity = (await api({ action: 'verify', nonce: proof.nonce, signature })).identity;
  status('EVM account verified. A Sui wallet was not required.');
}));
$('continue').addEventListener('click', () => task(async () => {
  const result = await api({ action: 'authorize-game', ...handoff });
  const redirect = new URL(result.redirect);
  if (redirect.origin !== handoff.clientOrigin || redirect.pathname !== '/api/tree-account/callback') throw new Error('Unexpected game destination.');
  location.replace(redirect.href);
}));
$('logout').addEventListener('click', () => task(async () => { await api({ action: 'logout' }); identity = null; status('Preview session ended. Its game sessions are no longer valid.'); }));
try { identity = (await api()).identity; status(identity ? 'Your existing preview session is verified.' : 'Choose either wallet to sign in.'); }
catch (e) { status(e.message, true); }
render();
