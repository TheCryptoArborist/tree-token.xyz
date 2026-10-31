// Packages only the new Daily Growth function. Never rebuilds a deployed handler.
// Usage: node scripts/package-arcade-growth.mjs /path/to/isolated/node_modules
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const dependencies = resolve(process.argv[2] || '/tmp/arcade-growth-backend-build/node_modules');
const destination = join(root, '.netlify/arcade-growth-functions');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
for (const name of ['@mysten/sui', '@netlify/zip-it-and-ship-it']) {
  const installed = JSON.parse(await readFile(join(dependencies, name, 'package.json'), 'utf8'));
  assert.equal(installed.version, lock.packages['node_modules/' + name].version, `Pinned ${name} version changed`);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stage = await mkdtemp(join(tmpdir(), 'tree-growth-function-'));
try {
  await mkdir(join(stage, 'netlify/functions'), { recursive: true });
  await cp(join(root, 'netlify/lib'), join(stage, 'netlify/lib'), { recursive: true });
  for (const path of ['netlify/functions/arcade-growth.ts', 'netlify/functions/nftree-wallet.ts', 'package.json', 'package-lock.json']) {
    await cp(join(root, path), join(stage, path));
  }
  // The function uses lazy SDK imports. Give the tracer physical dependencies;
  // an external node_modules symlink would otherwise be archived as a broken link.
  await cp(dependencies, join(stage, 'node_modules'), { recursive: true, dereference: true });
  await mkdir(destination, { recursive: true });
  const { zipFunction } = await import(pathToFileURL(join(dependencies, '@netlify/zip-it-and-ship-it/dist/main.js')));
  const built = await zipFunction(join(stage, 'netlify/functions/arcade-growth.ts'), destination, {
    basePath: stage, repositoryRoot: stage,
    config: { '*': { nodeBundler: 'esbuild', nodeVersion: '22.x' } },
  });
  assert.equal(built?.name, 'arcade-growth');
  assert.equal(built.runtimeVersion, 'nodejs22.x');
  assert.equal(built.invocationMode, 'stream');
  assert.equal(built.schedule, undefined);
  execFileSync('python3', ['-c', `import sys, stat
from pathlib import PurePosixPath
from zipfile import ZipFile
with ZipFile(sys.argv[1]) as archive:
    names = archive.namelist()
    assert any('@mysten/sui/dist/verify/' in name for name in names), 'Packaged verifier is missing'
    for entry in archive.infolist():
        path = PurePosixPath(entry.filename)
        assert not path.is_absolute() and '..' not in path.parts, 'Unsafe ZIP path'
        assert not stat.S_ISLNK(entry.external_attr >> 16), 'External dependency symlink in ZIP'
`, built.path], { stdio: 'pipe' });
  const paths = new Set(['package.json', 'package-lock.json']);
  for (const input of built.inputs || []) {
    const path = relative(stage, input).split(sep).join('/');
    if (!path.startsWith('../') && path !== 'node_modules' && !path.startsWith('node_modules/')) paths.add(path);
  }
  assert(paths.has('netlify/functions/arcade-growth.ts'), 'Packager did not report the function source input');
  const sourceFiles = [];
  for (const path of [...paths].sort()) sourceFiles.push({ path, sha256: hash(await readFile(join(root, path))) });
  const manifest = { version: 1, packager: { name: '@netlify/zip-it-and-ship-it', version: '16.3.0' },
    name: built.name, path: '.netlify/arcade-growth-functions/arcade-growth.zip',
    sha256: hash(await readFile(built.path)), runtimeVersion: built.runtimeVersion,
    invocationMode: built.invocationMode, buildData: built.buildData, routes: built.routes,
    ...(built.trafficRules ? { trafficRules: built.trafficRules } : {}), sourceFiles };
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(root, 'docs/arcade-growth-function.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ name: manifest.name, sha256: manifest.sha256, runtimeVersion: manifest.runtimeVersion,
    invocationMode: manifest.invocationMode, routes: manifest.routes, sourceFiles: sourceFiles.length }));
} finally { await rm(stage, { recursive: true, force: true }); }
