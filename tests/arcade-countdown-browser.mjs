import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

// Exercise the actual candidate presentation in isolated signed-out contexts.
// Only public API data and the browser clock are synthetic. No HTML, JS, CSS,
// wallet module or payment module is substituted.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, process.env.ARCADE_COUNTDOWN_REVIEW_OUTPUT || '.netlify/arcade-countdown-review');
const widths = [320, 390, 1280];
const placements = [
  { type: 'daily', tab: 'growth-today-tab', view: 'daily', panel: 'growth-today-panel' },
  { type: 'monthly', tab: 'growth-month-tab', view: 'month', panel: 'growth-month-panel' },
  { type: 'badges', tab: 'growth-badges-tab', view: 'badges', panel: 'growth-badges-panel' },
];
const checkNames = ['singleTimer', 'launchCopy', 'threePlacements', 'utcTargets', 'ticking',
  'monthRollover', 'unknownBadges', 'mobileLayout', 'noMissingAssets'];
const scenarioNames = ['configured-december', 'january-rollover'];
const requiredAssets = ['/scripts/arcade-next-month-unlocks.js', '/styles/arcade-organization.css'];
const replacedLegacyImages = new Set([
  '/assets/arcade-growth/nftree-scout.webp',
  '/assets/arcade-growth/tree-force-vanguard.webp',
  '/assets/arcade-growth/thickquidity-legend.webp',
]);
const report = {
  schemaVersion: 1, result: 'failed', checkedAt: new Date().toISOString(), viewportWidths: widths,
  noWalletOrPaymentActions: true, syntheticWalletOnly: true, syntheticDataOnly: true,
  expectedScenarioCount: widths.length * scenarioNames.length,
  checks: Object.fromEntries(checkNames.map(name => [name, false])),
  viewports: [], screenshots: [], failures: [], browserErrors: [], assetFailures: [], unexpectedWrites: [],
  unsupportedAPIReads: [], verifiedImageCancellations: [], replacementImageChecks: [],
  evidence: {
    application: 'Actual candidate HTML, CSS and JavaScript are served without local overlays.',
    wallet: 'Fresh signed-out browser contexts; no wallet provider is installed or connected and no sign-in control is used.',
    network: 'Every API read is intercepted with synthetic public data. Every non-GET/HEAD request is aborted and reported.',
    clock: 'Playwright Clock tests one-second ticking and the November-to-December UTC boundary.',
  },
};
fs.mkdirSync(output, { recursive: true });

async function until(check, description, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out: ' + description);
}

function publicAPI({ width, scenario, now }) {
  const api = { now, calls: [] };
  api.handle = async (route, request, url) => {
    const action = url.searchParams.get('action') || 'status';
    api.calls.push({ path: url.pathname, method: request.method(), action });
    const dateKey = new Date(api.now).toISOString().slice(0, 10), monthKey = dateKey.slice(0, 7);
    let data;
    if (url.pathname === '/api/arcade-growth' && action === 'status') {
      data = { status: 'ok', authenticated: false, dateKey, monthKey,
        configuration: { enabledGames: [], eligibleGames: [] } };
    } else if (url.pathname === '/api/arcade-monthly' && action === 'status') {
      data = { status: 'ok', authenticated: false, configuration: { recovery: {
        price: '20000', amountBaseUnits: '20000000000', cutoffPolicy: 'utc-month-end-v1', cutoffEffectiveMonth: '2026-11',
      } } };
    } else if (url.pathname === '/api/arcade-completed-runs') {
      data = { wallet: null, dateKey, runs: [], sources: {} };
    } else if (url.pathname === '/api/arcade-social') {
      data = { wallet: null, entries: [], monthlyStamps: 0, resetsAt: new Date(api.now + 86_400_000).toISOString() };
    } else if (url.pathname === '/api/arcade-campaign') {
      data = { status: 'ok', progress: { wallet: null, campaignId: 'first-round-v1', canClaim: false,
        quizCompleteThisWeek: false, learningStamps: 0, startedAt: null, claimedAt: null,
        tasks: { checkIn: false, quiz: false, game: false, share: false } } };
    } else if (url.pathname === '/api/arcade-events') {
      data = { status: 'ok', authenticated: false, events: [] };
    }
    if (!data) report.unsupportedAPIReads.push({ width, scenario, url: url.href });
    await route.fulfill({ status: data ? 200 : 503, contentType: 'application/json',
      headers: { Date: new Date(api.now).toUTCString(), 'Cache-Control': 'no-store' },
      body: JSON.stringify(data || { status: 'error', message: 'Read endpoint unavailable in isolated countdown review.' }) });
  };
  return api;
}

