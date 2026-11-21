import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { functionsConfig } from '../scripts/release-arcade-cutoff.mjs';
import { AUDITED_STALE_DEPLOYS } from '../scripts/release-stats-market.mjs';
import { ARBORETUM_SNIPPET, assertServedContent } from '../scripts/rootcaster-served-content.mjs';
import { sourceEvidence, toolingEvidence, sha256 } from '../scripts/package-bnb-test-auth.mjs';
import { SITE_ID, ACCOUNT_ID, BASELINE_ID, FUNCTION_NAME, DELIVERY_SOURCES,
  ADDED_PATHS, EXPECTED_ROUTES, EXPECTED_TRAFFIC, validatePackage, validateBaseline,
  assembleFiles, compareBackend, validateUploadRequirements, validateBrowserReview,
  validatePublicationMessage, assertNewCandidate, scopedAPI, activeDeploys,
  waitForAllBuilds } from '../scripts/release-bnb-test-auth.mjs';

const clone = value => structuredClone(value);
const zip = Buffer.from('one reviewed isolated archive');
function pack() {
  return { schemaVersion: 1, kind: 'bnb-test-auth-review-package', name: FUNCTION_NAME,
    filename: FUNCTION_NAME + '.zip', deployed: false, gameplayAuthorized: false, paymentsEnabled: false,
    sha256: sha256(zip), bytes: zip.length, runtimeVersion: 'nodejs24.x', invocationMode: 'stream',
    buildData: { bootstrapVersion: '2.24.0', runtimeAPIVersion: 2 }, routes: clone(EXPECTED_ROUTES),
    trafficRules: clone(EXPECTED_TRAFFIC), sourceFiles: sourceEvidence(), tooling: toolingEvidence() };
}
function backend() {
  const functions = Array.from({ length: 50 }, (_, i) => ({ n: i ? 'existing-' + i : 'arcade-monthly',
    d: 'a'.repeat(64), id: 'id-' + i, oid: 'oid-' + i, a: '123456789012', c: '2026-11-20T00:00:00Z',
    r: i ? 'nodejs22.x' : 'nodejs24.x', rg: 'us-east-2', m: 1024, s: 100 + i, im: 'stream',
    bd: { bootstrapVersion: '2.24.0', runtimeAPIVersion: 2 }, ro: [],
    tr: { existing: 'preserve' }, obl: 'netlify-observability-extension', oblv: 34,
    unknownFutureField: { exact: true } }));
  return { id: BASELINE_ID, site_id: SITE_ID, state: 'ready', locked: true,
    created_at: '2026-11-20T17:53:00Z', published_at: '2026-11-20T17:54:20.217Z',
    branch: 'main', context: 'production', functions_region: 'cmh', blobs_region: 'us-east-2',
    functions_region_overrides: [], database_branch_id: null, database_migrations: null,
    edge_functions_present: false, server: null, available_functions: functions,
    function_schedules: functions.slice(0, 5).map(f => ({ name: f.n, cron: '0 0 * * *' })) };
}
function newRecord(p = pack()) {
  return { n: FUNCTION_NAME, d: p.sha256, id: 'b'.repeat(64), oid: 'c'.repeat(64),
    a: '123456789012', c: '2026-11-21T00:00:00Z', r: 'nodejs24.x', rg: 'us-east-2',
    m: 1024, s: p.bytes, im: 'stream', bd: clone(p.buildData),
    ro: [{ p: '/api/arcade-bnb-test', l: '/api/arcade-bnb-test', e: null, m: [], ps: false }],
    tr: clone(EXPECTED_TRAFFIC), obl: 'netlify-observability-extension', oblv: 34 };
}
function candidate(base = backend(), p = pack()) {
  return { ...clone(base), id: '1'.repeat(24), locked: false, published_at: null,
    available_functions: [...clone(base.available_functions), newRecord(p)] };
}
function files() {
  return { '/index.html': 'a'.repeat(40), '/play/index.html': 'b'.repeat(40),
    '/play/multichaintest/original/sui/ack/index.html': 'c'.repeat(40),
    ...Object.fromEntries(Array.from({ length: 646 }, (_, i) => ['/keep/' + i + '.js', 'd'.repeat(40)])) };
}
function baseline() {
  return { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID,
    deploy: backend(), files: files(), environment: { site: { entries: 1 }, snippetsSha256: 'e'.repeat(64) } };
}
const overlays = () => Object.entries(DELIVERY_SOURCES).map(([path, source], i) => ({ path, source, sha1: String(i + 1).repeat(40) }));

