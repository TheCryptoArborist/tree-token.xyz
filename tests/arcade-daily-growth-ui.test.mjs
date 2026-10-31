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
const FORCE_CONFIGURATION = {
  enabledGames: GAMES.map((game) => ({ ...game, creditRule: 'complete-result' })),
  eligibleGames: [...GAMES.map((game) => ({ ...game, creditRule: 'complete-result' })), FORCE_GAME],
  todayPick: FORCE_GAME,
};
const MILESTONES = [
  { id: 'seedling', label: 'Seedling', target: 3 },
  { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 },
  { id: 'full-canopy', label: 'Full Canopy', target: 21 },
];
const deferred = () => {
  let resolvePromise;
  let reject;
  const promise = new Promise((done, fail) => { resolvePromise = done; reject = fail; });
  return { promise, resolve: resolvePromise, reject };
};

function progress({ wallet = ACCOUNT, dateKey = '2026-11-12', visits = [], quests = [], stamps = [], badges = [], optionalGames = [], optionalStamps = [], gameIdsByDay = {} } = {}) {
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
    passport: { monthKey, enabledGames: GAMES, completedGameIds: stamps, optionalGames, optionalCompletedGameIds: optionalStamps, complete: stamps.length === GAMES.length },
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

async function harness(t, options = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM(html, { url: 'https://tree-token.xyz/play/', runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  const root = window.document.getElementById('arcade-daily-growth');
  const byId = (id) => window.document.getElementById(`growth-${id}`);
  const calls = [];
  let clock = options.now || NOW;
  let walletState = options.connected ? { connected: true, address: ACCOUNT, walletName: 'Test wallet' } : { connected: false, address: null, walletName: null };
  const walletListeners = new Set();
  let sign = options.sign || (async () => ({ signature: 'test-personal-message-signature' }));
  const changeWallet = (address) => {
    walletState = address ? { connected: true, address, walletName: 'Test wallet' } : { connected: false, address: null, walletName: null };
    for (const listener of walletListeners) listener(walletState);
  };
  const wallet = {
    getWalletState: () => walletState,
    getAvailableWallets: () => [{ id: 'Test wallet', name: 'Test wallet' }],
    async connectWallet(id) { calls.push({ type: 'connect', id }); changeWallet(ACCOUNT); return walletState; },
    async restoreWallet({ id, address }) { calls.push({ type: 'restore', id, address }); if (options.allowRestore) changeWallet(address); return walletState; },
    async disconnectWallet() { calls.push({ type: 'disconnect' }); changeWallet(null); },
    async signPersonalMessage({ message }) {
      calls.push({ type: 'signature', message: new TextDecoder().decode(message) });
      return sign();
    },
    subscribeWalletState(listener) { walletListeners.add(listener); queueMicrotask(() => listener(walletState)); return () => walletListeners.delete(listener); },
    subscribeWallets() { return () => {}; },
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
  };
}

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
  assert.match(h.byId('tracking-note').textContent, /TREE FORCE ’89 is live; Daily Growth tracking is coming soon/);
  assert.match(h.byId('quest-note').textContent, /refresh before 00:00 UTC.*quest and passport stamps/);
});

test('connecting requires a separate message sign-in and uses only a wallet-bound server session', async (t) => {
  const h = await harness(t);
  await h.connect();
  assert.equal(h.calls.filter((call) => call.type === 'signature').length, 0);
  assert.equal(h.byId('sign-in').hidden, false);
  await h.controller.signIn();
  assert.equal(h.root.dataset.growthState, 'authenticated');
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
  assert.equal(h.byId('check-in').textContent, 'Checked in today ✓');
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
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.byId('refresh').textContent, 'Retry availability');
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
  h.handlers['check-in'] = () => ({ status: 'error', error: 'service-unavailable', message: 'Try again later.' });
  await h.controller.checkIn();
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
  h.changeWallet(OTHER_ACCOUNT);
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('stamps').children.length, 0);
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  pending.resolve(h.envelope());
  await refresh;
  assert.equal(h.root.dataset.growthState, 'connected');
  assert.equal(h.byId('visit-count').textContent, '—');
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
  assert.equal(h.calls.filter((call) => call.type === 'restore').length, 1);
  assert.equal(h.calls.filter((call) => call.type === 'connect' || call.type === 'signature').length, 0);
  assert.equal(h.calls.find((call) => call.action === 'status').headers.Authorization, 'Bearer saved-session-token');
  h.setClock(NOW + 3600001);
  h.window.dispatchEvent(new h.window.Event('focus'));
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
});

test('explicit sign-out drops the token and private data even when the logout endpoint fails', async (t) => {
  const h = await harness(t, { progress: progress({ visits: [1] }) });
  await h.signIn();
  h.handlers.logout = () => ({ status: 'error', error: 'service-unavailable', message: 'Unavailable' });
  await h.controller.signOut();
  assert.equal(h.byId('visit-count').textContent, '—');
  assert.equal(h.byId('calendar').children.length, 0);
  assert.equal(h.window.sessionStorage.getItem(SESSION_KEY), null);
  assert.equal(h.count('logout'), 1);
  assert.match(h.byId('status').textContent, /Signed out/);
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

test('TREE FORCE is an optional daily choice with first-wave and direct-holder wording; Garden completion rules remain', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ optionalGames: [FORCE_GAME] }) });
  assert.equal(h.byId('game-name').textContent, 'TREE FORCE ’89');
  assert.equal(h.byId('game-select').options.length, 4);
  assert.equal(h.byId('play').href, 'https://tree-token.xyz/play/treeforce89/');
  assert.match(h.byId('quest-rule').textContent, /Start one run of TREE FORCE ’89, or finish an eligible Garden Battle/);
  assert.match(h.byId('objective').textContent, /first wave.*do not need to win or finish/);
  assert.match(h.byId('game-access').textContent, /held directly.*Kiosk-held NFTrees are not supported/);
  assert.match(h.byId('quest-note').textContent, /saved when your first wave starts/);
  assert.equal(h.byId('quest-note').textContent.includes('refresh before 00:00'), false, 'Already recorded first-wave credit does not depend on a lobby refresh deadline');
  assert.equal(h.root.textContent.includes('tracking is coming soon'), false);
  assert.match(h.byId('tracking-note').textContent, /optional participation stamp/);
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

