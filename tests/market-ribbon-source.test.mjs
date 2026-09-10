import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatSuiPrice } from '../dapp/app.js';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const ribbon = html.match(/<div class="market-ribbon"[\s\S]*?<\/div>/)?.[0] || '';

assert.match(ribbon, /<span>SUI<\/span><strong data-sui-price>/);
assert.match(ribbon, /<span>TREE<\/span><strong data-market="price">/);
assert.doesNotMatch(ribbon, /24H|priceChange24h/);
assert.equal(formatSuiPrice(0.670012), '$0.67');
assert.equal(formatSuiPrice(null), 'Not available');

console.log('Market ribbon: PASS (SUI price and TREE price only)');
