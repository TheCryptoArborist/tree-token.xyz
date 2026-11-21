// Package exactly one isolated modern function. This script never deploys.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { zipFunction } from '@netlify/zip-it-and-ship-it';

export const FUNCTION_NAME = 'arcade-bnb-test';
export const PACKAGE_SOURCES = [
  'netlify/bnb-test-functions/arcade-bnb-test.mjs',
  'scripts/multichain/bnb-test-auth-service.mjs',
  'scripts/multichain/bnb-game-access-core.mjs',
  'scripts/multichain/bnb-backing-reader.mjs',
];
export const PACKAGE_DIRECTORY = '.netlify/bnb-backing-functions';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export function sourceEvidence(root = ROOT) {
  return PACKAGE_SOURCES.map(source => {
    const filename = path.join(root, source), stat = fs.lstatSync(filename);
    assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular isolated function source required.');
    return { path: source, sha256: sha256(fs.readFileSync(filename)) };
  });
}

export function toolingEvidence(root = ROOT) {
  const packageBytes = fs.readFileSync(path.join(root, 'package.json'));
  const lockBytes = fs.readFileSync(path.join(root, 'package-lock.json'));
  const pkg = JSON.parse(packageBytes), lock = JSON.parse(lockBytes);
  assert.equal(pkg.dependencies.viem, '2.56.3');
  assert.equal(lock.packages['node_modules/@mysten/sui'].version, '2.26.1');
  assert.equal(pkg.devDependencies['@netlify/zip-it-and-ship-it'], '16.3.0');
  assert.equal(lock.packages['node_modules/viem'].version, '2.56.3');
  assert.equal(lock.packages['node_modules/@netlify/zip-it-and-ship-it'].version, '16.3.0');
  return { package: 'package.json', packageSha256: sha256(packageBytes),
    lock: 'package-lock.json', lockSha256: sha256(lockBytes),
    sui: '2.26.1', viem: '2.56.3', zipItAndShipIt: '16.3.0' };
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true,
    options: { outdir: { type: 'string', default: PACKAGE_DIRECTORY } } });
  assert.equal(positionals.length, 0, 'Usage: package-bnb-backing.mjs [--outdir DIRECTORY]');
  const directory = path.resolve(ROOT, values.outdir);
  assert.notEqual(directory, ROOT, 'Use an isolated package output directory.');
  const sourceFiles = sourceEvidence(), tooling = toolingEvidence();
  for (const [name, version] of [['@mysten/sui', tooling.sui], ['viem', tooling.viem], ['@netlify/zip-it-and-ship-it', tooling.zipItAndShipIt]]) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'))).version, version,
      'Install the unchanged root lock before packaging.');
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const manifestPath = path.join(directory, 'manifest.json');
  assert(!fs.existsSync(manifestPath) && !fs.existsSync(path.join(directory, FUNCTION_NAME + '.zip')),
    'Package output already exists; use a fresh directory rather than replacing reviewed bytes.');
  const built = await zipFunction(path.join(ROOT, PACKAGE_SOURCES[0]), directory, {
    basePath: ROOT, repositoryRoot: ROOT,
    config: { '*': { nodeBundler: 'esbuild', nodeVersion: '24.x' } },
  });
  assert.equal(built.name, FUNCTION_NAME);
  assert.equal(built.runtimeVersion, 'nodejs24.x');
  assert.equal(built.invocationMode, 'stream');
  assert.equal(built.schedule, undefined, 'No new schedule is approved.');
  assert.equal(built.buildData?.runtimeAPIVersion, 2);
  assert.equal(built.buildData?.bootstrapVersion, '2.24.0');
  assert.deepEqual(sourceEvidence(), sourceFiles, 'Source changed while packaging.');
  assert.deepEqual(toolingEvidence(), tooling, 'Dependency lock changed while packaging.');
  const bytes = fs.readFileSync(built.path);
  const manifest = { schemaVersion: 1, kind: 'bnb-backing-review-package', name: FUNCTION_NAME,
    deployed: false, gameplayAuthorized: false, productionApproved: false, paymentsEnabled: false,
    filename: FUNCTION_NAME + '.zip', sha256: sha256(bytes), bytes: bytes.length,
    runtimeVersion: built.runtimeVersion, invocationMode: built.invocationMode,
    buildData: built.buildData, routes: built.routes, trafficRules: built.trafficRules,
    sourceFiles, tooling };
  fs.chmodSync(built.path, 0o600);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ name: manifest.name, sha256: manifest.sha256, bytes: manifest.bytes,
    runtimeVersion: manifest.runtimeVersion, invocationMode: manifest.invocationMode,
    manifest: path.relative(ROOT, manifestPath), deployed: false }));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
