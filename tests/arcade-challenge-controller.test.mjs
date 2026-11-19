import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createChallengeApp, PILOT_SESSION_KEY, validatePilotAuthChallenge } from '../scripts/arcade-challenge.mjs';
import { createServiceFixture, ORIGIN, RAW_TOKEN, WALLET, hash } from './fixtures/arcade-challenge-pilot/service-fixture.mjs';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const HTML = fs.readFileSync(new URL('../production/arcade-challenge-static/index.html', import.meta.url), 'utf8');
const ARCADE_KEY = 'tree-arcade:daily-growth:session:v1';
const OTHER_WALLET = '0x' + '2'.repeat(64);
const delay = () => new Promise(resolve => setTimeout(resolve, 10));
const sessionValue = value => ({ version: 1, token: value.rawToken, wallet: value.wallet, origin: value.origin, expiresAt: value.expiresAt, sessionScope: value.sessionScope || 'arcade', walletId: 'fixture-wallet', walletName: 'Local test wallet' });

async function scenario(run, options = {}) {
  const issuedMessages = new Set();
  const fixture = await createServiceFixture({ handlerDependencies: {
    verifyPersonalMessage: async ({ message, signature, wallet }) => [WALLET, OTHER_WALLET].includes(wallet) && signature === 'LOCAL_FIXTURE_SIGNATURE' && issuedMessages.has(message),
  } });
  const dom = new JSDOM(HTML, { url: ORIGIN + '/play/challenge/?pilot=' + fixture.rules.pilotId, pretendToBeVisual: true });
  const view = dom.window;
  Object.defineProperty(view, 'crypto', { value: webcrypto });
  let state = { connected: options.connected !== false, address: options.connected === false ? null : WALLET, walletId: options.connected === false ? null : 'fixture-wallet', walletName: 'Local test wallet' };
  const subscribers = new Set(), requests = [], signatures = [];
  let responseHook = null, signHook = null;
  const changeWallet = wallet => { state = { ...state, connected: Boolean(wallet), address: wallet, walletId: wallet ? 'fixture-wallet' : null }; subscribers.forEach(fn => fn({ ...state })); };
  const bridge = {
    getWalletState: () => ({ ...state }),
    getAvailableWallets: () => [{ id: 'fixture-wallet', name: 'Local test wallet' }],
    subscribeWalletState: fn => { subscribers.add(fn); return () => subscribers.delete(fn); },
    subscribeWallets: () => () => {},
    connectWallet: async () => { changeWallet(WALLET); return { ...state }; },
    restoreWallet: async ({ address }) => { changeWallet(address); return { ...state }; },
    signPersonalMessage: async ({ message }) => {
      signatures.push(new TextDecoder().decode(message));
      await signHook?.();
      return { signature: 'LOCAL_FIXTURE_SIGNATURE' };
    },
  };
  async function transport(url, init) {
    const parsed = new URL(url, ORIGIN);
    assert.equal(parsed.pathname, '/api/arcade-challenge-pilot', 'The pilot must never request Arcade authentication, attendance or payments.');
    const action = parsed.searchParams.get('action');
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ action, body, authorization: init.headers.Authorization });
    let response = await fixture.handler(new Request(parsed.href, { ...init, headers: { ...init.headers, Origin: ORIGIN, 'sec-fetch-site': 'same-origin' } }));
    if (action === 'auth-challenge' && response.ok) issuedMessages.add((await response.clone().json()).challenge.message);
    if (responseHook) response = await responseHook({ action, body, response });
    return response;
  }
  let app;
  try {
    await options.before?.({ fixture, view });
    app = createChallengeApp({ root: view.document.querySelector('#arcade-challenge'), fetchImpl: transport, loadWallet: async () => bridge });
    await app.ready;
    await run({ app, fixture, view, requests, signatures, changeWallet, setResponseHook: value => { responseHook = value; }, setSignHook: value => { signHook = value; } });
  } finally { app?.destroy(); view.close(); await fixture.close(); }
}

test('new free pilot sign-in is explicit, isolated from Arcade storage, and grants no automatic game action', () => scenario(async ({ app, fixture, view, requests, signatures }) => {
  assert.equal(app.client.getState().phase, 'signed-out');
  assert.equal(requests.length, 0); assert.equal(signatures.length, 0);
  const before = [view.localStorage.getItem(ARCADE_KEY), view.sessionStorage.getItem(ARCADE_KEY)];
  await app.signIn();
  assert.equal(signatures.length, 1);
  assert.deepEqual(requests.map(row => row.action), ['auth-challenge', 'auth-session', 'configuration']);
  assert.equal(app.client.getState().phase, 'ready');
  assert.equal(app.client.getState().session.sessionScope, 'challenge-pilot');
  assert.equal(await fixture.count('attempts'), 0);
  const saved = JSON.parse(view.sessionStorage.getItem(PILOT_SESSION_KEY));
  assert.match(saved.token, /^pilot_[a-f0-9]{64}$/);
  assert.equal(saved.sessionScope, 'challenge-pilot'); assert.equal(saved.origin, ORIGIN);
  assert.deepEqual([view.localStorage.getItem(ARCADE_KEY), view.sessionStorage.getItem(ARCADE_KEY)], before);
  assert.equal((await fixture.db.query('select count(*)::int as n from private.arcade_growth_sessions')).rows[0].n, 1, 'The existing Arcade session table receives no new session.');
  assert.equal((await fixture.db.query('select count(*)::int as n from private.arcade_challenge_pilot_sessions')).rows[0].n, 1);
  assert.match(view.document.querySelector('#challenge-session-note').textContent, /Free pilot sign-in active/);
}, { before: ({ view }) => { view.localStorage.setItem(ARCADE_KEY, 'preserve-unrelated-local-value'); view.sessionStorage.setItem(ARCADE_KEY, 'preserve-unrelated-tab-value'); } }));

