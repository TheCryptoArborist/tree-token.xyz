import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

// This harness runs the candidate's real presentation, wallet bridge and monthly
// controller. Only API data, Wallet Standard and the payment boundary are fake.
// No secret keys, real signatures, transactions or backend writes are involved.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, process.env.ARCADE_FOREST_REVIEW_OUTPUT || '.netlify/arcade-attendance-forest-review');
const widths = [320, 390, 1280];
const A = `0x${'a'.repeat(64)}`;
const B = `0x${'b'.repeat(64)}`;
const SESSION = 'tree-arcade:daily-growth:session:v1';
const PENDING = 'tree-arcade:recovery:pending:v1';
const WALLET = 'Test Slush';
const DIGEST = '2'.repeat(44);
const DAY = 86_400_000;
const FOREST = '#arcade-attendance-forest';
const tabs = [
  ['games', 'growth-games-tab', 'games'], ['daily', 'growth-today-tab', 'daily'],
  ['campaigns', 'growth-campaigns-tab', 'campaigns'], ['events', 'growth-events-tab', 'events'],
  ['month', 'growth-month-tab', 'monthlyProgress'], ['badges', 'growth-badges-tab', 'badgeCollection'],
];
const checkNames = [...tabs.map(([, , name]) => name), 'mobileLayout', 'noMissingAssets', 'countdownUTC',
  'checkinCount', 'streakCountdown', 'growingForest', 'missedDayEmbers', 'verifiedRecoveryRain',
  'pendingRecoveryNoRain', 'walletIsolation', 'reducedMotion', 'monthRollover', 'staleProgress'];
const report = {
  schemaVersion: 1, result: 'failed', checkedAt: new Date().toISOString(), viewportWidths: widths,
  noWalletOrPaymentActions: true, syntheticWalletOnly: true, syntheticDataOnly: true,
  expectedScenarioCount: widths.length * 6,
  checks: Object.fromEntries(checkNames.map((name) => [name, false])),
  viewports: [], screenshots: [], failures: [], browserErrors: [], assetFailures: [],
  unexpectedWrites: [], unsupportedAPIReads: [],
  evidence: {
    application: 'Candidate HTML, CSS, forest module, monthly controller and wallet bridge are served without local overlays.',
    wallet: 'A synthetic Wallet Standard provider exposes two fabricated addresses and message signatures; on-chain methods throw.',
    payment: 'Only /assets/arcade/arcade-recovery-wallet.js is replaced with a synthetic approval/rejection adapter. It never calls a wallet or network.',
    network: 'All API requests are mocked. Every unrecognized write is aborted. No API write or payment is forwarded.',
    clock: 'Playwright Clock and matching HTTP Date response headers exercise UTC transitions; forest DOM is only observed.',
  },
};
fs.mkdirSync(output, { recursive: true });

const paymentAdapter = `
export async function payForRecovery(intent, session) {
  const audit = window.__arcadeForestReview;
  if (!audit || intent.wallet !== session.wallet) throw new Error('Synthetic recovery identity mismatch');
  audit.paymentAttempts.push({ wallet: session.wallet, dateKey: intent.dateKey, intentId: intent.id, mode: audit.paymentMode });
  if (audit.paymentMode === 'reject') throw new Error('Synthetic wallet rejected this payment. No payment was sent.');
  return ${JSON.stringify(DIGEST)};
}
`;

