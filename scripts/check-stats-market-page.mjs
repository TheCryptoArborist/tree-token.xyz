// CI-only browser checks. This launches isolated Chromium and never connects to
// the managed browser. Fixtures are test data and are never published.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const overlays = { 'dapp/index.html': 'index.html', 'dapp/app.js': 'app.js', 'dapp/stats-market.css': 'stats-market.css' };
if (process.argv[2] === '--prepare-static') {
  const destination = path.resolve(process.argv[3] || '');
  assert(process.argv[3] && destination !== root && !destination.startsWith(root + path.sep), 'Use a separate temporary directory.');
  await fs.mkdir(destination, { recursive: true });
  assert.equal((await fs.readdir(destination)).length, 0, 'Temporary directory must be empty.');
  for (const directory of ['dapp', 'scripts', 'styles', 'assets', 'data']) {
    await fs.cp(path.join(root, directory), path.join(destination, directory), { recursive: true });
  }
  for (const filename of ['thick.png', 'package.json']) {
    await fs.copyFile(path.join(root, filename), path.join(destination, filename));
  }
  // The Profile Studio navigation stylesheet is a current production overlay.
  const profileStyle = 'styles/profile-site-navigation.css';
  try { await fs.access(path.join(destination, profileStyle)); }
  catch {
    const source = path.join(root, 'production/profile-studio-static', profileStyle);
    await fs.copyFile(source, path.join(destination, profileStyle));
  }
  for (const [publicPath, source] of Object.entries(overlays)) {
    await fs.copyFile(path.join(root, 'production/stats-market-static', source), path.join(destination, publicPath));
  }
  console.log('Prepared Stats test site with the three approved frontend overlays.');
  process.exit(0);
}

const baseURL = new URL(process.env.STATS_MARKET_TEST_BASE || 'http://127.0.0.1:8765').origin;
const targetURL = new URL('/dapp/#stats', baseURL).href;
const output = path.join(root, '.netlify');
const widths = [320, 390, 768, 1363];
const coin = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const frameURL = 'https://noodles.fi/tv-widget?coin=' + encodeURIComponent(coin) + '&theme=dark';
const sourceURL = 'https://app.noodles.fi/coins/' + coin;
const badge = JSON.parse(await fs.readFile(path.join(root, 'tests/fixtures/sti-badge.json'), 'utf8'));
const pool = JSON.parse(await fs.readFile(path.join(root, 'tests/fixtures/sti-price.json'), 'utf8'));
const report = {
  baseURL, targetURL,
  sourceCommit: process.env.STATS_MARKET_SOURCE_COMMIT || process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || null,
  candidateId: process.env.STATS_MARKET_CANDIDATE_ID || null,
  source: 'scripts/check-stats-market-page.mjs', startedAt: new Date().toISOString(), testOnly: true,
  networkPolicy: 'Only first-party static GET/HEAD requests are sent. All API data and external chart contents are mocked. No wallet, signing, or transaction actions are performed.',
  limitations: ['External chart interiors and real provider availability require a separate live visual check.'],
  fixtures: { marketHolders: 606, coinObjectOwners: 2198 }, results: [],
};
await fs.mkdir(output, { recursive: true });

