import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const snippet = fs.readFileSync(new URL('../scripts/treedrop-native-entry.html', import.meta.url), 'utf8');
const code = snippet.match(/<script>([\s\S]*?)<\/script>/)[1];
function destination(url) {
  const original = new URL(url); let result;
  vm.runInNewContext(code, { URL, window: { location: {
    hostname: original.hostname, pathname: original.pathname, search: original.search, hash: original.hash,
    replace: value => { result = value; },
  } } });
  return result;
}
test('both former public entry hosts forward to the fixed native destination', () => {
  assert.equal(destination('https://treedrop.xyz/'), 'https://tree-token.xyz/rewards/');
  assert.equal(destination('https://www.treedrop.xyz/index.html'), 'https://tree-token.xyz/rewards/');
});
test('management query and section survive without allowing an arbitrary destination', () => {
  assert.equal(destination('https://www.treedrop.xyz/?manage=1#contribute'), 'https://tree-token.xyz/rewards/?manage=1#contribute');
  assert.equal(new URL(destination('https://www.treedrop.xyz/?redirect=https://example.com/')).origin, 'https://tree-token.xyz');
});
test('existing APIs, other paths, and unrelated hosts never redirect', () => {
  assert.equal(destination('https://www.treedrop.xyz/.netlify/functions/nftree-holder-snapshot'), undefined);
  assert.equal(destination('https://www.treedrop.xyz/assets/app.js'), undefined);
  assert.equal(destination('https://tree-token.xyz/'), undefined);
});
test('JavaScript-disabled entry retains a fixed native fallback', () => {
  assert.match(snippet, /<noscript><meta http-equiv="refresh" content="0;url=https:\/\/tree-token.xyz\/rewards\/">/);
});
