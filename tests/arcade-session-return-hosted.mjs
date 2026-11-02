// Session-return release: actual hosted signed-out smoke, with no fixtures or response replacement.
// Usage: node --use-env-proxy tests/arcade-session-return-hosted.mjs HTTPS_ORIGIN [STAGING_OUTPUT_DIR]
// Only the canonical site or an explicitly supplied candidate origin is allowed.
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash, X509Certificate } from 'node:crypto';
import https from 'node:https';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '..');
const STAGING_ROOT = resolve(ROOT, '.netlify/arcade-session-return/hosted');
const OUT = process.argv[3] ? resolve(ROOT, process.argv[3]) : resolve(ROOT, 'docs/review/arcade-session-return');
assert(!process.argv[3] || OUT === STAGING_ROOT || OUT.startsWith(STAGING_ROOT + sep), 'Optional output directory must be within the release hosted staging directory');
assert(process.argv[2], 'Pass the authorized candidate or canonical URL');
const target = new URL(process.argv[2]), origin = target.origin;
assert(!target.username && !target.password && !target.search && !target.hash && ['/', '/play/'].includes(target.pathname), 'Use a plain authorized origin or /play/ URL');
assert(origin === 'https://tree-token.xyz' || /^https:\/\/[a-f0-9]{24}--tree-token\.netlify\.app$/.test(origin), 'Unexpected hosted target');
const label = origin === 'https://tree-token.xyz' ? 'canonical' : 'candidate';
const BROWSER = process.env.ARCADE_CHROMIUM_PATH || '/tmp/daily-growth-invitation-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const HOSTING_SNIPPET_SHA256 = 'bf05453dc91bcf9c53db98e08829c8321193495b0839021e68d458d56e5be98d';
const criticalFiles = ['scripts/arcade-daily-growth.js', 'styles/tree-arcade-suite.css', 'assets/arcade/arcade-growth-wallet.js'];
const sourceSha256 = Object.fromEntries(await Promise.all(['play/index.html', ...criticalFiles].map(async path => [path, hash(await readFile(resolve(ROOT, path)))])));
const pinnedSourceSha256 = {
  'play/index.html': '8a30d1fe1abf8e01c2a6f21b00bbfa2761378e6c114b6c778ef809c755927483',
  'scripts/arcade-daily-growth.js': '48f9881a7827742a1a88a46cb6ea05fc95e57379aaa7314a628243fdb6bb7b98',
  'styles/tree-arcade-suite.css': '4f790d4a3a059dbe37632e8ac751c04d71f233f98b1b4a7132609d264c09bc5c',
  'assets/arcade/arcade-growth-wallet.js': '1e26f995d31f0c0506e2180cc5940a6a4be561c11153e5a100cc0beb4b633421',
};
assert.deepEqual(sourceSha256, pinnedSourceSha256, 'Local files equal the fixed controller and unchanged reviewed companion files');
const expectedCabinetLinks = { 'force-title': '/play/treeforce89/', 'arboretum-title': 'https://treegrow.xyz/',
  'deadfall-title': 'https://tree-token.xyz/play/deadfall-run/', 'canopy-title': 'https://tree-token.xyz/play/canopy-defense/preview/',
  'garden-bot-title': 'https://nftree.net/battle/garden-bot', 'pvp-title': 'https://nftree.net/battle/pvp',
  'trials-title': 'https://nftree.net/battle/trials', 'clash-title': 'https://nftree.net/battle/canopy-clash' };
