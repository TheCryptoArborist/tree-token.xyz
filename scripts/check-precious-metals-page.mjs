// CI-only interaction/layout verification in its own installed Chromium.
// External providers are mocked; this does not verify live TradingView data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const baseURL = new URL(process.env.PRECIOUS_METALS_TEST_BASE || 'http://127.0.0.1:8765').origin;
const targetURL = new URL('/market-insights/', baseURL).href;
const output = path.resolve('.netlify');
const widths = [320, 390, 768, 1363];
const keys = ['TOTAL', 'TOTAL2', 'TOTAL3', 'TOTAL3ES', 'BTCD', 'STABLED'];
const symbolMap = { TOTAL: 'TOTAL', TOTAL2: 'TOTAL2', TOTAL3: 'TOTAL3', TOTAL3ES: 'TOTAL3ES', BTCD: 'BTC.D', STABLED: 'STABLE.C.D' };
const fixtureTime = Math.floor(Date.now() / 1000);
const report = {
  baseURL, targetURL,
  candidateId: process.env.PRECIOUS_METALS_CANDIDATE_ID || null,
  sourceCommit: process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || null,
  source: 'scripts/check-precious-metals-page.mjs',
  startedAt: new Date().toISOString(), testOnly: true,
  networkPolicy: 'Only first-party GET/HEAD requests are sent; all provider content is a labeled test fixture.',
  limitations: ['External chart availability, provider data and the inside of the real TradingView widget are not tested.'],
  results: []
};
await fs.mkdir(output, { recursive: true });

const chartStub = `(() => {
  const script = document.currentScript;
  const config = JSON.parse(script.textContent);
  const host = script.closest('.tradingview-widget-container');
  const widget = host.querySelector('.tradingview-widget-container__widget');
  const label = document.createElement('p');
  label.textContent = 'CI TEST ONLY · TradingView placeholder · ' + config.symbol + ' · No provider data';
  label.style.cssText = 'margin:0;padding:20px;overflow-wrap:anywhere;color:#bcebd2;font:14px/1.5 system-ui';
  widget.style.background = '#081820';
  widget.replaceChildren(label);
})();`;

function sentimentFixture(coin) {
  return {
    coin, value: 50, label: 'Neutral', band: 'neutral', status: 'open',
    asOf: new Date(fixtureTime * 1000).toISOString(), testOnly: true,
    history: Array.from({ length: 31 }, (_, i) => ({
      date: new Date((fixtureTime - (30 - i) * 86400) * 1000).toISOString().slice(0, 10),
      value: 50, label: 'Neutral', band: 'neutral', status: i === 30 ? 'open' : 'closed'
    })),
    components: ['Price momentum', 'Volatility', 'Funding rates', 'Open interest', 'Taker flow', 'Long/short ratio']
      .map((name, i) => ({ name, score: 50, weight: [25, 15, 15, 10, 10, 5][i] }))
  };
}

async function configureNetwork(context, result) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) {
      result.networkViolations.push(request.method() + ' ' + url.origin + url.pathname);
      return route.abort('blockedbyclient');
    }
    if (url.origin === baseURL) return route.continue();
    result.interceptedRequests[url.origin + url.pathname] = (result.interceptedRequests[url.origin + url.pathname] || 0) + 1;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.origin === 'https://cryptokeyhole.com' && url.pathname === '/api/v1/fear-and-greed') return json(sentimentFixture(url.searchParams.get('coin')));
    if (url.href === 'https://mempool.space/api/v1/prices') return json({ USD: 100000, time: fixtureTime, testOnly: true });
    if (url.href === 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: chartStub });
    }
    if (request.resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width"><p>CI TEST ONLY · External chart placeholder · No provider data</p>' });
    if (request.resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* CI TEST ONLY: external script blocked. */' });
    return route.abort('blockedbyclient');
  });
}

