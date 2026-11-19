import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  SITE_ID, ACCOUNT_ID, CONTROL_FILE, REVIEW_FILE, DELIVERY_SOURCES,
  assembleFiles, compareBackend, validateBaseline, validateUploadRequirements,
  validatePublicationControl, validateControlCommit, scopedAPI, assertNewCandidate,
  validateBrowserReview, activeDeploys, waitForAllBuilds,
} from '../scripts/release-arcade-polish.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { AUDITED_STALE_DEPLOYS } from '../scripts/release-stats-market.mjs';

const hash = (value, algorithm = 'sha256') => crypto.createHash(algorithm).update(value).digest('hex');
const copy = value => structuredClone(value);
const BASE = 'a'.repeat(24), CANDIDATE = 'b'.repeat(24), SOURCE = 'c'.repeat(40), TREE = 'd'.repeat(40), MAIN = 'e'.repeat(40);
const NOW = Date.parse('2026-11-18T22:00:00.000Z');
function baseline() {
  const recorded = JSON.parse(fs.readFileSync(new URL('../production/arcade-cutoff-deployment-20261118.json', import.meta.url)));
  const report = JSON.parse(fs.readFileSync(new URL('../production/arcade-cutoff-release-20261118.json', import.meta.url)));
  return { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID,
    deploy: { id: BASE, site_id: SITE_ID, state: 'ready', locked: true,
      created_at: '2026-11-18T20:00:00.000Z', published_at: '2026-11-18T20:01:00.000Z',
      available_functions: recorded.available_functions, function_schedules: recorded.function_schedules, ...recorded.runtime },
    files: report.files, playSHA1: report.files['/play/index.html'],
    environment: { site: { entries: 5, sha256: hash('site environment') }, snippetsSha256: hash('snippets') } };
}
const overlays = () => Object.entries(DELIVERY_SOURCES).map(([path, source]) => ({ path, source, sha1: hash('new ' + path, 'sha1') }));
function control() {
  return { schemaVersion: 1, action: 'publish-arcade-polish', sourceCommit: SOURCE, sourceTree: TREE,
    mainCommit: MAIN, expectedDeploy: BASE, candidateId: CANDIDATE, planSha256: hash('plan'),
    candidateRunId: 101, candidateArtifactId: '202', candidateArtifactSHA256: hash('artifact'), browserReview: REVIEW_FILE };
}
function candidate() {
  const plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: BASE, sourceCommit: SOURCE, sourceTree: TREE,
    baselineCreatedAt: '2026-11-18T20:00:00.000Z', title: 'TREE Arcade tab polish fixture' };
  const state = { schemaVersion: 1, siteId: SITE_ID, id: CANDIDATE, baselineId: BASE, sourceCommit: SOURCE,
    planSha256: fingerprint(plan), requestStartedAt: '2026-11-18T21:00:00.000Z', candidateCreatedAt: '2026-11-18T21:00:01.000Z' };
  const deploy = { id: CANDIDATE, site_id: SITE_ID, title: plan.title, created_at: state.candidateCreatedAt };
  const review = { schemaVersion: 1, result: 'passed', sourceCommit: SOURCE, sourceTree: TREE, candidateId: CANDIDATE,
    planSha256: fingerprint(plan), origin: `https://${CANDIDATE}--tree-token.netlify.app`,
    checkedAt: '2026-11-18T21:30:00.000Z', viewportWidths: [390, 1280], noWalletOrPaymentActions: true,
    checks: Object.fromEntries(['games', 'daily', 'campaigns', 'events', 'monthlyProgress', 'badgeCollection',
      'mobileLayout', 'noMissingAssets', 'countdownUTC'].map(key => [key, true])) };
  return { plan, state, deploy, review };
}

