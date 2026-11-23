import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const bytesDigest = bytes => createHash('sha1').update(bytes).digest('hex');

function verifiedArcadeHTMLDigest(root, snapshot) {
  const source = readFileSync(new URL('production/arcade-organization-static/index.html', root), 'utf8');
  const preview = readFileSync(new URL('dist-preview/play/index.html', root), 'utf8');
  const marker = '<html data-arcade-review-preview="readonly"';
  const guard = '<head>\n<script src="/scripts/arcade-preview-readonly.js"></script>\n';
  const robots = '<meta name="robots" content="noindex,nofollow">';
  assert(!source.includes('data-arcade-review-preview') && !source.includes('arcade-preview-readonly.js'), 'The candidate must not include the injected review guard.');
  assert.equal(preview.split(marker).length, 2, 'Exactly one explicit read-only page marker.');
  assert.equal(preview.split(guard).length, 2, 'The synchronous guard must be the first element in head.');
  assert.equal(preview.split('src="/scripts/arcade-preview-readonly.js"').length, 2, 'The review guard must run only once.');
  assert(preview.includes(robots), 'The review must remain noindex/nofollow.');

  const styles = [...preview.matchAll(/<style id="arcade-review-notice-style">[\s\S]*?<\/style>/g)];
  assert.equal(styles.length, 1, 'Exactly one reviewed notice stylesheet.');
  assert.equal(bytesDigest(styles[0][0]), '0c572854150418fb82fa7bbdfe49ea226d35b66b', 'Only the reviewed notice styling may be injected.');
  assert(preview.includes(styles[0][0] + '</head>'), 'The notice stylesheet is appended at the end of head.');
  assert(Number.isFinite(Date.parse(snapshot.capturedAt)), 'The public snapshot must have a real capture time.');
  const capturedAt = new Date(snapshot.capturedAt).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  const expectedNotice = '<aside id="arcade-review-notice" aria-label="Arcade review preview"><p><strong>Arcade layout preview</strong> · Explore the tabs, games and badge artwork. Wallet sign-in, saved progress and payments are disabled here. <a href="https://tree-token.xyz/play/">Open the live Arcade →</a></p><small>Public rules captured ' + capturedAt + '. No player progress or sample winnings are shown.</small><p id="arcade-review-status" role="status"></p></aside>';
  const notices = [...preview.matchAll(/<aside id="arcade-review-notice"[\s\S]*?<\/aside>/g)];
  assert.equal(notices.length, 1, 'Exactly one review disclosure.');
  assert.equal(notices[0][0], expectedNotice, 'The disclosure must identify disabled actions, the live link and the real snapshot time.');
  const bodyTag = source.match(/<body\b[^>]*>/i)?.[0];
  assert(bodyTag && preview.includes(bodyTag + '\n' + expectedNotice), 'The notice is inserted directly after the original opening body tag.');

  // Reverse only the explicit preview additions, then hash the entire candidate.
  // This still detects any unreviewed edits to original markup, scripts or links.
  let restored = preview.replace(marker, '<html').replace(guard, '<head>')
    .replace(styles[0][0], '').replace('\n' + expectedNotice, '');
  if (!/<meta\b[^>]*name=["']robots["']/i.test(source)) restored = restored.replace(robots, '');
  assert.equal(bytesDigest(restored), bytesDigest(source), 'Arcade preview must equal its candidate plus only the explicit read-only additions.');
  return bytesDigest(preview);
}

test('production build stays byte-exact and STI preview changes only reviewed files', () => {
  const root = new URL('../', import.meta.url);
  for (const script of ['build-production-snapshot.mjs', 'build-feature-preview.mjs']) {
    execFileSync(process.execPath, [`scripts/${script}`], { cwd: root });
  }
  const manifest = JSON.parse(readFileSync(new URL('production/manifest.json', root)));
  const published = JSON.parse(readFileSync(new URL('production/current-release.json', root)));
  // The historical published release remains immutable. Only this explicitly
  // reviewed HTML (navigation and contract-expiration display) may differ from that baseline.
  const approvedNavigationChange = {
    path: '/dapp/index.html',
    previousSha: '764e53ff209b4ae89cf4aefcbd2a8907d4ef75d9',
    approvedSha: '74779a62a39daebc0fa7f65bee6c98c55b4c5f56',
  };
  assert.equal(published.files.find(f => f.path === approvedNavigationChange.path)?.sha, approvedNavigationChange.previousSha);
  assert.equal(manifest.files.find(f => f.path === approvedNavigationChange.path)?.sha1, approvedNavigationChange.approvedSha);
  const approvedSwapChange = {
    path: '/dapp/swap-router.js',
    previousSha: '882f547e3a66028da1815569cc6397be2c1b7346',
    approvedSha: '7925857dd8003ea883fd1ca9f27ac9b11f005e38',
  };
  assert.equal(published.files.find(f => f.path === approvedSwapChange.path)?.sha, approvedSwapChange.previousSha);
  assert.equal(manifest.files.find(f => f.path === approvedSwapChange.path)?.sha1, approvedSwapChange.approvedSha);
  const approvedVictoryReceipt = {
    path: '/dapp/victory-center.js',
    previousSha: 'e4461fc5249448c5228c7310542bd2a42f6f6a10',
    approvedSha: '5247f64b488bc7280cef6672e938720cdfbbd733',
  };
  assert.equal(published.files.find(f => f.path === approvedVictoryReceipt.path)?.sha, approvedVictoryReceipt.previousSha);
  assert.equal(manifest.files.find(f => f.path === approvedVictoryReceipt.path)?.sha1, approvedVictoryReceipt.approvedSha);
  const approvedReviewAdditions = [
  {
    "path": "/dapp/victory-layout-review.css",
    "sha1": "24a991520a6006ce398e3249646209e127517267"
  },
  {
    "path": "/dapp/victory-layout-review.html",
    "sha1": "55fa74e34094dc48bcca3f5099a6c81749544f11"
  }
];
  for (const file of approvedReviewAdditions) {
    assert.equal(published.files.some(f => f.path === file.path), false);
    assert.equal(manifest.files.find(f => f.path === file.path)?.sha1, file.sha1);
  }
  const approvedVictoryLayout = {
    path: '/dapp/victory-center.css',
    previousSha: 'ed5155ef72a64e5bc3bc5f8479832f4f47e9045e',
    approvedSha: '24a991520a6006ce398e3249646209e127517267',
  };
  assert.equal(published.files.find(f => f.path === approvedVictoryLayout.path)?.sha, approvedVictoryLayout.previousSha);
  assert.equal(manifest.files.find(f => f.path === approvedVictoryLayout.path)?.sha1, approvedVictoryLayout.approvedSha);
  const approvedHomepageChanges = [
    { path: '/scripts/home-v2.js', previousSha: '420028bbe52f9e895e111f7d19c6627579979a66', approvedSha: '0ebfe56deda8833e0c8de10afccf4e31e1ae053e' },
    { path: '/assets/index-w-qgkwyr.js', previousSha: '496ecaaf129325c0d750bbc4fd73e03ce5188fe5', approvedSha: '1eff67f20bfaf43c86967b6bdf96c7e947d15342' },
  ];
  for (const file of approvedHomepageChanges) {
    assert.equal(published.files.find(f => f.path === file.path)?.sha, file.previousSha);
    assert.equal(manifest.files.find(f => f.path === file.path)?.sha1, file.approvedSha);
  }
  const approvedPaths = [approvedNavigationChange.path, approvedSwapChange.path, approvedVictoryReceipt.path, approvedVictoryLayout.path, ...approvedReviewAdditions.map(f => f.path), ...approvedHomepageChanges.map(f => f.path)];
  assert.deepEqual(
    manifest.files.filter(f => !approvedPaths.includes(f.path)).map(f => [f.path, f.sha1]).sort(),
    published.files.filter(f => !approvedPaths.includes(f.path)).map(f => [f.path, f.sha]).sort(),
  );
  const overlays = ['/dapp/v3-workspace.js', '/dapp/index.html', '/dapp/styles.css', '/dapp/panel-router.css', '/dapp/interaction-bootstrap.js', '/scripts/wallet.js', '/scripts/tree-knowledge-trial.js'];
  const additions = ['/dapp/sti-widget.js', '/dapp/sti-purchase-core.js', '/dapp/sti-stats-core.js', '/dapp/challenge-funding-core.js', '/assets/sti-icon.svg', '/play/multichaintest/index.html', '/play/multichaintest/app.js', '/play/multichaintest/wallet-vendor.js', '/play/multichaintest/setup/index.html', '/play/multichaintest/setup/app.js', '/play/multichaintest/setup/bnb/index.html', '/play/multichaintest/setup/bnb/app.js', '/play/multichaintest/setup/bnb/core.js', '/play/multichaintest/setup/bnb/deployment.json', '/play/multichaintest/setup/bnb/pass/index.html', '/play/multichaintest/setup/bnb/pass/app.js', '/play/multichaintest/setup/bnb/pass/deployment.json', '/play/multichaintest/setup/bnb/bind/index.html', '/play/multichaintest/setup/bnb/bind/app.js', '/play/multichaintest/setup/bnb/bind/core.js', '/play/multichaintest/setup/bnb/bind/binding.json', '/play/multichaintest/setup/sui/register/index.html', '/play/multichaintest/setup/sui/register/app.js', '/play/multichaintest/setup/sui/register/core.js', '/play/multichaintest/setup/sui/register/wallet-vendor.js', '/play/multichaintest/setup/sui/configure/index.html', '/play/multichaintest/setup/sui/configure/app.js', '/play/multichaintest/setup/sui/configure/core.js', '/play/multichaintest/setup/sui/configure/wallet-vendor.js', '/play/multichaintest/setup/bnb/configure/index.html', '/play/multichaintest/setup/bnb/configure/app.js', '/play/multichaintest/setup/bnb/configure/core.js', '/play/multichaintest/setup/bnb/configure/configuration.json', '/play/multichaintest/setup/sui/bind/index.html', '/play/multichaintest/setup/sui/bind/app.js', '/play/multichaintest/setup/sui/bind/core.js', '/play/multichaintest/setup/sui/bind/wallet-vendor.js', '/play/multichaintest/setup/sui/reserve/index.html', '/play/multichaintest/setup/sui/reserve/app.js', '/play/multichaintest/setup/sui/reserve/core.js', '/play/multichaintest/setup/sui/reserve/wallet-vendor.js', '/play/multichaintest/setup/sui/recover/index.html', '/play/multichaintest/setup/sui/recover/app.js', '/play/multichaintest/setup/sui/recover/core.js', '/play/multichaintest/setup/sui/recover/wallet-vendor.js', '/play/multichaintest/setup/bnb/recover/index.html', '/play/multichaintest/setup/bnb/recover/app.js', '/play/multichaintest/setup/bnb/recover/core.js', '/play/multichaintest/setup/bnb/buy/index.html', '/play/multichaintest/setup/bnb/buy/app.js', '/play/multichaintest/setup/bnb/buy/core.js', '/play/multichaintest/setup/bnb/redeem/index.html', '/play/multichaintest/setup/bnb/redeem/app.js', '/play/multichaintest/setup/bnb/redeem/core.js', '/play/multichaintest/setup/sui/ack/index.html', '/play/multichaintest/setup/sui/ack/app.js', '/play/multichaintest/setup/sui/ack/core.js', '/play/multichaintest/setup/sui/ack/wallet-vendor.js', '/play/multichaintest/original/index.html', '/play/multichaintest/original/app.js', '/play/multichaintest/original/core.js', '/play/multichaintest/original/slot/index.html', '/play/multichaintest/original/slot/app.js', '/play/multichaintest/original/slot/core.js', '/play/multichaintest/original/bnb/index.html', '/play/multichaintest/original/bnb/app.js', '/play/multichaintest/original/bnb/core.js', '/play/multichaintest/original/bnb/pass/index.html', '/play/multichaintest/original/bnb/pass/app.js', '/play/multichaintest/original/bnb/pass/core.js', '/play/multichaintest/original/bnb/bind/index.html', '/play/multichaintest/original/bnb/bind/app.js', '/play/multichaintest/original/bnb/bind/core.js', '/play/multichaintest/original/register/index.html', '/play/multichaintest/original/register/app.js', '/play/multichaintest/original/register/core.js', '/play/multichaintest/original/configure/index.html', '/play/multichaintest/original/configure/app.js', '/play/multichaintest/original/configure/core.js', '/play/multichaintest/original/bnb/configure/index.html', '/play/multichaintest/original/bnb/configure/app.js', '/play/multichaintest/original/bnb/configure/core.js', '/play/multichaintest/original/bind/index.html', '/play/multichaintest/original/bind/app.js', '/play/multichaintest/original/bind/core.js', '/play/multichaintest/original/fund/index.html', '/play/multichaintest/original/fund/app.js', '/play/multichaintest/original/fund/core.js', '/play/multichaintest/original/reserve/index.html', '/play/multichaintest/original/reserve/app.js', '/play/multichaintest/original/reserve/core.js'];
  const digest = file => createHash('sha1').update(readFileSync(file)).digest('hex');
  const arcadeRuntime = JSON.parse(readFileSync(new URL('production/arcade-organization-static/runtime-manifest.json', root)));
  const arcadeInventory = JSON.parse(readFileSync(new URL('production/sti-wallet-recovery-release-20261118.json', root)));
  const arcadeOverlays = [
    ...[
      '/play/tree-army/test/index.html',
      '/play/tree-army/test/assets/grove-battlefield.webp',
      '/play/tree-army/test/assets/forest-army.webp',
      '/play/tree-army/test/assets/tree-hero.webp',
      '/play/tree-army/test/assets/forest-walk.webp',
      '/play/tree-army/preview-gameplay.jpg',
      '/play/tree-army/preview-gameplay.mp4',
      '/play/tree-army/preview-gameplay.webm',
      '/scripts/arcade-tree-army.js',
      '/styles/arcade-tree-army.css',
    ].map(path => ({path, source:path.slice(1)})),
    { path: '/play/index.html', source: 'production/arcade-organization-static/index.html' },
    { path: '/arcade-review/index.html', source: 'production/arcade-organization-static/review.html' },
    { path: '/scripts/arcade-organization.js', source: 'scripts/arcade-organization.js' },
    { path: '/scripts/arcade-attendance-forest.js', source: 'scripts/arcade-attendance-forest.js' },
    // Seasonal art and the isolated Advent interaction preview are explicit additions.
    { path: '/scripts/arcade-advent-grove.js', source: 'scripts/arcade-advent-grove.js' },
    { path: '/scripts/arcade-next-month-unlocks.js', source: 'scripts/arcade-next-month-unlocks.js' },
    { path: '/assets/arcade-seasonal/november-emblem-tree.png', source: 'assets/arcade-seasonal/november-emblem-tree.png' },
    { path: '/assets/arcade-seasonal/advent-art-preview.png', source: 'assets/arcade-seasonal/advent-art-preview.png' },
    { path: '/play/advent-preview/index.html', source: 'play/advent-preview/index.html' },
    { path: '/scripts/arcade-advent-preview.js', source: 'scripts/arcade-advent-preview.js' },
    { path: '/styles/arcade-advent-preview.css', source: 'styles/arcade-advent-preview.css' },
    { path: '/styles/arcade-organization.css', source: 'styles/arcade-organization.css' },
    { path: '/scripts/arcade-season-deadline.js', source: 'scripts/arcade-season-deadline.js' },
    { path: '/styles/arcade-season-deadline.css', source: 'styles/arcade-season-deadline.css' },
    { path: '/scripts/arcade-preview-readonly.js', source: 'scripts/arcade-preview-readonly.js' },
  ];
  const forestPath = '/scripts/arcade-attendance-forest.js';
  assert(!manifest.files.some(file => file.path === forestPath), 'The new forest module must not alter the historical production snapshot.');
  assert(!arcadeRuntime.files.some(file => file.path === forestPath) && !arcadeInventory.files[forestPath],
    'The forest module is an explicit new overlay, never a redefined captured asset.');
  const organization = readFileSync(new URL('scripts/arcade-organization.js', root), 'utf8');
  assert.match(organization, /\bfrom\s*['"]\.\/arcade-attendance-forest\.js['"]/, 'The guarded organization module must load the allowed forest source.');
  assert.equal(arcadeRuntime.schemaVersion, 1);
  assert.equal(arcadeRuntime.baselineId, arcadeInventory.candidateId);
  assert.equal(arcadeRuntime.inventoryStaticPaths, Object.keys(arcadeInventory.files).length);
  assert.equal(arcadeRuntime.publicConfigurationSnapshots.length, 1);
  const snapshot = arcadeRuntime.publicConfigurationSnapshots[0];
  assert.equal(snapshot.authenticated, false);
  assert.equal(snapshot.containsPlayerProgress, false);
  for (const file of arcadeRuntime.files) {
    assert.equal(digest(new URL(file.source, root)), file.sha1, `Captured baseline source ${file.path}`);
    if (arcadeInventory.files[file.path.toLowerCase()]) assert.equal(file.sha1, arcadeInventory.files[file.path.toLowerCase()]);
  }
  const approvedArcadeRuntimeChanges = [
    { path: '/assets/arcade/arcade-growth-wallet.js', previousSha: 'e987f3f338c6470575d17eb6daa4e31fe86d5a70',
      approvedSha: 'dc4a5e94e812069ad833c4b8d523f78d05d676d9' },
    { path: '/scripts/arcade-daily-growth-play-share.js', previousSha: 'b8ee5967f605229b2154c1b32d13e5244dc61dc4',
      approvedSha: 'f46f76ebb1a7b1bacfabe84137a12be3fd9e58d1' },
  ];
  const arcadeRuntimeReplacements = new Map([
    ['/scripts/arcade-monthly.js', { path: '/scripts/arcade-monthly.js', source: 'scripts/arcade-monthly.js',
      sha1: '1b3defc0bbb85265731f46084e367e7ad219defc' }],
  ]);
  for (const file of approvedArcadeRuntimeChanges) {
    const captured = arcadeRuntime.files.find(entry => entry.path === file.path);
    assert.equal(captured.source, 'production/arcade-organization-static/captured-runtime' + file.path);
    assert.equal(captured.sha1, file.previousSha, `Keep the original captured hash for ${file.path}`);
    assert.equal(arcadeInventory.files[file.path], file.previousSha);
    assert.notEqual(file.approvedSha, file.previousSha, 'The reviewed update must not masquerade as captured bytes.');
    arcadeRuntimeReplacements.set(file.path, { path: file.path,
      source: 'production/arcade-organization-static/runtime' + file.path, sha1: file.approvedSha });
  }
  const arcadeFiles = [...arcadeRuntime.files.map(file => arcadeRuntimeReplacements.get(file.path) || file), snapshot, ...arcadeOverlays];
  assert.equal(new Set(arcadeFiles.map(file => file.path)).size, arcadeFiles.length, 'Each Arcade preview path is reviewed once.');
  const arcadeExpected = new Map();
  for (const file of arcadeFiles) {
    assert(![...overlays, ...additions].includes(file.path), 'Arcade must not override an existing STI/multichain review path.');
    const sourceDigest = digest(new URL(file.source, root));
    if (file.sha1) assert.equal(sourceDigest, file.sha1, `Captured Arcade source ${file.path}`);
    const expected = file.path === '/play/index.html' ? verifiedArcadeHTMLDigest(root, snapshot) : file.sha1 || sourceDigest;
    arcadeExpected.set(file.path, expected);
    assert.equal(digest(new URL(`dist-preview${file.path}`, root)), expected, `Reviewed Arcade preview ${file.path}`);
  }
  for (const file of manifest.files) {
    assert.equal(digest(new URL(`dist${file.path}`, root)), file.sha1, `Production ${file.path}`);
    const expected = arcadeExpected.get(file.path) || ([...overlays, ...additions].includes(file.path) ? digest(new URL(file.path.slice(1), root)) : file.sha1);
    assert.equal(digest(new URL(`dist-preview${file.path}`, root)), expected, `Preview ${file.path}`);
  }
  for (const file of additions) assert.equal(digest(new URL(`dist-preview${file}`, root)), digest(new URL(file.slice(1), root)));
  const files = readdirSync(new URL('dist-preview/', root), { recursive: true, withFileTypes: true }).filter(f => f.isFile());
  const publicationPaths = ['/generation-publication/index.html', '/generation-publication/app.js', '/generation-slot/index.html', '/generation-slot/app.js', '/bnb-generation/index.html', '/bnb-generation/app.js', '/generation-registration/index.html', '/generation-registration/app.js', '/generation-configuration/index.html', '/generation-configuration/app.js', '/bnb-configuration/index.html', '/bnb-configuration/app.js', '/generation-binding/index.html', '/generation-binding/app.js', '/generation-reserve/index.html', '/generation-reserve/app.js', '/bnb-purchase/index.html', '/bnb-purchase/app.js', '/bnb-return/index.html', '/bnb-return/app.js'];
  for (const path of publicationPaths) assert.equal(digest(new URL('dist-preview'+path, root)), digest(new URL('tools'+path, root)), 'Only the reviewed publication handoff is added');
  const expectedPaths = new Set([...manifest.files.map(f => f.path), ...additions, ...arcadeExpected.keys(), ...publicationPaths]);
  const previewRoot = fileURLToPath(new URL('dist-preview/', root));
  const actualPaths = files.map(file => '/' + relative(previewRoot, resolve(file.parentPath, file.name)).split(sep).join('/'));
  assert.equal(files.length, expectedPaths.size);
  assert.deepEqual(actualPaths.sort(), [...expectedPaths].sort(), 'Preview contains exactly the historical snapshot and explicitly reviewed additions.');
  assert.ok(!files.some(f => /production|recovery|netlify\/functions/.test(f.parentPath.split('dist-preview')[1])));
});
