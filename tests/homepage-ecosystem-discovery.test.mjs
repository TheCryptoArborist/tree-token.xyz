import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('homepage links to live ecosystem entrypoints', () => {
  assert.match(html, /href="\/play\/"[^>]*>Explore TREE Arcade/);
  assert.match(html, /href="\/dapp\/#victory"[^>]*>Open VICTORY/);
  assert.match(html, /href="https:\/\/treegrow\.xyz\/"[^>]*>Explore Arboretum Preview/);
  assert.match(html, /href="\/dapp\/"[^>]*><span class="command-center-icon"/);
  assert.doesNotMatch(html, /Knowledge Trial|canopy-draw/i);
});
