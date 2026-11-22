import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM
  || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);

const controllerURL = new URL('../production/arcade-organization-static/runtime/scripts/arcade-daily-growth-play-share.js', import.meta.url);
// The preservation snapshot stores this controller's campaign dependency in
// scripts/, while its other dependencies are beside the deployed controller.
// Resolve module locations only; exercise the active controller source verbatim.
const controllerSource = fs.readFileSync(controllerURL, 'utf8').replace(
  /from\s+(['"])(\.\/[^'"]+)\1/g,
  (statement, quote, specifier) => {
    const local = new URL(specifier, controllerURL);
    const target = fs.existsSync(local) ? local : new URL(`../scripts/${specifier.slice(2)}`, import.meta.url);
    assert.ok(fs.existsSync(target), `Controller dependency exists: ${specifier}`);
    return `from ${quote}${target.href}${quote}`;
  },
);
const { createDailyGrowth } = await import(`data:text/javascript;base64,${Buffer.from(controllerSource).toString('base64')}`);
const page = fs.readFileSync(new URL('../production/arcade-organization-static/index.html', import.meta.url), 'utf8');
const KEY = 'tree-arcade:daily-growth:session:v1';
const NOW = Date.parse('2026-11-22T12:00:00Z');
const A = `0x${'a'.repeat(64)}`;
const B = `0x${'b'.repeat(64)}`;
const DATE = '2026-11-22';
const MONTH = '2026-11';
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function until(predicate, message = 'Expected asynchronous state was not reached') {
  for (let attempts = 0; attempts < 120; attempts++) {
    if (predicate()) return;
    await settle();
  }
  assert.ok(predicate(), message);
}

function sessionFor(wallet = A) {
  return {
    version: 1, token: `test-session-${wallet.slice(-1)}`, wallet,
    walletId: 'Slush', walletName: 'Slush',
    expiresAt: new Date(NOW + 600_000).toISOString(),
  };
}

function createBridge({ accounts = [A], initialWallet = null, restoreGate = null, disconnectError = false } = {}) {
  const listeners = new Set();
  const calls = { connect: [], restore: [], disconnect: 0, select: [], signatures: [] };
  let current = initialWallet;
  let generation = 0;
  const snapshot = () => current
    ? { connected: true, address: current, walletId: 'Slush', walletName: 'Slush' }
    : { connected: false, address: '', walletId: '', walletName: '' };
  const notify = () => { for (const listener of listeners) listener(snapshot()); };
  const bridge = {
    getWalletState: snapshot,
    getAvailableWallets: () => [{ id: 'Slush', name: 'Slush' }],
    getAvailableAccounts: (id) => id && id !== 'Slush' ? []
      : accounts.map((address, index) => ({ address, label: `Account ${index + 1}` })),
    subscribeWalletState(listener) {
      listeners.add(listener);
      queueMicrotask(() => { if (listeners.has(listener)) listener(snapshot()); });
      return () => listeners.delete(listener);
    },
    subscribeWallets: () => () => {},
    async restoreWallet({ id, address }) {
      calls.restore.push({ id, address });
      const ticket = ++generation;
      if (restoreGate) await restoreGate.promise;
      if (ticket !== generation) return snapshot();
      if (id === 'Slush' && accounts.includes(address)) current = address;
      notify();
      return snapshot();
    },
    async connectWallet(id) {
      calls.connect.push(id);
      generation++;
      current = null;
      notify();
      assert.equal(id, 'Slush');
      current = accounts[0] || null;
      notify();
      return snapshot();
    },
    async disconnectWallet() {
      calls.disconnect++;
      generation++;
      current = null;
      notify();
      if (disconnectError) throw new Error('Wallet notification unavailable');
    },
    selectAccount({ walletId, address }) {
      assert.equal(walletId, 'Slush');
      assert.ok(accounts.includes(address), 'Only an authorized account may be selected');
      generation++;
      current = address;
      calls.select.push({ walletId, address });
      notify();
      return snapshot();
    },
    async signPersonalMessage({ message }) {
      assert.ok(current, 'A connected account must sign');
      calls.signatures.push({ wallet: current, message: new TextDecoder().decode(message) });
      return { signature: `test-only-signature-${current.slice(-1)}` };
    },
  };
  return { bridge, calls, current: () => current };
}

function createAPI() {
  const calls = [];
  const checked = new Set();
  const holds = new Map();
  const failures = new Set();
  const sessions = new Map([A, B].map((wallet) => [sessionFor(wallet).token, wallet]));
  function envelope(wallet = null) {
    const attendance = Boolean(wallet && checked.has(wallet));
    return {
      status: 'ok', authenticated: Boolean(wallet), dateKey: DATE, monthKey: MONTH,
      configuration: { enabledGames: [], eligibleGames: [] },
      ...(wallet ? { progress: {
        wallet, monthKey: MONTH, dateKey: DATE,
        calendar: Array.from({ length: 30 }, (_, index) => ({
          dateKey: `${MONTH}-${String(index + 1).padStart(2, '0')}`,
          checkedIn: index === 21 && attendance, questCompleted: false, gameIds: [],
        })),
        checkedInDays: attendance ? 1 : 0, questDays: 0,
        today: { checkedIn: attendance, questCompleted: false, gameIds: [] },
        passport: { monthKey: MONTH, enabledGames: [], completedGameIds: [], complete: false },
        milestones: [], badges: [],
      } } : {}),
    };
  }
  async function fetchImpl(url, options = {}) {
    const parsed = new URL(url, 'https://tree-token.xyz');
    const action = parsed.searchParams.get('action');
    const body = options.body ? JSON.parse(options.body) : null;
    const token = new Headers(options.headers).get('Authorization')?.replace(/^Bearer /, '');
    const wallet = body?.wallet || sessions.get(token) || null;
    const call = { path: parsed.pathname, action, body, wallet, signal: options.signal };
    calls.push(call);
    if (parsed.pathname === '/api/arcade-growth') {
      const hold = holds.get(action);
      if (hold) {
        holds.delete(action);
        // Deliberately deliver a response after an abort: the controller must
        // discard obsolete work even when a transport cannot cancel delivery.
        await hold.promise;
      }
      if (failures.has(action)) throw new Error(`Controlled ${action} outage`);
      if (action === 'challenge') return Response.json({ status: 'ok', challenge: {
        wallet, challengeId: `challenge-${wallet.slice(-1)}`,
        message: `Sign in to Tree Arcade with ${wallet}`,
        expiresAt: new Date(NOW + 60_000).toISOString(),
      } });
      if (action === 'session') return Response.json({ ...envelope(wallet), session: sessionFor(wallet) });
      if (action === 'check-in') checked.add(wallet);
      if (action === 'logout') return Response.json({ status: 'ok' });
      assert.ok(['status', 'sync', 'check-in'].includes(action), `Unexpected Growth API action: ${action}`);
      return Response.json(envelope(wallet));
    }
    if (parsed.pathname === '/api/arcade-completed-runs') return Response.json({ wallet, dateKey: DATE, runs: [], sources: {} });
    if (parsed.pathname === '/api/arcade-social') return Response.json({
      wallet, entries: [], monthlyStamps: 0, resetsAt: new Date(NOW + 86_400_000).toISOString(),
    });
    if (parsed.pathname === '/api/arcade-campaign') return Response.json({ status: 'ok', progress: {
      wallet, campaignId: 'first-round-v1', canClaim: false, quizCompleteThisWeek: false,
      learningStamps: 0, startedAt: null, claimedAt: null,
      tasks: { checkIn: checked.has(wallet), quiz: false, game: false, share: false },
    } });
    throw new Error(`Unexpected request: ${url}`);
  }
  return {
    fetchImpl, calls, checked, failures,
    count(action) { return calls.filter((call) => call.path === '/api/arcade-growth' && call.action === action).length; },
    holdNext(action) { const gate = deferred(); holds.set(action, gate); return gate; },
  };
}

function fixture({ saved = null, storageEntries = [], ...bridgeOptions } = {}) {
  const dom = new JSDOM(page, { url: 'https://tree-token.xyz/play/#daily', pretendToBeVisual: true });
  const view = dom.window;
  const doc = view.document;
  view.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  view.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new view.Event('close'));
  };
  view.HTMLElement.prototype.scrollIntoView = function () {};
  for (const [key, value] of storageEntries) view.localStorage.setItem(key, value);
  if (saved) view.localStorage.setItem(KEY, JSON.stringify(saved));
  const wallet = createBridge(bridgeOptions);
  const api = createAPI();
  const root = doc.getElementById('arcade-daily-growth');
  let lastProgress = null;
  root.addEventListener('arcade-progress', (event) => { lastProgress = event.detail; });
  const app = createDailyGrowth({ root, loadWallet: async () => wallet.bridge, fetchImpl: api.fetchImpl, now: () => NOW });
  return {
    view, doc, root, wallet, api, app,
    get lastProgress() { return lastProgress; },
    storedSession() { return JSON.parse(view.localStorage.getItem(KEY) || 'null'); },
    close() { app.destroy(); view.close(); },
  };
}

