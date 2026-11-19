import { createPilotClient, validArcadeSession, validPilotSession } from './arcade-challenge-client.mjs';
import { mountChallengeView } from './arcade-challenge-view.mjs';

const ARCADE_SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
export const PILOT_SESSION_KEY = 'tree-arcade:challenge-pilot:session:v1';
const PILOT_SCOPE = 'challenge-pilot';
const PILOT_ID = /^[a-z0-9][a-z0-9-]{5,79}$/;
const CHALLENGE_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const address = value => /^0x[a-f0-9]{64}$/.test(value || '');
const text = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const noPrizes = value => value?.mode === 'nonpaying-pilot' && value.identityScope === 'wallet-session-only' && value.payable === false && value.prizeEligible === false && value.awardsEnabled === false;

export function validatePilotAuthChallenge(challenge, { wallet, origin, now = Date.now() }) {
  const expiry = Date.parse(challenge?.expiresAt);
  if (challenge?.wallet !== wallet || challenge.origin !== origin || challenge.sessionScope !== PILOT_SCOPE || !CHALLENGE_ID.test(challenge.challengeId || '') || !text(challenge.message, 8192) || !Number.isFinite(expiry) || expiry <= now || expiry > now + 310000) throw Error('The free pilot sign-in challenge is incomplete or no longer valid. Please try again.');
  return challenge;
}

/** Keep the published wallet bridge and read-only Arcade-session compatibility.
 * New authentication is scoped only to the free pilot and never updates Arcade
 * attendance, game credit, payments or the shared Arcade session. */
