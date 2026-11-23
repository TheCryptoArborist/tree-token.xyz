import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  SITE_ID, ACCOUNT_ID, CONTROL_FILE, REVIEW_FILE, DELIVERY_SOURCES, REQUIRED_CHANGES, ADDED_PATHS,
  BASELINE_TARGET_SHA1, COUNTDOWN_BROWSER_CHECKS, BROWSER_WIDTHS, BROWSER_SCENARIOS,
  assembleFiles, compareBackend, validateBaseline, validateUploadRequirements,
  validatePublicationControl, validateControlCommit, validateBrowserReview, validateDeliveredFile, scopedAPI,
} from '../scripts/release-arcade-countdown.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

const hash = (value, algorithm = 'sha256') => crypto.createHash(algorithm).update(value).digest('hex');
const BASE = 'a'.repeat(24), CANDIDATE = 'b'.repeat(24), SOURCE = 'c'.repeat(40), TREE = 'd'.repeat(40), MAIN = 'e'.repeat(40);
const NOW = Date.parse('2026-11-22T23:10:00Z');
const copy = value => structuredClone(value);
function baseline() {
  // Archived provider structure is only a test fixture; production capture is always live.
  const recorded = JSON.parse(readFileSync(new URL('../production/arcade-cutoff-deployment-20261118.json', import.meta.url)));
  const files = Object.fromEntries(['/index.html', '/play/index.html', '/scripts/arcade-monthly.js',
    '/scripts/arcade-season-deadline.js', '/scripts/arcade-organization.js', '/other-current-game/index.html']
    .map(path => [path, hash('current ' + path, 'sha1')]));
  Object.assign(files, BASELINE_TARGET_SHA1);
  return { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID,
    deploy: { id: BASE, site_id: SITE_ID, state: 'ready', locked: true,
      available_functions: recorded.available_functions, function_schedules: recorded.function_schedules, ...recorded.runtime },
    files, playSHA1: files['/play/index.html'],
    environment: { site: { entries: 5, sha256: hash('environment') }, snippetsSha256: hash('snippets') } };
}
const overlays = () => Object.entries(DELIVERY_SOURCES).map(([path, source]) => ({ path, source, sha1: hash('new ' + path, 'sha1') }));
function control() {
  return { schemaVersion: 1, action: 'publish-arcade-countdown', sourceCommit: SOURCE, sourceTree: TREE,
    mainCommit: MAIN, expectedDeploy: BASE, candidateId: CANDIDATE, planSha256: hash('plan'),
    candidateRunId: 101, candidateArtifactId: 202, candidateArtifactSHA256: hash('archive'), browserReview: REVIEW_FILE };
}
function review() {
  const plan = { sourceCommit: SOURCE, sourceTree: TREE };
  const state = { id: CANDIDATE, candidateCreatedAt: '2026-11-22T23:05:00Z' };
  const checks = Object.fromEntries(COUNTDOWN_BROWSER_CHECKS.map(name => [name, true]));
  const report = { schemaVersion: 1, result: 'passed', sourceCommit: SOURCE, sourceTree: TREE,
    candidateId: CANDIDATE, planSha256: fingerprint(plan), origin: `https://${CANDIDATE}--tree-token.netlify.app`,
    checkedAt: '2026-11-22T23:08:00Z', noWalletOrPaymentActions: true, syntheticWalletOnly: true, syntheticDataOnly: true,
    viewportWidths: [...BROWSER_WIDTHS], expectedScenarioCount: 6, attemptedScenarioCount: 6, passedScenarioCount: 6,
    checks, failures: [], browserErrors: [], assetFailures: [], unexpectedWrites: [],
    viewports: BROWSER_WIDTHS.map(width => ({ width, checks: { ...checks },
      scenarios: BROWSER_SCENARIOS.map(name => ({ name, result: 'passed' })) })) };
  return { plan, state, report };
}

