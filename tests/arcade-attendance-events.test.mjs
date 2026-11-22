import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMonthlyPanel } from '../scripts/arcade-monthly.js';
import { mountAttendanceForest } from '../scripts/arcade-attendance-forest.js';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM
  || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const HTML = fs.readFileSync(new URL('../production/arcade-organization-static/index.html', import.meta.url), 'utf8');
const SESSION = 'tree-arcade:daily-growth:session:v1';
const PENDING = 'tree-arcade:recovery:pending:v1';
const A = `0x${'a'.repeat(64)}`, B = `0x${'b'.repeat(64)}`;
const TOKENS = new Map([[A, '1'.repeat(64)], [B, '2'.repeat(64)]]);
const DAY = '2026-11-25', DATE = 'Wed, 25 Nov 2026 12:00:00 GMT';
const DIGEST = '3'.repeat(44);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function until(predicate, message = 'Expected attendance state was not reached') {
  for (let count = 0; count < 100; count++) { if (predicate()) return; await settle(); }
  assert.ok(predicate(), message);
}
const dateFor = day => `2026-11-${String(day).padStart(2, '0')}`;
function progressFor(wallet = A, recovered = false) {
  const checked = new Set(wallet === A ? [19, 21, 22, 24, ...(recovered ? [23] : [])] : [22, 25]);
  return { wallet, dateKey: DAY, monthKey: '2026-11', attendance: {
    streak: wallet === A && recovered ? 4 : 1, checkedInDays: checked.size,
    missedDates: Array.from({ length: 24 }, (_, index) => index + 1).filter(day => !checked.has(day)).map(dateFor),
    recoveredDates: recovered ? [dateFor(23)] : [],
  }, monthlyReward: { requiredQuestDays: 20, verifiedQuestDays: 1, qualified: false,
    qualifyingDates: [dateFor(22)], todayQualified: false, ruleVersion: 'verified-quest-days-v1' } };
}
function savedCheckout(wallet = A) {
  return { wallet, intentId: '11111111-1111-4111-8111-111111111111', dateKey: dateFor(23),
    digest: DIGEST, expiresAt: new Date(Date.now() + 600_000).toISOString(), seasonEndsAt: '2026-12-01T00:00:00.000Z' };
}
function json(payload, { date = DATE, status = 200 } = {}) {
  return Response.json(payload, { status, headers: date === null ? {} : { Date: date } });
}
async function fixture({ wallet = A, pending, reply, loadPayment } = {}) {
  const dom = new JSDOM(HTML, { url: 'https://tree-token.xyz/play/', pretendToBeVisual: true });
  const view = dom.window, doc = view.document, root = doc.getElementById('arcade-daily-growth');
  // Mount after JSDOM's initial navigation, so each test controls later refreshes.
  await new Promise(resolve => view.addEventListener('pageshow', resolve, { once: true }));
  const events = [], recoveries = [], calls = [];
  let selectedWallet = wallet, tabClicks = 0;
  function saveIdentity(owner) {
    if (owner) view.localStorage.setItem(SESSION, JSON.stringify({ version: 1, wallet: owner,
      token: TOKENS.get(owner), walletId: 'Test Slush', expiresAt: new Date(Date.now() + 600_000).toISOString() }));
    else { view.localStorage.removeItem(SESSION); view.sessionStorage.removeItem(SESSION); }
  }
  saveIdentity(wallet);
  if (pending) view.sessionStorage.setItem(PENDING, JSON.stringify(pending));
  root.addEventListener('arcade-attendance-state', event => events.push(event.detail));
  root.addEventListener('arcade-attendance-recovered', event => recoveries.push(event.detail));
  doc.getElementById('growth-month-tab').addEventListener('click', () => { tabClicks++; });
  const app = createMonthlyPanel({ root,
    loadBridge: async () => ({ getWalletState: () => selectedWallet
      ? { connected: true, address: selectedWallet, walletId: 'Test Slush' } : { connected: false } }),
    loadPayment: loadPayment || (async () => { throw Error('No payment was expected'); }),
    fetchImpl: async (url, options) => {
      const action = new URL(url, 'https://tree-token.xyz').searchParams.get('action');
      const token = new Headers(options.headers).get('Authorization')?.replace(/^Bearer /, '');
      const owner = [...TOKENS].find(([, value]) => value === token)?.[0];
      assert.ok(owner, 'The request must remain bound to a valid captured identity');
      const call = { action, owner, method: options.method, body: options.body ? JSON.parse(options.body) : null };
      calls.push(call);
      const response = await reply?.(call);
      if (response) return response;
      assert.equal(action, 'status', 'Only explicit test recovery actions may write');
      return json({ status: 'ok', progress: progressFor(owner) });
    },
  });
  return { view, doc, root, app, events, recoveries, calls,
    state: () => events.at(-1),
    tabClicks: () => tabClicks,
    saved: () => JSON.parse(view.sessionStorage.getItem(PENDING) || 'null'),
    dispatch(name, detail) { root.dispatchEvent(new view.CustomEvent(name, { detail })); },
    switchTo(owner) {
      selectedWallet = owner; saveIdentity(owner);
      root.dataset.growthState = owner ? 'authenticated' : 'signed-out';
      root.dispatchEvent(new view.CustomEvent('arcade-progress', { detail: { sessionActive: Boolean(owner) } }));
    },
    close() { app.destroy(); view.close(); },
  };
}
const ready = x => until(() => x.state()?.fresh);
function assertNoPrivateIdentity(x) {
  const details = JSON.stringify([...x.events, ...x.recoveries]);
  for (const token of TOKENS.values()) assert.equal(details.includes(token), false, 'Presentation events must never contain bearer tokens');
  assert.doesNotMatch(details, /"(?:token|authorization|expiresAt)"/i);
}

