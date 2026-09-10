import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const arcade = await readFile(new URL('../play/index.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles/tree-arcade.css', import.meta.url), 'utf8');
const branding = await readFile(new URL('../styles/tree-arcade-branding.css', import.meta.url), 'utf8');
const homepage = await readFile(new URL('../scripts/home-v2.js', import.meta.url), 'utf8');
const build = await readFile(new URL('../scripts/copy-static-build.mjs', import.meta.url), 'utf8');
const arcadeAssets = await Promise.all([
  'garden-battles-logo.webp',
  'arboretum-logo-black.webp',
  'tree-force-89-logo-black.webp',
  'tree-arcade-world-bg-v2.webp',
].map((asset) => readFile(new URL(`../assets/${asset}`, import.meta.url))));

assert.match(arcade, /<h1 id="arcade-title">TREE ARCADE<\/h1>/);
assert.match(arcade, /INSERT NFTREE · ENTER THE ECOSYSTEM/);
assert.match(arcade, /YOUR NFTREE UNLOCKS THE ARCADE/);
assert.match(arcade, /src="\.\.\/assets\/garden-battles-logo\.webp"/);
assert.match(arcade, /src="\.\.\/assets\/arboretum-logo-black\.webp"/);
assert.match(arcade, /src="\.\.\/assets\/tree-force-89-logo-black\.webp"/);
assert.match(arcade, /href="https:\/\/nftree\.net\/battle\/"[^>]*>PLAY/);
assert.match(arcade, /<h2>TREE FORCE '89<\/h2>/);
assert.match(arcade, /<h3>CANOPY COMMAND<\/h3>/);
assert.match(arcade, /TREE FORCE '89[\s\S]*COMING SOON/);
assert.match(arcade, /<h2>ARBORETUM<\/h2>/);
assert.match(arcade, /<span class="status testing">IN TESTING<\/span>/);
assert.equal(arcade.includes('/play/tree-force'), false);
assert.equal(arcade.includes('treegrow.xyz'), false);
assert.equal(homepage.includes('treegrow.xyz'), false);
assert.equal((arcade.match(/class="game-card /g) || []).length, 3);
assert.equal((arcade.match(/href="https:\/\/nftree\.net\/battle\//g) || []).length, 1);
assert.match(styles, /\.game-grid\{display:grid;grid-template-columns:repeat\(3/);
assert.match(styles, /@media\(max-width:860px\)\{\.game-grid\{grid-template-columns:1fr\}/);
assert.match(styles, /\.game-action\{justify-self:start;min-width:136px;min-height:42px/);
assert.match(styles, /@media\(max-width:620px\)[\s\S]*\.game-action\{min-width:126px;min-height:44px/);
assert.match(branding, /tree-arcade-world-bg-v2\.webp/);
assert.match(branding, /\.nftree-access-card/);
assert.match(branding, /\.garden-mode-grid/);
assert.match(branding, /\.arboretum-earn-panel/);
for (const asset of arcadeAssets) {
  assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(asset.subarray(8, 12).toString('ascii'), 'WEBP');
}
assert.equal(styles.includes('.arcade-footer-actions a{flex:1'), false);
assert.equal(styles.includes('grid-template-columns:1fr}.arcade-footer-cta'), false);
assert.match(build, /'play'/);

console.log('TREE Arcade source safeguards passed.');
