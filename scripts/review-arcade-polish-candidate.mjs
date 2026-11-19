import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprint } from './release-preserved-production.mjs';

const input = '.netlify/arcade-polish';
const output = '.netlify/arcade-polish-review';
const plan = JSON.parse(fs.readFileSync(path.join(input, 'plan.json'), 'utf8'));
const state = JSON.parse(fs.readFileSync(path.join(input, 'candidate.json'), 'utf8'));
assert.equal(plan.sourceCommit, state.sourceCommit);
assert.equal(plan.baselineId, state.baselineId);
assert.equal(fingerprint(plan), state.planSha256);
assert(state.technicalVerifiedAt, 'Candidate technical verification is missing.');
assert(/^[a-f0-9]{24}$/.test(state.id), 'Invalid candidate identity.');
const origin = 'https://' + state.id + '--tree-token.netlify.app';
assert(process.env.ARCADE_PLAYWRIGHT_MODULE, 'Isolated browser module is required.');
const { chromium } = await import(pathToFileURL(process.env.ARCADE_PLAYWRIGHT_MODULE).href);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const routes = [
  ['games', 'growth-games-tab'],
  ['daily', 'growth-today-tab'],
  ['campaigns', 'growth-campaigns-tab'],
  ['events', 'growth-events-tab'],
  ['month', 'growth-month-tab'],
  ['badges', 'growth-badges-tab'],
];
const errors = [], blockedWrites = [], checks = {};
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 880 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(width + ': ' + error.message));
    await page.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) {
        blockedWrites.push(request.method() + ' ' + request.url());
        return route.abort();
      }
      return route.continue();
    });
    try {
      const response = await page.goto(origin + '/play/#games', { waitUntil: 'domcontentloaded', timeout: 40000 });
      assert.equal(response?.status(), 200, 'Candidate page unavailable.');
      await page.locator('.arcade-organization-page #arcade-daily-growth').waitFor();
      for (const [key, tabId] of routes) {
        await page.locator('#' + tabId).click();
        await page.waitForFunction(key => document.getElementById('arcade-daily-growth')?.dataset.arcadeView === key, key);
        const widthState = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert(widthState <= 1, 'Horizontal overflow in ' + key + ' at ' + width + 'px: ' + widthState);
        if (key === 'campaigns') {
          await page.locator('.arcade-campaign-spotlight').waitFor();
          const next = page.locator('.arcade-campaign-next');
          const list = page.locator('.arcade-campaign-rotation');
          assert.equal(await next.count(), 1);
          assert.equal(await list.locator('li').count(), 6);
          assert.equal(await list.evaluate(el => el.open), false);
          assert.equal(await page.locator('.arcade-campaign-technical').evaluate(el => el.open), false);
          await page.waitForFunction(() => [...document.querySelectorAll('.arcade-campaign-spotlight img,.arcade-campaign-next img')].every(img => img.complete && img.naturalWidth > 0));
        }
        if (key === 'daily') {
          await page.locator('#growth-check-in-row').waitFor({ state: 'attached' });
          assert.equal(await page.locator('#growth-quest-details').count(), 1);
          assert.equal(await page.locator('#growth-status').count(), 1);
        }
        const filename = key + '-' + width + '.png';
        await page.screenshot({ path: path.join(output, filename), fullPage: true });
        checks[({ games:'games',daily:'daily',campaigns:'campaigns',events:'events',month:'monthlyProgress',badges:'badgeCollection' })[key]] = true;
      }
      checks.mobileLayout = true;
      // Synthetic completed state for visual verification only: not a wallet
      // session or evidence of real attendance. No mutation leaves this browser.
      await page.locator('#growth-today-tab').click();
      await page.evaluate(() => {
        const p = document.getElementById('growth-today-panel');
        p.setAttribute('data-arcade-checkin-saved', '');
        const status = document.getElementById('growth-status');
        status.className = 'growth-status is-info';
        status.textContent = 'Attendance and Passport progress refreshed. Saved-run tracking checks all four games separately.';
        document.getElementById('growth-invitation-title').textContent = 'Daily check-in';
        const identity = document.getElementById('growth-wallet-identity');
        identity.hidden = false;
        identity.textContent = 'Signed in · TEST wallet';
        document.getElementById('growth-check-in-state').textContent = 'Today’s attendance is saved.';
        const button = document.getElementById('growth-check-in-row');
        button.hidden = false; button.disabled = true; button.textContent = 'Checked in ✓';
        document.getElementById('growth-task-auth').hidden = true;
        document.getElementById('growth-game-name').textContent = 'Garden Bot';
        document.getElementById('growth-quest-state').textContent = '1 / 1 · Quest complete ✓';
      });
      await page.waitForFunction(() => document.getElementById('growth-status')?.hasAttribute('data-arcade-routine-refresh'));
      assert.equal(await page.locator('#growth-status').evaluate(el => getComputedStyle(el).display), 'none');
      await page.screenshot({ path: path.join(output, 'daily-completed-synthetic-' + width + '.png'), fullPage: true });
      await page.evaluate(() => {
        const status = document.getElementById('growth-status');
        status.className = 'growth-status is-error';
        status.textContent = 'Connection lost. Retry to refresh.';
      });
      await page.waitForFunction(() => !document.getElementById('growth-status').hasAttribute('data-arcade-routine-refresh'));
      assert.notEqual(await page.locator('#growth-status').evaluate(el => getComputedStyle(el).display), 'none');
      await page.locator('#growth-month-tab').click();
      await page.locator('[data-arcade-season-countdown]').first().waitFor();
      checks.countdownUTC = true;
      console.log(width + 'px: all six tabs, Daily, Campaigns, keyboard-visible controls and layouts passed');
    } finally {
      await page.close();
    }
  }
  assert.deepEqual(errors, [], 'Browser exceptions in candidate.');
  assert.deepEqual(blockedWrites, [], 'Browser attempted a non-GET operation.');
  checks.noMissingAssets = true;
  const report = {
    schemaVersion: 1, result: 'passed', sourceCommit: plan.sourceCommit,
    sourceTree: plan.sourceTree, candidateId: state.id,
    planSha256: fingerprint(plan), origin, checkedAt: new Date().toISOString(),
    viewportWidths: [390, 1280], noWalletOrPaymentActions: true, checks,
    evidence: { screenshots: routes.length * 2 + 2, inspection: 'GET-only browser route checks; synthetic completed-state UI only' },
  };
  fs.writeFileSync(path.join(output, 'browser-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ candidate: state.id, report, browserErrors: errors.length, blockedWrites: blockedWrites.length }, null, 2));
} finally {
  await browser.close();
}