test('fresh baseline preserves the complete current inventory without count assumptions', () => {
  const b = baseline(); validateBaseline(b, BASE); compareBackend(copy(b.deploy), b.deploy);
  const extra = copy(b.deploy.available_functions[0]); extra.n = 'future-current-game'; extra.d = hash(extra.n);
  b.deploy.available_functions.push(extra); b.files['/new-current-cabinet/index.html'] = hash('current cabinet', 'sha1');
  validateBaseline(b, BASE); compareBackend(copy(b.deploy), b.deploy);
  const plan = assembleFiles(b.files, overlays());
  assert.equal(Object.keys(plan.files).length, Object.keys(b.files).length);
  assert.equal(plan.files['/new-current-cabinet/index.html'], b.files['/new-current-cabinet/index.html']);
});

test('the exact two approved existing paths change and every other digest stays intact', () => {
  const b = baseline(), plan = assembleFiles(b.files, overlays());
  assert.deepEqual(plan.changedOriginals, Object.keys(DELIVERY_SOURCES).sort());
  assert.deepEqual(plan.addedPaths, []);
  for (const pathname of Object.keys(b.files)) {
    if (!Object.hasOwn(DELIVERY_SOURCES, pathname)) assert.equal(plan.files[pathname], b.files[pathname]);
  }
  for (const pathname of ['/play/index.html', '/scripts/arcade-monthly.js', '/scripts/arcade-season-deadline.js']) {
    assert.equal(plan.files[pathname], b.files[pathname]);
  }
});

test('campaign foundation, HTML, package, source substitution and added assets cannot enter the payload', () => {
  const b = baseline();
  for (const path of ['/play/index.html', '/scripts/arcade-campaigns.js', '/config/arcade-campaigns.json', '/netlify/functions/example.js']) {
    assert.throws(() => assembleFiles(b.files, [...overlays(), { path, source: path.slice(1), sha1: hash(path, 'sha1') }]), /Unapproved/);
  }
  const missing = copy(b.files); delete missing['/styles/arcade-organization.css'];
  assert.throws(() => assembleFiles(missing, overlays()), /New static assets/);
  const substitution = overlays(); substitution[0].source = 'dist/styles/arcade-organization.css';
  assert.throws(() => assembleFiles(b.files, substitution), /Unapproved overlay source/);
});

test('incomplete, duplicate, invalid and no-op overlay plans fail closed', () => {
  const b = baseline(), rows = overlays();
  assert.throws(() => assembleFiles(b.files, rows.slice(1)), /Complete approved source inventory/);
  assert.throws(() => assembleFiles(b.files, [...rows, rows[0]]), /Duplicate/);
  const bad = copy(rows); bad[0].sha1 = 'not-a-digest';
  assert.throws(() => assembleFiles(b.files, bad), /SHA1/);
  const noop = rows.map(row => ({ ...row, sha1: b.files[row.path] }));
  assert.throws(() => assembleFiles(b.files, noop), /Both reviewed/);
});

test('every complete backend record including monthly identities and unknown provider fields is immutable', () => {
  const before = baseline().deploy;
  for (const name of ['arcade-monthly', before.available_functions[0].n]) {
    for (const field of ['d', 'id', 'oid', 'a', 'c', 's', 'r', 'm', 'rg', 'im', 'bd', 'futureProviderField']) {
      const after = copy(before), fn = after.available_functions.find(f => f.n === name);
      fn[field] = field === 'd' ? hash('different package') : { changed: true };
      assert.throws(() => compareBackend(after, before), undefined, name + '.' + field);
    }
  }
  const after = copy(before); after.available_functions.pop();
  assert.throws(() => compareBackend(after, before), /count changed/);
});

test('new materialized overrides are also rejected even when equal to effective settings', () => {
  const before = baseline().deploy;
  const fn = before.available_functions.find(f => !Object.hasOwn(f, 'mo'));
  assert(fn, 'Fixture includes a function with no memory override.');
  const after = copy(before); after.available_functions.find(f => f.n === fn.n).mo = fn.m;
  assert.throws(() => compareBackend(after, before), /Every complete backend record/);
});