test('existing same-wallet Arcade authentication remains read-only and can play without a new signature', () => scenario(async ({ app, fixture, view, requests, signatures }) => {
  assert.equal(app.client.getState().phase, 'ready'); assert.equal(app.client.getState().session.sessionScope, 'arcade');
  const before = view.localStorage.getItem(ARCADE_KEY);
  await app.client.start(); await app.client.move(19);
  assert.equal(app.client.getState().attempt.version, 1); assert.equal(signatures.length, 0);
  assert.equal(requests.some(row => row.action.startsWith('auth-')), false);
  assert.equal(view.localStorage.getItem(ARCADE_KEY), before); assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), null);
  assert.equal((await fixture.db.query('select count(*)::int as n from private.arcade_challenge_pilot_sessions')).rows[0].n, 0);
}, { before: ({ fixture, view }) => view.localStorage.setItem(ARCADE_KEY, JSON.stringify(sessionValue(fixture.session))) }));

test('a saved attempt selects its original Arcade session when a separate valid pilot session also exists', () => scenario(async ({ app, requests, signatures }) => {
  assert.equal(app.client.getState().phase, 'playing');
  assert.equal(app.client.getState().session.sessionScope, 'arcade');
  assert.equal(requests.every(row => row.authorization === 'Bearer ' + RAW_TOKEN), true);
  assert.equal(signatures.length, 0);
}, { before: async ({ fixture, view }) => {
  const started = await fixture.start(); assert.equal(started.status, 200);
  view.localStorage.setItem(ARCADE_KEY, JSON.stringify(sessionValue(fixture.session)));
  view.sessionStorage.setItem(PILOT_SESSION_KEY, JSON.stringify(sessionValue(await fixture.addPilotSession())));
  const value = started.body;
  view.sessionStorage.setItem('tree-arcade:challenge-pilot:v1:' + fixture.rules.pilotId, JSON.stringify({ schemaVersion: 1, pilotId: fixture.rules.pilotId, wallet: WALLET, sessionBinding: hash(RAW_TOKEN), attemptToken: value.attemptToken, attemptId: value.attemptId, challenge: value.challenge, pending: null }));
} }));

test('revoked pilot authentication is renewed explicitly without erasing shared Arcade data or the old attempt', () => scenario(async ({ app, fixture, view, requests, signatures }) => {
  await app.signIn(); await app.client.start(); await app.client.move(19);
  const saved = JSON.parse(view.sessionStorage.getItem(PILOT_SESSION_KEY));
  const key = 'tree-arcade:challenge-pilot:v1:' + fixture.rules.pilotId;
  const attempt = view.sessionStorage.getItem(key);
  await fixture.db.query('update private.arcade_challenge_pilot_sessions set revoked_at=clock_timestamp() where token_sha256=$1', [hash(saved.token)]);
  await app.client.refresh();
  assert.equal(app.client.getState().phase, 'signed-out'); assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), null);
  assert.equal(view.localStorage.getItem(ARCADE_KEY), 'keep-original-Arcade-data');
  assert.equal(view.sessionStorage.getItem(key), attempt);
  await app.signIn();
  assert.equal(app.client.getState().phase, 'session-changed'); assert.equal(signatures.length, 2);
  assert.equal(requests.filter(row => row.action === 'start').length, 1);
  assert.equal(view.sessionStorage.getItem(key), attempt);
  await app.client.start(); assert.equal(await fixture.count('attempts'), 2);
}, { before: ({ view }) => view.localStorage.setItem(ARCADE_KEY, 'keep-original-Arcade-data') }));

test('wallet switching suspends a match and switching back resumes its original free pilot session', () => scenario(async ({ app, fixture, view, signatures, changeWallet }) => {
  await app.signIn(); await app.client.start(); await app.client.move(19);
  const originalSession = view.sessionStorage.getItem(PILOT_SESSION_KEY);
  changeWallet(OTHER_WALLET);
  for (let i = 0; i < 100 && app.client.getState().session; i++) await delay();
  assert.equal(app.client.getState().session, null); assert.equal(app.client.getState().canStart, false);
  changeWallet(WALLET); await app.restore();
  for (let i = 0; i < 100 && app.client.getState().phase !== 'playing'; i++) await delay();
  assert.equal(app.client.getState().phase, 'playing'); assert.equal(app.client.getState().attempt.version, 1);
  assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), originalSession);
  assert.equal(signatures.length, 1); assert.equal(await fixture.count('attempts'), 1);
}));

