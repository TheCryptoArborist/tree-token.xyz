import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, fingerprint, environmentFor, runtimeFor } from './release-preserved-production.mjs';
import { SITE_ID, ACCOUNT_ID, fileInventory, publicUploadPath } from './release-stats-market.mjs';
import { apiClient } from './release-sti-purchase.mjs';
import { scopedAPI, validateBackend, compareBackend as compareExistingBackend, functionsConfig,
  storedPlayHTML, assertNewCandidate, activeDeploys, waitForAllBuilds, validateBrowserReview as validateTabBrowserReview } from './release-arcade-cutoff.mjs';

// Static-only preservation. Reuse the reviewed release primitives without
// widening the historical cutoff helper's scope or rebuilding any backend.
export { SITE_ID, ACCOUNT_ID, scopedAPI, assertNewCandidate, activeDeploys, waitForAllBuilds };
export const CONTROL_FILE = 'production/arcade-wallet-switch-publish.json';
export const REVIEW_FILE = 'production/arcade-wallet-switch-browser-review.json';
export const DELIVERY_SOURCES = {
  '/scripts/arcade-monthly.js': 'scripts/arcade-monthly.js',
  '/styles/arcade-organization.css': 'styles/arcade-organization.css',
  '/scripts/arcade-daily-growth-play-share.js': 'production/arcade-organization-static/runtime/scripts/arcade-daily-growth-play-share.js',
  '/assets/arcade/arcade-growth-wallet.js': 'production/arcade-organization-static/runtime/assets/arcade/arcade-growth-wallet.js',
};
export const REQUIRED_CHANGES = Object.keys(DELIVERY_SOURCES);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RECORD_DIR = '.netlify/arcade-wallet-switch';
const SOURCE_PATHS = [...Object.values(DELIVERY_SOURCES), 'scripts/release-arcade-wallet-switch.mjs',
  'scripts/release-arcade-cutoff.mjs', 'scripts/release-preserved-production.mjs',
  'scripts/release-stats-market.mjs', 'scripts/release-sti-purchase.mjs', 'scripts/stats-market-delivery.mjs',
  'tests/arcade-wallet-switch-release.test.mjs', '.github/workflows/arcade-wallet-switch.yml', 'docs/arcade-wallet-switch-release.md',
  'tests/arcade-wallet-switch-browser.mjs', 'tests/arcade-wallet-switch.test.mjs', 'tests/arcade-growth-wallet-accounts.test.mjs',
  'tests/arcade-monthly-wallet-switch.test.mjs'];
const sha = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
const safeId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const safeCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const safeHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const eq = (actual, expected, label) => assert(canonical(actual) === canonical(expected), label + ' changed; stop.');
const sorted = (rows, key) => [...rows].sort((a, b) => a[key].localeCompare(b[key]));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const originFor = id => { assert(safeId(id)); return `https://${id}--tree-token.netlify.app`; };

export const WALLET_BROWSER_CHECKS = ['walletSignOut', 'walletSwitch', 'sameProviderAccountSelection',
  'cancelKeepsSignedOut', 'noOldWalletData', 'returnsSignedOut'];
export function validateBrowserReview(report, plan, state, now = Date.now()) {
  validateTabBrowserReview(report, plan, state, now);
  assert.equal(report.syntheticWalletOnly, true, 'Wallet-switch review must use isolated synthetic wallet fixtures.');
  for (const name of WALLET_BROWSER_CHECKS) {
    assert.equal(report.checks?.[name], true, 'Missing candidate wallet check: ' + name);
  }
}

export function compareBackend(actual, expected) {
  compareExistingBackend(actual, expected);
  // No provisioning or materialized-alias exception is needed for this release.
  eq(sorted(actual.available_functions, 'n'), sorted(expected.available_functions, 'n'), 'Every complete backend record');
  eq(sorted(actual.function_schedules, 'name'), sorted(expected.function_schedules, 'name'), 'Every complete schedule');
}

