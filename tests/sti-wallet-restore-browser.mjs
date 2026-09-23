import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const origin = new URL(process.env.STI_PREVIEW_URL).origin;
const scenarios = ['late-registration', 'forget-before-registration', 'choose-before-registration', 'forget-during-silent', 'choose-during-silent', 'coalesced-restore'];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let releaseModule;
    const held = new Promise(resolve => { releaseModule = resolve; });
    await page.route('**/@mysten/wallet-standard@*', route => route.fulfill({ contentType: 'text/javascript', body: `
      const wallets = [], listeners = [];
      window.testRegister = wallet => { wallets.push(wallet); for (const listener of listeners) listener(wallet); };
      export const getWallets = () => ({ get: () => wallets, on: (event, callback) => { if (event === 'register') listeners.push(callback); } });
      export const signAndExecuteTransaction = () => { throw Error('Signing forbidden in restoration tests'); };
    ` }));
    await page.route('**/@mysten/sui@*/grpc', route => route.fulfill({ contentType: 'text/javascript', body: 'export class SuiGrpcClient {}' }));
    await page.route('**/@mysten/sui@*/utils', route => route.fulfill({ contentType: 'text/javascript', body: 'export const fromBase64 = () => {}; export const toBase64 = () => {};' }));
    await page.route('**/*slush-wallet*', async route => {
      await held;
      await route.fulfill({ contentType: 'text/javascript', body: 'export const registerSlushWallet = () => window.testRegister(window.testSlushWallet);' });
    });
    await page.route('**/wallet-restore-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Wallet restoration test</title></head><body><script type="module" src="/scripts/wallet.js"></script></body></html>' }));
    await page.addInitScript(({ scenario }) => {
      window.testEvents = [];
      window.testSilentCalls = 0;
      window.testManualCalls = 0;
      const account = digit => ({ address: '0x' + digit.repeat(64), chains: ['sui:mainnet'], publicKey: new Uint8Array(32), features: ['sui:signAndExecuteTransaction'] });
      const makeWallet = (name, id, digit) => ({
        name, id, version: '1.0.0', chains: ['sui:mainnet'], accounts: [],
        features: {
          'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction: () => { throw Error('Signing forbidden'); } },
          'standard:connect': { version: '1.0.0', connect: async options => {
            if (options?.silent) {
              window.testSilentCalls++;
              if (scenario.includes('during-silent') || scenario === 'coalesced-restore') await new Promise(resolve => { window.testReleaseSilent = resolve; });
            } else window.testManualCalls++;
            return { accounts: [account(digit)] };
          } },
        },
      });
      window.testSlushWallet = makeWallet('Slush', 'com.mystenlabs.suiwallet.web', '1');
      window.testOtherWallet = makeWallet('Other Sui Wallet', 'other-test-wallet', '2');
      localStorage.setItem('tree:sui:address', account('1').address);
      localStorage.setItem('tree:sui:wallet-key', window.testSlushWallet.id);
      localStorage.setItem('tree:sui:wallet-name', 'Slush');
      localStorage.setItem('tree:sui:expiry', String(Date.now() + 60_000));
      window.addEventListener('tree:wallet-changed', event => window.testEvents.push(event.detail));
    }, { scenario });
    await page.goto(origin + '/wallet-restore-test.html');
    await page.waitForFunction(() => typeof window.initializeWallet === 'function');
    // The actual optional Slush module remains pending beyond initial discovery.
    assert.equal(await page.evaluate(() => window.initializeWallet()), null);
    await page.evaluate(() => { void window.openWalletManager(); });
    await page.locator('#treeWalletDialog[open]').waitFor({ timeout: 3000 });
    await page.keyboard.press('Escape');
    if (scenario === 'forget-before-registration') await page.evaluate(() => window.disconnectWallet());
    if (scenario === 'choose-before-registration') await page.evaluate(() => window.connectWallet(window.testOtherWallet));
    releaseModule();
    if (scenario.includes('during-silent') || scenario === 'coalesced-restore') {
      await page.waitForFunction(() => typeof window.testReleaseSilent === 'function');
      if (scenario === 'forget-during-silent') await page.evaluate(() => window.disconnectWallet());
      if (scenario === 'choose-during-silent') await page.evaluate(() => window.connectWallet(window.testOtherWallet));
      if (scenario === 'coalesced-restore') await page.evaluate(() => {
        window.testRestores = Promise.all([window.initializeWallet(), window.initializeWallet()]);
        window.testRegister(window.testOtherWallet);
      });
      await page.evaluate(() => window.testReleaseSilent());
    }
    // Await module evaluation and queued registry work, including cancellation.
    await page.evaluate(async () => { await import('https://esm.run/@mysten/slush-wallet@1.1.14'); await window.initializeWallet(); await window.testRestores; });
    const state = await page.evaluate(() => ({ name: window.currentWalletName || null, address: window.playerAddress || null, saved: localStorage.getItem('tree:sui:address'), silent: window.testSilentCalls, manual: window.testManualCalls, restored: window.testEvents.filter(e => e.reason === 'session-restored').length }));
    if (scenario.startsWith('forget')) {
      assert.equal(state.address, null); assert.equal(state.saved, null); assert.equal(state.restored, 0);
    } else if (scenario.startsWith('choose')) {
      assert.equal(state.name, 'Other Sui Wallet'); assert.equal(state.address, '0x' + '2'.repeat(64)); assert.equal(state.restored, 0); assert.equal(state.manual, 1);
    } else {
      assert.equal(state.name, 'Slush'); assert.equal(state.address, '0x' + '1'.repeat(64)); assert.equal(state.restored, 1); assert.equal(state.silent, 1);
    }
    assert.equal(state.silent, scenario.endsWith('before-registration') ? 0 : 1);
    console.log(JSON.stringify({ scenario, ...state }));
    await context.close();
  }
} finally { await browser.close(); }