function assertSignedOut(current) {
  assert.equal(current.view.localStorage.getItem(KEY), null, 'Persistent Arcade sign-in is removed');
  assert.equal(current.view.sessionStorage.getItem(KEY), null, 'Legacy tab sign-in is removed');
  assert.equal(current.lastProgress?.sessionActive, false, 'Other panels see the signed-out state');
  assert.equal(current.lastProgress?.progress, null, 'Previous account progress is no longer displayed');
  assert.doesNotMatch(current.doc.getElementById('growth-wallet-state').textContent, /Signed in/);
}

async function openWalletPicker(current) {
  current.doc.getElementById('growth-connect').click();
  await until(() => current.doc.getElementById('growth-wallet-picker').open, 'Wallet picker should open');
}

test('sign-out disconnects the wallet, clears both session copies, and remains signed out on return and reload', async () => {
  const current = fixture({ saved: sessionFor() });
  let snapshot;
  try {
    await current.app.ready;
    assert.equal(current.storedSession()?.wallet, A);
    current.view.sessionStorage.setItem(KEY, JSON.stringify(sessionFor()));
    await current.app.signOut();
    assert.equal(current.wallet.calls.disconnect, 1);
    assert.equal(current.wallet.current(), null);
    assertSignedOut(current);
    const restoreCount = current.wallet.calls.restore.length;
    current.view.dispatchEvent(new current.view.Event('focus'));
    current.view.dispatchEvent(new current.view.Event('pageshow'));
    await settle();
    assertSignedOut(current);
    assert.equal(current.wallet.calls.restore.length, restoreCount);
    snapshot = Object.entries(current.view.localStorage);
  } finally { current.close(); }
  const reloaded = fixture({ storageEntries: snapshot });
  try {
    await reloaded.app.ready;
    assertSignedOut(reloaded);
    assert.equal(reloaded.wallet.calls.restore.length, 0, 'Reload must not restore the forgotten account');
    assert.equal(reloaded.wallet.calls.signatures.length, 0);
  } finally { reloaded.close(); }
});