test('schedule and runtime drift cannot pass static release verification', () => {
  const before = baseline().deploy;
  for (const mutate of [d => d.function_schedules.pop(), d => { d.function_schedules[0].cron = '* * * * *'; },
    d => { d.function_schedules[0].futureField = true; }, d => { d.functions_region = 'iad'; },
    d => { d.database_branch_id = 'other'; }, d => { d.blobs_region = 'other'; }, d => { d.framework = 'changed'; },
    d => { d.edge_functions_present = true; }, d => { d.server = { id: 'new' }; },
    d => { d.database_migrations = { files: ['new.sql'] }; }]) {
    const after = copy(before); mutate(after); assert.throws(() => compareBackend(after, before));
  }
});

test('baseline identity, lock, critical assets and environment evidence are mandatory', () => {
  const original = baseline();
  for (const mutate of [b => { b.deploy.id = CANDIDATE; }, b => { b.deploy.locked = false; },
    b => { delete b.files['/scripts/arcade-monthly.js']; }, b => { b.playSHA1 = hash('wrong', 'sha1'); },
    b => { b.environment = {}; }, b => { b.deploy.available_functions[0].oid = null; }]) {
    const b = copy(original); mutate(b); assert.throws(() => validateBaseline(b, BASE));
  }
});

test('only changed static digests may be uploaded and every backend upload is forbidden', () => {
  const b = baseline(), plan = assembleFiles(b.files, overlays());
  const good = { required: plan.changedOriginals.map(p => plan.files[p]), required_functions: [], required_edge_functions: [], required_server: [] };
  validateUploadRequirements(good, plan); validateUploadRequirements({ ...good, required: [] }, plan);
  for (const key of ['required_functions', 'required_edge_functions', 'required_server']) {
    assert.throws(() => validateUploadRequirements({ ...good, [key]: [hash('backend')] }, plan), /upload forbidden/);
  }
  assert.throws(() => validateUploadRequirements({ ...good, required: [b.files['/play/index.html']] }, plan), /Unchanged or unapproved/);
  assert.throws(() => validateUploadRequirements({ ...good, required: [good.required[0], good.required[0]] }, plan), /Duplicate/);
  const missing = copy(good); delete missing.required_functions;
  assert.throws(() => validateUploadRequirements(missing, plan), /Missing upload/);
});

test('capture, planning, review and completion audit cannot send remote writes', async () => {
  for (const mode of ['capture', 'plan', 'verify', 'audit']) {
    const calls = [], api = scopedAPI(async (...args) => { calls.push(args); return {}; }, mode);
    await api('deploys/' + CANDIDATE);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.throws(() => api(`deploys/${CANDIDATE}/lock`, method), /forbidden/);
    assert.equal(calls.length, 1);
  }
  assert.throws(() => scopedAPI(() => {}, 'candidate')(`deploys/${BASE}/lock`, 'POST'), /forbidden/);
  assert.throws(() => scopedAPI(() => {}, 'publish')(`sites/${SITE_ID}/deploys?title=new`, 'POST'), /forbidden/);
});

test('publication control binds the exact candidate, review, plan, run and immutable artifact', () => {
  validatePublicationControl(control());
  for (const field of ['sourceCommit', 'sourceTree', 'mainCommit', 'expectedDeploy', 'candidateId', 'planSha256',
    'candidateRunId', 'candidateArtifactId', 'candidateArtifactSHA256', 'browserReview']) {
    const c = control(); c[field] = ''; assert.throws(() => validatePublicationControl(c), undefined, field);
  }
  assert.throws(() => validatePublicationControl({ ...control(), candidateId: BASE }), /older deploy/);
  assert.throws(() => validatePublicationControl({ ...control(), action: 'publish-arcade-cutoff' }));
  validatePublicationControl({ ...control(), action: 'audit-arcade-polish' }, 'audit-arcade-polish');
});