export function assembleFiles(baselineFiles, overlays) {
  fileInventory(Object.entries(baselineFiles).map(([path, sha]) => ({ path, sha })));
  const files = { ...baselineFiles }, sources = {};
  for (const item of overlays) {
    const pathname = publicUploadPath(item.path);
    assert(Object.hasOwn(DELIVERY_SOURCES, pathname), 'Unapproved overlay path.');
    assert(Object.hasOwn(baselineFiles, pathname), 'New static assets are forbidden in this release.');
    assert(!Object.hasOwn(sources, pathname), 'Duplicate overlay.');
    assert.equal(item.source, DELIVERY_SOURCES[pathname], 'Unapproved overlay source.');
    assert(/^[a-f0-9]{40}$/.test(item.sha1), 'Invalid overlay SHA1.');
    files[pathname] = item.sha1; sources[pathname] = item.source;
  }
  eq(Object.keys(sources).sort(), Object.keys(DELIVERY_SOURCES).sort(), 'Complete approved source inventory');
  const changedOriginals = Object.keys(baselineFiles).filter(p => files[p] !== baselineFiles[p]).sort();
  assert(REQUIRED_CHANGES.every(p => changedOriginals.includes(p)), 'All four reviewed wallet-switch assets must change.');
  assert(changedOriginals.every(p => Object.hasOwn(DELIVERY_SOURCES, p)), 'Unapproved static change.');
  eq(Object.keys(files).sort(), Object.keys(baselineFiles).sort(), 'Complete preserved static path inventory');
  return { files, sources, changedOriginals, addedPaths: [] };
}

export function validateUploadRequirements(deploy, plan) {
  for (const key of ['required', 'required_functions', 'required_edge_functions', 'required_server']) {
    assert(Array.isArray(deploy[key]), 'Missing upload requirement inventory: ' + key);
    assert.equal(new Set(deploy[key]).size, deploy[key].length, 'Duplicate upload requirement.');
  }
  for (const key of ['required_functions', 'required_edge_functions', 'required_server']) {
    assert.equal(deploy[key].length, 0, 'Every backend package must be reused; upload forbidden: ' + key);
  }
  for (const digest of deploy.required) {
    assert(plan.changedOriginals.some(p => plan.files[p] === digest), 'Unchanged or unapproved static upload requested.');
  }
}

export function validatePublicationControl(control, action = 'publish-arcade-wallet-switch') {
  assert(['publish-arcade-wallet-switch', 'audit-arcade-wallet-switch'].includes(action), 'Invalid release control action.');
  assert.equal(control.schemaVersion, 1); assert.equal(control.action, action);
  for (const key of ['sourceCommit', 'sourceTree', 'mainCommit']) assert(safeCommit(control[key]), 'Invalid control ' + key);
  for (const key of ['expectedDeploy', 'candidateId']) assert(safeId(control[key]), 'Invalid control ' + key);
  assert.notEqual(control.expectedDeploy, control.candidateId, 'An older deploy cannot be restored.');
  assert(safeHash(control.planSha256), 'Missing reviewed plan digest.');
  for (const key of ['candidateRunId', 'candidateArtifactId']) assert(/^[1-9]\d*$/.test(String(control[key])), 'Invalid ' + key);
  assert(safeHash(control.candidateArtifactSHA256), 'Missing candidate artifact digest.');
  assert.equal(control.browserReview, REVIEW_FILE);
}

export function validateControlCommit(control, { mode, parents, mainTree, changedFiles, message }) {
  validatePublicationControl(control, mode + '-arcade-wallet-switch');
  assert.equal(parents.length, 1, 'Use one control commit directly on the reviewed merged main.');
  assert.equal(parents[0], control.mainCommit, 'Control commit is not based on the declared merged main.');
  assert.equal(mainTree, control.sourceTree, 'Merged main differs from reviewed source.');
  eq([...changedFiles].sort(), [CONTROL_FILE, REVIEW_FILE].sort(), 'Only the control and bound browser review JSON');
  assert(message.includes('[skip netlify]') && message.includes('[' + mode + ' arcade wallet switch]'), 'Explicit release markers are required.');
}