test('exactly two existing countdown paths change with no additions or removed current paths', () => {
  const b = baseline(), plan = assembleFiles(b.files, overlays());
  assert.deepEqual(REQUIRED_CHANGES, ['/scripts/arcade-next-month-unlocks.js', '/styles/arcade-organization.css']);
  assert.deepEqual(ADDED_PATHS, []); assert.deepEqual(plan.addedPaths, []);
  assert.deepEqual(plan.changedOriginals, [...REQUIRED_CHANGES].sort());
  assert.deepEqual(Object.keys(plan.files).sort(), Object.keys(b.files).sort());
  for (const [path, digest] of Object.entries(b.files)) if (!REQUIRED_CHANGES.includes(path)) assert.equal(plan.files[path], digest);
});

test('unreviewed assets, missing targets, incomplete overlays, substitutions, duplicates and no-ops fail', () => {
  const b = baseline(), rows = overlays();
  for (const path of ['/play/index.html', '/assets/arcade-growth-wallet.js', '/play/new-calendar/index.html']) {
    assert.throws(() => assembleFiles(b.files, [...rows, { path, source: path.slice(1), sha1: hash(path, 'sha1') }]), /Unapproved/);
  }
  for (const path of REQUIRED_CHANGES) {
    const absent = copy(b.files); delete absent[path];
    assert.throws(() => assembleFiles(absent, rows), /existing asset is missing/);
    assert.throws(() => assembleFiles(b.files, rows.filter(row => row.path !== path)), /Complete approved source inventory/);
    assert.throws(() => assembleFiles(b.files, rows.map(row => row.path === path ? { ...row, sha1: b.files[path] } : row)), /Both reviewed/);
  }
  assert.throws(() => assembleFiles(b.files, [...rows, rows[0]]), /Duplicate/);
  assert.throws(() => assembleFiles(b.files, rows.map((row, i) => i ? row : { ...row, source: 'dist/substitute.js' })), /Unapproved overlay source/);
});

test('fresh capture retains future current assets but rejects drift in either reviewed target baseline', () => {
  const b = baseline(); validateBaseline(b, BASE);
  b.files['/newly-published-cabinet/index.html'] = hash('future cabinet', 'sha1');
  validateBaseline(b, BASE);
  assert.equal(assembleFiles(b.files, overlays()).files['/newly-published-cabinet/index.html'], b.files['/newly-published-cabinet/index.html']);
  for (const path of REQUIRED_CHANGES) {
    const changed = copy(b); changed.files[path] = hash('unreviewed concurrent change', 'sha1');
    assert.throws(() => validateBaseline(changed, BASE), /baseline asset changed/);
  }
  assert.throws(() => validateBaseline(b, CANDIDATE));
});

test('complete backend records including unknown provider fields, runtime and schedules remain immutable', () => {
  const original = baseline().deploy;
  original.available_functions[0].futureProviderField = { keep: ['all', 'values'] };
  compareBackend(copy(original), original);
  const changed = copy(original); changed.available_functions[0].futureProviderField.keep.pop();
  assert.throws(() => compareBackend(changed, original), /backend record/);
  const schedule = copy(original); schedule.function_schedules[0].cron = '1 * * * *';
  assert.throws(() => compareBackend(schedule, original), /schedules/);
  const runtime = copy(original); runtime.functions_region = 'different-region';
  assert.throws(() => compareBackend(runtime, original), /runtime settings|function region/);
});

test('static upload allowlist and GET-only audit prohibit backend uploads or publication writes', () => {
  const plan = assembleFiles(baseline().files, overlays());
  const good = { required: REQUIRED_CHANGES.map(path => plan.files[path]), required_functions: [], required_edge_functions: [], required_server: [] };
  validateUploadRequirements(good, plan);
  for (const key of ['required_functions', 'required_edge_functions', 'required_server']) assert.throws(() => validateUploadRequirements({ ...good, [key]: ['package'] }, plan), /upload forbidden/);
  assert.throws(() => validateUploadRequirements({ ...good, required: [hash('unreviewed', 'sha1')] }, plan), /Unchanged or unapproved/);
  const calls = [], api = scopedAPI((...args) => calls.push(args), 'audit');
  api(`deploys/${CANDIDATE}`);
  assert.throws(() => api(`deploys/${CANDIDATE}/lock`, 'POST'), /forbidden/);
  assert.throws(() => api(`deploys/${CANDIDATE}/files/scripts/example.js`, 'PUT'), /forbidden/);
  assert.equal(calls.length, 1);
});