function installSyntheticWallet({ A, B, SESSION, WALLET, scenarioTime, sessionExpiresAt }) {
  const audit = {
    connections: [], disconnects: 0, signatures: [], forbiddenActions: [], paymentAttempts: [],
    paymentMode: 'reject', forest: [], attendance: [], recovery: [],
    setup: { scenarioTime, initialBrowserTime: Date.now(), sessionExpiresAt, seeded: false },
  };
  Object.defineProperty(window, '__arcadeForestReview', { value: audit });
  const accounts = [A, B].map((address, index) => ({
    address, publicKey: new Uint8Array(32).fill(index + 1), chains: ['sui:mainnet'],
    features: ['sui:signPersonalMessage'], label: `Synthetic account ${index ? 'B' : 'A'}`,
  }));
  let authorized = [...accounts];
  const listeners = new Set();
  const changed = () => { for (const callback of listeners) callback({ accounts: [...authorized] }); };
  const forbidden = (name) => async () => {
    audit.forbiddenActions.push(name);
    throw new Error(`Forest browser review forbids on-chain wallet action: ${name}`);
  };
  const wallet = {
    version: '1.0.0', name: WALLET, chains: ['sui:mainnet'],
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MCA0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMTAiIGZpbGw9IiM4MGYxYzIiLz48dGV4dCB4PSIyMCIgeT0iMjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjQiPlQ8L3RleHQ+PC9zdmc+',
    get accounts() { return [...authorized]; },
    features: {
      'standard:connect': { version: '1.0.0', async connect(options = {}) {
        audit.connections.push({ silent: Boolean(options.silent) }); authorized = [...accounts]; changed();
        return { accounts: [...authorized] };
      } },
      'standard:disconnect': { version: '1.0.0', async disconnect() { audit.disconnects++; authorized = []; changed(); } },
      'standard:events': { version: '1.0.0', on(event, callback) {
        if (event === 'change') listeners.add(callback);
        return () => listeners.delete(callback);
      } },
      'sui:signPersonalMessage': { version: '1.1.0', async signPersonalMessage({ account, message }) {
        if (!authorized.some((entry) => entry.address === account.address)) throw new Error('Synthetic account is not authorized');
        audit.signatures.push({ address: account.address, message: new TextDecoder().decode(message) });
        return { signature: `synthetic-forest-signature-${account.address.slice(-1)}` };
      } },
      'sui:signTransaction': { version: '2.0.0', signTransaction: forbidden('signTransaction') },
      'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction: forbidden('signAndExecuteTransaction') },
      'sui:signTransactionBlock': { version: '1.0.0', signTransactionBlock: forbidden('signTransactionBlock') },
      'sui:signAndExecuteTransactionBlock': { version: '1.0.0', signAndExecuteTransactionBlock: forbidden('signAndExecuteTransactionBlock') },
    },
  };
  window.addEventListener('wallet-standard:app-ready', (event) => event.detail.register(wallet));
  window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(wallet) }));
  // Only the first navigation is seeded. Reload after sign-out must stay out.
  const sentinel = 'tree-arcade:forest-review:seeded';
  if (!sessionStorage.getItem(sentinel)) {
    sessionStorage.setItem(sentinel, '1');
    audit.setup.seeded = true;
    localStorage.setItem(SESSION, JSON.stringify({
      version: 1, token: 'a'.repeat(64), wallet: A, walletId: WALLET, walletName: WALLET,
      // Init-script execution order relative to Playwright Clock is not
      // guaranteed. Bind expiry to the same explicit scenario time instead
      // of whichever Date implementation is installed when this script runs.
      expiresAt: sessionExpiresAt,
    }));
  }
  // Pure observation: neither these listeners nor the observer write app state.
  document.addEventListener('arcade-attendance-state', (event) => {
    const d = event.detail || {};
    audit.attendance.push({ at: performance.now(), wallet: d.wallet, sessionActive: d.sessionActive,
      loading: d.loading, fresh: d.fresh, error: d.error, dateKey: d.progress?.dateKey,
      count: d.progress?.attendance?.checkedInDays, streak: d.progress?.attendance?.streak,
      serverTime: d.clock?.serverTime });
  }, true);
  document.addEventListener('arcade-attendance-recovered', (event) => {
    const d = event.detail || {};
    audit.recovery.push({ at: performance.now(), wallet: d.wallet, dateKey: d.dateKey || d.receipt?.dateKey });
  }, true);
  let previous = '';
  new MutationObserver(() => {
    const node = document.querySelector('#arcade-attendance-forest');
    if (!node) return;
    const value = { at: performance.now(), state: node.dataset.forestState,
      animation: node.dataset.forestAnimation || '', count: node.querySelector('[data-forest-count]')?.textContent,
      streak: node.querySelector('[data-forest-streak]')?.textContent,
      status: node.querySelector('[data-forest-status]')?.textContent,
      dates: [...node.querySelectorAll('g[data-forest-tree][data-date]')].map((tree) => tree.dataset.date).sort() };
    const key = JSON.stringify({ ...value, at: 0 });
    if (key !== previous) { previous = key; audit.forest.push(value); }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-forest-state', 'data-forest-animation', 'data-date'] });
}

const dateKey = (time) => new Date(time).toISOString().slice(0, 10);
const utcDay = (key) => Date.parse(`${key}T00:00:00.000Z`);
const dates = (...days) => days.map((day) => `2026-11-${String(day).padStart(2, '0')}`);

function createAPI({ width, scenario, now = '2026-11-22T12:00:00.000Z', checked = [] }) {
  const startedAt = Date.now();
  const history = new Map([[A, new Set(checked)], [B, new Set(dates(7))]]);
  const recovered = new Map([[A, new Set()], [B, new Set()]]);
  const intents = new Map();
  const statusWaiters = [], verifyWaiters = [];
  const api = {
    now: Date.parse(now), calls: [], phase: 'initial', monthlyMode: 'valid',
    holdMonthly: false, holdVerify: false, closed: false,
    get dateKey() { return dateKey(api.now); },
    get monthKey() { return api.dateKey.slice(0, 7); },
    get pendingStatus() { return statusWaiters.length; },
    get pendingVerify() { return verifyWaiters.length; },
    releaseStatus() { api.holdMonthly = false; statusWaiters.splice(0).forEach((resolve) => resolve()); },
    releaseVerify() { api.holdVerify = false; verifyWaiters.splice(0).forEach((resolve) => resolve()); },
    close() { api.closed = true; api.releaseStatus(); api.releaseVerify(); },
    monthly(wallet) {
      const days = history.get(wallet) || new Set();
      const current = [...days].filter((key) => key.startsWith(`${api.monthKey}-`) && key <= api.dateKey).sort();
      let anchor = utcDay(api.dateKey) - (days.has(api.dateKey) ? 0 : DAY), streak = 0;
      while (days.has(dateKey(anchor))) { streak++; anchor -= DAY; }
      const dayNumber = Number(api.dateKey.slice(-2));
      return { wallet, dateKey: api.dateKey, monthKey: api.monthKey,
        attendance: { streak, checkedInDays: current.length,
          recoveredDates: [...(recovered.get(wallet) || [])].filter((key) => current.includes(key)).sort(),
          missedDates: Array.from({ length: dayNumber - 1 }, (_, i) => `${api.monthKey}-${String(i + 1).padStart(2, '0')}`)
            .filter((key) => !days.has(key)) },
        monthlyReward: { requiredQuestDays: 20, verifiedQuestDays: 0, qualifyingDates: [],
          qualified: false, todayQualified: false, rewardDetails: 'To be announced', ruleVersion: 'verified-quest-days-v1' },
      };
    },
    growth(wallet) {
      const days = history.get(wallet) || new Set();
      const [year, month] = api.monthKey.split('-').map(Number);
      const calendar = Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, index) => {
        const key = `${api.monthKey}-${String(index + 1).padStart(2, '0')}`;
        return { dateKey: key, checkedIn: key <= api.dateKey && days.has(key), questCompleted: false, gameIds: [] };
      });
      return { status: 'ok', authenticated: Boolean(wallet), dateKey: api.dateKey, monthKey: api.monthKey,
        configuration: { enabledGames: [], eligibleGames: [] },
        ...(wallet ? { progress: { wallet, monthKey: api.monthKey, dateKey: api.dateKey, calendar,
          checkedInDays: calendar.filter((day) => day.checkedIn).length, questDays: 0,
          today: { checkedIn: days.has(api.dateKey), questCompleted: false, gameIds: [] },
          passport: { monthKey: api.monthKey, enabledGames: [], completedGameIds: [], complete: false },
          milestones: [], badges: [],
        } } : {}),
      };
    },
    async handle(route, request, url) {
      const method = request.method(), action = url.searchParams.get('action') || 'status';
      let body = null;
      try { body = request.postData() ? JSON.parse(request.postData()) : null; } catch {}
      const token = request.headers().authorization;
      const wallet = body?.wallet || (token === `Bearer ${'a'.repeat(64)}` ? A : token === `Bearer ${'b'.repeat(64)}` ? B : null);
      api.calls.push({ path: url.pathname, method, action, wallet, phase: api.phase, dateKey: api.dateKey });
      const send = async (data, status = 200) => {
        if (api.closed) { try { await route.abort('blockedbyclient'); } catch {} return; }
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data),
          headers: { Date: new Date(api.now).toUTCString(), 'Cache-Control': 'no-store' } });
      };
      if (url.pathname === '/api/arcade-growth' && ['status', 'sync', 'challenge', 'session', 'logout', 'check-in'].includes(action)
        && method === (action === 'status' ? 'GET' : 'POST')) {
        if (action === 'challenge') return send({ status: 'ok', challenge: { wallet,
          challengeId: `synthetic-forest-${wallet?.slice(-1)}`, message: `Synthetic forest review only: ${wallet}`,
          expiresAt: new Date(api.now + (Date.now() - startedAt) + 60_000).toISOString() } });
        if (action === 'session') return send({ ...api.growth(wallet), session: { wallet,
          token: wallet === B ? 'b'.repeat(64) : 'a'.repeat(64), expiresAt: new Date(api.now + 3_600_000).toISOString() } });
        if (action === 'logout') return send({ status: 'ok' });
        if (action === 'check-in') {
          assert.ok(history.has(wallet), 'Only a synthetic authenticated wallet can check in');
          history.get(wallet).add(api.dateKey);
        }
        return send(api.growth(wallet));
      }
      if (url.pathname === '/api/arcade-monthly' && action === 'status' && method === 'GET') {
        if (api.holdMonthly) await new Promise((resolve) => statusWaiters.push(resolve));
        if (api.monthlyMode === 'unavailable') return send({ status: 'error', message: 'Synthetic attendance service is temporarily unavailable.' }, 503);
        const progress = api.monthly(wallet);
        if (api.monthlyMode === 'malformed') progress.attendance.checkedInDays = 99;
        return send({ status: 'ok', authenticated: Boolean(wallet), progress });
      }
      if (url.pathname === '/api/arcade-monthly' && action === 'intent' && method === 'POST') {
        assert.ok(history.has(wallet) && api.monthly(wallet).attendance.missedDates.includes(body?.dateKey), 'Recovery must select an actual missed synthetic date');
        const [year, month] = api.monthKey.split('-').map(Number);
        const seasonEndsAt = new Date(Date.UTC(year, month, 1)).toISOString();
        const intent = { id: `11111111-1111-4111-8111-${String(intents.size + 1).padStart(12, '0')}`,
          wallet, dateKey: body.dateKey, createdAt: new Date(api.now).toISOString(),
          expiresAt: new Date(Math.min(api.now + 900_000, Date.parse(seasonEndsAt))).toISOString(),
          seasonEndsAt, price: '20000', memo: 'Synthetic forest review; no transaction is constructed.' };
        intents.set(intent.id, intent);
        return send({ status: 'ok', intent });
      }
      if (url.pathname === '/api/arcade-monthly' && action === 'verify' && method === 'POST') {
        const intent = intents.get(body?.intentId);
        assert.ok(intent && intent.wallet === wallet && body.digest === DIGEST, 'Only the fabricated checkout/digest may be verified');
        if (api.holdVerify) await new Promise((resolve) => verifyWaiters.push(resolve));
        if (api.closed) return send({ status: 'error' }, 503);
        history.get(wallet).add(intent.dateKey); recovered.get(wallet).add(intent.dateKey);
        return send({ status: 'ok', authenticated: true, progress: api.monthly(wallet),
          receipt: { dateKey: intent.dateKey, digest: DIGEST, price: '20000' } });
      }
      if (method === 'GET' && url.pathname === '/api/arcade-completed-runs') return send({ wallet, dateKey: api.dateKey, runs: [], sources: {} });
      if (method === 'GET' && url.pathname === '/api/arcade-social') return send({ wallet, entries: [], monthlyStamps: 0, resetsAt: new Date(api.now + DAY).toISOString() });
      if (method === 'GET' && url.pathname === '/api/arcade-campaign') return send({ status: 'ok', progress: {
        wallet, campaignId: 'first-round-v1', canClaim: false, quizCompleteThisWeek: false,
        learningStamps: 0, startedAt: null, claimedAt: null,
        tasks: { checkIn: Boolean(history.get(wallet)?.has(api.dateKey)), quiz: false, game: false, share: false },
      } });
      if (!['GET', 'HEAD'].includes(method)) {
        report.unexpectedWrites.push({ width, scenario, method, url: url.href });
        return route.abort('blockedbyclient');
      }
      report.unsupportedAPIReads.push({ width, scenario, url: url.href });
      return send({ status: 'error', message: 'Read endpoint unavailable in isolated forest review.' }, 503);
    },
  };
  return api;
}