test('only a two-file control commit directly atop the exact reviewed main tree may publish', () => {
  const evidence = { mode: 'publish', parents: [MAIN], mainTree: TREE, changedFiles: [CONTROL_FILE, REVIEW_FILE],
    message: 'Publish reviewed Arcade polish [publish arcade polish] [skip netlify]' };
  validateControlCommit(control(), evidence);
  for (const changed of [{ parents: [SOURCE] }, { parents: [MAIN, SOURCE] }, { mainTree: SOURCE },
    { changedFiles: [CONTROL_FILE, REVIEW_FILE, 'styles/arcade-organization.css'] },
    { changedFiles: [CONTROL_FILE] }, { message: '[publish arcade polish]' }, { message: '[skip netlify]' }, { mode: 'audit' }]) {
    assert.throws(() => validateControlCommit(control(), { ...evidence, ...changed }));
  }
});

test('old deployments and candidate identity substitution cannot satisfy the publication guard', () => {
  const { plan, state, deploy } = candidate(); assertNewCandidate(state, plan, deploy);
  for (const mutate of [s => { s.id = BASE; }, s => { s.planSha256 = hash('other'); },
    s => { s.sourceCommit = MAIN; }, s => { s.candidateCreatedAt = '2026-11-17T21:00:01.000Z'; }]) {
    const s = copy(state); mutate(s); assert.throws(() => assertNewCandidate(s, plan, deploy));
  }
  assert.throws(() => assertNewCandidate(state, plan, { ...deploy, title: 'different release' }));
});

test('browser evidence must cover this new candidate, all tabs, phone and desktop after creation', () => {
  const { plan, state, review } = candidate(); validateBrowserReview(review, plan, state, NOW);
  for (const mutate of [r => { r.candidateId = BASE; }, r => { r.origin = 'https://tree-token.xyz'; },
    r => { r.sourceTree = SOURCE; }, r => { r.viewportWidths = [1280]; }, r => { r.checks.daily = false; },
    r => { r.checks.countdownUTC = false; }, r => { r.noWalletOrPaymentActions = false; },
    r => { r.checkedAt = '2026-11-18T20:30:00.000Z'; }]) {
    const r = copy(review); mutate(r); assert.throws(() => validateBrowserReview(r, plan, state, NOW));
  }
  assert.throws(() => validateBrowserReview(review, plan, state, NOW + 86400000), /current/);
});

test('queued Git builds on later history pages block publication until terminal', async () => {
  let terminal = false, pauses = 0;
  const queued = 'f'.repeat(24);
  const api = async endpoint => {
    if (endpoint.endsWith('&page=1')) return Array.from({ length: 100 }, (_, i) => ({ id: String(i), state: 'ready' }));
    if (endpoint.endsWith('&page=2')) return [{ id: queued, state: terminal ? 'ready' : 'queued' }];
    if (endpoint === 'deploys/' + queued) return { id: queued, site_id: SITE_ID, state: 'queued', build_id: 'real-git-build' };
    throw Error('Unexpected API path');
  };
  assert.equal((await activeDeploys(api, CANDIDATE)).length, 1);
  await assert.rejects(waitForAllBuilds(api, CANDIDATE, { attempts: 1, pause: async () => {}, log: () => {} }), /nonterminal/);
  await waitForAllBuilds(api, CANDIDATE, { attempts: 2, pause: async () => { pauses++; terminal = true; }, log: () => {} });
  assert.equal(pauses, 1);
});

test('only exact audited inactive API records are exempt; revived or newly queued work still blocks', async () => {
  const [id, values] = [...AUDITED_STALE_DEPLOYS][0];
  const inactive = { id, site_id: SITE_ID, state: values[0], created_at: values[1], updated_at: values[2], context: values[3],
    commit_ref: values[4], build_id: null, published_at: null, locked: false };
  const api = record => async endpoint => endpoint.includes('/deploys?') ? [{ id: record.id, state: record.state }] : record;
  assert.equal((await activeDeploys(api(inactive), CANDIDATE)).length, 0);
  assert.equal((await activeDeploys(api({ ...inactive, build_id: 'queued-build' }), CANDIDATE)).length, 1);
  assert.equal((await activeDeploys(api({ ...inactive, updated_at: '2026-11-18T22:00:00Z' }), CANDIDATE)).length, 1);
});
