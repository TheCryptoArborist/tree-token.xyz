import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, fingerprint, environmentFor, readToken } from './release-preserved-production.mjs';
import { apiClient } from './release-sti-purchase.mjs';
import { SITE_ID, ACCOUNT_ID, fileInventory, publicUploadPath } from './release-stats-market.mjs';
import { scopedAPI, validateBackend, compareBackend as compareExistingBackend, functionsConfig,
  assertNewCandidate, activeDeploys, waitForAllBuilds, packageTrafficRules } from './release-arcade-cutoff.mjs';
import { assertServedContent } from './rootcaster-served-content.mjs';
import { verifyDelivery } from './multichain-preview-delivery.mjs';
import { FUNCTION_NAME, PACKAGE_SOURCES, PACKAGE_DIRECTORY, sourceEvidence, toolingEvidence,
  sha256, ROOT } from './package-bnb-test-auth.mjs';

// One additive backend and two new static files. Existing production packages,
// provider records, schedules, settings and environment are never rebuilt or edited.
export { SITE_ID, ACCOUNT_ID, FUNCTION_NAME, scopedAPI, assertNewCandidate, activeDeploys, waitForAllBuilds };
export const BASELINE_ID = '6b01217f8e1995306b794031';
export const BASELINE_STATIC_FILES = 649;
export const BASELINE_FUNCTIONS = 50;
export const DATABASE_READINESS = 'docs/multichain/bnb-test-auth-database-readiness.json';
export const DELIVERY_SOURCES = {
  '/play/multichaintest/game/bnb/index.html': 'play/multichaintest/game/bnb/index.html',
  '/play/multichaintest/game/bnb/app.js': 'play/multichaintest/game/bnb/app.js',
};
export const ADDED_PATHS = Object.keys(DELIVERY_SOURCES).sort();
export const EXPECTED_ROUTES = [{ pattern: '/api/arcade-bnb-test', literal: '/api/arcade-bnb-test', methods: [] }];
export const EXPECTED_TRAFFIC = { action: { type: 'rate_limit', config: {
  aggregate: { keys: [{ type: 'domain' }, { type: 'ip' }] },
  rate_limit_config: { algorithm: 'sliding_window', window_size: 60, window_limit: 60 },
} } };
const DEFAULT_DIRECTORY = '.netlify/bnb-test-auth-release';
const RUNTIME_FIELDS = ['branch', 'context', 'functions_region', 'functions_region_overrides',
  'database_branch_id', 'blobs_region', 'framework', 'edge_functions_present', 'server', 'database_migrations'];
const SOURCE_PATHS = [...Object.values(DELIVERY_SOURCES), ...PACKAGE_SOURCES, 'package.json', 'package-lock.json',
  DATABASE_READINESS,
  'scripts/package-bnb-test-auth.mjs', 'scripts/release-bnb-test-auth.mjs',
  'scripts/check-bnb-test-auth-browser.mjs', 'scripts/check-bnb-test-auth-live.mjs',
  'tests/multichain-bnb-test-auth-release.test.mjs', 'tests/multichain-bnb-test-runtime.test.mjs',
  'tests/multichain-bnb-test-live-checker.test.mjs',
  'tests/multichain-bnb-test-auth-service.test.mjs', 'tests/multichain-bnb-game-access.test.mjs',
  '.github/workflows/publish-bnb-test-auth.yml',
  'scripts/release-preserved-production.mjs', 'scripts/release-sti-purchase.mjs',
  'scripts/release-stats-market.mjs', 'scripts/release-arcade-cutoff.mjs',
  'scripts/rootcaster-served-content.mjs', 'scripts/stats-market-delivery.mjs',
  'scripts/multichain-preview-delivery.mjs'];
const eq = (actual, expected, label) => assert.equal(canonical(actual), canonical(expected), label + ' changed; stop.');
const sorted = (rows, key) => [...rows].sort((a, b) => a[key].localeCompare(b[key]));
const safeId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const safeHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safeCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const originFor = id => { assert(safeId(id)); return `https://${id}--tree-token.netlify.app`; };

