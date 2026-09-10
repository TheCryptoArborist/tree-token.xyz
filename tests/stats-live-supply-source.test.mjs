import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dapp/app.js', import.meta.url), 'utf8');
const publicPages = [
  html,
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  readFileSync(new URL('../faq/index.html', import.meta.url), 'utf8'),
  readFileSync(new URL('../tokenomics/index.html', import.meta.url), 'utf8'),
].join('\n');

assert.match(html, /data-stats-group="supply"[\s\S]*data-burn="totalSupply"/);
assert.match(html, /data-burn="zeroAddressBalance"/);
assert.match(html, /data-burn="effectiveSupply"/);
assert.match(html, /data-burn="removalPercentage"/);
assert.match(html, /data-stats-group="time-locks"[\s\S]*Project snapshot — June 22, 2026/);
assert.match(app, /setGroupState\('supply', 'Live'/);
assert.match(app, /setGroupState\('supply', 'Snapshot'/);
assert.match(app, /setGroupState\('time-locks', 'Snapshot'/);
assert.doesNotMatch(app, /setGroupState\('nftree', 'Snapshot'/);
assert.match(app, /const nftreeUrl = '\/api\/tree-nftree'/);
assert.doesNotMatch(publicPages, /effectively removed|effective removal|removed from circulation/i);
assert.match(publicPages, />Burned</);

console.log('Stats live supply source safeguards passed.');
