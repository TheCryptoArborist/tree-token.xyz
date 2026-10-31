// Isolated DOM tests of the real page, controller, and core; no browser or network.
// Install jsdom@26.1.0 outside the project, then run:
// ARCADE_DOM_TEST_DEPS=/tmp/tree-arcade-ui-testdeps node --experimental-vm-modules tests/arcade-nftree-access-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { SourceTextModule } from 'node:vm';
import {
  NFTREE_COLLECTION_PACKAGE, NFTREE_COLLECTION_TYPE, NFTREE_PURCHASE_PACKAGE,
  NFTREE_MINT_CONFIG, NFTREE_POOL_IDS, NFTREE_NETWORK,
} from '../scripts/arcade-nftree-access-core.mjs';

const require = createRequire(resolve(process.env.ARCADE_DOM_TEST_DEPS || '/tmp/tree-arcade-ui-testdeps', 'package.json'));
const { JSDOM, VirtualConsole } = require('jsdom');
const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'play/index.html'), 'utf8');
const coreSource = readFileSync(resolve(root, 'scripts/arcade-nftree-access-core.mjs'), 'utf8');
const controllerSource = readFileSync(resolve(root, 'scripts/arcade-nftree-access.js'), 'utf8');
const STORAGE_KEY = 'tree-arcade:nftree-mint:pending:v1';
const ACCOUNT = `0x${'a'.repeat(64)}`;
const OTHER_ACCOUNT = `0x${'b'.repeat(64)}`;
const NFT = `0x${'c'.repeat(64)}`;
const DIGEST = 'Ej9Wyaf8fWyLUf9sBAwu65wn2QWaVZYWkeY5DtfqyRvA';
const deferred = () => {
  let resolvePromise;
  let reject;
  const promise = new Promise((done, fail) => { resolvePromise = done; reject = fail; });
  return { promise, resolve: resolvePromise, reject };
};
const pendingRecord = (overrides = {}) => ({
  version: 1, network: NFTREE_NETWORK, digest: DIGEST, walletName: 'Test wallet',
  accountAddress: ACCOUNT, poolId: NFTREE_POOL_IDS[0], mintPriceMist: '25000000000',
  createdAt: Date.now(), status: 'submitted', ...overrides,
});
const inventoryResponse = (overrides = {}) => ({
  collectionPackageId: NFTREE_COLLECTION_PACKAGE, latestPackageId: NFTREE_PURCHASE_PACKAGE,
  mintConfigId: NFTREE_MINT_CONFIG, mintPriceMist: '25000000000', totalAvailable: 8,
  activePoolId: NFTREE_POOL_IDS[0], source: 'sui-grpc', fetchedAt: new Date().toISOString(),
  pools: NFTREE_POOL_IDS.map((poolId) => ({ poolId, count: 2 })), ...overrides,
});

async function settleUntil(predicate, label) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (predicate()) return;
    await new Promise((done) => setImmediate(done));
  }
  assert.fail(`Controller did not reach: ${label}`);
}

