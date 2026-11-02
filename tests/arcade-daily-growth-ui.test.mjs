// Exercise the real HTML/controller with isolated DOM dependencies and no network.
// ARCADE_DOM_TEST_DEPS=/tmp/tree-arcade-ui-testdeps node --test tests/arcade-daily-growth-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createDailyGrowth } from '../scripts/arcade-daily-growth.js';
import { createGrowthWalletClient } from '../vendor/arcade-growth-wallet/wallet-core.mjs';

const require = createRequire(resolve(process.env.ARCADE_DOM_TEST_DEPS || '/tmp/tree-arcade-ui-testdeps', 'package.json'));
const { JSDOM, VirtualConsole } = require('jsdom');
const html = readFileSync(resolve(import.meta.dirname, '../play/index.html'), 'utf8');
const ACCOUNT = `0x${'a'.repeat(64)}`;
const OTHER_ACCOUNT = `0x${'b'.repeat(64)}`;
const SESSION_KEY = 'tree-arcade:daily-growth:session:v1';
const NOW = Date.parse('2026-11-12T12:00:00Z');
const GAMES = [
  { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot' },
  { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp' },
  { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials' },
];
const FORCE_GAME = { id: 'treeforce89', label: 'TREE FORCE ’89', href: '/play/treeforce89/', creditRule: 'start-run' };
const FORCE_GAMES = [...GAMES.map((game) => ({ ...game, creditRule: 'complete-result' })), FORCE_GAME];
const FORCE_CONFIGURATION = {
  enabledGames: FORCE_GAMES,
  eligibleGames: FORCE_GAMES,
  todayPick: FORCE_GAME,
};
const HISTORIC_FORCE_CONFIGURATION = {
  enabledGames: GAMES.map((game) => ({ ...game, creditRule: 'complete-result' })),
  eligibleGames: FORCE_GAMES,
  todayPick: FORCE_GAME,
};
const MILESTONES = [
  { id: 'seedling', label: 'Seedling', target: 3 },
  { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 },
  { id: 'full-canopy', label: 'Full Canopy', target: 21 },
];
const PROGRESS_METERS = ['quest-meter', 'passport-meter', 'summary-meter'];
const deferred = () => {
  let resolvePromise;
  let reject;
  const promise = new Promise((done, fail) => { resolvePromise = done; reject = fail; });
  return { promise, resolve: resolvePromise, reject };
};

function progress({ wallet = ACCOUNT, dateKey = '2026-11-12', visits = [], quests = [], stamps = [], badges = [], enabledGames = GAMES, optionalGames = [], optionalStamps = [], gameIdsByDay = {} } = {}) {
  const monthKey = dateKey.slice(0, 7);
  const [year, month] = monthKey.split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const calendar = Array.from({ length: days }, (_, index) => ({
    dateKey: `${monthKey}-${String(index + 1).padStart(2, '0')}`,
    checkedIn: visits.includes(index + 1), questCompleted: quests.includes(index + 1),
    gameIds: quests.includes(index + 1) ? gameIdsByDay[index + 1] || ['garden-bot'] : [],
  }));
  const today = calendar.find((day) => day.dateKey === dateKey);
  return {
    wallet, monthKey, dateKey, calendar, checkedInDays: visits.length, questDays: quests.length,
    today: { checkedIn: today.checkedIn, questCompleted: today.questCompleted, gameIds: today.gameIds },
    passport: { monthKey, enabledGames, completedGameIds: stamps, optionalGames, optionalCompletedGameIds: optionalStamps, complete: stamps.length === enabledGames.length },
    milestones: MILESTONES.map((item) => ({ ...item, earned: visits.length >= item.target })), badges,
  };
}

async function settleUntil(predicate, label) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (predicate()) return;
    await new Promise((done) => setImmediate(done));
  }
  assert.fail(`Daily Growth did not reach: ${label}`);
}

function assertUnknownMeters(h) {
  for (const id of PROGRESS_METERS) {
    const meter = h.byId(id);
    assert(meter, `${id} exists`);
    assert.equal(meter.hasAttribute('aria-valuenow'), false, `${id} does not invent a current value`);
    assert.equal(meter.hasAttribute('aria-valuemax'), false, `${id} does not expose a private progress scale`);
    assert.equal(meter.classList.contains('is-unknown'), true, `${id} marks progress as unknown`);
    assert.equal(meter.classList.contains('is-complete'), false, `${id} is not an earned completion`);
  }
}

function assertMeter(h, id, value, maximum) {
  const meter = h.byId(id);
  assert.equal(meter.getAttribute('role'), 'progressbar', `${id} has accessible progress semantics`);
  assert.equal(meter.getAttribute('aria-valuemin'), '0', id);
  assert.equal(meter.getAttribute('aria-valuemax'), String(maximum), id);
  assert.equal(meter.getAttribute('aria-valuenow'), String(value), id);
  assert.equal(meter.classList.contains('is-unknown'), false, id);
  assert(meter.getAttribute('aria-valuetext'), `${id} explains the saved progress`);
  assert(Math.abs(Number(meter.style.getPropertyValue('--growth-progress')) - value / maximum * 100) < 0.001,
    `${id} visible fill matches its accessible value`);
}

function assertWalletIdentity(h, address = null, status = null) {
  const identity = h.byId('wallet-identity');
  assert.equal(h.byId('details').contains(identity), false, 'Wallet identity stays outside collapsed progress');
  assert.equal(identity.hidden, !address);
  if (!address) {
    assert.equal(identity.textContent, '');
    assert.equal(identity.hasAttribute('title'), false);
    assert.equal(identity.hasAttribute('aria-label'), false);
    assert.equal(identity.classList.contains('is-signed-in'), false);
    return;
  }
  assert.equal(h.byId('wallet-identity-name').textContent, 'Test wallet');
  assert.equal(h.byId('wallet-identity-status').textContent, status);
  assert.equal(h.byId('wallet-identity-address').textContent, address === ACCOUNT ? '0xaaaaaa…aaaaaa' : '0xbbbbbb…bbbbbb');
  assert.equal(identity.title, address, 'Hover exposes the full current address');
  assert.equal(identity.getAttribute('aria-label'), `Test wallet · ${address} · ${status === 'Signed in' ? 'Signed in to Daily Growth' : 'Connected, not signed in to Daily Growth'}`);
  assert.equal(identity.classList.contains('is-signed-in'), status === 'Signed in');
}

async function harness(t, options = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM(html, { url: 'https://tree-token.xyz/play/', runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  // JSDOM does not implement the browser's dialog top layer. Supply only its
  // open/close lifecycle here; focus trapping and actual backdrop layout are
  // covered by the browser review rather than simulated as UI implementation.
  Object.defineProperties(window.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.setAttribute('open', ''); } },
    close: { configurable: true, value() {
      if (!this.open) return;
      this.removeAttribute('open');
      this.dispatchEvent(new window.Event('close'));
    } },
  });
  const root = window.document.getElementById('arcade-daily-growth');
  const byId = (id) => window.document.getElementById(`growth-${id}`);
  const calls = [];
  let clock = options.now || NOW;
  let walletState = options.connected ? { connected: true, address: ACCOUNT, walletName: 'Test wallet' } : { connected: false, address: null, walletName: null };
  const walletListeners = new Set();
  const walletListListeners = new Set();
  let availableWallets = options.availableWallets || [{ id: 'Test wallet', name: 'Test wallet' }];
  let connectImpl = options.connect;
  let sign = options.sign || (async () => ({ signature: 'test-personal-message-signature' }));
  const changeWallet = (address) => {
    walletState = address ? { connected: true, address, walletName: 'Test wallet' } : { connected: false, address: null, walletName: null };
    for (const listener of walletListeners) listener(walletState);
  };
  const wallet = {
    getWalletState: () => walletState,
    getAvailableWallets: () => availableWallets,
    async connectWallet(id) {
      calls.push({ type: 'connect', id });
      if (connectImpl) await connectImpl(id);
      changeWallet(ACCOUNT);
      return walletState;
    },
    async restoreWallet({ id, address }) { calls.push({ type: 'restore', id, address }); if (options.allowRestore) changeWallet(address); return walletState; },
    async disconnectWallet() { calls.push({ type: 'disconnect' }); changeWallet(null); },
    async signPersonalMessage({ message }) {
      calls.push({ type: 'signature', message: new TextDecoder().decode(message) });
      return sign();
    },
    subscribeWalletState(listener) { walletListeners.add(listener); queueMicrotask(() => listener(walletState)); return () => walletListeners.delete(listener); },
    subscribeWallets(listener) { walletListListeners.add(listener); return () => walletListListeners.delete(listener); },
  };
  let savedProgress = options.progress || progress();
  const handlers = { ...options.handlers };
  const envelope = (authenticated = true) => ({
    status: 'ok', serverTime: new Date(clock).toISOString(), dateKey: savedProgress.dateKey,
    monthKey: savedProgress.monthKey, authenticated,
    configuration: options.configuration || { enabledGames: GAMES, todayPick: GAMES[2] },
    ...(authenticated ? { progress: savedProgress } : {}),
  });
  const fetchImpl = async (url, init) => {
    const action = new URL(url, window.location.href).searchParams.get('action');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ type: 'api', action, body, headers: init.headers, method: init.method });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    let payload;
    if (handlers[action]) payload = await handlers[action]({ body, init, envelope });
    else if (action === 'status') payload = envelope(Boolean(init.headers.Authorization));
    else if (action === 'challenge') payload = { status: 'ok', challenge: {
      challengeId: 'challenge-123', wallet: body.wallet, message: `Sign in to TREE Arcade Daily Growth\nWallet: ${body.wallet}\nNo transaction is submitted.`,
      expiresAt: new Date(clock + 300000).toISOString(), dateKey: savedProgress.dateKey,
    } };
    else if (action === 'session') payload = {
      ...envelope(), session: { token: 'server-session-token', wallet: body.wallet, expiresAt: new Date(clock + 3600000).toISOString() },
    };
    else if (action === 'sync') payload = {
      ...envelope(), sync: { games: (options.configuration?.eligibleGames || GAMES).map((game) => ({ gameId: game.id, status: 'no-result' })), checkedAt: new Date(clock).toISOString() },
    };
    else if (action === 'check-in') {
      const day = Number(savedProgress.dateKey.slice(-2));
      savedProgress = progress({
        dateKey: savedProgress.dateKey,
        visits: [...new Set([...savedProgress.calendar.filter((entry) => entry.checkedIn).map((entry) => Number(entry.dateKey.slice(-2))), day])],
        quests: savedProgress.calendar.filter((entry) => entry.questCompleted).map((entry) => Number(entry.dateKey.slice(-2))),
        stamps: savedProgress.passport.completedGameIds,
        enabledGames: savedProgress.passport.enabledGames,
        optionalGames: savedProgress.passport.optionalGames, optionalStamps: savedProgress.passport.optionalCompletedGameIds,
        gameIdsByDay: Object.fromEntries(savedProgress.calendar.map((entry) => [Number(entry.dateKey.slice(-2)), entry.gameIds])),
      });
      payload = envelope();
    } else if (action === 'logout') payload = { status: 'ok' };
    else assert.fail(`Unexpected action: ${action}`);
    return { ok: payload.status === 'ok', status: payload.httpStatus || (payload.status === 'ok' ? 200 : 503), json: async () => payload };
  };
  if (options.savedSession) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(options.savedSession));
  const controller = createDailyGrowth({ root, fetchImpl, loadWallet: async () => options.wallet || wallet, storage: window.sessionStorage, now: () => clock });
  t.after(() => { controller.destroy(); window.close(); assert.deepEqual(errors.map((error) => error.message), []); });
  options.inspectInitial?.({ root, byId, calls });
  await controller.ready;
  const count = (action) => calls.filter((call) => call.type === 'api' && call.action === action).length;
  async function connect() {
    byId('connect').click();
    byId('wallet-options').querySelector('button').click();
    await settleUntil(() => root.dataset.growthState === 'connected', 'wallet connected');
  }
  async function signIn() { if (!walletState.connected) await connect(); await controller.signIn(); }
  return {
    root, window, byId, calls, count, handlers, controller, envelope, changeWallet, connect, signIn,
    setProgress(value) { savedProgress = value; }, setSign(value) { sign = value; }, setClock(value) { clock = value; },
    setConnect(value) { connectImpl = value; },
    changeWallets(value) { availableWallets = value; for (const listener of walletListListeners) listener(value); },
  };
}