// Node-side polling continues to work while Playwright's page clock is paused.
async function until(check, description, timeout = 15_000) {
  const expires = Date.now() + timeout;
  let last;
  while (Date.now() < expires) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${description}${last === undefined ? '' : ` (${String(last)})`}`);
}

async function forestSnapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#arcade-attendance-forest');
    if (!root) return null;
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() || '';
    const visible = (node) => {
      if (!node || !node.getBoundingClientRect().width || !node.getBoundingClientRect().height) return false;
      for (let current = node; current && current.nodeType === 1; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const deadline = root.querySelector('[data-forest-deadline]');
    return { state: root.dataset.forestState, animation: root.dataset.forestAnimation || '',
      count: text('[data-forest-count]'), streak: text('[data-forest-streak]'),
      timer: text('[data-forest-timer]'), timerLabel: text('[data-forest-timer-label]'),
      deadline: deadline?.getAttribute('datetime') || deadline?.querySelector('time')?.getAttribute('datetime') || '',
      deadlineText: deadline?.textContent?.trim() || '', status: text('[data-forest-status]'),
      dates: [...root.querySelectorAll('g[data-forest-tree][data-date]')].map((node) => node.dataset.date).sort(),
      embers: [...root.querySelectorAll('g[data-forest-embers]')].some(visible),
      visible: visible(root),
    };
  });
}

function numberIn(text) { const match = String(text).match(/\d+/); return match ? Number(match[0]) : null; }

async function expectForest(page, expected, description) {
  return until(async () => {
    const actual = await forestSnapshot(page);
    if (!actual) return false;
    if (expected.state && actual.state !== expected.state) return false;
    if (expected.count !== undefined && numberIn(actual.count) !== expected.count) return false;
    if (expected.streak !== undefined && numberIn(actual.streak) !== expected.streak) return false;
    if (expected.dates && JSON.stringify(actual.dates) !== JSON.stringify([...expected.dates].sort())) return false;
    return actual;
  }, description);
}

async function chooseTab(page, key) {
  const entry = tabs.find(([name]) => name === key);
  await page.locator(`#${entry[1]}`).click();
  await until(() => page.evaluate((value) => document.getElementById('arcade-daily-growth')?.dataset.arcadeView === value, key), `${key} tab selected`);
}

