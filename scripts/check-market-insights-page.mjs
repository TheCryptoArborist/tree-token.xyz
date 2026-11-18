// CI-only layout check. Launches its own installed Chromium; never connects to
// the managed cloud browser. Fixtures below are not production market data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const baseURL = new URL(process.env.MARKET_INSIGHTS_TEST_BASE || 'http://127.0.0.1:8765').origin;
const targetURL = new URL('/market-insights/', baseURL).href;
const output = path.resolve('.netlify');
const widths = [320, 390, 768, 1363];
const tabs = ['sentiment', 'prices', 'rainbow', 'market', 'cbbi', 'onchain', 'cycles'];
const tabLabels = ['Fear & Greed', 'Price Charts', 'Rainbow', 'Market Caps', 'CBBI', 'On-Chain', 'Cycle Tools'];
const quoteUSD = 100000;
const fixtureTime = Math.floor(Date.now() / 1000);
const report = {
  baseURL, targetURL, sourceCommit: process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || null,
  source: 'scripts/check-market-insights-page.mjs', startedAt: new Date().toISOString(),
  testOnly: true,
  fixtures: { BTCUSD: { USD: quoteUSD, time: fixtureTime }, sentimentScore: 50, cbbiScore: 0.5 },
  networkPolicy: 'Only first-party GET/HEAD requests are sent. All provider data is mocked and other third-party requests are blocked.',
  limitations: ['External chart interiors and real provider availability are not tested.'],
  results: []
};
await fs.mkdir(output, { recursive: true });

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
const cbbiFixture = Object.fromEntries(
  ['Confidence', 'PiCycle', 'RUPL', 'RHODL', 'Puell', '2YMA', 'Trolololo', 'MVRV', 'ReserveRisk', 'Woobull', 'Price']
    .map(key => [key, Object.fromEntries([30, 15, 0].map(days => [fixtureTime - days * 86400, key === 'Price' ? quoteUSD : 0.5]))])
);

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
    if (url.href === 'https://mempool.space/api/v1/prices') return json({ USD: quoteUSD, time: fixtureTime, testOnly: true });
    if (url.origin === 'https://cryptokeyhole.com' && url.pathname === '/api/v1/fear-and-greed') return json(sentimentFixture(url.searchParams.get('coin')));
    if (url.href === 'https://colintalkscrypto.com/cbbi/data/latest.json') return json(cbbiFixture);
    if (request.resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width"><style>body{background:#081820;color:#a0b9bf;font:14px system-ui;padding:16px;overflow-wrap:anywhere}</style><p>CI TEST PLACEHOLDER · External chart content is intentionally blocked.</p>' });
    }
    if (request.resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* CI ONLY: external script blocked; no provider request was sent. */' });
    return route.abort('blockedbyclient');
  });
}

async function check(result, name, action) {
  await action();
  result.cases.push(name);
}

async function checkLayout(page, result, view) {
  const measured = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth, failures = [];
    for (const el of document.querySelectorAll('.site-header, .site-header *, main, main *, .site-footer, .site-footer *')) {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (!rect.width || !rect.height || !el.getClientRects().length || style.visibility === 'hidden') continue;
      if (el.matches('.skip') && el !== document.activeElement) continue;
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
      // The 768px tab strip intentionally scrolls horizontally. Inspect its own
      // box, but not offscreen tab children. Body clipping is never an exemption.
      const strip = el.closest('.mi-tabbar');
      if (strip && strip !== el && ['auto', 'scroll'].includes(getComputedStyle(strip).overflowX)) continue;
      const name = el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + Array.from(el.classList).join('.');
      if (rect.left < -1 || rect.right > viewport + 1) failures.push({ element: name, left: rect.left, right: rect.right, reason: 'outside viewport' });
      const scrollableTabs = el.matches('.mi-tabbar') && ['auto', 'scroll'].includes(style.overflowX);
      if (el instanceof HTMLElement && el.clientWidth && !el.matches('input,textarea') && !scrollableTabs && el.scrollWidth > el.clientWidth + 1) {
        failures.push({ element: name, width: el.clientWidth, scrollWidth: el.scrollWidth, reason: 'component overflow' });
      }
    }
    return { viewportWidth: viewport, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, failures };
  });
  result.layouts.push({ view, ...measured });
  assert(measured.documentWidth <= measured.viewportWidth + 1, view + ': horizontal document overflow');
  assert.deepEqual(measured.failures, [], view + ': horizontal component overflow');
  result.cases.push(view + ': no document or component horizontal overflow');
}

