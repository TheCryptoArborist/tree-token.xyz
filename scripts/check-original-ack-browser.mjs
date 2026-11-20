import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

assert(process.argv[2], 'Pass the installed Playwright module path.');
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = process.cwd();
const pagePath = '/play/multichaintest/original/sui/ack/';
const vendorPath = '/play/multichaintest/setup/sui/ack/wallet-vendor.js';
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
  const file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const bytes = fs.readFileSync(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [], moduleFailures = [], loadedModules = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (!pathname.endsWith('.js')) return;
      if (response.ok()) loadedModules.add(pathname);
      else moduleFailures.push({ path: pathname, status: response.status() });
    });
    const response = await page.goto('http://127.0.0.1:' + server.address().port + pagePath);
    assert(response?.ok(), 'Acknowledgement page did not load.');
    await page.waitForFunction(() => document.getElementById('expected')?.textContent.startsWith('0x'));
    assert.equal(await page.locator('#expected').innerText(), '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4');
    assert(await page.locator('#connect-wallet').isVisible(), 'Wallet connection control is missing.');
    assert(await page.locator('#receipt-input').isVisible(), 'Receipt recovery input is missing.');
    assert(await page.locator('#check-receipt').isVisible(), 'Receipt recovery control is missing.');
    assert(await page.locator('#quote').isDisabled(), 'Disconnected wallet must not obtain a signing quote.');
    assert(await page.locator('#configure').isDisabled(), 'Disconnected signing must be blocked.');
    assert(await page.locator('#reviewed').isDisabled(), 'Consent must require a fresh quote.');
    await page.locator('#reviewed').evaluate(input => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert(await page.locator('#configure').isDisabled(), 'Consent alone must never enable signing.');
    await page.locator('#connect-wallet').click();
    assert.match(await page.locator('#status').innerText(), /Slush.*not.*detected|no.*(?:wallet|extension)/i);
    assert(await page.locator('#wallet-help').isVisible(), 'Missing-extension help must remain available.');
    assert(await page.locator('#quote').isDisabled());
    assert(await page.locator('#configure').isDisabled());
    await page.locator('#receipt-input').fill('A'.repeat(44));
    assert.equal(await page.locator('#receipt-input').inputValue(), 'A'.repeat(44), 'Recovery digest entry is unusable.');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow at ' + width);
    assert(loadedModules.has(vendorPath), 'The existing wallet module was not loaded.');
    assert(loadedModules.has(pagePath + 'core.js'), 'The reviewed acknowledgement core was not loaded.');
    assert.deepEqual(moduleFailures, [], 'A browser module failed to load.');
    assert.deepEqual(errors, [], 'Page errors occurred.');
    console.log(JSON.stringify({
      width, loaded: true, errors, moduleFailures, overflow: false,
      connectionAndRecoveryVisible: true, preservedWalletModuleLoaded: true,
      disconnectedSigningBlocked: true, installedExtensionVerified: false,
    }));
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
