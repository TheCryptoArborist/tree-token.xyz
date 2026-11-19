import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startPilotPreviewServer } from '../scripts/arcade-campaigns/pilot-preview-server.mjs';

// Browser tooling is supplied by the test runtime/CI, never a production dep.
const modulePath = process.env.ARCADE_PILOT_BROWSER_MODULE;
const { chromium } = await import(modulePath ? (modulePath.startsWith('file:') ? modulePath : pathToFileURL(path.resolve(modulePath)).href) : 'playwright');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_PILOT_CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] }); });
after(async () => { await browser?.close(); });

async function scenario(run, { width = 1440, fixtureOptions, beforePage, signedOut = false } = {}) {
  const server = await startPilotPreviewServer({ fixtureOptions });
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [], externalRequests = [], unexpectedActions = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && !(
      url.pathname === '/api/arcade-challenge-pilot' && ['configuration', 'start', 'status', 'move'].includes(url.searchParams.get('action')) ||
      url.pathname === '/api/arcade-growth' && ['challenge', 'session'].includes(url.searchParams.get('action'))
    )) unexpectedActions.push(url.pathname + url.search);
  });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === server.origin) return route.continue();
    externalRequests.push(route.request().url()); return route.abort();
  });
  const control = async action => {
    const response = await fetch(server.origin + '/__fixture/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    assert.equal(response.status, 200); return response.json();
  };
  const inspection = async () => (await fetch(server.origin + '/__fixture/inspection')).json();
  try {
    await beforePage?.({ page, context, server });
    await page.goto(server.url + (signedOut ? '&fixture=signed-out' : ''));
    await run({ page, context, server, control, inspection, width });
    assert.deepEqual(pageErrors, [], 'No uncaught browser errors.');
    assert.deepEqual(externalRequests, [], 'The isolated fixture makes no external requests.');
    assert.deepEqual(unexpectedActions, [], 'The page invokes no check-in, attendance, vote, payment or other API action.');
  } finally { await context.close(); await server.close(); }
}

const phase = (page, expected, timeout = 10000) => page.waitForFunction(value => document.querySelector('#arcade-challenge')?.dataset.phase === value, expected, { timeout });
const action = (page, name) => page.locator(`#challenge-${name}`);
const move = (page, id) => page.locator(`[data-move-id="${id}"]`);
async function start(page) { await phase(page, 'ready'); await action(page, 'start').click(); await phase(page, 'playing'); }
async function play(page, id, expected = 'playing') {
  await Promise.all([page.waitForResponse(response => response.url().includes('/api/arcade-challenge-pilot?action=move')), move(page, id).click()]);
  await phase(page, expected);
}
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No document-wide horizontal overflow.'); }
async function screenshot(page, file) {
  const output = process.env.ARCADE_PILOT_QA_OUTPUT;
  if (!output) return;
  await fs.mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, file), fullPage: true });
}
async function screenshotWidths(page, label) {
  const original = page.viewportSize();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
    await screenshot(page, `pilot-${width}-${label}.png`);
  }
  await page.setViewportSize(original);
}

