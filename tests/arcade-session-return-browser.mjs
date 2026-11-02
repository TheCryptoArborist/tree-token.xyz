// Real browser navigation/storage regression with the actual controller and wallet bundle.
// All canonical-origin requests are fulfilled locally. Wallet signatures and API data are synthetic.
// --baseline proves the defects in caed1e3; the default verifies the current fix.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/review/arcade-session-return');
const ORIGIN = 'https://tree-token.xyz';
const BASELINE = 'caed1e3f96a3496537515fc46d9cb1bd7fd9e9eb';
const baseline = process.argv.includes('--baseline');
const label = baseline ? 'baseline' : 'fixed';
const ACCOUNT = `0x${'a'.repeat(64)}`, OTHER = `0x${'b'.repeat(64)}`;
const KEY = 'tree-arcade:daily-growth:session:v1';
const NOW = Date.parse('2026-11-02T12:00:00Z');
const BROWSER = process.env.ARCADE_CHROMIUM_PATH || '/tmp/daily-growth-invitation-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const files = ['play/index.html', 'scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css', 'assets/arcade/arcade-growth-wallet.js'];
const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, baseline
  ? execFileSync('git', ['show', `${BASELINE}:${file}`], { cwd: ROOT }) : await readFile(resolve(ROOT, file))])));