test('baseline requires the exact current ready locked 649/50/5 inventory', () => {
  assert.equal(Object.keys(validateBaseline(baseline())).length, 649);
  for (const mutate of [b => { b.deploy.id = 'f'.repeat(24); }, b => { b.deploy.locked = false; },
    b => { b.deploy.state = 'building'; }, b => { delete b.files['/keep/0.js']; },
    b => { b.files['/extra.js'] = 'f'.repeat(40); }, b => { b.deploy.available_functions.pop(); },
    b => { b.deploy.function_schedules.pop(); }, b => { b.deploy.available_functions[5].n = FUNCTION_NAME; },
    b => { b.environment = {}; }]) {
    const b = baseline(); mutate(b); assert.throws(() => validateBaseline(b));
  }
});

test('adds only the two BNB page files while retaining all 649 original hashes', () => {
  const before = files(), result = assembleFiles(before, overlays());
  assert.equal(Object.keys(result.files).length, 651);
  assert.deepEqual(result.addedPaths, ADDED_PATHS); assert.deepEqual(result.changedOriginals, []);
  for (const [pathname, digest] of Object.entries(before)) assert.equal(result.files[pathname], digest);
});

test('rejects replacing a published page, missing/extra overlays and source substitution', () => {
  const rows = overlays();
  assert.throws(() => assembleFiles({ ...files(), [ADDED_PATHS[0]]: 'f'.repeat(40) }, rows));
  assert.throws(() => assembleFiles(files(), rows.slice(1)));
  assert.throws(() => assembleFiles(files(), [...rows, { path: '/index.html', source: 'index.html', sha1: 'a'.repeat(40) }]));
  assert.throws(() => assembleFiles(files(), [{ ...rows[0], source: 'secret.env' }, rows[1]]));
  assert.throws(() => assembleFiles(files(), [...rows, { ...rows[0], path: rows[0].path.toUpperCase() }]));
});

test('preserves every full original provider record while adding one reviewed package', () => {
  const before = backend(), p = pack(), after = candidate(before, p);
  assert.deepEqual(compareBackend(after, before, p), newRecord(p));
  compareBackend(clone(before), before);
  for (const field of ['d', 'id', 'oid', 'a', 'c', 'r', 'rg', 'm', 's', 'im', 'bd', 'tr', 'ro', 'obl', 'oblv', 'unknownFutureField']) {
    const changed = clone(after); changed.available_functions[2][field] = 'changed';
    assert.throws(() => compareBackend(changed, before, p), field);
  }
  const missing = clone(after); delete missing.available_functions[2].unknownFutureField;
  assert.throws(() => compareBackend(missing, before, p));
});

test('rejects a missing, renamed, duplicate or second new function', () => {
  const before = backend(), p = pack();
  for (const mutate of [d => { d.available_functions.pop(); }, d => { d.available_functions.at(-1).n = 'unapproved'; },
    d => { d.available_functions.push(newRecord(p)); }, d => { d.available_functions[1].n = FUNCTION_NAME; }]) {
    const d = candidate(before, p); mutate(d); assert.throws(() => compareBackend(d, before, p));
  }
});

test('rejects backend runtime, regional override or schedule drift', () => {
  const before = backend(), p = pack();
  for (const mutate of [d => { d.function_schedules[0].cron = '1 * * * *'; },
    d => { d.function_schedules.push({ name: FUNCTION_NAME, cron: '* * * * *' }); },
    d => { d.functions_region_overrides.push({ name: FUNCTION_NAME, region: 'cmh' }); },
    d => { d.blobs_region = 'us-west-2'; }, d => { d.context = 'deploy-preview'; },
    d => { d.server = { id: 'unapproved' }; }, d => { d.edge_functions_present = true; }]) {
    const d = candidate(before, p); mutate(d); assert.throws(() => compareBackend(d, before, p));
  }
});

test('requires the exact new runtime, bootstrap, route, package and rate limit', () => {
  const before = backend(), p = pack();
  for (const change of [{ r: 'nodejs22.x' }, { im: 'buffered' }, { rg: 'eu-west-1' }, { m: 2048 },
    { d: 'f'.repeat(64) }, { s: 1 }, { bd: { runtimeAPIVersion: 1 } }, { ro: [] },
    { ro: [{ p: '/api/*', l: null, e: null, m: [], ps: false }] }, { tr: {} },
    { mo: 1024 }, { rgo: 'us-east-2' }, { vcpu: 1 }, { es: ['deploySucceeded'] },
    { er: [{ p: '/api/protected' }] }, { p: 10 }]) {
    const d = candidate(before, p); Object.assign(d.available_functions.at(-1), change);
    assert.throws(() => compareBackend(d, before, p), JSON.stringify(change));
  }
});