test('compact Daily Growth starts closed and its native progress disclosure never starts wallet or write requests', async (t) => {
  const h = await harness(t);
  assertWalletIdentity(h);
  const details = h.byId('details');
  const toggle = details.querySelector('summary');
  assert.equal(details.tagName, 'DETAILS');
  assert.equal(details.open, false, 'Game discovery is not displaced by the full dashboard on entry');
  for (const id of ['connect', 'sign-in', 'sign-out', 'check-in', 'wallet-picker', 'status']) {
    assert.equal(details.contains(h.byId(id)), false, `${id} remains usable when progress is collapsed`);
  }
  assert.equal(h.byId('invitation-title').textContent, 'Daily Growth');
  assert.equal(h.byId('summary-note').textContent, 'Check in. Play. Grow your collection.');
  assert.equal(h.byId('summary-count').textContent, 'Your first badge starts here.');
  assert.equal(h.byId('summary-label').textContent, '3 cumulative check-ins to earn');
  assert.equal(h.byId('summary-art-label').textContent, 'Seedling');
  assert.equal(h.byId('teaser-kind').textContent, 'Next badge');
  assert.equal(h.byId('teaser-badge').textContent, 'Seedling');
  assert.equal(h.byId('details-hint').textContent, '3 check-ins to earn');
  assert.equal(h.byId('reward-earned').hidden, true);
  assert.equal(h.byId('summary-art').getAttribute('src'), '/assets/arcade/garden-bot-poster.webp');
  assert.equal(h.byId('connect').textContent, 'Connect to check in');
  assert.equal(h.byId('connect').classList.contains('growth-primary'), true);
  assert.equal(h.byId('connect').classList.contains('growth-secondary'), false);
  assert.equal(h.byId('invitation-hint').textContent, 'Free check-in · No gas fee');
  assert.equal(h.byId('details-label').textContent, 'View daily tasks');
  assert.equal(h.byId('summary-meter').hidden, true, 'Unknown private progress has no visible numeric meter');
  assert.equal(h.byId('check-in').hidden, true);
  assert.equal(details.contains(h.byId('month-rail')), false, 'Calendar dates remain visible while tasks are closed');
  const before = h.calls.length;
  toggle.click();
  assert.equal(details.open, true);
  await settleUntil(() => h.byId('invitation-open').getAttribute('aria-expanded') === 'true', 'native disclosure expands invitation controls');
  assert.equal(h.byId('badge-preview').getAttribute('aria-expanded'), 'true');
  toggle.click();
  assert.equal(details.open, false);
  await settleUntil(() => h.byId('invitation-open').getAttribute('aria-expanded') === 'false', 'native disclosure collapses invitation controls');
  assert.equal(h.byId('badge-preview').getAttribute('aria-expanded'), 'false');
  assert.equal(h.calls.length, before, 'Opening progress is a local display action');
  assert.equal(h.calls.some((call) => ['connect', 'signature'].includes(call.type)), false);
});