async function createHarness(t, options = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM(html, { url: 'https://tree-token.xyz/play/', runScripts: 'outside-only', virtualConsole });
  t.after(() => { dom.window.close(); assert.deepEqual(errors.map((error) => error.message), [], 'No uncaught DOM errors'); });
  const { window } = dom;
  const document = window.document;
  const byId = (id) => document.getElementById(id);
  const calls = [];
  if (!options.noLocks) Object.defineProperty(window.navigator, 'locks', { value: {
    async request(name, lockOptions, callback) {
      calls.push({ type: 'lock', name, options: lockOptions });
      return callback(options.lockUnavailable ? null : { name });
    },
  } });
  const records = options.records || new Map();
  if (options.pending) records.set(STORAGE_KEY, JSON.stringify(options.pending));
  const storageFaults = { read: false, write: false, remove: false, ...options.storageFaults };
  const storage = {
    getItem(key) { if (storageFaults.read) throw new Error('Storage unavailable'); return records.get(key) ?? null; },
    setItem(key, value) {
      if (storageFaults.write) throw new Error('Storage write failed');
      records.set(key, String(value));
      calls.push({ type: 'persist', record: JSON.parse(String(value)) });
    },
    removeItem(key) { if (storageFaults.remove) throw new Error('Storage removal failed'); records.delete(key); calls.push({ type: 'clear' }); },
  };
  Object.defineProperty(window, 'localStorage', { value: storage });
  window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  let inventoryOverrides = {};
  let nextFetch = null;
  window.fetch = async (url, args) => {
    calls.push({ type: 'inventory', url, args });
    assert.match(url, /^https:\/\/nftree\.net\/api\/nftree-sale-pools\?t=/);
    assert.equal(args.method, 'GET');
    assert.equal(args.credentials, 'omit');
    assert.equal(args.cache, 'no-store');
    const response = nextFetch;
    nextFetch = null;
    const payload = response ? await response.promise : inventoryResponse(inventoryOverrides);
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(payload) };
  };
  let connected = false;
  let activeAccount = ACCOUNT;
  let changeListener = null;
  let mintImpl = options.mint || (async () => ({ digest: DIGEST }));
  let receiptImpl = options.receipt || (async (expected) => ({
    ...expected, status: 'confirmed', nftObjectId: NFT, nftType: NFTREE_COLLECTION_TYPE,
  }));
  const wallet = {
    availableWallets: () => options.noWallet ? [] : [{ name: 'Test wallet' }],
    onWalletsChanged: () => () => {},
    async connectWallet({ walletName }) {
      calls.push({ type: 'connect', walletName });
      connected = true;
      return { walletName, account: activeAccount };
    },
    getConnectedWalletState({ accountAddress }) {
      const matches = connected && activeAccount === accountAddress;
      return { accountExists: matches, canSign: matches, accountAddress: matches ? activeAccount : '' };
    },
    onConnectedWalletChange(_connection, listener) {
      changeListener = listener;
      return () => { if (changeListener === listener) changeListener = null; };
    },
    async disconnectWallet() { calls.push({ type: 'disconnect' }); connected = false; },
    async getSuiBalance({ accountAddress }) {
      calls.push({ type: 'balance', accountAddress });
      return { accountAddress, balanceMist: '100000000000' };
    },
    async mintWithConnectedWallet(args) {
      args.assertBeforeSign();
      const pending = JSON.parse(records.get(STORAGE_KEY));
      assert.equal(pending.status, 'awaiting-wallet', 'Durable intent precedes wallet signing');
      assert.equal(pending.accountAddress, args.accountAddress);
      calls.push({ type: 'mint', accountAddress: args.accountAddress });
      return mintImpl(args);
    },
    async confirmMintReceipt(expected) {
      const pending = JSON.parse(records.get(STORAGE_KEY));
      assert.equal(pending.digest, expected.digest, 'Durable digest precedes receipt lookup');
      calls.push({ type: 'receipt', expected });
      return receiptImpl(expected);
    },
  };
  const append = document.head.append.bind(document.head);
  document.head.append = (...nodes) => {
    append(...nodes);
    for (const node of nodes) {
      if (node.tagName !== 'SCRIPT') continue;
      assert.equal(node.getAttribute('src'), '/assets/arcade/nftree-wallet-mint.js');
      calls.push({ type: 'bridge' });
      queueMicrotask(() => {
        if (options.bridgeError) node.dispatchEvent(new window.Event('error'));
        else { window.NFTreeWalletMint = wallet; node.dispatchEvent(new window.Event('load')); }
      });
    }
  };
  const context = dom.getInternalVMContext();
  const core = new SourceTextModule(coreSource, { context, identifier: 'arcade-nftree-access-core.mjs' });
  const controller = new SourceTextModule(controllerSource, { context, identifier: 'arcade-nftree-access.js' });
  await controller.link((specifier) => {
    assert.equal(specifier, './arcade-nftree-access-core.mjs');
    return core;
  });
  await controller.evaluate();
  const count = (type) => calls.filter((call) => call.type === type).length;
  const click = (id) => byId(id).click();
  const status = () => byId('nftree-mint-status').textContent;
  const saved = () => records.has(STORAGE_KEY) ? JSON.parse(records.get(STORAGE_KEY)) : null;
  const open = async () => {
    document.querySelector('.suite-primary[data-nftree-mint]').click();
    await settleUntil(() => byId('nftree-mint-price').textContent === '25 SUI' &&
      (byId('nftree-wallet-options').children.length > 0 || byId('nftree-no-wallet').hidden === false ||
        status().includes('saved purchase record') || status().includes('could not load') || saved()), 'open panel settled');
  };
  const connect = async () => {
    byId('nftree-wallet-options').querySelector('button').click();
    await settleUntil(() => !byId('nftree-review-button').disabled, 'connected and ready to review');
  };
  const review = async () => {
    click('nftree-review-button');
    await settleUntil(() => !byId('nftree-purchase-review').hidden, 'purchase quote visible');
  };
  const acknowledge = () => {
    byId('nftree-purchase-ack').checked = true;
    byId('nftree-purchase-ack').dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  return { window, document, byId, calls, count, click, status, saved, records, storageFaults,
    open, connect, review, acknowledge,
    inventory(change) { inventoryOverrides = change; },
    deferNextFetch() { const gate = deferred(); nextFetch = gate; return gate; },
    setReceipt(next) { receiptImpl = next; },
    setMint(next) { mintImpl = next; },
    changeAccount(account = OTHER_ACCOUNT) {
      activeAccount = account; connected = Boolean(account);
      changeListener?.({ connected, account, walletName: 'Test wallet' });
    },
    storageEvent(record) {
      if (record) records.set(STORAGE_KEY, JSON.stringify(record)); else records.delete(STORAGE_KEY);
      const event = new window.Event('storage');
      Object.defineProperty(event, 'key', { value: STORAGE_KEY });
      window.dispatchEvent(event);
    },
  };
}

