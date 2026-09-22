import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const section = html.match(/<section class="data-group stats-sti"[\s\S]*?<\/section>/)?.[0];
test('STI appears once in Stats Market between chart and burn/supply details', () => {
  assert.ok(section);
  assert.equal(html.match(/class="data-group stats-sti"/g).length, 1);
  assert.ok(html.indexOf(section) > html.indexOf('id="treeLiveChart"'));
  assert.ok(html.indexOf(section) < html.indexOf('aria-labelledby="statsPublicBurnTitle"'));
  assert.ok(html.indexOf(section) < html.indexOf('id="statsSupplyPanel"'));
  assert.match(section, /aria-labelledby="statsStiTitle"/);
  assert.match(section, /id="statsStiTitle">Tree<\/h3>/);
  assert.match(section, /STI is independently operated, not operated by TREE/);
});
test('only the local native widget executes; no external iframe or redirect', () => {
  const scripts = [...section.matchAll(/<script\b([^>]*)>/g)];
  assert.equal(scripts.length, 1);
  const attrs = scripts[0][1];
  assert.match(attrs, /type="module" src="sti-widget.js"/);
  assert.doesNotMatch(section, /<iframe|<a\b|sti\.boombots\.fun|embed\.js/);
  assert.match(section, /<button id="stiOpenBuy"[^>]+aria-controls="stiPurchase"/);
});
test('purchase starts closed and discloses protection and pool-only route', () => {
  assert.match(section, /id="stiPurchase"[^>]+hidden/);
  assert.match(section, /Minimum STI received/);
  assert.match(section, /does not compare STI’s basket-minting option/);
  const build=readFileSync(new URL('../scripts/build-feature-preview.mjs',import.meta.url),'utf8');
  assert.match(build,/\['dapp\/sti-widget.js', 'dapp\/sti-purchase-core.js'\]/);
});
