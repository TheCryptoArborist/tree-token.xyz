import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountArcadeOrganization } from '../scripts/arcade-organization.js';
import { mountSeasonCountdowns } from '../scripts/arcade-season-deadline.js';
import { mountArcadeNavigation } from '../production/arcade-organization-static/runtime/scripts/arcade-navigation-play-share.js';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM
  || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../production/arcade-organization-static/index.html');
const baseline = read('../production/arcade-organization-static/baseline.html');
const presentationCSS = [
  '../styles/arcade-navigation-v1.css',
  '../styles/arcade-season-deadline.css',
  '../styles/arcade-organization.css',
].map(read).join('\n');
const routes = new Map([
  ['games', 'growth-games-tab'], ['daily', 'growth-today-tab'],
  ['campaigns', 'growth-campaigns-tab'], ['events', 'growth-events-tab'],
  ['month', 'growth-month-tab'], ['badges', 'growth-badges-tab'],
]);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function fixture(hash = '', beforeMount) {
  const dom = new JSDOM(page, { url: `https://tree-token.xyz/play/${hash}`, pretendToBeVisual: true });
  const view = dom.window;
  const doc = view.document;
  view.HTMLElement.prototype.scrollIntoView = function () {};
  const style = doc.createElement('style');
  style.textContent = presentationCSS;
  doc.head.append(style);
  beforeMount?.(doc, view);
  mountArcadeNavigation(doc, view);
  const app = mountArcadeOrganization(doc, view);
  return { doc, view, app, close() { app?.destroy(); view.close(); } };
}

function idCounts(doc) {
  const counts = new Map();
  for (const node of doc.querySelectorAll('[id]')) counts.set(node.id, (counts.get(node.id) || 0) + 1);
  return counts;
}

function assertRoute(doc, view, key) {
  assert.equal(doc.getElementById('arcade-daily-growth').dataset.arcadeView, key);
  for (const [candidate, id] of routes) {
    const tab = doc.getElementById(id);
    assert.equal(tab.getAttribute('aria-selected'), String(candidate === key));
    assert.equal(tab.tabIndex, candidate === key ? 0 : -1);
    assert.equal(doc.getElementById(tab.getAttribute('aria-controls')).hidden, candidate !== key);
  }
  const overview = doc.querySelector('.month-progress-summary');
  const monthClock = doc.querySelector('.arcade-month-deadline');
  assert.equal(view.getComputedStyle(overview).display === 'none', key !== 'month');
  assert.equal(view.getComputedStyle(monthClock).display === 'none', key !== 'month');
  assert.equal(doc.getElementById('arcade-featured-event').hidden, key !== 'games');
}

