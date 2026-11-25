// Static-only preservation release. Never rebuild functions or publish the root snapshot.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonical, fingerprint, environmentFor } from './release-preserved-production.mjs';
import { SITE_ID, ACCOUNT_ID, validateBackend, compareBackend, functionsConfig,
  waitForAllBuilds, storedPlayHTML } from './release-arcade-cutoff.mjs';

export const REVIEWED_BASELINE = '6b072a462f1fe15134450132';
export const DELIVERY_SOURCES = {
  '/play/profile-studio/index.html': 'production/profile-studio-ribbon-flow-static/index.html',
  '/scripts/tree-profile-studio-v20.js': 'scripts/tree-profile-studio-v20.js',
  '/scripts/profile-ribbons-v2.js': 'scripts/profile-ribbons-v2.js',
  '/styles/tree-profile-studio-v13.css': 'styles/tree-profile-studio-v13.css',
};
export const REVIEW_PATH = 'docs/profile-studio-ribbon-flow-validation.json';
export const SOURCE_PATHS = [...Object.values(DELIVERY_SOURCES),
  'scripts/profile-badge-position.js', 'scripts/profile-photo-fit.js', 'scripts/profile-ribbons.js',
  'tests/profile-ribbons-v2.test.mjs', 'tests/profile-ribbons.test.mjs', 'tests/profile-badge-position.test.mjs',
  'tests/profile-photo-fit.test.mjs', 'scripts/release-profile-studio-ribbon-flow.mjs',
  '.github/workflows/profile-studio-ribbon-flow.yml', 'scripts/release-arcade-cutoff.mjs',
  'scripts/release-preserved-production.mjs', 'scripts/release-stats-market.mjs',
  'scripts/release-sti-purchase.mjs', 'scripts/stats-market-delivery.mjs',
  'scripts/sti-purchase-delivery.mjs'];
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRECTORY = path.join(ROOT, '.netlify/profile-studio-ribbon-flow');
const HTML_PATH = '/play/profile-studio/index.html';
const ADDED_PATHS = Object.keys(DELIVERY_SOURCES).filter(p => p !== HTML_PATH);
const sha = (bytes, algorithm = 'sha1') => crypto.createHash(algorithm).update(bytes).digest('hex');
const safeId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const safeCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
// Hash comparisons never include protected environment records in assertion output.
const same = (actual, expected, label) => assert(canonical(actual) === canonical(expected), label + ' changed; stop.');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const originFor = id => { assert(safeId(id)); return `https://${id}--tree-token.netlify.app`; };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function assembleFiles(baseline, overlays) {
  assert(/^[a-f0-9]{40}$/.test(baseline[HTML_PATH] || ''), 'Existing Studio HTML is missing.');
  same(Object.keys(overlays).sort(), Object.keys(DELIVERY_SOURCES).sort(), 'Exact Studio delivery allowlist');
  for (const p of ADDED_PATHS) assert(!Object.hasOwn(baseline, p), 'New Studio asset already exists; review scope: ' + p);
  for (const digest of Object.values(overlays)) assert(/^[a-f0-9]{40}$/.test(digest), 'Invalid overlay digest.');
  const files = { ...baseline, ...overlays };
  same(Object.keys(baseline).filter(p => files[p] !== baseline[p]), [HTML_PATH], 'Only existing Studio HTML may change');
  return files;
}