test('the page loads no wallet bundle, inventory, connection, or signing before an ordinary mint click', async (t) => {
  const h = await createHarness(t);
  assert.equal(h.byId('nftree-mint-panel').hidden, true);
  assert.deepEqual(h.calls, []);
  assert.equal(h.document.querySelector('script[src="/assets/arcade/nftree-wallet-mint.js"]'), null);
  const trigger = h.document.querySelector('.suite-primary[data-nftree-mint]');
  assert.equal(trigger.href, 'https://nftree.net/mint#mint');
  // Block jsdom's unimplemented navigation after the real controller has seen
  // this auxiliary click; leaving the panel closed is the behavior under test.
  trigger.addEventListener('click', (event) => event.preventDefault(), { once: true });
  trigger.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 1 }));
  assert.deepEqual(h.calls, []);
  await h.open();
  assert.equal(h.count('bridge'), 1);
  assert.equal(h.count('inventory'), 1);
  assert.equal(h.count('connect'), 0);
  assert.equal(h.count('mint'), 0);
  assert.equal(h.byId('nftree-review-button').disabled, true);
});

test('connect, review, acknowledgement, and signing are separate; repeated clicks never resubmit', async (t) => {
  const signing = deferred();
  const receipt = deferred();
  const h = await createHarness(t, { mint: () => signing.promise, receipt: () => receipt.promise });
  await h.open();
  await h.connect();
  assert.equal(h.count('connect'), 1);
  assert.equal(h.count('mint'), 0);
  assert.equal(h.byId('nftree-purchase-review').hidden, true);
  await h.review();
  assert.equal(h.count('mint'), 0);
  assert.equal(h.byId('nftree-purchase-button').disabled, true);
  assert.match(h.byId('nftree-review-copy').textContent, /1 NFTree · 25 SUI/);
  assert.match(h.byId('nftree-review-copy').textContent, /Maximum total: 25\.12 SUI/);
  assert.ok(h.byId('nftree-review-copy').textContent.includes(ACCOUNT));
  h.click('nftree-purchase-button');
  assert.equal(h.count('mint'), 0);
  h.acknowledge();
  h.click('nftree-purchase-button');
  await settleUntil(() => h.count('mint') === 1, 'wallet signing requested');
  assert.equal(h.saved().digest, null);
  assert.equal(h.byId('nftree-mint-close').disabled, true);
  h.click('nftree-purchase-button');
  assert.equal(h.count('mint'), 1);
  signing.resolve({ digest: DIGEST });
  await settleUntil(() => h.count('receipt') === 1, 'receipt verification requested');
  assert.equal(h.saved().status, 'submitted');
  assert.equal(h.saved().digest, DIGEST);
  assert.doesNotMatch(h.byId('nftree-mint-result').textContent, /Your NFTree is ready/);
  receipt.resolve({ status: 'confirmed', digest: DIGEST, accountAddress: ACCOUNT,
    poolId: NFTREE_POOL_IDS[0], nftObjectId: NFT, nftType: NFTREE_COLLECTION_TYPE });
  await settleUntil(() => h.byId('nftree-mint-result').textContent.includes('Your NFTree is ready.'), 'confirmed receipt displayed');
  assert.equal(h.saved(), null);
  assert.equal(h.count('mint'), 1);
  assert.match(h.byId('nftree-mint-result').textContent, new RegExp(ACCOUNT));
});

