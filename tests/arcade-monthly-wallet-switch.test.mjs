import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMonthlyPanel } from '../scripts/arcade-monthly.js';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM
  || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const HTML = fs.readFileSync(new URL('../production/arcade-organization-static/index.html', import.meta.url), 'utf8');
const SESSION = 'tree-arcade:daily-growth:session:v1';
const PENDING = 'tree-arcade:recovery:pending:v1';
const A = `0x${'a'.repeat(64)}`;
const B = `0x${'b'.repeat(64)}`;
const tokens = new Map([['1'.repeat(64), A], ['2'.repeat(64), B]]);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function until(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await settle(); }
  assert.ok(predicate(), message || 'The expected monthly state was not reached');
}
function sessionFor(wallet) {
  return { wallet, token: wallet === A ? '1'.repeat(64) : '2'.repeat(64), walletId: 'Test Slush',
    expiresAt: new Date(Date.now() + 600_000).toISOString() };
}
function progressFor(wallet) {
  return { wallet, attendance: { streak: wallet === A ? 7 : 2, missedDates: ['2026-11-01'] },
    monthlyReward: { requiredQuestDays: 20, verifiedQuestDays: wallet === A ? 5 : 1,
      qualified: false, todayQualified: false } };
}
function pendingFor(wallet = A, digest = null) {
  return { wallet, intentId: '11111111-1111-4111-8111-111111111111', dateKey: '2026-11-01', digest,
    expiresAt: new Date(Date.now() + 600_000).toISOString(), seasonEndsAt: '2026-12-01T00:00:00Z' };
}
function fixture({ pending, loadPayment = async () => { throw Error('A payment was not expected'); } } = {}) {
  const dom = new JSDOM(HTML, { url: 'https://tree-token.xyz/play/' });
  const view = dom.window, doc = view.document, root = doc.getElementById('arcade-daily-growth');
  let wallet = A;
  const calls = [], heldStatuses = new Map();
  view.localStorage.setItem(SESSION, JSON.stringify(sessionFor(A)));
  if (pending) view.sessionStorage.setItem(PENDING, JSON.stringify(pending));
  const app = createMonthlyPanel({ root,
    loadBridge: async () => ({ getWalletState: () => wallet
      ? { connected: true, address: wallet, walletId: 'Test Slush' } : { connected: false } }),
    loadPayment,
    fetchImpl: async (url, options) => {
      const action = new URL(url, 'https://tree-token.xyz').searchParams.get('action');
      const token = new Headers(options.headers).get('Authorization')?.replace(/^Bearer /, '');
      const owner = tokens.get(token);
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ action, wallet: owner, body, signal: options.signal });
      assert.ok(owner, 'Every monthly request must use a captured, valid fixture identity');
      if (action === 'status') {
        const held = heldStatuses.get(owner);
        if (held) { heldStatuses.delete(owner); await held.promise; }
        // Deliberately return even after abort to prove obsolete results cannot render.
        return Response.json({ status: 'ok', progress: progressFor(owner) });
      }
      if (action === 'intent') return Response.json({ status: 'ok', intent: { ...pendingFor(owner), id: pendingFor(owner).intentId } });
      if (action === 'verify') return Response.json({ status: 'ok', progress: progressFor(owner) });
      throw Error(`Unexpected monthly action: ${action}`);
    },
  });
  return { view, doc, root, app, calls,
    holdStatus(owner) { const gate = deferred(); heldStatuses.set(owner, gate); return gate; },
    switchTo(next) {
      wallet = next;
      if (next) view.localStorage.setItem(SESSION, JSON.stringify(sessionFor(next)));
      else { view.localStorage.removeItem(SESSION); view.sessionStorage.removeItem(SESSION); }
      root.dataset.growthState = next ? 'authenticated' : 'signed-out';
      root.dispatchEvent(new view.CustomEvent('arcade-progress', { detail: { sessionActive: Boolean(next) } }));
    },
    savedPending() { return JSON.parse(view.sessionStorage.getItem(PENDING) || 'null'); },
    close() { app.destroy(); view.close(); },
  };
}
const shownStreak = x => x.doc.getElementById('monthly-streak').textContent;
const shownCount = x => x.doc.getElementById('monthly-count').textContent;
function assertSignedOut(x) {
  assert.equal(x.doc.getElementById('arcade-monthly-panel').dataset.state, 'signed-out');
  assert.equal(shownStreak(x), '—');
  assert.equal(shownCount(x), '— / 20');
  assert.equal(x.doc.getElementById('monthly-recovery-controls').hidden, true);
  assert.equal(x.doc.getElementById('monthly-refresh').disabled, true);
}

test('sign-out clears monthly identity immediately while status is pending and ignores its late response', async () => {
  const x = fixture(); let gate;
  try {
    await until(() => shownStreak(x) === '7 days');
    gate = x.holdStatus(A);
    const before = x.calls.length;
    const refreshing = x.app.refresh();
    await until(() => x.calls.length > before);
    x.switchTo(null);
    assertSignedOut(x);
    gate.resolve(); await refreshing; await settle();
    assertSignedOut(x);
    assert.equal(x.calls.filter(call => call.action !== 'status').length, 0);
  } finally { gate?.resolve(); x.close(); }
});