test('wallet disconnect and logout-service failures still leave the player locally signed out', async () => {
  const current = fixture({ saved: sessionFor(), disconnectError: true });
  try {
    await current.app.ready;
    current.api.failures.add('logout');
    await current.app.signOut();
    assert.equal(current.wallet.calls.disconnect, 1);
    assertSignedOut(current);
    assert.equal(current.wallet.current(), null);
    current.view.dispatchEvent(new current.view.Event('focus'));
    await settle();
    assertSignedOut(current);
  } finally { current.close(); }
});

test('a connected wallet without an Arcade session can be disconnected', async () => {
  const current = fixture({ initialWallet: A });
  try {
    await current.app.ready;
    assert.equal(current.storedSession(), null);
    assert.equal(current.doc.getElementById('growth-sign-out').hidden, false);
    await current.app.signOut();
    assert.equal(current.wallet.calls.disconnect, 1);
    assert.equal(current.wallet.current(), null);
    assertSignedOut(current);
  } finally { current.close(); }
});

test('sign-out during a delayed saved-session restore cancels the restore and never reauthenticates', async () => {
  const gate = deferred();
  const current = fixture({ saved: sessionFor(), restoreGate: gate });
  try {
    await until(() => current.wallet.calls.restore.length === 1, 'Saved-session restoration should start');
    await current.app.signOut();
    assert.equal(current.wallet.calls.disconnect, 1);
    assertSignedOut(current);
    gate.resolve();
    await current.app.ready;
    current.view.dispatchEvent(new current.view.Event('pageshow'));
    await settle();
    assertSignedOut(current);
    assert.equal(current.wallet.current(), null);
    assert.equal(current.wallet.calls.signatures.length, 0);
    assert.equal(current.api.count('check-in'), 0);
  } finally { gate.resolve(); current.close(); }
});