export function validatePackage(pack, zipBytes, root = ROOT) {
  assert.equal(pack.schemaVersion, 1); assert.equal(pack.kind, 'bnb-test-auth-review-package');
  assert.equal(pack.name, FUNCTION_NAME); assert.equal(pack.filename, FUNCTION_NAME + '.zip');
  for (const flag of ['deployed', 'gameplayAuthorized', 'paymentsEnabled']) assert.equal(pack[flag], false);
  assert.equal(pack.runtimeVersion, 'nodejs24.x'); assert.equal(pack.invocationMode, 'stream');
  eq(pack.buildData, { bootstrapVersion: '2.24.0', runtimeAPIVersion: 2 }, 'Modern function bootstrap');
  eq(pack.routes, EXPECTED_ROUTES, 'New function route allowlist');
  eq(packageTrafficRules(pack.trafficRules), EXPECTED_TRAFFIC, 'New function rate limit');
  eq(pack.sourceFiles, sourceEvidence(root), 'Exact isolated function source closure');
  eq(pack.tooling, toolingEvidence(root), 'Pinned package dependencies and tooling');
  assert.equal(pack.sha256, sha256(zipBytes), 'Reviewed function ZIP bytes changed.');
  assert.equal(pack.bytes, zipBytes.length, 'Reviewed function ZIP size changed.');
  assert(zipBytes.length > 0 && safeHash(pack.sha256));
  return structuredClone(pack);
}

export function compareBackend(actual, expected, pack = null, pinnedRecord) {
  validateBackend(actual); validateBackend(expected);
  assert.equal(expected.available_functions.length, BASELINE_FUNCTIONS, 'Expected all 50 original functions.');
  assert.equal(expected.function_schedules.length, 5, 'Expected five original schedules.');
  assert(!expected.available_functions.some(f => f.n === FUNCTION_NAME), 'BNB function already exists; capture a new reviewed scope.');
  if (!pack) {
    compareExistingBackend(actual, expected);
    eq(sorted(actual.available_functions, 'n'), sorted(expected.available_functions, 'n'), 'Every complete existing provider record');
    return null;
  }
  assert.equal(actual.available_functions.length, BASELINE_FUNCTIONS + 1, 'Exactly one new function is approved.');
  const added = actual.available_functions.filter(f => f.n === FUNCTION_NAME);
  assert.equal(added.length, 1, 'The one approved BNB function is missing or duplicated.');
  const preserved = { ...actual, available_functions: actual.available_functions.filter(f => f.n !== FUNCTION_NAME) };
  compareExistingBackend(preserved, expected);
  eq(sorted(preserved.available_functions, 'n'), sorted(expected.available_functions, 'n'), 'Every original complete provider record');
  const f = added[0];
  assert.equal(f.d, pack.sha256); assert.equal(f.s, pack.bytes);
  assert.equal(f.r, 'nodejs24.x'); assert.equal(f.im, 'stream'); assert.equal(f.rg, 'us-east-2');
  assert.equal(f.m, 1024); assert(f.mo == null && f.rgo == null && f.vcpu == null, 'Unapproved compute or region override.');
  assert(safeHash(f.id) && safeHash(f.oid) && /^\d{12}$/.test(f.a) && Number.isFinite(Date.parse(f.c)), 'Incomplete new provider identity.');
  assert(!f.er?.length && !f.es?.length && f.p == null && f.dn == null && f.g == null, 'Unapproved route, event or priority setting.');
  eq(f.bd, pack.buildData, 'New function bootstrap');
  // For an unrestricted route the API may serialize an empty method list as
  // null. Permit only that representation on the new record's initial pin.
  eq(f.ro?.map(r => ({ ...r, m: r.m ?? [] })), pack.routes.map(r => ({ p: r.pattern, l: r.literal, e: null, m: r.methods, ps: false })), 'New function route');
  eq(f.tr, EXPECTED_TRAFFIC, 'New function rate limit');
  if (pinnedRecord !== undefined) eq(f, pinnedRecord, 'Pinned complete new provider record');
  return structuredClone(f);
}