test('compact check-in remains available with details closed and saves attendance only once', async (t) => {
  const h = await harness(t, { progress: progress({ visits: [1, 3], quests: [3], stamps: ['garden-bot'] }) });
  await h.signIn();
  assert.equal(h.byId('details').open, false);
  assert.equal(h.byId('check-in').hidden, false);
  assert.equal(h.byId('check-in').disabled, false);
  assert.equal(h.byId('check-in-row').hidden, false);
  assert.equal(h.byId('check-in-row').disabled, false);
  assert.equal(h.byId('summary-note').textContent, 'Make today count. Check in and keep growing.');
  assert.equal(h.byId('invitation-hint').textContent, 'Free check-in · No game required');
  assert.equal(h.byId('summary-count').textContent, 'One more check-in to Seedling');
  assert.equal(h.byId('summary-label').textContent, '2 / 3 check-ins');
  assertMeter(h, 'summary-meter', 2, 3);
  assert.equal(h.count('check-in'), 0, 'Sign-in does not automatically save attendance');
  const pending = deferred();
  h.handlers['check-in'] = () => pending.promise;
  h.byId('check-in').click();
  assert.equal(h.byId('check-in').disabled, true);
  assert.equal(h.byId('check-in-row').disabled, true);
  assert.equal(h.byId('check-in-row').textContent, 'Saving check-in…');
  assert.equal(h.byId('check-in-task').classList.contains('is-complete'), false, 'Attendance is not claimed before the server saves it');
  assert.equal(h.byId('summary-label').textContent, '2 / 3 check-ins');
  h.byId('check-in').click();
  h.byId('check-in-row').click();
  assert.equal(h.count('check-in'), 1, 'The two button locations share one in-flight request guard');
  assert.equal(h.byId('days').querySelector('[data-date="2026-11-12"]').classList.contains('is-done'), false, 'No optimistic date credit before the saved response');
  h.setProgress(progress({ visits: [1, 3, 12], quests: [3], stamps: ['garden-bot'] }));
  pending.resolve(h.envelope());
  await settleUntil(() => h.byId('summary-label').textContent === '3 / 7 check-ins', 'compact badge preview updated after the saved response');
  assert.equal(h.byId('details').open, false);
  assert.equal(h.byId('check-in').disabled, true);
  assert.equal(h.byId('check-in-row').disabled, true);
  assert.equal(h.byId('check-in-row').textContent, 'Checked in ✓');
  assert.equal(h.byId('check-in-task').classList.contains('is-complete'), true);
  assert.equal(h.byId('summary-count').textContent, '4 more check-ins to Sapling');
  assert.equal(h.byId('summary-art').getAttribute('src'), '/assets/arcade/arboretum-poster.webp');
  assert.equal(h.byId('summary-art-label').textContent, 'Sapling');
  assertMeter(h, 'summary-meter', 3, 7);
  assert.match(h.byId('check-in-state').textContent, /attendance is saved/i);
  h.byId('check-in').click();
  assert.equal(h.count('check-in'), 1);
  assert.equal(h.byId('quest-state').textContent, '0 / 1 · Not completed');
  assert.equal(h.byId('passport-count').textContent, '1 / 3 required games');
  assert.equal(h.byId('days').querySelector('[data-date="2026-11-12"]').classList.contains('is-done'), true);
});

test('task-row authentication stays explicit and checking in from the row uses the same saved action', async (t) => {
  const h = await harness(t);
  h.byId('invitation-open').click();
  h.byId('task-auth').focus();
  h.byId('task-auth').click();
  assert.equal(h.byId('wallet-picker').open, true);
  assert.equal(h.count('challenge'), 0);
  h.byId('wallet-close').click();
  assert.equal(h.window.document.activeElement, h.byId('task-auth'), 'Picker dismissal returns to the task-row opener');
  h.byId('task-auth').click();
  h.byId('wallet-options').querySelector('button').click();
  await settleUntil(() => h.root.dataset.growthState === 'connected', 'task-row wallet connection');
  assert.equal(h.byId('task-auth').textContent, 'Sign in');
  assert.equal(h.count('challenge'), 0, 'Connection never starts a message signature automatically');
  assert.equal(h.count('check-in'), 0);
  h.byId('task-auth').click();
  await settleUntil(() => h.root.dataset.growthState === 'authenticated' && h.count('sync') === 1, 'explicit task-row sign-in');
  assert.equal(h.byId('task-auth').hidden, true);
  assert.equal(h.byId('check-in-row').hidden, false);
  assert.equal(h.count('check-in'), 0, 'The explicit sign-in still does not check in');
  h.byId('check-in-row').click();
  await settleUntil(() => h.byId('check-in-row').textContent === 'Checked in ✓', 'task-row saved check-in');
  assert.equal(h.count('check-in'), 1);
  assert.equal(h.byId('check-in').disabled, true);
  assert.equal(h.byId('visit-count').textContent, '1');
  const beforeCollapse = h.calls.length;
  h.byId('collapse').click();
  assert.equal(h.byId('details').open, false);
  assert.equal(h.byId('invitation-open').getAttribute('aria-expanded'), 'false');
  assert.equal(h.window.document.activeElement, h.byId('details').querySelector('summary'));
  assert.equal(h.calls.length, beforeCollapse);
});

test('invitation buttons reveal today until both tasks are saved, without changing an already-open tab or starting requests', async (t) => {
  const h = await harness(t);
  const details = h.byId('details');
  const toggle = details.querySelector('summary');
  const before = h.calls.length;
  for (const id of ['badge-preview', 'invitation-open']) {
    h.byId(id).click();
    assert.equal(details.open, true);
    assert.equal(h.byId('today-tab').getAttribute('aria-selected'), 'true', `${id} offers a quest rather than an empty earned-badge pane`);
    assert.equal(h.window.document.activeElement, h.byId('today-tab'));
    assert.equal(h.byId('badge-preview').getAttribute('aria-expanded'), 'true');
    assert.equal(h.byId('invitation-open').getAttribute('aria-expanded'), 'true');
    toggle.click();
  }
  assert.equal(h.calls.length, before, 'Invitation clicks never connect, sign, sync, or check in');
  h.byId('invitation-open').click();
  h.byId('month-tab').click();
  h.byId('badge-preview').click();
  h.byId('invitation-open').click();
  assert.equal(h.byId('month-tab').getAttribute('aria-selected'), 'true', 'An open manually selected tab is preserved');
  await h.signIn();
  h.setProgress(progress({ visits: [12], quests: [12], stamps: ['garden-bot'] }));
  await h.controller.refresh();
  assert.equal(h.byId('summary-note').textContent, 'Today’s check-in and quest are saved.');
  assert.equal(h.byId('details-label').textContent, 'View badge progress');
  assert.equal(h.byId('month-tab').getAttribute('aria-selected'), 'true', 'A progress refresh does not disrupt the chosen tab');
  assert.equal(h.count('check-in'), 0, 'Only the server-verified quest supplied attendance');
  const afterRefresh = h.calls.length;
  toggle.click();
  h.byId('badge-preview').click();
  assert.equal(h.byId('badges-tab').getAttribute('aria-selected'), 'true');
  toggle.click();
  toggle.click();
  assert.equal(h.byId('badges-tab').getAttribute('aria-selected'), 'true', 'Native reopening follows the completed invitation');
  assert.equal(h.calls.length, afterRefresh);
});

test('wallet picker opens as a named dialog and every dismissal returns focus without wallet actions', async (t) => {
  const h = await harness(t);
  const picker = h.byId('wallet-picker');
  assert.equal(picker.tagName, 'DIALOG');
  assert(h.window.document.getElementById(picker.getAttribute('aria-labelledby')), 'The dialog has a visible title');
  assert.equal(picker.open, false);
  for (const dismissal of ['close button', 'Escape', 'backdrop']) {
    h.byId('connect').focus();
    h.byId('connect').click();
    assert.equal(picker.open, true, dismissal);
    assert.equal(h.byId('connect').getAttribute('aria-expanded'), 'true', dismissal);
    assert.equal(h.window.document.activeElement, h.byId('wallet-options').querySelector('button'), dismissal);
    if (dismissal === 'close button') h.byId('wallet-close').click();
    else if (dismissal === 'Escape') {
      // Browsers translate Escape on an open modal into a cancel event.
      const cancel = new h.window.Event('cancel', { cancelable: true });
      picker.dispatchEvent(cancel);
      if (!cancel.defaultPrevented) picker.close();
    } else picker.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true, clientX: -10, clientY: -10 }));
    assert.equal(picker.open, false, dismissal);
    assert.equal(h.byId('connect').getAttribute('aria-expanded'), 'false', dismissal);
    assert.equal(h.window.document.activeElement, h.byId('connect'), `${dismissal} restores the trigger`);
  }
  assert.deepEqual(h.calls.filter((call) => ['connect', 'signature'].includes(call.type)), []);
  assert.equal(h.count('challenge'), 0);
  assert.equal(h.count('session'), 0);
});

test('a rejected wallet connection stays in the picker with an announced error and a working retry', async (t) => {
  const h = await harness(t, { connect: async () => { throw new Error('Connection cancelled by user'); } });
  h.byId('connect').click();
  h.byId('wallet-options').querySelector('button').click();
  await settleUntil(() => h.root.dataset.growthState === 'signed-out', 'failed wallet connection');
  assert.equal(h.byId('wallet-picker').open, true);
  assert.equal(h.byId('wallet-status').getAttribute('role'), 'status');
  assert.match(h.byId('wallet-status').textContent, /cancel|reject|try again/i);
  assert.equal(h.byId('wallet-options').querySelector('button').disabled, false);
  assert.equal(h.count('challenge'), 0);
  h.setConnect(async () => {});
  h.byId('wallet-options').querySelector('button').click();
  await settleUntil(() => h.root.dataset.growthState === 'connected', 'retried wallet connection');
  assert.equal(h.byId('wallet-picker').open, false);
  assert.equal(h.window.document.activeElement, h.byId('sign-in'));
  assert.equal(h.calls.filter((call) => call.type === 'connect').length, 2);
  assert.equal(h.calls.filter((call) => call.type === 'signature').length, 0);
});