for (const width of [1440, 390, 320]) test(`actual pilot page plays a four-card win at ${width}px`, () => scenario(async ({ page, inspection }) => {
  await phase(page, 'ready');
  assert.match(await page.locator('body').innerText(), /Test challenge\s*[—–-]\s*no prizes/i);
  assert.equal((await inspection()).attempts.length, 0, 'Restoring a session never starts an attempt.');
  await noOverflow(page);
  await screenshot(page, `pilot-${width}-ready.png`);
  await action(page, 'start').focus();
  assert.equal(await action(page, 'start').evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Enter'); await phase(page, 'playing');
  assert.equal(await page.locator('[data-move-id]').count(), 4);
  await noOverflow(page); await screenshot(page, `pilot-${width}-playing.png`);
  await play(page, 19);
  assert.match(await page.locator('#challenge-round-log li').first().innerText(), /^You/);
  assert.equal(await move(page, 19).isDisabled(), true, 'Previous card cannot be repeated.');
  await play(page, 27); await play(page, 19, 'finished');
  const evidence = await inspection();
  assert.deepEqual(evidence.attempts.map(row => row.moves), [[19, 27, 19]]);
  assert.equal(evidence.requestCount, 3);
  assert.match(await page.locator('#arcade-challenge').innerText(), /16[,.]?375/);
  assert.equal(await page.locator('[data-move-id]:enabled').count(), 0);
  await noOverflow(page); await screenshot(page, `pilot-${width}-finished.png`);
}, { width }));

test('synthetic signed-out flow requires explicit wallet and message actions before playing', () => scenario(async ({ page, inspection }) => {
  await phase(page, 'signed-out');
  await screenshotWidths(page, 'signed-out');
  assert.equal((await inspection()).attempts.length, 0);
  await action(page, 'sign-in').click();
  const wallet = page.getByRole('button', { name: /Local test wallet/ });
  if (await wallet.isVisible()) await wallet.click();
  await phase(page, 'ready');
  assert.equal((await inspection()).attempts.length, 0, 'Signing in does not start the game.');
  await start(page);
  assert.equal((await inspection()).attempts.length, 1);
}, { signedOut: true }));

test('same-session reload resumes the exact committed match and does not create a new attempt', () => scenario(async ({ page, inspection }) => {
  await start(page); await play(page, 19);
  await page.reload(); await phase(page, 'playing');
  assert.equal(await move(page, 19).isDisabled(), true);
  assert.equal((await inspection()).attempts.length, 1);
  await play(page, 27); await play(page, 19, 'finished');
  await page.reload(); await phase(page, 'finished');
  assert.deepEqual((await inspection()).attempts.map(row => row.moves), [[19, 27, 19]]);
}));

test('lost committed response persists the pending request and reload retries it exactly once', () => scenario(async ({ page, control, inspection }) => {
  await start(page); await control('drop-next-move-response');
  await move(page, 19).click(); await phase(page, 'pending');
  assert.equal(await page.locator('[data-move-id]:enabled').count(), 0);
  assert.equal((await inspection()).requestCount, 1);
  await screenshotWidths(page, 'interrupted');
  await page.reload(); await phase(page, 'playing');
  const evidence = await inspection();
  assert.equal(evidence.requestCount, 1, 'Retry must not append another action.');
  const requests = evidence.log.filter(row => row.action === 'move');
  assert.equal(requests.length, 2); assert.deepEqual(requests[1], requests[0], 'UUID, version and card survive reload unchanged.');
  await play(page, 27); await play(page, 19, 'finished');
  assert.equal((await inspection()).requestCount, 3);
}));

test('failed request before commit can be retried from the visible retry control', () => scenario(async ({ page, control, inspection }) => {
  await start(page); await control('fail-next-move');
  await move(page, 19).click(); await phase(page, 'pending');
  assert.equal((await inspection()).requestCount, 0);
  await action(page, 'retry').click(); await phase(page, 'playing');
  const evidence = await inspection();
  assert.equal(evidence.requestCount, 1);
  const requests = evidence.log.filter(row => row.action === 'move');
  assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
}));

test('a new session on the same wallet does not silently resume the old session-bound attempt', () => scenario(async ({ page, control, inspection }) => {
  await start(page); await play(page, 19);
  const { session } = await control('new-session');
  await page.evaluate(value => localStorage.setItem('tree-arcade:daily-growth:session:v1', JSON.stringify(value)), session);
  await page.reload(); await phase(page, 'session-changed');
  await screenshotWidths(page, 'session-changed');
  assert.equal(await page.locator('[data-move-id]:enabled').count(), 0);
  assert.equal((await inspection()).attempts.length, 1);
  await action(page, 'start').click(); await phase(page, 'playing');
  assert.equal((await inspection()).attempts.length, 2);
}));

test('exclusive attempt expiry disables new moves and persists through reload', () => scenario(async ({ page, inspection }) => {
  await start(page);
  await phase(page, 'expired', 15000);
  assert.equal(await page.locator('[data-move-id]:enabled').count(), 0);
  assert.equal((await inspection()).requestCount, 0);
  await page.reload(); await phase(page, 'expired');
  await screenshotWidths(page, 'expired');
}, { fixtureOptions: { endOffsetMs: 8000 } }));

test('disabled pilot stays closed and creates no attempt', () => scenario(async ({ page, inspection }) => {
  await phase(page, 'closed');
  await screenshotWidths(page, 'closed');
  assert.equal(await action(page, 'start').isEnabled(), false);
  assert.equal((await inspection()).attempts.length, 0);
}, { fixtureOptions: { pilotStatus: 'disabled' } }));

test('unavailable attempt storage blocks starting instead of losing resume information', () => scenario(async ({ page, inspection }) => {
  await page.waitForFunction(() => document.querySelector('#arcade-challenge')?.dataset.phase !== 'loading');
  assert.equal(await action(page, 'start').isEnabled(), false);
  assert.match(await page.locator('#arcade-challenge').innerText(), /storage|save.*browser|browser.*save/i);
  assert.equal((await inspection()).attempts.length, 0);
}, { beforePage: async ({ page }) => page.addInitScript(() => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (String(key).startsWith('tree-arcade:challenge-pilot')) throw new DOMException('Fixture storage blocked.', 'QuotaExceededError');
    return original.call(this, key, value);
  };
}) }));

test('revoked cached sign-in can be renewed without attempting to reuse its old match', () => scenario(async ({ page, control, inspection }) => {
  await start(page); await control('revoke-session');
  await action(page, 'refresh').click(); await phase(page, 'signed-out');
  // Exercise the cached-token restoration path after its controller timer runs.
  await page.waitForTimeout(1200);
  await action(page, 'sign-in').click(); await phase(page, 'session-changed');
  const evidence = await inspection();
  assert.equal(evidence.log.filter(row => row.scope === 'synthetic-auth' && row.action === 'challenge').length, 1);
  assert.equal(evidence.log.filter(row => row.scope === 'synthetic-auth' && row.action === 'session').length, 1);
  assert.equal(evidence.attempts.length, 1);
  await action(page, 'start').click(); await phase(page, 'playing');
  assert.equal((await inspection()).attempts.length, 2);
}));
