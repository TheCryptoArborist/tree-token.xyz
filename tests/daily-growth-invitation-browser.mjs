// Targeted native-browser QA. All wallet actions and Daily Growth responses are
// in-memory fixtures; no real account, signature, API write, or transaction is used.
// Run with the local project server already listening on 127.0.0.1:8765.
// ARCADE_CHROMIUM_PATH may point to a separately installed Chrome-for-Testing.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, X509Certificate } from 'node:crypto';
import https from 'node:https';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE = process.env.GROWTH_INVITATION_BASELINE || '/workspace/scratch/68c975ebd06c/growth-invitation-baseline';
const ORIGIN = process.env.GROWTH_INVITATION_ORIGIN || 'http://127.0.0.1:8765';
assert.equal(new URL(ORIGIN).hostname, '127.0.0.1', 'The fixture runner permits only the local test server');
const OUT = resolve(ROOT, 'docs/review/daily-growth-invitation');
await mkdir(OUT, { recursive: true });

// Optional small hosted check: node --use-env-proxy this-file --hosted ORIGIN.
// This branch uses the actual hosted modules. It does not install fixtures,
// click Connect, sign messages, or permit network methods other than GET/HEAD.
async function checkHosted(target) {
  const origin = new URL(target).origin;
  assert(origin === 'https://tree-token.xyz' || /^https:\/\/[a-f0-9]{24}--tree-token\.netlify\.app$/.test(origin), 'Unexpected hosted target');
  const label = origin === 'https://tree-token.xyz' ? 'canonical' : 'candidate';
  const ca = new X509Certificate(await readFile('/usr/local/share/ca-certificates/nebula-dns.crt'));
  const pin = createHash('sha256').update(ca.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
  const tls = await new Promise((done, reject) => {
    const request = https.get(origin + '/play/', response => {
      const value = { authorized: response.socket.authorized, status: response.statusCode };
      response.resume(); response.on('end', () => done(value));
    }); request.on('error', reject);
  });
  assert(tls.authorized && tls.status === 200, 'Target TLS is independently verified using the configured CA');
  const browser = await chromium.launch({ executablePath: process.env.ARCADE_CHROMIUM_PATH || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors-spki-list=' + pin] });
  const requests = [], responses = [], blocked = [], errors = [], consoleErrors = [], dimensions = [], screenshots = [], checks = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request(); const item = { url: request.url(), method: request.method() }; requests.push(item);
    if (new URL(item.url).origin !== origin || !['GET', 'HEAD'].includes(item.method)) { blocked.push(item); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => responses.push({ url: response.url(), status: response.status() }));
  let configuration;
  try {
    const statusResponse = page.waitForResponse(response => {
      const url = new URL(response.url()); return url.pathname === '/api/arcade-growth' && url.searchParams.get('action') === 'status';
    });
    await page.goto(origin + '/play/', { waitUntil: 'domcontentloaded' });
    const publicStatus = await (await statusResponse).json();
    assert.equal(publicStatus.status, 'ok'); assert.equal(publicStatus.authenticated, false); assert.equal(Object.hasOwn(publicStatus, 'progress'), false);
    configuration = publicStatus.configuration;
    assert(Array.isArray(configuration?.enabledGames) && Array.isArray(configuration?.eligibleGames));
    await page.waitForFunction(() => document.getElementById('arcade-daily-growth')?.dataset.growthState === 'signed-out' && !document.getElementById('growth-connect').disabled, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => typeof window.__fixtureOptions), 'undefined', 'No fixture is installed on the hosted page');
    assert(responses.some(response => new URL(response.url).pathname === '/assets/arcade/arcade-growth-wallet.js' && response.status === 200), 'The actual wallet module loads');
    assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), null);
    checks.push({ name: 'Actual public status and wallet module load without private progress or fixtures', passed: true });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur?.(); scrollTo(0, 0); });
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => ['.suite-hero-art', '#growth-summary-art', '.game-poster .poster-art'].every(selector => {
        const image = document.querySelector(selector); return image?.complete && image.naturalWidth > 0;
      }), null, { timeout: 15000 });
      const sizes = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scrollY, height: r.height, width: r.width }; };
        return { viewport: { width: innerWidth, height: innerHeight }, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster'), scrollWidth: document.documentElement.scrollWidth, detailsOpen: document.getElementById('growth-details').open };
      }); dimensions.push(sizes);
      assert.equal(sizes.detailsOpen, false); assert(sizes.scrollWidth <= viewport.width + 1);
      assert(sizes.panel.height <= (viewport.width >= 1000 ? 190 : 270)); assert(sizes.firstPoster.top < viewport.height);
      assert(await page.getByRole('button', { name: 'Connect to check in', exact: true }).isVisible());
      assert.equal(await page.locator('#growth-details-label').textContent(), 'Reveal today’s quest');
      const screenshot = resolve(OUT, `${label}-signedout-${viewport.width}.jpg`);
      await page.screenshot({ path: screenshot, type: 'jpeg', quality: 80, animations: 'disabled' }); screenshots.push(screenshot);
      const summary = page.locator('#growth-details > summary');
      const apiBefore = requests.filter(item => new URL(item.url).pathname === '/api/arcade-growth').length;
      await summary.focus(); await page.keyboard.press('Enter');
      assert(await page.locator('#growth-details').evaluate(element => element.open));
      assert.equal(await page.locator('#growth-today-tab').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#growth-badge-preview').getAttribute('aria-expanded'), 'true');
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#growth-details').evaluate(element => element.open), false);
      await page.locator('#growth-invitation-open').focus(); await page.keyboard.press('Space');
      assert.equal(await page.locator('#growth-today-tab').getAttribute('aria-selected'), 'true');
      assert(await page.locator('#growth-details').evaluate(element => element.open));
      await summary.click();
      assert.equal(requests.filter(item => new URL(item.url).pathname === '/api/arcade-growth').length, apiBefore);
      checks.push({ name: `${viewport.width}px actual invitation, keyboard disclosure and headline work without API actions`, passed: true });
    }
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert(responses.every(response => response.status === 200));
    const report = { passed: true, actualHostedCode: true, synthetic: false, target: origin + '/play/', label, checkedAt: new Date().toISOString(), tls, configuration, checks, dimensions, screenshots, requests, responses, blockedRequests: blocked, pageErrors: errors, consoleErrors, noWalletConnected: true, noSignatures: true, noRemoteWrites: true };
    await writeFile(resolve(OUT, `${label}-browser-report.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, label, checks: checks.length, requests: requests.length, responses: responses.length, dimensions, report: resolve(OUT, `${label}-browser-report.json`) }));
  } catch (error) {
    await writeFile(resolve(OUT, `${label}-browser-report.json`), JSON.stringify({ passed: false, error: String(error), checks, dimensions, screenshots, requests, responses, blockedRequests: blocked, pageErrors: errors, consoleErrors }, null, 2) + '\n');
    throw error;
  } finally { await browser.close(); }
}
if (process.argv[2] === '--hosted') {
  assert(process.argv[3], 'Pass the authorized candidate or canonical URL');
  await checkHosted(process.argv[3]);
  process.exit(0);
}

const sourceFiles = ['play/index.html', 'scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css'];
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, await readFile(resolve(ROOT, file))])));
const sourceSha256 = Object.fromEntries(Object.entries(sources).map(([file, bytes]) => [file, createHash('sha256').update(bytes).digest('hex')]));
const originalScript = sources['scripts/arcade-daily-growth.js'].toString();
const bootstrap = 'if (root) createDailyGrowth({ root });';
assert.equal(originalScript.split(bootstrap).length, 2, 'Replace only the controller auto-start for fixture injection');
const fixtureScript = originalScript.replace(bootstrap, `if (root) {
    const controller = createDailyGrowth({ root, ...window.__fixtureOptions });
    window.__fixtureController = controller;
    controller.ready.then(() => { window.__fixtureReady = true; });
  }`);
const configuration = JSON.parse(await readFile(resolve(BASELINE, 'api/arcade-growth'), 'utf8')).configuration;
const missingArtPath = '/play/canopy-defense/assets/brand/oak-guardian-preview.png';
const missingArt = await readFile(resolve(BASELINE, missingArtPath.slice(1)));

function installFixture({ mode, configuration }) {
  const ACCOUNT = `0x${'a'.repeat(64)}`;
  const OTHER = `0x${'b'.repeat(64)}`;
  const NOW = Date.parse('2026-11-12T12:00:00Z');
  const walletName = 'Synthetic QA wallet';
  const goals = [
    { id: 'seedling', label: 'Seedling', target: 3 },
    { id: 'sapling', label: 'Sapling', target: 7 },
    { id: 'deep-roots', label: 'Deep Roots', target: 14 },
    { id: 'full-canopy', label: 'Full Canopy', target: 21 },
  ];
  const calls = [];
  const authenticated = !['signedout', 'unavailable'].includes(mode);
  let walletState = authenticated
    ? { connected: true, address: ACCOUNT, walletId: walletName, walletName }
    : { connected: false, address: null, walletId: null, walletName: null };
  const listeners = new Set();
  const makeProgress = (visits = [1, 3], quests = [3]) => {
    const calendar = Array.from({ length: 30 }, (_, index) => ({
      dateKey: `2026-11-${String(index + 1).padStart(2, '0')}`,
      checkedIn: visits.includes(index + 1), questCompleted: quests.includes(index + 1),
      gameIds: quests.includes(index + 1) ? ['garden-bot'] : [],
    }));
    const today = calendar[11];
    return {
      wallet: ACCOUNT, monthKey: '2026-11', dateKey: '2026-11-12', calendar,
      checkedInDays: visits.length, questDays: quests.length,
      today: { checkedIn: today.checkedIn, questCompleted: today.questCompleted, gameIds: today.gameIds },
      passport: { monthKey: '2026-11', enabledGames: configuration.enabledGames, completedGameIds: ['garden-bot'], optionalGames: [], optionalCompletedGameIds: [], complete: false },
      milestones: goals.map(goal => ({ ...goal, earned: visits.length >= goal.target })),
      badges: visits.length >= 3 ? [{ id: '2026-11-seedling', label: 'Seedling', monthKey: '2026-11', earnedAt: '2026-11-12T12:00:00Z' }] : [],
    };
  };
  let savedProgress = mode === 'complete' ? makeProgress([1, 3, 12], [3, 12]) : makeProgress();
  const memory = new Map();
  if (authenticated) memory.set('tree-arcade:daily-growth:session:v1', JSON.stringify({
    version: 1, wallet: ACCOUNT, walletId: walletName, walletName,
    token: 'synthetic-browser-fixture-token', expiresAt: new Date(NOW + 3600000).toISOString(),
  }));
  const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const changeWallet = address => {
    walletState = address ? { connected: true, address, walletId: walletName, walletName } : { connected: false, address: null, walletId: null, walletName: null };
    for (const listener of listeners) listener(walletState);
  };
  const wallet = {
    getWalletState: () => walletState,
    getAvailableWallets: () => [{ id: walletName, name: walletName }],
    async connectWallet() { calls.push({ type: 'wallet-connect', synthetic: true }); changeWallet(ACCOUNT); return walletState; },
    async restoreWallet() { calls.push({ type: 'wallet-restore', synthetic: true }); changeWallet(ACCOUNT); return walletState; },
    async disconnectWallet() { calls.push({ type: 'wallet-disconnect', synthetic: true }); changeWallet(null); },
    async signPersonalMessage() { calls.push({ type: 'synthetic-signature', synthetic: true }); return { signature: 'synthetic-message-signature' }; },
    subscribeWalletState(listener) { listeners.add(listener); queueMicrotask(() => listener(walletState)); return () => listeners.delete(listener); },
    subscribeWallets() { return () => {}; },
  };
  const controls = {
    calls, holdCheckIn: false, releaseCheckIn: null, failCheckIn: false, failSync: false,
    accountChange() { changeWallet(OTHER); },
    setComplete() { savedProgress = makeProgress([1, 3, 12], [3, 12]); },
    count(action) { return calls.filter(call => call.action === action).length; },
  };
  const envelope = (isAuthenticated = true) => ({
    status: 'ok', serverTime: new Date(NOW).toISOString(), dateKey: '2026-11-12', monthKey: '2026-11',
    authenticated: isAuthenticated, configuration,
    ...(isAuthenticated ? { progress: structuredClone(savedProgress) } : {}),
  });
  async function fetchImpl(url, init) {
    const action = new URL(url, location.href).searchParams.get('action');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ type: 'api', action, method: init.method, transport: 'in-memory fixture; no network' });
    let payload;
    if ((mode === 'unavailable' && action === 'status') || (controls.failSync && action === 'sync') || (controls.failCheckIn && action === 'check-in')) {
      payload = { status: 'error', error: 'service-unavailable', message: 'Synthetic service unavailable.' };
    } else if (action === 'status') payload = envelope(Boolean(init.headers.Authorization));
    else if (action === 'challenge') payload = { status: 'ok', challenge: {
      challengeId: 'synthetic-challenge', wallet: body.wallet,
      message: `Sign in to TREE Arcade Daily Growth\nWallet: ${body.wallet}\nNo transaction is submitted.`,
      expiresAt: new Date(NOW + 300000).toISOString(), dateKey: '2026-11-12',
    } };
    else if (action === 'session') payload = { ...envelope(), session: { token: 'synthetic-browser-fixture-token', wallet: body.wallet, expiresAt: new Date(NOW + 3600000).toISOString() } };
    else if (action === 'sync') payload = { ...envelope(), sync: { checkedAt: new Date(NOW).toISOString(), games: configuration.eligibleGames.map(game => ({ gameId: game.id, status: 'no-result' })) } };
    else if (action === 'check-in') {
      if (controls.holdCheckIn) await new Promise(done => { controls.releaseCheckIn = done; });
      const visits = [...new Set([...savedProgress.calendar.filter(day => day.checkedIn).map(day => Number(day.dateKey.slice(-2))), 12])];
      const quests = savedProgress.calendar.filter(day => day.questCompleted).map(day => Number(day.dateKey.slice(-2)));
      savedProgress = makeProgress(visits, quests); payload = envelope();
    } else if (action === 'logout') payload = { status: 'ok' };
    else throw new Error(`Unexpected fixture API action: ${action}`);
    return { ok: payload.status === 'ok', status: payload.status === 'ok' ? 200 : 503, json: async () => payload };
  }
  window.__invitationFixture = controls;
  window.__fixtureOptions = { fetchImpl, loadWallet: async () => wallet, storage, now: () => NOW };
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link && !link.getAttribute('href')?.startsWith('#')) event.preventDefault();
  });
}

const browser = await chromium.launch({ executablePath: process.env.ARCADE_CHROMIUM_PATH || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const checks = [], dimensions = [], screenshots = [], errors = [], consoleErrors = [], blockedRequests = [], remoteWrites = [];
let context, page;
async function open(mode, viewport) {
  await context?.close();
  context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(installFixture, { mode, configuration });
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { remoteWrites.push({ url: request.url(), method: request.method() }); return route.abort(); }
    if (url.origin !== ORIGIN) { blockedRequests.push(request.url()); return route.abort(); }
    if (url.pathname === '/scripts/arcade-daily-growth.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: fixtureScript });
    if (url.pathname === missingArtPath) return route.fulfill({ status: 200, contentType: 'image/png', body: missingArt });
    if (url.pathname === '/api/arcade-growth') throw new Error('The real Daily Growth API must never be contacted by this fixture');
    return route.continue();
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ mode, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ mode, message: message.text() }); });
  await page.goto(ORIGIN + '/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fixtureReady, null, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => ['.suite-hero-art', '#growth-summary-art', '.game-poster .poster-art'].every(selector => {
    const image = document.querySelector(selector); return image?.complete && image.naturalWidth > 0;
  }), null, { timeout: 10000 });
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
}
async function capture(name) {
  const file = resolve(OUT, name + '.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 80, animations: 'disabled' }); screenshots.push(file);
}
async function bounds(mode) {
  const result = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scrollY, height: r.height, width: r.width }; };
    const overflow = [...document.querySelectorAll('body *')].filter(element => {
      const r = element.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1) && getComputedStyle(element).position !== 'fixed';
    }).slice(0, 12).map(element => ({ tag: element.tagName, id: element.id, class: element.className, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
    return { viewport: { width: innerWidth, height: innerHeight }, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster'), scrollWidth: document.documentElement.scrollWidth, open: document.getElementById('growth-details').open, overflowingElements: overflow };
  }); result.mode = mode; dimensions.push(result);
  assert.equal(result.open, false); assert(result.scrollWidth <= result.viewport.width + 1, 'No horizontal page overflow');
  assert(result.panel.height <= (result.viewport.width >= 1000 ? 190 : 270), `${mode} panel too tall at ${result.viewport.width}: ${result.panel.height}`);
  assert(result.firstPoster.top < result.viewport.height, 'The first game must begin in the initial viewport');
  return result;
}
const detail = () => page.locator('#growth-details');
const calls = () => page.evaluate(() => window.__invitationFixture.calls);
async function closeDetails() { if (await detail().evaluate(element => element.open)) await page.locator('#growth-details > summary').click(); }
async function assertOpenTab(tab) {
  assert(await detail().evaluate(element => element.open));
  assert.equal(await page.locator(`#growth-${tab}-tab`).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#growth-badge-preview').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#growth-invitation-open').getAttribute('aria-expanded'), 'true');
}
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    for (const mode of ['signedout', 'nearbadge']) {
      await open(mode, viewport); await bounds(mode); await capture(`${mode}-${viewport.width}`);
      if (mode === 'signedout') {
        assert(await page.getByRole('button', { name: 'Connect to check in', exact: true }).isVisible());
        assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), null);
        assert.equal(await page.locator('#growth-summary-art-label').textContent(), 'Seedling');
      } else {
        assert.equal(await page.locator('#growth-summary-count').textContent(), 'One more check-in to Seedling');
        assert.equal(await page.locator('#growth-summary-label').textContent(), '2 / 3 check-ins');
        assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), '2');
        assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuemax'), '3');
      }
      checks.push({ name: `${mode} invitation is compact and readable at ${viewport.width}`, passed: true });
    }
  }
  console.log(JSON.stringify({ stage: 'screenshots-ready', dimensions, screenshots }));

  await open('signedout', { width: 1440, height: 900 });
  const before = (await calls()).length;
  await page.locator('#growth-details > summary').focus(); await page.keyboard.press('Enter'); await assertOpenTab('today'); await closeDetails();
  await page.locator('#growth-badge-preview').focus(); await page.keyboard.press('Space'); await assertOpenTab('today'); await closeDetails();
  await page.locator('#growth-invitation-open').focus(); await page.keyboard.press('Enter'); await assertOpenTab('today'); await closeDetails();
  assert.equal((await calls()).length, before, 'Invitation controls only reveal local UI');
  checks.push({ name: 'Keyboard summary, artwork and headline reveal Today without requests or wallet prompts', passed: true });
  await page.getByRole('button', { name: 'Connect to check in', exact: true }).click();
  await page.locator('.growth-wallet-option').click();
  await page.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'connected');
  assert.equal(await page.evaluate(() => window.__invitationFixture.count('check-in')), 0);
  assert.equal((await calls()).filter(call => call.type === 'synthetic-signature').length, 0);
  await page.getByRole('button', { name: 'Sign in to check in', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'authenticated');
  assert.equal(await page.evaluate(() => window.__invitationFixture.count('check-in')), 0);
  assert.equal(await detail().evaluate(element => element.open), false);
  checks.push({ name: 'Connect and separate sign-in never automatically check in', passed: true });

  await page.evaluate(() => { window.__invitationFixture.holdCheckIn = true; });
  await page.locator('#growth-check-in').click();
  await page.waitForFunction(() => Boolean(window.__invitationFixture.releaseCheckIn));
  assert(await page.locator('#growth-check-in').isDisabled());
  assert.equal(await page.locator('#growth-summary-label').textContent(), '2 / 3 check-ins');
  await page.locator('#growth-check-in').evaluate(button => button.click());
  assert.equal(await page.evaluate(() => window.__invitationFixture.count('check-in')), 1);
  await page.evaluate(() => window.__invitationFixture.releaseCheckIn());
  await page.waitForFunction(() => document.getElementById('growth-invitation-title').textContent === 'You’re checked in. Quest time?');
  assert.equal(await detail().evaluate(element => element.open), false);
  assert.equal(await page.locator('#growth-summary-art-label').textContent(), 'Sapling');
  assert.equal(await page.locator('#growth-summary-label').textContent(), '3 / 7 check-ins');
  assert.equal(await page.locator('#growth-details-label').textContent(), 'Reveal today’s quest');
  checks.push({ name: 'Direct check-in waits for the saved response, writes once, keeps details closed and advances the badge preview', passed: true });

  await page.evaluate(async () => { window.__invitationFixture.setComplete(); await window.__fixtureController.refresh(); });
  assert.equal(await page.locator('#growth-invitation-title').textContent(), 'Today’s growth is complete.');
  assert.equal(await page.locator('#growth-details-label').textContent(), 'View badge progress');
  await page.locator('#growth-badge-preview').click(); await assertOpenTab('badges'); await closeDetails();
  await page.locator('#growth-invitation-open').click(); await assertOpenTab('badges'); await closeDetails();
  await page.locator('#growth-details > summary').focus(); await page.keyboard.press('Space'); await assertOpenTab('badges'); await closeDetails();
  checks.push({ name: 'Both saved daily actions change the invitation and route all entry points to Badges', passed: true });

  await page.evaluate(async () => { window.__invitationFixture.failSync = true; await window.__fixtureController.refresh(); });
  assert.match(await page.locator('#growth-summary-label').textContent(), /Last saved/);
  assert.match(await page.locator('#growth-summary-note').textContent(), /Last saved progress/);
  assert.equal(await page.locator('#growth-invitation-title').textContent(), 'Let’s catch up on your growth.');
  assert.equal(await page.locator('#growth-details-label').textContent(), 'Reveal today’s quest');
  assert(await page.locator('#growth-status').isVisible());
  await capture('stale-desktop');
  await page.evaluate(() => window.__invitationFixture.accountChange());
  assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), null);
  assert(await page.locator('#growth-summary-meter').isHidden());
  assert.equal(await page.locator('#growth-summary-art-label').textContent(), 'Seedling');
  assert.equal(await page.locator('#growth-badge-preview').getAttribute('class').then(value => value.includes('is-complete')), false);
  assert(await page.locator('#growth-check-in').isHidden());
  checks.push({ name: 'Stale completion is explicitly labeled and account changes immediately clear private badge progress', passed: true });

  await open('nearbadge', { width: 320, height: 740 });
  await page.evaluate(() => { window.__invitationFixture.failCheckIn = true; });
  await page.locator('#growth-check-in').click();
  await page.waitForFunction(() => !document.getElementById('growth-check-in').disabled);
  assert.equal(await page.locator('#growth-summary-label').textContent(), '2 / 3 check-ins · Last saved');
  assert(await page.locator('#growth-status').isVisible());
  assert.equal(await detail().evaluate(element => element.open), false);
  await capture('failed-check-in-mobile');
  checks.push({ name: 'Failed check-in preserves the saved count and exposes the error while details remain closed', passed: true });

  await open('unavailable', { width: 390, height: 844 });
  assert.equal(await page.locator('#growth-summary-label').textContent(), 'Progress temporarily unavailable');
  assert.equal(await page.locator('#growth-summary-note').textContent(), 'We couldn’t load Daily Growth. Please try again shortly.');
  assert.equal(await page.locator('#growth-invitation-hint').textContent(), 'Your saved progress has not changed.');
  assert(await page.locator('#growth-summary-meter').isHidden());
  assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), null);
  assert(await page.locator('#growth-status').isVisible());
  assert.equal(await detail().evaluate(element => element.open), false);
  checks.push({ name: 'Unavailable anonymous progress clearly explains the error without fabricated counts or completion', passed: true });

  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(remoteWrites, []);
  for (const file of sourceFiles) assert.equal(createHash('sha256').update(await readFile(resolve(ROOT, file))).digest('hex'), sourceSha256[file], 'Source remains unchanged throughout the browser run');
  const report = { passed: true, synthetic: true, sourceSha256, testedAt: new Date().toISOString(), fixtureScope: 'Only controller auto-start is injected; wallet and all API actions are in-memory synthetic fixtures. No actual account, signature, write request or transaction.', baselineArtworkFallback: missingArtPath, checks, dimensions, screenshots, pageErrors: errors, consoleErrors, blockedRequests, remoteWrites };
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, dimensions, report: resolve(OUT, 'browser-report.json') }));
} catch (error) {
  const report = { passed: false, synthetic: true, error: String(error), sourceSha256, checks, dimensions, screenshots, pageErrors: errors, consoleErrors, blockedRequests, remoteWrites };
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
} finally { await browser.close(); }