function dashboardFixture() {
  const checkedAt = new Date().toISOString();
  return { testOnly: true, generatedAt: checkedAt, warnings: [],
    live: { status: 'ok', source: 'Noodles.fi', verifiedAt: checkedAt,
      data: { price: 0.00002, priceChange24h: 1.5, holderCount: 606, marketCap: 20000, sourceUpdatedAt: null } },
    snapshot: { tree: { totalSupply: 1000000000, zeroAddressBalance: 60000000, effectiveSupply: 940000000,
      moonbagsLocked: 54000000, nextUnlock2027: 34000000, nextUnlock2028: 20000000 } } };
}
function exposureFixture() {
  return { testOnly: true, status: 'ok', provider: 'tree-exposure-snapshot', methodologyVersion: 'verified-tree-exposure-v1',
    snapshotGeneratedAt: new Date().toISOString(), snapshotAgeMs: 0, refreshState: 'complete', entries: [], displayedCount: 0,
    eligibleOwnerCount: 2197, source: { direct: { verifiedAddressOwners: 2198, pagesScanned: 409, objectsScanned: 20424 } },
    summary: {}, coverage: { totalExposureComplete: true }, warnings: [] };
}
async function configureNetwork(context, result) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.origin === baseURL && url.pathname.startsWith('/api/')) {
      result.apiRequests.push({ method: request.method(), path: url.pathname });
      if (!['GET', 'HEAD'].includes(request.method())) {
        result.unexpectedMutations.push(request.method() + ' ' + url.pathname);
        return json({ status: 'error', testOnly: true });
      }
      if (url.pathname === '/api/tree-dashboard') return json(dashboardFixture());
      if (/^\/api\/tree-exposure(?:-preview)?$/.test(url.pathname)) return json(exposureFixture());
      if (/^\/api\/tree-badges(?:-preview)?$/.test(url.pathname)) return json({ status: 'not-ready', entries: [] });
      if (url.pathname === '/api/tree-v3-overview') return json({ status: 'ok', market: { suiUsd: 1.5 }, venues: [] });
      if (url.pathname === '/api/tree-liquidity') return json({ status: 'ok', source: 'CI test fixture', generatedAt: new Date().toISOString(), liquidity: { recognizedLiquidityUsd: 15000 } });
      if (url.pathname === '/api/tree-volume') return json({ status: 'ok', generatedAt: new Date().toISOString(), volume24hUsd: 25, venues: { suiDexV2: 10, suiDexV3: 5, turbos: 5, cetus: 5 } });
      return json({ status: 'not-ready', testOnly: true, entries: [], warnings: [] });
    }
    if (url.href === 'https://sti-keeper-production.up.railway.app/badge') return json({ ...badge, at: Date.now() });
    if (url.href === 'https://graphql.mainnet.sui.io/graphql') {
      if ((request.postData() || '').includes('StiPrice')) {
        const value = structuredClone(pool); value.data.checkpoint.timestamp = new Date().toISOString(); return json(value);
      }
      return json({ errors: [{ message: 'CI test: unrelated network operation is mocked.' }] });
    }
    if (url.origin === baseURL && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    result.mockedExternalRequests.push(url.origin + url.pathname);
    if (request.resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#081820;color:#a0b9bf;font:14px system-ui;padding:20px;overflow-wrap:anywhere}</style><p>CI TEST ONLY · Noodles chart placeholder</p>' });
    if (request.resourceType() === 'script') {
      // Preserve the exact pinned modules' named exports so the real application
      // modules can initialize. No external SDK runs and no wallet is registered.
      const forbidden = `const forbidden = operation => {
        throw new Error('CI test: SDK ' + operation + ' is disabled.');
      };`;
      const sdkFixtures = new Map([
        ['https://esm.run/@mysten/wallet-standard@0.21.14', `${forbidden}
          const registry = Object.freeze({ get: () => [], on: () => () => {} });
          export const getWallets = () => registry;
          export const signAndExecuteTransaction = () => forbidden('signing');
        `],
        ['https://esm.run/@mysten/slush-wallet@1.1.14', `
          export const registerSlushWallet = () => {};
        `],
        ['https://esm.run/@mysten/sui@2.23.1/grpc', `${forbidden}
          export class SuiGrpcClient {
            constructor() {
              this.core = Object.freeze({
                getChainIdentifier: async () => ({ chainIdentifier: '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S' }),
                getBalance: async () => ({ balance: { balance: '0' } }),
                listCoins: async () => ({ objects: [], hasNextPage: false, nextCursor: null }),
                getObject: async () => forbidden('object lookup'),
                simulateTransaction: async () => forbidden('transaction simulation'),
                executeTransaction: async () => forbidden('transaction execution'),
                waitForTransaction: async () => forbidden('transaction confirmation'),
              });
            }
          }
        `],
        ['https://esm.run/@mysten/sui@2.23.1/utils', `
          export const fromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
          export const toBase64 = value => btoa(Array.from(value, byte => String.fromCharCode(byte)).join(''));
        `],
        ['https://esm.run/@mysten/sui@2.23.1/transactions', `${forbidden}
          export class Transaction {
            constructor() { forbidden('transaction construction'); }
            static from() { return forbidden('transaction construction'); }
          }
        `],
        ['https://esm.run/@mysten/sui@2.23.1/bcs', `${forbidden}
          export const bcs = Object.freeze({ u64: () => ({ parse: () => forbidden('BCS parsing') }) });
        `],
        ['https://esm.run/@cetusprotocol/sui-clmm-sdk@1.4.7', `${forbidden}
          export const CetusClmmSDK = Object.freeze({ createSDK: () => forbidden('Cetus SDK construction') });
        `],
      ]);
      const fixture = sdkFixtures.get(url.href);
      if (fixture !== undefined) return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fixture });
      return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' },
        body: 'throw new Error(' + JSON.stringify('CI test: unexpected external module ' + url.href) + ');' });
    }
    return json({ testOnly: true, status: 'not-ready' });
  });
}

