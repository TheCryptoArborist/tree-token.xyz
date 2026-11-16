import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../play/multichaintest/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../play/multichaintest/index.html', import.meta.url), 'utf8');

test('preview wallet flow connects and disconnects without requesting a signature', async () => {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, children: [],
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } });
    return elements.get(id);
  };
  const expected = '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6';
  const wallet = { name: 'Slush' };
  let connection = {}, callback, connected = 0, disconnected = 0;
  const kit = {
    stores: {
      $wallets: { get: () => [wallet], subscribe(fn) { fn(); return () => {}; } },
      $connection: { subscribe(fn) { callback = fn; fn(connection); return () => {}; } },
    },
    async connectWallet(input) { assert.equal(input.wallet, wallet); connected++; connection = {account:{address:expected}}; callback(connection); },
    async disconnectWallet() { disconnected++; connection={}; callback(connection); },
    signAndExecuteTransaction() { assert.fail('No transaction request is allowed'); },
    signPersonalMessage() { assert.fail('No message signature is allowed'); },
  };
  const createDAppKit = options => { assert.equal(options.autoConnect, false); return kit; };
  const context = vm.createContext({ URL, createDAppKit, SuiGrpcClient: class {},
    document: { getElementById: get, createElement: () => ({}) },
    location: {href:'https://deploy-preview-123--tree-token.netlify.app/play/multichaintest/'},
    navigator: {clipboard:{writeText:async()=>{}}}, window:{addEventListener(){}},
  });
  vm.runInContext(source.replace(/^import .*?;\n/, ''), context);
  assert.match(get('open-slush').href, /deploy-preview-123--tree-token/);
  assert.equal(connected, 0);
  await get('wallet-list').children[0].onclick();
  assert.equal(connected, 1); assert.match(get('wallet-status').textContent, /Designated/);
  await get('disconnect').onclick(); assert.equal(disconnected, 1);
  assert.match(get('wallet-status').textContent, /No wallet connected/);
});

test('website preview has no publication controls or application signing calls', () => {
  assert.match(html, /Publishing, minting and payments are disabled/);
  assert.match(html, /noindex,nofollow/);
  assert.doesNotMatch(html, /id="publish"|id="reviewed"/);
  assert.doesNotMatch(source, /\.signAndExecuteTransaction\(|\.signTransaction\(|\.signPersonalMessage\(|\.publish\(/);
});