function seconds(text) {
  const match = /^(\d+)d (\d{2})h (\d{2})m (\d{2})s$/.exec(text);
  assert(match, 'Countdown must show days, hours, minutes and seconds: ' + text);
  assert(Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60);
  return Number(match[1]) * 86400 + Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
}

async function snapshots(page) {
  return page.evaluate(() => ({ now: Date.now(), cards: [...document.querySelectorAll('[data-arcade-next-unlock]')].map(card => {
    const timer = card.querySelector('[data-unlock-calendar]'), label = card.querySelector('[data-unlock-label]');
    const text = selector => card.querySelector(selector)?.textContent.trim() || '';
    const labelId = timer?.getAttribute('aria-labelledby') || '';
    return { type: card.dataset.arcadeNextUnlock, parent: card.parentElement.id, monthKey: card.dataset.nextMonth,
      heading: text('[data-unlock-month]'), label: text('[data-unlock-label]'), description: text('[data-unlock-description]'),
      timer: text('[data-unlock-calendar]'), footer: text('[data-unlock-date]'),
      timerCount: card.querySelectorAll('[role="timer"]').length,
      calendarCount: card.querySelectorAll('[data-unlock-calendar]').length,
      oldBadgeNodes: card.querySelectorAll('[data-unlock-badges],[data-unlock-badge-name]').length,
      timerRole: timer?.getAttribute('role'), live: timer?.getAttribute('aria-live'),
      labelId, validLabel: Boolean(labelId && label?.id === labelId && document.getElementById(labelId) === label),
      labelIdCount: [...document.querySelectorAll('[id]')].filter(node => node.id === labelId).length,
    };
  }) }));
}

async function assertCards(page, key) {
  const value = await snapshots(page);
  assert.equal(value.cards.length, 3, 'Exactly one Up Next card in each of the three intended panels');
  assert.deepEqual(value.cards.map(card => card.type).sort(), ['badges', 'daily', 'monthly']);
  assert.equal(new Set(value.cards.map(card => card.labelId)).size, 3, 'Each timer has its own visible label ID');
  const december = key === '2026-12';
  const target = Date.parse(december ? '2026-12-01T00:00:00.000Z' : '2027-01-01T00:00:00.000Z');
  for (const card of value.cards) {
    assert.equal(card.parent, placements.find(item => item.type === card.type).panel);
    assert.equal(card.monthKey, key);
    assert.equal(card.timerCount, 1, 'Only one timer may exist within an Up Next card');
    assert.equal(card.calendarCount, 1); assert.equal(card.oldBadgeNodes, 0);
    assert.equal(card.timerRole, 'timer'); assert.equal(card.live, 'off');
    assert.equal(card.validLabel, true); assert.equal(card.labelIdCount, 1);
    assert.equal(card.heading, december ? 'December 2026' : 'January 2027');
    assert.equal(card.label, december ? 'December launches in' : 'January calendar opens in');
    assert.equal(card.description, december ? 'Tree Hero’s Advent Grove and Christmas Guardians badges.'
      : 'A new daily check-in calendar. Next badge collection not announced.');
    assert.equal(card.footer, december
      ? 'Starts December 1, 2026 · 00:00 UTC. Badge eligibility is verified by the Arcade.'
      : 'Calendar begins January 1, 2027 · 00:00 UTC. No badge release date is configured yet.');
    const expected = Math.ceil((target - value.now) / 1000);
    assert.ok(Math.abs(seconds(card.timer) - expected) <= 1,
      'Each timer targets the exact next UTC month boundary, within its one-second refresh interval');
    if (!december) assert.doesNotMatch(card.description, /Christmas Guardians|Advent Grove/);
  }
  return value;
}