test('accepted attendance carries its response clock and public identity without exposing the login', async () => {
  const before = Date.now(), x = await fixture();
  try {
    await ready(x);
    const state = x.state();
    assert.equal(state.wallet, A); assert.equal(state.sessionActive, true);
    assert.deepEqual(state.progress, progressFor(A));
    assert.equal(state.loading, false); assert.equal(state.error, null);
    assert.equal(state.clock.serverTime, Date.parse(DATE));
    assert.ok(state.clock.observedAt >= before && state.clock.observedAt <= Date.now());
    assert.ok(state.clock.monotonicAt >= 0 && state.clock.monotonicAt <= x.view.performance.now());
    assert.ok(x.events.some(event => event.loading && !event.fresh));
    assertNoPrivateIdentity(x);
  } finally { x.close(); }
});

for (const [label, date] of [['missing', null], ['invalid', 'not a date'],
  ['previous UTC day', 'Tue, 24 Nov 2026 23:59:59 GMT'], ['next UTC day', 'Thu, 26 Nov 2026 00:00:00 GMT']]) {
  test(`a ${label} HTTP Date cannot become the attendance clock`, async () => {
    const x = await fixture({ reply: () => json({ status: 'ok', progress: progressFor() }, { date }) });
    try { await ready(x); assert.equal(x.state().clock, null); assert.deepEqual(x.state().progress, progressFor()); }
    finally { x.close(); }
  });
}

test('legacy monthly snapshots remain available but have no invented dated clock', async () => {
  const progress = progressFor(); delete progress.dateKey; delete progress.monthKey;
  const x = await fixture({ reply: () => json({ status: 'ok', progress }) });
  try { await ready(x); assert.deepEqual(x.state().progress, progress); assert.equal(x.state().clock, null); }
  finally { x.close(); }
});

