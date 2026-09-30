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
  const reviewedReleaseDelta = new Set(['/play/index.html']);
  assert.deepEqual(
    manifest.files.filter(f => !reviewedReleaseDelta.has(f.path)).map(f => [f.path, f.sha1]).sort(),
    published.files.filter(f => !reviewedReleaseDelta.has(f.path)).map(f => [f.path, f.sha]).sort(),
  );
  for (const path of reviewedReleaseDelta) {
    assert.notEqual(manifest.files.find(f => f.path === path)?.sha1, published.files.find(f => f.path === path)?.sha);
  }
  const overlays = ['/dapp/index.html', '/dapp/styles.css', '/dapp/panel-router.css', '/dapp/interaction-bootstrap.js', '/scripts/wallet.js', '/scripts/tree-knowledge-trial.js'];
  const additions = ['/dapp/sti-widget.js', '/dapp/sti-purchase-core.js', '/dapp/sti-stats-core.js', '/dapp/challenge-funding-core.js', '/assets/sti-icon.svg'];
  additions.push('/gateway/index.html', '/gateway/style.css', '/gateway/app.js', '/gateway/options.js', '/gateway/entry.js');
  additions.push('/gateway/review-core.js');
  const digest = file => createHash('sha1').update(readFileSync(file)).digest('hex');
  for (const file of manifest.files) {
    assert.equal(digest(new URL(`dist${file.path}`, root)), file.sha1, `Production ${file.path}`);
    const previewFile = new URL(`dist-preview${file.path}`, root);
    let previewText = readFileSync(previewFile, 'utf8');
    // Strip the reviewed Bridge navigation overlay before comparing baseline bytes.
    if (file.path === '/dapp/panel-router.js') {
      assert.equal(previewText.split("  'bridge',").length, 2);
      assert.equal(previewText.split("  bridge: 'Bridge',").length, 2);
      previewText = previewText.replace("  'swap',\n  'bridge',", "  'swap',").replace("  swap: 'Swap',\n  bridge: 'Bridge',", "  swap: 'Swap',");
    }
    if (file.path === '/dapp/panel-router.css') {
      previewText = previewText.replace('width:770px;max-width:100%;grid-template-columns:repeat(11,minmax(0,1fr))', 'width:700px;max-width:100%;grid-template-columns:repeat(10,minmax(0,1fr))').replace('repeat(11,70px)', 'repeat(10,70px)').replace('.app-tabbed #swap,.app-tabbed #bridge,.app-tabbed #limit', '.app-tabbed #swap,.app-tabbed #limit');
    }
    if (file.path === '/dapp/index.html') {
      previewText = previewText.replace('<a href="#bridge"><span aria-hidden="true">↗</span><b>Bridge</b></a>\n      <a href="#limit">', '<a href="#limit">').replace('<main>\n<section class="section compact-section app-panel" id="bridge" aria-labelledby="bridge-title" hidden><h2 id="bridge-title">TREE Gateway <small>Preview</small></h2><div id="tree-gateway-bridge"></div></section>', '<main>');
    }
    let previewDigest = ['/dapp/panel-router.js', '/dapp/panel-router.css', '/dapp/index.html'].includes(file.path) ? createHash('sha1').update(previewText).digest('hex') : digest(previewFile);
    if (['/index.html', '/dapp/index.html'].includes(file.path)) {
      const marker = '<script type="module" src="/gateway/entry.js"></script>';
      const html = previewText;
      assert.equal(html.split(marker).length, 2, 'Exactly one preview Gateway link loader');
      previewDigest = createHash('sha1').update(html.replace(marker, '')).digest('hex');
    }
    assert.equal(previewDigest, [...overlays, ...additions].includes(file.path) ? digest(new URL(file.path.slice(1), root)) : file.sha1, `Preview ${file.path}`);
  }
  for (const file of additions) assert.equal(digest(new URL(`dist-preview${file}`, root)), digest(new URL(file.slice(1), root)));
  const files = readdirSync(new URL('dist-preview/', root), { recursive: true, withFileTypes: true }).filter(f => f.isFile());
  assert.equal(files.length, new Set([...manifest.files.map(f => f.path), ...additions, '/gateway/wallet-bundle.js']).size);
  assert.ok(readFileSync(new URL('dist-preview/gateway/wallet-bundle.js', root), 'utf8').length > 1000);
  assert.ok(!files.some(f => /production|recovery|netlify\/functions/.test(f.parentPath.split('dist-preview')[1])));
});
