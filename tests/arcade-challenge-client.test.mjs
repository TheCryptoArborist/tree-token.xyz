import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createPilotClient } from '../scripts/arcade-challenge-client.mjs';
import { createServiceFixture, ORIGIN, RAW_TOKEN, WALLET } from './fixtures/arcade-challenge-pilot/service-fixture.mjs';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
};
async function scenario(run, options = {}) {
  const fixture = await createServiceFixture(options.fixtureOptions);
  const storage = memoryStorage(), requests = [], clients = [];
  let hook = null;
  const session = { version: 1, token: RAW_TOKEN, wallet: WALLET, expiresAt: fixture.session.expiresAt, walletId: 'fixture-wallet', walletName: 'Local test wallet' };
  async function transport(url, init) {
    assert.equal(new URL(url, ORIGIN).pathname, '/api/arcade-challenge-pilot', 'Core never calls attendance, payment or sign-in endpoints.');
    const action = new URL(url, ORIGIN).searchParams.get('action');
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ action, body });
    const perform = () => fixture.handler(new Request(ORIGIN + url, { ...init, headers: { ...init.headers, Origin: ORIGIN, 'sec-fetch-site': 'same-origin' } }));
    return hook ? hook({ action, body, perform, signal: init.signal }) : perform();
  }
  function client(overrides = {}) {
    const result = createPilotClient({ pilotId: fixture.rules.pilotId, storage, fetchImpl: transport, cryptoImpl: webcrypto, ...overrides });
    clients.push(result); return result;
  }
  try { await run({ fixture, session, storage, requests, client, setHook: value => { hook = value; } }); }
  finally { clients.forEach(value => value.destroy()); await fixture.close(); }
}

test('client restores an existing session, starts deliberately, and accepts only the actual computed win', () => scenario(async ({ client, session, fixture, requests }) => {
  const c = client(); await c.setSession(session);
  assert.equal(c.getState().phase, 'ready'); assert.equal(c.getState().canStart, true);
  assert.equal(await fixture.count('attempts'), 0);
  await c.start(); assert.equal(c.getState().phase, 'playing'); assert.equal(c.getState().attempt.view.cards.length, 4);
  for (const id of [19, 27, 19]) await c.move(id);
  const state = c.getState(); assert.equal(state.phase, 'finished'); assert.equal(state.attempt.result.score, 16375); assert.equal(state.attempt.result.ruleTargetMet, true);
  assert.equal(state.attempt.payable, false); assert.equal(state.attempt.prizeEligible, false); assert.equal(state.attempt.awardsEnabled, false);
  assert.equal(await fixture.count('requests'), 3);
  assert.equal(requests.filter(row => row.action === 'start').length, 1);
  await c.move(27); assert.equal(await fixture.count('requests'), 3, 'Finished UI cannot submit another move.');
}));

test('reload restores the same attempt and session storage never duplicates the bearer session token', () => scenario(async ({ client, session, storage, fixture }) => {
  const first = client(); await first.setSession(session); await first.start(); await first.move(19);
  const saved = storage.getItem('tree-arcade:challenge-pilot:v1:' + fixture.rules.pilotId);
  assert.equal(saved.includes(RAW_TOKEN), false); assert.match(JSON.parse(saved).sessionBinding, /^[a-f0-9]{64}$/);
  first.destroy();
  const restored = client(); await restored.setSession(session);
  assert.equal(restored.getState().phase, 'playing'); assert.equal(restored.getState().attempt.version, 1);
  assert.equal(await fixture.count('attempts'), 1);
  await restored.move(27); await restored.move(19); assert.equal(restored.getState().phase, 'finished');
}));

test('lost committed response survives reload with exactly the same move UUID and one database action', () => scenario(async ({ client, session, fixture, requests, setHook }) => {
  const first = client(); await first.setSession(session); await first.start();
  let dropped = false;
  setHook(async ({ action, perform }) => { const response = await perform(); if (action === 'move' && !dropped) { dropped = true; throw new TypeError('Lost response after commit.'); } return response; });
  await first.move(19);
  assert.equal(first.getState().phase, 'pending'); assert.equal(first.getState().retryable, true); assert.equal(first.getState().canStart, false);
  assert.equal(await fixture.count('requests'), 1);
  await first.move(27); assert.equal(requests.filter(row => row.action === 'move').length, 1);
  first.destroy(); const restored = client(); await restored.setSession(session);
  assert.equal(restored.getState().phase, 'playing'); assert.equal(restored.getState().attempt.version, 1);
  assert.equal(await fixture.count('requests'), 1);
  const moves = requests.filter(row => row.action === 'move'); assert.equal(moves.length, 2); assert.deepEqual(moves[1].body, moves[0].body);
}));