test('refresh events use one safe GET while pending and bind the clock only when progress is accepted', async () => {
  let hold = false; const gate = deferred();
  const x = await fixture({ reply: async () => { if (hold) { await gate.promise;
    return json({ status: 'ok', progress: progressFor(A, true) }, { date: 'Wed, 25 Nov 2026 13:00:00 GMT' }); } } });
  try {
    await ready(x); const originalClock = x.state().clock; hold = true;
    x.dispatch('arcade-attendance-refresh'); await until(() => x.calls.length === 2);
    x.dispatch('arcade-attendance-refresh'); x.dispatch('arcade-attendance-refresh');
    assert.equal(x.calls.length, 2); assert.equal(x.state().loading, true); assert.equal(x.state().fresh, false);
    assert.deepEqual(x.state().clock, originalClock);
    assert.deepEqual(x.calls.map(call => [call.action, call.method]), [['status', 'GET'], ['status', 'GET']]);
    gate.resolve(); await until(() => x.state().fresh && x.state().progress.attendance.streak === 4);
    assert.equal(x.state().clock.serverTime, Date.parse('2026-11-25T13:00:00Z'));
  } finally { gate.resolve(); x.close(); }
});

test('status failures emit unknown progress and a retry replaces the error with accepted state', async () => {
  let fail = false;
  const x = await fixture({ reply: () => fail ? json({ status: 'error', message: 'Attendance temporarily unavailable.' }, { status: 503 }) : undefined });
  try {
    await ready(x); fail = true; x.dispatch('arcade-attendance-refresh');
    await until(() => x.state().error);
    assert.equal(x.state().fresh, false); assert.equal(x.state().loading, false);
    assert.equal(x.state().progress, null); assert.equal(x.state().clock, null);
    assert.match(x.state().error, /temporarily unavailable/);
    fail = false; x.dispatch('arcade-attendance-refresh'); await ready(x);
    assert.equal(x.state().error, null); assert.equal(x.state().wallet, A);
  } finally { x.close(); }
});

test('sign-out clears presentation immediately and an obsolete status cannot republish the old wallet', async () => {
  const gate = deferred(); let hold = false;
  const x = await fixture({ reply: async () => { if (hold) await gate.promise; } });
  try {
    await ready(x); hold = true; x.dispatch('arcade-attendance-refresh');
    await until(() => x.calls.length === 2); x.switchTo(null);
    const cleared = x.state(), count = x.events.length;
    assert.equal(cleared.wallet, null); assert.equal(cleared.sessionActive, false);
    assert.equal(cleared.progress, null); assert.equal(cleared.clock, null); assert.equal(cleared.fresh, false);
    gate.resolve(); await settle(); await settle();
    assert.equal(x.events.slice(count).some(event => event.wallet === A || event.progress), false);
    assertNoPrivateIdentity(x);
  } finally { gate.resolve(); x.close(); }
});