test('pins all newly allocated provider metadata after the first verification', () => {
  const before = backend(), p = pack(), d = candidate(before, p);
  const pinned = compareBackend(d, before, p);
  compareBackend(d, before, p, pinned);
  for (const change of [{ id: 'd'.repeat(64) }, { a: '987654321098' }, { oblv: 35 }, { newField: 'changed' }]) {
    const changed = clone(d); Object.assign(changed.available_functions.at(-1), change);
    assert.throws(() => compareBackend(changed, before, p, pinned));
  }
});

test('only new-route null/empty serialization is allowed, then the complete record is pinned', () => {
  const before = backend(), p = pack(), d = candidate(before, p);
  d.available_functions.at(-1).ro[0].m = null;
  const pinned = compareBackend(d, before, p);
  d.available_functions.at(-1).ro[0].m = [];
  assert.throws(() => compareBackend(d, before, p, pinned));
  d.available_functions.at(-1).ro[0].m = ['GET'];
  assert.throws(() => compareBackend(d, before, p));
});

test('supported function config preserves routes and traffic without runtime guesswork', () => {
  const b = backend(); b.available_functions[2].es = ['deploySucceeded'];
  const config = functionsConfig(b);
  assert.equal(Object.keys(config).length, 50);
  assert.deepEqual(config['existing-2'].event_subscriptions, ['deploySucceeded']);
  assert.deepEqual(config['existing-2'].traffic_rules, { existing: 'preserve' });
  assert(!Object.hasOwn(config['existing-2'], 'runtime')); assert(!Object.hasOwn(config['existing-2'], 'invocation_mode'));
});

test('allows only the exact new ZIP and the two approved static upload hashes', () => {
  const p = pack(), plan = { ...assembleFiles(files(), overlays()), functionPackage: p };
  const allowed = { required: overlays().map(x => x.sha1), required_functions: [p.sha256], required_edge_functions: [], required_server: [] };
  validateUploadRequirements(allowed, plan);
  validateUploadRequirements({ ...allowed, required_functions: [] }, plan);
  for (const change of [{ required: ['a'.repeat(40)] }, { required_functions: ['a'.repeat(64)] },
    { required_functions: [p.sha256, p.sha256] }, { required_edge_functions: ['new'] },
    { required_server: ['new'] }, { required: undefined }]) {
    assert.throws(() => validateUploadRequirements({ ...allowed, ...change }, plan));
  }
});

test('package manifest binds runtime, exact source closure, toolchain, traffic and archive bytes', () => {
  const p = pack(); validatePackage(p, zip);
  for (const mutate of [p => { p.sourceFiles[0].sha256 = 'f'.repeat(64); }, p => { p.sourceFiles.pop(); },
    p => { p.tooling.lockSha256 = 'f'.repeat(64); }, p => { p.runtimeVersion = 'nodejs22.x'; },
    p => { p.invocationMode = 'buffered'; }, p => { p.buildData.runtimeAPIVersion = 1; },
    p => { p.trafficRules.action.config.rate_limit_config.window_limit = 600; },
    p => { p.routes[0].pattern = '/api/*'; }, p => { p.gameplayAuthorized = true; }]) {
    const changed = clone(p); mutate(changed); assert.throws(() => validatePackage(changed, zip));
  }
  assert.throws(() => validatePackage(p, Buffer.from('different archive')));
});

function reviewFixture() {
  const plan = { sourceCommit: 'b'.repeat(40), baselineId: BASELINE_ID, baselineCreatedAt: '2026-11-20T17:53:00Z', title: 'new BNB candidate' };
  const state = { schemaVersion: 1, siteId: SITE_ID, id: '1'.repeat(24), baselineId: BASELINE_ID,
    sourceCommit: plan.sourceCommit, planSha256: fingerprint(plan), requestStartedAt: '2026-11-21T01:00:00Z',
    candidateCreatedAt: '2026-11-21T01:00:01Z' };
  const review = { sourceCommit: plan.sourceCommit, candidateId: state.id, planSha256: fingerprint(plan),
    passed: true, noWalletOrPaymentActions: true, mockedWallet: true, viewportWidths: [1440,390,320],
    checkedAt: '2026-11-21T01:01:00Z', scenarios: ['disconnected', 'account-change'] };
  return { plan, state, review, now: Date.parse('2026-11-21T01:02:00Z') };
}

