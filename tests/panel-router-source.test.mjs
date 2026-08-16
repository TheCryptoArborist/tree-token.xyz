import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../dapp/panel-router.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../dapp/panel-router.css', import.meta.url), 'utf8');

const panelIds = [
  'swap', 'limit', 'earn', 'v3', 'stats', 'removed',
  'canopy-draw', 'leaderboard', 'profile-studio', 'documents',
];

for (const id of panelIds) {
  const section = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`))?.[0] || '';
  assert.match(section, /class="[^"]*\bapp-panel\b[^"]*"/, `${id} must be an app panel`);
  if (id === 'swap') assert.doesNotMatch(section, /\shidden(?:\s|>)/);
  else assert.match(section, /\shidden(?:\s|>)/, `${id} must start hidden`);
}

assert.match(router, /panel\.hidden = !selected/);
assert.match(router, /history\.pushState/);
assert.match(router, /addEventListener\('popstate'/);
assert.match(css, /\.app-panel\[hidden\]\{display:none!important\}/);

console.log('Tabbed panel router: PASS (single visible panel, direct hashes, and history navigation)');
