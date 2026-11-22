import { cp, mkdir, readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { PREVIEW_PATHS as treeArmyPaths } from './tree-army-release-plan.mjs';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
// Keep the candidate separate from the byte-exact published snapshot in dist/.
const output = resolve(root, 'dist-preview');
const manifest = JSON.parse(await readFile(resolve(root, 'production/manifest.json'), 'utf8'));
const outputPath = file => file.path.slice(1);
const allowed = new Set(manifest.files.map(file => outputPath(file).toLowerCase()));
const additions = ['dapp/sti-widget.js', 'dapp/sti-purchase-core.js', 'dapp/sti-stats-core.js', 'dapp/challenge-funding-core.js', 'assets/sti-icon.svg', 'play/multichaintest/index.html', 'play/multichaintest/app.js', 'play/multichaintest/wallet-vendor.js', 'play/multichaintest/setup/index.html', 'play/multichaintest/setup/app.js', 'play/multichaintest/setup/bnb/index.html', 'play/multichaintest/setup/bnb/app.js', 'play/multichaintest/setup/bnb/core.js', 'play/multichaintest/setup/bnb/deployment.json', 'play/multichaintest/setup/bnb/pass/index.html', 'play/multichaintest/setup/bnb/pass/app.js', 'play/multichaintest/setup/bnb/pass/deployment.json', 'play/multichaintest/setup/bnb/bind/index.html', 'play/multichaintest/setup/bnb/bind/app.js', 'play/multichaintest/setup/bnb/bind/core.js', 'play/multichaintest/setup/bnb/bind/binding.json', 'play/multichaintest/setup/sui/register/index.html', 'play/multichaintest/setup/sui/register/app.js', 'play/multichaintest/setup/sui/register/core.js', 'play/multichaintest/setup/sui/register/wallet-vendor.js', 'play/multichaintest/setup/sui/configure/index.html', 'play/multichaintest/setup/sui/configure/app.js', 'play/multichaintest/setup/sui/configure/core.js', 'play/multichaintest/setup/sui/configure/wallet-vendor.js', 'play/multichaintest/setup/bnb/configure/index.html', 'play/multichaintest/setup/bnb/configure/app.js', 'play/multichaintest/setup/bnb/configure/core.js', 'play/multichaintest/setup/bnb/configure/configuration.json', 'play/multichaintest/setup/sui/bind/index.html', 'play/multichaintest/setup/sui/bind/app.js', 'play/multichaintest/setup/sui/bind/core.js', 'play/multichaintest/setup/sui/bind/wallet-vendor.js', 'play/multichaintest/setup/sui/reserve/index.html', 'play/multichaintest/setup/sui/reserve/app.js', 'play/multichaintest/setup/sui/reserve/core.js', 'play/multichaintest/setup/sui/reserve/wallet-vendor.js', 'play/multichaintest/setup/sui/recover/index.html', 'play/multichaintest/setup/sui/recover/app.js', 'play/multichaintest/setup/sui/recover/core.js', 'play/multichaintest/setup/sui/recover/wallet-vendor.js', 'play/multichaintest/setup/bnb/recover/index.html', 'play/multichaintest/setup/bnb/recover/app.js', 'play/multichaintest/setup/bnb/recover/core.js', 'play/multichaintest/setup/bnb/buy/index.html', 'play/multichaintest/setup/bnb/buy/app.js', 'play/multichaintest/setup/bnb/buy/core.js', 'play/multichaintest/setup/bnb/redeem/index.html', 'play/multichaintest/setup/bnb/redeem/app.js', 'play/multichaintest/setup/bnb/redeem/core.js', 'play/multichaintest/setup/sui/ack/index.html', 'play/multichaintest/setup/sui/ack/app.js', 'play/multichaintest/setup/sui/ack/core.js', 'play/multichaintest/setup/sui/ack/wallet-vendor.js', 'play/multichaintest/original/index.html', 'play/multichaintest/original/app.js', 'play/multichaintest/original/core.js', 'play/multichaintest/original/slot/index.html', 'play/multichaintest/original/slot/app.js', 'play/multichaintest/original/slot/core.js', 'play/multichaintest/original/bnb/index.html', 'play/multichaintest/original/bnb/app.js', 'play/multichaintest/original/bnb/core.js', 'play/multichaintest/original/bnb/pass/index.html', 'play/multichaintest/original/bnb/pass/app.js', 'play/multichaintest/original/bnb/pass/core.js', 'play/multichaintest/original/bnb/bind/index.html', 'play/multichaintest/original/bnb/bind/app.js', 'play/multichaintest/original/bnb/bind/core.js', 'play/multichaintest/original/register/index.html', 'play/multichaintest/original/register/app.js', 'play/multichaintest/original/register/core.js', 'play/multichaintest/original/configure/index.html', 'play/multichaintest/original/configure/app.js', 'play/multichaintest/original/configure/core.js', 'play/multichaintest/original/bnb/configure/index.html', 'play/multichaintest/original/bnb/configure/app.js', 'play/multichaintest/original/bnb/configure/core.js', 'play/multichaintest/original/bind/index.html', 'play/multichaintest/original/bind/app.js', 'play/multichaintest/original/bind/core.js', 'play/multichaintest/original/fund/index.html', 'play/multichaintest/original/fund/app.js', 'play/multichaintest/original/fund/core.js', 'play/multichaintest/original/reserve/index.html', 'play/multichaintest/original/reserve/app.js', 'play/multichaintest/original/reserve/core.js'];
const overlays = ['dapp/v3-workspace.js', 'dapp/index.html', 'dapp/styles.css', 'dapp/panel-router.css', 'dapp/interaction-bootstrap.js', 'scripts/wallet.js', 'scripts/tree-knowledge-trial.js'];
for (const file of additions) allowed.add(file);

// A review overlay, never a production package. The older snapshot above is
// retained for other existing previews; the Arcade uses explicitly captured,
// hash-pinned current runtime files instead of that historical page/runtime.
const arcadeDirectory = 'production/arcade-organization-static';
const arcadeRuntime = JSON.parse(await readFile(resolve(root, arcadeDirectory, 'runtime-manifest.json'), 'utf8'));
const arcadeInventory = JSON.parse(await readFile(resolve(root, 'production/sti-wallet-recovery-release-20261118.json'), 'utf8'));
const arcadeOverlays = [
  ...treeArmyPaths.filter(path => path !== '/scripts/arcade-organization.js').map(path => ({path, source:path.slice(1)})),
  { path: '/play/index.html', source: `${arcadeDirectory}/index.html` },
  { path: '/arcade-review/index.html', source: `${arcadeDirectory}/review.html` },
  { path: '/scripts/arcade-organization.js', source: 'scripts/arcade-organization.js' },
  { path: '/scripts/arcade-attendance-forest.js', source: 'scripts/arcade-attendance-forest.js' },
  { path: '/scripts/arcade-advent-grove.js', source: 'scripts/arcade-advent-grove.js' },
  { path: '/scripts/arcade-next-month-unlocks.js', source: 'scripts/arcade-next-month-unlocks.js' },
  { path: '/styles/arcade-organization.css', source: 'styles/arcade-organization.css' },
  { path: '/scripts/arcade-season-deadline.js', source: 'scripts/arcade-season-deadline.js' },
  { path: '/styles/arcade-season-deadline.css', source: 'styles/arcade-season-deadline.css' },
  { path: '/scripts/arcade-preview-readonly.js', source: 'scripts/arcade-preview-readonly.js' },
];
const unreportedPublicAssets = new Set([
  '/play/canopy-defense/checkout-test/assets/brand/canopy-home-scene.webp',
]);
const digest = bytes => createHash('sha1').update(bytes).digest('hex');
const validPublicPath = pathname => typeof pathname === 'string' && /^\/[A-Za-z0-9_./@-]+$/.test(pathname) &&
  !pathname.split('/').some(part => part === '.' || part === '..');
assert.equal(arcadeRuntime.schemaVersion, 1);
assert.equal(arcadeRuntime.baselineId, arcadeInventory.candidateId, 'Arcade runtime baseline differs from the reviewed inventory.');
assert.equal(arcadeRuntime.inventoryStaticPaths, 616);
assert.equal(Object.keys(arcadeInventory.files).length, 616);
assert(Array.isArray(arcadeRuntime.files) && arcadeRuntime.files.length > 0, 'Missing current Arcade runtime.');
assert.equal(new Set(arcadeRuntime.files.map(file => file.path)).size, arcadeRuntime.files.length, 'Duplicate runtime path.');
const publicSnapshots = arcadeRuntime.publicConfigurationSnapshots;
assert(Array.isArray(publicSnapshots) && publicSnapshots.length === 1, 'Exactly one anonymous public configuration snapshot is expected.');
assert.equal(publicSnapshots[0].requestPath, '/api/arcade-growth?action=status');
assert.equal(publicSnapshots[0].path, '/arcade-preview-data/arcade-growth-status.json');
assert.equal(publicSnapshots[0].authenticated, false);
assert.equal(publicSnapshots[0].containsPlayerProgress, false);

async function sourceBytes(file) {
  assert(validPublicPath(file.path), 'Invalid Arcade preview destination.');
  assert(typeof file.source === 'string' && !file.source.startsWith('/') && !file.source.split('/').includes('..'), 'Invalid Arcade preview source.');
  const filename = resolve(root, file.source);
  assert(!(await lstat(filename)).isSymbolicLink(), 'Arcade preview source symlinks are not allowed.');
  const bytes = await readFile(filename);
  if (file.sha1) assert.equal(digest(bytes), file.sha1, 'Captured Arcade source bytes changed: ' + file.path);
  return bytes;
}
for (const file of arcadeRuntime.files) {
  const expected = arcadeInventory.files[file.path.toLowerCase()];
  if (expected) assert.equal(file.sha1, expected, 'Arcade runtime differs from the captured live hash: ' + file.path);
  else assert(unreportedPublicAssets.has(file.path), 'Unreviewed asset outside the live inventory: ' + file.path);
  await sourceBytes(file); // Preserve and verify captured bytes even for an explicit replacement.
}
// These reviewed replacements never redefine the captured inventory. The two
// wallet baseline sources live under captured-runtime/; their original hashes
// and every other captured file are verified above before using the updates.
const arcadeRuntimeReplacements = new Map([
  ['/scripts/arcade-monthly.js', { path: '/scripts/arcade-monthly.js', source: 'scripts/arcade-monthly.js',
    sha1: '1b3defc0bbb85265731f46084e367e7ad219defc' }],
  ['/assets/arcade/arcade-growth-wallet.js', {
    path: '/assets/arcade/arcade-growth-wallet.js',
    source: `${arcadeDirectory}/runtime/assets/arcade/arcade-growth-wallet.js`,
    sha1: 'dc4a5e94e812069ad833c4b8d523f78d05d676d9',
  }],
  ['/scripts/arcade-daily-growth-play-share.js', {
    path: '/scripts/arcade-daily-growth-play-share.js',
    source: `${arcadeDirectory}/runtime/scripts/arcade-daily-growth-play-share.js`,
    sha1: 'f46f76ebb1a7b1bacfabe84137a12be3fd9e58d1',
  }],
]);
for (const path of arcadeRuntimeReplacements.keys()) {
  assert(arcadeRuntime.files.some(file => file.path === path), 'Reviewed replacement is missing its captured baseline: ' + path);
}
const arcadeFiles = [...arcadeRuntime.files.map(file => arcadeRuntimeReplacements.get(file.path) || file), ...publicSnapshots, ...arcadeOverlays];
for (const file of arcadeFiles) {
  await sourceBytes(file); // Fail before writing output if a source is absent or changed.
  allowed.add(file.path.slice(1).toLowerCase());
}
const publicConfiguration = JSON.parse((await sourceBytes(publicSnapshots[0])).toString('utf8'));
assert.equal(publicConfiguration.status, 'ok');
assert.equal(publicConfiguration.authenticated, false);
assert.equal(publicConfiguration.progress, undefined);
assert.equal(publicConfiguration.wallet, undefined);
assert(Object.keys(publicConfiguration).every(key => ['status', 'serverTime', 'dateKey', 'monthKey', 'authenticated', 'configuration'].includes(key)),
  'The preview configuration must contain public rules only.');

async function rejectUntrackedOutput(directory, prefix = '') {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await rejectUntrackedOutput(resolve(directory, entry.name), `${relative}/`);
    else if (!allowed.has(relative.toLowerCase())) throw new Error(`Preserve or remove the old preview build before continuing: dist-preview/${relative}`);
  }
}

