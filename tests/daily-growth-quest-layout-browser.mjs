// Native layout/interaction QA with actual worktree HTML, CSS and artwork.
// Only the controller bootstrap receives synthetic wallet/API dependencies.
// Every request is fulfilled from local files; no remote API or wallet is used.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/review/daily-growth-quest-layout');
const ORIGIN = 'https://quest-layout-fixture.invalid';
const BASELINE_COMMIT = 'f35d1f6326986eca27807e13f4ec9227456b7f4a';
const BASELINE_DEPLOY = '6ae7eee018d3f212df6696d0'; // Three target files independently verified byte-identical to this commit.
const ART_BASELINE = process.env.GROWTH_INVITATION_BASELINE || '/workspace/scratch/68c975ebd06c/growth-invitation-baseline';
const BROWSER = process.env.ARCADE_CHROMIUM_PATH || '/tmp/daily-growth-invitation-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const ACCOUNT = `0x${'a'.repeat(64)}`, OTHER = `0x${'b'.repeat(64)}`;
const VISITS = [1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 15, 17];
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
const games = [
  { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot', creditRule: 'complete-result' },
  { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp', creditRule: 'complete-result' },
  { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials', creditRule: 'complete-result' },
  { id: 'treeforce89', label: 'TREE FORCE ’89', href: 'https://tree-token.xyz/play/treeforce89/', creditRule: 'start-run' },
];
const configuration = { enabledGames: games, eligibleGames: games, todayPick: games[3] };
const goals = [{ id: 'seedling', label: 'Seedling', target: 3 }, { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 }, { id: 'full-canopy', label: 'Full Canopy', target: 21 }];
const cabinetLinks = { 'force-title': '/play/treeforce89/', 'arboretum-title': 'https://treegrow.xyz/',
  'deadfall-title': 'https://tree-token.xyz/play/deadfall-run/', 'canopy-title': 'https://tree-token.xyz/play/canopy-defense/preview/',
  'garden-bot-title': 'https://nftree.net/battle/garden-bot', 'pvp-title': 'https://nftree.net/battle/pvp',
  'trials-title': 'https://nftree.net/battle/trials', 'clash-title': 'https://nftree.net/battle/canopy-clash' };
const sourceFiles = ['play/index.html', 'scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css'];
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, await readFile(resolve(ROOT, file))])));
const baselineSources = Object.fromEntries(sourceFiles.map(file => [file, execFileSync('git', ['show', `${BASELINE_COMMIT}:${file}`], { cwd: ROOT })]));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceSha256 = Object.fromEntries(sourceFiles.map(file => [file, hash(sources[file])]));
const baselineSha256 = Object.fromEntries(sourceFiles.map(file => [file, hash(baselineSources[file])]));
const bootstrap = 'if (root) createDailyGrowth({ root });';
const scripts = Object.fromEntries(Object.entries({ current: sources, baseline: baselineSources }).map(([phase, files]) => {
  const script = files['scripts/arcade-daily-growth.js'].toString();
  assert.equal(script.split(bootstrap).length, 2, 'Only controller auto-start is replaced');
  return [phase, script.replace(bootstrap, `if (root) {
    window.__questLayoutController = createDailyGrowth({ root, ...window.__questLayoutFixture.options });
    window.__questLayoutController.ready.then(() => { window.__questLayoutReady = true; });
  }`)];
}));
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function fixture(mode, monthKey = '2026-11', visits = VISITS) {
  const [year, month] = monthKey.split('-').map(Number), count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dateKey = `${monthKey}-18`, now = Date.parse(`${dateKey}T12:00:00Z`);
  const calendar = Array.from({ length: count }, (_, index) => ({ dateKey: `${monthKey}-${String(index + 1).padStart(2, '0')}`,
    checkedIn: visits.includes(index + 1), questCompleted: [3, 5].includes(index + 1),
    gameIds: index === 2 ? ['garden-bot'] : index === 4 ? ['arborist-trials'] : [] }));
  return { mode, monthKey, dateKey, now, account: ACCOUNT, other: OTHER, configuration, goals,
    progress: { wallet: ACCOUNT, monthKey, dateKey, calendar, checkedInDays: visits.length, questDays: 2,
      today: { checkedIn: visits.includes(18), questCompleted: false, gameIds: [] },
      milestones: goals.map(goal => ({ ...goal, earned: visits.length >= goal.target })),
      badges: goals.filter(goal => visits.length >= goal.target).map(goal => ({ id: goal.id, label: goal.label, monthKey, earnedAt: `${monthKey}-17T12:00:00Z` })),
      passport: { monthKey, enabledGames: games, completedGameIds: ['garden-bot', 'arborist-trials'], complete: false, optionalGames: [], optionalCompletedGameIds: [] } } };
}
function installFixture(data) {
  const calls = [], listeners = new Set(), memory = new Map();
  const authenticated = ['authenticated', 'milestone'].includes(data.mode);
  let walletState = (authenticated || data.mode === 'connected') ? { connected: true, address: data.account, walletName: 'Slush', walletId: 'Slush' }
    : { connected: false, address: null, walletName: null };
  let progress = structuredClone(data.progress);
  const key = 'tree-arcade:daily-growth:session:v1';
  if (authenticated) memory.set(key, JSON.stringify({ version: 1, wallet: data.account, walletId: 'Slush', walletName: 'Slush',
    token: 'synthetic-quest-layout-session', expiresAt: new Date(data.now + 3600000).toISOString() }));
  const forbidden = action => { calls.push({ type: 'forbidden-wallet-action', action }); throw new Error(`Real wallet action forbidden: ${action}`); };
  const wallet = { getWalletState: () => walletState, getAvailableWallets: () => [], connectWallet: () => forbidden('connect'),
    restoreWallet: () => forbidden('restore'), disconnectWallet: () => forbidden('disconnect'), signPersonalMessage: () => forbidden('sign'),
    subscribeWalletState(listener) { listeners.add(listener); queueMicrotask(() => listener(walletState)); return () => listeners.delete(listener); }, subscribeWallets() { return () => {}; } };
  const controls = { calls, failStatus: false, failSync: false, holdStatus: data.mode === 'loading', holdCheckIn: false,
    releaseStatus: null, releaseCheckIn: null, count: action => calls.filter(call => call.action === action).length,
    accountChange() { walletState = { connected: true, address: data.other, walletName: 'Slush', walletId: 'Slush' }; for (const listener of listeners) listener(walletState); } };
  async function fetchImpl(url, init) {
    const action = new URL(url, location.href).searchParams.get('action');
    calls.push({ type: 'api', action, method: init.method, synthetic: true, transport: 'in-memory fixture; no network' });
    if (!['status', 'sync', 'check-in', 'logout'].includes(action)) throw new Error(`Unexpected fixture action: ${action}`);
    if (action === 'status' && controls.holdStatus) await new Promise(done => { controls.releaseStatus = done; });
    if (action === 'check-in' && controls.holdCheckIn) await new Promise(done => { controls.releaseCheckIn = done; });
    if ((action === 'status' && controls.failStatus) || (action === 'sync' && controls.failSync)) {
      return { ok: false, status: 503, json: async () => ({ status: 'error', error: 'service-unavailable', message: 'Synthetic unavailable response. Saved progress has not changed.' }) };
    }
    if (action === 'check-in') {
      progress.calendar.find(day => day.dateKey === data.dateKey).checkedIn = true;
      progress.today.checkedIn = true;
      progress.checkedInDays = progress.calendar.filter(day => day.checkedIn).length;
      progress.milestones = data.goals.map(goal => ({ ...goal, earned: progress.checkedInDays >= goal.target }));
      progress.badges = progress.milestones.filter(goal => goal.earned).map(goal => ({ id: goal.id, label: goal.label, monthKey: data.monthKey, earnedAt: new Date(data.now).toISOString() }));
    }
    const authenticated = Boolean(init.headers.Authorization) && action !== 'logout';
    const payload = action === 'logout' ? { status: 'ok' } : { status: 'ok', authenticated, serverTime: new Date(data.now).toISOString(),
      dateKey: data.dateKey, monthKey: data.monthKey, configuration: data.configuration,
      ...(authenticated ? { progress: structuredClone(progress) } : {}),
      ...(action === 'sync' ? { sync: { checkedAt: new Date(data.now).toISOString(), games: data.configuration.eligibleGames.map(game => ({ gameId: game.id, status: 'no-result' })) } } : {}) };
    return { ok: true, status: 200, json: async () => payload };
  }
  controls.options = { fetchImpl, loadWallet: async () => wallet, now: () => data.now,
    storage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } };
  window.__questLayoutFixture = controls;
}