test('wallet rows use safe data icons and keep the same wallet focused when discovery refreshes', async (t) => {
  const icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const wallets = [
    { id: 'safe-wallet', name: 'Safe wallet', icon },
    { id: 'remote-wallet', name: '<img src=x onerror=alert(1)>', icon: 'https://example.invalid/tracker.png' },
    { id: 'script-wallet', name: 'Script wallet', icon: 'javascript:alert(1)' },
  ];
  const h = await harness(t, { availableWallets: wallets });
  h.byId('connect').click();
  const row = (id) => [...h.byId('wallet-options').querySelectorAll('button')].find((button) => button.dataset.walletId === id);
  assert.equal(row('safe-wallet').querySelector('img').getAttribute('src'), icon);
  assert.equal(row('remote-wallet').querySelector('img'), null);
  assert.equal(row('script-wallet').querySelector('img'), null);
  assert(row('remote-wallet').textContent.includes(wallets[1].name), 'Wallet names remain plain text');
  assert.equal(h.byId('wallet-options').querySelector('[onerror]'), null);
  row('remote-wallet').focus();
  h.changeWallets([wallets[2], wallets[1], wallets[0]]);
  assert.equal(h.window.document.activeElement, row('remote-wallet'));
  assert.equal(h.byId('wallet-picker').open, true);
  assert.equal(h.calls.filter((call) => call.type === 'connect').length, 0);
});

test('an empty wallet picker focuses its close control and explains how to connect', async (t) => {
  const h = await harness(t, { availableWallets: [] });
  h.byId('connect').focus();
  h.byId('connect').click();
  assert.equal(h.byId('wallet-picker').open, true);
  assert.equal(h.byId('wallet-options').children.length, 0);
  assert.equal(h.byId('no-wallet').hidden, false);
  assert.match(h.byId('no-wallet').textContent, /wallet.*browser|wallet installed/i);
  assert.equal(h.window.document.activeElement, h.byId('wallet-close'));
  h.byId('wallet-close').click();
  assert.equal(h.window.document.activeElement, h.byId('connect'));
  assert.equal(h.calls.filter((call) => call.type === 'connect').length, 0);
});

test('signed-out meters stay unknown while monthly badge goals are clearly previews', async (t) => {
  const h = await harness(t);
  assertUnknownMeters(h);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('journey-stops').children.length, 4);
  assert.equal(h.byId('journey-stops').querySelectorAll('.is-preview').length, 4);
  assert.equal(h.byId('journey-stops').querySelectorAll('.is-done').length, 0);
  assert.match(h.byId('journey-note').textContent, /goals|sign in/i);
  assert.equal(h.byId('badges').children.length, 0);
  assert.equal(h.byId('days').children.length, 30, 'The public server month can supply dates without revealing attendance');
  assert.equal(h.byId('days').querySelectorAll('.is-unknown').length, 30);
  assert.equal(h.byId('days').querySelectorAll('.is-done, .is-missed').length, 0);
  assert.equal(h.byId('days').querySelector('[aria-current="date"]').dataset.date, '2026-11-12');
  assert.equal(h.byId('days').querySelector('button, a, [tabindex]'), null, 'Dates are informational, including previous dates');
});

test('the persistent rail uses the exact UTC server month for 28, 29, 30 and 31 dates', async (t) => {
  for (const [monthKey, days] of [['2027-02', 28], ['2028-02', 29], ['2026-11', 30], ['2026-12', 31]]) {
    await t.test(`${monthKey}: ${days} dates`, async (subtest) => {
      const dateKey = `${monthKey}-18`;
      const h = await harness(subtest, { progress: progress({ dateKey, visits: [1, 3, 17], quests: [3] }) });
      await h.signIn();
      const rail = h.byId('days');
      assert.equal(rail.children.length, days);
      assert.equal(rail.firstElementChild.dataset.date, `${monthKey}-01`);
      assert.equal(rail.lastElementChild.dataset.date, `${monthKey}-${days}`);
      assert.equal(rail.style.getPropertyValue('--growth-days'), String(days));
      assert.equal(rail.style.getPropertyValue('--growth-mobile-days'), String(Math.ceil(days / 2)));
      assert.deepEqual([...rail.querySelectorAll('.is-done')].map(cell => Number(cell.dataset.date.slice(-2))), [1, 3, 17]);
      assert.equal(rail.querySelectorAll('.is-missed').length, 14, 'Only known earlier unchecked days get a missed mark');
      assert.equal(rail.querySelectorAll('.is-future').length, days - 18);
      const today = rail.querySelector('[aria-current="date"]');
      assert.equal(today.dataset.date, dateKey, 'The server date wins over the test browser clock');
      assert.equal(today.classList.contains('is-today'), true);
      assert.equal(today.matches('.is-done, .is-missed, .is-future'), false);
      assert.match(today.getAttribute('aria-label'), /today.*not yet checked in/i);
      assert.equal(rail.querySelectorAll('.is-unknown').length, 0);
      assert.equal(h.byId('visit-count').textContent, '3');
      assert.equal(h.byId('visit-total').textContent, `/ ${days} days`);
      assert.equal(h.byId('calendar').querySelectorAll('[role="listitem"]').length, days);
      assert.equal(h.byId('calendar').querySelector('[aria-current="date"]').querySelector('strong').textContent, '18');
      assert.equal(h.count('check-in'), 0);
    });
  }
});

test('loading, unavailable and invalid public dates never manufacture an attendance rail', async (t) => {
  let inspected = false;
  const h = await harness(t, {
    inspectInitial({ root, byId }) {
      inspected = true;
      assert.equal(root.dataset.growthState, 'loading');
      assert.equal(byId('days').children.length, 0);
      assert.equal(byId('visit-count').textContent, '—');
      assert.equal(byId('summary-meter').hasAttribute('aria-valuenow'), false);
    },
    handlers: { status: () => ({ status: 'error', error: 'service-unavailable', message: 'Temporarily unavailable.' }) },
  });
  assert.equal(inspected, true);
  assert.equal(h.byId('days').children.length, 0, 'No local clock is substituted for an unavailable server month');
  h.handlers.status = ({ envelope }) => ({ ...envelope(false), monthKey: '2026-02', dateKey: '2026-02-31' });
  await h.controller.refresh();
  assert.equal(h.byId('days').children.length, 0);
  assert.match(h.byId('status').textContent, /incomplete progress/);
  delete h.handlers.status;
  await h.controller.refresh();
  assert.equal(h.byId('days').querySelectorAll('.is-unknown').length, 30);
  h.handlers.status = () => ({ status: 'error', error: 'service-unavailable', message: 'Temporarily unavailable.' });
  await h.controller.refresh();
  assert.equal(h.byId('days').querySelectorAll('.is-unknown').length, 30, 'A known public month can retain neutral dates');
  assert.equal(h.byId('days').querySelectorAll('.is-done, .is-missed').length, 0);
  assert.match(h.byId('days').firstElementChild.getAttribute('aria-label'), /attendance unavailable/i);
  assert.match(h.byId('days').firstElementChild.title, /attendance unavailable/i);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('reward-earned').children.length, 0);
});

