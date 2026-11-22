import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAttendance, attendanceCountdown, mountAttendanceForest } from '../scripts/arcade-attendance-forest.js';
const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const A = '0x' + 'a'.repeat(64), B = '0x' + 'b'.repeat(64), DAY = 86400000;
const settle = () => new Promise(r => setTimeout(r, 0));
function progress({ wallet = A, date = '2026-11-22', saved = [], recovered = [], streak = 0 } = {}) {
  const month = date.slice(0, 7), day = Number(date.slice(-2)), dates = saved.map(d => typeof d === 'number' ? month + '-' + String(d).padStart(2, '0') : d);
  const missedDates = Array.from({ length: day - 1 }, (_, i) => month + '-' + String(i + 1).padStart(2, '0')).filter(d => !dates.includes(d));
  return { wallet, dateKey: date, monthKey: month, attendance: { streak, checkedInDays: dates.length, missedDates,
    recoveredDates: recovered.map(d => typeof d === 'number' ? month + '-' + String(d).padStart(2, '0') : d) } };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function fixture() {
  const dom = new JSDOM('<div id="arcade-daily-growth" data-arcade-view="daily"><section id="growth-today-panel"><p id="growth-status"></p><h3>Today’s tasks</h3></section></div>', { url: 'https://tree-token.xyz/play/#daily' });
  const { window: view } = dom, root = view.document.getElementById('arcade-daily-growth');
  let time = 0, server = Date.parse('2026-11-22T12:00:00Z');
  const app = mountAttendanceForest({ root, now: () => time });
  const send = (name, detail) => root.dispatchEvent(new view.CustomEvent(name, { detail }));
  const state = (p, overrides = {}) => send('arcade-attendance-state', { wallet: p.wallet, sessionActive: true, progress: p, fresh: true, loading: false, error: null,
    clock: { serverTime: server, observedAt: Date.now(), monotonicAt: time }, ...overrides });
  return { view, root, app, send, state,
    el: key => root.querySelector('[data-forest-' + key + ']'),
    card: () => root.querySelector('#arcade-attendance-forest'),
    advance: ms => { time += ms; }, setServer: ms => { server = ms; },
    recover(p, date = '2026-11-21', digest = '7'.repeat(44)) {
      send('arcade-attendance-recovered', { wallet: p.wallet, progress: p, receipt: { dateKey: date, digest, price: '20000' },
        clock: { serverTime: server, observedAt: Date.now(), monotonicAt: time } });
    },
    close() { app.destroy(); view.close(); },
  };
}
test('monthly count and saved dates come from one authoritative snapshot, including recovered days', () => {
  const p = normalizeAttendance(progress({ saved: range(1, 21), recovered: [18], streak: 21 }));
  assert.equal(p.checkedInDays, 21); assert.equal(p.checkedDates.length, 21); assert.equal(p.todayChecked, false);
  assert.deepEqual(p.recoveredDates, ['2026-11-18']); assert.equal(p.streakExpiresAt, Date.parse('2026-11-23T00:00:00Z'));
});
test('the actual streak crosses a month boundary while the new monthly grove starts at zero', () => {
  const p = normalizeAttendance(progress({ date: '2026-12-01', saved: [], streak: 40 }));
  assert.equal(p.checkedInDays, 0); assert.equal(p.streak, 40); assert.equal(p.checkedDates.length, 0);
});
test('invalid dates, duplicates, contradictory totals, recovered dates, and impossible streaks are unavailable', () => {
  const good = progress({ saved: [20, 21], streak: 2 });
  for (const change of [
    p => { p.dateKey = '2026-11-31'; }, p => { p.monthKey = '2026-12'; },
    p => { p.attendance.checkedInDays = 8; }, p => { p.attendance.streak = 2.5; },
    p => { p.attendance.missedDates.push('2026-11-01'); }, p => { p.attendance.recoveredDates = ['2026-11-19']; },
    p => { p.attendance.streak = 10; }, p => { p.attendance.recoveredDates = ['2026-11-22']; },
  ]) { const p = structuredClone(good); change(p); assert.throws(() => normalizeAttendance(p)); }
});
test('the next midnight opens a new day after today is saved; streak expires a full day later', () => {
  const saved = normalizeAttendance(progress({ saved: range(1, 22), streak: 22 }));
  const t = attendanceCountdown(saved, Date.parse('2026-11-22T12:00:00Z'));
  assert.equal(t.remaining, 12 * 3600000); assert.equal(t.streakRemaining, 36 * 3600000);
  assert.match(t.label, /opens/); assert.equal(t.deadline, Date.parse('2026-11-24T00:00:00Z'));
  const due = normalizeAttendance(progress({ saved: range(1, 21), streak: 21 }));
  assert.equal(attendanceCountdown(due, Date.parse('2026-11-22T12:00:00Z')).streakRemaining, 12 * 3600000);
  assert.equal(attendanceCountdown(due, due.resetAt), null);
});
test('a newcomer with many missedDates has an empty grove, never a fire or invented lost history', () => {
  const x = fixture(); try {
    x.state(progress());
    assert.equal(x.card().dataset.forestState, 'empty'); assert.equal(x.el('count').textContent, '0');
    assert.equal(x.root.querySelectorAll('[data-forest-tree]').length, 0);
    assert.equal(x.root.querySelectorAll('[data-forest-embers]').length, 0);
  } finally { x.close(); }
});
test('November uses emblem artwork only for confirmed trees, with a smaller newly planted tree', () => {
  const x = fixture(); try {
    assert.equal(x.root.querySelectorAll('[data-forest-tree] image').length, 0);
    x.state(progress({ saved: [1, 20, 21, 22], recovered: [20], streak: 3 }));
    assert.equal(x.card().dataset.forestSeason, 'autumn');
    assert.equal(x.el('scene').dataset.forestSeason, 'autumn');
    const trees = [...x.root.querySelectorAll('[data-forest-tree]')];
    assert.deepEqual(trees.map(tree => tree.dataset.date), ['2026-11-01', '2026-11-20', '2026-11-21', '2026-11-22']);
    assert.equal(trees.length, Number(x.el('count').textContent));
    for (const tree of trees) assert.equal(tree.querySelector('image').getAttribute('href'), '/assets/arcade-seasonal/november-emblem-tree.png');
    assert.equal(trees.at(-1).dataset.forestStage, 'sapling');
    assert.ok(Number(trees.at(-1).querySelector('image').getAttribute('height')) < Number(trees[0].querySelector('image').getAttribute('height')));
    assert.match(trees[1].querySelector('title').textContent, /November 20 check-in restored/);
    assert.equal(x.root.querySelectorAll('[data-forest-leaf-litter]').length, 1);
    assert.equal(x.root.querySelectorAll('.forest-rain').length, 0);
  } finally { x.close(); }
});
test('the accepted attendance month controls autumn through refresh and clears it at December rollover or sign-out', () => {
  const x = fixture(); try {
    x.setServer(Date.parse('2026-11-30T12:00:00Z'));
    x.state(progress({ date: '2026-11-30', saved: [29, 30], streak: 2 }));
    assert.equal(x.card().dataset.forestSeason, 'autumn');
    x.advance(DAY);
    x.view.dispatchEvent(new x.view.Event('focus'));
    assert.equal(x.card().dataset.forestState, 'stale');
    assert.equal(x.card().dataset.forestSeason, 'autumn');
    assert.equal(x.root.querySelectorAll('[data-forest-tree] image').length, 2);
    x.setServer(Date.parse('2026-12-01T12:00:00Z'));
    x.state(progress({ date: '2026-12-01', saved: [], streak: 2 }));
    assert.equal(x.card().dataset.forestSeason, 'evergreen');
    assert.equal(x.el('scene').dataset.forestSeason, 'evergreen');
    assert.equal(x.root.querySelectorAll('[data-forest-tree] image, [data-forest-leaf-litter]').length, 0);
    assert.equal(x.el('streak').textContent, '2 days');
    x.setServer(Date.parse('2026-11-22T12:00:00Z'));
    x.state(progress({ wallet: B, saved: [21], streak: 1 }));
    assert.equal(x.card().dataset.forestSeason, 'autumn');
    x.send('arcade-progress', { sessionActive: false });
    assert.equal(x.card().dataset.forestSeason, 'evergreen');
    assert.equal(x.root.querySelectorAll('[data-forest-tree] image, [data-forest-leaf-litter]').length, 0);
  } finally { x.close(); }
});
test('a confirmed lapse preserves all saved trees and shows an ember patch', () => {
  const x = fixture(); try {
    x.state(progress({ saved: range(1, 20), streak: 0 }));
    assert.equal(x.card().dataset.forestState, 'paused'); assert.equal(x.root.querySelectorAll('[data-forest-tree]').length, 20);
    assert.equal(x.root.querySelectorAll('[data-forest-embers]').length, 1); assert.match(x.el('status').textContent, /saved check-ins are kept/);
  } finally { x.close(); }
});
test('one newly confirmed ordinary check-in plants exactly one new tree without replaying the initial forest', () => {
  const x = fixture(); try {
    x.state(progress({ saved: range(1, 21), streak: 21 })); assert.equal(x.card().dataset.forestAnimation, undefined);
    x.advance(100); x.state(progress({ saved: range(1, 22), streak: 22 }));
    assert.equal(x.root.querySelectorAll('[data-forest-tree]').length, 22);
    assert.equal(x.root.querySelectorAll('.forest-tree.is-planted').length, 1); assert.equal(x.card().dataset.forestAnimation, 'plant');
  } finally { x.close(); }
});
test('loading and errors never play recovery rain, and invalid progress cannot turn saved attendance into zero', () => {
  const x = fixture(); try {
    x.state(progress({ saved: [21], streak: 1 }));
    x.state(progress({ saved: [21], streak: 1 }), { loading: true, fresh: false });
    assert.equal(x.card().dataset.forestAnimation, undefined);
    x.state(progress({ saved: [21], streak: 1 }), { progress: null, error: 'offline', fresh: false });
    assert.equal(x.el('count').textContent, '1'); assert.equal(x.card().dataset.forestState, 'stale');
    assert.equal(x.root.querySelectorAll('[data-forest-embers]').length, 0);
  } finally { x.close(); }
});
test('verified recovery queues rain until Daily is visible, adds the correct tree, and is deduplicated', async () => {
  const x = fixture(); try {
    x.state(progress({ saved: range(1, 20), streak: 0 }));
    x.root.dataset.arcadeView = 'month'; await settle();
    const recovered = progress({ saved: range(1, 21), recovered: [21], streak: 21 });
    x.recover(recovered);
    assert.equal(x.card().dataset.forestAnimation, undefined);
    x.root.dataset.arcadeView = 'daily'; await settle();
    assert.equal(x.card().dataset.forestAnimation, 'rain');
    assert.equal(x.root.querySelectorAll('[data-forest-tree]').length, 21);
    assert.match(x.el('status').textContent, /November 21 check-in recovered/);
    await new Promise(r => setTimeout(r, 1750));
    x.recover(recovered); assert.equal(x.card().dataset.forestAnimation, undefined);
  } finally { x.close(); }
});
test('another wallet and missing or mismatched recovery evidence cannot trigger rain', () => {
  const x = fixture(); try {
    x.state(progress({ saved: range(1, 20), streak: 0 }));
    x.recover(progress({ wallet: B, saved: range(1, 21), recovered: [21], streak: 21 }));
    x.send('arcade-attendance-recovered', { wallet: A });
    x.recover(progress({ saved: range(1, 21), recovered: [], streak: 21 }));
    assert.equal(x.card().dataset.forestAnimation, undefined); assert.equal(x.el('count').textContent, '20');
  } finally { x.close(); }
});
test('a previous-month receipt can reconnect a streak without planting a tree in the new month', () => {
  const x = fixture(); try {
    x.setServer(Date.parse('2026-12-01T12:00:00Z'));
    x.state(progress({ date: '2026-12-01', saved: [], streak: 0 }));
    x.recover(progress({ date: '2026-12-01', saved: [], streak: 4 }), '2026-11-30');
    assert.equal(x.el('count').textContent, '0'); assert.equal(x.el('streak').textContent, '4 days');
    assert.equal(x.root.querySelectorAll('[data-forest-tree]').length, 0); assert.equal(x.card().dataset.forestAnimation, undefined);
  } finally { x.close(); }
});
test('reduced motion shows confirmed recovery immediately without rain animation', () => {
  const x = fixture(); try {
    x.view.matchMedia = () => ({ matches: true });
    x.state(progress({ saved: range(1, 20), streak: 0 }));
    x.recover(progress({ saved: range(1, 21), recovered: [21], streak: 21 }));
    assert.equal(x.card().dataset.forestAnimation, undefined); assert.equal(x.el('count').textContent, '21');
    assert.match(x.el('status').textContent, /recovered/);
  } finally { x.close(); }
});
test('UTC rollover requests fresh attendance before declaring a lost streak', async () => {
  const x = fixture(); try {
    x.setServer(Date.parse('2026-11-22T23:59:59Z'));
    x.state(progress({ saved: range(1, 21), streak: 21 })); await settle();
    let requests = 0; x.root.addEventListener('arcade-attendance-refresh', () => requests++);
    x.advance(2000); x.view.dispatchEvent(new x.view.Event('focus'));
    assert.ok(requests > 0); assert.equal(x.card().dataset.forestState, 'stale');
    assert.equal(x.root.querySelectorAll('[data-forest-embers]').length, 0);
    assert.match(x.el('timer').textContent, /Updating/);
    x.setServer(Date.parse('2026-11-23T00:00:01Z'));
    x.state(progress({ date: '2026-11-23', saved: range(1, 21), streak: 0 }));
    assert.equal(x.card().dataset.forestState, 'paused');
  } finally { x.close(); }
});
test('sign-out and switching identities clear the previous forest immediately, including queued recovery', () => {
  const x = fixture(); try {
    x.state(progress({ saved: range(1, 20), streak: 0 }));
    x.root.dataset.arcadeView = 'month';
    x.recover(progress({ saved: range(1, 21), recovered: [21], streak: 21 }));
    x.send('arcade-progress', { sessionActive: false });
    assert.equal(x.el('count').textContent, '—'); assert.equal(x.root.querySelectorAll('[data-forest-tree]').length, 0);
    x.state(progress({ wallet: B, saved: [21], streak: 1 }));
    assert.equal(x.el('count').textContent, '1'); assert.equal(x.card().dataset.forestAnimation, undefined);
  } finally { x.close(); }
});
test('opening recovery only requests the existing controls and destroy removes presentation listeners', () => {
  const x = fixture(); try {
    x.state(progress({ saved: range(1, 20), streak: 0 }));
    let request; x.root.addEventListener('arcade-open-attendance-recovery', e => { request = e.detail; });
    x.el('recover').click(); assert.deepEqual(request, { dateKey: '2026-11-21' });
    x.app.destroy(); assert.equal(x.card(), null);
    x.state(progress({ saved: [21], streak: 1 })); assert.equal(x.card(), null);
  } finally { x.view.close(); }
});
