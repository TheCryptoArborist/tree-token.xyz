import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, fingerprint, readToken, environmentFor, runtimeFor } from './release-preserved-production.mjs';
import {
  SITE_ID, ACCOUNT_ID, fileInventory, publicUploadPath, validateBackend,
  compareBackend, functionsConfig, isAuditedInactiveDeploy,
  validateBrowserReport, assertBrowserVerification,
} from './release-stats-market.mjs';
import { DELIVERY_SOURCES, DELIVERY_PATHS, verifyDelivery } from './sti-purchase-delivery.mjs';

// A bounded frontend repair. Shared, tested preservation primitives retain all
// complete backend/provider/runtime records and the existing schedule/configuration.
// Only a new candidate created by this exact plan can be published and locked.
export { SITE_ID, ACCOUNT_ID, compareBackend, functionsConfig, validateBrowserReport, assertBrowserVerification };
export const REVIEWED_BASELINE_ID = '6afddc74d6c8647c67efdbad';
export const BASELINE_ID = process.env.STI_PURCHASE_EXPECTED_DEPLOY || '';
export const REPLACED_HASHES = {
  '/dapp/index.html': '2e804819503002ecaf86de488de4e64ada332347',
  '/dapp/sti-widget.js': 'cae92237a45a78e9863f21b9e3837a7779c72dfe',
};
export const PRESERVED_STI_HASHES = {
  '/dapp/sti-purchase-core.js': '5a5416c3f090aa4f9ab02a6d8574400a2714f252',
  '/dapp/sti-purchase.css': '3d8e3b50eba2f9cfb6c30005cc87a85c84652b59',
};
export const ORIGINAL_CHANGES = Object.keys(REPLACED_HASHES).sort();
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_PATHS = [
  'production/sti-purchase-static', 'production/sti-purchase-release-20261118.json',
  'scripts/release-sti-purchase.mjs',
  'scripts/sti-purchase-delivery.mjs', 'scripts/check-sti-purchase-page.mjs',
  'scripts/release-stats-market.mjs', 'scripts/stats-market-delivery.mjs',
  'scripts/release-preserved-production.mjs', '.github/workflows/publish-sti-purchase.yml',
  'tests/sti-purchase-release.test.mjs', 'tests/sti-purchase-core.test.mjs',
  'tests/sti-approval-flow.test.mjs', 'tests/sti-wallet-recovery.test.mjs',
  'tests/fixtures/sti-badge.json', 'tests/fixtures/sti-price.json',
];
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const safeId = id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
// Never put protected settings/environment contents into an assertion diff.
const eq = (a, b, label) => assert(canonical(a) === canonical(b), label + ' changed; stop.');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));

export function validateBaseline(baseline) {
  assert.equal(BASELINE_ID, REVIEWED_BASELINE_ID, 'Review a new baseline before changing the expected deployment.');
  assert.equal(baseline.site?.id, SITE_ID); assert.equal(baseline.site?.account_id, ACCOUNT_ID);
  assert.equal(baseline.deploy?.id, BASELINE_ID, 'This release requires the newly captured current baseline.');
  assert.equal(baseline.deploy.state, 'ready'); assert.equal(baseline.deploy.locked, true);
  validateBackend(baseline.deploy);
  const files = fileInventory(baseline.files);
  assert.equal(Object.keys(files).length, 615, 'Capture all 615 current static files.');
  for (const [pathname, hash] of Object.entries({ ...REPLACED_HASHES, ...PRESERVED_STI_HASHES })) {
    assert.equal(files[pathname], hash, 'Reviewed STI baseline changed: ' + pathname);
  }
  return files;
}

