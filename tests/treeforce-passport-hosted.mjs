// Actual hosted, signed-out Passport smoke. No fixtures or response replacement.
// Run only against an authorized target:
// node --use-env-proxy tests/treeforce-passport-hosted.mjs HTTPS_ORIGIN --required 4
// Use --required 3 before the required-game configuration is activated.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, X509Certificate } from 'node:crypto';
import https from 'node:https';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/review/treeforce-passport');
const target = process.argv[2];
assert(target, 'Pass the authorized candidate or canonical origin');
const origin = new URL(target).origin;
assert(origin === 'https://tree-token.xyz' || /^https:\/\/[a-f0-9]{24}--tree-token\.netlify\.app$/.test(origin), 'Unexpected hosted target');
const args = process.argv.slice(3);
const flag = args.indexOf('--required');
const required = Number(flag >= 0 ? args[flag + 1] : args.find(value => /^--required=?[34]$/.test(value))?.replace('--required', '').replace('=', ''));
assert([3, 4].includes(required), 'Specify --required 3 or --required 4');
const label = origin === 'https://tree-token.xyz' ? 'canonical' : 'candidate';
const BROWSER = process.env.ARCADE_CHROMIUM_PATH || '/tmp/daily-growth-invitation-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exactFiles = [
  'scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css', 'assets/arcade/arcade-growth-wallet.js',
  'assets/arcade/tree-force-89-poster.webp', 'assets/arcade/garden-bot-poster.webp', 'assets/arcade/tree-arcade-social.jpg',
];
const sourceSha256 = Object.fromEntries(await Promise.all(exactFiles.map(async file => [file, digest(await readFile(resolve(ROOT, file)))])));
const expectedCabinetLinks = {
  'force-title': '/play/treeforce89/', 'arboretum-title': 'https://treegrow.xyz/',
  'deadfall-title': 'https://tree-token.xyz/play/deadfall-run/', 'canopy-title': 'https://tree-token.xyz/play/canopy-defense/preview/',
  'garden-bot-title': 'https://nftree.net/battle/garden-bot', 'pvp-title': 'https://nftree.net/battle/pvp',
  'trials-title': 'https://nftree.net/battle/trials', 'clash-title': 'https://nftree.net/battle/canopy-clash',
};
await mkdir(OUT, { recursive: true });
// Trust only the environment's configured CA in this ephemeral browser. Node
// independently verifies the same hosted origin before browser navigation.
const ca = new X509Certificate(await readFile('/usr/local/share/ca-certificates/nebula-dns.crt'));
const pin = createHash('sha256').update(ca.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
const tls = await new Promise((done, reject) => {
  const request = https.get(origin + '/play/', response => {
    const result = { authorized: response.socket.authorized, status: response.statusCode };
    response.resume(); response.on('end', () => done(result));
  }); request.on('error', reject);
});
assert(tls.authorized && tls.status === 200, 'Configured CA independently verifies the target');
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors-spki-list=' + pin] });
const requests = [], responses = [], blockedRequests = [], pageErrors = [], consoleErrors = [], checks = [], dimensions = [], screenshots = [], fetchedFiles = [];
let configuration, cabinetLinks;
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
await context.route('**/*', route => {
  const request = route.request(); const url = new URL(request.url());
  const item = { url: request.url(), method: request.method(), hasAuthorization: Boolean(request.headers().authorization) };
  requests.push(item);
  if (url.origin !== origin || !['GET', 'HEAD'].includes(item.method) || item.hasAuthorization
    || (url.pathname === '/api/arcade-growth' && url.searchParams.get('action') !== 'status')) {
    blockedRequests.push(item); return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('response', response => responses.push({ url: response.url(), status: response.status() }));
try {
  const pendingFiles = exactFiles.map(file => page.waitForResponse(response => new URL(response.url()).pathname === '/' + file));
  const pendingStatus = page.waitForResponse(response => {
    const url = new URL(response.url()); return url.pathname === '/api/arcade-growth' && url.searchParams.get('action') === 'status';
  });
  const htmlResponse = await page.goto(origin + '/play/', { waitUntil: 'domcontentloaded' });
  assert.equal(htmlResponse.status(), 200);
  assert.match(await htmlResponse.text(), /Required Arcade Passport game stamps/);
  const statusResponse = await pendingStatus;
  assert.equal(statusResponse.status(), 200);
  const publicStatus = await statusResponse.json();
  assert.equal(publicStatus.status, 'ok'); assert.equal(publicStatus.authenticated, false);
  assert.equal(Object.hasOwn(publicStatus, 'progress'), false, 'Public status has no personal progress');
  configuration = publicStatus.configuration;
  const requiredIds = ['garden-bot', 'pvp', 'arborist-trials', ...(required === 4 ? ['treeforce89'] : [])];
  assert.deepEqual(configuration.enabledGames.map(game => game.id).sort(), requiredIds.sort());
  assert.deepEqual(configuration.eligibleGames.map(game => game.id).sort(), ['garden-bot', 'pvp', 'arborist-trials', 'treeforce89'].sort());
  assert.equal(configuration.eligibleGames.find(game => game.id === 'treeforce89').creditRule, 'start-run');
  await page.waitForFunction(() => document.getElementById('arcade-daily-growth')?.dataset.growthState === 'signed-out' && !document.getElementById('growth-connect').disabled, null, { timeout: 20000 });
  const actualFiles = await Promise.all(pendingFiles);
  for (let index = 0; index < actualFiles.length; index += 1) {
    const response = actualFiles[index]; const file = exactFiles[index];
    assert.equal(response.status(), 200, file);
    const sha256 = digest(await response.body());
    assert.equal(sha256, sourceSha256[file], `${file} matches the reviewed local source`);
    fetchedFiles.push({ file, status: response.status(), sha256 });
  }
  assert.equal(await page.evaluate(() => typeof window.__passportFixture), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.__fixtureOptions), 'undefined');
  checks.push({ name: `Real anonymous public status has ${required} required games, four eligible games, and no private progress`, passed: true });
  checks.push({ name: 'Actual controller, stylesheet, wallet bundle, and three artwork files match reviewed bytes', passed: true });
  cabinetLinks = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.closest('a')?.getAttribute('href')])), Object.keys(expectedCabinetLinks));
  assert.deepEqual(cabinetLinks, expectedCabinetLinks);
  checks.push({ name: 'All eight cabinet destinations remain intact; no game is opened', passed: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur?.(); scrollTo(0, 0); });
    await page.waitForLoadState('networkidle');
    const sizes = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scrollY, width: r.width, height: r.height }; };
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster'), open: document.getElementById('growth-details').open };
    });
    assert.equal(sizes.open, false); assert(sizes.scrollWidth <= viewport.width + 1);
    assert(sizes.panel.height <= (viewport.width >= 1000 ? 190 : 270)); assert(sizes.firstPoster.top < viewport.height);
    assert(await page.getByRole('button', { name: 'Connect to check in', exact: true }).isVisible());
    const screenshot = resolve(OUT, `${label}-signedout-${viewport.width}.jpg`);
    await page.screenshot({ path: screenshot, type: 'jpeg', quality: 85, animations: 'disabled' }); screenshots.push(screenshot);
    const before = requests.filter(item => new URL(item.url).pathname === '/api/arcade-growth').length;
    const summary = page.locator('#growth-details > summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('growth-invitation-open').getAttribute('aria-expanded') === 'true');
    assert.equal(await page.locator('#growth-today-tab').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('#growth-tracking-note').textContent(), required === 4 ? /part of this month’s Arcade Passport.*first wave/ : /optional participation stamp/);
    assert.equal(await page.locator('#growth-stamps > *').count(), 0);
    assert.equal(await page.locator('#growth-optional-stamps > *').count(), 0);
    assert.equal(await page.locator('#growth-passport-count').textContent(), 'Sign in to view');
    assert.equal(await page.locator('#growth-visit-count').textContent(), '—');
    for (const id of ['summary-meter', 'passport-meter', 'attendance-meter', 'quest-meter']) assert.equal(await page.locator(`#growth-${id}`).getAttribute('aria-valuenow'), null);
    const expandedWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(expandedWidth <= viewport.width + 1);
    await summary.focus(); await page.keyboard.press('Enter');
    assert.equal(requests.filter(item => new URL(item.url).pathname === '/api/arcade-growth').length, before);
    dimensions.push({ viewport, ...sizes, expandedScrollWidth: expandedWidth });
    checks.push({ name: `${viewport.width}px compact invitation and native disclosure: correct rule, private stamps remain unknown, no overflow or API actions`, passed: true });
  }
  await page.waitForLoadState('networkidle');
  assert.deepEqual(blockedRequests, []); assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []);
  assert(responses.every(response => response.status === 200));
  checks.push({ name: 'Only same-origin unauthenticated GET/HEAD requests; no fixtures, wallet actions, signatures, writes, or browser errors', passed: true });
  const report = { passed: true, actualHostedCode: true, synthetic: false, target: origin + '/play/', label, expectedRequiredGames: required,
    checkedAt: new Date().toISOString(), tls, configuration, sourceSha256, fetchedFiles, checks, dimensions, cabinetLinks, screenshots,
    requests, responses, blockedRequests, pageErrors, consoleErrors, noWalletConnected: true, noSignatures: true, noRemoteWrites: true };
  await writeFile(resolve(OUT, `${label}-browser-report.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, label, required, checks: checks.length, screenshots: screenshots.length, requests: requests.length, report: resolve(OUT, `${label}-browser-report.json`) }));
} catch (error) {
  await writeFile(resolve(OUT, `${label}-browser-report.json`), JSON.stringify({ passed: false, actualHostedCode: true, synthetic: false, target: origin + '/play/', expectedRequiredGames: required,
    error: String(error), tls, configuration, sourceSha256, fetchedFiles, checks, dimensions, cabinetLinks, screenshots, requests, responses, blockedRequests, pageErrors, consoleErrors }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
