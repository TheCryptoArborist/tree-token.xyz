import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const localOnly = process.env.ARCADE_WALLET_LOCAL === '1';
assert.ok(process.env.ARCADE_WALLET_ORIGIN, 'Set ARCADE_WALLET_ORIGIN to the exact site or candidate origin.');
const target = new URL(process.env.ARCADE_WALLET_ORIGIN);
assert.equal(target.pathname, '/', 'Supply an origin, without a path.');
assert.ok(!target.search && !target.hash && !target.username && !target.password);
assert.ok(target.protocol === 'https:' || target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname));
const origin = target.origin;
const output = path.resolve(root, process.env.ARCADE_WALLET_REVIEW_OUTPUT || '.netlify/arcade-wallet-switch-review');
const playwrightPath = process.env.ARCADE_PLAYWRIGHT_MODULE
  || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(playwrightPath.startsWith('file:') ? playwrightPath : pathToFileURL(playwrightPath).href);
const A = `0x${'a'.repeat(64)}`;
const B = `0x${'b'.repeat(64)}`;
const KEY = 'tree-arcade:daily-growth:session:v1';
const WALLET_NAME = 'Test Slush';
const widths = [320, 390, 1280];
const tabs = [
  ['games', 'growth-games-tab', 'games'], ['daily', 'growth-today-tab', 'daily'],
  ['campaigns', 'growth-campaigns-tab', 'campaigns'], ['events', 'growth-events-tab', 'events'],
  ['month', 'growth-month-tab', 'monthlyProgress'], ['badges', 'growth-badges-tab', 'badgeCollection'],
];
const checkNames = [...tabs.map(([, , name]) => name), 'mobileLayout', 'noMissingAssets', 'countdownUTC',
  'walletSignOut', 'walletSwitch', 'sameProviderAccountSelection', 'cancelKeepsSignedOut', 'noOldWalletData', 'returnsSignedOut'];
const localAssets = new Map([
  ['/scripts/arcade-daily-growth-play-share.js', ['production/arcade-organization-static/runtime/scripts/arcade-daily-growth-play-share.js', 'text/javascript']],
  ['/assets/arcade/arcade-growth-wallet.js', ['production/arcade-organization-static/runtime/assets/arcade/arcade-growth-wallet.js', 'text/javascript']],
  ['/scripts/arcade-monthly.js', ['scripts/arcade-monthly.js', 'text/javascript']],
  ['/styles/arcade-organization.css', ['styles/arcade-organization.css', 'text/css']],
]);
const report = {
  schemaVersion: 1, result: 'failed', origin, checkedAt: new Date().toISOString(),
  viewportWidths: widths, noWalletOrPaymentActions: true, syntheticWalletOnly: true,
  checks: Object.fromEntries(checkNames.map((name) => [name, false])),
  viewports: [], screenshots: [], browserErrors: [], assetFailures: [], unexpectedWrites: [],
  unsupportedAPIReads: [], failures: [],
  evidence: {
    wallet: 'Synthetic Test Slush provider with two fake accounts; no keys or real signatures.',
    network: 'Every API request is intercepted. Unexpected writes are aborted; no backend writes are forwarded.',
    assets: 'Essential header, hero, daily, cabinet and campaign images are decoded before inspection; encountered static failures are recorded.',
  },
};
if (localOnly) report.localOnly = true;
const planPath = path.join(root, '.netlify/arcade-wallet-switch/plan.json');
const candidatePath = path.join(root, '.netlify/arcade-wallet-switch/candidate.json');
if (!localOnly && fs.existsSync(planPath) && fs.existsSync(candidatePath)) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const state = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  assert.equal(state.sourceCommit, plan.sourceCommit);
  assert.equal(state.planSha256, fingerprint(plan));
  assert.match(state.id, /^[a-f0-9]{24}$/);
  const candidateOrigin = new URL(state.deployUrl || state.deploy_url || `https://${state.id}--tree-token.netlify.app`).origin;
  assert.equal(origin, candidateOrigin, 'Candidate evidence must use the candidate origin without local overrides.');
  Object.assign(report, {
    sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree,
    candidateId: state.id, planSha256: fingerprint(plan),
  });
} else if (!localOnly) report.unboundReview = true;
fs.mkdirSync(output, { recursive: true });