test('a temporary failure before commit preserves and retries the original request', () => scenario(async ({ client, session, requests, setHook, fixture }) => {
  const c = client(); await c.setSession(session); await c.start();
  let failed = false;
  setHook(({ action, perform }) => { if (action === 'move' && !failed) { failed = true; return new Response(JSON.stringify({ status: 'error', error: 'service-unavailable', message: 'Local outage' }), { status: 503 }); } return perform(); });
  await c.move(19); assert.equal(c.getState().phase, 'pending'); assert.equal(await fixture.count('requests'), 0);
  await c.retry(); assert.equal(c.getState().phase, 'playing'); assert.equal(await fixture.count('requests'), 1);
  const moves = requests.filter(row => row.action === 'move'); assert.deepEqual(moves[0].body, moves[1].body);
}));

test('same-wallet new session cannot reuse the old attempt and requires an explicit fresh start', () => scenario(async ({ client, session, fixture, storage }) => {
  const c = client(); await c.setSession(session); await c.start(); await c.move(19);
  const key = 'tree-arcade:challenge-pilot:v1:' + fixture.rules.pilotId, prior = storage.getItem(key);
  const next = await fixture.addSession({ rawToken: 'c'.repeat(64) });
  await c.setSession({ ...session, token: next.rawToken, expiresAt: next.expiresAt });
  assert.equal(c.getState().phase, 'session-changed'); assert.equal(c.getState().attempt, null); assert.equal(c.getState().canStart, true);
  assert.equal(storage.getItem(key), prior, 'Old attempt is retained until an explicit new start.');
  await c.move(27); assert.equal(await fixture.count('requests'), 1);
  await c.start(); assert.equal(c.getState().phase, 'playing'); assert.equal(c.getState().attempt.version, 0); assert.equal(await fixture.count('attempts'), 2);
}));

test('storage failure before dispatch blocks a new move without advancing the database', () => scenario(async ({ client, session, fixture, storage }) => {
  const c = client(); await c.setSession(session); await c.start();
  storage.setItem = () => { throw Error('Storage unavailable'); };
  await c.move(19);
  assert.equal(c.getState().storageAvailable, false); assert.equal(await fixture.count('requests'), 0); assert.equal(c.getState().canStart, false);
}));

test('unsupported prize flags fail closed instead of presenting a funded result', () => scenario(async ({ client, session, setHook, fixture }) => {
  setHook(async ({ action, perform }) => {
    const response = await perform(); if (action !== 'configuration') return response;
    const value = await response.json(); value.payable = true;
    return new Response(JSON.stringify(value), { status: 200 });
  });
  const c = client(); await c.setSession(session);
  assert.equal(c.getState().phase, 'error'); assert.equal(c.getState().canStart, false); await c.start(); assert.equal(await fixture.count('attempts'), 0);
}));

test('server time anchors the timer even with a client clock two minutes behind', () => scenario(async ({ client, session, fixture }) => {
  const c = client({ now: () => Date.now() - 120000 }); await c.setSession(session); await c.start();
  const state = c.getState();
  assert.ok(state.remainingSeconds <= fixture.rules.maxAttemptSeconds && state.remainingSeconds >= fixture.rules.maxAttemptSeconds - 3, 'Countdown follows the database clock.');
}));

test('stale tab receives authoritative current state after a version conflict', () => scenario(async ({ client, session, fixture }) => {
  const a = client(); await a.setSession(session); await a.start();
  const b = client(); await b.setSession(session); assert.equal(b.getState().attempt.version, 0);
  await a.move(19); await b.move(27);
  assert.equal(b.getState().retryable, false); assert.equal(b.getState().attempt.version, 1); assert.equal(b.getState().phase, 'playing');
  assert.equal(await fixture.count('requests'), 1);
  assert.match(b.getState().notice, /Another tab/);
}));

test('revoked session cannot retry or advance the match and does not erase shared authentication storage', () => scenario(async ({ client, session, fixture, storage }) => {
  const c = client(); await c.setSession(session); await c.start();
  const key = 'tree-arcade:challenge-pilot:v1:' + fixture.rules.pilotId, prior = storage.getItem(key);
  await fixture.db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp() where token_sha256=$1', [fixture.session.tokenHash]);
  await c.refresh(); assert.equal(c.getState().phase, 'signed-out'); assert.equal(c.getState().session, null);
  assert.equal(storage.getItem(key), prior); await c.move(19); assert.equal(await fixture.count('requests'), 0);
}));

test('disabling a pilot closes an active match after the authoritative rejection', () => scenario(async ({ client, session, fixture }) => {
  const c = client(); await c.setSession(session); await c.start();
  await fixture.db.query("update private.arcade_challenge_pilot_configs set status='disabled' where pilot_id=$1", [fixture.rules.pilotId]);
  await c.move(19);
  assert.equal(c.getState().phase, 'closed'); assert.equal(c.getState().configuration.pilotOpen, false);
  assert.equal(c.getState().retryable, false); assert.equal(c.getState().canStart, false);
  assert.equal(await fixture.count('requests'), 0);
  await c.move(27); assert.equal(await fixture.count('requests'), 0);
}));
