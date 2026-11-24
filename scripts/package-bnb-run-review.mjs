// Package exactly one isolated modern function. This script never deploys.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { config as runtimeConfig } from '../netlify/bnb-run-review-functions/arcade-bnb-run-review.mjs';
import { zipFunction } from '@netlify/zip-it-and-ship-it';

export const FUNCTION_NAME = 'arcade-bnb-run-review';
export const PACKAGE_SOURCES = [
  'netlify/bnb-run-review-functions/arcade-bnb-run-review.mjs',
  'scripts/multichain/bnb-test-auth-service.mjs',
  'scripts/multichain/bnb-game-access-core.mjs',
  'scripts/multichain/bnb-run-http.mjs',
  'scripts/multichain/bnb-run-authorization.mjs',
  'contracts/bnb-generation/scripts/run-authorization-adapter.mjs',
  'contracts/bnb-generation/scripts/generation-access.mjs',
];
export const PACKAGE_DIRECTORY = '.netlify/bnb-run-review-functions';
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
  const contractLock = fs.readFileSync(path.join(root,'contracts/bnb-generation/package-lock.json'));
  assert.equal(JSON.parse(contractLock).packages['node_modules/ethers'].version,'6.15.0');
  return { contractLockSha256:sha256(contractLock), ethers:'6.15.0', package: 'package.json', packageSha256: sha256(packageBytes),
    lock: 'package-lock.json', lockSha256: sha256(lockBytes),
    sui: '2.26.1', viem: '2.56.3', zipItAndShipIt: '16.3.0' };
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true,
    options: { outdir: { type: 'string', default: PACKAGE_DIRECTORY } } });
  assert.equal(positionals.length, 0, 'Usage: package-bnb-run-review.mjs [--outdir DIRECTORY]');
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
  // Prebundle across the two pinned dependency roots. ZISI alone externalizes
  // nested ethers imports without including their package at the output root.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'bnb-run-bundle-'));
  const bundled = await build({entryPoints:[path.join(ROOT,PACKAGE_SOURCES[0])],outfile:path.join(stage,'bundle.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',metafile:true,banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"}});
  const entry=path.join(stage, FUNCTION_NAME+'.mjs');
  fs.writeFileSync(entry, `export {default} from './bundle.mjs';\nexport const config=${JSON.stringify(runtimeConfig)};\n`);
  const built = await zipFunction(entry, directory, {
    basePath: stage, repositoryRoot: stage,
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
  assert(built.routes?.some(r=>r.pattern==='/api/arcade-bnb-test/run-review'), 'Route metadata missing');
  assert.deepEqual(built.trafficRules, {action:{type:'rate_limit',config:{rateLimitConfig:{windowLimit:20,windowSize:60,algorithm:'sliding_window'},aggregate:{keys:[{type:'domain'},{type:'ip'}]}}}}, 'Exact platform admission metadata required');
  const tracedFiles=Object.keys(bundled.metafile.inputs).map(f=>path.resolve(ROOT,f)).filter(f=>fs.existsSync(f)&&fs.statSync(f).isFile()).sort().map(f=>({path:path.relative(ROOT,f),sha256:sha256(fs.readFileSync(f))}));
  const smoke=fs.mkdtempSync(path.join(os.tmpdir(),'bnb-run-smoke-'));
  try {
    execFileSync('unzip',['-q',built.path,'-d',smoke]);
    execFileSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';
      import handler from './arcade-bnb-run-review.mjs';
      globalThis.Netlify={env:{get:()=> 'false'}};
      globalThis.fetch=()=>{throw Error('Unexpected network access')};
      const r=await handler(new Request('https://tree-token.xyz/api/arcade-bnb-test/run-review'));
      assert.equal(r.status,503);
      assert.deepEqual(await r.json(),{error:'review-disabled',gameplayAuthorized:false});
    `],{cwd:smoke,stdio:'pipe'});
  } finally {fs.rmSync(smoke,{recursive:true});}
  const bytes = fs.readFileSync(built.path);
  const manifest = { schemaVersion: 1, kind: 'bnb-run-review-package', name: FUNCTION_NAME,
    extractedZipSmokePassed: true, deployed: false, gameplayAuthorized: false, productionApproved: false, paymentsEnabled: false,
    filename: FUNCTION_NAME + '.zip', sha256: sha256(bytes), bytes: bytes.length,
    runtimeVersion: built.runtimeVersion, invocationMode: built.invocationMode,
    buildData: built.buildData, routes: built.routes, trafficRules: built.trafficRules,
    sourceFiles, tracedFiles, tooling };
  fs.rmSync(stage, {recursive:true});
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