await mkdir(OUT, { recursive: true });
// Independently validate target TLS with the configured CA. The ephemeral
// browser pins only that CA's SPKI; it does not disable certificate validation.
const ca = new X509Certificate(await readFile('/usr/local/share/ca-certificates/nebula-dns.crt'));
const pin = createHash('sha256').update(ca.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
const tls = await new Promise((done, reject) => {
  const request = https.get(origin + '/play/', response => {
    const result = { authorized: response.socket.authorized, status: response.statusCode };
    response.resume(); response.on('end', () => done(result));
  });
  request.setTimeout(15000, () => request.destroy(new Error('TLS read timed out'))); request.on('error', reject);
});
assert(tls.authorized && tls.status === 200, 'Configured CA independently verifies the authorized target');
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors-spki-list=' + pin] });
const requests = [], responses = [], blockedRequests = [], pageErrors = [], consoleErrors = [], checks = [], dimensions = [], screenshots = [], fetchedFiles = [];
let configuration, cabinetLinks, monthKey, dateKey;
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  const item = { url: request.url(), method: request.method(), hasAuthorization: Boolean(request.headers().authorization) }; requests.push(item);
  const allowedApi = url.pathname === '/api/arcade-growth' && url.searchParams.get('action') === 'status';
  if (url.origin !== origin || !['GET', 'HEAD'].includes(item.method) || item.hasAuthorization
      || ((url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) && !allowedApi)) {
    blockedRequests.push(item); return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('response', response => responses.push({ url: response.url(), status: response.status() }));
async function layout() {
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scrollY, height: r.height, width: r.width }; };
    const overflow = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)
      && getComputedStyle(el).position !== 'fixed' && !el.classList.contains('growth-sr-only'); }).map(el => ({ id: el.id, class: el.className }));
    return { viewport: { width: innerWidth, height: innerHeight }, panel: rect('#arcade-daily-growth'), firstPoster: rect('.game-poster'),
      scrollWidth: document.documentElement.scrollWidth, detailsOpen: document.getElementById('growth-details').open, overflow };
  });
}
async function neutralRail() {
  const [year, month] = monthKey.split('-').map(Number), count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = await page.locator('#growth-days > *').evaluateAll(elements => elements.map(el => ({ date: el.dataset.date,
    unknown: el.classList.contains('is-unknown'), done: el.classList.contains('is-done'), missed: el.classList.contains('is-missed'),
    left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })));
  assert.deepEqual(cells.map(cell => cell.date), Array.from({ length: count }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, '0')}`));
  assert(cells.every(cell => cell.unknown && !cell.done && !cell.missed), 'A public visit never fabricates saved or missed days');
  assert.doesNotMatch(await page.locator('#growth-rail-count').textContent(), /^\s*0\b/);
  const width = page.viewportSize().width; assert(cells.every(cell => cell.left >= -1 && cell.right <= width + 1));
  return count;
}
try {
  const pendingFiles = criticalFiles.map(file => page.waitForResponse(response => new URL(response.url()).pathname === '/' + file));
  const pendingStatus = page.waitForResponse(response => { const url = new URL(response.url()); return url.pathname === '/api/arcade-growth' && url.searchParams.get('action') === 'status'; });
  const html = await page.goto(origin + '/play/', { waitUntil: 'domcontentloaded' }); assert.equal(html.status(), 200);
  const servedHtml = await html.body(); let reviewedHtml = servedHtml, hostingSnippet = null;
  if (hash(servedHtml) !== sourceSha256['play/index.html']) {
    const matches = [...servedHtml.toString().matchAll(/<script id="tree-arcade-arboretum-link">[\s\S]*?<\/script>/g)];
    assert.equal(matches.length, 1, 'Only the one known existing hosting snippet may differ');
    const snippet = Buffer.from(matches[0][0]);
    assert.equal(snippet.length, 572); assert.equal(hash(snippet), HOSTING_SNIPPET_SHA256, 'Hosting injection is byte-exact to the pinned existing snippet');
    const offset = servedHtml.indexOf(snippet);
    assert.equal(servedHtml.subarray(offset + snippet.length, offset + snippet.length + 7).toString(), '</body>', 'Known hosting snippet remains immediately before closing body');
    reviewedHtml = Buffer.concat([servedHtml.subarray(0, offset), servedHtml.subarray(offset + snippet.length)]);
    hostingSnippet = { id: 'tree-arcade-arboretum-link', bytes: snippet.length, sha256: HOSTING_SNIPPET_SHA256 };
  }
  assert.equal(hash(reviewedHtml), sourceSha256['play/index.html'], 'Served HTML matches reviewed source after only the exact known hosting injection');
  fetchedFiles.push({ file: 'play/index.html', status: 200, sha256: sourceSha256['play/index.html'], servedSha256: hash(servedHtml), hostingSnippet });
  const status = await pendingStatus; assert.equal(status.status(), 200);
  const payload = await status.json(); assert.equal(payload.status, 'ok'); assert.equal(payload.authenticated, false); assert.equal(Object.hasOwn(payload, 'progress'), false);
  configuration = payload.configuration; monthKey = payload.monthKey; dateKey = payload.dateKey;
  assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)); assert(dateKey.startsWith(monthKey + '-'));
  const ids = ['garden-bot', 'pvp', 'arborist-trials', 'treeforce89'].sort();
  assert.deepEqual(configuration.enabledGames.map(game => game.id).sort(), ids); assert.deepEqual(configuration.eligibleGames.map(game => game.id).sort(), ids);
  assert.equal(configuration.eligibleGames.find(game => game.id === 'treeforce89').creditRule, 'start-run');
  await page.waitForFunction(() => document.getElementById('arcade-daily-growth').dataset.growthState === 'signed-out' && !document.getElementById('growth-connect').disabled, null, { timeout: 20000 });
  const loadedFiles = await Promise.all(pendingFiles);
  for (let index = 0; index < loadedFiles.length; index += 1) {
    const response = loadedFiles[index], file = criticalFiles[index]; assert.equal(response.status(), 200);
    const sha256 = hash(await response.body()); assert.equal(sha256, sourceSha256[file], `${file} matches reviewed source`); fetchedFiles.push({ file, status: 200, sha256 });
  }
  assert.equal(await page.evaluate(() => typeof window.__questLayoutFixture), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.__fixtureOptions), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.__sessionFixture), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.__sessionController), 'undefined');
  checks.push({ name: 'Actual hosted HTML/controller/CSS/wallet bytes match review; real anonymous status has four required games and no private progress', passed: true });
  const identity = page.locator('#growth-wallet-identity'); assert.equal(await identity.isVisible(), false); assert.equal(await identity.textContent(), '');
  assert.equal(await identity.getAttribute('title'), null); assert.equal(await identity.getAttribute('aria-label'), null);
  cabinetLinks = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.getElementById(id).closest('a').getAttribute('href')])), Object.keys(expectedCabinetLinks));
  assert.deepEqual(cabinetLinks, expectedCabinetLinks);
  checks.push({ name: 'Disconnected identity contains no address; all eight cabinet destinations are preserved and unopened', passed: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport); await page.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur?.(); scrollTo(0, 0); });
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const loaded = image => image && image.complete && image.naturalWidth > 0;
      const required = ['#growth-badge-preview img', '.suite-hero-art', '.game-poster .poster-art'].map(selector => document.querySelector(selector));
      const visible = [...document.querySelectorAll('#arcade-daily-growth img,.suite-hero-art,.game-poster .poster-art')].filter(image => {
        const rect = image.getBoundingClientRect();
        return !image.closest('details:not([open])') && image.checkVisibility() && rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      });
      return required.every(loaded) && visible.every(loaded);
    }, null, { timeout: 15000 });
    const before = await layout(); assert.equal(before.detailsOpen, false); assert(before.scrollWidth <= viewport.width + 1); assert.deepEqual(before.overflow, []);
    assert(before.firstPoster.top < viewport.height, 'The first cabinet stays in the initial viewport'); const dateCount = await neutralRail();
    assert(await page.getByRole('button', { name: 'Connect to check in', exact: true }).isVisible());
    assert.equal(await page.locator('#growth-check-in').isVisible(), false); assert.equal(await page.locator('#growth-check-in-row').isVisible(), false);
    if (viewport.width !== 390) { const path = resolve(OUT, `hosted-${label}-signed-out-${viewport.width}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: 80, animations: 'disabled' }); screenshots.push(path); }
    dimensions.push({ viewport, collapsed: before, dateCount });
    checks.push({ name: `${viewport.width}px: collapsed signed-out panel, neutral monthly dates, loaded visible artwork, no overflow, first cabinet visible`, passed: true });
  }
  assert.deepEqual(blockedRequests, []); assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert(responses.every(response => response.status === 200));
  const report = { passed: true, synthetic: false, actualHostedCode: true, target: origin + '/play/', label, checkedAt: new Date().toISOString(),
    verificationScope: 'Anonymous served-source and collapsed-layout smoke; authenticated navigation and participation persistence are verified separately.',
    tls, configuration, dateKey, monthKey, sourceSha256, pinnedSourceSha256, fetchedFiles, cabinetLinks, checks, dimensions, screenshots, requests, responses,
    blockedRequests, pageErrors, consoleErrors, noWalletConnected: true, noSignatures: true, noRemoteWrites: true };
  await writeFile(resolve(OUT, `hosted-${label}-browser-report.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, label, checks: checks.length, screenshots: screenshots.length, requests: requests.length, dimensions, report: resolve(OUT, `hosted-${label}-browser-report.json`) }));
} catch (error) {
  await writeFile(resolve(OUT, `hosted-${label}-browser-report.json`), JSON.stringify({ passed: false, synthetic: false, target: origin + '/play/', error: String(error),
    sourceSha256, checks, dimensions, screenshots, requests, responses, blockedRequests, pageErrors, consoleErrors }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