test('requires a fresh browser review tied to the exact source, plan and new candidate', () => {
  const { plan, state, review, now } = reviewFixture(); validateBrowserReview(review, plan, state, now);
  for (const change of [{ passed: false }, { noWalletOrPaymentActions: false }, { mockedWallet: false },
    { candidateId: BASELINE_ID }, { sourceCommit: 'c'.repeat(40) }, { planSha256: 'd'.repeat(64) },
    { viewportWidths: [1440,390] }, { checkedAt: '2026-11-20T01:00:00Z' }, { scenarios: [] }]) {
    assert.throws(() => validateBrowserReview({ ...review, ...change }, plan, state, now));
  }
});

test('new-candidate identity guard refuses old deployment reuse and changed plan identities', () => {
  const { plan, state } = reviewFixture();
  const deploy = { id: state.id, site_id: SITE_ID, created_at: state.candidateCreatedAt, title: plan.title };
  assertNewCandidate(state, plan, deploy);
  for (const change of [{ id: BASELINE_ID }, { planSha256: 'e'.repeat(64) }, { sourceCommit: 'c'.repeat(40) },
    { candidateCreatedAt: '2026-11-20T01:00:00Z' }]) assert.throws(() => assertNewCandidate({ ...state, ...change }, plan, deploy));
});

test('capture/plan/verify cannot mutate, and publish cannot unlock, restore or edit settings', async () => {
  const called = [], raw = async (...args) => { called.push(args); return {}; };
  for (const mode of ['capture','plan','verify','publish']) {
    const api = scopedAPI(raw, mode); await api(`sites/${SITE_ID}`);
    for (const target of [`deploys/${BASELINE_ID}/unlock`, `sites/${SITE_ID}/deploys/${BASELINE_ID}/restore`,
      `accounts/${ACCOUNT_ID}/env`, `sites/${SITE_ID}`]) assert.throws(() => api(target, 'POST'));
  }
  assert.equal(called.length, 4);
});

test('publication requires both explicit merge markers', () => {
  validatePublicationMessage('Publish isolated sign-in [publish bnb auth] [skip netlify]');
  for (const text of ['[publish bnb auth]', '[skip netlify]', '[publish original ack] [skip netlify]']) {
    assert.throws(() => validatePublicationMessage(text));
  }
});

test('all-build guard waits for genuine queued builds and rejects an incomplete history', async () => {
  let pass = 0, waits = 0;
  const api = async target => target.includes('/deploys?') ? (pass++ ? [] : [{id:'new-build',state:'queued'}])
    : {id:'new-build',site_id:SITE_ID,state:'queued',build_id:'real-build'};
  await waitForAllBuilds(api, '1'.repeat(24), { attempts: 2, pause: async () => { waits++; }, log: () => {} });
  assert.equal(waits, 1);
  const pending = async target => target.includes('/deploys?') ? [{id:'new-build',state:'building'}] : {id:'new-build',state:'building'};
  await assert.rejects(() => waitForAllBuilds(pending, '1'.repeat(24), {attempts:1,log:()=>{}}));
});

test('only the exact historical orphan record may bypass active-build detection', async () => {
  const [id, [state,created_at,updated_at,context,commit_ref]] = [...AUDITED_STALE_DEPLOYS][0];
  const orphan = {id,site_id:SITE_ID,state,created_at,updated_at,context,commit_ref,build_id:null,published_at:null,locked:null};
  const api = row => async target => target.includes('/deploys?') ? [{id,state}] : row;
  assert.deepEqual(await activeDeploys(api(orphan), '1'.repeat(24)), []);
  assert.equal((await activeDeploys(api({...orphan,build_id:'resumed-build'}), '1'.repeat(24))).length, 1);
  assert.equal((await activeDeploys(api({...orphan,updated_at:'2026-11-21T00:00:00Z'}), '1'.repeat(24))).length, 1);
});

test('actual new HTML accepts exactly the existing body-end site snippet', () => {
  const source = fs.readFileSync('play/multichaintest/game/bnb/index.html');
  const served = Buffer.from(source.toString('utf8').replace('</body>', ARBORETUM_SNIPPET + '</body>'));
  assertServedContent('index.html', served, source);
  assert.throws(() => assertServedContent('index.html', Buffer.from(served.toString().replace('Tree Force', 'Changed')), source));
});
