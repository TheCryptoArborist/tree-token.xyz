import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../netlify/functions/tree-dashboard.ts', import.meta.url), 'utf8');

assert.match(source, /tree-market-last-verified\.json/);
assert.match(source, /readCachedTreeMarket\(\)/);
assert.match(source, /writeCachedTreeMarket\(/);
assert.match(source, /hasCoreMarketFields\(noodlesData\)/);
assert.match(source, /last verified market snapshot/);
assert.match(source, /verifiedAt/);

console.log('TREE dashboard fallback source: PASS (durable last-verified market snapshot wired)');