async function assertNoOverflow(page, width, label) {
  const actual = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(actual.width <= actual.viewport + 1, `${label} has horizontal overflow at ${width}px (${actual.width}px)`);
}

async function decodeImages(page, selectors, width, scenario) {
  const failures = await page.evaluate(async (selectors) => {
    const images = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
    return (await Promise.all(images.map(async (image) => {
      image.loading = 'eager';
      try { await Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(Error('Image decode timeout')), 12_000))]); }
      catch (error) { return { src: image.currentSrc || image.src, message: error.message }; }
      return image.naturalWidth > 0 ? null : { src: image.currentSrc || image.src, message: 'Image has no decoded width' };
    }))).filter(Boolean);
  }, selectors);
  report.assetFailures.push(...failures.map((failure) => ({ width, scenario, ...failure })));
  assert.deepEqual(failures, [], `${scenario}: essential images must decode at ${width}px`);
}

async function screenshot(page, name, { motion = false } = {}) {
  await page.locator(FOREST).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, name), fullPage: false, animations: motion ? 'allow' : 'disabled' });
  report.screenshots.push(name);
}

async function refresh(page, api, phase) {
  api.phase = phase;
  const count = api.calls.filter((call) => call.path === '/api/arcade-monthly' && call.action === 'status').length;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await until(() => api.calls.filter((call) => call.path === '/api/arcade-monthly' && call.action === 'status').length > count, `${phase}: monthly status requested`);
}

async function assertDeadline(page, expected, label, expectedRemaining) {
  const actual = await forestSnapshot(page);
  assert.match(actual.timerLabel, label);
  assert.match(actual.timer, /\d/, 'A visible numerical countdown is required');
  if (expectedRemaining !== undefined) {
    const parts = /^(\d{2,}):(\d{2}):(\d{2})$/.exec(actual.timer);
    assert.ok(parts, 'Countdown should give hours, minutes and seconds');
    const seconds = Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
    assert.ok(seconds <= expectedRemaining + 1 && seconds >= expectedRemaining - 120,
      `Countdown must target the next UTC midnight: expected about ${expectedRemaining}s, received ${seconds}s`);
  }
  if (actual.deadline) assert.equal(Date.parse(actual.deadline), Date.parse(expected), 'Exact streak deadline must match UTC attendance rules');
  else {
    const time = await page.locator(`${FOREST} [data-forest-deadline]`).getAttribute('aria-label');
    const content = `${actual.deadlineText} ${time || ''}`;
    assert.match(content, /UTC/);
    const expectedDay = new Date(expected).getUTCDate();
    const expectedMonth = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(expected));
    assert.match(content, new RegExp(`\\b${expectedDay}\\b`), 'Accessible deadline must identify the exact day');
    assert.ok(content.includes(expectedMonth), 'Accessible deadline must identify the exact month');
    assert.match(content, /00:00/);
  }
}

async function signedOut(page) {
  await until(() => page.evaluate((key) => !localStorage.getItem(key) && !sessionStorage.getItem(key), SESSION), 'Both session stores cleared');
  await expectForest(page, { state: 'signed-out', dates: [] }, 'Forest cleared on sign-out');
  const state = await page.evaluate(async () => (await import('/assets/arcade/arcade-growth-wallet.js')).getWalletState());
  assert.equal(state.connected, false, 'The candidate bridge must be disconnected');
  const snapshot = await forestSnapshot(page);
  assert.equal(numberIn(snapshot.count), null, 'Signed-out count is unknown, not zero');
  assert.equal(numberIn(snapshot.streak), null, 'Signed-out streak is unknown, not zero');
  assert.equal(snapshot.embers, false);
}

