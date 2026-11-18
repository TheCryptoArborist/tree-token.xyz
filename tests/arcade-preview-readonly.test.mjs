import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountArcadeNavigation } from '../production/arcade-organization-static/runtime/scripts/arcade-navigation-play-share.js';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM
  || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const read = filename => fs.readFileSync(new URL(filename, import.meta.url), 'utf8');
const source = read('../scripts/arcade-preview-readonly.js');
const page = read('../production/arcade-organization-static/index.html');
const publicRules = read('../production/arcade-organization-static/runtime/preview-data/arcade-growth-status.json');
const previewOrigin = 'https://deploy-preview-222--tree-token.netlify.app';
const sensitiveKeys = [
  'tree-arcade:daily-growth:session:v1',
  'tree-arcade:recovery:pending:v1',
  'tree-arcade:nftree-mint:pending:v1',
];
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function fixture({ marker = 'readonly', beforeGuard, ready = true } = {}) {
  const dom = new JSDOM(page, { url: previewOrigin + '/play/', runScripts: 'outside-only', pretendToBeVisual: true });
  const view = dom.window, doc = view.document;
  if (marker != null) doc.documentElement.dataset.arcadeReviewPreview = marker;
  Object.assign(view, { Request, Response, Headers });
  view.HTMLElement.prototype.scrollIntoView = function () {};
  const calls = { fetch: [], xhr: [], beacon: [] };
  const fetch = async (input, options = {}) => {
    calls.fetch.push({ input, options });
    return new Response(String(input) === '/arcade-preview-data/arcade-growth-status.json'
      ? publicRules : JSON.stringify({ status: 'test-transport-read' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  view.fetch = fetch;
  class XHR {
    constructor() { this.withCredentials = false; }
    open(method, url) { this.method = method; this.url = url; this.headers = {}; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(body) { calls.xhr.push({ method: this.method, url: this.url, headers: this.headers, body }); }
  }
  view.XMLHttpRequest = XHR;
  const sendBeacon = (url, data) => { calls.beacon.push({ url, data }); return true; };
  view.navigator.sendBeacon = sendBeacon;
  const storageMethods = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(key => [key, view.Storage.prototype[key]]));
  beforeGuard?.({ view, doc, storageMethods });
  view.eval(source);
  if (ready) doc.dispatchEvent(new view.Event('DOMContentLoaded'));
  return { view, doc, calls, originals: { fetch, sendBeacon, storageMethods }, close() { view.close(); } };
}

for (const marker of [null, 'enabled']) {
  test(`guard leaves non-preview pages untouched (marker ${String(marker)})`, async () => {
    const f = fixture({ marker });
    try {
      assert.equal(f.view.fetch, f.originals.fetch);
      assert.equal(f.view.navigator.sendBeacon, f.originals.sendBeacon);
      for (const [name, method] of Object.entries(f.originals.storageMethods)) assert.equal(f.view.Storage.prototype[name], method);
      const response = await f.view.fetch('/api/arcade-growth?action=check-in', { method: 'POST' });
      assert.equal(response.status, 200);
      assert.equal(f.calls.fetch.length, 1, 'The preview guard must not change other page behavior.');
    } finally { f.close(); }
  });
}

test('preview blocks write, authenticated and credential-bearing fetches before any transport', async () => {
  const f = fixture();
  try {
    const cases = [
      ['/api/arcade-growth?action=check-in', { method: 'POST', body: '{}' }],
      [new Request(previewOrigin + '/api/arcade-monthly?action=verify', { method: 'POST', body: '{}' })],
      ['/api/arcade-campaign', { method: 'GET', headers: { Authorization: 'Bearer test-preview-token' } }],
      [new Request(previewOrigin + '/api/arcade-growth?action=status', { headers: { authorization: 'Bearer test-preview-token' } })],
      ['/api/arcade-growth?action=status', { credentials: 'include' }],
      [new Request(previewOrigin + '/api/arcade-growth?action=status', { credentials: 'include' })],
      ['/api/arcade-growth?action=status', { headers: { Cookie: 'preview=test' } }],
      ['/api/arcade-growth?action=status', { headers: { 'X-API-Key': 'test-preview-key' } }],
      ['/api/arcade-campaign?action=claim'],
      ['https://fullnode.mainnet.sui.io/', { method: 'POST', body: '{}' }],
    ];
    for (const args of cases) {
      const response = await f.view.fetch(...args);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, 'preview-read-only');
    }
    assert.equal(f.calls.fetch.length, 0, 'Blocked requests must never reach the underlying transport.');
  } finally { f.close(); }
});

test('preview serves the real anonymous rules snapshot and preserves other public reads', async () => {
  const f = fixture();
  try {
    const captured = JSON.parse(publicRules);
    assert.equal(captured.authenticated, false);
    assert.equal(captured.progress, undefined);
    assert.equal(captured.wallet, undefined);
    for (const input of ['/api/arcade-growth?action=status', new Request(previewOrigin + '/api/arcade-growth?action=status')]) {
      const response = await f.view.fetch(input);
      assert.deepEqual(await response.json(), captured);
    }
    assert(f.calls.fetch.every(call => call.input === '/arcade-preview-data/arcade-growth-status.json'));
    assert(f.calls.fetch.every(call => call.options.credentials === 'omit' && call.options.method === 'GET'));
    await f.view.fetch('/api/tree-dashboard', { method: 'GET' });
    assert.equal(f.calls.fetch.at(-1).input, '/api/tree-dashboard');
    assert.equal(f.calls.fetch.at(-1).options.credentials, 'omit');
  } finally { f.close(); }
});

test('XHR and beacon cannot bypass write or authentication protection', () => {
  const f = fixture();
  try {
    for (const configure of [
      xhr => xhr.open('POST', '/api/arcade-monthly?action=intent'),
      xhr => { xhr.open('GET', '/api/arcade-growth?action=status'); xhr.setRequestHeader('Authorization', 'Bearer test-preview-token'); },
      xhr => { xhr.open('GET', '/api/arcade-growth?action=status'); xhr.withCredentials = true; },
      xhr => xhr.open('GET', '/api/arcade-growth?action=logout'),
    ]) {
      const xhr = new f.view.XMLHttpRequest(); configure(xhr);
      assert.throws(() => xhr.send('{}'), error => error.name === 'InvalidAccessError');
    }
    assert.equal(f.calls.xhr.length, 0);
    assert.equal(f.view.navigator.sendBeacon('/api/arcade-growth?action=check-in', '{}'), false);
    assert.equal(f.calls.beacon.length, 0);
    const read = new f.view.XMLHttpRequest(); read.open('GET', '/api/tree-dashboard'); read.send();
    assert.equal(f.calls.xhr.length, 1);
    assert.equal(f.calls.xhr[0].method, 'GET');
  } finally { f.close(); }
});

test('wallet sessions and pending payments are masked without modifying stored records', () => {
  const saved = new Map(sensitiveKeys.map((key, i) => [key, JSON.stringify({ testRecord: i })]));
  const f = fixture({ beforeGuard({ view }) {
    for (const storage of [view.localStorage, view.sessionStorage]) for (const [key, value] of saved) storage.setItem(key, value);
  } });
  try {
    for (const storage of [f.view.localStorage, f.view.sessionStorage]) {
      for (const [key, value] of saved) {
        assert.equal(storage.getItem(key), null);
        storage.setItem(key, 'replacement-must-not-persist'); storage.removeItem(key);
        assert.equal(f.originals.storageMethods.getItem.call(storage, key), value);
      }
      storage.setItem('arcade-preview-local-choice', 'treeforce89');
      assert.equal(storage.getItem('arcade-preview-local-choice'), 'treeforce89');
      storage.removeItem('arcade-preview-local-choice');
      assert.equal(storage.getItem('arcade-preview-local-choice'), null);
    }
  } finally { f.close(); }
});

test('sensitive controls stay disabled and their handlers cannot run before observer updates', async () => {
  const f = fixture();
  try {
    let handled = 0;
    for (const id of ['growth-connect', 'growth-sign-in', 'growth-check-in', 'nftree-review-button', 'nftree-purchase-button', 'monthly-pay', 'monthly-retry', 'campaign-start', 'campaign-claim']) {
      const button = f.doc.getElementById(id);
      assert.equal(button.disabled, true, id);
      assert.equal(button.getAttribute('aria-disabled'), 'true', id);
      button.addEventListener('click', () => handled++);
      button.disabled = false; // An existing renderer briefly enables it.
      const event = new f.view.MouseEvent('click', { bubbles: true, cancelable: true });
      assert.equal(button.dispatchEvent(event), false, id);
      assert.equal(event.defaultPrevented, true, id);
    }
    const option = f.doc.createElement('button'); option.textContent = 'Test wallet';
    option.addEventListener('click', () => handled++);
    f.doc.getElementById('growth-wallet-options').append(option);
    assert.equal(option.dispatchEvent(new f.view.MouseEvent('click', { bubbles: true, cancelable: true })), false);
    await settle();
    assert.equal(handled, 0);
    assert.equal(option.disabled, true);
    assert.equal(f.doc.getElementById('monthly-pay').disabled, true);
  } finally { f.close(); }
});

test('progress and payment forms cannot submit while local details remain usable', () => {
  const f = fixture();
  try {
    let submissions = 0;
    for (const form of f.doc.querySelectorAll('#monthly-digest-form, #campaign-share-form, #campaign-quiz-form, form[data-mission]')) {
      form.addEventListener('submit', () => submissions++);
      const event = new f.view.Event('submit', { bubbles: true, cancelable: true });
      assert.equal(form.dispatchEvent(event), false);
      assert.equal(event.defaultPrevented, true);
    }
    assert.equal(submissions, 0);
    for (const selector of ['.monthly-info', '.monthly-recovery']) {
      const details = f.doc.querySelector(selector); details.open = false;
      details.querySelector('summary').click();
      assert.equal(details.open, true, selector);
    }
  } finally { f.close(); }
});

test('six tab routes, keyboard navigation, fragments and canonical game links remain usable', () => {
  const f = fixture();
  try {
    mountArcadeNavigation(f.doc, f.view);
    const keys = ['games', 'daily', 'campaigns', 'events', 'month', 'badges'];
    const tabs = [...f.doc.querySelectorAll('#arcade-subnav [role="tab"]')];
    assert.equal(tabs.length, keys.length);
    for (const [i, tab] of tabs.entries()) {
      tab.click();
      assert.equal(f.view.location.hash, '#' + keys[i]);
      assert.equal(tab.getAttribute('aria-selected'), 'true');
      assert.equal(f.doc.getElementById(tab.getAttribute('aria-controls')).hidden, false);
    }
    tabs[5].dispatchEvent(new f.view.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    assert.equal(f.view.location.hash, '#games');
    const game = f.doc.querySelector('#cabinets a[href^="/play/"]');
    const old = new URL(game.getAttribute('href'), previewOrigin);
    game.addEventListener('click', event => event.preventDefault()); // Prevent JSDOM from attempting real navigation.
    game.click();
    assert.equal(game.href, 'https://tree-token.xyz' + old.pathname + old.search + old.hash);
    const fragment = f.doc.querySelector('.skip-link');
    fragment.addEventListener('click', event => event.preventDefault()); fragment.click();
    assert.equal(fragment.getAttribute('href'), '#cabinets');
  } finally { f.close(); }
});
