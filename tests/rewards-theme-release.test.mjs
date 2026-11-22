import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleFiles, ADDED_PATHS, htmlScripts, assertThemeHtml } from '../scripts/release-rewards-theme.mjs';

const hash = digit => digit.repeat(40);
const baseline = () => ({
  '/rewards/index.html': hash('1'), '/rewards/assets/app-abc.js': hash('2'),
  '/scripts/wallet.js': hash('3'), '/play/index.html': hash('4'),
  ...Object.fromEntries(Array.from({ length: 310 }, (_, i) => [`/original-${i}.bin`, hash('5')])),
});
const overlays = () => [
  { path: '/rewards/index.html', sha1: hash('a'), source: 'production/rewards-theme-static/rewards/index.html' },
  ...ADDED_PATHS.map((p, i) => ({ path: p, sha1: hash(String(i + 6)), source: 'production/rewards-theme-static' + p })),
];

test('theme release retains all 314 originals and adds exactly the three theme files', () => {
  const original = baseline(), plan = assembleFiles(original, overlays());
  assert.equal(Object.keys(plan.files).length, 317);
  assert.deepEqual(plan.changedOriginals, ['/rewards/index.html']);
  assert.deepEqual(plan.addedPaths, [...ADDED_PATHS].sort());
  for (const [p, digest] of Object.entries(original)) if (p !== '/rewards/index.html') assert.equal(plan.files[p], digest);
});

test('existing transaction JavaScript, unrelated HTML and additional public paths cannot change', () => {
  for (const p of ['/scripts/wallet.js', '/rewards/assets/app-abc.js', '/play/index.html']) {
    assert.throws(() => assembleFiles(baseline(), [...overlays(), { path: p, sha1: hash('b') }]), /Unapproved existing/);
  }
  assert.throws(() => assembleFiles(baseline(), [...overlays(), { path: '/rewards/new-app.js', sha1: hash('b') }]), /Unapproved new/);
  assert.throws(() => assembleFiles(baseline(), overlays().slice(0, -1)), /Exact theme additions/);
  assert.throws(() => assembleFiles(baseline(), [...overlays(), { path: '/REWARDS/TREE-THEME.CSS', sha1: hash('c') }]), /case-colliding/);
});

const applicationScript = '<script type="module" crossorigin src="/rewards/assets/app-abc.js"></script>';
const themeHtml = script => `<!doctype html><head>${script}<link rel="stylesheet" href="./tree-theme.css"></head>
<body><video src="/rewards/tree-rewards-background.mp4"></video><script defer src="./tree-background.js"></script></body>`;

test('theme HTML must preserve exact application script tags and add only the local background controller', () => {
  assertThemeHtml(themeHtml(applicationScript), htmlScripts(applicationScript));
  assert.throws(() => assertThemeHtml(themeHtml(applicationScript.replace('app-abc', 'app-changed')), [applicationScript]), /script tags/);
  assert.throws(() => assertThemeHtml(themeHtml(applicationScript + '<script>alert(1)</script>'), [applicationScript]), /script tags/);
  assert.throws(() => assertThemeHtml(themeHtml(applicationScript).replace('./tree-background.js', 'https://other.example/tree-background.js'), [applicationScript]), /exactly one local/);
  assert.throws(() => assertThemeHtml(themeHtml(applicationScript).replace('tree-theme.css', 'missing.css'), [applicationScript]), /stylesheet/);
});
