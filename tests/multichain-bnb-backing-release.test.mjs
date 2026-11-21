import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { functionsConfig } from '../scripts/release-arcade-cutoff.mjs';
import { AUDITED_STALE_DEPLOYS } from '../scripts/release-stats-market.mjs';
import { ARBORETUM_SNIPPET, assertServedContent } from '../scripts/rootcaster-served-content.mjs';
import { sourceEvidence, toolingEvidence, sha256 } from '../scripts/package-bnb-backing.mjs';
import { SITE_ID, ACCOUNT_ID, BASELINE_ID, FUNCTION_NAME, DELIVERY_SOURCES,
  ADDED_PATHS, REQUIRED_CHANGES, ORIGINAL_PATH_HASHES, ORIGINAL_PACKAGE_SHA256,
  EXPECTED_ROUTES, EXPECTED_TRAFFIC, validatePackage, validateBaseline, validateReadOnlyProof,
  assembleFiles, compareBackend, validateUploadRequirements, createDeployPayload, validateBrowserReview,
  validatePublicationMessage, assertNewCandidate, scopedAPI, activeDeploys,
  waitForAllBuilds, lockCandidateAfterBuilds } from '../scripts/release-bnb-backing.mjs';

const clone = value => structuredClone(value);
const zip = Buffer.from('one reviewed isolated archive');
function pack() {
  return { schemaVersion: 1, kind: 'bnb-backing-review-package', name: FUNCTION_NAME,
    filename: FUNCTION_NAME + '.zip', deployed: false, gameplayAuthorized: false, productionApproved: false, paymentsEnabled: false,
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
    edge_functions_present: false, server: null, available_functions: [...functions, newRecord({ ...pack(), sha256: ORIGINAL_PACKAGE_SHA256, bytes: 2750820 })],
    function_schedules: functions.slice(0, 5).map(f => ({ name: f.n, cron: '0 0 * * *' })) };
}
function newRecord(p = pack()) {
  return { n: FUNCTION_NAME, d: p.sha256, id: 'b'.repeat(64), oid: 'c'.repeat(64),
    a: '123456789012', c: '2026-11-21T00:00:00Z', r: 'nodejs24.x', rg: 'us-east-2',
    m: 1024, s: p.bytes, im: 'stream', bd: clone(p.buildData),
    ro: [{ p: '/api/arcade-bnb-test', l: '/api/arcade-bnb-test', e: null, m: [], ps: false }],
    tr: clone(EXPECTED_TRAFFIC), dn: null, g: null,
    obl: 'netlify-observability-extension', oblv: 34, unknownFutureField: { exact: true } };
}
function candidate(base = backend(), p = pack()) {
  return { ...clone(base), id: '1'.repeat(24), locked: false, published_at: null,
    available_functions: clone(base.available_functions).map(f => f.n === FUNCTION_NAME ? newRecord(p) : f) };
}
function files() {
  return { ...ORIGINAL_PATH_HASHES, '/index.html': 'a'.repeat(40), '/play/index.html': 'b'.repeat(40),
    '/play/multichaintest/original/sui/ack/index.html': 'c'.repeat(40),
    ...Object.fromEntries(Array.from({ length: 646 }, (_, i) => ['/keep/' + i + '.js', 'd'.repeat(40)])) };
}
function baseline() {
  return { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID,
    deploy: backend(), files: files(), environment: { site: { entries: 1 }, snippetsSha256: 'e'.repeat(64) } };
}
const overlays = () => Object.entries(DELIVERY_SOURCES).map(([path, source], i) => ({ path, source, sha1: String(i + 1).repeat(40) }));