await rejectUntrackedOutput(output);
for (const file of manifest.files) {
  const destination = resolve(output, outputPath(file));
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, file.source), destination);
}

for (const file of [...overlays, ...additions]) {
  await mkdir(dirname(resolve(output, file)), { recursive: true });
  await cp(resolve(root, file), resolve(output, file));
}

for (const file of arcadeFiles) {
  const destination = resolve(output, file.path.slice(1));
  await mkdir(dirname(destination), { recursive: true });
  let bytes = await sourceBytes(file);
  if (file.path === '/play/index.html') {
    let html = bytes.toString('utf8');
    assert(!html.includes('arcade-preview-readonly.js'), 'The preview guard must be injected only by this builder.');
    assert(html.includes('/scripts/arcade-organization.js') && html.includes('/styles/arcade-organization.css'), 'Missing organization overlays.');
    html = html.replace(/<html\b/i, '<html data-arcade-review-preview="readonly"');
    html = html.replace(/<head>/i, '<head>\n<script src="/scripts/arcade-preview-readonly.js"></script>\n');
    if (!/<meta\b[^>]*name=["']robots["']/i.test(html)) html = html.replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
    html = html.replace('</head>', '<style id="arcade-review-notice-style">#arcade-review-notice{box-sizing:border-box;max-width:1160px;margin:12px auto;padding:12px 18px;border:1px solid #9172ce;border-radius:12px;background:#20172e;color:#f4edff;font:14px/1.55 system-ui,sans-serif}#arcade-review-notice p{margin:0}#arcade-review-notice a{color:#b8ffdb;font-weight:700}#arcade-review-notice small{display:block;color:#d3c6e7}#arcade-review-notice #arcade-review-status:empty{display:none}@media(max-width:640px){#arcade-review-notice{margin:10px 12px;padding:10px 12px}}</style></head>');
    const capturedAt = publicSnapshots[0].capturedAt;
    assert(Number.isFinite(Date.parse(capturedAt)), 'Missing public configuration capture time.');
    const notice = '<aside id="arcade-review-notice" aria-label="Arcade review preview"><p><strong>Arcade layout preview</strong> · Explore the tabs, games and badge artwork. Wallet sign-in, saved progress and payments are disabled here. <a href="https://tree-token.xyz/play/">Open the live Arcade →</a></p><small>Public rules captured ' + new Date(capturedAt).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') + '. No player progress or sample winnings are shown.</small><p id="arcade-review-status" role="status"></p></aside>';
    html = html.replace(/(<body\b[^>]*>)/i, '$1\n' + notice);
    bytes = Buffer.from(html);
  }
  await writeFile(destination, bytes);
}
console.log(`Built a ${allowed.size}-file feature preview with ${arcadeRuntime.files.length} pinned current Arcade runtime assets and a read-only review overlay.`);
console.log('The production manifest and recovered function packages were not changed.');