export function validateBaseline(baseline) {
  assert.equal(baseline.schemaVersion, 1); assert.equal(baseline.siteId, SITE_ID); assert.equal(baseline.accountId, ACCOUNT_ID);
  assert.equal(baseline.deploy?.id, BASELINE_ID, 'The exact newly captured live baseline is required.');
  assert.equal(baseline.deploy.state, 'ready'); assert.equal(baseline.deploy.locked, true);
  compareBackend(baseline.deploy, baseline.deploy);
  const files = fileInventory(Object.entries(baseline.files).map(([path, sha]) => ({ path, sha })));
  assert.equal(Object.keys(files).length, BASELINE_STATIC_FILES, 'Incomplete current static inventory.');
  for (const pathname of ['/index.html', '/play/index.html', '/play/multichaintest/original/sui/ack/index.html']) {
    assert(files[pathname], 'Missing protected current path: ' + pathname);
  }
  for (const pathname of ADDED_PATHS) assert(!Object.hasOwn(files, pathname), 'The new page already exists.');
  assert(baseline.environment?.site?.entries > 0 && safeHash(baseline.environment.snippetsSha256), 'Protected environment evidence is missing.');
  return files;
}

export function assembleFiles(baselineFiles, overlays) {
  fileInventory(Object.entries(baselineFiles).map(([path, sha]) => ({ path, sha })));
  const files = { ...baselineFiles }, sources = {};
  for (const item of overlays) {
    const pathname = publicUploadPath(item.path);
    assert(Object.hasOwn(DELIVERY_SOURCES, pathname), 'Unapproved public upload.');
    assert(!Object.hasOwn(baselineFiles, pathname), 'An existing published path must never be replaced.');
    assert(!Object.hasOwn(sources, pathname), 'Duplicate or case-colliding overlay.');
    assert.equal(item.source, DELIVERY_SOURCES[pathname], 'Unapproved public source.');
    assert(/^[a-f0-9]{40}$/.test(item.sha1), 'Invalid public SHA1.');
    files[pathname] = item.sha1; sources[pathname] = item.source;
  }
  eq(Object.keys(sources).sort(), ADDED_PATHS, 'Exactly two approved public additions');
  eq(Object.fromEntries(Object.keys(baselineFiles).map(p => [p, files[p]])), baselineFiles, 'All original static bytes');
  return { files, sources, changedOriginals: [], addedPaths: [...ADDED_PATHS] };
}

export function validateUploadRequirements(deploy, plan) {
  for (const key of ['required', 'required_functions', 'required_edge_functions', 'required_server']) {
    assert(Array.isArray(deploy[key]), 'Missing upload requirement inventory: ' + key);
    assert.equal(new Set(deploy[key]).size, deploy[key].length, 'Duplicate upload requirement.');
  }
  assert.equal(deploy.required_edge_functions.length, 0, 'No edge function is approved.');
  assert.equal(deploy.required_server.length, 0, 'No server bundle is approved.');
  assert(deploy.required_functions.every(digest => digest === plan.functionPackage.sha256), 'An existing or unapproved function upload was requested.');
  for (const digest of deploy.required) assert(Object.keys(plan.sources).some(p => plan.files[p] === digest), 'An existing or unapproved static upload was requested.');
}

export function createDeployPayload(baseline, plan) {
  // Only documented deployFiles properties. Source identity remains pinned in
  // the plan, candidate record, browser review and remote-main guards.
  return {
    files: plan.files,
    functions: { ...Object.fromEntries(baseline.deploy.available_functions.map(f => [f.n, f.d])), [FUNCTION_NAME]: plan.functionPackage.sha256 },
    functions_config: { ...functionsConfig(baseline.deploy), [FUNCTION_NAME]: {
      build_data: plan.functionPackage.buildData, routes: plan.functionPackage.routes,
      traffic_rules: EXPECTED_TRAFFIC,
    } },
    function_schedules: baseline.deploy.function_schedules,
    draft: false, async: false, branch: 'main',
  };
}