export function assembleFiles(baselineFiles, overlays) {
  for (const [pathname, hash] of Object.entries({ ...REPLACED_HASHES, ...PRESERVED_STI_HASHES })) {
    assert.equal(baselineFiles[pathname], hash, 'Reviewed STI baseline changed: ' + pathname);
  }
  assert(!Object.hasOwn(baselineFiles, '/dapp/sti-wallet-recovery.js'), 'The new STI wallet recovery script already exists; review before replacement.');
  const files = { ...baselineFiles }, sources = {};
  for (const item of overlays) {
    const publicPath = publicUploadPath(item.path);
    assert(DELIVERY_PATHS.includes(publicPath), 'Unapproved STI public path: ' + publicPath);
    assert(/^[a-f0-9]{40}$/.test(item.sha1), 'Invalid overlay digest.');
    assert(!Object.hasOwn(sources, publicPath), 'Duplicate or case-colliding public overlay.');
    assert.equal(item.source, DELIVERY_SOURCES[publicPath], 'Unapproved overlay source: ' + publicPath);
    if (Object.hasOwn(PRESERVED_STI_HASHES, publicPath)) {
      assert.equal(item.sha1, PRESERVED_STI_HASHES[publicPath], 'Protected STI purchase file changed: ' + publicPath);
    }
    files[publicPath] = item.sha1; sources[publicPath] = item.source;
  }
  eq(Object.keys(sources).sort(), [...DELIVERY_PATHS].sort(), 'Complete STI overlay inventory');
  const changedOriginals = Object.keys(baselineFiles).filter(p => files[p] !== baselineFiles[p]).sort();
  eq(changedOriginals, ORIGINAL_CHANGES, 'Only the two approved existing files must change');
  assert(files['/index.html'], 'Missing homepage entry.');
  assert(Object.keys(baselineFiles).every(p => Object.hasOwn(files, p)), 'Baseline path removed.');
  return { files, sources, changedOriginals, addedPaths: ['/dapp/sti-wallet-recovery.js'] };
}

function overlays() {
  return DELIVERY_PATHS.map(publicPath => {
    const source = DELIVERY_SOURCES[publicPath], filename = path.join(ROOT, source);
    assert(!fs.lstatSync(filename).isSymbolicLink(), 'Symlink refused.');
    return { path: publicPath, source, sha1: sha1(fs.readFileSync(filename)) };
  });
}
function assertSource(commit, branch) {
  assert(/^[a-f0-9]{40}$/.test(commit), 'Pin an exact committed source SHA.');
  assert.equal(git('rev-parse', 'HEAD'), commit, 'HEAD changed after release planning.');
  assert.equal(git('branch', '--show-current'), branch, 'Source branch changed.');
  assert(branch && branch !== 'HEAD', 'Use a named source branch.');
  assert.equal(git('diff', '--name-only', commit, '--', ...SOURCE_PATHS), '', 'Release source has uncommitted changes.');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHS), '', 'Commit all release sources first.');
  for (const filename of SOURCE_PATHS) git('cat-file', '-e', `${commit}:${filename}`);
}
function writeRecord(filename, value, exclusive = false) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const options = { mode: 0o600, ...(exclusive ? { flag: 'wx' } : {}) };
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', options);
  fs.writeFileSync(filename + '.sha256', fingerprint(value) + '\n', options);
}
function readRecord(filename) {
  const value = read(filename);
  assert.equal(fs.readFileSync(filename + '.sha256', 'utf8').trim(), fingerprint(value), 'Local release record integrity failed.');
  return value;
}
export function apiClient(token, { fetchImpl = globalThis.fetch,
  delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  return async (endpoint, method = 'GET', body) => {
    let response;
    const attempts = method === 'GET' ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        response = await fetchImpl('https://api.netlify.com/api/v1/' + endpoint, {
          method, redirect: 'error', signal: AbortSignal.timeout(30000),
          headers: { Authorization: 'Bearer ' + token, ...(body != null ? { 'Content-Type': 'application/json' } : {}) },
          body: body != null ? JSON.stringify(body) : undefined,
        });
        break;
      } catch {
        if (attempt + 1 === attempts) {
          throw Error(`Netlify ${method} request failed${attempts > 1 ? ` after ${attempts} attempts` : ''}; raw details withheld.`);
        }
        // A read can lose an idle connection while browser verification runs.
        // Retry only transport failures; mutations and HTTP rejections stay final.
        await delay(250 * (attempt + 1));
      }
    }
    assert(response.ok, `Netlify ${method} failed (HTTP ${response.status}); raw details withheld.`);
    try { return await response.json(); } catch { throw Error('Invalid Netlify response; raw details withheld.'); }
  };
}
async function inventory(api, id) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api(`deploys/${id}/files?per_page=100&page=${page}`);
    assert(Array.isArray(batch), 'Invalid file inventory.'); rows.push(...batch);
    if (batch.length < 100) return fileInventory(rows);
  }
  throw Error('File inventory exceeded bounded reader.');
}
async function protectedEnvironment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [allSite, siteFunctions, shared, sharedFunctions] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'),
  ]);
  const configuration = environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings });
  const snippets = await api(`sites/${SITE_ID}/snippets`);
  assert(Array.isArray(snippets), 'Site snippet configuration unavailable.');
  return { ...configuration, snippetsSha256: fingerprint(snippets) };
}
async function assertLiveBaseline(api, baseline, environment) {
  const site = await api('sites/' + SITE_ID);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, BASELINE_ID, 'Production changed; capture and review a new release.');
  assert.equal(site.published_deploy.locked, true, 'Production lock changed.');
  const deploy = await api('deploys/' + BASELINE_ID);
  assert.equal(deploy.locked, true); assert.equal(deploy.state, 'ready');
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, BASELINE_ID), validateBaseline(baseline), 'Current baseline static files');
  const settings = { ...site.build_settings }, original = { ...baseline.site.build_settings };
  delete settings.updated_at; delete original.updated_at;
  eq(settings, original, 'Site build settings');
  if (environment) eq(await protectedEnvironment(api, site), environment, 'Protected API-visible environment');
  return { site, deploy };
}

