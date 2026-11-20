// CI-only checks in an isolated Chromium. Provider responses below are labeled
// fixtures; the separate live check verifies actual TradingView availability.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const baseURL = new URL(process.env.MARKET_OVERVIEW_TEST_BASE || 'http://127.0.0.1:8765').origin;
const targetURL = new URL('/market-insights/', baseURL).href;
const output = path.resolve('.netlify');
const widths = [320, 390, 768, 1363];
const storageKey = 'tree-market-insights-view-v1';
const groups = {
  size: ['TOTAL', 'TOTAL2', 'TOTAL3', 'TOTAL3ES', 'OTHERS', 'STABLECAP'],
  dominance: ['BTCD', 'STABLED', 'ETHD'],
  sectors: ['DEFI'],
  ratios: ['GOLD', 'SILVER', 'GOLDSILVER', 'ALTSBTC']
};
const groupLabels = ['Market Size', 'Dominance', 'Sectors & Ecosystems', 'Metals & Ratios'];
const symbolMap = {
  TOTAL: 'CRYPTOCAP:TOTAL', TOTAL2: 'CRYPTOCAP:TOTAL2', TOTAL3: 'CRYPTOCAP:TOTAL3', TOTAL3ES: 'CRYPTOCAP:TOTAL3ES',
  OTHERS: 'CRYPTOCAP:OTHERS', STABLECAP: 'CRYPTOCAP:STABLE.C', BTCD: 'CRYPTOCAP:BTC.D', STABLED: 'CRYPTOCAP:STABLE.C.D',
  ETHD: 'CRYPTOCAP:ETH.D', DEFI: 'CRYPTOCAP:TOTALDEFI', GOLD: 'TVC:GOLD', SILVER: 'TVC:SILVER',
  GOLDSILVER: 'TVC:GOLDSILVER', ALTSBTC: 'CRYPTOCAP:TOTAL3ESBTC'
};
const keys = Object.values(groups).flat();
const sourcePath = Object.fromEntries(Object.entries(symbolMap).map(([key, symbol]) => [key,
  key === 'GOLD' ? '/symbols/GOLD/' : key === 'SILVER' ? '/symbols/SILVER/' : key === 'GOLDSILVER' ? '/symbols/TVC-GOLDSILVER/' : '/symbols/CRYPTOCAP-' + symbol.split(':')[1] + '/'
]));
const fixtureTime = Math.floor(Date.now() / 1000);
const report = {
  schemaVersion: 1, baseURL, targetURL,
  candidateId: process.env.MARKET_OVERVIEW_CANDIDATE_ID || null,
  sourceCommit: process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || null,
  source: 'scripts/check-market-overview-page.mjs', startedAt: new Date().toISOString(), testOnly: true,
  networkPolicy: 'Only first-party GET/HEAD requests are sent; all provider content is a labeled test fixture.',
  limitations: ['Real TradingView availability and provider chart controls are tested separately; fixture values are not market observations.'],
  results: []
};
await fs.mkdir(output, { recursive: true });

const chartStub = `(() => {
  const script = document.currentScript, config = JSON.parse(script.textContent);
  const widget = script.closest('.tradingview-widget-container').querySelector('.tradingview-widget-container__widget');
  const label = document.createElement('p');
  label.textContent = 'CI TEST ONLY · TradingView placeholder · ' + config.symbol + ' · No provider data';
  label.style.cssText = 'margin:0;padding:20px;overflow-wrap:anywhere;color:#bcebd2;font:14px/1.5 system-ui';
  widget.style.background = '#081820'; widget.replaceChildren(label);
})();`;

function sentimentFixture(coin) {
  return {
    coin, value: 50, label: 'Neutral', band: 'neutral', status: 'open', testOnly: true,
    asOf: new Date(fixtureTime * 1000).toISOString(),
    history: Array.from({ length: 31 }, (_, i) => ({ date: new Date((fixtureTime - (30 - i) * 86400) * 1000).toISOString().slice(0, 10), value: 50, label: 'Neutral', band: 'neutral', status: i === 30 ? 'open' : 'closed' })),
    components: ['Price momentum', 'Volatility', 'Funding rates', 'Open interest', 'Taker flow', 'Long/short ratio'].map((name, i) => ({ name, score: 50, weight: [25, 15, 15, 10, 10, 5][i] }))
  };
}