test('publication control binds the original artifact and one exact merged source tree', () => {
  const c = control(), commit = { mode: 'publish', parents: [MAIN], mainTree: TREE,
    changedFiles: [CONTROL_FILE, REVIEW_FILE], message: '[publish arcade countdown] [skip netlify]' };
  validatePublicationControl(c); validateControlCommit(c, commit);
  assert.throws(() => validatePublicationControl({ ...c, candidateId: BASE }), /older deploy/);
  assert.throws(() => validatePublicationControl({ ...c, candidateArtifactSHA256: 'missing' }), /artifact digest/);
  assert.throws(() => validateControlCommit(c, { ...commit, parents: [SOURCE] }), /declared merged main/);
  assert.throws(() => validateControlCommit(c, { ...commit, mainTree: SOURCE }), /differs from reviewed source/);
  assert.throws(() => validateControlCommit(c, { ...commit, changedFiles: [...commit.changedFiles, 'scripts/unreviewed.js'] }), /Only the control/);
  assert.throws(() => validateControlCommit(c, { ...commit, message: '[publish arcade countdown]' }), /markers/);
});

test('six exact candidate-bound browser cases require all viewport checks and current zero-error evidence', () => {
  const { plan, state, report } = review(); validateBrowserReview(report, plan, state, NOW);
  for (const key of COUNTDOWN_BROWSER_CHECKS) {
    const bad = copy(report); bad.checks[key] = false;
    assert.throws(() => validateBrowserReview(bad, plan, state, NOW), /Missing countdown check/);
  }
  for (const mutate of [
    r => { r.origin = 'https://tree-token.xyz'; },
    r => { r.sourceTree = MAIN; },
    r => { r.planSha256 = hash('different'); },
    r => { r.checkedAt = '2026-11-21T20:00:00Z'; },
    r => { r.viewportWidths = [390, 1280]; },
    r => { r.passedScenarioCount = 5; },
    r => { r.viewports[0].checks.singleTimer = false; },
    r => { r.viewports[0].scenarios[0].name = 'unrelated'; },
    r => { r.viewports[0].scenarios.pop(); },
    r => { r.assetFailures.push({ status: 404 }); },
    r => { r.unexpectedWrites.push({ method: 'POST' }); },
  ]) { const bad = copy(report); mutate(bad); assert.throws(() => validateBrowserReview(bad, plan, state, NOW)); }
});

test('delivered JS/CSS require correct MIME and the exact planned bytes', () => {
  for (const [path, mime] of [['/scripts/arcade-next-month-unlocks.js', 'application/javascript'], ['/styles/arcade-organization.css', 'text/css']]) {
    const bytes = Buffer.from('reviewed ' + path), digest = hash(bytes, 'sha1');
    assert.deepEqual(validateDeliveredFile(path, mime + '; charset=utf-8', bytes, digest), bytes);
    assert.throws(() => validateDeliveredFile(path, 'text/html', bytes, digest), /Unexpected content type/);
    assert.throws(() => validateDeliveredFile(path, mime, Buffer.concat([bytes, Buffer.from('tampered')]), digest), /Public bytes differ/);
  }
});

test('workflow publication gates use the exact countdown actions, artifacts and fresh locked baseline', () => {
  const workflow = readFileSync(new URL('../.github/workflows/arcade-countdown.yml', import.meta.url), 'utf8');
  assert.match(workflow, /validatePublicationControl\(control,mode\+'-arcade-countdown'\)/);
  assert.match(workflow, /if \(c\.action === 'publish-arcade-countdown'\) for \(const ref/);
  assert.match(workflow, /artifact\.name,'arcade-countdown-candidate-'/);
  assert.match(workflow, /tree-production-preservation-release/);
  assert.equal((workflow.match(/6b03741d72033c45517f32e3/g) || []).length, 2);
  assert.doesNotMatch(workflow, /mode\+'-arcade-advent'|c\.action === 'publish-arcade-advent'/);
});