function installSyntheticWallet({ A, B, KEY, WALLET_NAME }) {
  const audit = { connections: [], disconnects: 0, signatures: [], forbiddenActions: [] };
  Object.defineProperty(window, '__arcadeWalletReview', { value: audit });
  const accounts = [A, B].map((address, index) => ({
    address, publicKey: new Uint8Array(32).fill(index + 1),
    chains: ['sui:mainnet'], features: ['sui:signPersonalMessage'], label: `Test account ${index ? 'B' : 'A'}`,
  }));
  let authorized = [...accounts];
  const listeners = new Set();
  const changed = () => { for (const callback of listeners) callback({ accounts: [...authorized] }); };
  const forbidden = (name) => async () => {
    audit.forbiddenActions.push(name);
    throw new Error(`Browser review forbids on-chain wallet action: ${name}`);
  };
  const wallet = {
    version: '1.0.0', name: WALLET_NAME,
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MCA0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMTAiIGZpbGw9IiM4MGYxYzIiLz48dGV4dCB4PSIyMCIgeT0iMjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjQiPlQ8L3RleHQ+PC9zdmc+',
    chains: ['sui:mainnet'],
    get accounts() { return [...authorized]; },
    features: {
      'standard:connect': { version: '1.0.0', async connect(options = {}) {
        audit.connections.push({ silent: Boolean(options.silent) });
        authorized = [...accounts]; changed();
        return { accounts: [...authorized] };
      } },
      'standard:disconnect': { version: '1.0.0', async disconnect() {
        audit.disconnects++; authorized = []; changed();
      } },
      'standard:events': { version: '1.0.0', on(event, callback) {
        if (event === 'change') listeners.add(callback);
        return () => listeners.delete(callback);
      } },
      'sui:signPersonalMessage': { version: '1.1.0', async signPersonalMessage({ account, message }) {
        if (!authorized.some((candidate) => candidate.address === account.address)) throw new Error('Account is not authorized');
        audit.signatures.push({ address: account.address, message: new TextDecoder().decode(message) });
        return { signature: `synthetic-review-signature-${account.address.slice(-1)}` };
      } },
      'sui:signTransaction': { version: '2.0.0', signTransaction: forbidden('signTransaction') },
      'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction: forbidden('signAndExecuteTransaction') },
      'sui:signTransactionBlock': { version: '1.0.0', signTransactionBlock: forbidden('signTransactionBlock') },
      'sui:signAndExecuteTransactionBlock': { version: '1.0.0', signAndExecuteTransactionBlock: forbidden('signAndExecuteTransactionBlock') },
    },
  };
  window.addEventListener('wallet-standard:app-ready', (event) => event.detail.register(wallet));
  window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', {
    detail: ({ register }) => register(wallet),
  }));
  // A fresh browser context is seeded once; reload must exercise sign-out
  // persistence rather than creating another synthetic login.
  const sentinel = 'tree-arcade:wallet-review:seeded';
  if (!sessionStorage.getItem(sentinel)) {
    sessionStorage.setItem(sentinel, '1');
    localStorage.setItem(KEY, JSON.stringify({
      version: 1, token: 'a'.repeat(64), wallet: A, walletId: WALLET_NAME,
      walletName: WALLET_NAME, expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }));
  }
}