test('baseline requires the exact current ready locked 651/51/5 inventory', () => {
  assert.equal(Object.keys(validateBaseline(baseline())).length, 651);
  for (const mutate of [b => { b.deploy.id = 'f'.repeat(24); }, b => { b.deploy.locked = false; },
    b => { b.deploy.state = 'building'; }, b => { delete b.files['/keep/0.js']; },
    b => { b.files['/extra.js'] = 'f'.repeat(40); }, b => { b.deploy.available_functions.pop(); },
    b => { b.deploy.function_schedules.pop(); }, b => { b.deploy.available_functions[5].n = FUNCTION_NAME; },
    b => { b.deploy.available_functions.at(-1).d = 'f'.repeat(64); },
    b => { b.files[REQUIRED_CHANGES[0]] = 'f'.repeat(40); },
    b => { b.environment = {}; }]) {
    const b = baseline(); mutate(b); assert.throws(() => validateBaseline(b));
  }
});

test('replaces only the two BNB page files while retaining all 649 unrelated hashes', () => {
  const before = files(), result = assembleFiles(before, overlays());
  assert.equal(Object.keys(result.files).length, 651);
  assert.deepEqual(result.addedPaths, ADDED_PATHS); assert.deepEqual(result.changedOriginals, REQUIRED_CHANGES);
  for (const [pathname, digest] of Object.entries(before)) if (!REQUIRED_CHANGES.includes(pathname)) assert.equal(result.files[pathname], digest);
});

test('rejects wrong baseline bytes, missing/extra overlays and source substitution', () => {
  const rows = overlays();
  assert.throws(() => assembleFiles({ ...files(), [REQUIRED_CHANGES[0]]: 'f'.repeat(40) }, rows));
  assert.throws(() => assembleFiles(files(), rows.slice(1)));
  assert.throws(() => assembleFiles(files(), [...rows, { path: '/index.html', source: 'index.html', sha1: 'a'.repeat(40) }]));
  assert.throws(() => assembleFiles(files(), [{ ...rows[0], source: 'secret.env' }, rows[1]]));
  assert.throws(() => assembleFiles(files(), [...rows, { ...rows[0], path: rows[0].path.toUpperCase() }]));
});