test('a changed price replaces the quote, clears acknowledgement, and never opens the wallet', async (t) => {
  const h = await createHarness(t);
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  h.inventory({ mintPriceMist: '26000000000' });
  h.click('nftree-purchase-button');
  await settleUntil(() => h.status().includes('price or active pool changed'), 'changed quote requires review');
  assert.equal(h.count('mint'), 0);
  assert.equal(h.saved(), null);
  assert.equal(h.byId('nftree-purchase-ack').checked, false);
  assert.equal(h.byId('nftree-purchase-button').disabled, true);
  assert.match(h.byId('nftree-review-copy').textContent, /1 NFTree · 26 SUI/);
  assert.match(h.byId('nftree-review-copy').textContent, /Maximum total: 26\.12 SUI/);
});

test('closing and reopening invalidates the previous acknowledgement and quote', async (t) => {
  const h = await createHarness(t);
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  h.click('nftree-mint-close');
  assert.equal(h.byId('nftree-mint-panel').hidden, true);
  await h.open();
  await settleUntil(() => !h.byId('nftree-review-button').disabled, 'fresh review required after reopening');
  assert.equal(h.count('bridge'), 1);
  assert.equal(h.byId('nftree-purchase-review').hidden, true);
  assert.equal(h.byId('nftree-purchase-ack').checked, false);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  assert.equal(h.count('mint'), 0);
});

test('a restored submitted purchase exposes status checks only and never reconnects or signs', async (t) => {
  const h = await createHarness(t, { noLocks: true, pending: pendingRecord(), receipt: async (expected) => ({ ...expected, status: 'pending' }) });
  await h.open();
  assert.equal(h.count('connect'), 0);
  assert.equal(h.count('receipt'), 0);
  assert.equal(h.byId('nftree-wallet-options').hidden, true);
  assert.equal(h.byId('nftree-review-button').hidden, true);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  assert.equal(h.byId('nftree-check-button').hidden, false);
  assert.equal(h.byId('nftree-digest-entry').hidden, true);
  assert.equal(h.document.querySelector('.mint-fallback:last-child').hidden, true);
  h.click('nftree-check-button');
  await settleUntil(() => h.count('receipt') === 1 && !h.byId('nftree-check-button').disabled, 'status read completed');
  assert.equal(h.saved().digest, DIGEST);
  assert.equal(h.count('mint'), 0);
  assert.equal(h.count('connect'), 0);
  assert.match(h.status(), /not yet verified/);
});

test('a restored uncertain wallet response validates a manually supplied digest without purchasing', async (t) => {
  const h = await createHarness(t, { pending: pendingRecord({ digest: null, status: 'awaiting-wallet' }),
    receipt: async (expected) => ({ ...expected, status: 'pending' }) });
  await h.open();
  assert.equal(h.byId('nftree-digest-entry').hidden, false);
  h.byId('nftree-transaction-digest').value = 'wrong';
  h.click('nftree-check-button');
  await settleUntil(() => h.status().includes('exact Sui transaction digest'), 'invalid recovery digest rejected');
  assert.equal(h.count('receipt'), 0);
  h.byId('nftree-transaction-digest').value = DIGEST;
  h.click('nftree-check-button');
  await settleUntil(() => h.count('receipt') === 1 && !h.byId('nftree-check-button').disabled, 'recovery receipt read completed');
  assert.equal(h.saved().digest, DIGEST);
  assert.equal(h.saved().digestSource, 'manual');
  assert.equal(h.count('mint'), 0);
  assert.equal(h.count('connect'), 0);
  assert.equal(h.byId('nftree-digest-entry').hidden, false);
  assert.equal(h.byId('nftree-transaction-digest').value, DIGEST);
});