let origin, browser;
async function scenario(viewport, name, options, run) {
  const width = viewport.width;
  const item = { name, result: 'failed', mockedAPIRequests: [], observations: null };
  viewport.scenarios.push(item);
  const api = createAPI({ width, scenario: name, ...options });
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1,
    serviceWorkers: 'block', reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference' });
  await context.addInitScript(installSyntheticWallet, { A, B, SESSION, WALLET,
    scenarioTime: api.now, sessionExpiresAt: new Date(api.now + 3_600_000).toISOString() });
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.includes('/api/') || url.pathname.startsWith('/.netlify/functions/')) return api.handle(route, request, url);
    if (!['GET', 'HEAD'].includes(request.method())) {
      report.unexpectedWrites.push({ width, scenario: name, method: request.method(), url: url.href });
      return route.abort('blockedbyclient');
    }
    if (url.origin === origin && url.pathname === '/assets/arcade/arcade-recovery-wallet.js') {
      return route.fulfill({ contentType: 'text/javascript', body: paymentAdapter, headers: { 'Cache-Control': 'no-store' } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.clock.install({ time: api.now });
  page.on('pageerror', (error) => report.browserErrors.push({ width, scenario: name, message: error.message }));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) {
      report.assetFailures.push({ width, scenario: name, src: url.href, status: response.status() });
    }
  });
  let setupComplete = false;
  try {
    const response = await page.goto(`${origin}/play/#daily`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.equal(response?.status(), 200, 'Candidate Arcade must load');
    await page.locator(FOREST).waitFor({ state: 'visible' });
    await until(() => page.evaluate(({ SESSION, A }) => JSON.parse(localStorage.getItem(SESSION) || 'null')?.wallet === A
      && document.getElementById('growth-wallet-state')?.textContent.includes('Signed in'), { SESSION, A }), 'Synthetic A session restored');
    setupComplete = true;
    await run({ page, api, width, viewport, item });
    const audit = await page.evaluate(() => window.__arcadeForestReview);
    assert.deepEqual(audit.forbiddenActions, [], 'No on-chain wallet feature may run');
    assert.ok(!report.browserErrors.some((error) => error.width === width && error.scenario === name), 'Candidate must not throw browser exceptions');
    assert.ok(!report.unexpectedWrites.some((request) => request.width === width && request.scenario === name), 'Unexpected writes must never be attempted');
    assert.ok(!report.assetFailures.some((failure) => failure.width === width && failure.scenario === name), 'Encountered candidate assets must load');
    item.result = 'passed';
    console.log(`${width}px ${name}: passed`);
  } catch (error) {
    item.setupFailed = !setupComplete;
    report.failures.push({ width, scenario: name, stage: setupComplete ? 'scenario' : 'setup', message: error.message, stack: error.stack });
    if (!setupComplete) {
      try {
        item.setupDiagnostics = await page.evaluate((key) => {
          const browserTime = Date.now();
          const stored = (storage) => {
            try {
              const value = JSON.parse(storage.getItem(key) || 'null');
              if (!value) return null;
              return { wallet: value.wallet, walletId: value.walletId, expiresAt: value.expiresAt,
                expiredAtBrowserTime: !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= browserTime,
                tokenPresent: typeof value.token === 'string' && value.token.length > 0 };
            } catch { return { unreadable: true }; }
          };
          return { browserTime, browserTimeISO: new Date(browserTime).toISOString(), monotonicTime: performance.now(),
            seed: window.__arcadeForestReview?.setup,
            localSession: stored(localStorage), legacySession: stored(sessionStorage),
            growthState: document.getElementById('arcade-daily-growth')?.dataset.growthState,
            walletStatus: document.getElementById('growth-wallet-state')?.textContent,
            notice: document.getElementById('growth-status')?.textContent,
            forestState: document.getElementById('arcade-attendance-forest')?.dataset.forestState };
        }, SESSION);
      } catch (diagnosticError) { item.setupDiagnostics = { unavailable: diagnosticError.message }; }
    }
    try { await page.screenshot({ path: path.join(output, `failure-${name}-${width}.png`), fullPage: false });
      report.screenshots.push(`failure-${name}-${width}.png`); } catch {}
    console.error(`${width}px ${name}: ${error.message}`);
  } finally {
    item.mockedAPIRequests = api.calls;
    try { item.observations = await page.evaluate(() => window.__arcadeForestReview); } catch {}
    api.close(); await context.close();
  }
  return item;
}

async function growingScenario({ page, api, width, viewport }) {
  const expectedDates = dates(2, 5, 10, 18, 19, 20, 21, 22);
  const initial = await expectForest(page, { state: 'growing', count: 8, streak: 5, dates: expectedDates }, 'Saved monthly grove and cross-gap current streak');
  assert.equal(initial.embers, false, 'Old missed dates must not burn a currently healthy streak');
  await assertDeadline(page, '2026-11-24T00:00:00.000Z', /next.*check.?in.*open/i, 43_200);
  viewport.checks.checkinCount = true; viewport.checks.streakCountdown = true;
  await decodeImages(page, ['.suite-brand img', '.suite-hero-art', '.growth-strip-art'], width, 'growing');
  for (const [key, tabId, check] of tabs) {
    await chooseTab(page, key);
    assert.equal(await page.locator(`#${tabId}`).getAttribute('aria-selected'), 'true');
    const panel = await page.locator(`#${tabId}`).getAttribute('aria-controls');
    assert.equal(await page.locator(`#${panel}`).isVisible(), true);
    await assertNoOverflow(page, width, key);
    if (key === 'games') await decodeImages(page, ['#cabinets .poster-link img'], width, 'growing');
    if (key === 'campaigns') await decodeImages(page, ['.arcade-campaign-spotlight img', '.arcade-campaign-next img'], width, 'growing');
    if (key === 'month' || key === 'badges') {
      const selector = key === 'month' ? '.arcade-month-deadline' : '#growth-badges-panel [data-arcade-season-countdown]';
      await page.locator(selector).waitFor({ state: 'visible' });
      const time = page.locator(`${selector} .arcade-season-deadline__date time`);
      assert.match(await time.textContent(), /00:00 UTC/);
      assert.equal(await time.getAttribute('datetime'), '2026-12-01T00:00:00.000Z');
      assert.equal(await page.locator(selector).getAttribute('data-countdown-state'), 'active');
      assert.equal(await page.locator(`${selector} [role="timer"]`).isVisible(), true);
      viewport.checks.countdownUTC = true;
    }
    viewport.checks[check] = true;
  }
  await chooseTab(page, 'daily');
  await screenshot(page, `growing-${width}.png`);
  for (const failure of ['malformed', 'unavailable']) {
    api.monthlyMode = failure;
    await refresh(page, api, failure);
    await expectForest(page, { state: 'stale' }, `${failure} response must be visibly stale`);
    const stale = await forestSnapshot(page);
    assert.ok(numberIn(stale.count) === 8 || numberIn(stale.count) === null, 'Unavailable data must not reset saved count to zero');
    assert.ok(numberIn(stale.streak) === 5 || numberIn(stale.streak) === null, 'Unavailable data must not invent a lost streak');
    assert.equal(stale.embers, false, 'Unverified progress must not show a fire');
    assert.equal(stale.animation, '', 'Unverified progress must not celebrate or burn');
    api.monthlyMode = 'valid';
    await refresh(page, api, `after-${failure}`);
    await expectForest(page, { state: 'growing', count: 8, streak: 5, dates: expectedDates }, 'Fresh progress restored');
  }
  viewport.checks.staleProgress = true;

  await page.locator('#growth-connect').click();
  await page.locator('#growth-wallet-picker[open]').waitFor();
  await signedOut(page);
  await page.locator(`[data-wallet-id="${WALLET}"]`).click();
  await page.locator(`[data-account-address="${B}"]`).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__arcadeForestReview.signatures), [], 'No account is signed in before explicit selection');
  await page.locator(`[data-account-address="${B}"]`).click();
  await expectForest(page, { state: 'growing', count: 2, streak: 1, dates: dates(7, 22) }, 'B receives its own grove only');
  assert.equal(await page.locator('#growth-wallet-state').getAttribute('title'), B);
  const signed = await page.evaluate(() => window.__arcadeForestReview.signatures.map((entry) => entry.address));
  assert.deepEqual(signed, [B]);
  assert.deepEqual(api.calls.filter((call) => call.action === 'check-in').map((call) => call.wallet), [B]);
  const walletAudit = await page.evaluate(() => window.__arcadeForestReview);
  viewport.walletSwitchAudit = { signatures: walletAudit.signatures, disconnects: walletAudit.disconnects };
  await page.locator('#growth-sign-out').click(); await signedOut(page);
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); });
  await signedOut(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator(FOREST).waitFor({ state: 'visible' });
  await until(() => page.evaluate(() => !document.getElementById('growth-connect')?.disabled), 'Signed-out page finishes loading');
  await signedOut(page);
  assert.deepEqual(await page.evaluate(() => window.__arcadeForestReview.signatures), []);
  viewport.checks.walletIsolation = true;
  viewport.checks.mobileLayout = true;
  viewport.checks.noMissingAssets = true;
}