async function configureContext(browser, result, storage = null) {
  const context = await browser.newContext({ viewport: { width: result.width, height: result.height }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(({ storageKey, storage }) => {
    window.__miClipboardWrites = [];
    window.__miClipboardDenied = false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => {
        if (window.__miClipboardDenied) throw new DOMException('CI clipboard denied', 'NotAllowedError');
        window.__miClipboardWrites.push(value);
      }
    } });
    if (storage === 'blocked') {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('CI storage blocked', 'SecurityError'); } });
    } else if (storage !== null) {
      // Seed once per context, then allow a reload to test the real persisted value.
      if (!sessionStorage.getItem('ci-market-storage-seeded')) {
        localStorage.setItem(storageKey, typeof storage === 'string' ? storage : JSON.stringify(storage));
        sessionStorage.setItem('ci-market-storage-seeded', 'yes');
      }
    }
  }, { storageKey, storage });
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
    if (url.href === 'https://colintalkscrypto.com/cbbi/data/latest.json') return json(Object.fromEntries(['Confidence', 'PiCycle', 'RUPL', 'RHODL', 'Puell', '2YMA', 'Trolololo', 'MVRV', 'ReserveRisk', 'Woobull', 'Price'].map(key => [key, { [fixtureTime]: key === 'Price' ? 100000 : 0.5 }])));
    if (url.href === 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: chartStub });
    if (request.resourceType() === 'document') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width"><p>CI TEST ONLY · External chart placeholder · No provider data</p>' });
    if (request.resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* CI TEST ONLY: external script blocked. */' });
    return route.abort('blockedbyclient');
  });
  return context;
}

async function createPage(context, result) {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => result.consoleErrors.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const url = message.location().url;
    if (message.type() === 'error' && (!url || url.startsWith(baseURL + '/market-insights/'))) result.consoleErrors.push({ type: 'console', message: message.text(), url });
  });
  return page;
}

