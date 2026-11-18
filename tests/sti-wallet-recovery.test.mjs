import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the actual independent loader. Only module download, DOM and timers are
// supplied by the harness; no wallet or network operation can run in these tests.
const source = readFileSync(new URL('../production/sti-purchase-static/sti-wallet-recovery.js', import.meta.url), 'utf8')
  .replace('import(widgetURL.href)', 'testImport(widgetURL.href)');
const key = 'tree:sti:reload-draft';
const now = 1_795_021_200_000;
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

function setup({ storage = new Map(), storageBlocked = false } = {}) {
  const elements = new Map(), windowEvents = new Map(), clickHandlers = [], timers = new Map(), imports = [];
  let timerId = 0, reloads = 0, resolveImport, rejectImport;
  const moduleLoad = new Promise((resolve, reject) => { resolveImport = resolve; rejectImport = reject; });
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, value: '', textContent: '', dataset: {}, disabled: false,
      hidden: ['stiPurchase', 'stiReloadWallet'].includes(id), handlers: {}, attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; }, focus() {},
      addEventListener(name, fn) { this.handlers[name] = fn; } });
    return elements.get(id);
  }
  const storageAccess = fn => (...args) => { if (storageBlocked) throw Error('Storage unavailable'); return fn(...args); };
  const window = {
    location: { href: 'https://tree-token.xyz/dapp/?source=stats#stats', reload() { reloads++; } },
    addEventListener(name, fn) { if (!windowEvents.has(name)) windowEvents.set(name, new Set()); windowEvents.get(name).add(fn); },
    removeEventListener(name, fn) { windowEvents.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of [...windowEvents.get(event.type) || []]) fn(event); },
  };
  const context = {
    window, URL, Date: class extends Date { static now() { return now; } },
    CustomEvent: class { constructor(type) { this.type = type; } },
    document: { currentScript: { src: 'https://tree-token.xyz/dapp/sti-wallet-recovery.js?v=20261118-wallet1' },
      getElementById: element, addEventListener(name, fn) { if (name === 'click') clickHandlers.push(fn); } },
    sessionStorage: { getItem: storageAccess(k => storage.get(k)), setItem: storageAccess((k, v) => storage.set(k, v)), removeItem: storageAccess(k => storage.delete(k)) },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout(id) { timers.delete(id); },
    testImport(url) { imports.push(url); return moduleLoad; },
  };
  vm.runInNewContext(source, context);
  const click = id => {
    const target = element(id), event = { target: { closest: () => target }, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    for (const fn of clickHandlers) { fn(event); if (event.stopped) break; }
    return event;
  };
  const timeout = () => { for (const [id, { fn }] of [...timers]) { if (!timers.has(id)) continue; timers.delete(id); fn(); } };
  return { window, context, element, click, timeout, storage, timers, imports, resolveImport, rejectImport,
    reload: () => element('stiReloadWallet').handlers.click(), reloads: () => reloads,
    listeners: () => windowEvents.get('tree:wallet-manager-ready')?.size || 0 };
}

test('Get STI opens safely while loading, then yields to one initialized widget', async () => {
  const s = setup();
  assert.equal(s.window.treeStiRecovery.state, 'loading');
  assert.equal(s.click('stiOpenBuy').stopped, true);
  assert.equal(s.element('stiPurchase').hidden, false);
  assert.match(s.element('stiPurchaseStatus').textContent, /Loading purchase/);
  for (const name of ['WalletButton', 'QuoteButton', 'BuyButton']) assert.equal(s.element('sti' + name).disabled, true);
  s.click('stiCloseBuy'); assert.equal(s.element('stiPurchase').hidden, true);
  assert.equal(s.element('stiOpenBuy').attributes['aria-expanded'], 'false');
  // Re-evaluating the classic script cannot install a second loader.
  vm.runInNewContext(source, s.context);
  assert.deepEqual(s.imports, ['https://tree-token.xyz/dapp/sti-widget.js?v=20261118-wallet1']);
  s.resolveImport(); await tick();
  assert.equal(s.window.treeStiRecovery.state, 'ready');
  assert.equal(s.click('stiOpenBuy').stopped, false);
  assert.equal(s.timers.size, 0);
});