async function checkInScenario({ page, api, width, viewport }, reduced = false) {
  await expectForest(page, { state: 'growing', count: 4, streak: 4, dates: dates(18, 19, 20, 21) }, 'Unchecked-today streak is still alive');
  await assertDeadline(page, '2026-11-23T00:00:00.000Z', /streak|check.?in.*within|check.?in.*close/i, 43_200);
  await until(async () => !(await page.locator('#growth-check-in-row').isDisabled()), 'Free daily check-in is enabled');
  await page.locator('#growth-check-in-row').click();
  await expectForest(page, { state: 'growing', count: 5, streak: 5, dates: dates(18, 19, 20, 21, 22) }, 'A confirmed check-in adds exactly one tree');
  assert.equal(api.calls.filter((call) => call.action === 'check-in').length, 1);
  assert.deepEqual(await page.evaluate(() => window.__arcadeForestReview.signatures), [], 'Existing signed-in attendance requires no extra message');
  await assertDeadline(page, '2026-11-24T00:00:00.000Z', /next.*check.?in.*open/i, 43_200);
  if (reduced) {
    const motion = await page.evaluate(() => {
      const root = document.querySelector('#arcade-attendance-forest');
      const effective = [...root.querySelectorAll('*'), root].flatMap((node) => ['', '::before', '::after'].map((pseudo) => {
        const s = getComputedStyle(node, pseudo || undefined);
        return { animation: s.animationName, duration: s.animationDuration, transition: s.transitionDuration };
      })).filter((value) => (value.animation !== 'none' && value.duration.split(',').some((part) => parseFloat(part) > 0.001))
        || value.transition.split(',').some((part) => parseFloat(part) > 0.001));
      return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, effective };
    });
    assert.equal(motion.reduced, true); assert.deepEqual(motion.effective, [], 'Reduced-motion mode must not run forest animation or transitions');
    viewport.checks.reducedMotion = true;
    await screenshot(page, `reduced-motion-${width}.png`);
  } else {
    await until(() => page.evaluate(() => window.__arcadeForestReview.forest.some((entry) => entry.animation === 'plant')), 'Confirmed free check-in produces a one-shot planting animation');
    viewport.checks.growingForest = true;
    await screenshot(page, `new-checkin-${width}.png`);
  }
  await assertNoOverflow(page, width, reduced ? 'reduced-motion grove' : 'new check-in');
}

async function openRecovery(page, selectedDate) {
  await chooseTab(page, 'month');
  const disclosure = page.locator('.monthly-recovery');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
  await until(async () => !(await page.locator('#monthly-date').isDisabled()), 'Recovery dates are available');
  await page.locator('#monthly-date').selectOption(selectedDate);
}