async function checkLayout(page, result, view) {
  const measured = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth, failures = [];
    for (const el of document.querySelectorAll('#stats, #stats *, .app-shell, .app-shell *')) {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (!rect.width || !rect.height || !el.getClientRects().length || style.visibility === 'hidden') continue;
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
      const nav = el.closest('.app-nav');
      if (nav && nav !== el && ['auto', 'scroll'].includes(getComputedStyle(nav).overflowX)) continue;
      const name = el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.');
      if (rect.left < -1 || rect.right > viewport + 1) failures.push({ element: name, left: rect.left, right: rect.right });
      const intentionalScroll = el === nav && ['auto', 'scroll'].includes(style.overflowX);
      if (el instanceof HTMLElement && el.clientWidth && !el.matches('input,textarea') && !intentionalScroll && el.scrollWidth > el.clientWidth + 1) {
        failures.push({ element: name, width: el.clientWidth, scrollWidth: el.scrollWidth });
      }
    }
    return { viewport, documentWidth: document.documentElement.scrollWidth, failures };
  });
  result.layouts.push({ view, ...measured });
  assert(measured.documentWidth <= measured.viewport + 1, view + ': document overflow');
  assert.deepEqual(measured.failures, [], view + ': component overflow');
  result.cases.push(view + ': no horizontal document or component overflow');
}
async function capture(page, result, view) {
  await page.evaluate(width => {
    const banner = document.createElement('div'); banner.id = 'ci-test-watermark';
    banner.textContent = 'CI TEST ONLY · Synthetic values · External chart placeholder · ' + width + ' CSS px';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:5px 8px;background:#ffda70;color:#111;font:700 11px/1.35 system-ui;overflow-wrap:anywhere;pointer-events:none';
    document.body.appendChild(banner);
  }, result.width);
  try {
    const filename = 'stats-market-' + result.width + '-' + view + '.png';
    await page.screenshot({ path: path.join(output, filename), type: 'png', fullPage: true, animations: 'disabled' });
    result.screenshots.push('.netlify/' + filename);
  } finally { await page.locator('#ci-test-watermark').evaluate(el => el.remove()).catch(() => {}); }
}