export function assertNewCandidate(state, plan, deploy) {
  assert.equal(state.schemaVersion, 1); assert.equal(state.siteId, SITE_ID);
  assert(safeId(state.id) && state.id !== BASELINE_ID, 'Only this newly created candidate may be published.');
  assert.equal(state.baselineId, BASELINE_ID); assert.equal(state.planSha256, fingerprint(plan));
  assert.equal(state.sourceCommit, plan.sourceCommit); assert.equal(deploy.id, state.id); assert.equal(deploy.site_id, SITE_ID);
  assert.equal(deploy.created_at, state.candidateCreatedAt, 'Candidate creation identity changed.');
  assert(Date.parse(deploy.created_at) >= Date.parse(state.requestStartedAt) - 10000, 'Refusing an older deployment.');
  assert(Date.parse(deploy.created_at) > Date.parse(plan.baselineCreatedAt), 'Candidate predates baseline.');
  assert.equal(deploy.title, plan.title, 'Unexpected candidate title.');
}
function browserCheck(origin, sourceCommit, candidateId, label) {
  assert(process.env.STI_PURCHASE_BROWSER_MODULE, 'The isolated browser checker module is required.');
  const reportPath = path.join(ROOT, '.netlify/sti-purchase-browser-checks.json');
  fs.rmSync(reportPath, { force: true });
  execFileSync(process.execPath, ['scripts/check-sti-purchase-page.mjs'], {
    cwd: ROOT, stdio: 'inherit', timeout: 300000,
    env: { ...process.env, STI_PURCHASE_TEST_BASE: new URL(origin).origin,
      STI_PURCHASE_SOURCE_COMMIT: sourceCommit, STI_PURCHASE_CANDIDATE_ID: candidateId },
  });
  const report = read(reportPath);
  validateBrowserReport(report, origin, sourceCommit, candidateId);
  const verification = { candidateId, sourceCommit, origin: new URL(origin).origin,
    checkedAt: new Date().toISOString(), reportSha256: fingerprint(report), report };
  writeRecord(path.join(ROOT, `.netlify/sti-purchase-${label}-browser-checks.json`), verification);
  return verification;
}
async function verifyCandidate(api, baseline, plan, state) {
  await assertLiveBaseline(api, baseline, plan.environment);
  const deploy = await api('deploys/' + state.id);
  assertNewCandidate(state, plan, deploy); assert.equal(deploy.state, 'ready', 'Candidate not ready.');
  assert(!deploy.published_at, 'Candidate was already published; review the recorded release.');
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, state.id), plan.files, 'Complete hosted candidate static inventory');
  await verifyDelivery(deploy.links?.permalink, plan, ROOT);
  await assertLiveBaseline(api, baseline, plan.environment);
  return deploy;
}
export async function assertNoConcurrentDeploys(api, candidateId) {
  for (let page = 1; page <= 100; page++) {
    const rows = await api(`sites/${SITE_ID}/deploys?per_page=100&page=${page}`);
    assert(Array.isArray(rows), 'Invalid deploy history.');
    for (const summary of rows) {
      if (summary.id === candidateId || ['ready', 'error', 'rejected', 'canceled'].includes(summary.state)) continue;
      const full = await api('deploys/' + summary.id);
      assert(isAuditedInactiveDeploy(full), `Unreviewed nonterminal deploy ${summary.id}; stop before publication.`);
    }
    if (rows.length < 100) return;
  }
  throw Error('Deploy history exceeded bounded concurrency reader.');
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    baseline: { type: 'string', default: '.netlify/sti-purchase-baseline.json' },
    plan: { type: 'string', default: '.netlify/sti-purchase-plan.json' },
    state: { type: 'string', default: '.netlify/sti-purchase-candidate.json' },
    'source-commit': { type: 'string' }, 'expected-candidate': { type: 'string' },
  } });
  assert(BASELINE_ID === REVIEWED_BASELINE_ID, 'STI_PURCHASE_EXPECTED_DEPLOY must identify the reviewed current locked deployment.');
  const mode = positionals[0];
  assert(positionals.length === 1 && ['capture', 'plan', 'preview', 'verify', 'publish'].includes(mode),
    'Usage: release-sti-purchase.mjs capture|plan|preview|verify|publish [--source-commit SHA] [--expected-candidate ID]');
  const baselinePath = path.resolve(ROOT, values.baseline), planPath = path.resolve(ROOT, values.plan), statePath = path.resolve(ROOT, values.state);
  const api = apiClient(readToken());
  if (mode === 'capture') {
    assert(!fs.existsSync(baselinePath), 'Baseline capture already exists.');
    const site = await api('sites/' + SITE_ID), deploy = await api('deploys/' + BASELINE_ID);
    const files = await inventory(api, BASELINE_ID);
    const baseline = { site, deploy, files: Object.entries(files).map(([path, sha]) => ({ path, sha })) };
    validateBaseline(baseline);
    await assertLiveBaseline(api, baseline, await protectedEnvironment(api, site));
    writeRecord(baselinePath, baseline, true);
    console.log('Captured the current 615-path deployment; no remote changes.');
    return;
  }
  const baseline = readRecord(baselinePath), baselineFiles = validateBaseline(baseline);
  let plan;
  if (mode === 'plan') {
    assert(!fs.existsSync(planPath), 'Release plan already exists; use a new reviewed filename.');
    const sourceCommit = values['source-commit'] || git('rev-parse', 'HEAD'), sourceBranch = git('branch', '--show-current');
    assertSource(sourceCommit, sourceBranch);
    const { site } = await assertLiveBaseline(api, baseline);
    plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: BASELINE_ID, baselineSha256: fingerprint(baseline),
      baselineCreatedAt: baseline.deploy.created_at, createdAt: new Date().toISOString(), sourceCommit, sourceBranch,
      title: `TREE STI wallet recovery ${sourceCommit.slice(0, 12)}; preserve 49 backend packages`,
      ...assembleFiles(baselineFiles, overlays()),
      backend: { functions: baseline.deploy.available_functions, schedules: baseline.deploy.function_schedules, runtime: runtimeFor(baseline.deploy) },
      environment: await protectedEnvironment(api, site) };
    await assertLiveBaseline(api, baseline, plan.environment); writeRecord(planPath, plan, true);
  } else {
    plan = readRecord(planPath);
    assert.equal(plan.baselineSha256, fingerprint(baseline)); assert.equal(plan.baselineId, BASELINE_ID);
    assertSource(plan.sourceCommit, plan.sourceBranch);
    if (values['source-commit']) assert.equal(values['source-commit'], plan.sourceCommit);
    eq(assembleFiles(baselineFiles, overlays()), { files: plan.files, sources: plan.sources,
      changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths }, 'Local upload bytes and release inventory');
    await assertLiveBaseline(api, baseline, plan.environment);
  }
  let state, deploy;
  if (mode === 'preview') {
    assert(!fs.existsSync(statePath), 'Candidate state exists; verify it or choose a new state path.');
    const requestStartedAt = new Date().toISOString();
    deploy = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(plan.title)}`, 'POST', {
      files: plan.files, functions: Object.fromEntries(baseline.deploy.available_functions.map(f => [f.n, f.d])),
      functions_config: functionsConfig(baseline.deploy), function_schedules: baseline.deploy.function_schedules,
      draft: false, async: false, branch: baseline.deploy.branch,
    });
    state = { schemaVersion: 1, siteId: SITE_ID, id: deploy.id, baselineId: BASELINE_ID,
      sourceCommit: plan.sourceCommit, planSha256: fingerprint(plan), requestStartedAt,
      candidateCreatedAt: deploy.created_at, verifiedAt: null };
    writeRecord(statePath, state, true); assertNewCandidate(state, plan, deploy);
    for (const field of ['required_functions', 'required_edge_functions', 'required_server']) {
      assert(Array.isArray(deploy[field]) && deploy[field].length === 0, 'Refuse missing or nonempty backend/server upload requirements.');
    }
    for (const digest of deploy.required || []) {
      const publicPath = Object.keys(plan.sources).find(p => plan.files[p] === digest);
      assert(publicPath, 'Netlify requested an unchanged or unapproved upload.');
      const bytes = fs.readFileSync(path.join(ROOT, plan.sources[publicPath]));
      assert.equal(sha1(bytes), digest, 'Upload bytes changed.');
      let response;
      try { response = await fetch(`https://api.netlify.com/api/v1/deploys/${state.id}/files${publicPath}`, {
        method: 'PUT', redirect: 'error', headers: { Authorization: 'Bearer ' + readToken(), 'Content-Type': 'application/octet-stream' },
        body: bytes, signal: AbortSignal.timeout(30000),
      }); } catch { throw Error('Static upload failed; raw details withheld.'); }
      assert(response.ok, `Static upload failed (HTTP ${response.status}).`);
    }
    for (let attempt = 0; attempt < 90; attempt++) {
      deploy = await api('deploys/' + state.id);
      if (deploy.state === 'ready') break;
      assert(!['error', 'rejected', 'canceled'].includes(deploy.state), 'Candidate deployment failed.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else if (mode !== 'plan') state = readRecord(statePath);
  if (state) {
    if (values['expected-candidate']) assert.equal(state.id, values['expected-candidate']);
    if (mode === 'publish') assert.equal(values['expected-candidate'], state.id, 'Publish requires the explicit reviewed candidate ID.');
    deploy = await verifyCandidate(api, baseline, plan, state);
    if (mode === 'verify') {
      state.browserVerification = browserCheck(deploy.links.permalink, plan.sourceCommit, state.id, 'candidate');
      state.verifiedAt = new Date().toISOString(); await assertLiveBaseline(api, baseline, plan.environment);
    }
    if (mode === 'publish') {
      assert.equal(plan.sourceBranch, 'main', 'Merge the reviewed repair before publication.');
      assert(state.verifiedAt, 'Run verify on the review candidate before publication.');
      assertBrowserVerification(state.browserVerification, state, plan, deploy);
      const remoteHead = git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0];
      assert.equal(remoteHead, plan.sourceCommit, 'Push the exact reviewed source commit before publication.');
      assertSource(plan.sourceCommit, plan.sourceBranch);
      await assertNoConcurrentDeploys(api, state.id); await assertLiveBaseline(api, baseline, plan.environment);
      // Netlify publishes and locks this newly created, verified candidate.
      // No restore endpoint, older deploy, unlock, function upload or config write.
      await api(`deploys/${state.id}/lock`, 'POST');
      for (let attempt = 0; attempt < 60; attempt++) {
        const site = await api('sites/' + SITE_ID);
        if (site.published_deploy?.id === state.id && site.published_deploy.locked === true) break;
        assert([BASELINE_ID, state.id].includes(site.published_deploy?.id), 'Concurrent publication detected.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const site = await api('sites/' + SITE_ID);
      assert.equal(site.published_deploy?.id, state.id); assert.equal(site.published_deploy.locked, true);
      deploy = await api('deploys/' + state.id); assert.equal(deploy.locked, true);
      compareBackend(deploy, baseline.deploy); eq(await inventory(api, state.id), plan.files, 'Published static inventory');
      eq(await protectedEnvironment(api, site), plan.environment, 'Published environment');
      await verifyDelivery('https://tree-token.xyz', plan, ROOT);
      state.canonicalBrowserVerification = browserCheck('https://tree-token.xyz', plan.sourceCommit, state.id, 'canonical');
      const finalSite = await api('sites/' + SITE_ID), finalDeploy = await api('deploys/' + state.id);
      assert.equal(finalSite.published_deploy?.id, state.id, 'Publication changed during canonical checks.');
      assert.equal(finalSite.published_deploy.locked, true); assert.equal(finalDeploy.state, 'ready'); assert.equal(finalDeploy.locked, true);
      compareBackend(finalDeploy, baseline.deploy); eq(await inventory(api, state.id), plan.files, 'Final complete published static inventory');
      eq(await protectedEnvironment(api, finalSite), plan.environment, 'Final protected environment');
      state.publishedAt = new Date().toISOString();
    }
    writeRecord(statePath, state);
  }
  const report = { mode, result: 'passed', checkedAt: new Date().toISOString(), baselineId: BASELINE_ID,
    candidateId: state?.id || null, sourceCommit: plan.sourceCommit, sourceBranch: plan.sourceBranch,
    staticFiles: Object.keys(plan.files).length, baselineStaticFiles: Object.keys(baselineFiles).length,
    preservedStaticFiles: Object.keys(baselineFiles).length - plan.changedOriginals.length,
    changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths,
    changedFileHashes: Object.fromEntries(Object.keys(plan.sources).map(p => [p, { before: baselineFiles[p] ?? null, after: plan.files[p] }])),
    files: plan.files, functionsPreserved: 49, schedulesPreserved: 5,
    completeFunctionRecordsSHA256: fingerprint(plan.backend.functions), schedulesSHA256: fingerprint(plan.backend.schedules),
    runtimeSHA256: fingerprint(plan.backend.runtime), protectedConfigurationSHA256: fingerprint(plan.environment),
    backendAndInventoryVerified: !!state, planSha256: fingerprint(plan), productionChanged: mode === 'publish',
    productionLocked: true, candidateBrowserVerification: state?.browserVerification ?? null,
    canonicalBrowserVerification: state?.canonicalBrowserVerification ?? null,
    canonicalDeliveryVerified: mode === 'publish', canonicalUrl: 'https://tree-token.xyz/dapp/#stats',
    url: state ? `https://${state.id}--tree-token.netlify.app/dapp/#stats` : null };
  writeRecord(path.join(ROOT, '.netlify/sti-purchase-release-report.json'), report);
  console.log(JSON.stringify({ ...report, files: undefined, candidateBrowserVerification: state?.browserVerification?.reportSha256 ?? null,
    canonicalBrowserVerification: state?.canonicalBrowserVerification?.reportSha256 ?? null }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