test('a late authentication response cannot sign the player back in after sign-out', async () => {
  const current = fixture();
  let gate;
  try {
    await current.app.ready;
    gate = current.api.holdNext('session');
    await openWalletPicker(current);
    current.doc.querySelector('[data-wallet-id="Slush"]').click();
    await until(() => current.api.count('session') === 1, 'The message-only authentication request should start');
    assert.equal(current.wallet.calls.signatures.length, 1);
    await current.app.signOut();
    assertSignedOut(current);
    gate.resolve();
    await settle();
    await settle();
    assertSignedOut(current);
    assert.equal(current.wallet.current(), null);
    assert.equal(current.api.count('check-in'), 0, 'An obsolete login must not save attendance');
  } finally { gate?.resolve(); current.close(); }
});

test('Switch wallet remains available during progress sync and discards the previous wallet response', async () => {
  const current = fixture({ saved: sessionFor(), accounts: [A, B] });
  let gate;
  let refresh;
  try {
    await current.app.ready;
    const before = current.api.count('sync');
    gate = current.api.holdNext('sync');
    refresh = current.app.refresh();
    await until(() => current.api.count('sync') > before);
    const switchButton = current.doc.getElementById('growth-connect');
    assert.equal(switchButton.hidden, false, 'Signed-in players must be able to switch wallets');
    assert.equal(switchButton.disabled, false, 'A slow progress request must not trap the wallet');
    assert.match(switchButton.textContent, /Switch wallet/i);
    assert.equal(current.doc.getElementById('growth-sign-out').disabled, false);
    await openWalletPicker(current);
    await until(() => current.wallet.calls.disconnect === 1);
    assertSignedOut(current);
    gate.resolve();
    await refresh;
    assertSignedOut(current);
    assert.equal(current.doc.getElementById('growth-wallet-picker').open, true, 'A late status reply must not close wallet selection');
    assert.equal(current.wallet.calls.signatures.length, 0);
  } finally { gate?.resolve(); await refresh; current.close(); }
});

test('two accounts in Slush require an explicit choice and account B signs in and receives its own check-in', async () => {
  const current = fixture({ saved: sessionFor(), accounts: [A, B] });
  try {
    await current.app.ready;
    await openWalletPicker(current);
    await until(() => current.wallet.calls.disconnect === 1);
    current.doc.querySelector('[data-wallet-id="Slush"]').click();
    await until(() => current.doc.querySelector(`[data-account-address="${B}"]`), 'Both authorized accounts should be offered');
    assert.ok(current.doc.querySelector(`[data-account-address="${A}"]`));
    assert.equal(current.wallet.calls.signatures.length, 0, 'Connecting a provider must not silently sign its first account');
    assert.equal(current.api.count('challenge'), 0);
    assert.equal(current.api.count('check-in'), 0);
    assert.equal(current.storedSession(), null);
    current.doc.querySelector(`[data-account-address="${B}"]`).click();
    await until(() => current.storedSession()?.wallet === B && current.api.checked.has(B), 'The chosen account should finish its own sign-in and attendance');
    assert.equal(current.wallet.current(), B);
    assert.deepEqual(current.wallet.calls.signatures.map((entry) => entry.wallet), [B]);
    assert.deepEqual(current.api.calls.filter((call) => call.action === 'check-in').map((call) => call.wallet), [B]);
    assert.equal(current.api.checked.has(A), false);
    assert.equal(current.doc.getElementById('growth-wallet-state').title, B);
    assert.equal(current.lastProgress.progress.wallet, B);
  } finally { current.close(); }
});