await mkdir(OUT, { recursive: true });
const checks = [], dimensions = [], calendarCases = [], screenshots = [], calls = [], pageErrors = [], consoleErrors = [], blockedRequests = [], networkWrites = [];
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let context, page, active;
async function open(mode, viewport, { phase = 'current', month = '2026-11', visits = VISITS } = {}) {
  if (page) calls.push({ ...active, calls: await page.evaluate(() => window.__questLayoutFixture.calls) });
  await context?.close(); active = { phase, mode, width: viewport.width, month };
  context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(installFixture, fixture(mode, month, visits));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { networkWrites.push({ url: request.url(), method: request.method() }); return route.abort(); }
    if (url.origin !== ORIGIN || url.pathname.startsWith('/api/')) { blockedRequests.push(request.url()); return route.abort(); }
    const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
    const path = resolve(ROOT, `.${decodeURIComponent(pathname)}`); assert(path.startsWith(ROOT + sep));
    let body = (phase === 'current' ? sources : baselineSources)[pathname.slice(1)];
    if (pathname === '/scripts/arcade-daily-growth.js') body = scripts[phase];
    if (!body) { try { body = await readFile(path); } catch (error) {
      if (pathname !== '/play/canopy-defense/assets/brand/oak-guardian-preview.png') throw error;
      body = await readFile(resolve(ART_BASELINE, pathname.slice(1)));
    } }
    return route.fulfill({ status: 200, contentType: contentTypes[extname(pathname)] || 'application/octet-stream', body });
  });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push({ ...active, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ ...active, message: message.text() }); });
  await page.goto(ORIGIN + '/play/', { waitUntil: 'domcontentloaded' });
  if (mode === 'loading') await page.waitForFunction(() => window.__questLayoutFixture.releaseStatus, null, { timeout: 10000 });
  else await page.waitForFunction(() => window.__questLayoutReady, null, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
}
async function layout() {
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scrollY, height: r.height, width: r.width }; };
    const overflow = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect();
      return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1) && getComputedStyle(el).position !== 'fixed' && !el.classList.contains('growth-sr-only');
    }).map(el => ({ id: el.id, class: el.className }));
    return { viewport: { width: innerWidth, height: innerHeight }, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster'),
      scrollWidth: document.documentElement.scrollWidth, open: document.getElementById('growth-details').open, overflow };
  });
}
async function noOverflow(label) { const result = await layout(); assert(result.scrollWidth <= result.viewport.width + 1, label); assert.deepEqual(result.overflow, [], label); return result; }
async function rail({ month = '2026-11', visits = VISITS, unknown = false, stale = false } = {}) {
  const result = await page.locator('#growth-days').evaluate(element => ({ label: element.getAttribute('aria-label'),
    cells: [...element.children].map(cell => ({ date: cell.dataset.date, done: cell.classList.contains('is-done'), missed: cell.classList.contains('is-missed'),
      unknown: cell.classList.contains('is-unknown'), label: cell.getAttribute('aria-label'), top: cell.getBoundingClientRect().top, left: cell.getBoundingClientRect().left, right: cell.getBoundingClientRect().right })) }));
  const [year, number] = month.split('-').map(Number), total = new Date(Date.UTC(year, number, 0)).getUTCDate();
  assert.deepEqual(result.cells.map(cell => cell.date), Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`));
  if (unknown) { assert(result.cells.every(cell => cell.unknown && !cell.done && !cell.missed)); assert.doesNotMatch(await page.locator('#growth-rail-count').textContent(), /^\s*0\b/); }
  else {
    assert.deepEqual(result.cells.filter(cell => cell.done).map(cell => Number(cell.date.slice(-2))), visits);
    assert.deepEqual(result.cells.filter(cell => cell.missed).map(cell => Number(cell.date.slice(-2))),
      Array.from({ length: 17 }, (_, index) => index + 1).filter(day => !visits.includes(day)), 'A new check-in never fills an earlier missed date');
  }
  if (stale) assert.match([result.label, await page.locator('#growth-rail-count').textContent(), await page.locator('#growth-rail-note').textContent()].join(' '), /last saved/i);
  assert(result.cells.every(cell => cell.left >= -1 && cell.right <= active.width + 1));
  return result;
}
async function reveal() { if (!await page.locator('#growth-details').evaluate(el => el.open)) { await page.locator('#growth-details > summary').focus(); await page.keyboard.press('Enter'); } }
async function calendar(month, visits) {
  await page.locator('#growth-month-tab').click();
  const cells = await page.locator('#growth-calendar .growth-day').evaluateAll(elements => elements.map(el => ({ day: Number(el.querySelector('strong').textContent), done: el.classList.contains('is-done') })));
  const [year, number] = month.split('-').map(Number), days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  assert.deepEqual(cells.map(cell => cell.day), Array.from({ length: days }, (_, index) => index + 1));
  assert.deepEqual(cells.filter(cell => cell.done).map(cell => cell.day), visits); await noOverflow('monthly calendar');
}
async function capture(name, selector) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const path = resolve(OUT, `${name}.jpg`); await (selector ? page.locator(selector) : page).screenshot({ path, type: 'jpeg', quality: 80, animations: 'disabled' }); screenshots.push(path);
}
const passed = name => checks.push({ name, passed: true });

try {
  for (const viewport of viewports) {
    for (const mode of viewport.width < 1440 ? ['signed-out', 'connected', 'authenticated'] : ['signed-out', 'authenticated']) {
      await open(mode, viewport, { phase: 'baseline' }); const baseline = await layout();
      await open(mode, viewport); const current = await noOverflow('collapsed panel');
      assert.equal(current.open, false); assert(current.firstPoster.top < viewport.height, 'The first game stays within the initial viewport');
      dimensions.push({ mode, baseline, current, heightDelta: current.panel.height - baseline.panel.height, posterDelta: current.firstPoster.top - baseline.firstPoster.top });
      console.log(JSON.stringify({ checkpoint: 'collapsed-layout', mode, width: viewport.width, panelHeight: current.panel.height,
        heightDelta: current.panel.height - baseline.panel.height, firstPosterTop: current.firstPoster.top, posterDelta: current.firstPoster.top - baseline.firstPoster.top }));
      await rail({ unknown: mode !== 'authenticated' });
      const actualLinks = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.getElementById(id).closest('a').getAttribute('href')])), Object.keys(cabinetLinks));
      assert.deepEqual(actualLinks, cabinetLinks); assert.equal(await page.evaluate(() => window.__questLayoutFixture.count('check-in')), 0);
      if (mode !== 'authenticated') {
        if (mode === 'signed-out') {
          assert.equal(await page.locator('#growth-wallet-identity').isVisible(), false);
          assert(await page.getByRole('button', { name: 'Connect to check in', exact: true }).isVisible());
          if (viewport.width === 1440) await capture('signed-out-desktop');
        } else {
          const identity = page.locator('#growth-wallet-identity');
          assert(await identity.isVisible());
          assert.match(await identity.textContent(), /Connected.*Slush/);
          assert((await identity.getAttribute('aria-label')).includes(ACCOUNT));
          assert(await page.locator('#growth-sign-in').isVisible());
          const actions = await page.locator('#growth-connect,#growth-sign-in').evaluateAll(elements => elements.map(element => {
            const { top, height } = element.getBoundingClientRect(); return { top, height };
          }));
          assert(actions.every(action => action.height >= 44), 'Connected wallet actions retain 44px targets');
          assert(Math.abs(actions[0].top - actions[1].top) <= 1, 'Connected wallet actions share one phone row');
          if (viewport.width === 320) await capture('connected-collapsed-320');
        }
      } else {
        const identity = page.locator('#growth-wallet-identity'); assert(await identity.isVisible());
        assert((await identity.getAttribute('aria-label')).includes(ACCOUNT)); assert.match(await identity.textContent(), /Signed in.*Slush/);
        await capture(`signed-in-collapsed-${viewport.width}`);
        const trigger = viewport.width === 1440 ? '#growth-check-in' : '#growth-check-in-row';
        if (trigger.endsWith('-row')) await reveal();
        await page.evaluate(() => { window.__questLayoutFixture.holdCheckIn = true; });
        await page.locator(trigger).click();
        await page.waitForFunction(() => window.__questLayoutFixture.releaseCheckIn);
        assert(await page.locator('#growth-check-in').isDisabled()); assert(await page.locator('#growth-check-in-row').isDisabled());
        await page.evaluate(() => window.__questLayoutFixture.releaseCheckIn());
        await page.waitForFunction(() => document.getElementById('growth-check-in').textContent.includes('Checked in'));
        assert.equal(await page.evaluate(() => window.__questLayoutFixture.count('check-in')), 1);
        await rail({ visits: [...VISITS, 18] }); await reveal();
        assert(await page.locator('#growth-check-in-row').isDisabled());
        assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), '13');
        assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuemax'), '14');
        assert.match(await page.locator('#growth-summary-art-label').textContent(), /Deep Roots/);
        await page.locator('#growth-today-tab').click();
        await page.locator('#growth-quest-details > summary').click();
        assert(await page.locator('#growth-play').isVisible()); assert(await page.locator('#growth-refresh').isVisible());
        assert.equal(await page.locator('#growth-play').getAttribute('href'), games[3].href);
        await page.locator('#growth-quest-details > summary').click();
        if (!await page.locator('#growth-passport').evaluate(el => el.open)) await page.locator('#growth-passport > summary').click();
        assert.equal(await page.locator('#growth-stamps > *').count(), 4);
        assert.match(await page.locator('#growth-stamps').textContent(), /TREE FORCE.*first wave/is);
        assert.equal(await page.locator('#growth-passport-count').textContent(), '2 / 4 required games');
        assert(await page.locator('#growth-passport-optional').evaluate(el => el.hidden));
        await noOverflow('expanded tasks and Passport');
        await page.locator('#growth-passport > summary').click();
        if (viewport.width === 1440) await capture('signed-in-expanded-desktop', '#arcade-daily-growth');
        await calendar('2026-11', [...VISITS, 18]);
        await page.locator('#growth-badges-tab').click(); assert.match(await page.locator('#growth-badges').textContent(), /Seedling/); assert.match(await page.locator('#growth-badges').textContent(), /Sapling/);
        assert.equal(await page.getByRole('button', { name: /claim/i }).count(), 0, 'Attendance badges need no claim action');
      }
      passed(`${viewport.width}px ${mode}: honest rail, collapsed wallet/layout, cabinet preservation${mode === 'authenticated' ? ', one explicit synchronized check-in, tasks/calendar/badges and four Passport games' : ''}`);
    }
  }
  for (const [month, total] of [['2027-02', 28], ['2028-02', 29], ['2026-12', 31]]) {
    for (const viewport of viewports) {
      await open('authenticated', viewport, { month });
      await rail({ month }); await noOverflow(`${total}-day rail`); await reveal(); await calendar(month, VISITS);
      calendarCases.push({ month, days: total, width: viewport.width });
      if (total === 29 && viewport.width === 320) await capture('leap-month-320', '#arcade-daily-growth');
    }
    passed(`${total}-day month renders every date correctly at all three widths`);
  }
  await open('loading', viewports[2]);
  assert.equal(await page.locator('#growth-days .is-done,#growth-days .is-missed').count(), 0);
  assert.doesNotMatch(await page.locator('#growth-rail-count').textContent(), /^\s*0\b/);
  await page.evaluate(() => { window.__questLayoutFixture.holdStatus = false; window.__questLayoutFixture.releaseStatus(); });
  await page.waitForFunction(() => window.__questLayoutReady); await rail({ unknown: true });
  passed('Initial loading has no fabricated attendance; successful public month yields neutral dates');
  await page.evaluate(async () => { window.__questLayoutFixture.failStatus = true; await window.__questLayoutController.refresh(); });
  const unavailableRail = await rail({ unknown: true });
  assert(unavailableRail.cells.every(cell => /attendance unavailable/i.test(cell.label)));
  assert.match(await page.locator('#growth-rail-count').getAttribute('aria-label'), /Attendance unavailable/i);
  assert.match(await page.locator('#growth-status').textContent(), /unavailable/i);
  passed('No-progress error retains neutral dates without zero counts or invented missed days');
  await open('authenticated', viewports[2]);
  await page.evaluate(async () => { window.__questLayoutFixture.failSync = true; await window.__questLayoutController.refresh(); });
  await rail({ stale: true }); assert.equal(await page.evaluate(() => window.__questLayoutFixture.count('check-in')), 0);
  passed('Stale response preserves exactly the recorded dates with last-saved labeling and no new credit');
  await open('milestone', viewports[1], { visits: [...VISITS, 4].sort((a, b) => a - b) });
  await page.locator('#growth-check-in').click(); await page.waitForFunction(() => document.getElementById('growth-check-in').textContent.includes('Checked in'));
  await reveal(); assert.match(await page.locator('#growth-summary-art-label').textContent(), /Full Canopy/);
  assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuenow'), '14'); assert.equal(await page.locator('#growth-summary-meter').getAttribute('aria-valuemax'), '21');
  await page.locator('#growth-badges-tab').click(); assert.match(await page.locator('#growth-badges').textContent(), /Deep Roots/);
  assert.equal(await page.evaluate(() => window.__questLayoutFixture.count('check-in')), 1);
  passed('Fourteen nonconsecutive check-ins automatically show Deep Roots earned and Full Canopy next');
  await page.evaluate(() => window.__questLayoutFixture.accountChange());
  await rail({ unknown: true }); assert.match(await page.locator('#growth-wallet-identity-status').textContent(), /Connected/);
  assert((await page.locator('#growth-wallet-identity').getAttribute('aria-label')).includes(OTHER));
  passed('Account change immediately replaces wallet identity and clears previous attendance');

  calls.push({ ...active, calls: await page.evaluate(() => window.__questLayoutFixture.calls) });
  assert(calls.every(entry => entry.calls.every(call => call.type !== 'forbidden-wallet-action')));
  assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(networkWrites, []);
  for (const file of sourceFiles) assert((await readFile(resolve(ROOT, file))).equals(sources[file]), `Source changed during QA: ${file}`);
  await rm(resolve(OUT, 'failure.jpg'), { force: true });
  const report = { passed: true, synthetic: true, checkedAt: new Date().toISOString(), sourceSha256,
    baseline: { commit: BASELINE_COMMIT, deploy: BASELINE_DEPLOY, sourceSha256: baselineSha256 }, checks, dimensions, calendarCases, cabinetLinks,
    screenshots, calls, pageErrors, consoleErrors, blockedRequests, networkWrites, noRealWalletActions: true, noSignatures: true, noRemoteWrites: true };
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, screenshots: screenshots.length,
    dimensions: dimensions.map(d => ({ mode: d.mode, width: d.current.viewport.width, panelHeight: d.current.panel.height, heightDelta: d.heightDelta, firstPosterTop: d.current.firstPoster.top, posterDelta: d.posterDelta })), report: resolve(OUT, 'browser-report.json') }));
} catch (error) {
  if (page) await capture('failure');
  await writeFile(resolve(OUT, 'browser-report.json'), JSON.stringify({ passed: false, error: String(error), sourceSha256, checks, dimensions, calendarCases, screenshots, pageErrors, consoleErrors, blockedRequests, networkWrites }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