test('opening TREE FORCE grants nothing; a server-recorded first wave counts one quest and optional stamp without a required stamp', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ optionalGames: [FORCE_GAME] }) });
  await h.signIn();
  const before = h.calls.length;
  h.byId('play').addEventListener('click', (event) => event.preventDefault());
  h.byId('play').click();
  assert.equal(h.calls.length, before);
  assert.equal(h.byId('visit-count').textContent, '0');
  assert.equal(h.byId('quest-state').textContent, '0 / 1 · Not completed');
  assert.equal(h.byId('passport-count').textContent, '0 / 3 required games');
  assert.equal(h.byId('stamps').children.length, 3);
  assert.equal(h.byId('optional-stamps').children.length, 1);
  assert.equal(h.byId('optional-stamps').querySelector('.is-done'), null);
  h.setProgress(progress({ visits: [12], quests: [12], optionalGames: [FORCE_GAME], optionalStamps: ['treeforce89'], gameIdsByDay: { 12: ['treeforce89'] } }));
  h.handlers.sync = ({ envelope }) => ({ ...envelope(), sync: { games: [{ gameId: 'treeforce89', status: 'recorded', message: 'First wave participation is saved.' }], checkedAt: new Date(NOW).toISOString() } });
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('quest-state').textContent, '1 / 1 · Quest complete ✓');
  assert.equal(h.byId('check-in').textContent, 'Checked in today ✓');
  assert.equal(h.byId('passport-count').textContent, '0 / 3 required games');
  assert.match(h.byId('optional-stamps').textContent, /First wave started · Optional stamp/);
  assert.equal(h.byId('optional-stamps').querySelectorAll('.is-done').length, 1);
  assert.equal(h.byId('stamps').querySelectorAll('.is-done').length, 0);
  assert.equal(h.byId('badges').children.length, 0);
  assert.equal(h.byId('status').classList.contains('is-error'), false, 'recorded participation is a successful source state');
  assert.match(h.byId('status').textContent, /Daily quest complete/);
  assert.equal(h.count('check-in'), 0, 'Attendance arrived from the server event, not a client check-in write');
  assert.deepEqual(h.calls.filter((call) => call.action === 'sync').map((call) => call.body), [{}, {}]);
  await h.controller.refresh();
  assert.equal(h.byId('month-quests').textContent, '1');
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('passport-count').textContent, '0 / 3 required games');
});

test('pre-recorded first-wave progress is visible after sign-in while the three-game Passport badge remains complete', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({
    visits: [1, 12], quests: [1, 12], stamps: GAMES.map((game) => game.id),
    optionalGames: [FORCE_GAME], optionalStamps: ['treeforce89'],
    gameIdsByDay: { 1: GAMES.map((game) => game.id), 12: ['treeforce89'] },
    badges: [{ id: 'arcade-passport', label: 'Arcade Passport', monthKey: '2026-11', earnedAt: '2026-11-01T12:00:00Z' }],
  }) });
  assert.equal(h.byId('visit-count').textContent, '—');
  await h.signIn();
  assert.equal(h.byId('quest-state').textContent, '1 / 1 · Quest complete ✓');
  assert.equal(h.byId('passport-count').textContent, '3 / 3 required games');
  assert.match(h.byId('passport-reward').textContent, /Monthly Arcade Passport badge earned/);
  assert.match(h.byId('optional-stamps').textContent, /First wave started/);
  assert.equal(h.byId('badges').children.length, 1);
  assert.equal(h.byId('calendar').querySelector('[aria-current="date"]').getAttribute('aria-label').includes('daily quest complete'), true);
  assert.equal(h.count('check-in'), 0);
});

test('TREE FORCE participation remains saved when Garden source refresh is unavailable', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ visits: [12], quests: [12], stamps: ['garden-bot'], optionalGames: [FORCE_GAME] }) });
  await h.signIn();
  h.setProgress(progress({ visits: [12], quests: [12], stamps: ['garden-bot'], optionalGames: [FORCE_GAME], optionalStamps: ['treeforce89'], gameIdsByDay: { 12: ['garden-bot', 'treeforce89'] } }));
  h.handlers.sync = ({ envelope }) => ({ ...envelope(), sync: { games: [
    { gameId: 'treeforce89', status: 'recorded' }, { gameId: 'pvp', status: 'unavailable' },
  ], checkedAt: new Date(NOW).toISOString() } });
  await h.controller.refresh();
  assert.equal(h.byId('visit-count').textContent, '1');
  assert.equal(h.byId('month-quests').textContent, '1');
  assert.equal(h.byId('passport-count').textContent, '1 / 3 required games');
  assert.match(h.byId('optional-stamps').textContent, /First wave started/);
  assert.match(h.byId('status').textContent, /PvP Battle verification is unavailable/);
  assert.equal(h.byId('status').textContent.includes('TREE FORCE ’89 verification is unavailable'), false);
});

test('an optional TREE FORCE stamp cannot enter required progress through an inconsistent response', async (t) => {
  const h = await harness(t, { configuration: FORCE_CONFIGURATION, progress: progress({ optionalGames: [FORCE_GAME] }) });
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