async function capture(page, result, view) {
  // Add an unmistakable watermark only after assertions; it cannot conceal a
  // tested layout failure and never changes a repository or deployed file.
  await page.evaluate(({ width, quoteUSD }) => {
    const banner = document.createElement('div'); banner.id = 'ci-test-watermark';
    banner.textContent = 'CI TEST ONLY · Synthetic data · BTC/USD $' + quoteUSD.toLocaleString('en-US') + ' · ' + width + ' CSS px · External charts blocked';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;box-sizing:border-box;padding:6px 10px;background:#ffda70;color:#121212;font:700 11px/1.35 system-ui;overflow-wrap:anywhere;pointer-events:none';
    document.body.appendChild(banner);
  }, { width: result.width, quoteUSD });
  const file = 'market-insights-' + result.width + '-' + view + '.png';
  try {
    const bytes = await page.screenshot({ path: path.join(output, file), type: 'png', fullPage: true, animations: 'disabled' });
    result.screenshots.push({ file: '.netlify/' + file, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), testOnly: true });
  } finally {
    await page.locator('#ci-test-watermark').evaluate(el => el.remove()).catch(() => {});
  }
}

async function checkTabKeyboard(page, selector, attribute) {
  const buttons = page.locator(selector), count = await buttons.count();
  const assertSelected = async index => {
    for (let i = 0; i < count; i++) {
      assert.equal(await buttons.nth(i).getAttribute('aria-selected'), String(i === index));
      assert.equal(await buttons.nth(i).evaluate(el => el.tabIndex), i === index ? 0 : -1);
    }
    assert(await buttons.nth(index).evaluate(el => el === document.activeElement), attribute + ': selected tab must receive focus');
  };
  await buttons.first().click();
  for (const [from, key, to] of [[0, 'ArrowRight', 1], [1, 'ArrowLeft', 0], [0, 'ArrowLeft', count - 1], [count - 1, 'ArrowRight', 0], [0, 'End', count - 1], [count - 1, 'Home', 0]]) {
    await buttons.nth(from).press(key); await assertSelected(to);
  }
  // Synthetic modifier events test the actual handlers without invoking browser
  // history/Home shortcuts. Ordinary arrows above use real keyboard presses.
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    const unconsumed = await buttons.first().evaluate((el, modifier) => {
      el.focus(); return el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', [modifier]: true, bubbles: true, cancelable: true }));
    }, modifier);
    assert.equal(unconsumed, true, attribute + ': modified key must remain unconsumed');
    await assertSelected(0);
  }
}