test('meters reflect saved attendance, the next milestone and required stamps, retaining labeled stale values and clearing on account change', async (t) => {
  const visits = [1, 2, 3, 4, 5, 6, 7, 8];
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({
    visits, quests: [8], enabledGames: FORCE_GAMES, stamps: ['garden-bot', 'arborist-trials', 'treeforce89'],
  }) });
  await h.signIn();
  assert.equal(h.byId('days').children.length, 30);
  assert.equal(h.byId('days').querySelectorAll('.is-done').length, 8);
  assert.equal(h.byId('visit-total').textContent, '/ 30 days');
  assertMeter(h, 'quest-meter', 0, 1);
  assertMeter(h, 'passport-meter', 3, 4);
  assert.equal(h.byId('summary-count').textContent, '6 more check-ins to Deep Roots');
  assert.equal(h.byId('summary-label').textContent, '8 / 14 check-ins');
  assert.equal(h.byId('summary-art-label').textContent, 'Deep Roots');
  assert.equal(h.byId('summary-art').getAttribute('src'), '/assets/profile-nftree-art.jpg');
  assert.equal(h.byId('summary-meter').hidden, false);
  assertMeter(h, 'summary-meter', 8, 14);
  assert.equal(h.byId('journey-stops').querySelectorAll('.is-done').length, 2);
  h.setProgress(progress({ visits: [...visits, 12], quests: [8, 12], enabledGames: FORCE_GAMES, stamps: ['garden-bot', 'arborist-trials', 'treeforce89'] }));
  await h.controller.refresh();
  assert.equal(h.byId('days').querySelectorAll('.is-done').length, 9);
  assert.equal(h.byId('visit-count').textContent, '9');
  assertMeter(h, 'quest-meter', 1, 1);
  assertMeter(h, 'passport-meter', 3, 4);
  assert.equal(h.byId('summary-count').textContent, '5 more check-ins to Deep Roots');
  assertMeter(h, 'summary-meter', 9, 14);
  h.handlers.sync = () => ({ status: 'error', error: 'service-unavailable', message: 'Try again later.' });
  await h.controller.refresh();
  assert.equal(h.byId('days').querySelectorAll('.is-done').length, 9);
  assert.equal(h.byId('visit-count').textContent, '9');
  assertMeter(h, 'quest-meter', 1, 1);
  assertMeter(h, 'passport-meter', 3, 4);
  for (const id of PROGRESS_METERS) assert.match(h.byId(id).getAttribute('aria-valuetext'), /last saved progress/i);
  assert.equal(h.byId('month-rail').classList.contains('is-stale'), true);
  assert.match(h.byId('rail-count').getAttribute('aria-label'), /9 of 30.*last saved/i);
  assert.match(h.byId('days').querySelector('[data-date="2026-11-12"]').getAttribute('aria-label'), /checked in.*last saved/i);
  assert.match(h.byId('summary-note').textContent, /last saved/i);
  assert.match(h.byId('rail-note').textContent, /last saved/i);
  assert.equal(h.byId('details-label').textContent, 'View daily tasks', 'An unavailable refresh does not claim current daily completion');
  assert.equal(h.byId('summary-label').textContent, '9 / 14 check-ins · Last saved');
  h.changeWallet(OTHER_ACCOUNT);
  assertUnknownMeters(h);
  assert.match(h.byId('summary-count').textContent, /^(Your first badge starts here\.|Your badges will be here\.)$/);
  assert.equal(h.byId('summary-art-label').textContent, 'Seedling');
  assert.equal(h.byId('summary-art').getAttribute('src'), '/assets/arcade/garden-bot-poster.webp');
  assert.equal(h.byId('invitation-title').textContent, 'Daily Growth');
  assert.equal(h.byId('summary-meter').hidden, true);
  assert.equal(h.byId('check-in').hidden, true);
  assert.equal(h.byId('summary-label').textContent.includes('9 / 14'), false);
  assert.equal(h.byId('journey-stops').querySelectorAll('.is-done').length, 0);
  assert.equal(h.byId('days').querySelectorAll('.is-done, .is-missed').length, 0, 'Account changes clear all private date marks immediately');
  assert.equal(h.byId('days').querySelectorAll('.is-unknown').length, 30);
  assert.equal(h.byId('month-rail').classList.contains('is-stale'), false);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('reward-earned').children.length, 0);
});

test('all attendance milestones are earned while the month rail keeps the actual count and month length', async (t) => {
  const h = await harness(t, { progress: progress({
    dateKey: '2026-10-31', visits: [...Array.from({ length: 21 }, (_, index) => index + 1), 31],
  }) });
  await h.signIn();
  assert.equal(h.byId('days').children.length, 31);
  assert.equal(h.byId('days').querySelectorAll('.is-done').length, 22);
  assert.equal(h.byId('visit-total').textContent, '/ 31 days');
  assert.equal(h.byId('teaser-kind').textContent, 'Attendance complete');
  assert.equal(h.byId('reward-kind').textContent, 'MONTHLY ATTENDANCE COMPLETE');
  assert.equal(h.byId('details-hint').textContent, 'Earned automatically ✓');
  assert.equal(h.byId('reward-earned').querySelectorAll('.growth-earned-chip').length, 4);
  assert.equal(h.byId('visit-count').textContent, '22');
  assert.equal(h.byId('summary-count').textContent, 'All attendance badges earned.');
  assert.equal(h.byId('summary-label').textContent, '21 / 21 check-ins');
  assert.equal(h.byId('summary-art-label').textContent, 'Full Canopy');
  assert.equal(h.byId('summary-art').getAttribute('src'), '/assets/tree-command-logo-v2-512.png');
  assertMeter(h, 'summary-meter', 21, 21);
  assert.equal(h.byId('journey-stops').querySelectorAll('.is-done').length, 4);
});

test('signed-out state shows the server pick without invented progress or automatic wallet prompts', async (t) => {
  const h = await harness(t);
  assert.equal(h.root.dataset.growthState, 'signed-out');
  assert.equal(h.byId('game-name').textContent, 'Arborist Trials');
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.byId('stamps').children.length, 0);
  assert.equal(h.byId('badges').children.length, 0);
  assert.equal(h.byId('check-in').disabled, true);
  assert.equal(h.byId('play').href, GAMES[2].href);
  assert.deepEqual(h.calls.filter((call) => ['connect', 'signature', 'restore'].includes(call.type)), []);
  assert.deepEqual([...h.byId('game-select').options].map((option) => option.value), GAMES.map((game) => game.id));
  assert.equal(h.byId('game-select').textContent.includes('TREE FORCE'), false, 'Unsupported game is not a requirement');
  assert.equal(h.byId('tracking-note').hidden, false);
  assert.match(h.byId('tracking-note').textContent, /TREE FORCE ’89 is not enabled for Daily Growth here/);
  assert.match(h.byId('quest-note').textContent, /refresh before 00:00 UTC.*quest and passport stamps/);
});

test('connecting requires a separate message sign-in and uses only a wallet-bound server session', async (t) => {
  const h = await harness(t);
  await h.connect();
  assertWalletIdentity(h, ACCOUNT, 'Connected');
  assert.equal(h.calls.filter((call) => call.type === 'signature').length, 0);
  assert.equal(h.byId('sign-in').hidden, false);
  assert.equal(h.byId('sign-in').textContent, 'Sign in to check in');
  assert.equal(h.byId('invitation-hint').textContent, 'Sign in with a message · No gas fee');
  assert.equal(h.byId('connect').textContent, 'Change wallet');
  assert.equal(h.byId('connect').classList.contains('growth-primary'), false);
  assert.equal(h.byId('connect').classList.contains('growth-secondary'), true);
  assertUnknownMeters(h);
  await h.controller.signIn();
  assert.equal(h.root.dataset.growthState, 'authenticated');
  assertWalletIdentity(h, ACCOUNT, 'Signed in');
  assert.equal(h.count('check-in'), 0, 'Signing a session message is not a check-in');
  assert.equal(h.byId('visit-count').textContent, '0', 'Zero appears only after an authenticated server response');
  assert.equal(h.count('sync'), 1, 'Initial sign-in discovers verified results');
  const signature = h.calls.find((call) => call.type === 'signature');
  assert.match(signature.message, new RegExp(ACCOUNT));
  assert.match(signature.message, /No transaction is submitted/);
  const session = JSON.parse(h.window.sessionStorage.getItem(SESSION_KEY));
  assert.equal(session.wallet, ACCOUNT);
  assert.equal(session.walletId, 'Test wallet');
  assert.equal(h.window.localStorage.length, 0);
  assert.equal(h.root.textContent.includes(session.token), false);
  const sync = h.calls.find((call) => call.action === 'sync');
  assert.equal(sync.headers.Authorization, `Bearer ${session.token}`);
  assert.deepEqual(sync.body, {});
});

test('standalone check-in saves attendance without a quest, passport credit, or duplicate write', async (t) => {
  const h = await harness(t);
  await h.signIn();
  await h.controller.checkIn();
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('check-in').textContent, 'Checked in ✓');
  assert.equal(h.byId('quest-state').textContent, '0 / 1 · Not completed');
  assert.equal(h.byId('passport-count').textContent, '0 / 3 required games');
  assert.equal(h.byId('check-in').disabled, true);
  await h.controller.checkIn();
  assert.equal(h.count('check-in'), 1);
  assert.deepEqual(h.calls.find((call) => call.action === 'check-in').body, {});
});