test('failed and stalled module loads expose reload; late completion clears the fallback', async () => {
  for (const failed of [true, false]) {
    const s = setup(); s.click('stiOpenBuy');
    if (failed) { s.rejectImport(Error('Dependency unavailable')); await tick(); } else s.timeout();
    assert.equal(s.window.treeStiRecovery.state, 'unavailable');
    assert.equal(s.element('stiReloadWallet').hidden, false);
    assert.match(s.element('stiPurchaseStatus').textContent, /Reload wallet tools/);
    assert.equal(s.element('stiBuyButton').disabled, true);
    assert.equal(s.click('stiBuyButton').stopped, true);
    if (!failed) {
      s.resolveImport(); await tick();
      assert.equal(s.element('stiReloadWallet').hidden, true);
      assert.equal(s.window.treeStiRecovery.state, 'ready');
    }
    assert.equal(s.imports.length, 1);
  }
});

test('wallet readiness coalesces waiters and removes listener/timer on success', async () => {
  const s = setup(); s.resolveImport(); await tick();
  const first = s.window.treeStiRecovery.waitForWalletManager();
  assert.equal(first, s.window.treeStiRecovery.waitForWalletManager());
  assert.equal(s.listeners(), 1);
  // An event without the actual manager is insufficient.
  s.window.dispatchEvent({ type: 'tree:wallet-manager-ready' }); assert.equal(s.listeners(), 1);
  s.window.openWalletManager = () => { throw Error('Connection must be explicitly initiated by the widget'); };
  s.window.dispatchEvent({ type: 'tree:wallet-manager-ready' }); await first;
  assert.equal(s.listeners(), 0); assert.equal(s.timers.size, 0);
  await s.window.treeStiRecovery.waitForWalletManager();
  assert.equal(s.listeners(), 0);
});

test('wallet timeout remains retryable and cleans up each attempt', async () => {
  const s = setup(); s.resolveImport(); await tick();
  for (let attempt = 0; attempt < 2; attempt++) {
    const waiting = s.window.treeStiRecovery.waitForWalletManager();
    const failure = assert.rejects(waiting, /Retry wallet connection.*Reload wallet tools/);
    s.timeout(); await failure;
    assert.equal(s.listeners(), 0); assert.equal(s.timers.size, 0);
  }
  s.window.openWalletManager = () => {};
  await s.window.treeStiRecovery.waitForWalletManager();
  assert.equal(s.imports.length, 1, 'Wallet retry must not reimport any module');
});

test('reload guard is enforced at click time, and only an amount is restored once', async () => {
  const storage = new Map([['tree:sui:wallet-name', 'Slush'], ['unrelated', 'keep']]);
  const s = setup({ storage }); s.click('stiOpenBuy'); s.element('stiAmount').value = '2.5';
  s.window.treeStiRecovery.showWalletRecovery(); s.window.treeStiRecovery.setPurchasePending(true);
  assert.equal(s.element('stiReloadWallet').disabled, true);
  // Direct invocation still cannot discard signing/confirmation state.
  s.reload(); assert.equal(s.reloads(), 0); assert.equal(storage.has(key), false);
  s.window.treeStiRecovery.setPurchasePending(false); s.reload();
  assert.equal(s.reloads(), 1);
  assert.equal(s.window.location.href, 'https://tree-token.xyz/dapp/?source=stats#stats');
  assert.deepEqual(JSON.parse(storage.get(key)), { amount: '2.5', open: true, at: now });
  assert.equal(storage.get('tree:sui:wallet-name'), 'Slush'); assert.equal(storage.get('unrelated'), 'keep');
  const restored = setup({ storage });
  assert.equal(restored.element('stiAmount').value, '2.5'); assert.equal(restored.element('stiPurchase').hidden, false);
  assert.equal(storage.has(key), false);
  restored.resolveImport(); await tick();
  assert.match(restored.element('stiPurchaseStatus').textContent, /fresh quote/);
  const next = setup({ storage }); assert.equal(next.element('stiAmount').value, '');
});

test('stale, malformed and oversized drafts are discarded; blocked storage cannot block recovery', () => {
  for (const raw of ['{bad', JSON.stringify({ at: now - 600_001, amount: '2', open: true }),
    JSON.stringify({ at: now + 1, amount: '2', open: true }),
    JSON.stringify({ at: now, amount: '2'.repeat(81), open: true }),
    JSON.stringify({ at: now, amount: '<script>', open: true })]) {
    const storage = new Map([[key, raw]]), s = setup({ storage });
    assert.equal(s.element('stiAmount').value, ''); assert.equal(storage.has(key), false);
  }
  const blocked = setup({ storageBlocked: true });
  blocked.reload(); assert.equal(blocked.reloads(), 1);
});
