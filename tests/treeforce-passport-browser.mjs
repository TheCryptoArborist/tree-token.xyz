// Targeted native-browser Passport review. Every account and progress response is
// explicitly synthetic. Only the controller bootstrap is changed for injection;
// all HTML, CSS, controller behavior, and ecosystem artwork use local source bytes.
// No server, real wallet, signature, remote API request, or transaction is used.
// ARCADE_CHROMIUM_PATH may point to an installed Chrome-for-Testing binary.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/review/treeforce-passport');
const ORIGIN = 'https://treeforce-passport-qa.invalid';
const BASELINE = process.env.GROWTH_INVITATION_BASELINE || '/workspace/scratch/68c975ebd06c/growth-invitation-baseline';
const BROWSER = process.env.ARCADE_CHROMIUM_PATH || '/tmp/daily-growth-invitation-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const ACCOUNT = `0x${'a'.repeat(64)}`;
const NOW = Date.parse('2026-11-12T12:00:00Z');
const gardenGames = [
  { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot', creditRule: 'complete-result' },
  { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp', creditRule: 'complete-result' },
  { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials', creditRule: 'complete-result' },
];
const treeForce = { id: 'treeforce89', label: 'TREE FORCE ’89', href: 'https://tree-token.xyz/play/treeforce89/', creditRule: 'start-run' };
const games = [...gardenGames, treeForce];
const configuration = { enabledGames: games, eligibleGames: games, todayPick: treeForce };
const milestones = [
  { id: 'seedling', label: 'Seedling', target: 3 },
  { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 },
  { id: 'full-canopy', label: 'Full Canopy', target: 21 },
];

function progress({ historic = false, recorded = false } = {}) {
  const monthKey = historic ? '2026-10' : '2026-11';
  const todayNumber = historic ? 31 : 12;
  const dateKey = `${monthKey}-${todayNumber}`;
  const visits = recorded ? [1, 3, todayNumber] : [1, 3];
  const quests = recorded ? [3, todayNumber] : [3];
  const calendar = Array.from({ length: historic ? 31 : 30 }, (_, index) => ({
    dateKey: `${monthKey}-${String(index + 1).padStart(2, '0')}`,
    checkedIn: visits.includes(index + 1), questCompleted: quests.includes(index + 1),
    gameIds: index + 1 === 3 ? gardenGames.map(game => game.id) : recorded && index + 1 === todayNumber ? [treeForce.id] : [],
  }));
  const enabledGames = historic ? gardenGames : games;
  const completedGameIds = historic || !recorded ? gardenGames.map(game => game.id) : games.map(game => game.id);
  const complete = completedGameIds.length === enabledGames.length;
  const today = calendar[todayNumber - 1];
  const badges = [];
  if (visits.length >= 3) badges.push({ id: `${monthKey}-seedling`, label: 'Seedling', monthKey, earnedAt: `${dateKey}T12:00:00Z` });
  if (complete) badges.push({ id: `${monthKey}-arcade-passport`, label: 'Arcade Passport', monthKey, earnedAt: `${dateKey}T12:00:00Z` });
  return {
    wallet: ACCOUNT, monthKey, dateKey, calendar, checkedInDays: visits.length, questDays: quests.length,
    today: { checkedIn: today.checkedIn, questCompleted: today.questCompleted, gameIds: today.gameIds },
    passport: { monthKey, enabledGames, completedGameIds, complete,
      optionalGames: historic ? [treeForce] : [], optionalCompletedGameIds: historic && recorded ? [treeForce.id] : [] },
    milestones: milestones.map(goal => ({ ...goal, earned: visits.length >= goal.target })), badges,
  };
}
const fixtures = {
  synthetic: true,
  description: 'Synthetic browser-only progress, never a real player record. November has four required games; October preserves three required games plus the optional first-wave stamp.',
  now: NOW, account: ACCOUNT, configuration,
  beforeTreeForce: progress(), afterTreeForce: progress({ recorded: true }), historicOctober: progress({ historic: true, recorded: true }),
};
await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, 'synthetic-fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n');
const sourceFiles = ['play/index.html', 'scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css'];
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, await readFile(resolve(ROOT, file))])));
const sourceSha256 = Object.fromEntries(Object.entries(sources).map(([file, bytes]) => [file, createHash('sha256').update(bytes).digest('hex')]));
const bootstrap = 'if (root) createDailyGrowth({ root });';
const originalScript = sources['scripts/arcade-daily-growth.js'].toString();
assert.equal(originalScript.split(bootstrap).length, 2, 'Only the controller auto-start is replaced');
const fixtureScript = originalScript.replace(bootstrap, `if (root) {
    const controller = createDailyGrowth({ root, ...window.__passportFixture.options });
    window.__passportController = controller;
    controller.ready.then(() => { window.__passportReady = true; });
  }`);