test('launching and choosing a game never credits progress; verified sync awards only server results', async (t) => {
  const h = await harness(t);
  await h.signIn();
  h.byId('game-select').value = 'pvp';
  h.byId('game-select').dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.match(h.byId('game-access').textContent, /Paid entry.*Optional for daily attendance/);
  const before = h.calls.length;
  h.byId('play').addEventListener('click', (event) => event.preventDefault());
  h.byId('play').click();
  assert.equal(h.calls.length, before);
  assert.equal(h.byId('visit-count').textContent, '0');
  assert.equal(h.byId('passport-count').textContent, '0 / 3 required games');
  h.setProgress(progress({ visits: [12], quests: [12], stamps: ['garden-bot'] }));
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('month-quests').textContent, '1');
  assert.equal(h.byId('quest-state').textContent, '1 / 1 · Quest complete ✓');
  assert.equal(h.byId('passport-count').textContent, '1 / 3 required games');
  assert.match(h.byId('passport-reward').textContent, /monthly Arcade Passport badge/);
  assert.match(h.byId('status').textContent, /Daily quest complete/);
  await h.controller.refresh();
  assert.equal(h.byId('month-quests').textContent, '1', 'Repeat sync does not invent a second daily quest');
});

test('API failure is unavailable rather than zero, and a retry can recover', async (t) => {
  const h = await harness(t, { handlers: { status: () => ({ status: 'error', error: 'service-unavailable', message: 'Progress storage is unavailable.' }) } });
  assertUnknownMeters(h);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.byId('refresh').textContent, 'Retry availability');
  assert.equal(h.byId('summary-label').textContent, 'Progress temporarily unavailable');
  assert.equal(h.byId('summary-note').textContent, 'We couldn’t load Daily Growth. Please try again shortly.');
  assert.equal(h.byId('invitation-hint').textContent, 'Your saved progress has not changed.');
  assert.match(h.byId('status').textContent, /Progress is unavailable/);
  delete h.handlers.status;
  await h.controller.refresh();
  assert.equal(h.root.dataset.growthState, 'signed-out');
  assert.equal(h.byId('visit-count').textContent, '—');
  await h.signIn();
  assert.equal(h.byId('visit-count').textContent, '0');
});

test('failed writes and incomplete source verification preserve saved progress with an explicit warning', async (t) => {
  const h = await harness(t, { progress: progress({ visits: [1, 3], quests: [3], stamps: ['garden-bot'] }) });
  await h.signIn();
  const identityMutations = [];
  const observer = new h.window.MutationObserver(records => identityMutations.push(...records));
  observer.observe(h.byId('wallet-identity'), { subtree: true, childList: true, attributes: true, characterData: true });
  h.handlers['check-in'] = () => ({ status: 'error', error: 'service-unavailable', message: 'Try again later.' });
  await h.controller.checkIn();
  observer.disconnect();
  assert.equal(identityMutations.length, 0, 'Progress-only renders do not repeat the live wallet identity announcement');
  assertWalletIdentity(h, ACCOUNT, 'Signed in');
  assert.equal(h.byId('visit-count').textContent, '2');
  assert.equal(h.byId('check-in').textContent, 'Check in today');
  assert.match(h.byId('status').textContent, /Last saved progress shown/);
  h.handlers.sync = ({ envelope }) => ({ ...envelope(), sync: { games: [{ gameId: 'pvp', status: 'unavailable' }], checkedAt: new Date(NOW).toISOString() } });
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '2');
  assert.equal(h.byId('passport-count').textContent, '1 / 3 required games');
  assert.match(h.byId('status').textContent, /Saved progress shown; PvP Battle verification is unavailable/);
});

test('changing accounts during a refresh immediately hides private progress and ignores the late response', async (t) => {
  const h = await harness(t, { progress: progress({ visits: [1], quests: [1], stamps: ['garden-bot'] }) });
  await h.signIn();
  const pending = deferred();
  h.handlers.sync = () => pending.promise;
  const refresh = h.controller.refresh();
  await settleUntil(() => h.root.dataset.growthState === 'syncing', 'sync in flight');
  assert.match(h.byId('summary-label').textContent, /Last saved/);
  assert.match(h.byId('summary-meter').getAttribute('aria-valuetext'), /Last saved progress/);
  assert.match(h.byId('rail-note').textContent, /last saved/i);
  h.changeWallet(OTHER_ACCOUNT);
  assertWalletIdentity(h, OTHER_ACCOUNT, 'Connected');
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('stamps').children.length, 0);
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  pending.resolve(h.envelope());
  await refresh;
  assert.equal(h.root.dataset.growthState, 'connected');
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('summary-meter').hidden, true);
  assertUnknownMeters(h);
  assert.equal(h.byId('summary-art-label').textContent, 'Seedling');
  assert.equal(h.byId('invitation-title').textContent, 'Daily Growth');
  assert.match(h.byId('wallet-state').title, new RegExp(OTHER_ACCOUNT));
});

test('an account switch while a sign-in prompt is open cannot authorize the previous account', async (t) => {
  const pending = deferred();
  const h = await harness(t, { sign: () => pending.promise });
  await h.connect();
  const signingIn = h.controller.signIn();
  await settleUntil(() => h.calls.some((call) => call.type === 'signature'), 'wallet sign-in prompt');
  h.changeWallet(OTHER_ACCOUNT);
  pending.resolve({ signature: 'old-account-signature' });
  await signingIn;
  assert.equal(h.count('session'), 0);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('sign-in').hidden, false);
});

test('revoked sessions clear private state immediately; inconsistent server data does not become progress', async (t) => {
  const h = await harness(t, { progress: progress({ visits: [1, 2, 3] }) });
  await h.signIn();
  h.handlers.sync = () => ({ status: 'error', error: 'invalid-session', message: 'Session expired.', httpStatus: 401 });
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.root.dataset.growthState, 'connected');
  assert.match(h.byId('status').textContent, /Sign in again/);
  assertWalletIdentity(h, ACCOUNT, 'Connected');
  delete h.handlers.sync;
  h.handlers.session = ({ body, envelope }) => ({
    ...envelope(), progress: { ...progress(), wallet: OTHER_ACCOUNT, checkedInDays: 99 },
    session: { token: 'wrong-progress-token', wallet: body.wallet, expiresAt: new Date(NOW + 3600000).toISOString() },
  });
  await h.controller.signIn();
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  assert.match(h.byId('status').textContent, /incomplete progress/);
});

test('server month controls the full UTC calendar, earned badges, and roving keyboard tabs', async (t) => {
  const h = await harness(t, { progress: progress({
    dateKey: '2026-10-31', visits: [1, 2, 3, 31], quests: [31], stamps: ['garden-bot'],
    badges: [{ id: '2026-10-seedling', label: 'Seedling', monthKey: '2026-10', earnedAt: '2026-10-03T12:00:00Z' }],
  }) });
  await h.signIn();
  assert.match(h.byId('meta').textContent, /October 31, 2026/);
  assert.equal(h.byId('calendar').querySelectorAll('[role="listitem"]').length, 31);
  assert.equal(h.byId('calendar').querySelectorAll('.growth-calendar-blank').length, 4);
  assert.match(h.byId('calendar').querySelector('[aria-current="date"]').getAttribute('aria-label'), /checked in, daily quest complete/);
  assert.equal(h.byId('badges').children.length, 1);
  assert.match(h.byId('badges').textContent, /October 2026/);
  h.byId('today-tab').focus();
  h.byId('today-tab').dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(h.window.document.activeElement, h.byId('badges-tab'));
  assert.equal(h.byId('badges-tab').getAttribute('aria-selected'), 'true');
  assert.equal(h.byId('badges-tab').tabIndex, 0);
  assert.equal(h.byId('today-tab').tabIndex, -1);
  assert.equal(h.byId('badges-panel').hidden, false);
  assert.equal(h.byId('today-panel').hidden, true);
  h.byId('badges-tab').dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(h.window.document.activeElement, h.byId('month-tab'));
  assert.equal(h.byId('month-panel').hidden, false);
});

