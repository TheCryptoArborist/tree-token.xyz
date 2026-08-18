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
assert.match(css, /width:min\(472px,calc\(100% - 30px\)\)/);
assert.match(css, /tree-command-watermark\.png/);
assert.match(css, /main::before/);
assert.match(css, /pointer-events:none/);
assert.match(css, /opacity:\.061/, 'Desktop watermark must retain the approved 10% visibility increase.');
assert.match(css, /width:min\(680px,72vw\)/, 'Desktop watermark must remain centered behind the compact panel.');
assert.match(router, /function showStatsView\(view\)/);
for (const view of ['Market', 'Supply', 'Liquidity', 'Nftree']) {
  assert.equal(html.includes(`id="stats${view}Tab"`), true);
  assert.equal(html.includes(`id="stats${view}Panel"`), true);
}
assert.match(router, /function showRaffleView\(view\)/);
for (const view of ['Daily', 'Weekly', 'Entries']) {
  assert.equal(html.includes(`id="raffle${view}Tab"`), true);
  assert.equal(html.includes(`id="raffle${view}Panel"`), true);
}

console.log('Tabbed panel router: PASS (single visible panel, direct hashes, and history navigation)');