let browser;
try {
  const modulePath = process.env.MARKET_INSIGHTS_BROWSER_MODULE;
  assert(modulePath, 'Set MARKET_INSIGHTS_BROWSER_MODULE to the isolated Playwright index module path');
  const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(path.resolve(modulePath)).href);
  browser = await chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  for (const width of widths) {
    const result = { width, height: 900, passed: false, cases: [], layouts: [], screenshots: [], consoleErrors: [], networkViolations: [], interceptedRequests: {} };
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
      assert(response?.ok(), 'Page request failed');
      await page.waitForFunction(() => document.querySelector('#mi-sentiment-number')?.textContent === '50');
      await check(result, 'Production title, canonical route and seven labeled tool tabs', async () => {
        assert.equal(await page.title(), 'Crypto Market Insights | TREE');
        assert.equal(page.url(), targetURL);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://tree-token.xyz/market-insights/');
        assert.deepEqual(await page.locator('[data-mi-tab]').evaluateAll(els => els.map(el => el.dataset.miTab)), tabs);
        assert.deepEqual((await page.locator('[data-mi-tab]').allTextContents()).map(x => x.trim()), tabLabels);
        assert.deepEqual(await page.locator('[data-sentiment-asset]').evaluateAll(els => els.map(el => el.dataset.sentimentAsset)), ['sui', 'eth', 'bnb', 'btc', 'market']);
        assert.deepEqual((await page.locator('.mi-sentiment-card-label').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim()), ['SUI SUI sentiment', 'Ethereum ETH sentiment', 'BNB BNB sentiment', 'Bitcoin BTC sentiment', 'Market Broad crypto']);
      });
      await checkLayout(page, result, 'sentiment');
      await capture(page, result, 'sentiment-test');

      if (width < 1230) {
        await check(result, 'Mobile keyboard menu, Resources and Escape focus restoration', async () => {
          const toggle = page.locator('#nav-toggle'), menu = page.locator('#mobile-nav');
          await toggle.press('Enter');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
          assert(await menu.locator('.site-nav > a').first().evaluate(el => el === document.activeElement));
          await menu.locator('.nav-resources summary').press('Enter');
          await menu.locator('.nav-resources-links a').first().focus();
          await checkLayout(page, result, 'mobile-menu');
          await capture(page, result, 'mobile-menu-test');
          await page.keyboard.press('Escape');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
          assert.equal(await menu.isVisible(), false);
          assert.equal(await menu.locator('.nav-resources').evaluate(el => el.open), false);
          assert(await toggle.evaluate(el => el === document.activeElement));
        });
      }

      await check(result, 'Main tab arrow/Home/End/wrap keys and all modifier guards', () => checkTabKeyboard(page, '[data-mi-tab]', 'main tabs'));
      for (const id of tabs) {
        await page.locator('#mi-tab-' + id).click();
        assert.equal(await page.locator('[data-mi-tab][aria-selected="true"]').count(), 1);
        assert(await page.locator('#mi-pane-' + id).isVisible(), id + ': selected panel visible');
        assert.equal(await page.locator('.mi-pane:visible').count(), 1, id + ': only one main panel visible');
        if (id === 'cbbi') await page.waitForFunction(() => document.querySelector('#mi-cbbi-value')?.textContent === '50.0 / 100');
        await checkLayout(page, result, id);
      }
      await page.locator('#mi-tab-rainbow').click();
      await check(result, 'Rainbow guide arrow/Home/End/wrap keys and all modifier guards', () => checkTabKeyboard(page, '[data-rb-tab]', 'rainbow guide'));

      await page.locator('#mi-tab-prices').click();
      await check(result, 'Five price assets, pressed states, correct USD/USDT labels and source links', async () => {
        const assets = ['BTC', 'ETH', 'SUI', 'BNB', 'TREE'];
        assert.deepEqual((await page.locator('[data-price-asset]').allTextContents()).map(x => x.trim()), assets);
        for (const asset of assets) {
          await page.locator('[data-price-asset="' + asset + '"]').click();
          assert.equal(await page.locator('[data-price-asset][aria-pressed="true"]').count(), 1);
          assert.equal(await page.locator('[data-price-asset="' + asset + '"]').getAttribute('aria-pressed'), 'true');
          const description = await page.locator('#mi-price-description').innerText();
          const source = new URL(await page.locator('#mi-price-source').getAttribute('href'));
          if (asset === 'TREE') { assert.match(description, /TREE · USD · Noodles/); assert.equal(source.hostname, 'app.noodles.fi'); }
          else { assert(description.includes(asset + '/USDT')); assert.equal(source.hostname, 'www.tradingview.com'); assert.equal(source.pathname, '/symbols/' + asset + 'USDT/'); assert.equal(source.searchParams.get('exchange'), 'BINANCE'); }
          await checkLayout(page, result, 'price-' + asset);
        }
      });
      await capture(page, result, 'price-tree-test');

      await page.locator('#mi-tab-cycles').click();
      await check(result, 'Four cycle choices and maximum 2009 calculation with mock BTC/USD', async () => {
        assert.deepEqual(await page.locator('[data-cycle]').evaluateAll(els => els.map(el => el.dataset.cycle)), ['2009', '2018', '2022', '2026']);
        await page.locator('[data-cycle="2009"]').click();
        await page.locator('#mi-calc-principal').fill('1000000000');
        await page.waitForFunction(() => document.querySelector('#mi-calc-price-status')?.dataset.state === 'ready');
        assert.equal((await page.locator('#mi-calc-btc').innerText()).trim(), '1,309,030,000,000 BTC');
        assert.equal((await page.locator('#mi-calc-value').innerText()).trim(), '$130,903,000,000,000,000.00');
        assert.equal(await page.locator('#mi-calc-quote').innerText(), '$100,000.00');
        assert(await page.locator('#mi-calc-first-note').isVisible());
        assert.match(await page.locator('#mi-calc-result').innerText(), /illustrative value/);
        for (const id of ['mi-calc-gain', 'mi-calc-return']) assert.match(await page.locator('#' + id).innerText(), /\d/);
      });
      await checkLayout(page, result, 'cycles-2009-maximum');
      await capture(page, result, 'cycles-2009-maximum-test');
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
  await fs.writeFile(path.join(output, 'market-insights-browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ baseURL, passed: report.passed, results: report.results.map(({ width, passed, cases, error }) => ({ width, passed, cases: cases.length, error })), report: '.netlify/market-insights-browser-checks.json' }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