function createMockAPI(width) {
  const calls = [];
  const checked = new Set([A]);
  const now = Date.now();
  const dateKey = new Date(now).toISOString().slice(0, 10);
  const monthKey = dateKey.slice(0, 7);
  const [year, month] = monthKey.split('-').map(Number);
  const day = Number(dateKey.slice(-2));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  function envelope(wallet = null) {
    const attended = Boolean(wallet && checked.has(wallet));
    return {
      status: 'ok', authenticated: Boolean(wallet), dateKey, monthKey,
      configuration: { enabledGames: [], eligibleGames: [] },
      ...(wallet ? { progress: {
        wallet, monthKey, dateKey,
        calendar: Array.from({ length: days }, (_, index) => ({
          dateKey: `${monthKey}-${String(index + 1).padStart(2, '0')}`,
          checkedIn: index + 1 === day && attended, questCompleted: false, gameIds: [],
        })),
        checkedInDays: attended ? 1 : 0, questDays: 0,
        today: { checkedIn: attended, questCompleted: false, gameIds: [] },
        passport: { monthKey, enabledGames: [], completedGameIds: [], complete: false },
        milestones: [], badges: [],
      } } : {}),
    };
  }
  return {
    calls, checked, monthKey,
    async handle(route, request, url) {
      const method = request.method();
      const action = url.searchParams.get('action');
      let body = null;
      try { body = request.postData() ? JSON.parse(request.postData()) : null; } catch {}
      const authorization = request.headers().authorization || '';
      const wallet = body?.wallet || (authorization === `Bearer ${'a'.repeat(64)}` ? A : authorization === `Bearer ${'b'.repeat(64)}` ? B : null);
      calls.push({ path: url.pathname, action, method, wallet });
      const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/api/arcade-growth' && ['status', 'sync', 'challenge', 'session', 'logout', 'check-in'].includes(action)
        && method === (action === 'status' ? 'GET' : 'POST')) {
        if (action === 'challenge') return send({ status: 'ok', challenge: {
          wallet, challengeId: `synthetic-review-${wallet?.slice(-1)}`,
          message: `Synthetic review only: sign in with ${wallet}`,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        } });
        if (action === 'session') return send({ ...envelope(wallet), session: {
          wallet, token: wallet === B ? 'b'.repeat(64) : 'a'.repeat(64), expiresAt: new Date(Date.now() + 600_000).toISOString(),
        } });
        if (action === 'logout') return send({ status: 'ok' });
        if (action === 'check-in') checked.add(wallet);
        return send(envelope(wallet));
      }
      if (method === 'GET' && url.pathname === '/api/arcade-completed-runs') return send({ wallet, dateKey, runs: [], sources: {} });
      if (method === 'GET' && url.pathname === '/api/arcade-social') return send({ wallet, entries: [], monthlyStamps: 0, resetsAt: new Date(now + 86_400_000).toISOString() });
      if (method === 'GET' && url.pathname === '/api/arcade-campaign') return send({ status: 'ok', progress: {
        wallet, campaignId: 'first-round-v1', canClaim: false, quizCompleteThisWeek: false,
        learningStamps: 0, startedAt: null, claimedAt: null,
        tasks: { checkIn: checked.has(wallet), quiz: false, game: false, share: false },
      } });
      if (method === 'GET' && url.pathname === '/api/arcade-monthly' && action === 'status') return send({ status: 'ok', progress: {
        wallet, monthKey, attendance: { streak: checked.has(wallet) ? 1 : 0, missedDates: [] },
        monthlyReward: { requiredQuestDays: 20, verifiedQuestDays: 0, qualified: false, todayQualified: false },
      } });
      if (!['GET', 'HEAD'].includes(method)) {
        report.unexpectedWrites.push({ width, method, url: url.href });
        return route.abort('blockedbyclient');
      }
      report.unsupportedAPIReads.push({ width, url: url.href });
      return send({ status: 'error', message: 'Read endpoint unavailable in isolated wallet review.' }, 503);
    },
  };
}

async function assertNoOverflow(page, width, phase) {
  const result = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert.ok(result.documentWidth <= result.width + 1, `${phase} has horizontal overflow at ${width}px (${result.documentWidth}px)`);
}

async function decodeImages(page, selectors, width) {
  const failures = await page.evaluate(async (selectors) => {
    const images = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
    return (await Promise.all(images.map(async (image) => {
      // Only the named essential images are made eager; hidden gallery art is
      // allowed to retain the application's normal lazy-loading behavior.
      image.loading = 'eager';
      try {
        await Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('Image decode timeout')), 12_000))]);
      } catch (error) { return { src: image.currentSrc || image.src, message: error.message }; }
      return image.naturalWidth > 0 ? null : { src: image.currentSrc || image.src, message: 'Image has no decoded width' };
    }))).filter(Boolean);
  }, selectors);
  report.assetFailures.push(...failures.map((failure) => ({ width, ...failure })));
  assert.deepEqual(failures, [], `Essential images should load at ${width}px`);
}