test('wallet switch during signature never submits a session request for the previous wallet', () => scenario(async ({ app, fixture, view, requests, changeWallet, setSignHook }) => {
  setSignHook(() => changeWallet(OTHER_WALLET));
  await app.signIn();
  assert.deepEqual(requests.map(row => row.action), ['auth-challenge']);
  assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), null);
  assert.equal(await fixture.count('attempts'), 0);
}));

test('wallet switch during asynchronous restoration cannot leave the previous wallet authorized in the UI', () => scenario(async ({ app, fixture, view, changeWallet, setResponseHook }) => {
  await app.signIn(); await app.client.start();
  view.sessionStorage.setItem(PILOT_SESSION_KEY, JSON.stringify(sessionValue(await fixture.addPilotSession())));
  setResponseHook(({ action, response }) => { if (action === 'configuration') changeWallet(OTHER_WALLET); return response; });
  await app.restore();
  assert.equal(app.client.getState().session, null); assert.equal(app.client.getState().canStart, false);
  await app.client.move(19);
  assert.equal(await fixture.count('requests'), 0);
}));

test('wallet switch after issuance revokes only the unretained pilot token', () => scenario(async ({ app, fixture, view, requests, changeWallet, setResponseHook }) => {
  setResponseHook(({ action, response }) => { if (action === 'auth-session') changeWallet(OTHER_WALLET); return response; });
  await app.signIn();
  assert.deepEqual(requests.map(row => row.action), ['auth-challenge', 'auth-session', 'auth-logout']);
  assert.match(requests.at(-1).authorization, /^Bearer pilot_[a-f0-9]{64}$/);
  assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), null);
  assert.deepEqual((await fixture.db.query('select revoked_at is not null as revoked from private.arcade_challenge_pilot_sessions')).rows, [{ revoked: true }]);
  assert.equal((await fixture.db.query('select revoked_at from private.arcade_growth_sessions')).rows[0].revoked_at, null);
}));

test('a wrong-origin auth challenge is rejected before the wallet can sign it', () => scenario(async ({ app, requests, signatures, view, setResponseHook }) => {
  setResponseHook(async ({ action, response }) => {
    if (action !== 'auth-challenge') return response;
    const value = await response.json(); value.challenge.origin = 'https://wrong-origin.example';
    return Response.json(value);
  });
  await app.signIn();
  assert.equal(signatures.length, 0); assert.deepEqual(requests.map(row => row.action), ['auth-challenge']);
  assert.equal(app.client.getState().session, null); assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), null);
  assert.match(view.document.querySelector('#challenge-notice').textContent, /incomplete|no longer valid/);
}));

test('pilot challenge validation binds wallet, page origin, scope and short expiry before signing', () => {
  const now = Date.now();
  const challenge = { challengeId: '11111111-1111-4111-8111-111111111111', wallet: WALLET, origin: ORIGIN, sessionScope: 'challenge-pilot', expiresAt: new Date(now + 240000).toISOString(), message: 'Free pilot fixture message.' };
  assert.equal(validatePilotAuthChallenge(challenge, { wallet: WALLET, origin: ORIGIN, now }), challenge);
  for (const patch of [{ wallet: OTHER_WALLET }, { origin: 'https://www.tree-token.xyz' }, { sessionScope: 'arcade' }, { challengeId: 'not-an-issued-nonce' }, { expiresAt: new Date(now).toISOString() }, { expiresAt: new Date(now + 3600000).toISOString() }, { message: '' }]) {
    assert.throws(() => validatePilotAuthChallenge({ ...challenge, ...patch }, { wallet: WALLET, origin: ORIGIN, now }), /incomplete|valid/);
  }
});

test('unpersistable newly issued authentication is revoked without touching Arcade storage', () => scenario(async ({ app, fixture, view, requests }) => {
  const originalSet = view.Storage.prototype.setItem;
  view.Storage.prototype.setItem = function (key, value) {
    if (key === PILOT_SESSION_KEY) throw new view.DOMException('Storage blocked for fixture.', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
  await app.signIn();
  assert.deepEqual(requests.map(row => row.action), ['auth-challenge', 'auth-session', 'auth-logout']);
  assert.equal(app.client.getState().session, null);
  assert.equal(view.sessionStorage.getItem(PILOT_SESSION_KEY), null);
  assert.equal(view.localStorage.getItem(ARCADE_KEY), 'untouched-shared-value');
  assert.deepEqual((await fixture.db.query('select revoked_at is not null as revoked from private.arcade_challenge_pilot_sessions')).rows, [{ revoked: true }]);
  assert.equal(await fixture.count('attempts'), 0);
}, { before: ({ view }) => view.localStorage.setItem(ARCADE_KEY, 'untouched-shared-value') }));