test('a well-formed but wrong manual digest remains editable and correction only checks the original purchase', async (t) => {
  const wrongDigest = '1'.repeat(32);
  const h = await createHarness(t, { noLocks: true,
    pending: pendingRecord({ digest: null, status: 'awaiting-wallet' }),
    receipt: async (expected) => ({ ...expected, status: 'pending', reason: 'PURCHASE_SCOPE_MISMATCH' }),
  });
  await h.open();
  h.byId('nftree-transaction-digest').value = wrongDigest;
  h.click('nftree-check-button');
  await settleUntil(() => h.count('receipt') === 1 && !h.byId('nftree-check-button').disabled, 'wrong manual receipt remains unresolved');
  assert.equal(h.saved().digest, wrongDigest);
  assert.equal(h.saved().digestSource, 'manual');
  assert.equal(h.byId('nftree-digest-entry').hidden, false);
  assert.equal(h.byId('nftree-review-button').hidden, true);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  h.setReceipt(async (expected) => ({ ...expected, status: 'confirmed', nftObjectId: NFT, nftType: NFTREE_COLLECTION_TYPE }));
  h.byId('nftree-transaction-digest').value = DIGEST;
  h.click('nftree-check-button');
  await settleUntil(() => h.byId('nftree-mint-result').textContent.includes('Your NFTree is ready.'), 'corrected receipt verified');
  const lookedUp = h.calls.filter((call) => call.type === 'receipt').map((call) => call.expected.digest);
  assert.deepEqual(lookedUp, [wrongDigest, DIGEST]);
  assert.equal(h.saved(), null);
  assert.equal(h.count('mint'), 0);
  assert.equal(h.count('connect'), 0);
});

test('changing accounts clears the acknowledged quote and requires a new connection and review', async (t) => {
  const h = await createHarness(t);
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  h.changeAccount();
  assert.equal(h.byId('nftree-purchase-review').hidden, true);
  assert.equal(h.byId('nftree-purchase-ack').checked, false);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  assert.equal(h.byId('nftree-review-button').disabled, true);
  assert.match(h.status(), /account changed or disconnected/);
  assert.equal(h.count('mint'), 0);
  await h.connect(); await h.review();
  assert.ok(h.byId('nftree-review-copy').textContent.includes(OTHER_ACCOUNT));
  assert.equal(h.byId('nftree-purchase-ack').checked, false);
});

test('an account change during asynchronous quote loading cannot expose a stale purchase', async (t) => {
  const h = await createHarness(t);
  await h.open(); await h.connect();
  const gate = h.deferNextFetch();
  h.click('nftree-review-button');
  await settleUntil(() => h.count('inventory') === 2, 'quote inventory request started');
  h.changeAccount();
  gate.resolve(inventoryResponse());
  await settleUntil(() => h.status().includes('disconnected'), 'in-flight quote rejected');
  assert.equal(h.byId('nftree-purchase-review').hidden, true);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  assert.equal(h.count('mint'), 0);
});

test('unreadable storage keeps purchasing paused even after successful inventory refresh', async (t) => {
  const h = await createHarness(t, { storageFaults: { read: true } });
  await h.open();
  assert.match(h.status(), /saved purchase record is unavailable/);
  assert.equal(h.byId('nftree-review-button').disabled, true);
  assert.equal(h.byId('nftree-wallet-options').hidden, true);
  h.click('nftree-refresh-button');
  await settleUntil(() => h.count('inventory') === 2 && !h.byId('nftree-refresh-button').disabled, 'inventory refresh completed while storage blocked');
  assert.match(h.status(), /saved purchase record is unavailable/);
  assert.equal(h.count('connect'), 0);
  assert.equal(h.count('mint'), 0);
});

test('failure to persist the pre-sign intent prevents wallet signing and stays visibly blocked', async (t) => {
  const h = await createHarness(t);
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  h.storageFaults.write = true;
  h.click('nftree-purchase-button');
  await settleUntil(() => h.status().includes('saved purchase record is unavailable'), 'storage write failure reported');
  assert.equal(h.count('mint'), 0);
  assert.equal(h.byId('nftree-purchase-button').disabled, true);
  assert.equal(h.byId('nftree-review-button').disabled, true);
  assert.equal(h.document.querySelector('.mint-fallback:last-child').hidden, true);
});

test('an unknown wallet error remains pending and never becomes an automatic purchase retry', async (t) => {
  const h = await createHarness(t, { mint: async () => { throw new Error('Wallet connection lost'); } });
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  h.click('nftree-purchase-button');
  await settleUntil(() => h.status().includes('wallet response is unresolved'), 'uncertain wallet result retained');
  assert.equal(h.saved().status, 'awaiting-wallet');
  assert.equal(h.saved().digest, null);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  assert.equal(h.byId('nftree-review-button').hidden, true);
  assert.equal(h.byId('nftree-check-button').hidden, false);
  assert.doesNotMatch(h.status(), /nothing was charged|purchase failed|cancelled/i);
  h.click('nftree-mint-close'); await h.open();
  assert.equal(h.count('mint'), 1);
  assert.equal(h.count('receipt'), 0);
});