let browser;
try {
  const modulePath = process.env.STATS_MARKET_BROWSER_MODULE;
  assert(modulePath, 'Set STATS_MARKET_BROWSER_MODULE to the isolated Playwright module.');
  const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(path.resolve(modulePath)).href);
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  for (const width of widths) {
    const result = { width, passed: false, cases: [], layouts: [], screenshots: [], pageErrors: [], apiRequests: [], unexpectedMutations: [], mockedExternalRequests: [] };
    report.results.push(result);
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await configureNetwork(context, result);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => result.pageErrors.push(error.message));
    try {
      await page.clock.install();
      const response = await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert(response?.ok(), 'Stats page request failed');
      await page.waitForFunction(() => document.querySelector('[data-market="holderCount"]')?.textContent === '606' && document.querySelector('#verifiedAddressOwnerCount')?.textContent === '2,198');
      assert.equal(await page.title(), 'TREE Command Center | Stats');
      assert(await page.locator('#stats').isVisible());
      assert.equal(await page.locator('#marketChart').count(), 0);
      const frame = page.locator('#treeLiveChart iframe');
      assert.equal(await frame.count(), 1); assert.equal(await frame.getAttribute('src'), frameURL);
      assert.equal(await frame.getAttribute('title'), 'TREE / USD price chart — Noodles');
      assert.equal(await page.locator('#treeLiveChart a').getAttribute('href'), sourceURL);
      assert.match(await page.locator('#holderCountMeta').innerText(), /Noodles/i);
      assert.match(await page.locator('#holderCountMeta').innerText(), /checked/i);
      assert(await page.locator('#holderCountMeta').isVisible());
      result.cases.push('Stats shows market holders606 independently of coin-object owners2198; exact Noodles embed and visible source');
      await checkLayout(page, result, 'stats');
      const chart = await frame.boundingBox();
      assert(chart && chart.width > 200 && chart.height >= 440, 'Embedded chart dimensions are too small');
      if (width === 1363) assert(chart.width > 850, 'Stats chart should use the wider desktop layout');
      await capture(page, result, 'test');

      const priorRequests = result.apiRequests.filter(r => r.path === '/api/tree-dashboard').length;
      await page.locator('#refreshStats').click();
      await page.waitForFunction(() => document.querySelector('[data-stats-group="market"] [data-group-state]')?.textContent === 'Live');
      assert(result.apiRequests.filter(r => r.path === '/api/tree-dashboard').length > priorRequests);
      assert.equal(await page.locator('[data-market="holderCount"]').textContent(), '606');
      await page.clock.fastForward(61000);
      assert(!result.apiRequests.some(r => r.path === '/api/tree-chart'), 'Removed native chart still requested data');
      result.cases.push('Refresh and60-second timer preserve holders and never fetch removed native chart');

      assert.equal(await page.locator('.stats-sti').count(), 1);
      await page.waitForFunction(() => document.querySelector('#stiPrice')?.textContent === '0.000016582');
      assert.equal(await page.locator('#stiPurchase').isVisible(), false);
      await page.locator('#stiOpenBuy').click(); assert(await page.locator('#stiPurchase').isVisible());
      assert.equal(await page.locator('#stiBuyButton').count(), 1);
      await checkLayout(page, result, 'sti-purchase');
      await page.locator('#stiCloseBuy').click();
      assert.equal(await page.locator('#stiPurchase').isVisible(), false);
      result.cases.push('Existing STI data and closed/open/close panel remain intact without connecting or transacting');

      await page.locator('.app-nav a[href="#swap"]').click();
      assert(await page.locator('#swap').isVisible());
      const swapWidth = await page.locator('main').evaluate(el => el.getBoundingClientRect().width);
      assert(swapWidth <= 472.5, 'Stats width leaked into Swap');
      await page.locator('.app-nav a[href="#stats"]').click();
      assert(await page.locator('#stats').isVisible());
      assert.equal(await page.locator('[data-market="holderCount"]').textContent(), '606');
      assert.equal(await page.locator('.studio-command-link').getAttribute('href'), '/play/profile-studio/');
      result.cases.push('Stats/Swap navigation, narrow trading panel and Profile Studio link are preserved');
      assert.deepEqual(result.pageErrors, [], 'Unexpected page JavaScript error');
      assert.deepEqual(result.unexpectedMutations, [], 'Unexpected first-party mutation attempted');
      result.passed = true;
    } catch (error) {
      result.error = error.stack || String(error);
      await capture(page, result, 'failure').catch(e => { result.screenshotError = e.message; });
    } finally { await context.close(); }
  }
} catch (error) { report.error = error.stack || String(error); }
finally {
  await browser?.close(); report.completedAt = new Date().toISOString();
  report.passed = !report.error && report.results.length === widths.length && report.results.every(r => r.passed);
  await fs.writeFile(path.join(output, 'stats-market-browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ baseURL, passed: report.passed, error: report.error,
    results: report.results.map(({ width, passed, cases, error }) => ({ width, passed, cases: cases.length, error })) }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