test('an existing authorized session restores silently and expires without exposing old progress', async (t) => {
  const h = await harness(t, { allowRestore: true, savedSession: {
    version: 1, wallet: ACCOUNT, token: 'saved-session-token', walletId: 'Test wallet', walletName: 'Test wallet', expiresAt: new Date(NOW + 3600000).toISOString(),
  } });
  assert.equal(h.root.dataset.growthState, 'authenticated');
  assertWalletIdentity(h, ACCOUNT, 'Signed in');
  assert.equal(h.calls.filter((call) => call.type === 'restore').length, 1);
  assert.equal(h.calls.filter((call) => call.type === 'connect' || call.type === 'signature').length, 0);
  assert.equal(h.calls.find((call) => call.action === 'status').headers.Authorization, 'Bearer saved-session-token');
  h.setClock(NOW + 3600001);
  h.window.dispatchEvent(new h.window.Event('focus'));
  assertWalletIdentity(h, ACCOUNT, 'Connected');
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('summary-art-label').textContent, 'Seedling');
  assert.equal(h.byId('summary-meter').hidden, true);
  assertUnknownMeters(h);
  assert.equal(h.byId('invitation-title').textContent, 'Daily Growth');
  assert.equal(h.byId('details-label').textContent, 'View daily tasks');
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
});

test('explicit sign-out drops the token and private data even when the logout endpoint fails', async (t) => {
  const h = await harness(t, { progress: progress({ visits: [1] }) });
  await h.signIn();
  h.handlers.logout = () => ({ status: 'error', error: 'service-unavailable', message: 'Unavailable' });
  await h.controller.signOut();
  assertWalletIdentity(h, ACCOUNT, 'Connected');
  assertUnknownMeters(h);
  assert.equal(h.byId('journey-stops').querySelectorAll('.is-done').length, 0);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  assert.equal(h.count('logout'), 1);
  assert.match(h.byId('status').textContent, /Signed out/);
  h.changeWallet(null);
  assertWalletIdentity(h);
});

function realWalletFixture() {
  const account = { address: ACCOUNT, chains: ['sui:mainnet'], features: ['sui:signPersonalMessage'] };
  const calls = [];
  let onChange;
  let connectImpl = async () => ({ accounts: [account] });
  let signImpl = async () => ({ signature: 'real-adapter-test-signature' });
  const standardWallet = {
    name: 'Test wallet', chains: ['sui:mainnet'], accounts: [], features: {
      'standard:connect': { async connect(options) { calls.push({ type: 'connect', options }); return connectImpl(options); } },
      'standard:events': { on(_event, callback) { onChange = callback; return () => { onChange = null; }; } },
      'sui:signPersonalMessage': { async signPersonalMessage(args) { calls.push({ type: 'signature', ...args }); return signImpl(args); } },
      'sui:signAndExecuteTransaction': { signAndExecuteTransaction() { assert.fail('Daily Growth must never submit a transaction'); } },
    },
  };
  const client = createGrowthWalletClient({ get: () => [standardWallet], on() { return () => {}; } });
  return {
    client, calls,
    setConnect(impl) { connectImpl = impl; }, setSign(impl) { signImpl = impl; },
    changeAccount(address) {
      standardWallet.accounts = address ? [{ ...account, address }] : [];
      onChange?.({ accounts: standardWallet.accounts });
    },
  };
}

test('actual wallet adapter initial subscriptions and silent restore preserve the exact saved session', async (t) => {
  const wallet = realWalletFixture();
  const h = await harness(t, { wallet: wallet.client, savedSession: {
    version: 1, wallet: ACCOUNT, token: 'saved-session-token', walletId: 'Test wallet', walletName: 'Test wallet', expiresAt: new Date(NOW + 3600000).toISOString(),
  } });
  assert.equal(h.root.dataset.growthState, 'authenticated');
  assert.equal(h.byId('visit-count').textContent, '0');
  assert.deepEqual(wallet.calls, [{ type: 'connect', options: { silent: true } }]);
  assert.equal(h.count('challenge'), 0);
  assert.equal(h.count('session'), 0);
  assert.equal(h.count('sync'), 1);
  assert.equal(JSON.parse(h.window.sessionStorage.getItem(SESSION_KEY)).wallet, ACCOUNT);
});

test('actual wallet connection and signature rejection leave no Daily Growth authorization', async (t) => {
  const wallet = realWalletFixture();
  wallet.setConnect(async () => { throw new Error('Connection cancelled by user'); });
  const h = await harness(t, { wallet: wallet.client });
  h.byId('connect').click();
  h.byId('wallet-options').querySelector('button').click();
  await settleUntil(() => h.root.dataset.growthState === 'signed-out', 'cancelled wallet connection');
  assert.equal(h.count('challenge'), 0);
  assert.equal(h.byId('visit-count').textContent, '—');
  wallet.setConnect(async () => ({ accounts: [{ address: ACCOUNT, chains: ['sui:mainnet'] }] }));
  h.byId('wallet-options').querySelector('button').click();
  await settleUntil(() => h.root.dataset.growthState === 'connected', 'successful wallet connection');
  wallet.setSign(async () => { throw new Error('User rejected the signature request'); });
  await h.controller.signIn();
  assert.equal(h.count('session'), 0);
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  assert.match(h.byId('status').textContent, /Sign-in was cancelled/);
  assert.equal(h.byId('sign-in').disabled, false);
});

test('actual wallet account invalidation discards an in-flight signature and later API progress', async (t) => {
  const wallet = realWalletFixture();
  const signature = deferred();
  wallet.setSign(() => signature.promise);
  const h = await harness(t, { wallet: wallet.client });
  await h.connect();
  const signingIn = h.controller.signIn();
  await settleUntil(() => wallet.calls.some((call) => call.type === 'signature'), 'real adapter sign prompt');
  wallet.changeAccount(OTHER_ACCOUNT);
  signature.resolve({ signature: 'stale-signature' });
  await signingIn;
  assert.equal(h.count('session'), 0);
  assert.equal(h.root.dataset.growthState, 'signed-out');
  assert.equal(h.byId('visit-count').textContent, '—');
  wallet.setSign(async () => ({ signature: 'fresh-signature' }));
  await h.connect();
  await h.controller.signIn();
  const pending = deferred();
  h.handlers.sync = () => pending.promise;
  const refreshing = h.controller.refresh();
  wallet.changeAccount(OTHER_ACCOUNT);
  assert.equal(h.byId('visit-count').textContent, '—');
  pending.resolve(h.envelope());
  await refreshing;
  assert.equal(h.root.dataset.growthState, 'signed-out');
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
});

test('TREE FORCE is a required Passport game with first-wave and direct-holder wording; Garden completion rules remain', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ enabledGames: FORCE_GAMES }) });
  assert.equal(h.byId('game-name').textContent, 'TREE FORCE ’89');
  assert.equal(h.byId('game-select').options.length, 4);
  assert.equal(h.byId('play').href, 'https://tree-token.xyz/play/treeforce89/');
  assert.match(h.byId('quest-rule').textContent, /Start one run of TREE FORCE ’89, or finish an eligible Garden Battle/);
  assert.match(h.byId('objective').textContent, /first wave.*do not need to win or finish/);
  assert.match(h.byId('game-access').textContent, /held directly.*Kiosk-held NFTrees are not supported/);
  assert.match(h.byId('quest-note').textContent, /saved when your first wave starts/);
  assert.equal(h.byId('quest-note').textContent.includes('refresh before 00:00'), false, 'Already recorded first-wave credit does not depend on a lobby refresh deadline');
  assert.equal(h.root.textContent.includes('tracking is coming soon'), false);
  assert.match(h.byId('tracking-note').textContent, /part of this month’s Arcade Passport.*first wave/);
  assert.equal(h.byId('tracking-note').textContent.includes('optional'), false);
  assert.equal(h.byId('visit-count').textContent, '—');
  h.byId('game-select').value = 'garden-bot';
  h.byId('game-select').dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.match(h.byId('objective').textContent, /Finish one official battle/);
  assert.match(h.byId('quest-note').textContent, /Complete the game and refresh before 00:00 UTC/);
  h.byId('game-select').value = 'arborist-trials';
  h.byId('game-select').dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.match(h.byId('objective').textContent, /Finish an official Trial and save the result/);
  assert.match(h.byId('game-access').textContent, /Unsaved practice does not count/);
});