const baselineReport = JSON.parse(await readFile(resolve(ROOT, 'docs/review/daily-growth-invitation/browser-report.json'), 'utf8'));
const fallbackArtwork = '/play/canopy-defense/assets/brand/oak-guardian-preview.png';
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function installFixture({ mode, fixtures }) {
  const authenticated = mode !== 'signedout';
  const walletName = 'Synthetic Passport QA wallet';
  const calls = [];
  let savedProgress = structuredClone(mode === 'historic' ? fixtures.historicOctober : fixtures.beforeTreeForce);
  const walletState = authenticated ? { connected: true, address: fixtures.account, walletName } : { connected: false, address: null, walletName: null };
  const memory = new Map();
  if (authenticated) memory.set('tree-arcade:daily-growth:session:v1', JSON.stringify({
    version: 1, wallet: fixtures.account, walletId: walletName, walletName,
    token: 'synthetic-passport-review-session', expiresAt: new Date(fixtures.now + 3600000).toISOString(),
  }));
  const forbidden = action => { calls.push({ type: 'forbidden-wallet-action', action }); throw new Error(`Wallet interaction is forbidden in Passport review: ${action}`); };
  const wallet = {
    getWalletState: () => walletState, getAvailableWallets: () => [],
    connectWallet: () => forbidden('connect'), restoreWallet: () => forbidden('restore'),
    disconnectWallet: () => forbidden('disconnect'), signPersonalMessage: () => forbidden('sign'),
    subscribeWalletState(listener) { queueMicrotask(() => listener(walletState)); return () => {}; }, subscribeWallets() { return () => {}; },
  };
  const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  async function fetchImpl(url, init) {
    const action = new URL(url, location.href).searchParams.get('action');
    calls.push({ type: 'api', action, method: init.method, synthetic: true, transport: 'in-memory response; no network' });
    if (!['status', 'sync'].includes(action)) throw new Error(`Unexpected Passport fixture action: ${action}`);
    const isAuthenticated = Boolean(init.headers.Authorization);
    const payload = {
      status: 'ok', serverTime: new Date(fixtures.now).toISOString(), dateKey: savedProgress.dateKey, monthKey: savedProgress.monthKey,
      authenticated: isAuthenticated, configuration: fixtures.configuration,
      ...(isAuthenticated ? { progress: structuredClone(savedProgress) } : {}),
      ...(action === 'sync' ? { sync: { checkedAt: new Date(fixtures.now).toISOString(), games: fixtures.configuration.eligibleGames.map(game => ({ gameId: game.id, status: game.id === 'treeforce89' && savedProgress.today.gameIds.includes(game.id) ? 'recorded' : 'no-result' })) } } : {}),
    };
    return { ok: true, status: 200, json: async () => payload };
  }
  window.__passportFixture = {
    calls,
    recordTreeForce() { savedProgress = structuredClone(fixtures.afterTreeForce); },
    options: { fetchImpl, loadWallet: async () => wallet, storage, now: () => fixtures.now },
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link && !link.getAttribute('href')?.startsWith('#')) event.preventDefault();
  });
}

