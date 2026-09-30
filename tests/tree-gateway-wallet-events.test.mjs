import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../gateway/review-core.js';

// Execute the shipped controller with simulated DOM and injected wallet responses.
// No provider, network, real account or signing operation is used.
const source = readFileSync(new URL('../gateway/wallet-kit/entry.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
const address = '0x' + '1'.repeat(40);
const recipient = '0x' + '2'.repeat(64);
function harness(chain = 'bsc') {
  const listeners = target => Object.assign(target, {
    handlers: new Map(),
    addEventListener(name, fn) { const list = this.handlers.get(name) || []; list.push(fn); this.handlers.set(name, list); },
    removeEventListener(name, fn) { this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== fn)); },
    dispatchEvent(event) { for (const fn of this.handlers.get(event.type) || []) fn(event); },
    async fire(name) { for (const fn of this.handlers.get(name) || []) await fn({ type: name }); },
  });
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, listeners({ value: '', hidden: false, disabled: false, textContent: '', append() {} }));
    return elements.get(id);
  };
  el('chain').value = chain;
  el('destination').value = 'SUI';
  el('source-wallet').value = 'legacy';
  const calls = [];
  const state = { account: address, chain: core.EVM_CHAINS[chain], sui: recipient, balance: '0xde0b6b3a7640000', pending: null };
  const provider = listeners({
    async request({ method }) {
      calls.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [state.account];
      if (method === 'eth_chainId') return state.chain;
      if (method === 'eth_getBalance') return state.pending ? await state.pending : state.balance;
      throw Error('Unexpected wallet operation: ' + method);
    },
    on(name, fn) { this.addEventListener(name, fn); },
    removeListener(name, fn) { this.removeEventListener(name, fn); },
  });
  const host = listeners({ ethereum: provider, Event, getWalletConnectionState: () => ({ connected: !!state.sui, address: state.sui }) });
  const win = listeners({});
  vm.runInNewContext(source, {
    ...core, commandCenterHost: () => host, window: win,
    document: { getElementById: el }, Event, Option: class {},
    fetch: () => { throw Error('Unexpected network call'); }, setTimeout,
  });
  return { el, provider, host, win, state, calls };
}

test('RocketX connects both addresses and reads only the selected source network', async () => {
  for (const chain of ['bsc', 'robinhood']) {
    const h = harness(chain);
    await h.el('source-connect').fire('click');
    assert.equal(h.el('source-address').textContent, address);
    assert.equal(h.el('sui-address').textContent, recipient);
    assert.match(h.el('wallet-summary').textContent, /Both addresses selected/);
    assert.equal(h.el('check-bridges').hidden, true);
    await h.el('gas-check').fire('click');
    assert.match(h.el('gas-status').textContent, /Source native balance: 1\.00000000/);
    assert.doesNotMatch(h.el('gas-status').textContent, /Base/);
    assert.ok(h.calls.every(method => ['eth_requestAccounts', 'eth_accounts', 'eth_chainId', 'eth_getBalance'].includes(method)));
  }
});

test('wrong network blocks balances; account and Sui changes clear reviewed state', async () => {
  const h = harness();
  h.state.chain = core.EVM_CHAINS.base;
  await h.el('source-connect').fire('click');
  assert.equal(h.el('gas-check').disabled, true);
  assert.equal(h.el('source-switch').hidden, false);
  await h.el('gas-check').fire('click');
  assert.ok(!h.calls.includes('eth_getBalance'));
  await h.provider.fire('accountsChanged');
  assert.equal(h.el('source-address').textContent, 'Source wallet not connected.');
  h.state.chain = core.EVM_CHAINS.bsc;
  await h.el('source-connect').fire('click');
  await h.el('gas-check').fire('click');
  h.state.sui = '';
  await h.host.fire('tree:wallet-changed');
  assert.equal(h.el('sui-address').textContent, 'Sui receiving wallet not connected.');
  assert.match(h.el('gas-status').textContent, /has not been checked/);
});

test('a balance arriving after disconnect or route change cannot replace cleared state', async () => {
  for (const event of ['disconnect', 'route']) {
    const h = harness();
    await h.el('source-connect').fire('click');
    let resolveBalance;
    h.state.pending = new Promise(resolve => { resolveBalance = resolve; });
    const read = h.el('gas-check').fire('click');
    while (!h.calls.includes('eth_getBalance')) await Promise.resolve();
    if (event === 'disconnect') await h.provider.fire('disconnect');
    else { h.el('chain').value = 'robinhood'; await h.win.fire('gateway-route-change'); }
    resolveBalance('0xde0b6b3a7640000');
    await read;
    assert.match(h.el('gas-status').textContent, /has not been checked/);
    assert.equal(h.el('gas-check').disabled, true);
  }
});