test('preserves all 50 unrelated full provider records while replacing the one reviewed BNB package', () => {
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

test('rejects a missing, renamed, duplicate or second replacement function', () => {
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

test('requires the exact replacement runtime, bootstrap, route, package and rate limit', () => {
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

test('pins all replacement provider metadata after the first verification', () => {
  const before = backend(), p = pack(), d = candidate(before, p);
  const pinned = compareBackend(d, before, p);
  compareBackend(d, before, p, pinned);
  for (const change of [{ id: 'd'.repeat(64) }, { a: '987654321098' }, { oblv: 35 }, { newField: 'changed' }]) {
    const changed = clone(d); Object.assign(changed.available_functions.at(-1), change);
    assert.throws(() => compareBackend(changed, before, p, pinned));
  }
});

test('replacement permits only validated allocation changes and keeps unknown configuration exact', () => {
  const before = backend(), p = pack(), d = candidate(before, p);
  Object.assign(d.available_functions.at(-1), { id: 'd'.repeat(64), oid: 'e'.repeat(64),
    a: '987654321098', c: '2026-11-21T01:00:00Z' });
  compareBackend(d, before, p);
  for (const change of [{ id: 'invalid' }, { oid: '' }, { a: 'invalid' }, { c: 'invalid' },
    { obl: 'changed' }, { oblv: 35 }, { unknownFutureField: { exact: false } }, { newField: 'unreviewed' }]) {
    const changed = clone(d); Object.assign(changed.available_functions.at(-1), change);
    assert.throws(() => compareBackend(changed, before, p), JSON.stringify(change));
  }
  const removed = clone(d); delete removed.available_functions.at(-1).unknownFutureField;
  assert.throws(() => compareBackend(removed, before, p));
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
  assert.equal(Object.keys(config).length, 51);
  assert.deepEqual(config['existing-2'].event_subscriptions, ['deploySucceeded']);
  assert.deepEqual(config['existing-2'].traffic_rules, { existing: 'preserve' });
  assert(!Object.hasOwn(config['existing-2'], 'runtime')); assert(!Object.hasOwn(config['existing-2'], 'invocation_mode'));
});

test('allows only the exact replacement ZIP and the two approved static upload hashes', () => {
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

test('create payload uses supported fields and preserves all source guards outside the API body', () => {
  const before = baseline(), p = pack(), plan = {
    ...assembleFiles(before.files, overlays()), functionPackage: p,
    sourceCommit: 'b'.repeat(40), sourceTree: 'c'.repeat(40),
    environment: { privateEvidence: 'never-submit-as-deploy-overrides' },
  };
  const payload = createDeployPayload(before, plan);
  assert.deepEqual(Object.keys(payload).sort(), [
    'async', 'branch', 'draft', 'files', 'function_schedules', 'functions', 'functions_config',
  ]);
  assert(!Object.hasOwn(payload, 'commit_ref'));
  assert(!Object.hasOwn(payload, 'environment'));
  assert.equal(plan.sourceCommit, 'b'.repeat(40)); assert.equal(plan.sourceTree, 'c'.repeat(40));
  assert.equal(Object.keys(payload.files).length, 651);
  for (const [pathname, digest] of Object.entries(before.files)) if (!REQUIRED_CHANGES.includes(pathname)) assert.equal(payload.files[pathname], digest);
  assert.equal(Object.keys(payload.functions).length, 51);
  assert.equal(Object.keys(payload.functions_config).length, 51);
  const originalConfig = functionsConfig(before.deploy);
  for (const f of before.deploy.available_functions) {
    assert.equal(payload.functions[f.n], f.n === FUNCTION_NAME ? p.sha256 : f.d);
    assert.deepEqual(payload.functions_config[f.n], originalConfig[f.n]);
  }
  assert.equal(payload.functions[FUNCTION_NAME], p.sha256);
  assert.deepEqual(payload.functions_config[FUNCTION_NAME], originalConfig[FUNCTION_NAME]);
  assert.deepEqual(payload.function_schedules, before.deploy.function_schedules);
  assert.equal(payload.draft, false); assert.equal(payload.async, false); assert.equal(payload.branch, 'main');
});

test('package manifest binds runtime, exact source closure, toolchain, traffic and archive bytes', () => {
  const p = pack(); validatePackage(p, zip);
  for (const mutate of [p => { p.sourceFiles[0].sha256 = 'f'.repeat(64); }, p => { p.sourceFiles.pop(); },
    p => { p.tooling.lockSha256 = 'f'.repeat(64); }, p => { p.runtimeVersion = 'nodejs22.x'; },
    p => { p.invocationMode = 'buffered'; }, p => { p.buildData.runtimeAPIVersion = 1; },
    p => { p.trafficRules.action.config.rate_limit_config.window_limit = 600; },
    p => { p.routes[0].pattern = '/api/*'; }, p => { p.gameplayAuthorized = true; },
    p => { p.productionApproved = true; }, p => { p.tooling.sui = '2.27.0'; }]) {
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
    passed: true, noWalletOrPaymentActions: true, mockedWallet: true, mockedApi: true, viewportWidths: [1440,390,320],
    liveAssets: true, installedWalletVerified: false, gameplayAuthorized: false, playwrightVersion: '1.56.1',
    pageURL: 'https://' + state.id + '--tree-token.netlify.app/play/multichaintest/game/bnb/',
    htmlSha256: sha256(fs.readFileSync('play/multichaintest/game/bnb/index.html')),
    appSha256: sha256(fs.readFileSync('play/multichaintest/game/bnb/app.js')),
    checkedAt: '2026-11-21T01:01:00Z',
    scenarios: [1440,390,320].flatMap(width => ['signed-out','diagnostic','rpc-error','wallet-change'].map(name => ({name,width,passed:true}))) };
  return { plan, state, review, now: Date.parse('2026-11-21T01:02:00Z') };
}

test('requires a fresh browser review tied to the exact source, plan and new candidate', () => {
  const { plan, state, review, now } = reviewFixture(); validateBrowserReview(review, plan, state, now);
  for (const change of [{ passed: false }, { noWalletOrPaymentActions: false }, { mockedWallet: false }, { mockedApi: false },
    { liveAssets: false }, { installedWalletVerified: true }, { gameplayAuthorized: true }, { playwrightVersion: '1.55.0' },
    { pageURL: 'https://tree-token.xyz/play/multichaintest/game/bnb/' },
    { htmlSha256: 'f'.repeat(64) }, { appSha256: 'f'.repeat(64) },
    { candidateId: BASELINE_ID }, { sourceCommit: 'c'.repeat(40) }, { planSha256: 'd'.repeat(64) },
    { viewportWidths: [1440,390] }, { checkedAt: '2026-11-20T01:00:00Z' }, { scenarios: [] }]) {
    assert.throws(() => validateBrowserReview({ ...review, ...change }, plan, state, now));
  }
  for (const mutate of [r => { r.scenarios[0].passed = false; }, r => { r.scenarios[0].width = 800; },
    r => { r.scenarios[0] = r.scenarios[1]; }, r => { r.scenarios.pop(); },
    r => { r.scenarios = r.scenarios.map((s,i) => ({...s,name:'case-'+i,width:320})); }]) {
    const changed = clone(review); mutate(changed);
    assert.throws(() => validateBrowserReview(changed, plan, state, now));
  }
});

test('read-only proof binds exact source, actual retired diagnostic and both freshness timestamps', () => {
  const source = 'a'.repeat(40), checkedAt = '2026-11-21T15:00:00Z', now = Date.parse(checkedAt) + 60000;
  const report = { passed: true, mode: 'read-only', sourceCommit: source, checkedAt,
    gameplayAuthorized: false, productionApproved: false, chainTransactionsSubmitted: 0, userWalletUsed: false,
    proof: { schemaVersion: 1, mode: 'original-one-slot-diagnostic', checkedAt,
      inspectedWallet: '0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae', classification: 'trial-retired',
      gameplayAuthorized: false, productionReady: false,
      backing: { nftId: '0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba',
        sourceCustodyConfirmed: false, lifecycle: 'released' },
      bnb: { chainId: 56, passState: 'Retired', canPlay: false, finality: 'finalized',
        ownerMatches: false, blockNumber: '123456', blockHash: '0x' + '12'.repeat(32) },
      blockers: ['production-backing-registry-not-approved'] } };
  assert.equal(validateReadOnlyProof(report, source, now), fingerprint(report));
  for (const mutate of [r => { r.passed = false; }, r => { r.mode = 'canonical'; },
    r => { r.sourceCommit = 'b'.repeat(40); }, r => { r.gameplayAuthorized = true; },
    r => { r.productionApproved = true; }, r => { r.chainTransactionsSubmitted = 1; },
    r => { r.userWalletUsed = true; }, r => { r.checkedAt = 'invalid'; },
    r => { r.checkedAt = '2026-11-21T14:00:00Z'; }, r => { r.proof.checkedAt = '2026-11-21T14:00:00Z'; },
    r => { r.checkedAt = '2026-11-21T16:00:00Z'; }, r => { r.proof.bnb.passState = 'Active'; },
    r => { r.proof.bnb.finality = 'latest'; }, r => { r.proof.productionReady = true; },
    r => { r.proof.backing.sourceCustodyConfirmed = true; }, r => { r.proof.blockers = []; },
    r => { r.proof.backing.nftId = '0x' + 'ff'.repeat(32); }, r => { r.proof.backing.lifecycle = 'held'; },
    r => { r.proof.classification = 'active'; }, r => { r.proof.inspectedWallet = '0x' + '11'.repeat(20); },
    r => { r.proof.bnb.ownerMatches = true; }, r => { r.proof.bnb.blockHash = 'invalid'; },
    r => { r.proof.bnb.blockNumber = '0'; },
    r => { delete r.proof; }]) {
    const changed = clone(report); mutate(changed);
    assert.throws(() => validateReadOnlyProof(changed, source, now));
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
  validatePublicationMessage('Publish isolated sign-in [publish bnb backing] [skip netlify]');
  for (const text of ['[publish bnb backing]', '[skip netlify]', '[publish original ack] [skip netlify]']) {
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

test('a build queued during the final baseline checks blocks the actual lock request', async () => {
  for (const state of ['queued', 'enqueued', 'building', 'uploading', 'processing', 'pending_review', 'unknown-state']) {
    const calls = []; let queued = false;
    const build = { id: '2'.repeat(24), state, build_id: 'retried-git-build', site_id: SITE_ID };
    const api = async (target, method = 'GET') => {
      calls.push({ target, method });
      if (target.includes('/deploys?')) return queued ? [build] : [];
      if (target === `deploys/${build.id}`) return build;
      if (target === `sites/${SITE_ID}`) { queued = true; return { id: SITE_ID }; }
      throw Error('Unexpected request: ' + method + ' ' + target);
    };
    await assert.rejects(() => lockCandidateAfterBuilds(api, '1'.repeat(24), async () => {
      await api(`sites/${SITE_ID}`);
    }), /A new queued build blocks publication/, state);
    assert.equal(calls.filter(c => c.target.includes('/deploys?')).length, 2, 'Queue is checked before and after revalidation.');
    assert.equal(calls.some(c => c.method !== 'GET'), false, 'No deployment mutation is attempted.');
  }
});

test('the final lock guard preserves exact orphan exclusions and rejects a resumed orphan', async () => {
  const [id, [state,created_at,updated_at,context,commit_ref]] = [...AUDITED_STALE_DEPLOYS][0];
  const orphan = { id,site_id:SITE_ID,state,created_at,updated_at,context,commit_ref,build_id:null,published_at:null,locked:null };
  for (const resumed of [false, true]) {
    const calls = []; let revalidated = false;
    const api = async (target, method = 'GET') => {
      calls.push({ target, method });
      if (target.includes('/deploys?')) return [orphan];
      if (target === `deploys/${id}`) return revalidated && resumed ? { ...orphan, build_id: 'resumed-git-build' } : orphan;
      if (target === `deploys/${'1'.repeat(24)}/lock` && method === 'POST') return { locked: true };
      throw Error('Unexpected request: ' + method + ' ' + target);
    };
    const publish = () => lockCandidateAfterBuilds(api, '1'.repeat(24), async () => { revalidated = true; });
    if (resumed) {
      await assert.rejects(publish, /A new queued build blocks publication/);
      assert.equal(calls.some(c => c.method !== 'GET'), false);
    } else {
      assert.deepEqual(await publish(), { locked: true });
      assert.deepEqual(calls.at(-1), { target: `deploys/${'1'.repeat(24)}/lock`, method: 'POST' });
      assert.equal(calls.at(-2).target, `deploys/${id}`, 'The final active-build inspection immediately precedes locking.');
    }
  }
});

test('a failed final baseline or source check never reaches the lock request', async () => {
  const calls = [];
  const api = async (target, method = 'GET') => { calls.push({ target, method }); return []; };
  await assert.rejects(() => lockCandidateAfterBuilds(api, '1'.repeat(24), async () => {
    throw Error('Final source proof rejected');
  }), /Final source proof rejected/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

test('only the exact historical orphan record may bypass active-build detection', async () => {
  const [id, [state,created_at,updated_at,context,commit_ref]] = [...AUDITED_STALE_DEPLOYS][0];
  const orphan = {id,site_id:SITE_ID,state,created_at,updated_at,context,commit_ref,build_id:null,published_at:null,locked:null};
  const api = row => async target => target.includes('/deploys?') ? [{id,state}] : row;
  assert.deepEqual(await activeDeploys(api(orphan), '1'.repeat(24)), []);
  assert.equal((await activeDeploys(api({...orphan,build_id:'resumed-build'}), '1'.repeat(24))).length, 1);
  assert.equal((await activeDeploys(api({...orphan,updated_at:'2026-11-21T00:00:00Z'}), '1'.repeat(24))).length, 1);
});

test('actual replacement HTML accepts exactly the existing body-end site snippet', () => {
  const source = fs.readFileSync('play/multichaintest/game/bnb/index.html');
  const served = Buffer.from(source.toString('utf8').replace('</body>', ARBORETUM_SNIPPET + '</body>'));
  assertServedContent('index.html', served, source);
  assert.throws(() => assertServedContent('index.html', Buffer.from(served.toString().replace('Tree Force', 'Changed')), source));
});