test('wallet B loads its own progress before an obsolete wallet A status response returns', async () => {
  const x = fixture(); let gate;
  try {
    await until(() => shownStreak(x) === '7 days');
    gate = x.holdStatus(A);
    const before = x.calls.length;
    const oldRefresh = x.app.refresh();
    await until(() => x.calls.length > before);
    x.switchTo(B);
    assert.equal(shownStreak(x), '—', 'A’s progress disappears synchronously');
    await until(() => shownStreak(x) === '2 days');
    assert.equal(shownCount(x), '1 / 20');
    gate.resolve(); await oldRefresh; await settle();
    assert.equal(shownStreak(x), '2 days');
    assert.equal(shownCount(x), '1 / 20');
    assert.equal(x.calls.at(-1).wallet, B);
  } finally { gate?.resolve(); x.close(); }
});

test('a saved recovery checkout stays with its wallet across sign-out and wallet switching', async () => {
  const saved = pendingFor(A, '3'.repeat(44));
  const x = fixture({ pending: saved });
  try {
    await until(() => shownStreak(x) === '7 days');
    assert.equal(x.doc.getElementById('monthly-digest').value, saved.digest);
    x.switchTo(null); assertSignedOut(x);
    assert.deepEqual(x.savedPending(), saved, 'Signing out does not lose payment reconciliation data');
    x.switchTo(B); await until(() => shownStreak(x) === '2 days');
    assert.equal(x.doc.getElementById('monthly-retry').hidden, true);
    assert.equal(x.doc.getElementById('monthly-pay').disabled, true, 'A new wallet must not overwrite a saved recovery checkout');
    assert.match(x.doc.getElementById('monthly-status').textContent, /another wallet\. Switch back to that wallet to verify or clear it/);
    assert.equal(x.doc.getElementById('monthly-digest').value, '');
    x.doc.getElementById('monthly-pay').click();
    await settle();
    assert.deepEqual(x.savedPending(), saved);
    x.switchTo(A); await until(() => shownStreak(x) === '7 days');
    assert.equal(x.doc.getElementById('monthly-retry').hidden, false);
    assert.equal(x.doc.getElementById('monthly-digest').value, saved.digest);
    assert.equal(x.calls.filter(call => call.action !== 'status').length, 0);
  } finally { x.close(); }
});

test('reconciling the original checkout releases the guard for another wallet’s recovery', async () => {
  const x = fixture({ pending: pendingFor(A, '6'.repeat(44)) });
  try {
    await until(() => shownStreak(x) === '7 days');
    x.switchTo(B); await until(() => shownStreak(x) === '2 days');
    assert.equal(x.doc.getElementById('monthly-pay').disabled, true);
    x.switchTo(A); await until(() => shownStreak(x) === '7 days');
    x.doc.getElementById('monthly-retry').click();
    await until(() => x.savedPending() === null);
    assert.deepEqual(x.calls.filter(call => call.action === 'verify').map(call => call.wallet), [A]);
    x.switchTo(B); await until(() => shownStreak(x) === '2 days');
    assert.equal(x.doc.getElementById('monthly-pay').disabled, false);
    assert.equal(x.calls.filter(call => call.action === 'intent').length, 0);
  } finally { x.close(); }
});

test('switching wallets while the recovery module loads prevents opening the old payment request', async () => {
  const moduleGate = deferred(); let opened = 0, loading = false;
  const x = fixture({ loadPayment: async () => { loading = true; await moduleGate.promise;
    return { payForRecovery: async () => { opened++; return '4'.repeat(44); } }; } });
  try {
    await until(() => shownStreak(x) === '7 days');
    x.doc.getElementById('monthly-pay').click();
    await until(() => loading);
    x.switchTo(B);
    assert.equal(shownStreak(x), '—');
    moduleGate.resolve();
    await until(() => shownStreak(x) === '2 days');
    assert.equal(opened, 0);
    assert.equal(x.savedPending().wallet, A, 'The prepared original checkout remains reconcilable');
    assert.equal(x.savedPending().digest, null);
    assert.equal(x.calls.filter(call => call.action === 'verify').length, 0);
  } finally { moduleGate.resolve(); x.close(); }
});

test('a payment result arriving after a switch keeps its original-wallet digest without crediting B', async () => {
  const paymentGate = deferred(); let opened = 0;
  const digest = '5'.repeat(44);
  const x = fixture({ loadPayment: async () => ({ payForRecovery: async (_intent, owner) => {
    assert.equal(owner.wallet, A); opened++; return paymentGate.promise;
  } }) });
  try {
    await until(() => shownStreak(x) === '7 days');
    x.doc.getElementById('monthly-pay').click();
    await until(() => opened === 1);
    x.switchTo(B); assert.equal(shownStreak(x), '—');
    paymentGate.resolve(digest);
    await until(() => shownStreak(x) === '2 days');
    assert.equal(x.savedPending().wallet, A);
    assert.equal(x.savedPending().digest, digest);
    assert.equal(x.doc.getElementById('monthly-retry').hidden, true);
    assert.equal(shownCount(x), '1 / 20');
    assert.equal(x.calls.filter(call => call.action === 'verify').length, 0);
    assert.equal(opened, 1, 'No extra payment is requested');
  } finally { paymentGate.resolve(digest); x.close(); }
});