const hash = data => createHash('sha256').update(data).digest('hex');
const sourceSha256 = Object.fromEntries(files.map(file => [file, hash(sources[file])]));
const bootstrap = 'if (root) createDailyGrowth({ root });';
assert.equal(sources['scripts/arcade-daily-growth.js'].toString().split(bootstrap).length, 2);
const controller = sources['scripts/arcade-daily-growth.js'].toString().replace(bootstrap, `if (root) {
  window.__sessionController = createDailyGrowth({ root, now: () => window.__sessionFixture.now });
  window.__sessionController.ready.then(() => { window.__sessionReady = true; });
}`); // Expose readiness and a deterministic clock only; storage, wallet import and fetch stay real.
const gameSource = execFileSync('git', ['show', `${BASELINE}:play/treeforce89/index.html`], { cwd: ROOT }).toString();
const returnLink = gameSource.match(/<a href="\/play\/">[\s\S]*?<\/a>/)?.[0];
assert(returnLink, 'Use the real existing TREE FORCE Arcade return link');
const gameHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic TREE FORCE navigation fixture</title></head>
<body><h1>Synthetic TREE FORCE navigation fixture</h1><p>No real game, wallet or backend is contacted.</p>
<button id="fixture-wave">Record a synthetic first wave</button><p id="fixture-receipt"></p><nav id="fixture-return">${returnLink}</nav>
<script>document.getElementById('fixture-wave').onclick=async()=>{const response=await fetch('/api/arcade-growth?action=treeforce-play',
{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-game-session'},body:JSON.stringify({runId:'synthetic-run'})});
document.getElementById('fixture-receipt').textContent=response.ok?'Synthetic participation saved':'Fixture failure';};</script></body></html>`;
const games = [
  { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot', creditRule: 'complete-result' },
  { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp', creditRule: 'complete-result' },
  { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials', creditRule: 'complete-result' },
  { id: 'treeforce89', label: 'TREE FORCE ’89', href: ORIGIN + '/play/treeforce89/', creditRule: 'start-run' },
];
const configuration = { enabledGames: games, eligibleGames: games, todayPick: games[3] };
const milestones = [{ id: 'seedling', label: 'Seedling', target: 3 }, { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 }, { id: 'full-canopy', label: 'Full Canopy', target: 21 }];
function progress(saved) {
  const calendar = Array.from({ length: 30 }, (_, index) => ({ dateKey: `2026-11-${String(index + 1).padStart(2, '0')}`,
    checkedIn: index === 0 || (index === 1 && saved), questCompleted: index === 1 && saved, gameIds: index === 1 && saved ? ['treeforce89'] : [] }));
  return { wallet: ACCOUNT, monthKey: '2026-11', dateKey: '2026-11-02', calendar, checkedInDays: saved ? 2 : 1, questDays: saved ? 1 : 0,
    today: { checkedIn: saved, questCompleted: saved, gameIds: saved ? ['treeforce89'] : [] },
    passport: { monthKey: '2026-11', enabledGames: games, completedGameIds: saved ? ['treeforce89'] : [], optionalGames: [], optionalCompletedGameIds: [], complete: false },
    milestones: milestones.map(goal => ({ ...goal, earned: false })), badges: [] };
}
function installProvider({ account, other, now }) {
  if (location.origin !== 'https://tree-token.xyz') return; // Initial opaque about:blank has no storage.
  const clockKey = 'fixture:session-return:clock', lateKey = 'fixture:session-return:late', permissionKey = 'fixture:session-return:permission';
  const listeners = new Set(); let accounts = [], api = null, registered = false;
  const events = [], pageshows = [];
  const record = value => { events.push(value); void window.__recordSessionFixture(value); };
  const makeAccount = address => ({ address, publicKey: new Uint8Array(32), chains: ['sui:mainnet'], features: ['sui:signPersonalMessage'] });
  const wallet = { version: '1.0.0', name: 'Slush', chains: ['sui:mainnet'], get accounts() { return accounts; }, features: {
    'standard:connect': { version: '1.0.0', async connect(options = {}) {
      record({ kind: 'provider-connect', silent: options.silent === true });
      if (options.silent && localStorage.getItem(permissionKey) !== 'authorized') throw new Error('Synthetic wallet has no prior permission');
      localStorage.setItem(permissionKey, 'authorized'); accounts = [makeAccount(account)]; return { accounts };
    } },
    'standard:events': { version: '1.0.0', on(event, listener) { if (event === 'change') listeners.add(listener); return () => listeners.delete(listener); } },
    'sui:signPersonalMessage': { version: '1.0.0', async signPersonalMessage() { record({ kind: 'synthetic-signature' }); return { signature: 'synthetic-signature-only' }; } },
  } };
  function register() {
    if (registered) return;
    if (api) { registered = true; api.register(wallet); record({ kind: 'provider-registered' }); }
    else window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: registry => { api = registry; register(); } }));
  }
  window.addEventListener('wallet-standard:app-ready', event => { api = event.detail; if (sessionStorage.getItem(lateKey) !== 'yes') register(); });
  window.addEventListener('pageshow', event => pageshows.push({ persisted: event.persisted }));
  const channel = new BroadcastChannel('fixture:session-return:wallet-events');
  const change = address => { accounts = address ? [makeAccount(address)] : []; for (const listener of listeners) listener({ accounts }); record({ kind: 'provider-accounts', address }); };
  channel.onmessage = event => change(event.data.address);
  window.__sessionFixture = { now: Number(sessionStorage.getItem(clockKey)) || now, events, pageshows, register,
    lateNext(value) { sessionStorage.setItem(lateKey, value ? 'yes' : 'no'); },
    advanceClock(value) { this.now = value; sessionStorage.setItem(clockKey, String(value)); },
    changeAccount(address = other) { change(address); channel.postMessage({ address }); } };
}

await mkdir(OUT, { recursive: true });
const checks = [], snapshots = [], screenshots = [], requests = [], providerEvents = [], errors = [], forbiddenRequests = [];
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let context, page, store, scenario;
async function fresh(name) {
  await context?.close(); scenario = name;
  store = { now: NOW, saved: false, sessions: new Map(), holdSync: false, releaseSync: null, sequence: 0 };
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.exposeBinding('__recordSessionFixture', ({ page }, event) => { providerEvents.push({ scenario: name, url: page.url(), ...event }); });
  await context.addInitScript(installProvider, { account: ACCOUNT, other: OTHER, now: NOW });
  context.on('page', activePage => {
    activePage.on('pageerror', error => errors.push({ scenario: name, message: error.message }));
    activePage.on('console', message => { if (message.type() === 'error') errors.push({ scenario: name, message: message.text() }); });
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== ORIGIN) { forbiddenRequests.push(request.url()); return route.abort(); }
    const item = { scenario: name, url: request.url(), method: request.method(), locallyFulfilled: true };
    requests.push(item);
    if (url.pathname === '/api/arcade-growth') {
      const action = url.searchParams.get('action'), body = request.postDataJSON();
      const authorization = request.headers().authorization || '';
      const token = authorization.replace(/^Bearer /, ''), session = store.sessions.get(token);
      const authenticated = Boolean(session && session.expiresAt > store.now);
      Object.assign(item, { action, authenticated, syntheticBearer: Boolean(authorization) });
      const envelope = (auth = authenticated) => ({ status: 'ok', authenticated: auth, configuration, dateKey: '2026-11-02', monthKey: '2026-11',
        serverTime: new Date(store.now).toISOString(), ...(auth ? { progress: progress(store.saved) } : {}) });
      let payload;
      if (action === 'treeforce-play') { assert.equal(token, 'synthetic-game-session'); store.saved = true; payload = { status: 'ok', receipt: 'synthetic-first-wave' }; }
      else if (action === 'challenge') payload = { status: 'ok', challenge: { challengeId: 'synthetic-challenge', wallet: body.wallet,
        message: 'Synthetic Daily Growth sign-in. No transaction.', expiresAt: new Date(store.now + 300000).toISOString() } };
      else if (action === 'session') {
        assert.equal(body.signature, 'synthetic-signature-only'); const expiresAt = store.now + 3600000, token = `synthetic-growth-${++store.sequence}`;
        store.sessions.set(token, { wallet: body.wallet, expiresAt });
        payload = { ...envelope(true), session: { token, wallet: body.wallet, expiresAt: new Date(expiresAt).toISOString() } };
      } else if (action === 'status') payload = envelope();
      else if (action === 'sync') {
        assert(authenticated, 'Sync only uses a valid synthetic Daily Growth session');
        if (store.holdSync) await new Promise(done => { store.releaseSync = done; });
        payload = { ...envelope(), sync: { checkedAt: new Date(store.now).toISOString(), games: games.map(game => ({ gameId: game.id, status: 'no-result' })) } };
      } else if (action === 'logout') { store.sessions.delete(token); payload = { status: 'ok' }; }
      else throw new Error(`Unexpected fixture API action: ${action}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    }
    assert.equal(request.method(), 'GET');
    if (url.pathname === '/play/treeforce89/') return route.fulfill({ status: 200, contentType: 'text/html', body: gameHtml });
    const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    const path = resolve(ROOT, '.' + pathname); assert(path.startsWith(ROOT + sep));
    let body = pathname === '/scripts/arcade-daily-growth.js' ? controller : sources[pathname.slice(1)];
    if (!body) { try { body = await readFile(path); } catch (error) {
      if (pathname !== '/play/canopy-defense/assets/brand/oak-guardian-preview.png') throw error;
      body = await readFile('/workspace/scratch/68c975ebd06c/growth-invitation-baseline' + pathname);
    } }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
    return route.fulfill({ status: 200, contentType: types[extname(pathname)] || 'application/octet-stream', body });
  });
  page = await context.newPage(); await page.goto(ORIGIN + '/play/'); await ready(page);
}
async function ready(activePage) { await activePage.waitForFunction(() => window.__sessionReady, null, { timeout: 10000 }); }
async function authenticated(activePage) { await activePage.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'authenticated', null, { timeout: 10000 }); }
async function signIn(activePage = page) {
  if (await activePage.locator('#growth-connect').isVisible()) {
    await activePage.locator('#growth-connect').click(); await activePage.locator('#growth-wallet-options [data-wallet-id="Slush"]').click();
    await activePage.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'connected');
  }
  await activePage.locator('#growth-sign-in').click(); await authenticated(activePage);
}
async function revealPlay(activePage = page) {
  if (!await activePage.locator('#growth-details').evaluate(element => element.open)) await activePage.locator('#growth-details > summary').click();
  await activePage.locator('#growth-today-tab').click();
  if (!await activePage.locator('#growth-quest-details').evaluate(element => element.open)) await activePage.locator('#growth-quest-details > summary').click();
}
async function snapshot(name, activePage = page) {
  const data = await activePage.evaluate(key => ({ url: location.href, openerIsNull: opener === null,
    state: document.getElementById('arcade-daily-growth')?.dataset.growthState,
    identity: document.getElementById('growth-wallet-identity')?.textContent,
    quest: document.getElementById('growth-quest-meter')?.getAttribute('aria-valuenow'),
    questText: document.getElementById('growth-quest-state')?.textContent,
    session: JSON.parse(sessionStorage.getItem(key) || 'null'),
    bearerInLocalStorage: Object.entries(localStorage).some(([key, value]) => key.includes('daily-growth:session') || value.includes('synthetic-growth-')),
    providerEvents: window.__sessionFixture.events, pageshows: window.__sessionFixture.pageshows,
  }), KEY);
  assert.equal(data.bearerInLocalStorage, false);
  snapshots.push({ scenario, name, ...data }); return data;
}
async function wave(activePage) { await activePage.locator('#fixture-wave').click(); await activePage.waitForFunction(() => document.getElementById('fixture-receipt').textContent.includes('saved')); }
async function returnToArcade(activePage) { await activePage.locator('#fixture-return a').click(); await ready(activePage); }
async function capture(name, activePage = page) { const path = resolve(OUT, `${label}-${name}.jpg`); await activePage.screenshot({ path, type: 'jpeg', quality: 80 }); screenshots.push(path); }
const count = action => requests.filter(request => request.scenario === scenario && request.action === action).length;
const pass = name => { checks.push({ name, passed: true }); console.log(JSON.stringify({ checkpoint: name, baseline })); };