async function assertSelection(page, key, result) {
  const selected = page.locator('[data-tv-symbol="' + key + '"]');
  await selected.click();
  await page.waitForFunction(() => document.querySelector('#mi-tv-stage .tradingview-widget-container__widget')?.textContent.includes('CI TEST ONLY'));
  assert.equal(await page.locator('[data-tv-symbol][aria-pressed="true"]').count(), 1);
  assert.equal(await selected.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-tv-symbol].selected').count(), 1);
  assert(await selected.evaluate(el => el.classList.contains('selected')));
  assert.equal(await page.locator('#mi-tv-stage .tradingview-widget-container').count(), 1);
  const scripts = page.locator('#mi-tv-stage script[src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"]');
  assert.equal(await scripts.count(), 1);
  const config = JSON.parse(await scripts.textContent());
  assert.equal(config.symbol, 'CRYPTOCAP:' + symbolMap[key]);
  assert.equal(config.autosize, true);
  assert.equal(config.theme, 'dark');
  assert.equal(config.allow_symbol_change, false);
  assert.equal(config.withdateranges, true);
  assert.equal(config.hide_top_toolbar, false);
  const source = page.locator('#mi-tv-stage .tradingview-widget-copyright a');
  const sourceURL = new URL(await source.getAttribute('href'));
  assert.equal(sourceURL.origin, 'https://www.tradingview.com');
  assert(['/symbols/' + symbolMap[key] + '/', '/symbols/CRYPTOCAP-' + symbolMap[key] + '/'].includes(sourceURL.pathname), key + ': source link must match the embedded symbol');
  assert.equal(await source.getAttribute('target'), '_blank');
  assert.match(await source.getAttribute('rel'), /(?:^|\s)noopener(?:\s|$)/);
  assert.match(await source.innerText(), /TradingView/);
  assert.equal(await page.locator('#mi-stablecoin-guide').isVisible(), key === 'STABLED');
  assert.equal(await page.locator('#mi-stablecoin-methodology').isVisible(), key === 'STABLED');
  assert.equal(await page.locator('#mi-tv-stage').getAttribute('aria-label'), 'TradingView chart: CRYPTOCAP:' + symbolMap[key]);
  result.chartSelections.push({ key, symbol: config.symbol, source: sourceURL.href, guideVisible: key === 'STABLED' });
}

async function checkLayout(page, result, view) {
  const measured = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth, failures = [];
    for (const el of document.querySelectorAll('.site-header, .site-header *, main, main *, .site-footer, .site-footer *')) {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (!rect.width || !rect.height || !el.getClientRects().length || style.visibility === 'hidden') continue;
      if (el.matches('.skip') && el !== document.activeElement) continue;
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
      const strip = el.closest('.mi-tabbar');
      if (strip && strip !== el && ['auto', 'scroll'].includes(getComputedStyle(strip).overflowX)) continue;
      const name = el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + Array.from(el.classList).join('.');
      if (rect.left < -1 || rect.right > viewportWidth + 1) failures.push({ element: name, left: rect.left, right: rect.right, reason: 'outside viewport' });
      const scrollingTabs = el.matches('.mi-tabbar') && ['auto', 'scroll'].includes(style.overflowX);
      if (el instanceof HTMLElement && el.clientWidth && !el.matches('input,textarea') && !scrollingTabs && el.scrollWidth > el.clientWidth + 1) {
        failures.push({ element: name, width: el.clientWidth, scrollWidth: el.scrollWidth, reason: 'component overflow' });
      }
    }
    return { viewportWidth, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, failures };
  });
  result.layouts.push({ view, ...measured });
  assert(measured.documentWidth <= measured.viewportWidth + 1, view + ': horizontal document overflow');
  assert.deepEqual(measured.failures, [], view + ': horizontal component overflow');
  result.cases.push(view + ': no horizontal document or component overflow');
}

async function capture(page, result, view) {
  await page.evaluate(width => {
    const banner = document.createElement('div'); banner.id = 'ci-test-watermark';
    banner.textContent = 'CI TEST ONLY · Mocked external providers · ' + width + ' CSS px · No live chart data';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;box-sizing:border-box;padding:6px 10px;background:#ffda70;color:#121212;font:700 11px/1.35 system-ui;overflow-wrap:anywhere;pointer-events:none';
    document.body.appendChild(banner);
  }, result.width);
  const file = 'precious-metals-' + result.width + '-' + view + '.png';
  try {
    const bytes = await page.screenshot({ path: path.join(output, file), type: 'png', fullPage: true, animations: 'disabled' });
    result.screenshots.push({ file: '.netlify/' + file, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), testOnly: true });
  } finally {
    await page.locator('#ci-test-watermark').evaluate(el => el.remove()).catch(() => {});
  }
}

