import { createPilotClient, validArcadeSession } from './arcade-challenge-client.mjs';
import { mountChallengeView } from './arcade-challenge-view.mjs';

const SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
const PILOT_ID = /^[a-z0-9][a-z0-9-]{5,79}$/;
const address = value => /^0x[a-f0-9]{64}$/.test(value || '');
const text = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;

/** Reuse the published personal-message bridge and Arcade session, without
 * invoking attendance, game credit, payment or on-chain transaction actions. */
export function createChallengeApp({ root, fetchImpl = globalThis.fetch?.bind(globalThis), loadWallet = () => import('/assets/arcade/arcade-growth-wallet.js'), storage, now = Date.now, pilotId } = {}) {
  if (!root) throw Error('The challenge page is missing.');
  const doc = root.ownerDocument, view = doc.defaultView;
  const requestedPilot = new URL(view.location.href).searchParams.get('pilot');
  pilotId ||= PILOT_ID.test(requestedPilot || '') ? requestedPilot : root.dataset.pilotId || 'arborist-trials-november-2026';
  if (storage === undefined) { try { storage = view.sessionStorage; } catch {} }
  let bridge = null, model = null, renderer = null, disposed = false, authBusy = false, restoring = true, pickerOpen = false, wallets = [], authNotice = null, epoch = 0, installedToken = null;
  let unsubscribeState = () => {}, unsubscribeWallets = () => {}, refreshQueued = false;
  const listeners = [];
  const client = createPilotClient({ fetchImpl, storage, now, pilotId, cryptoImpl: view.crypto, onChange(value) { model = value; render(); } });
  function render() {
    if (!renderer || disposed) return;
    const wallet = bridge?.getWalletState();
    const state = model || client.getState();
    renderer.render({ ...state, wallets, pickerOpen, busy: Boolean(state.busy || authBusy || restoring),
      ...(restoring ? { phase: 'loading', notice: 'Restoring your Arcade sign-in…' } : {}),
      ...(authNotice ? { notice: authNotice.message, noticeKind: authNotice.kind || '' } : {}),
      signInLabel: authBusy ? 'Waiting for wallet…' : wallet?.connected ? 'Sign in to play' : 'Connect wallet',
      walletHint: wallets.length ? 'Choose the wallet you use for TREE Arcade.' : 'No compatible wallet is available. Open this page in your wallet’s browser or a browser with a Sui wallet installed.',
      startLabel: state.attempt || state.phase === 'session-changed' ? 'Start another attempt' : 'Start test challenge',
    });
  }
  function readSession() {
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const raw = view[name].getItem(SESSION_KEY);
        if (raw?.length > 12000) continue;
        const value = JSON.parse(raw || 'null');
        if (validArcadeSession(value, now())) return value;
      } catch { /* Silent restoration never deletes the shared session. */ }
    }
    return null;
  }
  function saveSession(session) {
    const encoded = JSON.stringify(session);
    for (const name of ['localStorage', 'sessionStorage']) {
      try { view[name].setItem(SESSION_KEY, encoded); if (view[name].getItem(SESSION_KEY) === encoded) return; } catch {}
    }
    throw Error('Allow browser storage to keep your Arcade sign-in, then try again.');
  }
  function currentWallet() {
    const wallet = bridge?.getWalletState();
    return wallet?.connected && address(wallet.address) ? wallet : null;
  }
  async function installSession(session) {
    installedToken = session?.token || null;
    await client.setSession(session);
  }
  async function restore() {
    if (!bridge || disposed || authBusy) return;
    const ticket = ++epoch;
    restoring = true; authNotice = null; render();
    const saved = readSession();
    try {
      let wallet = currentWallet();
      if (saved && !wallet) {
        const named = wallets.filter(item => item.name === saved.walletName);
        const id = saved.walletId || (named.length === 1 ? named[0].id : null);
        if (id && wallets.some(item => item.id === id) && bridge.restoreWallet) {
          try { await bridge.restoreWallet({ id, address: saved.wallet }); } catch { /* Explicit connect remains available. */ }
          wallet = currentWallet();
        }
      }
      if (ticket !== epoch || disposed) return;
      const session = saved && wallet?.address === saved.wallet ? saved : null;
      if (session?.token !== installedToken || !model) await installSession(session);
      if (!session && saved) authNotice = { message: wallet && wallet.address !== saved.wallet ? 'This wallet differs from your saved Arcade sign-in. Sign in with this wallet to start a fresh attempt.' : 'Your saved Arcade session is available. Connect the same wallet to resume it.', kind: 'info' };
    } finally { if (ticket === epoch && !disposed) { restoring = false; render(); } }
  }
  async function authRequest(action, body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl('/api/arcade-growth?action=' + action, { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'ok') throw Error(payload.message || 'Arcade sign-in is temporarily unavailable.');
      return payload;
    } finally { clearTimeout(timer); }
  }
  async function signIn() {
    if (!bridge || authBusy || restoring || client.getState().busy || disposed) return;
    const wallet = currentWallet();
    if (!wallet) { pickerOpen = !pickerOpen; authNotice = null; render(); return; }
    const saved = readSession();
    if (saved?.wallet === wallet.address && saved.token !== installedToken) {
      pickerOpen = false; authNotice = null; await installSession(saved); render();
      if (client.getState().session) return;
      // A revoked token may still have a future local expiry. Let this explicit
      // sign-in gesture obtain a fresh message instead of retrying it forever.
    }
    const ticket = ++epoch;
    authBusy = true; pickerOpen = false;
    authNotice = { message: 'Review the Arcade sign-in message in your wallet. There is no fee or transaction.' }; render();
    try {
      const payload = await authRequest('challenge', { wallet: wallet.address });
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      const challenge = payload.challenge;
      if (challenge?.wallet !== wallet.address || !text(challenge.challengeId, 300) || !text(challenge.message, 8192) || !Number.isFinite(Date.parse(challenge.expiresAt)) || Date.parse(challenge.expiresAt) <= now()) throw Error('The sign-in challenge is incomplete. Please try again.');
      const signed = await bridge.signPersonalMessage({ message: new TextEncoder().encode(challenge.message) });
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      if (!text(signed?.signature, 16384)) throw Error('The wallet did not return a sign-in signature.');
      const result = await authRequest('session', { wallet: wallet.address, challengeId: challenge.challengeId, signature: signed.signature });
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      const session = { ...result.session, version: 1, walletId: wallet.walletId, walletName: wallet.walletName };
      if (session.wallet !== wallet.address || !validArcadeSession(session, now())) throw Error('The sign-in response is incomplete. Please try again.');
      saveSession(session); authNotice = null; await installSession(session);
    } catch (error) {
      if (ticket === epoch && !disposed) authNotice = { message: /reject|declin|cancel/i.test(error?.message || '') ? 'Sign-in was cancelled. You can try again when ready.' : error?.name === 'AbortError' ? 'Sign-in timed out. Please try again.' : error.message || 'Sign-in is unavailable. Please try again.', kind: 'error' };
    } finally { if (ticket === epoch && !disposed) { authBusy = false; render(); if (currentWallet()?.address !== wallet.address) queueRestore(); } }
  }
  async function walletSelect(id) {
    if (!bridge || authBusy || restoring || !wallets.some(wallet => wallet.id === id) || disposed) return;
    const ticket = ++epoch; authBusy = true; pickerOpen = false; authNotice = { message: 'Connecting your wallet…' }; render();
    let connected = false;
    try { await bridge.connectWallet(id); if (ticket === epoch && !disposed) connected = Boolean(currentWallet()); }
    catch (error) { if (ticket === epoch) authNotice = { message: /reject|cancel/i.test(error.message || '') ? 'Wallet connection was cancelled.' : error.message || 'The wallet could not connect.', kind: 'error' }; }
    finally { if (ticket === epoch && !disposed) { authBusy = false; render(); } }
    if (connected) await signIn();
  }
  function clearNotice(action) { return () => { authNotice = null; void action(); }; }
  renderer = mountChallengeView(root, { onStart: clearNotice(() => client.start()), onMove: id => { authNotice = null; void client.move(id); }, onRetry: clearNotice(() => client.retry()), onRefresh: clearNotice(async () => { if (client.getState().session) await client.refresh(); else await restore(); }), onSignIn: () => { void signIn(); }, onWalletSelect: id => { void walletSelect(id); } });
  function queueRestore() {
    if (refreshQueued || restoring || authBusy || disposed) return;
    refreshQueued = true;
    queueMicrotask(() => { refreshQueued = false; if (!disposed && !restoring && !authBusy) void restore(); });
  }
  const ready = (async () => {
    try {
      bridge = await loadWallet();
      if (disposed) return;
      wallets = bridge.getAvailableWallets().filter(wallet => text(wallet.id, 200) && text(wallet.name, 100));
      unsubscribeState = bridge.subscribeWalletState(() => {
        if (restoring || authBusy || disposed) return;
        const wallet = currentWallet();
        if (model?.session && wallet?.address !== model.session.wallet) { epoch += 1; installedToken = null; void client.setSession(null); }
        queueRestore();
      });
      unsubscribeWallets = bridge.subscribeWallets?.(() => {
        if (disposed) return;
        wallets = bridge.getAvailableWallets().filter(wallet => text(wallet.id, 200) && text(wallet.name, 100)); render();
        if (!model?.session) queueRestore();
      }) || (() => {});
      await restore();
    } catch {
      restoring = false; await installSession(null);
      authNotice = { message: 'Wallet tools could not load. Reload this page to try again.', kind: 'error' }; render();
    }
  })();
  const on = (target, event, handler) => { target.addEventListener(event, handler); listeners.push(() => target.removeEventListener(event, handler)); };
  on(view, 'storage', event => { if (event.key === SESSION_KEY) queueRestore(); });
  on(view, 'focus', queueRestore);
  on(doc, 'visibilitychange', () => { if (!doc.hidden) { client.tick(); queueRestore(); } });
  const timer = view.setInterval(() => { if (!disposed) { client.tick(); if (!model?.session && installedToken) installedToken = null; } }, 1000);
  function destroy() { disposed = true; epoch += 1; view.clearInterval(timer); unsubscribeState(); unsubscribeWallets(); listeners.forEach(remove => remove()); client.destroy(); renderer.destroy(); }
  render();
  return { ready, client, signIn, walletSelect, restore, destroy };
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('arcade-challenge');
  if (root) createChallengeApp({ root });
}
