// Reuses the exact dependencies already pinned in vendor/nftree-mint/package-lock.json.
// Usage: node scripts/build-arcade-growth-wallet.mjs /path/to/isolated/node_modules
import { mkdtemp, cp, symlink, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const dependencies = resolve(process.argv[2] || '/tmp/arcade-nftree-vendor-build/node_modules');
const lock = JSON.parse(await readFile(join(root, 'vendor/nftree-mint/package-lock.json'), 'utf8'));
for (const name of ['@mysten/wallet-standard', '@wallet-standard/core', 'vite']) {
  const actual = JSON.parse(await readFile(join(dependencies, name, 'package.json'), 'utf8'));
  assert.equal(actual.version, lock.packages['node_modules/' + name].version, `Pinned ${name} version differs`);
}
const stage = await mkdtemp(join(tmpdir(), 'tree-growth-wallet-'));
try {
  await cp(join(root, 'vendor/arcade-growth-wallet'), stage, { recursive: true });
  await symlink(dependencies, join(stage, 'node_modules'), 'dir');
  await writeFile(join(stage, 'package.json'), '{"type":"module","private":true}\n');
  const { build } = await import(pathToFileURL(join(dependencies, 'vite/dist/node/index.js')));
  await build({ configFile: false, root: stage, publicDir: false,
    build: { emptyOutDir: true, sourcemap: false, license: { fileName: 'licenses.md' },
      lib: { entry: join(stage, 'client.js'), formats: ['es'], fileName: () => 'arcade-growth-wallet.js' },
      outDir: join(stage, 'build') } });
  const code = await readFile(join(stage, 'build/arcade-growth-wallet.js'), 'utf8');
  const licenses = await readFile(join(stage, 'build/licenses.md'), 'utf8');
  await writeFile(join(root, 'assets/arcade/arcade-growth-wallet.js'),
    '/*! TREE Arcade Daily Growth wallet: personal-message verification only.\n' + licenses.replaceAll('*/', '* /') + '\n*/\n' + code);
  console.log('Built the independent Daily Growth wallet module with pinned Wallet Standard dependencies.');
} finally { await rm(stage, { recursive: true, force: true }); }