try {
  await fresh('ordinary quest launch and game return'); await signIn(); await revealPlay();
  const initial = await snapshot('signed in before launch');
  assert.equal(await page.locator('#growth-play').getAttribute('target'), baseline ? '_blank' : '_self');
  let game;
  if (baseline) { const popup = page.waitForEvent('popup'); await page.locator('#growth-play').click(); game = await popup; }
  else { game = page; await page.locator('#growth-play').click(); }
  await game.waitForURL(ORIGIN + '/play/treeforce89/'); await wave(game); await returnToArcade(game);
  const returned = await snapshot('lobby reached by game return link', game);
  if (baseline) {
    assert.equal(returned.session, null); assert.equal(returned.state, 'signed-out'); assert.equal(returned.openerIsNull, true);
    const original = await snapshot('original tab still owns its session'); assert.equal(original.session.token, initial.session.token); assert.equal(original.state, 'authenticated');
  } else { await authenticated(game); assert.equal(returned.session.token, initial.session.token); assert.equal(returned.quest, '1'); assert.equal(count('session'), 1); }
  await capture('game-return', game); pass(baseline ? 'Reproduced: ordinary quest popup returns to a tokenless lobby while original tab remains signed in' : 'Normal TREE FORCE quest launch stays in the authenticated tab and saved progress returns without a new signature');

  await fresh('same-tab cabinet and browser history'); await signIn();
  await page.locator('a[aria-labelledby="force-title"]').click();
  await page.waitForURL(ORIGIN + '/play/treeforce89/'); await wave(page); await returnToArcade(page); await authenticated(page);
  assert.equal((await snapshot('same-tab cabinet link return')).quest, '1');
  await page.goBack(); await page.waitForURL(ORIGIN + '/play/treeforce89/'); await page.goBack(); await ready(page); await authenticated(page);
  await snapshot('actual browser history return'); pass('Same-tab cabinet return and browser history retain sessionStorage and recover saved participation');

  await fresh('late wallet registration after game return'); await signIn();
  await page.evaluate(() => window.__sessionFixture.lateNext(true));
  await page.locator('a[aria-labelledby="force-title"]').click(); await page.waitForURL(ORIGIN + '/play/treeforce89/'); await wave(page); await returnToArcade(page);
  const beforeDiscovery = await snapshot('token retained before extension discovery');
  assert(beforeDiscovery.session); assert.notEqual(beforeDiscovery.state, 'authenticated');
  await page.evaluate(() => window.__sessionFixture.register());
  if (baseline) { await page.waitForTimeout(100); const late = await snapshot('extension registered but no restoration retry'); assert.equal(late.state, 'signed-out'); assert(late.session); }
  else { await authenticated(page); const late = await snapshot('exact late provider restores saved session'); assert.equal(late.quest, '1'); assert.equal(count('session'), 1); }
  await capture('late-provider'); pass(baseline ? 'Reproduced: late provider discovery leaves a valid stored token unused' : 'Late exact-provider discovery restores the existing token and retrieves saved participation');

  await fresh('restored session expiry and renewal'); await signIn(); await page.reload(); await ready(page); await authenticated(page);
  store.now += 3600001; await page.evaluate(now => { window.__sessionFixture.advanceClock(now); dispatchEvent(new Event('focus')); }, store.now);
  await page.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'connected');
  await page.locator('#growth-sign-in').click(); await authenticated(page);
  const renewed = await snapshot('explicit renewed session provider identity'); assert.equal(renewed.session.walletId, baseline ? null : 'Slush');
  await page.reload(); await ready(page);
  if (baseline) { const reloaded = await snapshot('renewal token cannot restore without provider ID'); assert.equal(reloaded.state, 'signed-out'); assert(reloaded.session); }
  else { await authenticated(page); const reloaded = await snapshot('renewal remains restorable'); assert.equal(reloaded.session.walletId, 'Slush'); }
  pass(baseline ? 'Reproduced: restored-session renewal loses provider ID and cannot restore on next reload' : 'Explicit renewal retains provider ID and survives the next real reload');

  await fresh('original-tab lifecycle return and account events'); await signIn(); await revealPlay();
  const popup = context.waitForEvent('page'); await page.locator('#growth-play').click({ modifiers: ['Control'] }); game = await popup;
  await game.waitForURL(ORIGIN + '/play/treeforce89/'); await wave(game);
  const priorSync = count('sync'); store.holdSync = !baseline;
  await page.bringToFront(); await page.evaluate(() => { dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  if (baseline) {
    await page.waitForTimeout(100); assert.equal(count('sync'), priorSync); assert.equal((await snapshot('return events keep old progress')).quest, '0');
    await page.evaluate(() => window.__sessionController.refresh()); assert.equal((await snapshot('manual refresh recovers the recorded first wave')).quest, '1');
  } else {
    await page.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'syncing');
    assert.equal(count('sync'), priorSync + 1); store.holdSync = false; store.releaseSync(); await authenticated(page);
    assert.equal((await snapshot('deduplicated return sync retrieves recorded first wave')).quest, '1');
    await page.evaluate(() => { dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await page.waitForTimeout(100); assert.equal(count('sync'), priorSync + 1);
  }
  assert.equal(count('session'), 1); assert.equal(count('challenge'), 1); assert.equal(count('check-in'), 0);
  await game.evaluate(() => window.__sessionFixture.changeAccount());
  await page.waitForFunction(key => sessionStorage.getItem(key) === null, KEY);
  const changed = await snapshot('cross-tab provider account change invalidates old identity'); assert.notEqual(changed.state, 'authenticated'); assert.equal(changed.quest, null);
  pass(baseline ? 'Reproduced: return events stay stale until manual sync; cross-tab account change still invalidates authorization' : 'Focus/visible/pageshow return burst performs one sync with no new signature/check-in; cross-tab account changes clear authorization');

  assert.deepEqual(errors, []); assert.deepEqual(forbiddenRequests, []);
  if (!baseline) for (const file of files) assert((await readFile(resolve(ROOT, file))).equals(sources[file]), `Source changed during final QA: ${file}`);
  await writeFile(resolve(OUT, `${label}-browser-report.json`), JSON.stringify({ passed: true, baselineDefectsExpected: baseline, sourceCommit: baseline ? BASELINE : null,
    sourceSha256, checkedAt: new Date().toISOString(), synthetic: true, actualWalletBundle: true, browserNativeSessionStorage: true,
    noBearerInLocalStorage: true, allRequestsLocallyFulfilled: true, noRealWalletActions: true, noRealRemoteWrites: true,
    gameFixtureUsesExactExistingReturnLink: returnLink, checks, snapshots, screenshots, requests, providerEvents, errors, forbiddenRequests }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, label, checks: checks.length, report: resolve(OUT, `${label}-browser-report.json`) }));
} catch (error) {
  if (page && !page.isClosed()) await capture('failure').catch(() => {});
  await writeFile(resolve(OUT, `${label}-browser-report.json`), JSON.stringify({ passed: false, baselineDefectsExpected: baseline, error: String(error), sourceSha256,
    checks, snapshots, screenshots, requests, providerEvents, errors, forbiddenRequests }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