function assertSource(commit, sourceTree) {
  assert(safeCommit(commit), 'Pin the exact committed source.');
  assert.equal(git('rev-parse', 'HEAD'), commit, 'Checkout differs from reviewed source.');
  assert.equal(git('rev-parse', 'HEAD^{tree}'), sourceTree, 'Source tree changed.');
  assert.equal(git('diff', '--name-only', commit, '--', ...SOURCE_PATHS), '', 'Uncommitted release changes.');
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
  throw Error('Incomplete static inventory; release refused.');
}
async function protectedEnvironment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [allSite, siteFunctions, shared, sharedFunctions, snippets] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'), api(`sites/${SITE_ID}/snippets`),
  ]);
  assert(Array.isArray(snippets), 'Missing site snippet configuration.');
  return { ...environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings }),
    snippetsSha256: fingerprint(snippets) };
}
export function validateBaseline(baseline, expected) {
  assert.equal(baseline.schemaVersion, 1); assert.equal(baseline.siteId, SITE_ID); assert.equal(baseline.accountId, ACCOUNT_ID);
  assert.equal(baseline.deploy.id, expected); runtimeFor(baseline.deploy); validateBackend(baseline.deploy);
  const files = fileInventory(Object.entries(baseline.files).map(([path, sha]) => ({ path, sha })));
  for (const pathname of ['/index.html', '/play/index.html', '/scripts/arcade-monthly.js',
    '/scripts/arcade-season-deadline.js', ...Object.keys(DELIVERY_SOURCES)]) assert(files[pathname], 'Incomplete current inventory: ' + pathname);
  assert.equal(baseline.playSHA1, files['/play/index.html']);
  assert(baseline.environment?.site?.entries > 0 && safeHash(baseline.environment.snippetsSha256), 'Missing protected configuration evidence.');
  return files;
}
async function assertLiveBaseline(api, baseline) {
  const site = await api(`sites/${SITE_ID}`);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, baseline.deploy.id, 'Production changed; capture and review a new candidate.');
  assert.equal(site.published_deploy.locked, true, 'Current production lock changed.');
  const deploy = await api(`deploys/${baseline.deploy.id}`);
  assert.equal(deploy.state, 'ready'); assert.equal(deploy.locked, true);
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, deploy.id), baseline.files, 'Complete current static inventory');
  eq(await protectedEnvironment(api, site), baseline.environment, 'Protected environment/settings/snippets');
}
function overlays() {
  return Object.entries(DELIVERY_SOURCES).map(([publicPath, source]) => {
    const filename = path.join(ROOT, source);
    assert(fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), 'Regular source file required.');
    return { path: publicPath, source, sha1: sha(fs.readFileSync(filename), 'sha1') };
  });
}
async function publicChecks(origin, plan, directory) {
  assert(origin === 'https://tree-token.xyz' || origin === originFor(plan.candidateId), 'Unapproved public check origin.');
  const paths = [...new Set([...Object.keys(plan.sources), '/play/index.html', '/scripts/arcade-monthly.js', '/scripts/arcade-season-deadline.js'])];
  for (const publicPath of paths) {
    const pathname = publicPath === '/play/index.html' ? '/play/' : publicPath;
    const response = await fetch(new URL(pathname, origin), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Public delivery failed: ' + pathname);
    const type = response.headers.get('content-type') || '';
    assert(publicPath.endsWith('.js') ? /javascript|ecmascript/i.test(type) : publicPath.endsWith('.css') ? /text\/css/i.test(type) : /text\/html/i.test(type), 'Unexpected content type.');
    const delivered = Buffer.from(await response.arrayBuffer());
    const bytes = publicPath.endsWith('.html') ? storedPlayHTML(delivered, plan.files[publicPath]) : delivered;
    assert.equal(sha(bytes, 'sha1'), plan.files[publicPath], 'Public bytes differ: ' + pathname);
    if (publicPath === '/play/index.html') assert(bytes.equals(fs.readFileSync(path.join(directory, 'baseline-play.html'))), 'Published HTML changed.');
  }
  const response = await fetch(origin + '/api/arcade-monthly?action=status', { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Monthly public status failed.');
  const status = await response.json();
  assert.equal(status.authenticated, false); assert.equal(status.configuration?.recovery?.price, '20000');
  assert.equal(status.configuration.recovery.amountBaseUnits, '20000000000');
  assert.equal(status.configuration.recovery.cutoffPolicy, 'utc-month-end-v1');
  assert.equal(status.configuration.recovery.cutoffEffectiveMonth, '2026-11');
}
async function verifyCandidate(api, baseline, plan, state, directory) {
  await assertLiveBaseline(api, baseline);
  const deploy = await api(`deploys/${state.id}`);
  assertNewCandidate(state, plan, deploy); assert.equal(deploy.state, 'ready');
  assert(!deploy.published_at, 'Candidate already published; inspect the recorded release.');
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, state.id), plan.files, 'Complete candidate static inventory');
  await publicChecks(originFor(state.id), { ...plan, candidateId: state.id }, directory);
  await assertLiveBaseline(api, baseline);
  return deploy;
}
async function verifyPublished(api, baseline, plan, state) {
  const site = await api(`sites/${SITE_ID}`), published = await api(`deploys/${state.id}`);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, state.id); assert.equal(site.published_deploy.locked, true);
  assert.equal(published.state, 'ready'); assert.equal(published.locked, true); assertNewCandidate(state, plan, published);
  assert(published.published_at, 'Candidate has no publication timestamp.');
  compareBackend(published, baseline.deploy);
  eq(await inventory(api, state.id), plan.files, 'Complete published static inventory');
  eq(await protectedEnvironment(api, site), baseline.environment, 'Published protected configuration');
  return published;
}
async function upload(token, id, pathname, bytes) {
  assert(safeId(id) && Object.hasOwn(DELIVERY_SOURCES, pathname), 'Upload outside the static wallet-switch scope.');
  let response;
  try { response = await fetch(`https://api.netlify.com/api/v1/deploys/${id}/files${pathname}`, { method: 'PUT', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(45000) }); }
  catch { throw Error('Upload transport failed; inspect this candidate before retrying. Raw details withheld.'); }
  assert(response.ok, `Upload failed (HTTP ${response.status}); raw details withheld.`);
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    directory: { type: 'string', default: RECORD_DIR }, 'source-commit': { type: 'string' },
    'expected-deploy': { type: 'string' }, 'browser-report': { type: 'string' },
    'expected-candidate': { type: 'string' }, 'main-commit': { type: 'string' },
  } });
  const mode = positionals[0];
  assert(positionals.length === 1 && ['capture', 'plan', 'candidate', 'verify', 'publish', 'audit'].includes(mode), 'Use capture|plan|candidate|verify|publish|audit.');
  const expected = values['expected-deploy'] || process.env.ARCADE_WALLET_SWITCH_EXPECTED_DEPLOY;
  assert(safeId(expected), 'An explicit expected locked production deployment is required.');
  assert(!process.env.DEBUG && !process.env.NODE_DEBUG, 'Unset debug logging for authenticated release requests.');
  const token = process.env.NETLIFY_AUTH_TOKEN;
  assert(token, 'The existing NETLIFY_AUTH_TOKEN release connection is required.');
  const api = scopedAPI(apiClient(token), mode), directory = path.resolve(ROOT, values.directory);
  const baselinePath = path.join(directory, 'baseline.json'), planPath = path.join(directory, 'plan.json'), statePath = path.join(directory, 'candidate.json');
  if (mode === 'capture') {
    assert(!fs.existsSync(baselinePath), 'Use a fresh capture directory.');
    const site = await api(`sites/${SITE_ID}`), deploy = await api(`deploys/${expected}`);
    assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
    assert.equal(site.published_deploy?.id, expected, 'The expected production baseline changed.');
    assert.equal(site.published_deploy.locked, true);
    const files = await inventory(api, expected), environment = await protectedEnvironment(api, site);
    const baseline = { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID, capturedAt: new Date().toISOString(),
      deploy: { id: deploy.id, site_id: deploy.site_id, state: deploy.state, locked: deploy.locked,
        created_at: deploy.created_at, published_at: deploy.published_at, available_functions: deploy.available_functions,
        function_schedules: deploy.function_schedules, ...runtimeFor(deploy) }, files, environment, playSHA1: files['/play/index.html'] };
    validateBaseline(baseline, expected);
    const response = await fetch(originFor(expected) + '/play/', { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Current play HTML unavailable.');
    const html = storedPlayHTML(Buffer.from(await response.arrayBuffer()), baseline.playSHA1);
    for (const pathname of ['/scripts/arcade-daily-growth-play-share.js', '/styles/arcade-organization.css']) {
      assert(html.includes(pathname), 'Current HTML does not load the reviewed asset: ' + pathname);
    }
    // The wallet bridge is loaded dynamically by Daily Growth, not an HTML tag.
    const dailyResponse = await fetch(originFor(expected) + '/scripts/arcade-daily-growth-play-share.js',
      { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(dailyResponse.status, 200, 'Current Daily Growth asset unavailable.');
    const daily = Buffer.from(await dailyResponse.arrayBuffer());
    assert.equal(sha(daily, 'sha1'), files['/scripts/arcade-daily-growth-play-share.js'], 'Current Daily Growth bytes differ.');
    assert(daily.includes('/assets/arcade/arcade-growth-wallet.js'), 'Current Daily Growth does not load the expected bridge.');
    await assertLiveBaseline(api, baseline);
    fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, 'baseline-play.html'), html, { flag: 'wx' });
    writeRecord(baselinePath, baseline, true);
    console.log(JSON.stringify({ mode, productionChanged: false, baselineId: expected, staticFiles: Object.keys(files).length,
      backendRecords: deploy.available_functions.length, schedules: deploy.function_schedules.length }));
    return;
  }
  const baseline = readRecord(baselinePath), baselineFiles = validateBaseline(baseline, expected);
  assert.equal(sha(fs.readFileSync(path.join(directory, 'baseline-play.html')), 'sha1'), baseline.playSHA1, 'Captured HTML integrity failed.');
  let plan;
  if (mode === 'plan') {
    assert(!fs.existsSync(planPath), 'Plan already exists.');
    const sourceCommit = values['source-commit'] || git('rev-parse', 'HEAD'), sourceTree = git('rev-parse', 'HEAD^{tree}');
    assertSource(sourceCommit, sourceTree); await assertLiveBaseline(api, baseline);
    plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: expected, baselineSha256: fingerprint(baseline), baselineCreatedAt: baseline.deploy.created_at,
      createdAt: new Date().toISOString(), sourceCommit, sourceTree, sourceBranch: git('branch', '--show-current'),
      title: `TREE Arcade wallet sign-out and account switching ${sourceCommit.slice(0, 12)}; preserve current production`, ...assembleFiles(baselineFiles, overlays()) };
    writeRecord(planPath, plan, true);
  } else {
    plan = readRecord(planPath); assert.equal(plan.baselineSha256, fingerprint(baseline)); assert.equal(plan.baselineId, expected);
    assertSource(plan.sourceCommit, plan.sourceTree);
    if (values['source-commit']) assert.equal(values['source-commit'], plan.sourceCommit);
    eq(assembleFiles(baselineFiles, overlays()), { files: plan.files, sources: plan.sources,
      changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths }, 'Local release sources');
    if (mode !== 'audit') await assertLiveBaseline(api, baseline);
  }
  let state, deploy;
  if (mode === 'candidate') {
    assert(!fs.existsSync(statePath), 'Candidate exists; verify it instead of creating another.');
    const requestStartedAt = new Date().toISOString();
    deploy = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(plan.title)}`, 'POST', { files: plan.files,
      functions: Object.fromEntries(baseline.deploy.available_functions.map(f => [f.n, f.d])),
      functions_config: functionsConfig(baseline.deploy), function_schedules: baseline.deploy.function_schedules,
      draft: false, async: false, branch: baseline.deploy.branch });
    state = { schemaVersion: 1, siteId: SITE_ID, id: deploy.id, baselineId: expected, sourceCommit: plan.sourceCommit,
      planSha256: fingerprint(plan), requestStartedAt, candidateCreatedAt: deploy.created_at,
      technicalVerifiedAt: null, browserReview: null };
    writeRecord(statePath, state, true); assertNewCandidate(state, plan, deploy); validateUploadRequirements(deploy, plan);
    for (const digest of deploy.required) {
      const pathname = plan.changedOriginals.find(p => plan.files[p] === digest);
      const bytes = fs.readFileSync(path.join(ROOT, plan.sources[pathname])); assert.equal(sha(bytes, 'sha1'), digest);
      await upload(token, state.id, pathname, bytes);
    }
    for (let attempt = 0; attempt < 120; attempt++) {
      deploy = await api(`deploys/${state.id}`);
      if (deploy.state === 'ready') break;
      assert(!['error', 'rejected', 'canceled'].includes(deploy.state), 'Candidate failed; production remains locked.');
      await delay(1000);
    }
  } else if (mode !== 'plan') state = readRecord(statePath);
  if (state) {
    if (values['expected-candidate']) assert.equal(state.id, values['expected-candidate']);
    if (mode === 'audit') {
      assert.equal(values['expected-candidate'], state.id, 'Audit requires the explicit bound candidate ID.');
      deploy = await verifyPublished(api, baseline, plan, state);
      await publicChecks('https://tree-token.xyz', { ...plan, candidateId: state.id }, directory);
      await verifyPublished(api, baseline, plan, state);
      state.lastAuditedAt = new Date().toISOString(); state.publishedAt = deploy.published_at;
    } else {
      deploy = await verifyCandidate(api, baseline, plan, state, directory); state.technicalVerifiedAt = new Date().toISOString();
    }
    if ((mode === 'verify' || mode === 'audit') && values['browser-report']) {
      const report = read(path.resolve(ROOT, values['browser-report'])); validateBrowserReview(report, plan, state);
      state.browserReview = { report, sha256: fingerprint(report) };
    }
    if (mode === 'publish') {
      assert.equal(values['expected-candidate'], state.id, 'Explicit reviewed candidate ID required.');
      assert(state.browserReview, 'Review the ready candidate before publication.');
      assert.equal(state.browserReview.sha256, fingerprint(state.browserReview.report));
      validateBrowserReview(state.browserReview.report, plan, state);
      const mainCommit = values['main-commit']; assert(safeCommit(mainCommit), 'Exact merged main commit required.');
      const assertMain = () => {
        assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0], mainCommit, 'Remote main changed.');
        assert.equal(git('rev-parse', `${mainCommit}^{tree}`), plan.sourceTree, 'Main differs from the complete reviewed candidate source tree.');
      };
      assertMain(); await waitForAllBuilds(api, state.id); await assertLiveBaseline(api, baseline);
      const beforeLock = await api(`deploys/${state.id}`);
      assertNewCandidate(state, plan, beforeLock); assert.equal(beforeLock.state, 'ready');
      assert(!beforeLock.published_at, 'Candidate was published while waiting; inspect it before continuing.');
      compareBackend(beforeLock, baseline.deploy);
      eq(await inventory(api, state.id), plan.files, 'Final candidate static inventory');
      assert.equal((await activeDeploys(api, state.id)).length, 0, 'A new queued build blocks publication.');
      assertMain();
      state.publicationRequestedAt = new Date().toISOString(); state.mainCommit = mainCommit; writeRecord(statePath, state);
      // Only the new reviewed candidate can reach this lock/publication request.
      await api(`deploys/${state.id}/lock`, 'POST');
      for (let attempt = 0; attempt < 60; attempt++) {
        const current = await api(`sites/${SITE_ID}`);
        assert([expected, state.id].includes(current.published_deploy?.id), 'Concurrent publication detected.');
        if (current.published_deploy.id === state.id && current.published_deploy.locked === true) break;
        await delay(1000);
      }
      deploy = await verifyPublished(api, baseline, plan, state);
      await publicChecks('https://tree-token.xyz', { ...plan, candidateId: state.id }, directory);
      await verifyPublished(api, baseline, plan, state); state.publishedAt = deploy.published_at;
    }
    writeRecord(statePath, state);
  }
  const report = { schemaVersion: 1, mode, result: 'passed', checkedAt: new Date().toISOString(), baselineId: expected,
    candidateId: state?.id ?? null, sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree, planSha256: fingerprint(plan),
    staticFiles: Object.keys(plan.files).length, baselineStaticFiles: Object.keys(baselineFiles).length,
    preservedStaticFiles: Object.keys(baselineFiles).length - plan.changedOriginals.length,
    changedOriginals: plan.changedOriginals, addedPaths: [], files: plan.files,
    backendRecords: baseline.deploy.available_functions.length, preservedBackendRecords: baseline.deploy.available_functions.length,
    completeBackendSHA256: fingerprint(sorted(baseline.deploy.available_functions, 'n')),
    schedulesPreserved: baseline.deploy.function_schedules.length, protectedConfigurationSHA256: fingerprint(baseline.environment),
    browserReviewSHA256: state?.browserReview?.sha256 ?? null,
    productionChanged: mode === 'publish', publishedCandidateVerified: ['publish', 'audit'].includes(mode),
    productionLocked: true, mainCommit: state?.mainCommit ?? null,
    url: state ? originFor(state.id) + '/play/' : null };
  writeRecord(path.join(directory, 'report.json'), report);
  console.log(JSON.stringify({ ...report, files: undefined }, null, 2)); return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