test('a pending purchase from another tab replaces an acknowledged review without signing', async (t) => {
  const h = await createHarness(t);
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  h.storageEvent(pendingRecord());
  assert.equal(h.byId('nftree-purchase-review').hidden, true);
  assert.equal(h.byId('nftree-purchase-button').hidden, true);
  assert.equal(h.byId('nftree-check-button').hidden, false);
  assert.match(h.status(), /previous purchase needs a status check/);
  assert.equal(h.count('mint'), 0);
});

test('two tabs without Web Locks cannot connect, review, or sign and show the official mint fallback', async (t) => {
  const records = new Map();
  const first = await createHarness(t, { records, noLocks: true });
  const second = await createHarness(t, { records, noLocks: true });
  await first.open(); await second.open();
  for (const h of [first, second]) {
    assert.match(h.status(), /Inline minting is unavailable in this browser/);
    assert.match(h.status(), /still check an existing purchase/);
    assert.equal(h.byId('nftree-wallet-options').hidden, true);
    const connections = [...h.byId('nftree-wallet-options').querySelectorAll('button')];
    assert.equal(connections.length, 1);
    for (const button of connections) { assert.equal(button.disabled, true); button.click(); }
    for (const id of ['nftree-review-button', 'nftree-purchase-button']) {
      assert.equal(h.byId(id).hidden, true);
      assert.equal(h.byId(id).disabled, true);
      h.click(id);
    }
    const fallback = h.document.querySelector('.mint-fallback:last-child');
    assert.equal(fallback.hidden, false);
    assert.equal(fallback.querySelector('a').href, 'https://nftree.net/mint#mint');
    // Even a manually dispatched event must hit the controller's signing guard.
    h.acknowledge();
    h.byId('nftree-purchase-button').dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.count('connect'), 0);
    assert.equal(h.count('mint'), 0);
    assert.equal(h.count('lock'), 0);
    assert.equal(h.saved(), null);
    assert.equal(h.byId('nftree-purchase-review').hidden, true);
  }
  assert.equal(records.size, 0);
});

test('a supported but busy cross-tab lock prevents inventory recheck, persistence, and wallet approval', async (t) => {
  const h = await createHarness(t, { lockUnavailable: true });
  await h.open(); await h.connect(); await h.review(); h.acknowledge();
  const priorInventoryReads = h.count('inventory');
  h.click('nftree-purchase-button');
  await settleUntil(() => h.status().includes('Another arcade tab is handling this purchase'), 'busy lock reported');
  assert.equal(h.count('lock'), 1);
  const lock = h.calls.find((call) => call.type === 'lock');
  assert.equal(lock.name, 'tree-arcade:nftree-mint');
  assert.equal(lock.options.ifAvailable, true);
  assert.equal(h.count('inventory'), priorInventoryReads);
  assert.equal(h.count('persist'), 0);
  assert.equal(h.count('mint'), 0);
  assert.equal(h.saved(), null);
});

test('wallet initialization errors remain visible after inventory succeeds', async (t) => {
  const h = await createHarness(t, { bridgeError: true });
  await h.open();
  assert.match(h.status(), /mint connection could not load/);
  h.click('nftree-refresh-button');
  await settleUntil(() => h.count('inventory') === 2 && !h.byId('nftree-refresh-button').disabled, 'inventory refreshed after bridge error');
  assert.match(h.status(), /mint connection could not load/);
  assert.equal(h.byId('nftree-review-button').disabled, true);
  assert.equal(h.count('mint'), 0);
});

test('no installed wallet is described accurately without a connection or purchase request', async (t) => {
  const h = await createHarness(t, { noWallet: true });
  await h.open();
  assert.match(h.status(), /compatible Sui wallet is required/);
  assert.equal(h.byId('nftree-no-wallet').hidden, false);
  assert.equal(h.byId('nftree-wallet-options').children.length, 0);
  assert.equal(h.byId('nftree-review-button').disabled, true);
  assert.equal(h.count('connect'), 0);
  assert.equal(h.count('mint'), 0);
});