test('opening TREE FORCE grants nothing; a server-recorded first wave counts one quest and a main Passport stamp', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ enabledGames: FORCE_GAMES }) });
  await h.signIn();
  const before = h.calls.length;
  h.byId('play').addEventListener('click', (event) => event.preventDefault());
  h.byId('play').click();
  assert.equal(h.calls.length, before);
  assert.equal(h.byId('visit-count').textContent, '0');
  assert.equal(h.byId('quest-state').textContent, '0 / 1 · Not completed');
  assert.equal(h.byId('passport-count').textContent, '0 / 4 required games');
  assert.equal(h.byId('stamps').children.length, 4);
  assert.match(h.byId('stamps').textContent, /TREE FORCE ’89.*Start a run · Reach the first wave/);
  assert.equal(h.byId('passport-optional').hidden, true);
  assert.equal(h.byId('optional-stamps').children.length, 0);
  h.setProgress(progress({ visits: [12], quests: [12], enabledGames: FORCE_GAMES, stamps: ['treeforce89'], gameIdsByDay: { 12: ['treeforce89'] } }));
  h.handlers.sync = ({ envelope }) => ({ ...envelope(), sync: { games: [{ gameId: 'treeforce89', status: 'recorded', message: 'First wave participation is saved.' }], checkedAt: new Date(NOW).toISOString() } });
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('quest-state').textContent, '1 / 1 · Quest complete ✓');
  assert.equal(h.byId('check-in').textContent, 'Checked in ✓');
  assert.equal(h.byId('passport-count').textContent, '1 / 4 required games');
  assertMeter(h, 'passport-meter', 1, 4);
  assert.match(h.byId('stamps').textContent, /TREE FORCE ’89.*First wave started · Stamp earned/);
  assert.equal(h.byId('stamps').querySelectorAll('.is-done').length, 1);
  assert.equal(h.byId('passport-optional').hidden, true);
  assert.match(h.byId('quest-note').textContent, /TREE FORCE ’89 counts toward this month’s Arcade Passport/);
  assert.equal(h.byId('passport-reward').textContent.includes('Optional stamps'), false);
  assert.equal(h.byId('badges').children.length, 0);
  assert.equal(h.byId('status').classList.contains('is-error'), false, 'recorded participation is a successful source state');
  assert.match(h.byId('status').textContent, /Daily quest complete/);
  assert.equal(h.count('check-in'), 0, 'Attendance arrived from the server event, not a client check-in write');
  assert.deepEqual(h.calls.filter((call) => call.action === 'sync').map((call) => call.body), [{}, {}]);
  await h.controller.refresh();
  assert.equal(h.byId('month-quests').textContent, '1');
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('passport-count').textContent, '1 / 4 required games');
});

test('TREE FORCE joins the three Garden stamps to complete the four-game Passport', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({
    visits: [1, 12], quests: [1, 12], enabledGames: FORCE_GAMES, stamps: GAMES.map((game) => game.id),
    gameIdsByDay: { 1: GAMES.map((game) => game.id), 12: ['garden-bot'] },
  }) });
  assert.equal(h.byId('visit-count').textContent, '—');
  await h.signIn();
  assert.equal(h.byId('quest-state').textContent, '1 / 1 · Quest complete ✓');
  assert.equal(h.byId('passport-count').textContent, '3 / 4 required games');
  assertMeter(h, 'passport-meter', 3, 4);
  assert.equal(h.byId('passport-reward').textContent.includes('badge earned'), false);
  assert.equal(h.byId('badges').children.length, 0);
  h.setProgress(progress({
    visits: [1, 12], quests: [1, 12], enabledGames: FORCE_GAMES, stamps: FORCE_GAMES.map((game) => game.id),
    gameIdsByDay: { 1: GAMES.map((game) => game.id), 12: ['treeforce89'] },
    badges: [{ id: 'arcade-passport', label: 'Arcade Passport', monthKey: '2026-11', earnedAt: new Date(NOW).toISOString() }],
  }));
  await h.controller.refresh();
  assert.equal(h.byId('passport-count').textContent, '4 / 4 required games');
  assertMeter(h, 'passport-meter', 4, 4);
  assert.equal(h.byId('stamps').querySelectorAll('.is-done').length, 4);
  assert.match(h.byId('passport-reward').textContent, /Monthly Arcade Passport badge earned/);
  assert.match(h.byId('stamps').textContent, /First wave started · Stamp earned/);
  assert.equal(h.byId('passport-optional').hidden, true);
  assert.equal(h.byId('badges').children.length, 1);
  assert.equal(h.byId('calendar').querySelector('[aria-current="date"]').getAttribute('aria-label').includes('daily quest complete'), true);
  assert.equal(h.count('check-in'), 0);
});

test('TREE FORCE participation remains saved when Garden source refresh is unavailable', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ visits: [12], quests: [12], enabledGames: FORCE_GAMES, stamps: ['garden-bot'] }) });
  await h.signIn();
  h.setProgress(progress({ visits: [12], quests: [12], enabledGames: FORCE_GAMES, stamps: ['garden-bot', 'treeforce89'], gameIdsByDay: { 12: ['garden-bot', 'treeforce89'] } }));
  h.handlers.sync = ({ envelope }) => ({ ...envelope(), sync: { games: [
    { gameId: 'treeforce89', status: 'recorded' }, { gameId: 'pvp', status: 'unavailable' },
  ], checkedAt: new Date(NOW).toISOString() } });
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('month-quests').textContent, '1');
  assert.equal(h.byId('passport-count').textContent, '2 / 4 required games');
  assert.match(h.byId('stamps').textContent, /First wave started · Stamp earned/);
  assert.equal(h.byId('passport-optional').hidden, true);
  assert.match(h.byId('status').textContent, /PvP Battle verification is unavailable/);
  assert.equal(h.byId('status').textContent.includes('TREE FORCE ’89 verification is unavailable'), false);
});

test('historic October keeps its three-game Passport and optional TREE FORCE stamp without imposing November requirements', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({
    dateKey: '2026-10-31', visits: [1, 31], quests: [1, 31], stamps: GAMES.map((game) => game.id),
    optionalGames: [FORCE_GAME], optionalStamps: ['treeforce89'],
    gameIdsByDay: { 1: GAMES.map((game) => game.id), 31: ['treeforce89'] },
    badges: [{ id: 'arcade-passport', label: 'Arcade Passport', monthKey: '2026-10', earnedAt: '2026-10-01T12:00:00Z' }],
  }) });
  assert.match(h.byId('tracking-note').textContent, /part of this month’s Arcade Passport/, 'Before sign-in, the public current configuration supplies the rule');
  await h.signIn();
  assert.equal(h.byId('passport-count').textContent, '3 / 3 required games');
  assertMeter(h, 'passport-meter', 3, 3);
  assert.equal(h.byId('stamps').children.length, 3);
  assert.equal(h.byId('stamps').textContent.includes('TREE FORCE'), false);
  assert.equal(h.byId('passport-optional').hidden, false);
  assert.match(h.byId('optional-stamps').textContent, /TREE FORCE ’89.*First wave started · Optional stamp/);
  assert.match(h.byId('tracking-note').textContent, /optional participation stamp/);
  assert.match(h.byId('quest-note').textContent, /optional for this month’s Passport/);
  assert.match(h.byId('passport-note').textContent, /October 2026.*Collect all 3 game stamps/);
  assert.match(h.byId('passport-reward').textContent, /Monthly Arcade Passport badge earned/);
  assert.equal(h.byId('badges').children.length, 1);
  assert.equal(h.count('check-in'), 0);
});

test('an incomplete four-game Passport cannot claim earned completion from an inconsistent response', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ enabledGames: FORCE_GAMES, stamps: GAMES.map((game) => game.id) }) });
  await h.signIn();
  h.handlers.sync = ({ envelope }) => {
    const payload = envelope();
    return { ...payload, progress: { ...payload.progress, passport: { ...payload.progress.passport, complete: true } } };
  };
  await h.controller.refresh();
  assert.equal(h.byId('passport-count').textContent, '3 / 4 required games');
  assert.equal(h.byId('passport-reward').textContent.includes('badge earned'), false);
  assert.equal(h.byId('badges').children.length, 0);
  assert.match(h.byId('status').textContent, /incomplete progress/);
});

test('a historic optional TREE FORCE stamp cannot enter required progress through an inconsistent response', async (t) => {
  const h = await harness(t, { configuration: HISTORIC_FORCE_CONFIGURATION, progress: progress({ dateKey: '2026-10-31', optionalGames: [FORCE_GAME] }) });
  await h.signIn();
  h.handlers.sync = ({ envelope }) => {
    const payload = envelope();
    return { ...payload, progress: { ...payload.progress, passport: { ...payload.progress.passport, completedGameIds: ['treeforce89'], complete: true } } };
  };
  await h.controller.refresh();
  assert.equal(h.byId('passport-count').textContent, '0 / 3 required games');
  assert.equal(h.byId('stamps').querySelectorAll('.is-done').length, 0);
  assert.equal(h.byId('badges').children.length, 0);
  assert.match(h.byId('status').textContent, /incomplete progress/);
});