async function goto(page, suffix = '') {
  const response = await page.goto(targetURL + suffix, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert(response?.ok(), 'Market Insights page request failed');
  await page.waitForFunction(() => !!document.querySelector('[data-mi-tab][aria-selected="true"]'));
}

async function assertView(page, view) {
  assert.equal(await page.locator('[data-mi-tab][aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('#mi-tab-' + view).getAttribute('aria-selected'), 'true');
  assert(await page.locator('#mi-pane-' + view).isVisible());
  assert.equal(await page.locator('.mi-pane:visible').count(), 1);
}

async function assertMarket(page, key) {
  await assertView(page, 'market');
  await page.waitForFunction(symbol => document.querySelector('#mi-tv-stage .tradingview-widget-container__widget')?.textContent.includes('CI TEST ONLY · TradingView placeholder · ' + symbol), symbolMap[key]);
  assert.equal(await page.locator('[data-tv-symbol][aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('[data-tv-symbol="' + key + '"]').getAttribute('aria-pressed'), 'true');
  const group = Object.keys(groups).find(name => groups[name].includes(key));
  assert.equal(await page.locator('[data-market-group][aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('[data-market-group="' + group + '"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-market-group-panel]:visible').count(), 1);
  assert(await page.locator('[data-market-group-panel="' + group + '"]').isVisible());
  assert.equal(await page.locator('#mi-tv-stage .tradingview-widget-container').count(), 1);
  const scripts = page.locator('#mi-tv-stage script[src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"]');
  assert.equal(await scripts.count(), 1);
  const config = JSON.parse(await scripts.textContent());
  assert.equal(config.symbol, symbolMap[key]);
  assert.equal(config.autosize, true); assert.equal(config.theme, 'dark');
  assert.equal(config.allow_symbol_change, false); assert.equal(config.withdateranges, true); assert.equal(config.hide_top_toolbar, false);
  for (const selector of ['#mi-market-source', '#mi-tv-stage .tradingview-widget-copyright a']) {
    const link = page.locator(selector), url = new URL(await link.getAttribute('href'));
    assert.equal(url.origin, 'https://www.tradingview.com');
    assert.equal(url.pathname, sourcePath[key], key + ': source must match the selected chart');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match(await link.getAttribute('rel'), /(?:^|\s)noopener(?:\s|$)/);
  }
  assert(await page.locator('#mi-market-guide').isVisible());
  for (const name of ['shows', 'rises', 'falls', 'compare']) {
    const field = page.locator('#mi-market-guide-' + name);
    assert(await field.isVisible(), key + ': ' + name + ' visible');
    assert((await field.innerText()).trim().length > 25, key + ': substantive ' + name + ' explanation');
  }
  assert.equal(await page.locator('#mi-stablecoin-guide').isVisible(), key === 'STABLED');
  assert.equal(await page.locator('#mi-stablecoin-methodology').isVisible(), key === 'STABLED');
  for (const [name, selected] of [['gold', 'GOLD'], ['silver', 'SILVER'], ['goldsilver', 'GOLDSILVER']]) assert.equal(await page.locator('#mi-' + name + '-guide').isVisible(), key === selected);
  return config;
}

async function chooseChart(page, key, result) {
  const group = Object.keys(groups).find(name => groups[name].includes(key));
  if (!await page.locator('[data-tv-symbol="' + key + '"]').isVisible()) await page.locator('[data-market-group="' + group + '"]').click();
  await page.locator('[data-tv-symbol="' + key + '"]').click();
  const config = await assertMarket(page, key);
  result.chartSelections.push({ key, symbol: config.symbol, group, source: sourcePath[key] });
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
      if (el instanceof HTMLElement && el.clientWidth && !el.matches('input,textarea') && !scrollingTabs && el.scrollWidth > el.clientWidth + 1) failures.push({ element: name, width: el.clientWidth, scrollWidth: el.scrollWidth, reason: 'component overflow' });
    }
    return { viewportWidth, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, failures };
  });
  result.layouts.push({ view, ...measured });
  assert(measured.documentWidth <= measured.viewportWidth + 1, view + ': horizontal document overflow');
  assert.deepEqual(measured.failures, [], view + ': horizontal component overflow');
}

async function capture(page, result, view) {
  await page.evaluate(width => {
    const banner = document.createElement('div'); banner.id = 'ci-test-watermark';
    banner.textContent = 'CI TEST ONLY · Mocked external providers · ' + width + ' CSS px · No live chart data';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;box-sizing:border-box;padding:6px 10px;background:#ffda70;color:#121212;font:700 11px/1.35 system-ui;overflow-wrap:anywhere;pointer-events:none';
    document.body.appendChild(banner);
  }, result.width);
  const file = 'market-overview-' + result.width + '-' + view + '.png';
  try {
    const bytes = await page.screenshot({ path: path.join(output, file), type: 'png', fullPage: true, animations: 'disabled' });
    result.screenshots.push({ file: '.netlify/' + file, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), testOnly: true });
  } finally { await page.locator('#ci-test-watermark').evaluate(el => el.remove()).catch(() => {}); }
}

async function stateChecks(browser, page, result) {
  await page.locator('#mi-tab-prices').click();
  await page.locator('[data-price-asset="ETH"]').click();
  await page.locator('#mi-tab-onchain').click();
  await page.locator('[data-onchain="mvrv"]').click();
  await page.locator('#mi-tab-market').click();
  await chooseChart(page, 'OTHERS', result);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.deepEqual(stored, { version: 1, view: 'market', chart: 'OTHERS', asset: 'ETH', onchain: 'mvrv' });
  await goto(page); await assertMarket(page, 'OTHERS');
  await page.reload({ waitUntil: 'domcontentloaded' }); await assertMarket(page, 'OTHERS');
  await page.locator('#mi-tab-prices').click();
  assert.equal(await page.locator('[data-price-asset="ETH"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#mi-tab-onchain').click();
  assert.equal(await page.locator('[data-onchain="mvrv"]').getAttribute('aria-pressed'), 'true');
  result.cases.push('A return visit and reload restore the section, market chart, price asset and on-chain chart');

  await goto(page, '?view=market&chart=ALTSBTC&utm_source=ci&private_query=must-not-copy#unrecognized-anchor');
  await assertMarket(page, 'ALTSBTC');
  await page.locator('#mi-copy-link').click();
  const copies = await page.evaluate(() => window.__miClipboardWrites);
  assert.equal(copies.length, 1);
  const share = new URL(copies[0]);
  assert.equal(share.origin, baseURL); assert.equal(share.pathname, '/market-insights/');
  assert.deepEqual([...share.searchParams.entries()], [['view', 'market'], ['chart', 'ALTSBTC']]);
  assert.equal(share.hash, '#market-explorer');
  assert.doesNotMatch(copies[0], /private_query|must-not-copy|utm_source|unrecognized-anchor/);
  assert.match(await page.locator('#mi-share-status').innerText(), /copied/i);
  await page.evaluate(() => { window.__miClipboardDenied = true; });
  await page.locator('#mi-copy-link').click();
  const fallback = page.locator('#mi-share-link-field');
  assert(await fallback.isVisible()); assert.equal(await fallback.inputValue(), share.href);
  assert.equal(await fallback.getAttribute('readonly'), '');
  assert(await fallback.evaluate(el => el === document.activeElement && el.selectionStart === 0 && el.selectionEnd === el.value.length));
  assert.doesNotMatch(await page.locator('#mi-share-status').innerText(), /^link copied|^copied/i);
  await checkLayout(page, result, 'copy-link-fallback');
  await capture(page, result, 'copy-link-fallback-test');
  result.cases.push('Copied links contain only the selected public view; denied clipboard exposes a selected copyable link without claiming success');

  await goto(page, '?view=prices&asset=BNB'); await assertView(page, 'prices');
  assert.equal(await page.locator('[data-price-asset="BNB"]').getAttribute('aria-pressed'), 'true');
  await goto(page, '?view=onchain&onchain=realized'); await assertView(page, 'onchain');
  assert.equal(await page.locator('[data-onchain="realized"]').getAttribute('aria-pressed'), 'true');
  result.cases.push('Valid explicit view and chart links take precedence over saved preferences');

  await goto(page, '?view=market&chart=OTHERS');
  await chooseChart(page, 'STABLECAP', result); await chooseChart(page, 'TOTAL2', result);
  await page.goBack(); await assertMarket(page, 'STABLECAP');
  await page.goBack(); await assertMarket(page, 'OTHERS');
  await page.goForward(); await assertMarket(page, 'STABLECAP');
  await page.locator('#mi-tab-prices').click(); await assertView(page, 'prices');
  await page.goBack(); await assertMarket(page, 'STABLECAP');
  await page.goForward(); await assertView(page, 'prices');
  result.cases.push('Back and Forward restore both chart selections and main sections');

  for (const hash of ['rainbow-chart', 'rainbow-guide', 'research-notes']) {
    await goto(page, '?view=market&chart=OTHERS#' + hash);
    await assertView(page, 'rainbow');
    assert(await page.locator('#' + hash).isVisible());
  }
  result.cases.push('All three legacy Rainbow anchors continue to reveal the Rainbow view');

  for (const [label, seed, suffix, expected] of [
    ['corrupt JSON', '{not-json', '', 'sentiment'],
    ['unsupported stored version', { version: 99, view: 'market', chart: 'OTHERS', asset: 'ETH', onchain: 'mvrv' }, '', 'sentiment'],
    ['invalid stored values', { version: 1, view: 'unknown', chart: '__proto__', asset: 'invalid', onchain: 'invalid' }, '', 'sentiment'],
    ['blocked storage', 'blocked', '?view=market&chart=DEFI', 'market'],
    ['invalid URL', { version: 1, view: 'market', chart: 'OTHERS', asset: 'ETH', onchain: 'mvrv' }, '?view=unknown&chart=__proto__&asset=invalid&onchain=invalid', 'market']
  ]) {
    const context = await configureContext(browser, result, seed), checkPage = await createPage(context, result);
    try {
      await goto(checkPage, suffix); await assertView(checkPage, expected);
      if (expected === 'market') await assertMarket(checkPage, label === 'blocked storage' ? 'DEFI' : 'OTHERS');
      else { await checkPage.locator('#mi-tab-market').click(); await assertMarket(checkPage, 'TOTAL3'); }
      await checkLayout(checkPage, result, label);
      result.cases.push(label + ': safe recovery with valid default or preference');
    } finally { await context.close(); }
  }
}

let browser;
try {
  const modulePath = process.env.MARKET_OVERVIEW_BROWSER_MODULE;
  assert(modulePath, 'Set MARKET_OVERVIEW_BROWSER_MODULE to the isolated Playwright index module path');
  const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(path.resolve(modulePath)).href);
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  for (const width of widths) {
    const result = { width, height: 900, passed: false, cases: [], chartSelections: [], layouts: [], screenshots: [], consoleErrors: [], networkViolations: [], interceptedRequests: {} };
    report.results.push(result);
    const context = await configureContext(browser, result), page = await createPage(context, result);
    try {
      await goto(page); await assertView(page, 'sentiment');
      assert.equal(page.url(), targetURL, 'Fresh default visit keeps the canonical URL');
      assert.equal(await page.locator('#mi-tv-stage script').count(), 0, 'Market chart is lazy until its section is opened');
      assert.equal(await page.title(), 'Crypto Market Insights | TREE');
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://tree-token.xyz/market-insights/');
      assert.equal((await page.locator('#mi-tab-market').innerText()).trim(), 'Market Overview');
      await page.locator('#mi-tab-market').click(); await assertMarket(page, 'TOTAL3');
      assert.deepEqual(await page.locator('[data-tv-symbol]').evaluateAll(els => els.map(el => el.dataset.tvSymbol)), keys);
      assert.deepEqual(await page.locator('[data-market-group]').evaluateAll(els => els.map(el => el.dataset.marketGroup)), Object.keys(groups));
      assert.deepEqual((await page.locator('[data-market-group]').allTextContents()).map(x => x.trim()), groupLabels);
      for (const [group, charts] of Object.entries(groups)) {
        assert.deepEqual(await page.locator('[data-market-group-panel="' + group + '"] [data-tv-symbol]').evaluateAll(els => els.map(el => el.dataset.tvSymbol)), charts);
        await page.locator('[data-market-group="' + group + '"]').click();
        for (const key of charts) {
          await chooseChart(page, key, result);
          await checkLayout(page, result, key.toLowerCase());
          const bounds = await page.locator('[data-tv-symbol="' + key + '"]').boundingBox();
          assert(bounds && bounds.width >= 44 && bounds.height >= 43, key + ': usable touch target');
        }
        await capture(page, result, group + '-test');
      }
      result.cases.push('All fourteen symbols, source links, four groups, guide fields and touch targets work without horizontal overflow');
      await chooseChart(page, 'BTCD', result);
      await page.locator('[data-tv-symbol="BTCD"]').focus(); await page.keyboard.press('Tab');
      assert(await page.locator('[data-tv-symbol="STABLED"]').evaluate(el => el === document.activeElement));
      await page.keyboard.press('Enter'); await assertMarket(page, 'STABLED');
      if (width === 1363) {
        const a = await page.locator('[data-tv-symbol="BTCD"]').boundingBox(), b = await page.locator('[data-tv-symbol="STABLED"]').boundingBox();
        assert(a && b && Math.abs(a.y - b.y) <= 1 && b.x >= a.x + a.width, 'Stablecoin Dominance remains immediately right of BTC.D');
      }
      result.cases.push('Stablecoin Dominance remains directly after BTC.D for keyboard and desktop layout');
      await chooseChart(page, 'GOLDSILVER', result);
      const ratio = await page.locator('#mi-goldsilver-guide').innerText();
      assert.match(ratio, /gold price divided by silver price/i);
      assert.match(await page.locator('#mi-market-guide-rises').innerText(), /gold gains value relative to silver/i);
      assert.match(await page.locator('#mi-market-guide-falls').innerText(), /silver gains value relative to gold/i);
      assert.match(await page.locator('#mi-market-guide-shows').innerText(), /80.*one troy ounce of gold.*80 troy ounces of silver/i);
      assert.match(ratio, /silver rises to.*40.*ratio falls to 60/i);
      await chooseChart(page, 'DEFI', result);
      assert.match(await page.locator('#mi-market-guide').innerText(), /TVL|value locked/i);
      await chooseChart(page, 'ALTSBTC', result);
      const relative = await page.locator('#mi-market-guide').innerText();
      assert.match(relative, /market cap/i); assert.match(relative, /relative|compared|comparison|divided/i);
      result.cases.push('Gold/Silver direction remains correct; DeFi and Altcoins vs. BTC distinguish their measurements');
      if (width === 390) await stateChecks(browser, page, result);
      assert.deepEqual(result.consoleErrors, [], 'Owned JavaScript emitted errors');
      assert.deepEqual(result.networkViolations, [], 'Unexpected non-read-only network request');
      result.cases.push('No owned JavaScript errors or non-read-only requests'); result.passed = true;
    } catch (error) {
      result.error = error.stack || String(error);
      await capture(page, result, 'failure-test').catch(e => { result.screenshotError = e.message; });
    } finally { await context.close(); }
  }
} catch (error) { report.error = error.stack || String(error); }
finally {
  await browser?.close(); report.completedAt = new Date().toISOString();
  report.passed = !report.error && report.results.length === widths.length && report.results.every(result => result.passed);
  await fs.writeFile(path.join(output, 'market-overview-browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ baseURL, candidateId: report.candidateId, sourceCommit: report.sourceCommit, passed: report.passed, results: report.results.map(({ width, passed, cases, error }) => ({ width, passed, cases: cases.length, error })), report: '.netlify/market-overview-browser-checks.json' }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