export function validateBrowserReview(review, state, now = Date.now()) {
  assert.equal(review.validated, true, 'Actual candidate browser review is required.');
  assert.equal(review.candidateId, state.id); assert.equal(review.sourceCommit, state.sourceCommit);
  assert.equal(review.origin, originFor(state.id), 'Review must use the immutable candidate.');
  const checkedAt = Date.parse(review.checkedAt);
  assert(Number.isFinite(checkedAt) && checkedAt >= Date.parse(state.createdAt)
    && checkedAt <= now + 300000, 'Invalid candidate review time.');
  assert(Array.isArray(review.viewportWidths)
    && review.viewportWidths.includes(375)
    && review.viewportWidths.some(w => Number.isInteger(w) && w >= 1024), 'Review a 375px phone layout and a desktop layout.');
  for (const key of ['sixRibbons', 'cryptoLeaves', 'curvedText', 'topBottomPlacement',
    'ribbonPosition', 'ribbonSize', 'ribbonReset', 'ribbonDrag', 'noPhotoBadgeChanges', 'profileAndFrameExports', 'transparentCorners', 'mobileLayout'])
    assert.equal(review.checks?.[key], true, 'Missing browser evidence: ' + key);
  // A local photo export is valid evidence only for the exact candidate source.
  // The actual candidate still requires UI review, a frame export, and byte checks.
  const exports = review.exportEvidence;
  assert(['candidate', 'same-source-local'].includes(exports?.profile?.testedOn), 'Record where the profile export was exercised.');
  assert.equal(exports.profile.sourceCommit, state.sourceCommit, 'Profile export source differs from the candidate.');
  assert.equal(exports.profile.passed, true, 'A successful profile PNG export is required.');
  assert.equal(exports.frame?.testedOn, 'candidate', 'Exercise frame export on the actual candidate.');
  assert.equal(exports.frame.passed, true, 'A successful candidate frame PNG export is required.');
  assert.equal(exports.candidateDeliveryMatchesReviewedSource, true, 'Candidate delivery must match the reviewed source.');
}

async function writeRecord(name, value) {
  await fs.mkdir(DIRECTORY, { recursive: true });
  await fs.writeFile(path.join(DIRECTORY, name + '.json'), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await fs.writeFile(path.join(DIRECTORY, name + '.json.sha256'), fingerprint(value) + '\n', { mode: 0o600 });
}
async function readRecord(name) {
  const value = JSON.parse(await fs.readFile(path.join(DIRECTORY, name + '.json'), 'utf8'));
  assert.equal((await fs.readFile(path.join(DIRECTORY, name + '.json.sha256'), 'utf8')).trim(), fingerprint(value), 'Release record integrity mismatch.');
  return value;
}
async function sourceFingerprint() {
  return fingerprint(Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async p => [p, sha(await fs.readFile(path.join(ROOT, p)), 'sha256')]))));
}
function snapshotDeploy(d) {
  const fields = ['id', 'site_id', 'state', 'locked', 'created_at', 'published_at',
    'available_functions', 'function_schedules', 'branch', 'context', 'functions_region',
    'functions_region_overrides', 'database_branch_id', 'blobs_region', 'framework',
    'edge_functions_present', 'server', 'database_migrations'];
  return Object.fromEntries(fields.filter(k => Object.hasOwn(d, k)).map(k => [k, d[k]]));
}