async function recoveryScenario({ page, api, width, viewport }) {
  await expectForest(page, { state: 'paused', count: 3, streak: 0, dates: dates(18, 19, 20) }, 'Missed yesterday pauses the streak without deleting old trees');
  assert.equal((await forestSnapshot(page)).embers, true, 'Confirmed loss displays an ember patch');
  await screenshot(page, `paused-${width}.png`);
  assert.equal(await page.locator(`${FOREST} [data-forest-recover]`).isVisible(), true);
  await page.locator(`${FOREST} [data-forest-recover]`).click();
  await until(() => page.evaluate(() => document.getElementById('arcade-daily-growth')?.dataset.arcadeView === 'month'), 'Forest recovery link opens Monthly');
  await openRecovery(page, '2026-11-17');
  await page.locator('#monthly-pay').click();
  await until(() => page.evaluate(() => window.__arcadeForestReview.paymentAttempts.length === 1
    && document.getElementById('monthly-status')?.textContent.includes('rejected')), 'Synthetic payment rejection is reported');
  assert.equal(api.calls.filter((call) => call.action === 'verify').length, 0);
  assert.equal(await page.evaluate(() => window.__arcadeForestReview.forest.some((entry) => entry.animation === 'rain')), false);
  assert.equal(api.monthly(A).attendance.checkedInDays, 3);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#monthly-cancel').click();
  await until(() => page.evaluate((key) => !sessionStorage.getItem(key), PENDING), 'Rejected checkout explicitly cleared');

  await page.evaluate(() => { window.__arcadeForestReview.paymentMode = 'approve'; });
  await openRecovery(page, '2026-11-17');
  api.holdVerify = true; api.phase = 'older-date-verification-pending';
  await page.locator('#monthly-pay').click();
  await until(() => api.pendingVerify === 1, 'Fake digest awaits backend verification');
  const pending = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || 'null'), PENDING);
  assert.equal(pending?.digest, DIGEST, 'Digest-only state exists before confirmation');
  assert.equal(api.monthly(A).attendance.checkedInDays, 3);
  assert.equal(await page.evaluate(() => window.__arcadeForestReview.forest.some((entry) => entry.animation === 'rain')), false);
  viewport.checks.pendingRecoveryNoRain = true;
  // Verify while Monthly is visible: the animation should wait for the player
  // to return, so a successful recovery is not celebrated in a hidden panel.
  api.releaseVerify();
  await until(() => page.evaluate((key) => !sessionStorage.getItem(key)
    && /restored|recovered/i.test(document.getElementById('monthly-status')?.textContent || ''), PENDING), 'Older-date attendance verified');
  assert.equal(await page.evaluate(() => window.__arcadeForestReview.forest.some((entry) => entry.animation === 'rain')), false, 'Hidden grove must defer recovery rain');
  const viewGrove = page.locator('#arcade-monthly-panel a[href="#daily"]').filter({ hasText: /view.*grove/i });
  await viewGrove.waitFor({ state: 'visible' }); await viewGrove.click();
  await until(async () => (await forestSnapshot(page))?.animation === 'rain', 'Verified recovery rain starts when the grove becomes visible');
  await expectForest(page, { state: 'paused', count: 4, streak: 0, dates: dates(17, 18, 19, 20) }, 'Older recovered date adds attendance without inventing a current streak');
  const partial = await forestSnapshot(page);
  assert.doesNotMatch(partial.status, /streak (?:is )?restored|streak (?:is )?recovered/i, 'An unrelated recovered date cannot claim to restore the current streak');
  assert.match(partial.status, /17|recovered|restored/i);
  await screenshot(page, `rain-partial-${width}.png`, { motion: true });
  await until(async () => !(await forestSnapshot(page))?.animation, 'First rain finishes');
  await expectForest(page, { state: 'paused', count: 4, streak: 0 }, 'Remaining gap keeps the current streak paused');
  assert.equal(await page.locator('#monthly-count').textContent(), '0 / 20', 'Paid attendance adds no verified quest day');

  await openRecovery(page, '2026-11-21');
  api.holdVerify = true; api.phase = 'connecting-date-verification-pending';
  await page.locator('#monthly-pay').click();
  await until(() => api.pendingVerify === 1, 'Second fake digest awaits verification');
  await chooseTab(page, 'daily');
  const rainCount = await page.evaluate(() => window.__arcadeForestReview.forest.filter((entry) => entry.animation === 'rain').length);
  assert.equal((await forestSnapshot(page)).animation, '', 'A pending digest does not start another rain sequence');
  assert.equal(numberIn((await forestSnapshot(page)).count), 4);
  api.releaseVerify();
  await until(async () => (await forestSnapshot(page))?.animation === 'rain', 'Confirmed connecting date starts rain in visible Daily');
  await expectForest(page, { state: 'growing', count: 5, streak: 5, dates: dates(17, 18, 19, 20, 21) }, 'Verified date repairs the actual consecutive streak');
  assert.ok(await page.evaluate((before) => window.__arcadeForestReview.forest.filter((entry) => entry.animation === 'rain').length > before, rainCount));
  await screenshot(page, `rain-${width}.png`, { motion: true });
  await until(async () => !(await forestSnapshot(page))?.animation, 'Rain returns to a stable grove');
  const restored = await expectForest(page, { state: 'growing', count: 5, streak: 5 }, 'Confirmed repaired streak is shown');
  assert.equal(restored.embers, false, 'The restored run no longer displays embers');
  assert.equal(await page.locator('#monthly-count').textContent(), '0 / 20');
  assert.equal(api.calls.filter((call) => call.action === 'verify').length, 2);
  await assertNoOverflow(page, width, 'recovery grove');
  viewport.checks.missedDayEmbers = true; viewport.checks.verifiedRecoveryRain = true;
}

async function boundaryScenario({ page, api, width, viewport }, monthRollover = false) {
  const before = monthRollover ? dates(27, 28, 29, 30) : dates(19, 20, 21);
  await expectForest(page, { state: 'growing', count: before.length, streak: before.length, dates: before }, 'Pre-boundary snapshot is fresh');
  const almostMidnight = Date.parse(monthRollover ? '2026-11-30T23:59:58.000Z' : '2026-11-22T23:59:58.000Z');
  api.now = almostMidnight;
  await page.clock.setSystemTime(almostMidnight);
  await page.clock.pauseAt(almostMidnight + 5);
  await refresh(page, api, 'near-midnight');
  await until(() => page.evaluate((time) => window.__arcadeForestReview.attendance.some((entry) => entry.fresh && entry.serverTime === time), almostMidnight), 'Clock is anchored to the near-midnight HTTP Date');
  const fresh = await forestSnapshot(page); assert.equal(fresh.embers, false);
  const statusBefore = api.calls.filter((call) => call.path === '/api/arcade-monthly' && call.action === 'status').length;
  api.holdMonthly = true; api.phase = 'utc-boundary-held'; api.now = almostMidnight + 6_000;
  // Allow the component's five-second duplicate-read guard to elapse as well
  // as midnight. The server reply remains held throughout the observation.
  await page.clock.fastForward(6_100);
  await until(() => api.pendingStatus > 0, 'UTC boundary requests authoritative attendance before deciding the new state');
  assert.ok(api.calls.filter((call) => call.path === '/api/arcade-monthly' && call.action === 'status').length > statusBefore);
  const waiting = await forestSnapshot(page);
  assert.ok(['loading', 'stale'].includes(waiting.state), 'Unconfirmed new day must be visibly pending');
  assert.equal(waiting.embers, false, 'Local midnight alone cannot declare a streak lost');
  assert.equal(waiting.animation, '', 'No loss or growth animation before the server responds');
  api.releaseStatus();
  if (monthRollover) {
    const next = await expectForest(page, { count: 0, streak: 4, dates: [] }, 'New month resets only its displayed check-in count');
    assert.notEqual(next.state, 'paused'); assert.equal(next.embers, false);
    await assertDeadline(page, '2026-12-02T00:00:00.000Z', /streak|check.?in.*within|check.?in.*close/i, 86_396);
    viewport.checks.monthRollover = true;
  } else {
    const next = await expectForest(page, { state: 'paused', count: 3, streak: 0, dates: before }, 'Server-confirmed missed day pauses a run but preserves all earlier trees');
    assert.equal(next.embers, true);
  }
  await page.clock.resume();
  await assertNoOverflow(page, width, monthRollover ? 'month rollover' : 'UTC lapse');
  await screenshot(page, `${monthRollover ? 'month-rollover' : 'utc-lapse'}-${width}.png`);
}

