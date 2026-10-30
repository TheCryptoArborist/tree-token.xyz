import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('production build stays byte-exact and STI preview changes only reviewed files', () => {
  const root = new URL('../', import.meta.url);
  for (const script of ['build-production-snapshot.mjs', 'build-feature-preview.mjs']) {
    execFileSync(process.execPath, [`scripts/${script}`], { cwd: root });
  }
  const manifest = JSON.parse(readFileSync(new URL('production/manifest.json', root)));
  const published = JSON.parse(readFileSync(new URL('production/current-release.json', root)));
  // The historical published release remains immutable. Only this explicitly
  // reviewed HTML (navigation, contract-expiration display, and VICTORY layout) may differ from that baseline.
  const approvedNavigationChange = {
    path: '/dapp/index.html',
    previousSha: '764e53ff209b4ae89cf4aefcbd2a8907d4ef75d9',
    approvedSha: '453ecf04192cd4c3e5afe50e00acc7f43bb79dc3',
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
  const approvedVictoryLayout = {
    path: '/dapp/victory-center.css',
    previousSha: 'ed5155ef72a64e5bc3bc5f8479832f4f47e9045e',
    approvedSha: 'a6506760d84867a074bbaa013d6679ee727cb46c',
  };
  assert.equal(published.files.find(f => f.path === approvedVictoryLayout.path)?.sha, approvedVictoryLayout.previousSha);
  assert.equal(manifest.files.find(f => f.path === approvedVictoryLayout.path)?.sha1, approvedVictoryLayout.approvedSha);
  const approvedPaths = [approvedNavigationChange.path, approvedSwapChange.path, approvedVictoryReceipt.path, approvedVictoryLayout.path];
  assert.deepEqual(
    manifest.files.filter(f => !approvedPaths.includes(f.path)).map(f => [f.path, f.sha1]).sort(),
    published.files.filter(f => !approvedPaths.includes(f.path)).map(f => [f.path, f.sha]).sort(),
  );
  const overlays = ['/dapp/v3-workspace.js', '/dapp/index.html', '/dapp/styles.css', '/dapp/panel-router.css', '/dapp/interaction-bootstrap.js', '/scripts/wallet.js', '/scripts/tree-knowledge-trial.js'];
  const additions = ['/dapp/sti-widget.js', '/dapp/sti-purchase-core.js', '/dapp/sti-stats-core.js', '/dapp/challenge-funding-core.js', '/assets/sti-icon.svg'];
  const digest = file => createHash('sha1').update(readFileSync(file)).digest('hex');
  for (const file of manifest.files) {
    assert.equal(digest(new URL(`dist${file.path}`, root)), file.sha1, `Production ${file.path}`);
    assert.equal(digest(new URL(`dist-preview${file.path}`, root)), [...overlays, ...additions].includes(file.path) ? digest(new URL(file.path.slice(1), root)) : file.sha1, `Preview ${file.path}`);
  }
  for (const file of additions) assert.equal(digest(new URL(`dist-preview${file}`, root)), digest(new URL(file.slice(1), root)));
  const files = readdirSync(new URL('dist-preview/', root), { recursive: true, withFileTypes: true }).filter(f => f.isFile());
  assert.equal(files.length, new Set([...manifest.files.map(f => f.path), ...additions]).size);
  assert.ok(!files.some(f => /production|recovery|netlify\/functions/.test(f.parentPath.split('dist-preview')[1])));
});
