import assert from 'node:assert/strict';
import { summarizeSuiTokens } from '../netlify/functions/tree-gateway-tokens.ts';

const TREE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const USDC = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

const listed = summarizeSuiTokens({ sui: [
  { symbol: 'USDC', contract: USDC, decimals: 6 },
  { symbol: 'TREE', contract: TREE, decimals: 6 },
]});
assert.equal(listed.tokens.length, 2);
assert.equal(listed.treeDirectListed, true);
assert.equal(listed.tree.symbol, 'TREE');

const absent = summarizeSuiTokens({ sui: [{ symbol: 'USDC', contract: USDC, decimals: 6 }] });
assert.equal(absent.treeDirectListed, false);
assert.equal(absent.tree, null);

const malformed = summarizeSuiTokens({ sui: [{ symbol: '', contract: USDC }, null, { symbol: 'BAD', contract: '0x1' }] });
assert.deepEqual(malformed.tokens, []);

console.log('TREE Gateway Mayan token discovery: PASS');
