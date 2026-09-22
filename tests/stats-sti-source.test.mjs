import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  assert.match(section, /id="statsStiTitle">TREE in the Sui Trenches Index \(STI\)/);
  assert.match(section, /external Sui ecosystem index[\s\S]*not operated by TREE/);
});
test('only the reviewed TREE loader executes, with SRI and anonymous CORS', () => {
  const scripts = [...section.matchAll(/<script\b([^>]*)>/g)];
  assert.equal(scripts.length, 1);
  const attrs = scripts[0][1];
  assert.match(attrs, /\basync\b/);
  assert.match(attrs, /src="https:\/\/sti\.boombots\.fun\/embed\.js"/);
  assert.match(attrs, /data-coin="TREE"/);
  assert.match(attrs, /crossorigin="anonymous"/);
  assert.match(attrs, /referrerpolicy="no-referrer"/);
  const reviewed = readFileSync(new URL('../docs/sti-review/embed.js.txt', import.meta.url));
  const hash = createHash('sha384').update(reviewed).digest('base64');
  assert.ok(attrs.includes(`integrity="sha384-${hash}"`));
});
test('safe external fallback is available even if the loader is blocked', () => {
  assert.match(section, /href="https:\/\/sti\.boombots\.fun\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(section, /If the widget is unavailable/);
  assert.match(section, /opens in a new tab/);
});