export function validateBrowserReview(report, plan, state, now = Date.now()) {
  assert.equal(report.passed, true); assert.equal(report.noWalletOrPaymentActions, true); assert.equal(report.mockedWallet, true);
  assert.equal(report.sourceCommit, plan.sourceCommit); assert.equal(report.candidateId, state.id);
  assert.equal(report.planSha256, fingerprint(plan));
  eq([...report.viewportWidths].sort((a,b) => a-b), [320, 390, 1440], 'All required viewport widths');
  assert(report.scenarios && (Array.isArray(report.scenarios) ? report.scenarios.length > 0 : Object.keys(report.scenarios).length > 0), 'Browser scenarios are missing.');
  const checked = Date.parse(report.checkedAt), age = now - checked;
  assert(Number.isFinite(age) && age >= -300000 && age <= 86400000 && checked >= Date.parse(state.candidateCreatedAt), 'Browser review is stale or predates the candidate.');
}

export function validatePublicationMessage(message) {
  assert(message.includes('[publish bnb auth]') && message.includes('[skip netlify]'), 'Both explicit publication markers are required.');
}

function runtime(deploy) {
  const value = Object.fromEntries(RUNTIME_FIELDS.filter(k => Object.hasOwn(deploy, k)).map(k => [k, deploy[k]]));
  if (value.functions_region_overrides) value.functions_region_overrides = sorted(value.functions_region_overrides, 'name');
  return value;
}
function assertSource(commit) {
  assert(safeCommit(commit), 'An exact source commit is required.');
  assert.equal(git('rev-parse', 'HEAD'), commit, 'Checkout differs from the reviewed source.');
  assert.equal(git('diff', '--name-only', commit, '--', ...SOURCE_PATHS), '', 'Uncommitted release source changes.');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHS), '', 'Uncommitted release files.');
  for (const source of SOURCE_PATHS) git('cat-file', '-e', `${commit}:${source}`);
}
function writeRecord(filename, value, exclusive = false) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const options = { mode: 0o600, ...(exclusive ? { flag: 'wx' } : {}) };
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', options);
  fs.writeFileSync(filename + '.sha256', fingerprint(value) + '\n', options);
}
function readRecord(filename) {
  const value = read(filename);
  assert.equal(fs.readFileSync(filename + '.sha256', 'utf8').trim(), fingerprint(value), 'Release record integrity failed.');
  return value;
}
async function inventory(api, id) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api(`deploys/${id}/files?per_page=100&page=${page}`);
    assert(Array.isArray(batch), 'Invalid static inventory.'); rows.push(...batch);
    if (batch.length < 100) return fileInventory(rows);
  }
  throw Error('Incomplete static inventory; stop.');
}
async function protectedEnvironment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [allSite, siteFunctions, shared, sharedFunctions, snippets] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'), api(`sites/${SITE_ID}/snippets`),
  ]);
  assert(Array.isArray(snippets), 'Missing snippet configuration.');
  // Never serialize raw environment records or site.build_settings.
  return { ...environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings }),
    snippetsSha256: fingerprint(snippets) };
}
async function assertLiveBaseline(api, baseline) {
  const site = await api(`sites/${SITE_ID}`);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, BASELINE_ID, 'Live deployment changed; capture and review a new release.');
  assert.equal(site.published_deploy.locked, true, 'Production lock changed.');
  const deploy = await api(`deploys/${BASELINE_ID}`);
  assert.equal(deploy.state, 'ready'); assert.equal(deploy.locked, true);
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, BASELINE_ID), validateBaseline(baseline), 'Complete current static inventory');
  eq(await protectedEnvironment(api, site), baseline.environment, 'Protected settings/environment/snippets');
}
function overlays() {
  return Object.entries(DELIVERY_SOURCES).map(([pathname, source]) => {
    const filename = path.join(ROOT, source), stat = fs.lstatSync(filename);
    assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular public source file required.');
    return { path: pathname, source, sha1: sha1(fs.readFileSync(filename)) };
  });
}
async function publicChecks(origin, plan) {
  assert(origin === 'https://tree-token.xyz' || origin === originFor(plan.candidateId), 'Unexpected review origin.');
  await verifyDelivery(origin, plan, ROOT, assertServedContent);
  const response = await fetch(origin + '/api/arcade-bnb-test', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Origin: 'https://tree-token.xyz', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }),
  });
  const body = await response.json();
  const canonicalOrigin = origin === 'https://tree-token.xyz';
  assert.equal(response.status, canonicalOrigin ? 401 : 403, 'Isolated backend runtime or origin guard failed.');
  assert.equal(body.error, canonicalOrigin ? 'invalid-session' : 'origin-denied');
  assert.equal(body.gameplayAuthorized, false); assert(!response.headers.has('set-cookie'), 'Read-only runtime check must not create a session.');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null, 'Unexpected CORS grant.');
}
async function verifyCandidate(api, baseline, plan, state, directory) {
  await assertLiveBaseline(api, baseline);
  const deploy = await api(`deploys/${state.id}`);
  assertNewCandidate(state, plan, deploy); assert.equal(deploy.state, 'ready');
  assert(!deploy.published_at && !deploy.locked, 'Candidate already published or locked.');
  validatePackage(plan.functionPackage, fs.readFileSync(path.join(directory, 'function.zip')));
  state.functionProviderRecord = compareBackend(deploy, baseline.deploy, plan.functionPackage, state.functionProviderRecord ?? undefined);
  eq(await inventory(api, state.id), plan.files, 'Complete candidate static inventory');
  await publicChecks(originFor(state.id), { ...plan, candidateId: state.id });
  await assertLiveBaseline(api, baseline);
  return deploy;
}
async function upload(token, endpoint, bytes) {
  let response;
  try { response = await fetch('https://api.netlify.com/api/v1/' + endpoint, { method: 'PUT', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: bytes,
    signal: AbortSignal.timeout(45000) }); }
  catch { throw Error('Upload transport failed; inspect this candidate before retrying.'); }
  assert(response.ok, `Upload failed (HTTP ${response.status}); raw details withheld.`);
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    directory: { type: 'string', default: DEFAULT_DIRECTORY },
    package: { type: 'string', default: PACKAGE_DIRECTORY + '/manifest.json' },
    'source-commit': { type: 'string' }, 'expected-candidate': { type: 'string' },
    review: { type: 'string', default: '.netlify/bnb-test-auth-browser.json' },
  } });
  const mode = positionals[0];
  assert(positionals.length === 1 && ['capture', 'plan', 'candidate', 'verify', 'publish'].includes(mode),
    'Usage: release-bnb-test-auth.mjs capture|plan|candidate|verify|publish [--directory PATH] [--source-commit SHA] [--expected-candidate ID] [--review PATH]');
  const directory = path.resolve(ROOT, values.directory), token = readToken();
  const api = scopedAPI(apiClient(token), mode);
  const baselinePath = path.join(directory, 'baseline.json'), planPath = path.join(directory, 'plan.json'), statePath = path.join(directory, 'candidate.json');
  if (mode === 'capture') {
    assert(!fs.existsSync(baselinePath), 'Capture exists; use a fresh review directory.');
    const site = await api(`sites/${SITE_ID}`);
    assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
    assert.equal(site.published_deploy?.id, BASELINE_ID); assert.equal(site.published_deploy.locked, true);
    const deploy = await api(`deploys/${BASELINE_ID}`), files = await inventory(api, BASELINE_ID);
    const baseline = { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID, capturedAt: new Date().toISOString(),
      deploy, files, environment: await protectedEnvironment(api, site) };
    validateBaseline(baseline); await assertLiveBaseline(api, baseline); writeRecord(baselinePath, baseline, true);
    const summary = { mode, result: 'passed', baselineId: BASELINE_ID, staticFiles: 649, functions: 50, schedules: 5, productionChanged: false };
    console.log(JSON.stringify(summary)); return summary;
  }
  const baseline = readRecord(baselinePath), baselineFiles = validateBaseline(baseline);
  let plan;
  if (mode === 'plan') {
    assert(!fs.existsSync(planPath), 'Reviewed plan already exists.');
    const sourceCommit = values['source-commit'] || git('rev-parse', 'HEAD'); assertSource(sourceCommit);
    await assertLiveBaseline(api, baseline);
    const manifestPath = path.resolve(ROOT, values.package), manifest = read(manifestPath);
    const zipBytes = fs.readFileSync(path.join(path.dirname(manifestPath), FUNCTION_NAME + '.zip'));
    const functionPackage = validatePackage(manifest, zipBytes);
    const overlay = assembleFiles(baselineFiles, overlays());
    plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: BASELINE_ID, baselineSha256: fingerprint(baseline),
      baselineCreatedAt: baseline.deploy.created_at, createdAt: new Date().toISOString(), sourceCommit, sourceBranch: 'main',
      sourceTree: git('rev-parse', 'HEAD^{tree}'), title: `Isolated BNB sign-in ${sourceCommit.slice(0,12)}; preserve all 50 existing backend packages`,
      ...overlay, functionPackage, databaseReadinessSha256: sha256(fs.readFileSync(path.join(ROOT, DATABASE_READINESS))),
      environment: baseline.environment };
    fs.writeFileSync(path.join(directory, 'function.zip'), zipBytes, { flag: 'wx', mode: 0o600 });
    writeRecord(planPath, plan, true);
  } else {
    plan = readRecord(planPath); assert.equal(plan.baselineSha256, fingerprint(baseline)); assert.equal(plan.baselineId, BASELINE_ID);
    assert.equal(plan.databaseReadinessSha256, sha256(fs.readFileSync(path.join(ROOT, DATABASE_READINESS))), 'Reviewed database readiness evidence changed.');
    assertSource(plan.sourceCommit); assert.equal(git('rev-parse', 'HEAD^{tree}'), plan.sourceTree);
    if (values['source-commit']) assert.equal(values['source-commit'], plan.sourceCommit);
    eq(assembleFiles(baselineFiles, overlays()), { files: plan.files, sources: plan.sources, changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths }, 'Reviewed static upload bytes');
    validatePackage(plan.functionPackage, fs.readFileSync(path.join(directory, 'function.zip')));
    await assertLiveBaseline(api, baseline);
  }
  let state, deploy;
  if (mode === 'candidate') {
    assert(!fs.existsSync(statePath), 'Candidate exists; verify it rather than creating another.');
    const requestStartedAt = new Date().toISOString();
    deploy = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(plan.title)}`, 'POST', createDeployPayload(baseline, plan));
    state = { schemaVersion: 1, siteId: SITE_ID, id: deploy.id, baselineId: BASELINE_ID,
      sourceCommit: plan.sourceCommit, planSha256: fingerprint(plan), requestStartedAt,
      candidateCreatedAt: deploy.created_at, verifiedAt: null };
    writeRecord(statePath, state, true); assertNewCandidate(state, plan, deploy); validateUploadRequirements(deploy, plan);
    for (const digest of deploy.required) {
      const pathname = Object.keys(plan.sources).find(p => plan.files[p] === digest);
      const bytes = fs.readFileSync(path.join(ROOT, plan.sources[pathname])); assert.equal(sha1(bytes), digest);
      await upload(token, `deploys/${state.id}/files${pathname}`, bytes);
    }
    if (deploy.required_functions.length) {
      const bytes = fs.readFileSync(path.join(directory, 'function.zip')); assert.equal(sha256(bytes), plan.functionPackage.sha256);
      await upload(token, `deploys/${state.id}/functions/${FUNCTION_NAME}?runtime=nodejs24.x&invocation_mode=stream`, bytes);
    }
    for (let attempt = 0; attempt < 120; attempt++) {
      deploy = await api(`deploys/${state.id}`);
      if (deploy.state === 'ready') break;
      assert(!['error','rejected','canceled'].includes(deploy.state), 'Candidate failed; the previous locked site remains live.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else if (mode !== 'plan') state = readRecord(statePath);
  if (state) {
    if (values['expected-candidate']) assert.equal(state.id, values['expected-candidate']);
    if (mode === 'publish') {
      assert.equal(values['expected-candidate'], state.id, 'Explicit reviewed candidate ID is required.');
      assert(state.verifiedAt && state.functionProviderRecord, 'Run verify before publication.');
      validateBrowserReview(read(path.resolve(ROOT, values.review)), plan, state);
      validatePublicationMessage(git('log', '-1', '--format=%B', plan.sourceCommit));
      assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0], plan.sourceCommit, 'Remote main differs from reviewed source.');
    }
    deploy = await verifyCandidate(api, baseline, plan, state, directory);
    if (mode === 'publish') {
      await waitForAllBuilds(api, state.id);
      await assertLiveBaseline(api, baseline); assertSource(plan.sourceCommit);
      assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0], plan.sourceCommit, 'Remote main moved while waiting.');
      // Netlify publishes and locks this exact newly created candidate. Never
      // unlock production and never restore an older deployment.
      await api(`deploys/${state.id}/lock`, 'POST');
      for (let attempt = 0; attempt < 60; attempt++) {
        const site = await api(`sites/${SITE_ID}`);
        if (site.published_deploy?.id === state.id && site.published_deploy.locked === true) break;
        assert([BASELINE_ID, state.id].includes(site.published_deploy?.id), 'Concurrent publication detected.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const site = await api(`sites/${SITE_ID}`); assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
      assert.equal(site.published_deploy?.id, state.id); assert.equal(site.published_deploy.locked, true);
      deploy = await api(`deploys/${state.id}`); assertNewCandidate(state, plan, deploy);
      assert.equal(deploy.state, 'ready'); assert.equal(deploy.locked, true); assert(deploy.published_at);
      compareBackend(deploy, baseline.deploy, plan.functionPackage, state.functionProviderRecord);
      eq(await inventory(api, state.id), plan.files, 'Complete published static inventory');
      eq(await protectedEnvironment(api, site), baseline.environment, 'Published protected configuration');
      await publicChecks('https://tree-token.xyz', { ...plan, candidateId: state.id });
      state.publishedAt = deploy.published_at;
    }
    state.verifiedAt = new Date().toISOString(); writeRecord(statePath, state);
  }
  const report = { schemaVersion: 1, mode, result: 'passed', checkedAt: new Date().toISOString(),
    baselineId: BASELINE_ID, candidateId: state?.id ?? null, publishedAt: state?.publishedAt ?? null,
    sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree, planSha256: fingerprint(plan),
    staticFiles: Object.keys(plan.files).length, preservedStaticFiles: BASELINE_STATIC_FILES,
    changedOriginals: [], addedPaths: plan.addedPaths, functionsPreserved: 50,
    functionsTotal: state ? 51 : 50, schedulesPreserved: 5, productionChanged: mode === 'publish',
    files: plan.files, functionPackage: plan.functionPackage, databaseReadinessSha256: plan.databaseReadinessSha256,
    backend: { functions: deploy?.available_functions ?? baseline.deploy.available_functions,
      newFunction: state?.functionProviderRecord ?? null, schedules: baseline.deploy.function_schedules,
      runtime: runtime(deploy ?? baseline.deploy) }, environment: baseline.environment,
    url: state ? originFor(state.id) + '/play/multichaintest/game/bnb/' : null };
  writeRecord(path.join(directory, 'report.json'), report);
  // Console output is intentionally brief; never print a full capture or credentials.
  console.log(JSON.stringify({ mode, result: report.result, baselineId: BASELINE_ID, candidateId: report.candidateId,
    staticFiles: report.staticFiles, functionsPreserved: 50, functionsTotal: report.functionsTotal,
    schedulesPreserved: 5, planSha256: report.planSha256, productionChanged: report.productionChanged }));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