export async function main(mode = process.argv[2]) {
  assert(['candidate', 'verify', 'publish', 'audit'].includes(mode), 'Use candidate, verify, publish, or read-only audit.');
  assert(!process.env.DEBUG && !process.env.NODE_DEBUG, 'Unset debug logging for authenticated release work.');
  const token = process.env.NETLIFY_AUTH_TOKEN, expected = process.env.EXPECTED_DEPLOY;
  const sourceCommit = process.env.SOURCE_COMMIT;
  assert(token, 'The existing Netlify release connection is unavailable.');
  assert.equal(expected, REVIEWED_BASELINE, 'Capture/review a new baseline before changing this release pin.');
  assert(safeCommit(sourceCommit), 'Pin an exact committed source SHA.');
  assert.equal(git('rev-parse', 'HEAD'), sourceCommit, 'Checkout differs from the candidate source.');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Commit source before releasing.');
  for (const p of SOURCE_PATHS) git('cat-file', '-e', `${sourceCommit}:${p}`);
  const sourceSHA256 = await sourceFingerprint();
  const candidateTitle = `Profile Studio ribbon flow source ${sourceCommit}`;
  const changes = Object.fromEntries(await Promise.all(Object.entries(DELIVERY_SOURCES)
    .map(async ([p, source]) => [p, await fs.readFile(path.join(ROOT, source))])));
  const overlays = Object.fromEntries(Object.entries(changes).map(([p, bytes]) => [p, sha(bytes)]));
  let state;
  async function api(endpoint, method = 'GET', body, binary = false) {
    const create = mode === 'candidate' && method === 'POST' && endpoint.startsWith(`sites/${SITE_ID}/deploys?title=`);
    const upload = mode === 'candidate' && method === 'PUT' && state && endpoint.startsWith(`deploys/${state.id}/files/`);
    const lock = mode === 'publish' && method === 'POST' && state && endpoint === `deploys/${state.id}/lock`;
    assert(method === 'GET' || create || upload || lock, 'Remote mutation is outside this release phase.');
    let response;
    for (let attempt = 0; attempt < (method === 'GET' ? 3 : 1); attempt++) {
      try {
        response = await fetch('https://api.netlify.com/api/v1/' + endpoint, {
          method, redirect: 'error', signal: AbortSignal.timeout(45000),
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
          body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
        }); break;
      } catch {
        if (method !== 'GET' || attempt === 2) throw Error('Netlify request failed; raw details withheld. Inspect state before retrying a mutation.');
        await pause(250 * (attempt + 1));
      }
    }
    assert(response.ok, `Netlify ${method} failed (HTTP ${response.status}); raw details withheld.`);
    return response.json();
  }
  async function inventory(id) {
    const files = {};
    for (let page = 1; page <= 100; page++) {
      const rows = await api(`deploys/${id}/files?per_page=100&page=${page}`);
      assert(Array.isArray(rows), 'Invalid static inventory.');
      for (const f of rows) {
        assert(typeof f.path === 'string' && f.path.startsWith('/') && !Object.hasOwn(files, f.path), 'Invalid/duplicate static path.');
        assert(/^[a-f0-9]{40}$/.test(f.sha), 'Invalid static digest.'); files[f.path] = f.sha;
      }
      if (rows.length < 100) { assert(Object.keys(files).length); return files; }
    }
    throw Error('Incomplete static inventory; publication refused.');
  }
  async function deploy(id) {
    const d = await api(`sites/${SITE_ID}/deploys/${id}`);
    assert.equal(d.site_id, SITE_ID); assert.equal(d.id, id);
    if (d.state === 'ready') validateBackend(d);
    return d;
  }
  async function protectedEnvironment(site) {
    assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
    const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
    const [siteEnv, siteFunctions, shared, sharedFunctions, snippets] = await Promise.all([
      api(base + query), api(base + query + '&scope=functions'), api(base),
      api(base + '?scope=functions'), api(`sites/${SITE_ID}/snippets`),
    ]);
    assert(Array.isArray(snippets), 'Snippet configuration unavailable.');
    return { ...environmentFor({ site: siteEnv, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings }),
      snippetsSHA256: fingerprint(snippets) };
  }
  async function assertBaseline() {
    const site = await api(`sites/${SITE_ID}`);
    assert.equal(site.published_deploy?.id, expected, 'Production changed; capture and review a new candidate.');
    assert.equal(site.published_deploy.locked, true, 'Production lock changed.');
    const current = await deploy(expected);
    assert.equal(current.state, 'ready'); assert.equal(current.locked, true);
    compareBackend(current, state.baseline.deploy);
    same(await inventory(expected), state.baseline.files, 'Current complete static inventory');
    same(await protectedEnvironment(site), state.baseline.environment, 'Protected settings/environment/snippets');
  }
  async function preserveCandidate() {
    const d = await deploy(state.id);
    assert.equal(d.state, 'ready'); assert.equal(d.created_at, state.createdAt);
    // Manual digest deployments may return null commit_ref. Bind the complete
    // source SHA in the supported title as well as the exact source/asset hashes.
    assert.equal(d.title, candidateTitle, 'Candidate source title changed.');
    if (d.commit_ref != null) assert.equal(d.commit_ref, sourceCommit, 'Candidate source identity changed.');
    compareBackend(d, state.baseline.deploy);
    same(await inventory(state.id), state.files, 'Complete candidate static inventory');
    same(await protectedEnvironment(await api(`sites/${SITE_ID}`)), state.baseline.environment, 'Protected settings/environment/snippets');
    return d;
  }
  async function verifyDelivery(origin) {
    for (const [p, digest] of Object.entries(overlays)) {
      const publicPath = p === HTML_PATH ? '/play/profile-studio/' : p;
      const response = await fetch(new URL(publicPath, origin), { redirect: 'error', signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, 'Studio delivery failed: ' + publicPath);
      const type = response.headers.get('content-type') || '';
      assert(p.endsWith('.js') ? /javascript|ecmascript/i.test(type) : p.endsWith('.css') ? /text\/css/i.test(type) : /text\/html/i.test(type), 'Unexpected content type.');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(sha(p === HTML_PATH ? storedPlayHTML(bytes, digest) : bytes), digest, 'Served Studio bytes differ: ' + p);
    }
  }

  if (mode === 'candidate') {
    assert(!await fs.stat(path.join(DIRECTORY, 'state.json')).catch(() => null), 'Candidate state exists; inspect/verify it instead of creating another.');
    await waitForAllBuilds(api);
    const site = await api(`sites/${SITE_ID}`);
    assert.equal(site.published_deploy?.id, expected); assert.equal(site.published_deploy.locked, true);
    const baseline = await deploy(expected);
    assert.equal(baseline.state, 'ready'); assert.equal(baseline.locked, true);
    assert.equal(baseline.available_functions.length, 62, 'Review the changed backend inventory.');
    assert.equal(baseline.function_schedules.length, 5);
    const originalFiles = await inventory(expected);
    for (const helper of ['scripts/profile-photo-fit.js', 'scripts/profile-badge-position.js', 'scripts/profile-ribbons.js']) {
      assert.equal(originalFiles['/' + helper], sha(await fs.readFile(path.join(ROOT, helper))),
        'The existing photo, badge and ribbon helpers must remain unchanged: ' + helper);
    }
    const files = assembleFiles(originalFiles, overlays);
    state = { schemaVersion: 1, sourceCommit, sourceSHA256, overlays, files,
      baseline: { deploy: snapshotDeploy(baseline), files: originalFiles, environment: await protectedEnvironment(site) } };
    await assertBaseline();
    const requestStartedAt = new Date().toISOString();
    const d = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(candidateTitle)}`, 'POST', {
      files, functions: Object.fromEntries(baseline.available_functions.map(f => [f.n, f.d])),
      functions_config: functionsConfig(baseline), function_schedules: baseline.function_schedules,
      draft: false, async: false, branch: baseline.branch, commit_ref: sourceCommit,
    });
    assert(safeId(d.id) && d.id !== expected, 'Only a new candidate may be used.');
    Object.assign(state, { id: d.id, createdAt: d.created_at, requestStartedAt });
    await writeRecord('state', state);
    assert(Number.isFinite(Date.parse(d.created_at)) && Date.parse(d.created_at) >= Date.parse(requestStartedAt) - 10000, 'Candidate creation time mismatch.');
    for (const key of ['required', 'required_functions', 'required_edge_functions', 'required_server']) assert(Array.isArray(d[key]), 'Missing upload inventory: ' + key);
    for (const key of ['required_functions', 'required_edge_functions', 'required_server']) assert.equal(d[key].length, 0, 'Non-static uploads prohibited: ' + key);
    for (const hash of d.required) {
      const p = Object.keys(changes).find(p => overlays[p] === hash);
      assert(p, 'An existing preserved file was requested for upload.');
      await api(`deploys/${d.id}/files/${p.slice(1)}`, 'PUT', changes[p], true);
    }
  } else state = await readRecord('state');
  assert.equal(state.schemaVersion, 1); assert.equal(state.sourceCommit, sourceCommit);
  assert.equal(state.sourceSHA256, sourceSHA256, 'Candidate source bytes changed.');
  assert.equal(state.baseline.deploy.id, expected); assert(safeId(state.id) && state.id !== expected);
  if (process.env.EXPECTED_CANDIDATE) assert.equal(state.id, process.env.EXPECTED_CANDIDATE);
  same(state.overlays, overlays, 'Candidate overlays');
  same(state.files, assembleFiles(state.baseline.files, overlays), 'Complete release plan');
  let d;
  for (let attempt = 0; attempt < 60; attempt++) {
    d = await deploy(state.id);
    if (d.state === 'ready') break;
    assert.notEqual(d.state, 'error', 'Candidate failed.'); await pause(1000);
  }
  assert.equal(d.state, 'ready', 'Candidate did not become ready.');
  await preserveCandidate();
  if (mode === 'candidate') await assertBaseline();
  if (mode === 'verify') {
    await waitForAllBuilds(api, state.id); await assertBaseline();
    assert(!d.published_at, 'Candidate is already published; use audit.');
    await verifyDelivery(originFor(state.id)); await preserveCandidate(); await assertBaseline();
    state.technicalVerifiedAt = new Date().toISOString(); await writeRecord('state', state);
  }
  if (mode === 'publish' || mode === 'audit') {
    assert(state.technicalVerifiedAt, 'Technical verification must finish before publication.');
    assert(process.env.PROFILE_STUDIO_VALIDATION_FILE, 'Supply the actual browser validation record.');
    const review = JSON.parse(await fs.readFile(process.env.PROFILE_STUDIO_VALIDATION_FILE, 'utf8'));
    validateBrowserReview(review, state); state.browserReviewSHA256 = fingerprint(review);
    if (mode === 'publish') {
      await waitForAllBuilds(api, state.id); await assertBaseline();
      d = await preserveCandidate(); assert(!d.published_at, 'Candidate already published; use read-only audit.');
      await verifyDelivery(originFor(state.id)); await assertBaseline();
      // This is the sole publication operation. Never unlock or restore a prior deploy.
      await api(`deploys/${state.id}/lock`, 'POST');
    }
    const published = await api(`sites/${SITE_ID}`);
    assert.equal(published.published_deploy?.id, state.id); assert.equal(published.published_deploy.locked, true);
    d = await preserveCandidate(); assert.equal(d.locked, true);
    await verifyDelivery('https://tree-token.xyz');
    const finalSite = await api(`sites/${SITE_ID}`);
    assert.equal(finalSite.published_deploy.id, state.id); assert.equal(finalSite.published_deploy.locked, true);
    await preserveCandidate(); state.publishedAt = d.published_at; await writeRecord('state', state);
  }
  const report = { schemaVersion: 1, mode, result: 'passed', checkedAt: new Date().toISOString(),
    sourceCommit, sourceSHA256, candidateId: state.id, baselineId: expected,
    url: originFor(state.id) + '/play/profile-studio/', canonicalUrl: 'https://tree-token.xyz/play/profile-studio/',
    staticPaths: Object.keys(state.files).length, preservedStaticPaths: Object.keys(state.baseline.files).length - 1,
    changedExistingPaths: [HTML_PATH], addedPaths: ADDED_PATHS,
    functionsPreserved: d.available_functions.length, schedulesPreserved: d.function_schedules.length,
    completeBackendRecordsPreserved: true, protectedConfigurationPreserved: true,
    sourceFiles: DELIVERY_SOURCES, files: state.files, technicalVerifiedAt: state.technicalVerifiedAt || null,
    browserReviewSHA256: state.browserReviewSHA256 || null, productionChanged: mode === 'publish',
    publishedCandidateVerified: mode === 'publish' || mode === 'audit',
    limitations: ['Environment comparisons cover API-visible records and value IDs; masked secret bytes are not readable.'] };
  await writeRecord('report', report); console.log(JSON.stringify({ ...report, files: undefined }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
