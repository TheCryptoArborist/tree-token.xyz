// Targeted wallet-summary QA. Real HTML/CSS/controller, synthetic in-memory
// wallets and API responses, and local files fulfilled without network access.
// Compare against the prior released source with identical states and viewports.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/review/daily-growth-wallet-summary');
const ORIGIN = 'https://wallet-summary-qa.invalid';
const BASELINE_COMMIT = '80ad3fdeec760731c4f35ac3823f85e6d306978e';
const ART_BASELINE = process.env.GROWTH_INVITATION_BASELINE || '/workspace/scratch/68c975ebd06c/growth-invitation-baseline';
const BROWSER = process.env.ARCADE_CHROMIUM_PATH || '/tmp/daily-growth-invitation-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const ACCOUNT = `0x${'a'.repeat(64)}`, OTHER = `0x${'b'.repeat(64)}`;
const NOW = Date.parse('2026-11-12T12:00:00Z');
const games = [
  { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot', creditRule: 'complete-result' },
  { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp', creditRule: 'complete-result' },
  { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials', creditRule: 'complete-result' },
  { id: 'treeforce89', label: 'TREE FORCE ’89', href: 'https://tree-token.xyz/play/treeforce89/', creditRule: 'start-run' },
];
const configuration = { enabledGames: games, eligibleGames: games, todayPick: games[3] };
const milestones = [{ id: 'seedling', label: 'Seedling', target: 3 }, { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 }, { id: 'full-canopy', label: 'Full Canopy', target: 21 }];
const calendar = Array.from({ length: 30 }, (_, index) => ({ dateKey: `2026-11-${String(index + 1).padStart(2, '0')}`,
  checkedIn: [1, 3].includes(index + 1), questCompleted: index === 2, gameIds: index === 2 ? ['garden-bot'] : [] }));
const progress = { wallet: ACCOUNT, monthKey: '2026-11', dateKey: '2026-11-12', calendar, checkedInDays: 2, questDays: 1,
  today: { checkedIn: false, questCompleted: false, gameIds: [] }, badges: [], milestones: milestones.map(goal => ({ ...goal, earned: false })),
  passport: { monthKey: '2026-11', enabledGames: games, completedGameIds: ['garden-bot'], complete: false, optionalGames: [], optionalCompletedGameIds: [] } };
const files = ['play/index.html', 'scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css'];
const currentSources = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(resolve(ROOT, file))])));
const baselineSources = Object.fromEntries(files.map(file => [file, execFileSync('git', ['show', `${BASELINE_COMMIT}:${file}`], { cwd: ROOT })]));
const sourceSha256 = Object.fromEntries(files.map(file => [file, createHash('sha256').update(currentSources[file]).digest('hex')]));
const bootstrap = 'if (root) createDailyGrowth({ root });';
const injectedScripts = Object.fromEntries(Object.entries({ baseline: baselineSources, current: currentSources }).map(([phase, sources]) => {
  const source = sources['scripts/arcade-daily-growth.js'].toString();
  assert.equal(source.split(bootstrap).length, 2, 'Only the controller bootstrap is replaced for fixtures');
  return [phase, source.replace(bootstrap, `if (root) {
    window.__walletSummaryController = createDailyGrowth({ root, ...window.__walletSummaryFixture.options });
    window.__walletSummaryController.ready.then(() => { window.__walletSummaryReady = true; });
  }`)];
}));
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function installFixture({ mode, account, other, now, configuration, progress }) {
  const calls = [], listeners = new Set(), memory = new Map();
  let clock = now;
  let walletState = mode === 'disconnected' ? { connected: false, address: null, walletName: null }
    : { connected: true, address: account, walletId: 'Slush', walletName: 'Slush' };
  const key = 'tree-arcade:daily-growth:session:v1';
  if (mode === 'signed-in') memory.set(key, JSON.stringify({ version: 1, wallet: account, walletId: 'Slush', walletName: 'Slush',
    token: 'synthetic-wallet-summary-session', expiresAt: new Date(now + 3600000).toISOString() }));
  function change(address, name = 'Slush') {
    walletState = address ? { connected: true, address, walletId: name, walletName: name }
      : { connected: false, address: null, walletName: null };
    for (const listener of listeners) listener(walletState);
  }
  const forbidden = action => { calls.push({ type: 'forbidden-wallet-action', action }); throw new Error(`Unexpected wallet action: ${action}`); };
  const wallet = { getWalletState: () => walletState, getAvailableWallets: () => [],
    connectWallet: () => forbidden('connect'), restoreWallet: () => forbidden('restore'), disconnectWallet: () => forbidden('disconnect'), signPersonalMessage: () => forbidden('sign'),
    subscribeWalletState(listener) { listeners.add(listener); queueMicrotask(() => listener(walletState)); return () => listeners.delete(listener); }, subscribeWallets() { return () => {}; } };
  async function fetchImpl(url, init) {
    const action = new URL(url, location.href).searchParams.get('action');
    calls.push({ type: 'api', action, method: init.method, synthetic: true, transport: 'in-memory response; no network' });
    if (!['status', 'sync', 'logout'].includes(action)) throw new Error(`Unexpected fixture action: ${action}`);
    const authenticated = Boolean(init.headers.Authorization) && action !== 'logout';
    const payload = action === 'logout' ? { status: 'ok' } : { status: 'ok', authenticated, configuration,
      serverTime: new Date(clock).toISOString(), dateKey: progress.dateKey, monthKey: progress.monthKey,
      ...(authenticated ? { progress: structuredClone(progress) } : {}),
      ...(action === 'sync' ? { sync: { checkedAt: new Date(clock).toISOString(), games: configuration.eligibleGames.map(game => ({ gameId: game.id, status: 'no-result' })) } } : {}) };
    return { ok: true, status: 200, json: async () => payload };
  }
  window.__walletSummaryFixture = { calls, accountChange: () => change(other), disconnect: () => change(null),
    setProviderName: name => change(walletState.address, name),
    sessionStored: () => memory.has(key), expire() { clock += 3600001; window.dispatchEvent(new Event('focus')); },
    options: { fetchImpl, loadWallet: async () => wallet, now: () => clock,
      storage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } } };
}