test('the overlay preserves baseline IDs, game/community links and original script tags', async () => {
  const old = new JSDOM(baseline);
  const current = fixture();
  try {
    const before = idCounts(old.window.document);
    const after = idCounts(current.doc);
    for (const [id, count] of before) {
      if (count === 1) assert.equal(after.get(id), 1, `Preserve unique ID ${id}`);
    }
    for (const [id, count] of after) {
      assert.ok(count <= (before.get(id) || 1), `No newly duplicated ID ${id}`);
    }
    const oldLinks = new Set([...old.window.document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    const newLinks = new Set([...current.doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    for (const href of oldLinks) assert.ok(newLinks.has(href), `Retain original link ${href}`);
    for (const script of new Set([...baseline.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]))) {
      assert.ok(page.includes(script), 'Original wallet/game/navigation script markup remains present');
    }
    await settle();
  } finally { current.close(); old.window.close(); }
});

test('moving controls preserves their identities, entered values and existing handlers', async () => {
  let saved;
  let changes = 0;
  let submissions = 0;
  const current = fixture('', (doc) => {
    const nodes = [...doc.querySelectorAll('[id]')].filter((node) => node.tagName !== 'SCRIPT');
    const anchors = [...doc.querySelectorAll('a[href]')].map((node) => ({ node, href: node.getAttribute('href') }));
    const vote = doc.getElementById('mission-vote');
    vote.value = 'treeforce89';
    vote.addEventListener('change', () => changes++);
    const quiz = doc.getElementById('campaign-quiz-form');
    quiz.addEventListener('submit', (event) => { event.preventDefault(); submissions++; });
    doc.getElementById('tree-answer-1').value = 'arcade';
    doc.getElementById('tree-answer-2').value = 'attendance';
    doc.getElementById('tree-answer-3').value = 'review';
    doc.getElementById('campaign-share-link').value = 'https://x.com/test/status/123456';
    doc.getElementById('monthly-digest').value = 'saved-payment-digest';
    saved = {
      nodes, anchors, vote, quiz,
      strip: doc.querySelector('.growth-strip'),
      summary: doc.querySelector('.month-progress-summary'),
      community: doc.getElementById('arcade-community-home'),
      featured: doc.getElementById('arcade-featured-event'),
      checkShortcut: doc.getElementById('arcade-checkin-shortcut'),
      monthShortcut: doc.getElementById('guided-view-month'),
      payment: doc.getElementById('monthly-pay'),
    };
  });
  try {
    const { doc, view } = current;
    for (const node of saved.nodes) assert.equal(doc.getElementById(node.id), node, `Reparent original ${node.id}`);
    for (const { node, href } of saved.anchors) {
      assert.ok(node.isConnected, `Retain original anchor ${href}`);
      assert.equal(node.getAttribute('href'), href);
    }
    assert.equal(doc.getElementById('growth-today-panel').firstElementChild, saved.strip);
    assert.equal(doc.getElementById('growth-today-panel').lastElementChild, saved.community);
    assert.equal(doc.querySelector('.month-progress-summary'), saved.summary);
    assert.equal(doc.getElementById('cabinets').nextElementSibling, saved.featured);
    assert.ok(doc.querySelector('#cabinets .floor-heading').contains(saved.checkShortcut));
    assert.ok(doc.querySelector('#cabinets .floor-heading').contains(saved.monthShortcut));
    assert.equal(saved.vote.value, 'treeforce89');
    assert.deepEqual([1, 2, 3].map((n) => doc.getElementById(`tree-answer-${n}`).value), ['arcade', 'attendance', 'review']);
    assert.equal(doc.getElementById('campaign-share-link').value, 'https://x.com/test/status/123456');
    assert.equal(doc.getElementById('monthly-digest').value, 'saved-payment-digest');
    assert.equal(doc.getElementById('monthly-pay'), saved.payment);
    assert.equal(saved.payment.disabled, true);
    assert.match(doc.querySelector('.monthly-recovery > summary').textContent, /20,000 TREE/);
    saved.vote.dispatchEvent(new view.Event('change', { bubbles: true }));
    saved.quiz.dispatchEvent(new view.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(changes, 1);
    assert.equal(submissions, 1);
    await settle();
  } finally { current.close(); }
});

for (const initial of routes.keys()) {
  test(`the existing runtime restores #${initial} and navigates all six tabs`, async () => {
    const current = fixture(`#${initial}`);
    try {
      await settle();
      assertRoute(current.doc, current.view, initial);
      for (const [key, id] of routes) {
        current.doc.getElementById(id).click();
        await settle();
        assert.equal(current.view.location.hash, `#${key}`);
        assertRoute(current.doc, current.view, key);
      }
      const beforeLength = current.view.history.length;
      current.view.history.replaceState(null, '', `#${initial}`);
      current.view.dispatchEvent(new current.view.PopStateEvent('popstate'));
      await settle();
      assertRoute(current.doc, current.view, initial);
      assert.equal(current.view.history.length, beforeLength, 'History restoration does not add an entry');
    } finally { current.close(); }
  });
}

test('keyboard tab navigation and the existing #cabinets alias still work', async () => {
  const current = fixture('#cabinets');
  try {
    const { doc, view } = current;
    await settle();
    assertRoute(doc, view, 'games');
    assert.equal(doc.activeElement, doc.getElementById('cabinets'));
    doc.getElementById('growth-games-tab').dispatchEvent(new view.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await settle();
    assertRoute(doc, view, 'daily');
    assert.equal(doc.activeElement, doc.getElementById('growth-today-tab'));
    doc.activeElement.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await settle();
    assertRoute(doc, view, 'badges');
  } finally { current.close(); }
});

test('campaign sections stay separate and quiz/share actions open their destination before scrolling', async () => {
  const current = fixture('#campaigns');
  try {
    const { doc } = current;
    const campaign = doc.getElementById('growth-campaigns-panel');
    const wrappers = [...campaign.querySelectorAll('details[data-campaign-section]')];
    assert.equal(wrappers.length, 3);
    assert.equal(new Set(wrappers.map((node) => node.dataset.campaignSection)).size, 3);
    assert.ok(wrappers.every((node) => !node.open));
    const quiz = doc.getElementById('campaign-quiz-form').closest('details[data-campaign-section]');
    const share = doc.getElementById('guided-campaign-share').closest('details[data-campaign-section]');
    const firstRound = doc.getElementById('quest-first-round').closest('details[data-campaign-section]');
    assert.notEqual(quiz, share);
    assert.notEqual(quiz, firstRound);
    let openedBeforeExistingHandler = false;
    doc.getElementById('campaign-open-quiz').addEventListener('click', () => { openedBeforeExistingHandler = quiz.open; });
    doc.getElementById('campaign-open-quiz').click();
    assert.equal(openedBeforeExistingHandler, true);
    assert.equal(quiz.open, true);
    assert.equal(firstRound.open, false);
    doc.getElementById('guided-open-share').click();
    assert.equal(share.open, true);
    const feature = campaign.querySelector('.arcade-campaign-feature');
    assert.match(feature.textContent, /No funded campaign is open yet/);
    assert.match(feature.textContent, /practice scores do not count/i);
    assert.ok(feature.querySelector('a[href="/play/treeforce89/"]'));
    feature.querySelector('a[href="#events"]').click();
    await settle();
    assertRoute(doc, current.view, 'events');
  } finally { current.close(); }
});

test('legacy community visibility writes cannot strand the panels on Games or hide them on Daily', async () => {
  const current = fixture('#daily');
  try {
    const { doc, view } = current;
    const community = doc.getElementById('arcade-community-home');
    const parent = doc.getElementById('growth-today-panel');
    await settle();
    assert.equal(community.parentElement, parent);
    assert.equal(community.hidden, false);
    community.hidden = true; // The preserved guided runtime still performs this on Daily.
    await settle();
    assert.equal(community.hidden, false);
    doc.getElementById('growth-games-tab').click();
    community.hidden = false; // Its Games observer tries to show the legacy home panels.
    await settle();
    assertRoute(doc, view, 'games');
    assert.equal(community.parentElement, parent);
    assert.equal(community.hidden, true);
    doc.getElementById('growth-today-tab').click();
    await settle();
    assert.equal(community.hidden, false);
    assert.equal(parent.hidden, false);
  } finally { current.close(); }
});

test('signed-out visitors can reach Daily from Campaigns, monthly progress and Badge Collection', async () => {
  const current = fixture('#campaigns');
  try {
    const { doc, view } = current;
    doc.getElementById('arcade-daily-growth').dataset.growthState = 'signed-out';
    for (const [route, source] of [
      ['campaigns', 'growth-campaigns-panel'],
      ['month', 'arcade-monthly-panel'],
      ['badges', 'growth-badges-panel'],
    ]) {
      doc.getElementById(routes.get(route)).click();
      await settle();
      const link = doc.getElementById(source).querySelector('a[href="#daily"][data-arcade-route="daily"]');
      assert.ok(link, `${route} has a clear route to the moved sign-in controls`);
      link.click();
      await settle();
      assertRoute(doc, view, 'daily');
      assert.equal(doc.getElementById('growth-connect').closest('[role="tabpanel"]').id, 'growth-today-panel');
    }
    doc.getElementById('campaign-service-status').textContent = 'Sign in above to load your saved campaigns.';
    doc.getElementById('monthly-status').textContent = 'Sign in above to see attendance and verified quest-day progress.';
    await settle();
    for (const id of ['campaign-service-status', 'monthly-status']) {
      assert.match(doc.getElementById(id).textContent, /Open Daily and sign in/);
      assert.doesNotMatch(doc.getElementById(id).textContent, /Sign in above/);
    }
    assert.equal(doc.getElementById('monthly-count').textContent.trim(), '— / 20');
    assert.equal(doc.getElementById('monthly-recovery-controls').hidden, true);
  } finally { current.close(); }
});

test('both DOM countdowns close at the UTC boundary and wait for a real displayed December month', async () => {
  const current = fixture('#month');
  let countdown;
  try {
    const { doc, view } = current;
    mountSeasonCountdowns({ root: doc }).destroy();
    let time = Date.parse('2026-11-30T23:59:59.999Z');
    const callbacks = new Set();
    const timers = {
      setInterval(callback) { callbacks.add(callback); return callback; },
      clearInterval(callback) { callbacks.delete(callback); },
    };
    doc.getElementById('growth-calendar-title').textContent = 'November 2026';
    countdown = mountSeasonCountdowns({ root: doc, now: () => time, timers });
    const cards = [...doc.querySelectorAll('[data-arcade-season-countdown]')];
    assert.equal(cards.length, 2);
    for (const card of cards) {
      assert.equal(card.dataset.countdownState, 'active');
      assert.equal(card.querySelector('time').dateTime, '2026-12-01T00:00:00.000Z');
      assert.equal(card.querySelector('[role="timer"]').getAttribute('aria-live'), 'off');
    }
    time = Date.parse('2026-12-01T00:00:00Z');
    for (const callback of callbacks) callback();
    for (const card of cards) {
      assert.equal(card.dataset.countdownState, 'closed');
      assert.equal(card.querySelector('[role="timer"]').hidden, true);
      assert.equal(card.querySelector('[role="status"]').textContent, 'November earning window closed');
      assert.match(card.textContent, /Earned badges stay in your collection\./);
    }
    time = Date.parse('2026-12-03T12:00:00Z');
    countdown.update();
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-11' && card.dataset.countdownState === 'closed'));
    doc.getElementById('growth-calendar-title').textContent = 'December 2026';
    await settle();
    for (const card of cards) {
      assert.equal(card.dataset.resolvedSeasonMonth, '2026-12');
      assert.equal(card.dataset.countdownState, 'active');
      assert.equal(card.querySelector('time').dateTime, '2027-01-01T00:00:00.000Z');
    }
    doc.getElementById('growth-calendar-title').textContent = 'Your month';
    doc.getElementById('arcade-daily-growth').dispatchEvent(new view.CustomEvent('arcade-progress', { detail: { progress: { monthKey: '2026-12' } } }));
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-12'));
    countdown.destroy();
    assert.equal(callbacks.size, 0);
    doc.getElementById('growth-calendar-title').textContent = 'November 2026';
    await settle();
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-12'), 'Destroyed observer no longer changes the DOM');
  } finally { countdown?.destroy(); current.close(); }
});

test('mounting twice does not duplicate controls, links, details or countdowns', async () => {
  const current = fixture();
  try {
    const before = idCounts(current.doc);
    const anchors = current.doc.querySelectorAll('a').length;
    assert.equal(mountArcadeOrganization(current.doc, current.view), current.app);
    assert.deepEqual(idCounts(current.doc), before);
    assert.equal(current.doc.querySelectorAll('a').length, anchors);
    assert.equal(current.doc.querySelectorAll('details[data-campaign-section]').length, 3);
    assert.equal(current.doc.querySelectorAll('[data-arcade-season-countdown]').length, 2);
    await settle();
  } finally { current.close(); }
});

test('a signed-out December collection has a December countdown while an explicit November calendar stays closed', async () => {
  const current = fixture('#badges', (doc) => {
    doc.getElementById('growth-calendar-title').textContent = 'Your month';
    doc.getElementById('seasonal-current-title').textContent = 'December · Christmas Guardians';
  });
  let countdown;
  try {
    const { doc } = current;
    mountSeasonCountdowns({ root: doc }).destroy();
    countdown = mountSeasonCountdowns({
      root: doc,
      now: () => Date.parse('2026-12-03T12:00:00Z'),
      timers: { setInterval() { return 1; }, clearInterval() {} },
    });
    const cards = [...doc.querySelectorAll('[data-arcade-season-countdown]')];
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-12' && card.dataset.countdownState === 'active'));
    doc.getElementById('growth-calendar-title').textContent = 'November 2026';
    await settle();
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-11' && card.dataset.countdownState === 'closed'));
    doc.getElementById('growth-calendar-title').textContent = 'Your month';
    doc.getElementById('seasonal-current-title').textContent = 'November · Autumn Guardians';
    await settle();
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-11' && card.dataset.countdownState === 'closed'));
    doc.getElementById('seasonal-current-title').textContent = 'December · Christmas Guardians';
    await settle();
    assert.ok(cards.every((card) => card.dataset.resolvedSeasonMonth === '2026-12' && card.dataset.countdownState === 'active'));
  } finally { countdown?.destroy(); current.close(); }
});
