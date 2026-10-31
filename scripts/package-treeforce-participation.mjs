// Packages only the revised Daily Growth function for TREE FORCE participation.
// All other deployed function packages are preserved byte-for-byte.
// Usage: node scripts/package-treeforce-participation.mjs /path/to/isolated/node_modules
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const dependencies = resolve(process.argv[2] || '/tmp/arcade-growth-participation-backend-build/node_modules');
const destination = join(root, '.netlify/treeforce-participation-functions');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
for (const name of ['@mysten/sui', '@netlify/zip-it-and-ship-it']) {
  const installed = JSON.parse(await readFile(join(dependencies, name, 'package.json'), 'utf8'));
  assert.equal(installed.version, lock.packages['node_modules/' + name].version, `Pinned ${name} version changed`);
}
const isolatedLock = JSON.parse(await readFile(join(root, 'vendor/arcade-growth-backend/package-lock.json'), 'utf8'));
for (const [path, entry] of Object.entries(lock.packages)) {
  if (path) assert.deepEqual(isolatedLock.packages[path], entry, `Existing dependency changed: ${path}`);
}
for (const name of ['pg', '@netlify/database']) {
  const installed = JSON.parse(await readFile(join(dependencies, name, 'package.json'), 'utf8'));
  assert.equal(installed.version, isolatedLock.packages['node_modules/' + name].version, `Pinned ${name} changed`);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function validateZip(bytes) {
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  assert(end >= 0, 'ZIP directory is missing');
  const entries = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  assert(entries > 0 && entries < 65535 && cursor + bytes.readUInt32LE(end + 12) === end, 'Unexpected ZIP directory');
  const names = [];
  for (let index = 0; index < entries; index++) {
    assert(cursor + 46 <= end && bytes.readUInt32LE(cursor) === 0x02014b50, 'Invalid ZIP directory entry');
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const next = cursor + 46 + nameLength + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
    assert(next <= end, 'Invalid ZIP entry length');
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    assert(!name.startsWith('/') && !name.includes('\\') && !name.includes('\0') && !name.split('/').includes('..'), 'Unsafe ZIP path');
    assert(((bytes.readUInt32LE(cursor + 38) >>> 16) & 0xf000) !== 0xa000, 'External dependency symlink in ZIP');
    names.push(name); cursor = next;
  }
  assert(cursor === end && names.some(name => name.includes('@mysten/sui/dist/verify/')), 'Packaged verifier is missing');
}
const stage = await mkdtemp(join(tmpdir(), 'tree-growth-function-'));
try {
  await mkdir(join(stage, 'netlify/functions'), { recursive: true });
  await cp(join(root, 'netlify/lib'), join(stage, 'netlify/lib'), { recursive: true });
  for (const path of ['netlify/functions/arcade-growth.ts', 'netlify/functions/nftree-wallet.ts']) {
    await cp(join(root, path), join(stage, path));
  }
  for (const path of ['package.json', 'package-lock.json']) {
    await cp(join(root, 'vendor/arcade-growth-backend', path), join(stage, path));
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
  validateZip(await readFile(built.path));
  const paths = new Set(['package.json', 'package-lock.json', 'vendor/arcade-growth-backend/package.json', 'vendor/arcade-growth-backend/package-lock.json', 'netlify/lib/arcade-pg.d.ts']);
  for (const input of built.inputs || []) {
    const path = relative(stage, input).split(sep).join('/');
    if (!path.startsWith('../') && path !== 'node_modules' && !path.startsWith('node_modules/')) paths.add(path);
  }
  assert(paths.has('netlify/functions/arcade-growth.ts'), 'Packager did not report the function source input');
  const sourceFiles = [];
  for (const path of [...paths].sort()) sourceFiles.push({ path, sha256: hash(await readFile(join(root, path))) });
  const manifest = { version: 1, packager: { name: '@netlify/zip-it-and-ship-it', version: '16.3.0' },
    name: built.name, path: '.netlify/treeforce-participation-functions/arcade-growth.zip',
    sha256: hash(await readFile(built.path)), runtimeVersion: built.runtimeVersion,
    invocationMode: built.invocationMode, buildData: built.buildData, routes: built.routes,
    ...(built.trafficRules ? { trafficRules: built.trafficRules } : {}), sourceFiles };
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(root, 'docs/treeforce-participation-function.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ name: manifest.name, sha256: manifest.sha256, runtimeVersion: manifest.runtimeVersion,
    invocationMode: manifest.invocationMode, routes: manifest.routes, sourceFiles: sourceFiles.length }));
} finally { await rm(stage, { recursive: true, force: true }); }