test('a single-account connection still uses one sign-in message and one free check-in', async () => {
  const current = fixture({ accounts: [A] });
  try {
    await current.app.ready;
    await openWalletPicker(current);
    current.doc.querySelector('[data-wallet-id="Slush"]').click();
    await until(() => current.api.checked.has(A), 'Single-account connect should finish without an account-selection detour');
    assert.equal(current.wallet.calls.connect.length, 1);
    assert.equal(current.wallet.calls.signatures.length, 1);
    assert.equal(current.storedSession()?.wallet, A);
    assert.equal(current.api.count('check-in'), 1);
    await current.app.checkIn();
    assert.equal(current.api.count('check-in'), 1, 'Already-recorded attendance must not be submitted twice');
    assert.equal(current.doc.getElementById('growth-wallet-picker').open, false);
  } finally { current.close(); }
});

test('a queued stale logout event cannot erase or disconnect the newer account B session', async () => {
  const current = fixture({ saved: sessionFor(B), accounts: [A, B] });
  try {
    await current.app.ready;
    const currentRecord = current.view.localStorage.getItem(KEY);
    assert.equal(current.storedSession()?.wallet, B);
    // An old tab's removal event was queued before B signed in. By delivery,
    // shared storage already contains B's newer authenticated session.
    current.view.dispatchEvent(new current.view.StorageEvent('storage', {
      key: KEY, storageArea: current.view.localStorage,
      oldValue: JSON.stringify(sessionFor(A)), newValue: null,
      url: 'https://tree-token.xyz/play/',
    }));
    await settle();
    assert.equal(current.view.localStorage.getItem(KEY), currentRecord, 'The newer shared login is retained byte for byte');
    assert.equal(current.wallet.current(), B);
    assert.equal(current.wallet.calls.disconnect, 0, 'An obsolete notification must not disconnect the new account');
    assert.equal(current.lastProgress.sessionActive, true);
    assert.equal(current.lastProgress.progress.wallet, B);
    assert.equal(current.api.count('logout'), 0);
  } finally { current.close(); }
});

test('a real shared account B login clears active account A without deleting or revoking the newer login', async () => {
  const current = fixture({ saved: sessionFor(A), accounts: [A, B] });
  try {
    await current.app.ready;
    assert.equal(current.wallet.current(), A);
    const previousRecord = current.view.localStorage.getItem(KEY);
    const incomingRecord = JSON.stringify(sessionFor(B));
    // Simulate the storage mutation that another tab makes before the browser
    // delivers its corresponding event to this still-authenticated A tab.
    current.view.localStorage.setItem(KEY, incomingRecord);
    current.view.dispatchEvent(new current.view.StorageEvent('storage', {
      key: KEY, storageArea: current.view.localStorage,
      oldValue: previousRecord, newValue: incomingRecord,
      url: 'https://tree-token.xyz/play/',
    }));
    await until(() => current.wallet.calls.disconnect === 1 && !current.lastProgress?.sessionActive,
      'The old tab must release account A when another account signs in');
    await settle();
    assert.equal(current.wallet.current(), null);
    assert.equal(current.lastProgress.progress, null, 'Account A progress is removed from the active UI');
    assert.doesNotMatch(current.doc.getElementById('growth-wallet-state').textContent, /Signed in/);
    assert.equal(current.view.localStorage.getItem(KEY), incomingRecord, 'Account B shared session must survive cleanup of account A');
    assert.equal(current.view.sessionStorage.getItem(KEY), null);
    assert.equal(current.api.count('logout'), 0, 'Cross-tab cleanup must not revoke the shared login');
    current.view.dispatchEvent(new current.view.Event('focus'));
    current.view.dispatchEvent(new current.view.Event('pageshow'));
    await settle();
    assert.equal(current.lastProgress.sessionActive, false);
    assert.equal(current.wallet.current(), null);
    assert.equal(current.view.localStorage.getItem(KEY), incomingRecord);
  } finally { current.close(); }
});