async function assertSignedOut(page) {
  await page.waitForFunction((KEY) => !localStorage.getItem(KEY) && !sessionStorage.getItem(KEY)
    && !document.getElementById('growth-wallet-state')?.textContent.includes('Signed in'), KEY);
  const actual = await page.evaluate(async () => (await import('/assets/arcade/arcade-growth-wallet.js')).getWalletState());
  assert.equal(actual.connected, false, 'The bridge must also be disconnected');
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, name), fullPage: false, animations: 'disabled' });
  report.screenshots.push(name);
}

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE || undefined });
  for (const width of widths) {
    const viewportResult = { width, checks: Object.fromEntries(checkNames.map((name) => [name, false])), mockedAPIRequests: [] };
    report.viewports.push(viewportResult);
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const api = createMockAPI(width);
    await context.addInitScript(installSyntheticWallet, { A, B, KEY, WALLET_NAME });
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.includes('/api/') || url.pathname.startsWith('/.netlify/functions/')) return api.handle(route, request, url);
      if (!['GET', 'HEAD'].includes(request.method())) {
        report.unexpectedWrites.push({ width, method: request.method(), url: url.href });
        return route.abort('blockedbyclient');
      }
      if (localOnly && url.origin === origin && localAssets.has(url.pathname)) {
        const [filename, contentType] = localAssets.get(url.pathname);
        return route.fulfill({ contentType, body: fs.readFileSync(path.join(root, filename)), headers: { 'Cache-Control': 'no-store' } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', (error) => report.browserErrors.push({ width, message: error.message }));
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin === origin && response.status() >= 400
        && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) {
        report.assetFailures.push({ width, src: url.href, status: response.status() });
      }
    });
    try {
      const response = await page.goto(`${origin}/play/#daily`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      assert.equal(response?.status(), 200, 'Arcade page should load');
      await page.locator('.arcade-organization-page #arcade-daily-growth').waitFor();
      await page.waitForFunction(({ KEY, A }) => JSON.parse(localStorage.getItem(KEY) || 'null')?.wallet === A
        && document.getElementById('growth-wallet-state')?.textContent.includes('Signed in')
        && !document.getElementById('growth-connect')?.disabled, { KEY, A });
      await decodeImages(page, ['.suite-brand img', '.suite-hero-art', '.growth-strip-art'], width);
      assert.equal(await page.locator('#growth-sign-out').isVisible(), true);
      assert.equal(await page.locator('#growth-connect').isVisible(), true);
      assert.match(await page.locator('#growth-connect').textContent(), /Switch wallet/i);
      assert.equal(await page.locator('#growth-wallet-state').getAttribute('title'), A);

      for (const [key, tabId, name] of tabs) {
        await page.locator(`#${tabId}`).click();
        await page.waitForFunction((key) => document.getElementById('arcade-daily-growth')?.dataset.arcadeView === key, key);
        assert.equal(await page.locator(`#${tabId}`).getAttribute('aria-selected'), 'true');
        const panelId = await page.locator(`#${tabId}`).getAttribute('aria-controls');
        assert.equal(await page.locator(`#${panelId}`).isVisible(), true, `${key} panel should be visible`);
        await assertNoOverflow(page, width, key);
        if (key === 'games') await decodeImages(page, ['#cabinets .poster-link img'], width);
        if (key === 'campaigns') await decodeImages(page, ['.arcade-campaign-spotlight img', '.arcade-campaign-next img'], width);
        if (key === 'month' || key === 'badges') {
          const selector = key === 'month' ? '.arcade-month-deadline' : '#growth-badges-panel [data-arcade-season-countdown]';
          const countdown = page.locator(selector);
          await countdown.waitFor({ state: 'visible' });
          const time = countdown.locator('.arcade-season-deadline__date time');
          assert.match(await time.textContent(), /00:00 UTC/);
          const [year, month] = api.monthKey.split('-').map(Number);
          assert.equal(await time.getAttribute('datetime'), new Date(Date.UTC(year, month, 1)).toISOString());
          assert.equal(await countdown.getAttribute('data-countdown-state'), 'active');
          assert.equal(await countdown.locator('[role="timer"]').isVisible(), true);
          viewportResult.checks.countdownUTC = true;
        }
        viewportResult.checks[name] = true;
      }
      viewportResult.checks.mobileLayout = true;
      viewportResult.checks.noMissingAssets = !report.assetFailures.some((failure) => failure.width === width);
      await page.locator('#growth-today-tab').click();
      await page.locator('.arcade-daily-masthead').scrollIntoViewIfNeeded();
      await screenshot(page, `signed-in-${width}.png`);

      await page.locator('#growth-connect').click();
      await page.locator('#growth-wallet-picker[open]').waitFor();
      await assertSignedOut(page);
      await page.locator(`[data-wallet-id="${WALLET_NAME}"]`).click();
      await page.locator(`[data-account-address="${B}"]`).waitFor();
      assert.equal(await page.locator(`[data-account-address="${A}"]`).isVisible(), true);
      const beforeChoice = await page.evaluate(() => window.__arcadeWalletReview.signatures);
      assert.deepEqual(beforeChoice, [], 'No account may sign before the player chooses');
      assert.equal(api.calls.filter((call) => call.action === 'check-in').length, 0);
      await assertNoOverflow(page, width, 'account picker');
      const pickerBounds = await page.locator('#growth-wallet-picker').boundingBox();
      assert.ok(pickerBounds && pickerBounds.x >= 0 && pickerBounds.x + pickerBounds.width <= width + 1, 'Account picker must fit the viewport');
      await screenshot(page, `account-picker-${width}.png`);
      await page.locator(`[data-account-address="${B}"]`).click();
      await page.waitForFunction(({ KEY, B }) => JSON.parse(localStorage.getItem(KEY) || 'null')?.wallet === B
        && document.getElementById('growth-wallet-state')?.title === B
        && document.getElementById('growth-check-in-row')?.textContent.includes('Checked in'), { KEY, B });
      assert.equal(api.checked.has(B), true);
      const afterChoice = await page.evaluate(() => window.__arcadeWalletReview);
      assert.deepEqual(afterChoice.signatures.map((entry) => entry.address), [B]);
      assert.deepEqual(api.calls.filter((call) => call.action === 'check-in').map((call) => call.wallet), [B]);
      const saved = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
      assert.equal(saved.wallet, B);
      assert.equal(saved.token, 'b'.repeat(64));
      assert.equal(await page.locator('#growth-wallet-identity').getAttribute('title'), B);
      viewportResult.checks.walletSwitch = true;
      viewportResult.checks.sameProviderAccountSelection = true;
      viewportResult.checks.noOldWalletData = true;

      await page.locator('#growth-sign-out').click();
      await assertSignedOut(page);
      viewportResult.checks.walletSignOut = true;
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('pageshow'));
      });
      await assertSignedOut(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.arcade-organization-page #growth-connect').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('growth-connect')?.disabled);
      await assertSignedOut(page);
      assert.equal(await page.evaluate(() => window.__arcadeWalletReview.signatures.length), 0);
      viewportResult.checks.returnsSignedOut = true;

      // Cancelling after the provider returns multiple accounts must not sign
      // in the first account or leave a lingering connected account.
      await page.locator('#growth-connect').click();
      await page.locator('#growth-wallet-picker[open]').waitFor();
      await page.locator(`[data-wallet-id="${WALLET_NAME}"]`).click();
      await page.locator(`[data-account-address="${B}"]`).waitFor();
      await page.locator('#growth-wallet-close').click();
      await page.locator('#growth-wallet-picker[open]').waitFor({ state: 'hidden' });
      await assertSignedOut(page);
      assert.equal(await page.evaluate(() => window.__arcadeWalletReview.signatures.length), 0);
      assert.deepEqual(await page.evaluate(() => window.__arcadeWalletReview.forbiddenActions), []);
      viewportResult.checks.cancelKeepsSignedOut = true;
      assert.ok(!report.browserErrors.some((error) => error.width === width), 'Browser should have no uncaught exceptions');
      assert.ok(!report.unexpectedWrites.some((request) => request.width === width), 'No unexpected write may be attempted');
      assert.ok(!report.assetFailures.some((failure) => failure.width === width), 'No encountered static asset should fail');
      console.log(`${width}px: six tabs, UTC countdown, wallet switch, two-account selection, sign-out and cancellation passed.`);
    } catch (error) {
      report.failures.push({ width, message: error.message, stack: error.stack });
      try { await screenshot(page, `failure-${width}.png`); } catch {}
      console.error(`${width}px: ${error.message}`);
    } finally {
      viewportResult.mockedAPIRequests = api.calls;
      await context.close();
    }
  }
  for (const name of checkNames) report.checks[name] = report.viewports.length === widths.length && report.viewports.every((viewport) => viewport.checks[name]);
  if (!report.failures.length && !report.browserErrors.length && !report.assetFailures.length
    && !report.unexpectedWrites.length && Object.values(report.checks).every(Boolean)) report.result = 'passed';
} catch (error) {
  report.failures.push({ message: error.message, stack: error.stack });
} finally {
  if (browser) await browser.close();
  report.checkedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'browser-review.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, localOnly, origin, output, checks: report.checks,
    failures: report.failures.map(({ width, message }) => ({ width, message })),
    browserErrors: report.browserErrors, assetFailures: report.assetFailures,
    unexpectedWrites: report.unexpectedWrites, screenshots: report.screenshots }, null, 2));
  if (report.result !== 'passed') process.exitCode = 1;
}