let browser;
try {
  const modulePath = process.env.PRECIOUS_METALS_BROWSER_MODULE;
  assert(modulePath, 'Set PRECIOUS_METALS_BROWSER_MODULE to the isolated Playwright index module path');
  const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(path.resolve(modulePath)).href);
  browser = await chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  for (const width of widths) {
    const result = { width, height: 900, passed: false, cases: [], chartSelections: [], layouts: [], screenshots: [], consoleErrors: [], networkViolations: [], interceptedRequests: {} };
    report.results.push(result);
    const context = await browser.newContext({ viewport: { width, height: result.height }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await configureNetwork(context, result);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => result.consoleErrors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => {
      const url = message.location().url;
      if (message.type() === 'error' && (!url || url.startsWith(baseURL + '/market-insights/'))) result.consoleErrors.push({ type: 'console', message: message.text(), url });
    });
    try {
      const response = await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert(response?.ok(), 'Market Insights page request failed');
      assert.equal(await page.title(), 'Crypto Market Insights | TREE');
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://tree-token.xyz/market-insights/');
      await page.locator('#mi-tab-market').click();
      assert.equal(await page.locator('#mi-tab-market').getAttribute('aria-selected'), 'true');
      assert(await page.locator('#mi-pane-market').isVisible());
      assert.equal(await page.locator('.mi-pane:visible').count(), 1);
      assert.deepEqual(await page.locator('[data-tv-symbol]').evaluateAll(els => els.map(el => el.dataset.tvSymbol)), keys);
      assert.deepEqual((await page.locator('[data-tv-symbol]').allTextContents()).map(x => x.trim()), ['TOTAL', 'TOTAL2', 'TOTAL3', 'TOTAL3ES', 'BTC.D', 'Precious Metals']);
      result.cases.push('Six market choices; Precious Metals immediately follows BTC.D');

      for (const key of ['TOTAL3', 'BTCD']) await assertSelection(page, key, result);
      result.cases.push('Existing TOTAL3 and Bitcoin dominance retain their symbols and source links');
      await page.locator('[data-tv-symbol="BTCD"]').focus();
      await page.keyboard.press('Tab');
      assert(await page.locator('[data-tv-symbol="STABLED"]').evaluate(el => el === document.activeElement));
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-tv-symbol="STABLED"]').getAttribute('aria-pressed'), 'true');
      result.cases.push('Keyboard moves from BTC.D directly to Precious Metals and activates it');

      await assertSelection(page, 'STABLED', result);
      const caption = await page.locator('#mi-market-description').innerText();
      assert.match(caption, /stablecoin/i);
      assert.match(caption, /percent|%/i);
      const guide = await page.locator('#mi-stablecoin-guide').innerText();
      assert.match(guide, /stablecoin/i);
      assert.match(guide, /ris(?:e|ing)|higher|increase/i);
      assert.match(guide, /fall|lower|decrease/i);
      const methodology = page.locator('#mi-stablecoin-methodology');
      assert.match(await methodology.innerText(), /100/);
      assert.match(await methodology.innerText(), /TOTAL/);
      assert.equal(await methodology.locator('a').getAttribute('href'), 'https://www.tradingview.com/support/solutions/43000550480-where-do-i-find-crypto-market-capitalization-and-dominance/');
      const stableBounds = await page.locator('[data-tv-symbol="STABLED"]').boundingBox();
      const bitcoinBounds = await page.locator('[data-tv-symbol="BTCD"]').boundingBox();
      assert(stableBounds && bitcoinBounds);
      assert(stableBounds.width >= 44 && stableBounds.height >= 43, 'Stablecoin choice remains a usable touch target');
      if (width === 1363) {
        assert(Math.abs(stableBounds.y - bitcoinBounds.y) <= 1, 'Desktop dominance choices must share a row');
        assert(stableBounds.x >= bitcoinBounds.x + bitcoinBounds.width, 'Precious Metals must sit right of BTC.D');
      }
      result.cases.push('Stablecoin widget uses CRYPTOCAP:STABLE.C.D, percentage caption, explanation and matching provider link');
      await checkLayout(page, result, 'precious-metals');

      await assertSelection(page, 'TOTAL3', result);
      await checkLayout(page, result, 'return-to-total3');
      result.cases.push('Switching back to TOTAL3 hides the stablecoin explanation and replaces the chart');
      await assertSelection(page, 'STABLED', result);
      await capture(page, result, 'market-test');
      assert.deepEqual(result.consoleErrors, [], 'Owned JavaScript emitted errors');
      assert.deepEqual(result.networkViolations, [], 'Unexpected non-read-only network request');
      result.cases.push('No owned JavaScript errors or non-read-only requests');
      result.passed = true;
    } catch (error) {
      result.error = error.stack || String(error);
      await capture(page, result, 'failure-test').catch(captureError => { result.screenshotError = captureError.message; });
    } finally {
      await context.close();
    }
  }
} catch (error) {
  report.error = error.stack || String(error);
} finally {
  await browser?.close();
  report.completedAt = new Date().toISOString();
  report.passed = !report.error && report.results.length === widths.length && report.results.every(result => result.passed);
  await fs.writeFile(path.join(output, 'precious-metals-browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ baseURL, candidateId: report.candidateId, sourceCommit: report.sourceCommit, passed: report.passed, results: report.results.map(({ width, passed, cases, error }) => ({ width, passed, cases: cases.length, error })), report: '.netlify/precious-metals-browser-checks.json' }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
