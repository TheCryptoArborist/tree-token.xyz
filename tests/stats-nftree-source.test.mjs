import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, fn] = await Promise.all([
  readFile(new URL('../dapp/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../dapp/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../netlify/functions/tree-nftree.ts', import.meta.url), 'utf8'),
]);

for (const field of ['mintPriceSui', 'totalLoaded', 'holderOwned', 'salePool', 'directHolderWallets', 'marketplaceOrCustody']) {
  assert.match(html, new RegExp(`data-nftree="${field}"`));
}
assert.doesNotMatch(html.match(/id="statsNftreePanel"[\s\S]*?(?=<div id="statsWarnings")/)?.[0] || '', /June 22, 2026|data-snapshot="nftree/);
assert.match(app, /const nftreeUrl = '\/api\/tree-nftree'/);
assert.match(app, /Dated or partial NFTree figures are not published/);
assert.match(app, /loadNftree\(\)/);
assert.match(fn, /methodology: 'verified-nftree-ownership-v1'/);
assert.match(fn, /getHolderObjects/);

console.log('NFTree Stats source: PASS (live endpoint, fail-closed UI, ownership disclosure)');
