// Actual read-only TradingView embeds, in CI's own Chromium. No provider mocks.
// A symbol label and an empty canvas are not sufficient: all four OHLC values
// must be populated with positive numbers before the chart is accepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprint } from './release-preserved-production.mjs';

const plan = JSON.parse(await fs.readFile('.netlify/market-overview/plan.json', 'utf8'));
const candidate = JSON.parse(await fs.readFile('.netlify/market-overview/candidate.json', 'utf8'));
const modulePath = process.env.MARKET_OVERVIEW_BROWSER_MODULE;
assert(modulePath, 'MARKET_OVERVIEW_BROWSER_MODULE is required');
assert.match(candidate.id, /^[a-f0-9]{24}$/, 'Bound candidate ID is required');
const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(path.resolve(modulePath)).href);
const origin = 'https://' + candidate.id + '--tree-token.netlify.app';
const symbols = [
  { key: 'OTHERS', group: 'size', symbol: 'CRYPTOCAP:OTHERS', label: /OTHERS|excluding\s+(?:the\s+)?top\s*10/i, check: 'othersChartRendered' },
  { key: 'ETHD', group: 'dominance', symbol: 'CRYPTOCAP:ETH.D', label: /(?:ETH|Ethereum).*dominance|ETH\.D/i, check: 'ethDominanceRendered' },
  { key: 'STABLECAP', group: 'size', symbol: 'CRYPTOCAP:STABLE.C', label: /stablecoin.*(?:market cap|capitalization)|STABLE\.C/i, check: 'stablecoinMarketCapRendered' },
  { key: 'DEFI', group: 'sectors', symbol: 'CRYPTOCAP:TOTALDEFI', label: /DeFi|TOTALDEFI/i, check: 'defiMarketCapRendered' },
  { key: 'ALTSBTC', group: 'ratios', symbol: 'CRYPTOCAP:TOTAL3ESBTC', label: /TOTAL3ESBTC|(?:total|crypto|altcoins).*(?:BTC|Bitcoin)/i, check: 'altcoinsVsBtcRendered' }
];
const report = {
  schemaVersion: 1, result: 'failed', testOnly: false,
  sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree, candidateId: candidate.id,
  planSha256: fingerprint(plan), origin, checkedAt: new Date().toISOString(), noWalletOrPaymentActions: true,
  provider: 'TradingView', symbols: symbols.map(item => item.symbol), viewportWidths: [1363],
  checks: { othersChartRendered: false, ethDominanceRendered: false, stablecoinMarketCapRendered: false, defiMarketCapRendered: false, altcoinsVsBtcRendered: false, populatedData: false, chartInteraction: false, sourceLinks: false },
  charts: [], observations: [], limitations: ['This verifies rendering and chart controls at the review time. It does not audit TradingView market data or guarantee future provider availability.']
};
const screenshotDirectory = '.netlify/market-overview-live';
await fs.mkdir(screenshotDirectory, { recursive: true });

function ohlcFromText(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  // The symbol avatar can also be the letter O. Accept only a complete native
  // legend containing four consecutive OHLC labels and positive values.
  for (let start = 0; start < lines.length; start++) {
    if (lines[start] !== 'O') continue;
    const values = {};
    for (const [offset, key] of ['O', 'H', 'L', 'C'].entries()) {
      const index = start + offset * 2;
      if (lines[index] !== key) break;
      const raw = (lines[index + 1] || '').replace(/[\s\u00a0\u202f]/g, '');
      if (!/^\d[\d,]*(?:\.\d+)?[KMBT]?%?$/i.test(raw)) break;
      const amount = Number(raw.replace(/[,KMBT%]/gi, ''));
      if (!Number.isFinite(amount) || amount <= 0) break;
      values[key] = raw;
    }
    if (Object.keys(values).length === 4) return values;
  }
  return null;
}

async function chartFrames(page) {
  const frames = [];
  for (const handle of await page.locator('#mi-tv-stage iframe').elementHandles()) {
    const frame = await handle.contentFrame();
    if (frame && /tradingview(?:-widget)?\.com/i.test(frame.url())) frames.push(frame);
  }
  return frames;
}