async function choosePlacement(page, placement, width) {
  const tab = page.locator('#' + placement.tab);
  assert.equal(await tab.isVisible(), true);
  // The page clock is paused for exact countdown assertions. The target's
  // visibility is checked above; force avoids waiting for clock-paused RAFs.
  await tab.click({ force: true });
  await until(() => page.evaluate(view => document.getElementById('arcade-daily-growth')?.dataset.arcadeView === view,
    placement.view), placement.view + ' tab selected');
  const card = page.locator('[data-arcade-next-unlock="' + placement.type + '"]');
  assert.equal(await card.isVisible(), true);
  assert.equal(await card.locator('[role="timer"]:visible').count(), 1);
  const layout = await card.evaluate(node => {
    const rect = node.getBoundingClientRect(), timer = node.querySelector('[data-unlock-calendar]').getBoundingClientRect();
    return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      left: rect.left, right: rect.right, timerLeft: timer.left, timerRight: timer.right,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
  });
  assert.ok(layout.pageWidth <= layout.viewport + 1, `Page overflow at ${width}px on ${placement.type}`);
  assert.ok(layout.left >= -1 && layout.right <= width + 1, 'Card fits the viewport');
  assert.ok(layout.timerLeft >= layout.left && layout.timerRight <= layout.right + 1, 'Countdown fits its card');
  assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'Card content does not overflow');
  return layout;
}

async function screenshot(page, filename) {
  await until(() => page.evaluate(() => !document.fonts || document.fonts.status === 'loaded'), 'Displayed fonts finish loading');
  await page.locator('[data-arcade-next-unlock="daily"]').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.clock.runFor(64);
  await page.screenshot({ path: path.join(output, filename), fullPage: false, animations: 'disabled', timeout: 30_000 });
  report.screenshots.push(filename);
}

async function boundedImageDecode(promise, description) {
  let timeout;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      // Node's clock remains real while Playwright's page clock is paused.
      timeout = setTimeout(() => reject(new Error('Image decode timed out: ' + description)), 15_000);
    })]);
  } finally { clearTimeout(timeout); }
}

async function verifyImageCancellations(page, context, pending, item, width, scenario) {
  item.verifiedImageCancellations = [];
  if (!pending.size) return;
  try {
    for (const [url, occurrences] of pending) {
      const response = await context.request.get(url, { timeout: 15_000, maxRedirects: 0 });
      assert.equal(response.status(), 200, 'Cancelled legacy image must be available: ' + url);
      const contentType = response.headers()['content-type'] || '';
      assert.match(contentType, /^image\/[\w.+-]+(?:\s*;|$)/i, 'Cancelled asset must have an image MIME type');
      const decoded = await boundedImageDecode(page.evaluate(async url => {
        const image = new Image(); image.src = url;
        await image.decode();
        return { src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight };
      }, url), url);
      assert(decoded.width > 0 && decoded.height > 0, 'Cancelled image must actually decode: ' + url);
      const evidence = { url, occurrences, status: response.status(), contentType, ...decoded };
      item.verifiedImageCancellations.push(evidence);
      report.verifiedImageCancellations.push({ viewportWidth: width, scenario, ...evidence });
    }
    const replacements = await boundedImageDecode(page.evaluate(async () => {
      const images = [...document.querySelectorAll('.growth-rank-stop img')];
      return Promise.all(images.map(async image => {
        image.loading = 'eager';
        await image.decode();
        return { rank: image.closest('[data-rank-id]')?.dataset.rankId,
          src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight };
      }));
    }), 'current seasonal rank images');
    assert(replacements.length > 0, 'Current seasonal rank images must be present');
    for (const image of replacements) {
      assert(image.width > 0 && image.height > 0, 'Current rank image must actually decode: ' + image.src);
      assert(!pending.has(image.src), 'The seasonal module must replace the cancelled legacy source');
    }
    item.replacementImageChecks = replacements;
    report.replacementImageChecks.push({ width, scenario, images: replacements });
    assert.equal(new Set(item.verifiedImageCancellations.map(image => image.url)).size, pending.size,
      'Every unique cancelled legacy image must be independently verified');
  } catch (error) {
    report.assetFailures.push({ width, scenario, message: 'Unresolved image cancellation: ' + error.message });
    throw error;
  }
}