test('a recovery receipt is emitted only after confirmation and keeps a stable deduplication identity', async () => {
  const gate = deferred(), checkout = savedCheckout();
  const receipt = { dateKey: checkout.dateKey, digest: DIGEST, price: '20000' };
  const x = await fixture({ pending: checkout, reply: async call => {
    if (call.action === 'verify') { await gate.promise; return json({ status: 'ok', progress: progressFor(A, true),
      receipt: { ...receipt, extra: 'not part of the presentation contract' } }, { date: 'Wed, 25 Nov 2026 13:00:00 GMT' }); }
  } });
  try {
    await ready(x); x.doc.getElementById('monthly-retry').click();
    await until(() => x.calls.some(call => call.action === 'verify'));
    x.doc.getElementById('monthly-digest-form').dispatchEvent(new x.view.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(x.recoveries.length, 0); assert.equal(x.state().loading, true); assert.equal(x.state().fresh, false);
    assert.ok(x.saved(), 'An unconfirmed checkout must remain saved');
    gate.resolve(); await until(() => x.recoveries.length === 1 && x.state().fresh);
    assert.deepEqual(x.recoveries[0], { wallet: A, progress: progressFor(A, true), receipt, clock: x.state().clock });
    assert.equal(x.recoveries[0].clock.serverTime, Date.parse('2026-11-25T13:00:00Z'));
    assert.equal(x.calls.filter(call => call.action === 'verify').length, 1);
    assert.equal(x.saved(), null); assertNoPrivateIdentity(x);
    const link = x.doc.querySelector('#monthly-status a[data-arcade-route="daily"]');
    assert.equal(link?.getAttribute('href'), '#daily'); assert.equal(link?.textContent, 'View your grove');
    assert.equal(x.view.location.hash, '', 'Confirmed recovery must not navigate without the user');
  } finally { gate.resolve(); x.close(); }
});

test('an enabled verification supersedes a slow status read so old attendance cannot restore the fire', async () => {
  const gate = deferred(), checkout = { ...savedCheckout(), dateKey: dateFor(24) };
  const before = { ...progressFor(A), attendance: {
    streak: 0, checkedInDays: 23, missedDates: [dateFor(24)], recoveredDates: [],
  } };
  const after = { ...before, attendance: {
    streak: 24, checkedInDays: 24, missedDates: [], recoveredDates: [dateFor(24)],
  } };
  let hold = false, held = false;
  const x = await fixture({ pending: checkout, reply: async call => {
    if (call.action === 'status') {
      if (hold) { held = true; await gate.promise; }
      return json({ status: 'ok', progress: before });
    }
    if (call.action === 'verify') return json({ status: 'ok', progress: after,
      receipt: { dateKey: checkout.dateKey, digest: DIGEST, price: '20000' } });
  } });
  const forest = mountAttendanceForest({ root: x.root });
  const card = () => x.root.querySelector('#arcade-attendance-forest');
  try {
    await ready(x); await settle(); await ready(x);
    assert.equal(card().dataset.forestState, 'paused');
    hold = true;
    const oldRead = x.app.refresh(); await until(() => held);
    assert.equal(x.state().loading, true);
    const retry = x.doc.getElementById('monthly-retry');
    assert.equal(retry.disabled, false, 'Verification remains reachable during a status read');
    retry.click(); await until(() => x.recoveries.length === 1);
    gate.resolve(); await oldRead; await ready(x);
    assert.deepEqual(x.state().progress, after);
    assert.equal(x.root.querySelector('[data-forest-count]').textContent, '24');
    assert.equal(x.root.querySelector('[data-forest-streak]').textContent, '24 days');
    assert.equal(card().dataset.forestState, 'growing');
    assert.equal(x.calls.filter(call => call.action === 'verify').length, 1);
    assert.equal(x.recoveries.length, 1); assert.equal(x.saved(), null);
  } finally { gate.resolve(); forest.destroy(); x.close(); }
});

for (const [label, receipt] of [
  ['missing', undefined], ['wrong date', { dateKey: dateFor(20), digest: DIGEST, price: '20000' }],
  ['wrong digest', { dateKey: dateFor(23), digest: '4'.repeat(44), price: '20000' }],
  ['wrong price', { dateKey: dateFor(23), digest: DIGEST, price: '1' }],
]) {
  test(`a ${label} receipt preserves the existing successful refresh event without authorizing rain`, async () => {
    const x = await fixture({ pending: savedCheckout(), reply: call => call.action === 'verify'
      ? json({ status: 'ok', progress: progressFor(A, true), receipt }) : undefined });
    try {
      await ready(x); x.doc.getElementById('monthly-retry').click();
      await until(() => x.recoveries.length === 1);
      assert.equal(x.recoveries[0].receipt, null); assert.equal(x.recoveries[0].wallet, A);
      assert.equal(x.saved(), null); assert.equal(x.recoveries[0].progress.attendance.streak, 4);
    } finally { x.close(); }
  });
}

test('failed verification retains the checkout and emits an error without a recovery celebration', async () => {
  const x = await fixture({ pending: savedCheckout(), reply: call => call.action === 'verify'
    ? json({ status: 'error', message: 'Payment confirmation is not ready yet.' }, { status: 409 }) : undefined });
  try {
    await ready(x); x.doc.getElementById('monthly-retry').click(); await until(() => x.state().error);
    assert.equal(x.recoveries.length, 0); assert.equal(x.saved().digest, DIGEST);
    assert.equal(x.state().loading, false); assert.equal(x.state().fresh, false);
    assert.equal(x.doc.querySelector('#monthly-status a'), null);
  } finally { x.close(); }
});

test('a confirmed response for wallet A cannot emit recovery after switching to B', async () => {
  const gate = deferred();
  const x = await fixture({ pending: savedCheckout(), reply: async call => {
    if (call.action === 'verify') { await gate.promise; return json({ status: 'ok', progress: progressFor(A, true),
      receipt: { dateKey: dateFor(23), digest: DIGEST, price: '20000' } }); }
  } });
  try {
    await ready(x); x.doc.getElementById('monthly-retry').click();
    await until(() => x.calls.some(call => call.action === 'verify')); x.switchTo(B);
    assert.equal(x.state().progress, null); assert.equal(x.state().clock, null);
    gate.resolve(); await until(() => x.state().fresh && x.state().wallet === B);
    assert.equal(x.recoveries.length, 0); assert.equal(x.saved().wallet, A); assert.equal(x.saved().digest, DIGEST);
    assert.deepEqual(x.state().progress, progressFor(B)); assertNoPrivateIdentity(x);
  } finally { gate.resolve(); x.close(); }
});

test('opening recovery routes to Monthly and focuses the requested or latest missed date without paying', async () => {
  const x = await fixture();
  try {
    await ready(x); const before = x.calls.length, selector = x.doc.getElementById('monthly-date');
    x.dispatch('arcade-open-attendance-recovery', { dateKey: dateFor(20) });
    assert.equal(x.tabClicks(), 1); assert.equal(x.doc.querySelector('.monthly-recovery').open, true);
    assert.equal(selector.value, dateFor(20)); assert.equal(x.doc.activeElement, selector);
    x.dispatch('arcade-open-attendance-recovery', { dateKey: '2026-12-01' });
    assert.equal(selector.value, dateFor(23), 'An unavailable request falls back to the latest existing missed date');
    await settle(); assert.equal(x.calls.length, before); assert.equal(x.saved(), null);
  } finally { x.close(); }
});

test('opening recovery with a pending checkout keeps its date and typed digest and focuses verification', async () => {
  const x = await fixture({ pending: savedCheckout() });
  try {
    await ready(x); const selector = x.doc.getElementById('monthly-date'); selector.value = dateFor(20);
    const input = x.doc.getElementById('monthly-digest'); input.value = '5'.repeat(44);
    x.dispatch('arcade-open-attendance-recovery', { dateKey: dateFor(23) });
    assert.equal(selector.value, dateFor(20)); assert.equal(input.value, '5'.repeat(44));
    assert.equal(x.doc.activeElement, x.doc.getElementById('monthly-retry'));
    assert.equal(x.saved().dateKey, dateFor(23)); assert.equal(x.saved().digest, DIGEST);
    assert.deepEqual(x.calls.map(call => call.action), ['status']);
  } finally { x.close(); }
});

test('destroy removes presentation controls and suppresses late status events', async () => {
  const gate = deferred(), x = await fixture({ reply: async () => { await gate.promise; } });
  try {
    await until(() => x.calls.length === 1); x.app.destroy();
    const emitted = x.events.length;
    x.dispatch('arcade-attendance-refresh'); x.dispatch('arcade-open-attendance-recovery');
    gate.resolve(); await settle(); await settle();
    assert.equal(x.events.length, emitted); assert.equal(x.calls.length, 1); assert.equal(x.tabClicks(), 0);
    assert.equal(x.doc.querySelector('.monthly-recovery').open, false); assert.equal(x.recoveries.length, 0);
  } finally { gate.resolve(); x.close(); }
});

test('destroy during confirmation retains the digest and emits no late recovery event', async () => {
  const gate = deferred();
  const x = await fixture({ pending: savedCheckout(), reply: async call => {
    if (call.action === 'verify') { await gate.promise; return json({ status: 'ok', progress: progressFor(A, true),
      receipt: { dateKey: dateFor(23), digest: DIGEST, price: '20000' } }); }
  } });
  try {
    await ready(x); x.doc.getElementById('monthly-retry').click();
    await until(() => x.calls.some(call => call.action === 'verify')); x.app.destroy();
    const emitted = x.events.length;
    gate.resolve(); await settle(); await settle();
    assert.equal(x.recoveries.length, 0); assert.equal(x.events.length, emitted);
    assert.equal(x.saved().digest, DIGEST, 'A completed request can be reconciled on the next visit');
  } finally { gate.resolve(); x.close(); }
});