try {
  assert.ok(!process.env.ARCADE_FOREST_LOCAL, 'Candidate review cannot use local asset overlays.');
  assert.ok(process.env.ARCADE_FOREST_ORIGIN, 'Set ARCADE_FOREST_ORIGIN to the exact candidate origin.');
  const target = new URL(process.env.ARCADE_FOREST_ORIGIN);
  assert.equal(target.pathname, '/');
  assert.ok(!target.search && !target.hash && !target.username && !target.password);
  assert.equal(target.protocol, 'https:');
  origin = target.origin; report.origin = origin;
  const planPath = path.join(root, '.netlify/arcade-attendance-forest/plan.json');
  const candidatePath = path.join(root, '.netlify/arcade-attendance-forest/candidate.json');
  assert.ok(fs.existsSync(planPath) && fs.existsSync(candidatePath), 'Both source plan and candidate record are required for bound evidence.');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  assert.match(plan.sourceCommit, /^[a-f0-9]{40}$/); assert.match(plan.sourceTree, /^[a-f0-9]{40}$/);
  assert.equal(candidate.sourceCommit, plan.sourceCommit); assert.equal(candidate.planSha256, fingerprint(plan));
  assert.match(candidate.id, /^[a-f0-9]{24}$/);
  const candidateOrigin = new URL(candidate.deployUrl || candidate.deploy_url || `https://${candidate.id}--tree-token.netlify.app`).origin;
  assert.equal(origin, candidateOrigin, 'Evidence must come from the recorded candidate origin.');
  Object.assign(report, { sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree,
    candidateId: candidate.id, planSha256: fingerprint(plan) });
  const modulePath = process.env.ARCADE_PLAYWRIGHT_MODULE
    || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
  const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
  browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE || undefined });
  const scenarios = [
    ['growing', { checked: dates(2, 5, 10, 18, 19, 20, 21, 22) }, growingScenario],
    ['free-checkin', { checked: dates(18, 19, 20, 21) }, (input) => checkInScenario(input)],
    ['recovery', { checked: dates(18, 19, 20) }, recoveryScenario],
    ['utc-boundary', { now: '2026-11-22T23:50:00.000Z', checked: dates(19, 20, 21) }, (input) => boundaryScenario(input)],
    ['month-rollover', { now: '2026-11-30T23:50:00.000Z', checked: dates(27, 28, 29, 30) }, (input) => boundaryScenario(input, true)],
    ['reduced-motion', { checked: dates(18, 19, 20, 21), reducedMotion: true }, (input) => checkInScenario(input, true)],
  ];
  viewportLoop: for (const width of widths) {
    const viewport = { width, checks: Object.fromEntries(checkNames.map((name) => [name, false])), scenarios: [] };
    report.viewports.push(viewport);
    for (const [name, options, run] of scenarios) {
      const result = await scenario(viewport, name, options, run);
      if (result.setupFailed) {
        report.abortedAfterSharedSetupFailure = { width, scenario: name };
        console.error('Stopped after shared initialization failed; remaining coverage is unverified and the report cannot pass.');
        break viewportLoop;
      }
    }
  }
  for (const name of checkNames) report.checks[name] = report.viewports.length === widths.length && report.viewports.every((viewport) => viewport.checks[name]);
  if (!report.failures.length && !report.browserErrors.length && !report.assetFailures.length && !report.unexpectedWrites.length
    && Object.values(report.checks).every(Boolean) && report.viewports.length === widths.length
    && report.viewports.reduce((sum, viewport) => sum + viewport.scenarios.length, 0) === report.expectedScenarioCount
    && report.viewports.every((viewport) => viewport.scenarios.length === scenarios.length
      && viewport.scenarios.every((scenario, index) => scenario.name === scenarios[index][0] && scenario.result === 'passed'))) report.result = 'passed';
} catch (error) {
  report.failures.push({ message: error.message, stack: error.stack });
} finally {
  if (browser) await browser.close();
  report.checkedAt = new Date().toISOString();
  report.attemptedScenarioCount = report.viewports.reduce((sum, viewport) => sum + viewport.scenarios.length, 0);
  report.passedScenarioCount = report.viewports.reduce((sum, viewport) => sum + viewport.scenarios.filter((item) => item.result === 'passed').length, 0);
  fs.writeFileSync(path.join(output, 'browser-review.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, origin: report.origin, output, checks: report.checks,
    expectedScenarioCount: report.expectedScenarioCount, attemptedScenarioCount: report.attemptedScenarioCount,
    passedScenarioCount: report.passedScenarioCount,
    setupFailure: report.viewports.flatMap((viewport) => viewport.scenarios).find((item) => item.setupFailed)?.setupDiagnostics || null,
    failures: report.failures.map(({ width, scenario, message }) => ({ width, scenario, message })),
    browserErrors: report.browserErrors, assetFailures: report.assetFailures, unexpectedWrites: report.unexpectedWrites,
    screenshots: report.screenshots }, null, 2));
  if (report.result !== 'passed') process.exitCode = 1;
}