let browser, origin;
async function runScenario(viewport, name) {
  const width = viewport.width;
  const item = { name, result: 'failed', placements: [], apiReads: [] };
  viewport.scenarios.push(item);
  const rollover = name === 'january-rollover';
  const initial = Date.parse(rollover ? '2026-11-30T23:57:00.000Z' : '2026-11-22T11:58:00.000Z');
  const anchor = Date.parse(rollover ? '2026-11-30T23:59:58.000Z' : '2026-11-22T12:00:00.000Z');
  const api = publicAPI({ width, scenario: name, now: initial });
  const served = new Map();
  const pendingImageCancellations = new Map();
  let closing = false;
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1,
    serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) {
      report.unexpectedWrites.push({ width, scenario: name, method: request.method(), url: url.href });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.includes('/api/') || url.pathname.startsWith('/.netlify/functions/')) return api.handle(route, request, url);
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => report.browserErrors.push({ width, scenario: name, message: error.message }));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== origin) return;
    if (requiredAssets.includes(url.pathname)) served.set(url.pathname, response.status());
    if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) {
      report.assetFailures.push({ width, scenario: name, url: url.href, status: response.status() });
    }
  });
  page.on('requestfailed', request => {
    if (closing) return; // Context teardown can cancel unrelated lazy assets.
    const url = new URL(request.url());
    if (url.origin === origin && ['image', 'script', 'stylesheet', 'font'].includes(request.resourceType())) {
      const message = request.failure()?.errorText;
      if (request.resourceType() === 'image' && message === 'net::ERR_ABORTED'
        && !url.search && !url.hash && replacedLegacyImages.has(url.pathname)) {
        pendingImageCancellations.set(url.href, (pendingImageCancellations.get(url.href) || 0) + 1);
      } else report.assetFailures.push({ width, scenario: name, url: url.href, message });
    }
  });
  try {
    await page.clock.install({ time: initial });
    const response = await page.goto(origin + '/play/#daily', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.equal(response?.status(), 200, 'Candidate Arcade loads');
    await until(() => page.locator('[data-arcade-next-unlock]').count().then(count => count === 3), 'All three countdown cards mount');
    assert.equal(await page.evaluate(() => Boolean(localStorage.getItem('tree-arcade:daily-growth:session:v1')
      || sessionStorage.getItem('tree-arcade:daily-growth:session:v1'))), false, 'Review remains signed out');
    api.now = anchor;
    await page.clock.pauseAt(anchor);
    item.before = await assertCards(page, '2026-12');
    if (rollover) {
      api.now = anchor + 3000;
      await page.clock.runFor(3000);
      item.after = await assertCards(page, '2027-01');
      viewport.checks.monthRollover = true; viewport.checks.unknownBadges = true;
    } else {
      api.now = anchor + 1000;
      await page.clock.runFor(1000);
      item.after = await assertCards(page, '2026-12');
      for (const previous of item.before.cards) {
        const next = item.after.cards.find(card => card.type === previous.type);
        assert.equal(seconds(previous.timer) - seconds(next.timer), 1, 'The sole timer ticks once per second');
      }
      viewport.checks.ticking = true;
    }
    for (const placement of placements) {
      item.placements.push({ type: placement.type, layout: await choosePlacement(page, placement, width) });
    }
    await choosePlacement(page, placements[0], width);
    await screenshot(page, name + '-' + width + '.png');
    for (const asset of requiredAssets) assert.equal(served.get(asset), 200, 'Actual candidate source must load: ' + asset);
    item.servedAssets = Object.fromEntries(served);
    await verifyImageCancellations(page, context, pendingImageCancellations, item, width, name);
    for (const errors of [report.browserErrors, report.assetFailures, report.unexpectedWrites]) {
      assert.equal(errors.filter(error => error.width === width && error.scenario === name).length, 0, 'Scenario has browser/network errors');
    }
    for (const check of ['singleTimer', 'launchCopy', 'threePlacements', 'utcTargets', 'mobileLayout', 'noMissingAssets']) viewport.checks[check] = true;
    item.result = 'passed';
    console.log(`${width}px ${name}: passed`);
  } catch (error) {
    report.failures.push({ width, scenario: name, message: error.message, stack: error.stack });
    console.error(`${width}px ${name}: ${error.message}`);
  } finally {
    item.apiReads = api.calls;
    closing = true;
    await context.close();
  }
}