async function waitForPopulatedChart(page, item, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let lastState = null;
  while (Date.now() < deadline) {
    for (const frame of await chartFrames(page)) {
      try {
        const state = await frame.evaluate(() => ({
          title: document.title, text: (document.body?.innerText || '').slice(0, 16000),
          canvasCount: [...document.querySelectorAll('canvas')].filter(canvas => canvas.width > 180 && canvas.height > 90).length
        }));
        lastState = { title: state.title, canvasCount: state.canvasCount, textSample: state.text.slice(0, 1200) };
        if (/invalid symbol|symbol not found|this symbol is only available on tradingview|no data here|data for this symbol is not available/i.test(state.text)) throw Error('Provider rejected ' + item.symbol + ': ' + state.text.slice(0, 800));
        const ohlc = ohlcFromText(state.text);
        if (state.canvasCount > 0 && item.label.test(state.title + ' ' + state.text) && ohlc) {
          return { frame, evidence: { ...lastState, ohlc, providerFrameOrigin: new URL(frame.url()).origin, observedAt: new Date().toISOString() } };
        }
      } catch (error) {
        if (String(error.message).startsWith('Provider rejected ')) throw error;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw Error('Real TradingView ' + item.symbol + ' did not show matching populated OHLC and a chart canvas. Last state: ' + JSON.stringify(lastState));
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  report.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1363, height: 950 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  page.setDefaultTimeout(12000);
  const res = await page.goto(origin + '/market-insights/?view=market&chart=OTHERS#market-explorer', { waitUntil: 'domcontentloaded', timeout: 35000 });
  assert(res?.ok(), 'Candidate unavailable');
  assert.equal(await page.locator('#mi-tab-market').getAttribute('aria-selected'), 'true');
  for (const item of symbols) {
    if (!await page.locator('[data-tv-symbol="' + item.key + '"]').isVisible()) await page.locator('[data-market-group="' + item.group + '"]').click();
    await page.locator('[data-tv-symbol="' + item.key + '"]').click();
    assert.equal(await page.locator('[data-tv-symbol="' + item.key + '"]').getAttribute('aria-pressed'), 'true');
    // TradingView replaces its loader script with the real iframe. Inspect the
    // rendered provider request instead of waiting for that removed script.
    const embed = page.locator('#mi-tv-stage iframe[title="advanced chart TradingView widget"]').first();
    await embed.waitFor({ state: 'attached', timeout: 35000 });
    const embedURL = new URL(await embed.getAttribute('src'));
    assert(['https://www.tradingview-widget.com', 'https://www.tradingview.com'].includes(embedURL.origin), 'Official TradingView iframe is required');
    const config = JSON.parse(decodeURIComponent(embedURL.hash.slice(1)));
    assert.equal(config.symbol, item.symbol, 'Selected chart request must match reviewed symbol');
    const loaded = await waitForPopulatedChart(page, item);
    const sourcePath = '/symbols/CRYPTOCAP-' + item.symbol.split(':')[1] + '/';
    const links = [];
    for (const selector of ['#mi-market-source', '#mi-tv-stage .tradingview-widget-copyright a']) {
      const source = new URL(await page.locator(selector).getAttribute('href'));
      assert.equal(source.origin, 'https://www.tradingview.com'); assert.equal(source.pathname, sourcePath);
      links.push(source.href);
    }
    const file = screenshotDirectory + '/' + item.key.toLowerCase() + '.png';
    await page.locator('#mi-pane-market').screenshot({ path: file, animations: 'disabled' });
    report.charts.push({ key: item.key, symbol: item.symbol, evidence: loaded.evidence, source: links[0], attribution: links[1], screenshot: file });
    report.checks[item.check] = true;
    console.log(JSON.stringify({ key: item.key, symbol: item.symbol, canvasCount: loaded.evidence.canvasCount, ohlc: loaded.evidence.ohlc, source: links[0] }));
    if (item.key === 'ALTSBTC') {
      const range = loaded.frame.getByText('3M', { exact: true }).first();
      assert(await range.isVisible(), 'Provider 3M range control must be visible');
      await range.click();
      await page.waitForTimeout(1500);
      const after = await waitForPopulatedChart(page, item, 20000);
      report.interaction = {
        symbol: item.symbol, control: '3M', action: 'clicked the visible TradingView range control',
        populatedAfterInteraction: true, evidence: after.evidence,
        controlAttributes: await range.evaluate(el => Object.fromEntries([...el.attributes].map(attribute => [attribute.name, attribute.value])))
      };
      await page.locator('#mi-pane-market').screenshot({ path: screenshotDirectory + '/altsbtc-3m.png', animations: 'disabled' });
      report.checks.chartInteraction = true;
    }
  }
  report.checks.populatedData = report.charts.length === symbols.length && report.charts.every(chart => Object.keys(chart.evidence.ohlc).length === 4);
  report.checks.sourceLinks = report.charts.length === symbols.length;
  assert(Object.values(report.checks).every(Boolean), 'Every real-provider acceptance check must pass');
  report.result = 'passed';
  report.observations.push('All five new instruments displayed matching labels, chart canvases and populated open/high/low/close values in actual TradingView embeds.');
  report.observations.push('The visible 3M range control was clicked on Altcoins vs. BTC and the provider chart continued to display populated data.');
} catch (error) { report.error = String(error.stack || error); }
finally {
  report.checkedAt = new Date().toISOString();
  await fs.writeFile('.netlify/market-overview-live-review.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ result: report.result, checks: report.checks, charts: report.charts.map(({ key, symbol, evidence }) => ({ key, symbol, evidence })), error: report.error }, null, 2));
if (report.result !== 'passed') process.exitCode = 1;
