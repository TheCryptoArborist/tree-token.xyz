// Build one isolated function for review. This script has no deployment operation.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const destination = path.join(root, '.netlify/arcade-challenge-pilot-functions');
const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'arcade-challenge-pilot-'));
const sources = [
  'netlify/challenge-functions/arcade-challenge-pilot.mjs',
  'scripts/arcade-campaigns/core.mjs',
  'scripts/arcade-campaigns/pilot-errors.mjs',
  'scripts/arcade-campaigns/pilot-auth.mjs',
  'scripts/arcade-campaigns/pilot-rpc.mjs',
  'scripts/arcade-campaigns/pilot-rules.mjs',
  'scripts/arcade-campaigns/trials-adapter.mjs',
  'vendor/arcade-trials-engine/provenance.json',
  ...['card-catalog', 'challenge-rules', 'practice-battle', 'trial-engine', 'trial-game'].map(name => 'vendor/arcade-trials-engine/runtime/' + name + '.mjs'),
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const sourceFiles = [];
  for (const file of sources) {
    const bytes = await fs.readFile(path.join(root, file));
    await fs.mkdir(path.dirname(path.join(stage, file)), { recursive: true });
    await fs.writeFile(path.join(stage, file), bytes);
    sourceFiles.push({ path: file, sha256: sha(bytes) });
  }
  // Copy the already pinned authentication dependency tree into this isolated
  // stage. The SDK is bundled; no install or dependency upgrade occurs here.
  const authVendor = path.join(root, 'vendor/arcade-monthly');
  const authPackage = await fs.readFile(path.join(authVendor, 'package.json'));
  const authLock = await fs.readFile(path.join(authVendor, 'package-lock.json'));
  const sdk = JSON.parse(await fs.readFile(path.join(authVendor, 'node_modules/@mysten/sui/package.json'), 'utf8'));
  assert.equal(sdk.version, '2.26.1');
  assert.equal(JSON.parse(authPackage).dependencies['@mysten/sui'], sdk.version);
  assert.equal(JSON.parse(authLock).packages['node_modules/@mysten/sui'].version, sdk.version);
  const stagedAuthVendor = path.join(stage, 'vendor/arcade-monthly');
  await fs.mkdir(stagedAuthVendor, { recursive: true });
  await fs.writeFile(path.join(stagedAuthVendor, 'package.json'), authPackage);
  await fs.writeFile(path.join(stagedAuthVendor, 'package-lock.json'), authLock);
  await fs.cp(path.join(authVendor, 'node_modules'), path.join(stage, 'node_modules'), { recursive: true, dereference: true });
  await fs.symlink('../../node_modules', path.join(stagedAuthVendor, 'node_modules'), 'dir');
  // Keep the existing event-build tooling; only the verifier's runtime imports
  // are reachable from the function entry point.
  await fs.writeFile(path.join(stage, 'package.json'), authPackage);
  await fs.writeFile(path.join(stage, 'package-lock.json'), authLock);
  const { zipFunction } = await import(pathToFileURL(path.join(root, 'vendor/arcade-events/node_modules/@netlify/zip-it-and-ship-it/dist/main.js')));
  await fs.mkdir(destination, { recursive: true });
  const built = await zipFunction(path.join(stage, sources[0]), destination, { basePath: stage, repositoryRoot: stage, config: { '*': { nodeBundler: 'esbuild', nodeVersion: '24.x' } } });
  assert.equal(built.name, 'arcade-challenge-pilot');
  assert.equal(built.runtimeVersion, 'nodejs24.x');
  assert.equal(built.invocationMode, 'stream');
  assert.equal(built.schedule, undefined);
  const manifest = {
    schemaVersion: 1, kind: 'arcade-challenge-pilot-review-package', deployed: false,
    productionEnabled: false, payable: false, awardsEnabled: false,
    name: built.name, path: '.netlify/arcade-challenge-pilot-functions/arcade-challenge-pilot.zip',
    sha256: sha(await fs.readFile(built.path)), runtimeVersion: built.runtimeVersion,
    invocationMode: built.invocationMode, buildData: built.buildData, routes: built.routes, trafficRules: built.trafficRules,
    sourceFiles,
    tooling: { package: 'vendor/arcade-events/package.json', packageSha256: sha(await fs.readFile(path.join(root, 'vendor/arcade-events/package.json'))), lockSha256: sha(await fs.readFile(path.join(root, 'vendor/arcade-events/package-lock.json'))) },
    authTooling: { package: 'vendor/arcade-monthly/package.json', packageSha256: sha(authPackage), lock: 'vendor/arcade-monthly/package-lock.json', lockSha256: sha(authLock), sdk: '@mysten/sui', sdkVersion: sdk.version },
  };
  await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ name: manifest.name, sha256: manifest.sha256, runtimeVersion: manifest.runtimeVersion, routes: manifest.routes, deployed: false }));
} finally {
  await fs.rm(stage, { recursive: true, force: true });
}