export function createChallengeApp({ root, fetchImpl = globalThis.fetch?.bind(globalThis), loadWallet = () => import('/assets/arcade/arcade-growth-wallet.js'), storage, now = Date.now, pilotId } = {}) {
  if (!root) throw Error('The challenge page is missing.');
  const doc = root.ownerDocument, view = doc.defaultView;
  const origin = new URL(view.location.href).origin;
  const requestedPilot = new URL(view.location.href).searchParams.get('pilot');
  pilotId ||= PILOT_ID.test(requestedPilot || '') ? requestedPilot : root.dataset.pilotId || 'arborist-trials-november-2026';
  if (storage === undefined) { try { storage = view.sessionStorage; } catch {} }
  let bridge = null, model = null, renderer = null, disposed = false, authBusy = false, restoring = true, pickerOpen = false, wallets = [], authNotice = null, epoch = 0, installedToken = null;
  let unsubscribeState = () => {}, unsubscribeWallets = () => {}, refreshQueued = false;
  const listeners = [];
  const rejectedTokens = new Set();
  const client = createPilotClient({ fetchImpl, storage, now, pilotId, origin, cryptoImpl: view.crypto, onChange(value) {
    if (!value.session && value.phase === 'signed-out' && installedToken) {
      rejectedTokens.add(installedToken); clearPilotSession(installedToken); installedToken = null;
    }
    model = value; render();
  } });
  function render() {
    if (!renderer || disposed) return;
    const wallet = bridge?.getWalletState();
    const state = model || client.getState();
    renderer.render({ ...state, wallets, pickerOpen, busy: Boolean(state.busy || authBusy || restoring),
      ...(restoring ? { phase: 'loading', notice: 'Restoring your free pilot sign-in…' } : {}),
      ...(authNotice ? { notice: authNotice.message, noticeKind: authNotice.kind || '' } : {}),
      signInLabel: authBusy ? 'Waiting for wallet…' : wallet?.connected ? 'Sign in to free pilot' : 'Connect wallet',
      walletHint: wallets.length ? 'Choose a Sui wallet. This free pilot needs no NFTree, purchase or gas fee.' : 'No compatible wallet is available. Open this page in your wallet’s browser or a browser with a Sui wallet installed.',
      startLabel: state.attempt || state.phase === 'session-changed' ? 'Start another attempt' : 'Start test challenge',
    });
  }
  function readSessions() {
    const found = [], tokens = new Set();
    for (const [key, names, valid] of [
      [PILOT_SESSION_KEY, ['sessionStorage', 'localStorage'], value => validPilotSession(value, now(), origin)],
      [ARCADE_SESSION_KEY, ['localStorage', 'sessionStorage'], value => validArcadeSession(value, now())],
    ]) for (const name of names) {
        try {
          const raw = view[name].getItem(key);
          if (raw?.length > 12000) continue;
          const value = JSON.parse(raw || 'null');
          if (valid(value) && !rejectedTokens.has(value.token) && !tokens.has(value.token)) { found.push(value); tokens.add(value.token); }
        } catch { /* Restoration never writes or deletes the shared session. */ }
      }
    return found;
  }
  async function readSession(walletAddress) {
    const candidates = readSessions().filter(value => !walletAddress || value.wallet === walletAddress);
    // Preserve the original session of a saved match even if another valid
    // pilot/Arcade session for this wallet also exists. A replacement token that
    // no longer matches the record still requires an explicit new attempt.
    try {
      const raw = storage?.getItem('tree-arcade:challenge-pilot:v1:' + pilotId);
      const saved = raw && raw.length < 100000 ? JSON.parse(raw) : null;
      if (saved?.pilotId === pilotId && /^[a-f0-9]{64}$/.test(saved.sessionBinding || '')) {
        for (const candidate of candidates.filter(value => value.wallet === saved.wallet)) {
          const digest = await view.crypto.subtle.digest('SHA-256', new TextEncoder().encode(candidate.token));
          const binding = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          if (binding === saved.sessionBinding) return candidate;
        }
      }
    } catch { /* The client separately validates and owns attempt storage. */ }
    return candidates[0] || null;
  }
  function clearPilotSession(token) {
    if (!/^pilot_[a-f0-9]{64}$/.test(token || '')) return;
    for (const name of ['sessionStorage', 'localStorage']) {
      try { if (JSON.parse(view[name].getItem(PILOT_SESSION_KEY) || 'null')?.token === token) view[name].removeItem(PILOT_SESSION_KEY); } catch {}
    }
  }
  function savePilotSession(session) {
    const encoded = JSON.stringify(session);
    for (const name of ['sessionStorage', 'localStorage']) {
      try { view[name].setItem(PILOT_SESSION_KEY, encoded); if (view[name].getItem(PILOT_SESSION_KEY) === encoded) return; } catch {}
    }
    throw Error('Allow browser storage to keep your free pilot sign-in, then try again.');
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
    let restoreAgain = false;
    try {
      let wallet = currentWallet();
      const saved = await readSession(wallet?.address);
      if (ticket !== epoch || disposed) return;
      if (currentWallet()?.address !== wallet?.address) { restoreAgain = true; await installSession(null); return; }
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
      if (ticket !== epoch || disposed) return;
      if (currentWallet()?.address !== wallet?.address) { restoreAgain = true; await installSession(null); return; }
      if (!session && (saved || readSessions().length)) authNotice = { message: wallet ? 'Sign in to the free pilot with this wallet to start a fresh attempt.' : 'A saved sign-in is available. Connect the same wallet to resume it.', kind: 'info' };
    } finally { if (ticket === epoch && !disposed) { restoring = false; render(); if (restoreAgain) queueRestore(); } }
  }
  async function authRequest(action, body, token) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl('/api/arcade-challenge-pilot?action=' + action, { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'ok') throw Error(payload.message || 'Free pilot sign-in is temporarily unavailable.');
      if (!noPrizes(payload)) throw Error('The free pilot sign-in response is incomplete. Please try again.');
      return payload;
    } finally { clearTimeout(timer); }
  }
  async function signIn() {
    if (!bridge || authBusy || restoring || client.getState().busy || disposed) return;
    const wallet = currentWallet();
    if (!wallet) { pickerOpen = !pickerOpen; authNotice = null; render(); return; }
    if (client.getState().session) return;
    if (!client.getState().storageAvailable) { authNotice = { message: 'Allow browser storage to save and resume a free pilot match before signing in.', kind: 'info' }; render(); return; }
    const ticket = ++epoch;
    authBusy = true; pickerOpen = false;
    authNotice = { message: 'Review the free pilot sign-in message in your wallet. No NFTree, fee or transaction is required.' }; render();
    let issued = null, retained = false;
    try {
      const saved = await readSession(wallet.address);
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      if (saved && saved.token !== installedToken) {
        authNotice = null; await installSession(saved); render();
        if (ticket !== epoch || disposed) return;
        if (currentWallet()?.address !== wallet.address) { await installSession(null); return; }
        if (client.getState().session) return;
        // A locally unexpired token can be revoked. Only this explicit gesture
        // requests a fresh pilot-scoped sign-in message after its rejection.
      }
      const payload = await authRequest('auth-challenge', { wallet: wallet.address });
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      const challenge = validatePilotAuthChallenge(payload.challenge, { wallet: wallet.address, origin, now: now() });
      const signed = await bridge.signPersonalMessage({ message: new TextEncoder().encode(challenge.message) });
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      if (!text(signed?.signature, 16384)) throw Error('The wallet did not return a sign-in signature.');
      const result = await authRequest('auth-session', { wallet: wallet.address, challengeId: challenge.challengeId, signature: signed.signature });
      const session = { token: result.session?.token, wallet: result.session?.wallet, origin: result.session?.origin, expiresAt: result.session?.expiresAt, sessionScope: result.session?.sessionScope, version: 1, walletId: wallet.walletId, walletName: wallet.walletName };
      if (session.wallet !== wallet.address || !validPilotSession(session, now(), origin) || Date.parse(session.expiresAt) > now() + 3610000) throw Error('The free pilot sign-in response is incomplete. Please try again.');
      issued = session;
      if (ticket !== epoch || currentWallet()?.address !== wallet.address || disposed) return;
      savePilotSession(session); retained = true; authNotice = null; await installSession(session);
      if (ticket === epoch && !disposed && currentWallet()?.address !== wallet.address) await installSession(null);
    } catch (error) {
      if (ticket === epoch && !disposed) authNotice = { message: /reject|declin|cancel/i.test(error?.message || '') ? 'Sign-in was cancelled. You can try again when ready.' : error?.name === 'AbortError' ? 'Sign-in timed out. Please try again.' : error.message || 'Sign-in is unavailable. Please try again.', kind: 'error' };
    } finally {
      if (issued && !retained) { try { await authRequest('auth-logout', {}, issued.token); } catch { /* An unretained pilot session expires within one hour. */ } }
      if (ticket === epoch && !disposed) { authBusy = false; render(); if (currentWallet()?.address !== wallet.address) queueRestore(); }
    }
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
  on(view, 'storage', event => { if ([PILOT_SESSION_KEY, ARCADE_SESSION_KEY].includes(event.key)) queueRestore(); });
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