try {
  assert(!process.env.ARCADE_COUNTDOWN_LOCAL, 'Candidate review cannot substitute local assets');
  assert(process.env.ARCADE_COUNTDOWN_ORIGIN, 'Set the exact candidate origin');
  const target = new URL(process.env.ARCADE_COUNTDOWN_ORIGIN);
  assert.equal(target.protocol, 'https:'); assert.equal(target.pathname, '/');
  assert(!target.search && !target.hash && !target.username && !target.password);
  const dir = path.join(root, '.netlify/arcade-countdown');
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json')));
  const candidate = JSON.parse(fs.readFileSync(path.join(dir, 'candidate.json')));
  assert.match(plan.sourceCommit, /^[a-f0-9]{40}$/); assert.match(plan.sourceTree, /^[a-f0-9]{40}$/);
  assert.match(candidate.id, /^[a-f0-9]{24}$/);
  assert.equal(candidate.sourceCommit, plan.sourceCommit); assert.equal(candidate.planSha256, fingerprint(plan));
  assert(candidate.technicalVerifiedAt, 'Technical candidate verification must complete before browser review');
  origin = `https://${candidate.id}--tree-token.netlify.app`;
  assert.equal(target.origin, origin, 'Browser evidence must use the exact recorded candidate');
  Object.assign(report, { sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree,
    candidateId: candidate.id, planSha256: fingerprint(plan), origin });
  const modulePath = process.env.ARCADE_PLAYWRIGHT_MODULE
    || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
  const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
  browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE || undefined });
  for (const width of widths) {
    const viewport = { width, checks: Object.fromEntries(checkNames.map(name => [name, false])), scenarios: [] };
    report.viewports.push(viewport);
    for (const name of scenarioNames) await runScenario(viewport, name);
  }
  for (const check of checkNames) report.checks[check] = report.viewports.length === widths.length
    && report.viewports.every(viewport => viewport.checks[check]);
  if ([report.failures, report.browserErrors, report.assetFailures, report.unexpectedWrites].every(errors => errors.length === 0)
    && Object.values(report.checks).every(Boolean)
    && report.viewports.length === widths.length
    && report.viewports.every(viewport => viewport.scenarios.length === scenarioNames.length
      && viewport.scenarios.every((scenario, index) => scenario.name === scenarioNames[index] && scenario.result === 'passed'))) report.result = 'passed';
} catch (error) {
  report.failures.push({ message: error.message, stack: error.stack });
} finally {
  if (browser) await browser.close();
  report.checkedAt = new Date().toISOString();
  report.attemptedScenarioCount = report.viewports.reduce((count, viewport) => count + viewport.scenarios.length, 0);
  report.passedScenarioCount = report.viewports.reduce((count, viewport) => count + viewport.scenarios.filter(scenario => scenario.result === 'passed').length, 0);
  fs.writeFileSync(path.join(output, 'browser-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, origin: report.origin, checks: report.checks,
    expectedScenarioCount: report.expectedScenarioCount, attemptedScenarioCount: report.attemptedScenarioCount,
    passedScenarioCount: report.passedScenarioCount, failures: report.failures,
    browserErrors: report.browserErrors, assetFailures: report.assetFailures, unexpectedWrites: report.unexpectedWrites,
    verifiedImageCancellations: report.verifiedImageCancellations,
    replacementImageChecks: report.replacementImageChecks,
    screenshots: report.screenshots }, null, 2));
  if (report.result !== 'passed') process.exitCode = 1;
}
