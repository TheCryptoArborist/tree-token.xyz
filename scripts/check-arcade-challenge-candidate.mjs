import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fingerprint } from './release-preserved-production.mjs';

const directory = '.netlify/arcade-challenge';
const plan = JSON.parse(await fs.readFile(path.join(directory, 'plan.json'), 'utf8'));
const candidate = JSON.parse(await fs.readFile(path.join(directory, 'candidate.json'), 'utf8'));
assert(/^[a-f0-9]{24}$/.test(candidate.id));
assert.equal(candidate.planSha256, fingerprint(plan));
assert(candidate.technicalVerifiedAt, 'Finish the technical candidate verification first.');
const origin = `https://${candidate.id}--tree-token.netlify.app`;
const modulePath = process.env.ARCADE_PILOT_BROWSER_MODULE;
assert(modulePath, 'Use the isolated CI browser runtime.');
const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
const output = process.env.ARCADE_PILOT_CANDIDATE_OUTPUT;
assert(output, 'Choose an evidence directory outside the bounded release artifact.');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const widths = [1440, 390, 320], postRequests = [], errors = [];
const screenshots = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().method() !== 'GET' && route.request().method() !== 'HEAD') {
        postRequests.push(route.request().url()); return route.abort();
      }
      return route.continue();
    });
    async function layout() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Document overflow at ' + width);
      const broken = await page.locator('img').evaluateAll(images => images.filter(image => image.getClientRects().length && (!image.complete || !image.naturalWidth)).map(image => image.getAttribute('src')));
      assert.deepEqual(broken, [], 'Visible images must load.');
    }
    await page.goto(origin + '/play/challenge/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#arcade-challenge')?.dataset.phase === 'signed-out');
    const body = await page.locator('body').innerText();
    assert.match(body, /Test challenge\s*[—–-]\s*no prizes/i);
    assert.match(body, /Free entry/); assert.match(body, /No purchase or NFTree required/);
    await layout();
    await page.locator('#challenge-sign-in').focus();
    assert(await page.locator('#challenge-sign-in').evaluate(element => document.activeElement === element));
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.activeElement !== document.body && getComputedStyle(document.activeElement).outlineStyle !== 'none'), 'Keyboard focus must be visible.');
    const file = `pilot-candidate-${width}.png`; await page.screenshot({ path: path.join(output, file), fullPage: true }); screenshots.push(file);
    await page.locator('.challenge-back').click();
    await page.waitForURL(url => url.hash === '#campaigns');
    const entry = page.locator('.arcade-campaign-pilot'); await entry.waitFor({ state: 'visible' });
    assert.match(await entry.innerText(), /NO PRIZES/);
    assert.equal(await entry.locator('a').getAttribute('href'), '/play/challenge/');
    await layout();
    const campaign = `campaign-pilot-${width}.png`; await page.screenshot({ path: path.join(output, campaign), fullPage: true }); screenshots.push(campaign);
    await context.close();
  }
  assert.deepEqual(postRequests, [], 'Candidate review must not send wallet, progress or payment actions.');
  assert.deepEqual(errors, [], 'Candidate has uncaught browser errors.');
  const response = await fetch(origin + '/api/arcade-challenge-pilot?action=configuration');
  assert.equal(response.status, 403); assert.equal((await response.json()).error, 'origin-not-allowed');
  const report = { schemaVersion: 1, result: 'passed', checkedAt: new Date().toISOString(), sourceCommit: plan.sourceCommit,
    sourceTree: plan.sourceTree, candidateId: candidate.id, planSha256: fingerprint(plan), origin,
    noWalletOrPaymentActions: true, viewportWidths: widths,
    checks: { pilotPage: true, campaignLink: true, mobileLayout: true, keyboardFocus: true, noMissingAssets: true, noPrizeLabel: true, previewOriginBlocked: true },
    screenshots, boundary: 'Signed-out exact-candidate review. Play/recovery are exercised separately against the real local service using synthetic sessions; canonical signed-message testing follows publication.' };
  await fs.writeFile(path.join(output, 'arcade-challenge-browser-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