await mkdir(OUT, { recursive: true });
const checks = [], dimensions = [], screenshots = [], pageErrors = [], consoleErrors = [], blockedRequests = [], networkWrites = [], fixtureCalls = [];
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let context, page, active, longProvider;
async function open(phase, mode, viewport) {
  if (page) fixtureCalls.push({ ...active, calls: await page.evaluate(() => window.__walletSummaryFixture.calls) });
  await context?.close(); active = { phase, mode, width: viewport.width };
  context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(installFixture, { mode, account: ACCOUNT, other: OTHER, now: NOW, configuration, progress });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { networkWrites.push({ url: request.url(), method: request.method() }); return route.abort(); }
    if (url.origin !== ORIGIN || url.pathname.startsWith('/api/')) { blockedRequests.push(request.url()); return route.abort(); }
    const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
    const path = resolve(ROOT, `.${decodeURIComponent(pathname)}`);
    assert(path.startsWith(ROOT + sep), 'Only project resources are fulfilled');
    let body = (phase === 'current' ? currentSources : baselineSources)[pathname.slice(1)];
    if (pathname === '/scripts/arcade-daily-growth.js') body = injectedScripts[phase];
    if (!body) {
      try { body = await readFile(path); }
      catch (error) {
        if (pathname !== '/play/canopy-defense/assets/brand/oak-guardian-preview.png') throw error;
        body = await readFile(resolve(ART_BASELINE, pathname.slice(1)));
      }
    }
    return route.fulfill({ status: 200, contentType: contentTypes[extname(pathname)] || 'application/octet-stream', body });
  });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push({ ...active, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ ...active, message: message.text() }); });
  await page.goto(ORIGIN + '/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__walletSummaryReady, null, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
}
async function measure() {
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scrollY, height: r.height, width: r.width }; };
    const overflowingElements = [...document.querySelectorAll('body *')].filter(element => {
      const r = element.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1) && getComputedStyle(element).position !== 'fixed';
    }).map(element => ({ tag: element.tagName, id: element.id, class: element.className }));
    return { viewport: { width: innerWidth, height: innerHeight }, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster'),
      scrollWidth: document.documentElement.scrollWidth, detailsOpen: document.getElementById('growth-details').open, overflowingElements };
  });
}
async function identity(expected, address = ACCOUNT, name = 'Slush') {
  const element = page.locator('#growth-wallet-identity');
  assert.equal(await page.locator('#growth-details').evaluate(node => node.open), false);
  assert.equal(await element.evaluate(node => Boolean(node.closest('details'))), false, 'Identity stays outside the disclosure');
  if (expected === 'disconnected') {
    assert.equal(await element.isVisible(), false);
    for (const id of ['status', 'name', 'address']) assert.equal(await page.locator(`#growth-wallet-identity-${id}`).textContent(), '');
    assert.equal((await element.getAttribute('title')) || '', ''); assert.equal((await element.getAttribute('aria-label')) || '', '');
  } else {
    assert(await element.isVisible());
    assert.equal(await page.locator('#growth-wallet-identity-status').textContent(), expected === 'signed-in' ? 'Signed in' : 'Connected');
    assert.equal(await page.locator('#growth-wallet-identity-name').textContent(), name);
    assert.equal(await page.locator('#growth-wallet-identity-address').textContent(), `${address.slice(0, 8)}…${address.slice(-6)}`);
    assert((await element.getAttribute('title')).includes(address));
    const accessible = await element.getAttribute('aria-label'); assert(accessible.includes(address));
    assert(await page.getByRole('status', { name: accessible, exact: true }).isVisible(), 'The full address is exposed as the accessible status name');
    if (expected === 'connected') assert.match(accessible, /not signed in to Daily Growth/i);
  }
}
async function capture(name) {
  const path = resolve(OUT, `${name}.jpg`);
  await page.screenshot({ path, type: 'jpeg', quality: 80, animations: 'disabled' }); screenshots.push(path);
}
function passed(name) { checks.push({ name, passed: true }); }

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    for (const mode of ['disconnected', 'connected', 'signed-in']) {
      await open('baseline', mode, viewport); const baseline = await measure();
      await open('current', mode, viewport); await identity(mode); const current = await measure();
      const heightDelta = current.panel.height - baseline.panel.height;
      dimensions.push({ mode, baseline, current, heightDelta });
      assert.equal(current.detailsOpen, false); assert(current.scrollWidth <= viewport.width + 1); assert.deepEqual(current.overflowingElements, []);
      assert(current.firstPoster.top < viewport.height, 'The first game remains within the initial viewport');
      assert(heightDelta <= (mode === 'disconnected' ? 1 : 36), `Wallet identity adds more than one small line: ${heightDelta}px`);
      if ((mode === 'signed-in' && viewport.width !== 320) || (mode === 'connected' && viewport.width === 320)) await capture(`${mode}-${viewport.width}`);
      passed(`${viewport.width}px ${mode}: correct collapsed identity, accessible full address, compact layout, no overflow`);
    }
  }
  const longName = 'Synthetic provider with a very long wallet name';
  await page.evaluate(name => window.__walletSummaryFixture.setProviderName(name), longName);
  await identity('signed-in', ACCOUNT, longName);
  const nameMetrics = await page.locator('#growth-wallet-identity-name').evaluate(element => ({
    textOverflow: getComputedStyle(element).textOverflow, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
  }));
  assert.equal(nameMetrics.textOverflow, 'ellipsis'); assert(nameMetrics.scrollWidth > nameMetrics.clientWidth);
  longProvider = { name: longName, ...nameMetrics, layout: await measure() };
  assert.deepEqual(longProvider.layout.overflowingElements, []); assert(longProvider.layout.firstPoster.top < 740);
  passed('Long provider name is ellipsized at 320px while its full identity remains accessible');
  const immediate = await page.evaluate(() => {
    window.__walletSummaryFixture.accountChange();
    return { status: document.getElementById('growth-wallet-identity-status').textContent,
      address: document.getElementById('growth-wallet-identity-address').textContent,
      label: document.getElementById('growth-wallet-identity').getAttribute('aria-label'), sessionStored: window.__walletSummaryFixture.sessionStored() };
  });
  assert.equal(immediate.status, 'Connected'); assert.equal(immediate.address, `${OTHER.slice(0, 8)}…${OTHER.slice(-6)}`);
  assert.equal(immediate.sessionStored, false); assert(!immediate.label.includes(ACCOUNT)); await identity('connected', OTHER);
  passed('Account change immediately replaces the address and clears the previous signed-in session');
  await page.evaluate(() => window.__walletSummaryFixture.disconnect()); await identity('disconnected');
  assert(await page.getByRole('button', { name: 'Connect to check in', exact: true }).isVisible());
  passed('Disconnect clears visible and accessible wallet identity');

  await open('current', 'signed-in', { width: 320, height: 740 });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await identity('connected');
  assert.equal(await page.evaluate(() => window.__walletSummaryFixture.sessionStored()), false);
  assert.equal(await page.evaluate(() => window.__walletSummaryFixture.calls.filter(call => call.action === 'logout').length), 1);
  passed('Sign out retains the current connected wallet and removes signed-in status');
  await open('current', 'signed-in', { width: 320, height: 740 });
  await page.evaluate(() => window.__walletSummaryFixture.expire()); await identity('connected');
  assert.equal(await page.evaluate(() => window.__walletSummaryFixture.sessionStored()), false);
  assert(await page.getByRole('button', { name: 'Sign in to check in', exact: true }).isVisible());
  passed('Expired session becomes connected-only while preserving the current wallet address');

  fixtureCalls.push({ ...active, calls: await page.evaluate(() => window.__walletSummaryFixture.calls) });
  assert(fixtureCalls.every(entry => entry.calls.every(call => call.type !== 'forbidden-wallet-action')));
  assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(networkWrites, []);
  for (const file of files) assert((await readFile(resolve(ROOT, file))).equals(currentSources[file]), `Product source changed during QA: ${file}`);
  const report = { passed: true, synthetic: true, checkedAt: new Date().toISOString(), baselineCommit: BASELINE_COMMIT, sourceSha256,
    checks, dimensions, longProvider, screenshots, fixtureCalls, pageErrors, consoleErrors, blockedRequests, networkWrites, noRealWalletActions: true, noSignatures: true, noRemoteWrites: true };
  await rm(resolve(OUT, 'failure.jpg'), { force: true });
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, screenshots: screenshots.length,
    dimensions: dimensions.map(item => ({ mode: item.mode, width: item.current.viewport.width, height: item.current.panel.height, delta: item.heightDelta, firstPosterTop: item.current.firstPoster.top })), report: resolve(OUT, 'browser-report.json') }));
} catch (error) {
  if (page) await capture('failure');
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify({ passed: false, error: String(error), checks, dimensions, screenshots,
    pageErrors, consoleErrors, blockedRequests, networkWrites }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