const checks = [], dimensions = [], screenshots = [], pageErrors = [], consoleErrors = [], blockedRequests = [], networkWrites = [], fixtureCalls = [], artworkFallbacks = [];
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let context, page;
async function open(mode, viewport) {
  await context?.close();
  context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(installFixture, { mode, fixtures });
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { networkWrites.push({ url: request.url(), method: request.method() }); return route.abort(); }
    if (url.origin !== ORIGIN || url.pathname.startsWith('/api/')) { blockedRequests.push(request.url()); return route.abort(); }
    if (url.pathname === '/scripts/arcade-daily-growth.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: fixtureScript });
    const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
    const file = resolve(ROOT, `.${decodeURIComponent(pathname)}`);
    assert(file.startsWith(ROOT + sep), 'Only project resources can be fulfilled');
    let body;
    try { body = await readFile(file); }
    catch (error) {
      if (url.pathname !== fallbackArtwork) { blockedRequests.push({ path: pathname, error: error.code }); return route.fulfill({ status: 404, body: 'Missing local test resource' }); }
      body = await readFile(resolve(BASELINE, fallbackArtwork.slice(1)));
      if (!artworkFallbacks.length) artworkFallbacks.push({ path: fallbackArtwork, source: 'Previously captured production artwork', sha256: createHash('sha256').update(body).digest('hex') });
    }
    return route.fulfill({ status: 200, contentType: contentTypes[extname(pathname)] || 'application/octet-stream', body });
  });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push({ mode, width: viewport.width, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ mode, width: viewport.width, message: message.text() }); });
  await page.goto(ORIGIN + '/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__passportReady, null, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
  await page.waitForFunction(() => ['.suite-hero-art', '#growth-summary-art', '.game-poster .poster-art'].every(selector => {
    const image = document.querySelector(selector); return image?.complete && image.naturalWidth > 0;
  }), null, { timeout: 10000 });
}
async function capture(name, selector) {
  const file = resolve(OUT, `${name}.jpg`);
  const target = selector ? page.locator(selector) : page;
  await target.screenshot({ path: file, type: 'jpeg', quality: 85, animations: 'disabled' });
  screenshots.push(file);
}
async function compact(mode, viewport) {
  const result = await page.evaluate(() => {
    const rect = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { top: box.top + scrollY, height: box.height, width: box.width }; };
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, open: document.getElementById('growth-details').open, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster') };
  });
  assert.equal(result.open, false);
  assert(result.scrollWidth <= viewport.width + 1);
  const prior = baselineReport.dimensions.find(item => item.viewport.width === viewport.width && item.mode === (mode === 'signedout' ? 'signedout' : 'nearbadge'));
  assert(prior && Math.abs(prior.panel.height - result.panel.height) < 1, 'Collapsed height is unchanged from the released invitation');
  assert(result.firstPoster.top < viewport.height, 'The first game remains in the initial viewport');
  dimensions.push({ mode, viewport, layout: 'collapsed', ...result, baselinePanelHeight: prior.panel.height });
  checks.push({ name: `${viewport.width}px ${mode}: collapsed invitation unchanged, first game visible, no overflow`, passed: true });
}
async function passport(mode, viewport, expectedComplete, historic = false) {
  const result = await page.evaluate(() => {
    const grid = document.getElementById('growth-stamps');
    const rect = element => { const box = element.getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, width: box.width, height: box.height }; };
    return {
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      count: document.getElementById('growth-passport-count').textContent,
      current: document.getElementById('growth-passport-meter').getAttribute('aria-valuenow'), maximum: document.getElementById('growth-passport-meter').getAttribute('aria-valuemax'),
      stamps: [...grid.children].map(element => ({ text: element.textContent, done: element.classList.contains('is-done'), rect: rect(element), artLoaded: [...element.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0) })),
      columns: getComputedStyle(grid).gridTemplateColumns,
      optionalHidden: document.getElementById('growth-passport-optional').hidden,
      optional: document.getElementById('growth-optional-stamps').textContent,
      reward: document.getElementById('growth-passport-reward').textContent,
      tracking: document.getElementById('growth-tracking-note').textContent,
    };
  });
  const required = historic ? 3 : 4;
  assert.equal(result.count, `${expectedComplete} / ${required} required games`);
  assert.equal(result.current, String(expectedComplete)); assert.equal(result.maximum, String(required));
  assert.equal(result.stamps.length, required); assert.equal(result.stamps.filter(stamp => stamp.done).length, expectedComplete);
  assert(result.scrollWidth <= viewport.width + 1);
  assert(result.stamps.every(stamp => stamp.rect.left >= -1 && stamp.rect.right <= viewport.width + 1 && stamp.artLoaded));
  assert(Math.abs(result.stamps[0].rect.top - result.stamps[1].rect.top) < 1, 'The first two stamps share a row');
  assert(result.stamps[2].rect.top > result.stamps[0].rect.top, 'The third stamp begins the second row');
  if (historic) {
    assert.equal(result.optionalHidden, false);
    assert.match(result.optional, /TREE FORCE ’89.*First wave started · Optional stamp/);
    assert(result.stamps.every(stamp => !stamp.text.includes('TREE FORCE')));
    assert.match(result.tracking, /optional participation stamp/);
    assert.match(result.reward, /badge earned/);
  } else {
    assert(Math.abs(result.stamps[2].rect.top - result.stamps[3].rect.top) < 1, 'Four main stamps form two complete rows');
    assert.equal(result.optionalHidden, true); assert.equal(result.optional, '');
    const force = result.stamps.find(stamp => stamp.text.includes('TREE FORCE'));
    assert(force); assert.equal(force.done, expectedComplete === 4);
    assert.match(force.text, expectedComplete === 4 ? /First wave started · Stamp earned/ : /Start a run · Reach the first wave/);
    assert.equal(force.text.includes('Optional'), false); assert.equal(result.tracking.includes('optional'), false);
    assert.equal(result.reward.includes('badge earned'), expectedComplete === 4);
  }
  dimensions.push({ mode, viewport, layout: 'passport', ...result });
  checks.push({ name: `${viewport.width}px ${mode}: ${expectedComplete}/${required} stamps, ${historic ? 'historic optional credit preserved' : 'four main stamps in a 2×2 grid without optional TREE FORCE'}, no overflow`, passed: true });
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await open('signedout', viewport);
    await compact('signedout', viewport); await capture(`signedout-${viewport.width}`);
    assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), null);
    fixtureCalls.push({ mode: 'signedout', width: viewport.width, calls: await page.evaluate(() => window.__passportFixture.calls) });
    await open('before', viewport);
    await compact('before', viewport); await capture(`collapsed-three-of-four-${viewport.width}`);
    await page.locator('#growth-details > summary').click();
    await page.locator('#growth-today-tab').click();
    await page.locator('#growth-passport').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('#growth-stamps img')].every(image => image.complete && image.naturalWidth > 0));
    await passport('before-treeforce', viewport, 3); await capture(`three-of-four-${viewport.width}`, '#growth-passport');
    await page.evaluate(async () => { window.__passportFixture.recordTreeForce(); await window.__passportController.refresh(); });
    assert.equal(await page.locator('#growth-today-tab').getAttribute('aria-selected'), 'true', 'A saved first wave does not change the chosen tab');
    await passport('after-treeforce', viewport, 4); await capture(`four-of-four-${viewport.width}`, '#growth-passport');
    fixtureCalls.push({ mode: 'before-to-after', width: viewport.width, calls: await page.evaluate(() => window.__passportFixture.calls) });
    await open('historic', viewport);
    await page.locator('#growth-details > summary').click();
    await page.locator('#growth-today-tab').click();
    await page.locator('#growth-passport').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('#growth-passport img')].every(image => image.complete && image.naturalWidth > 0));
    await passport('historic-october', viewport, 3, true); await capture(`historic-october-${viewport.width}`, '#growth-passport');
    fixtureCalls.push({ mode: 'historic', width: viewport.width, calls: await page.evaluate(() => window.__passportFixture.calls) });
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(networkWrites, []);
  assert(fixtureCalls.every(group => group.calls.every(call => call.type === 'api' && ['status', 'sync'].includes(call.action))), 'No wallet, sign-in, or check-in action occurred');
  checks.push({ name: 'All nine contexts stayed isolated: no real wallet, signature, remote API, network write, or browser errors', passed: true });
  const report = { passed: true, synthetic: true, testedAt: new Date().toISOString(), fixtureScope: fixtures.description,
    sourceSha256, checks, dimensions, screenshots, fixtureCalls, artworkFallbacks, pageErrors, consoleErrors, blockedRequests, networkWrites };
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, screenshots: screenshots.length, report: resolve(OUT, 'browser-report.json'), collapsed: dimensions.filter(item => item.layout === 'collapsed') }));
} catch (error) {
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify({ passed: false, synthetic: true, error: String(error), sourceSha256, checks, dimensions, screenshots, fixtureCalls, artworkFallbacks, pageErrors, consoleErrors, blockedRequests, networkWrites }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
