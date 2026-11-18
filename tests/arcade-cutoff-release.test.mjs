import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SITE_ID, DB_PROJECT, MIGRATION, REVIEW_FILE, DELIVERY_SOURCES, REPLACED_PATHS,
  ADDED_PATHS, validateBackend, compareBackend, functionsConfig, storedPlayHTML,
  organizeFreshHTML, assembleFiles, validateDBProof, validateBrowserReview,
  validatePublicationControl, assertNewCandidate, activeDeploys, waitForAllBuilds, packageTrafficRules, monthlyPackage, scopedAPI,
} from '../scripts/release-arcade-cutoff.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { ARBORETUM_SNIPPET } from '../scripts/stats-market-delivery.mjs';
import { AUDITED_STALE_DEPLOYS } from '../scripts/release-stats-market.mjs';

const hash = (value, algorithm = 'sha256') => crypto.createHash(algorithm).update(value).digest('hex');
const copy = value => structuredClone(value);
const BASE = 'a'.repeat(24), CANDIDATE = 'b'.repeat(24), SOURCE = 'c'.repeat(40), TREE = 'd'.repeat(40);
const NOW = Date.parse('2026-11-18T20:00:00.000Z');
test('capture, planning, verification and completion audit reject mutations before transport', async () => {
  for (const mode of ['capture', 'plan', 'verify', 'audit']) {
    const calls = [], api = scopedAPI(async (...args) => { calls.push(args); return { ok: true }; }, mode);
    assert.deepEqual(await api('deploys/' + CANDIDATE), { ok: true });
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.throws(() => api(`deploys/${CANDIDATE}/lock`, method), /forbidden/);
    assert.equal(calls.length, 1);
  }
  assert.throws(() => scopedAPI(() => {}, 'candidate')(`deploys/${BASE}/lock`, 'POST'), /forbidden/);
  assert.throws(() => scopedAPI(() => {}, 'publish')(`sites/${SITE_ID}/deploys?title=unexpected`, 'POST'), /forbidden/);
});
function backend() {
  const fn = name => ({ n: name, d: hash(name), id: 'package-' + name, oid: 'provider-' + name,
    a: 'provider-account', c: '2026-11-18T10:00:00Z', r: 'nodejs22.x', rg: 'us-east-2', m: 1024,
    im: 'stream', s: 100, bd: { bootstrapVersion: '2.24.0', runtimeAPIVersion: 2 },
    ro: [{ p: '/api/' + name, l: '/api/' + name, e: null, m: ['GET', 'POST'], ps: false }],
    tr: { action: { type: 'rate_limit' } }, obl: 'extension', oblv: 34,
    futureProviderField: { preserve: true } });
  return { id: BASE, site_id: SITE_ID, state: 'ready', locked: true, branch: 'main', context: 'production',
    created_at: '2026-11-18T10:00:00.000Z', available_functions: [fn('arcade-monthly'), fn('scheduled'), fn('future-game')],
    function_schedules: [{ name: 'scheduled', cron: '47 */6 * * *', futureScheduleField: true }],
    functions_region: 'cmh', functions_region_overrides: [{ name: 'scheduled', region: 'cmh' }],
    database_branch_id: 'production', blobs_region: 'us-east-2', framework: null,
    edge_functions_present: null, server: null, database_migrations: { files: [] } };
}
function changedMonthly() {
  const before = backend(), after = copy(before), monthly = { sha256: hash('new isolated ZIP'), bytes: 150 };
  Object.assign(after.available_functions[0], { d: monthly.sha256, s: monthly.bytes, id: 'new-package',
    oid: 'new-provider-package', c: '2026-11-18T19:30:00Z' });
  return { before, after, monthly };
}

test('fresh backend inventory supports added current functions without historical count assumptions', () => {
  const deploy = backend(); validateBackend(deploy); compareBackend(copy(deploy), deploy);
  const newer = copy(deploy.available_functions[2]); newer.n = 'another-current-game'; newer.d = hash(newer.n);
  deploy.available_functions.push(newer); compareBackend(copy(deploy), deploy);
  const missing = copy(deploy); missing.available_functions.pop();
  assert.throws(() => compareBackend(missing, deploy), /count changed/);
});

test('only the rebuilt monthly package identities, time, size and digest may change', () => {
  const { before, after, monthly } = changedMonthly(); compareBackend(after, before, monthly);
  assert.throws(() => compareBackend(after, before), /Complete backend record/);
  for (const [field, value] of Object.entries({ a: 'other-account', r: 'nodejs24.x', rg: 'other-region', im: 'buffer',
    m: 2048, obl: 'other-extension', oblv: 35, futureProviderField: { preserve: false }, ro: [], tr: {} })) {
    const bad = copy(after); bad.available_functions[0][field] = value;
    assert.throws(() => compareBackend(bad, before, monthly), /Complete backend record/, field);
  }
  const wrong = copy(after); wrong.available_functions[0].s++;
  assert.throws(() => compareBackend(wrong, before, monthly), /size differs/);
});

test('every unrelated provider field, digest, schedule and runtime setting is preserved', () => {
  const original = backend();
  for (const mutate of [
    d => { d.available_functions[1].d = hash('different'); },
    d => { delete d.available_functions[1].futureProviderField; },
    d => { d.function_schedules[0].cron = '* * * * *'; },
    d => { delete d.function_schedules[0].futureScheduleField; },
    d => { d.functions_region_overrides = []; },
    d => { d.blobs_region = 'other'; },
    d => { d.database_branch_id = 'preview'; },
  ]) {
    const bad = copy(original); mutate(bad); assert.throws(() => compareBackend(bad, original), /changed/);
  }
});

test('only equivalent materialized overrides normalize; inherited defaults remain inherited', () => {
  const before = backend(), after = copy(before);
  after.available_functions[0].mo = 1024; after.available_functions[0].rgo = 'us-east-2';
  compareBackend(after, before);
  after.available_functions[0].mo = 2048; assert.throws(() => compareBackend(after, before), /changed/);
  const configs = functionsConfig(before);
  assert.equal(configs['arcade-monthly'].memory, undefined); assert.equal(configs['arcade-monthly'].region, undefined);
  assert.equal(configs.scheduled.region, 'us-east-2');
  assert.deepEqual(configs['arcade-monthly'].routes, [{ pattern: '/api/arcade-monthly', literal: '/api/arcade-monthly', methods: ['GET', 'POST'], prefer_static: false }]);
});

test('packaged rate-limit key casing normalizes without dropping unknown provider settings', () => {
  assert.deepEqual(packageTrafficRules({ action: { config: { rateLimitConfig: { windowLimit: 60, windowSize: 60, algorithm: 'sliding_window' }, future: true } } }),
    { action: { config: { rate_limit_config: { window_limit: 60, window_size: 60, algorithm: 'sliding_window' }, future: true } } });
  assert.throws(() => packageTrafficRules({ windowLimit: 60, window_limit: 30 }), /Ambiguous/);
});

test('the isolated package validates real API/packager schemas and every source/ZIP hash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-cutoff-package-test-'));
  try {
    const original = backend();
    original.available_functions[0].tr = { action: { type: 'rate_limit', config: {
      aggregate: { keys: [{ type: 'domain' }, { type: 'ip' }] },
      rate_limit_config: { algorithm: 'sliding_window', window_size: 60, window_limit: 60 } } } };
    const pack = { name: 'arcade-monthly', path: '.netlify/arcade-monthly-functions/arcade-monthly.zip',
      runtimeVersion: 'nodejs22.x', invocationMode: 'stream', buildData: original.available_functions[0].bd,
      routes: [{ pattern: '/api/arcade-monthly', literal: '/api/arcade-monthly', methods: ['GET', 'POST'] }],
      trafficRules: { action: { type: 'rate_limit', config: {
        rateLimitConfig: { windowLimit: 60, windowSize: 60, algorithm: 'sliding_window' },
        aggregate: { keys: [{ type: 'domain' }, { type: 'ip' }] } } } }, sourceFiles: [] };
    for (const pathname of ['netlify/monthly-functions/arcade-monthly.ts', 'netlify/lib/arcade-monthly-core.ts',
      'vendor/arcade-monthly/package.json', 'vendor/arcade-monthly/package-lock.json']) {
      const bytes = Buffer.from('fixture for ' + pathname);
      fs.mkdirSync(path.dirname(path.join(root, pathname)), { recursive: true }); fs.writeFileSync(path.join(root, pathname), bytes);
      pack.sourceFiles.push({ path: pathname, sha256: hash(bytes) });
    }
    const zip = Buffer.from('isolated test package bytes'); pack.sha256 = hash(zip);
    fs.mkdirSync(path.dirname(path.join(root, pack.path)), { recursive: true }); fs.writeFileSync(path.join(root, pack.path), zip);
    const manifest = path.join(root, '.netlify/arcade-monthly-functions/manifest.json');
    fs.writeFileSync(manifest, JSON.stringify(pack));
    assert.equal(monthlyPackage(manifest, original, root).sha256, pack.sha256);
    pack.trafficRules.action.config.rateLimitConfig.windowLimit = 600;
    fs.writeFileSync(manifest, JSON.stringify(pack));
    assert.throws(() => monthlyPackage(manifest, original, root), /Monthly rate limit/);
    pack.trafficRules.action.config.rateLimitConfig.windowLimit = 60; fs.writeFileSync(manifest, JSON.stringify(pack));
    fs.writeFileSync(path.join(root, pack.sourceFiles[0].path), 'unreviewed source');
    assert.throws(() => monthlyPackage(manifest, original, root), /source mismatch/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

const initialHTML = Buffer.from('<html><head><title>Fresh cabinets</title></head><body><a href="/new-game/">New game</a>' + ARBORETUM_SNIPPET + '</body></html>');
test('capture strips at most the exact final delivery snippet and preserves existing copies', () => {
  const delivered = Buffer.from(initialHTML.toString().replace('</body>', ARBORETUM_SNIPPET + '</body>'));
  assert(storedPlayHTML(delivered, hash(initialHTML, 'sha1')).equals(initialHTML));
  assert(storedPlayHTML(initialHTML, hash(initialHTML, 'sha1')).equals(initialHTML));
  const extra = Buffer.from(delivered.toString().replace('</body>', ARBORETUM_SNIPPET + '</body>'));
  assert.throws(() => storedPlayHTML(extra, hash(initialHTML, 'sha1')), /differs beyond/);
  assert.throws(() => storedPlayHTML(Buffer.from(delivered.toString().replace('Fresh cabinets', 'Stale cabinets')), hash(initialHTML, 'sha1')), /differs beyond/);
});

test('Arcade HTML is fresh production with exact imports and cannot include preview transaction guards', () => {
  const organized = organizeFreshHTML(initialHTML).toString();
  assert(organized.includes('href="/new-game/"')); assert(organized.includes(ARBORETUM_SNIPPET));
  assert.equal((organized.match(/arcade-organization\.js/g) || []).length, 1);
  assert.equal((organized.match(/arcade-season-deadline\.css/g) || []).length, 1);
  assert.throws(() => organizeFreshHTML(Buffer.from(organized)), /already exist/);
  assert.throws(() => organizeFreshHTML(Buffer.from(initialHTML.toString().replace('<html>', '<html data-arcade-review-preview="readonly">'))), /sandbox preview/);
});

function fileFixture() {
  const files = { '/play/index.html': hash('old HTML', 'sha1'), '/scripts/arcade-monthly.js': hash('old JS', 'sha1'),
    '/index.html': hash('homepage', 'sha1'), '/new-game/index.html': hash('concurrent game', 'sha1'),
    '/_redirects': hash('routes', 'sha1') };
  const overlays = Object.entries(DELIVERY_SOURCES).map(([pathname, source]) => ({ path: pathname, source, sha1: hash('new ' + pathname, 'sha1') }));
  return { files, overlays };
}
test('static plan changes exactly two current files and adds exactly four assets, retaining every other path', () => {
  const { files, overlays } = fileFixture(), plan = assembleFiles(files, overlays);
  assert.equal(Object.keys(plan.files).length, Object.keys(files).length + 4);
  assert.deepEqual(plan.changedOriginals, REPLACED_PATHS);
  assert.deepEqual(plan.addedPaths, [...ADDED_PATHS].sort());
  assert.equal(plan.files['/new-game/index.html'], files['/new-game/index.html']);
  assert.equal(plan.files['/_redirects'], files['/_redirects']);
  assert.throws(() => assembleFiles(files, [...overlays, { path: '/index.html', source: 'index.html', sha1: hash('replace', 'sha1') }]), /Unapproved overlay/);
  assert.throws(() => assembleFiles(files, overlays.slice(1)), /Complete overlay/);
  assert.throws(() => assembleFiles(files, [...overlays, overlays[0]]), /Duplicate overlay/);
  const collision = { ...files, [ADDED_PATHS[0]]: hash('already live', 'sha1') };
  assert.throws(() => assembleFiles(collision, overlays), /already exists/);
});

const migration = Buffer.from('reviewed cutoff migration');
function proof() {
  return { schemaVersion: 1, projectId: DB_PROJECT, verifiedAt: new Date(NOW - 60000).toISOString(), sourceMigration: MIGRATION,
    sourceMigrationSHA256: hash(migration), appliedMigration: { version: '20261118192546', name: 'arcade_recovery_month_end_cutoff' },
    rpcDefinitions: ['arcade_recovery_intent_v1', 'arcade_recovery_confirm_v1'].map(name => ({ name, sha256: hash(name),
      securityDefiner: false, searchPath: '', executeRoles: ['postgres', 'service_role'], deniedRoles: ['PUBLIC', 'anon', 'authenticated'] })) };
}
test('readiness proof binds exact project, migration, both live RPC hashes, security and grants', () => {
  assert.equal(validateDBProof(proof(), migration, NOW).projectId, DB_PROJECT);
  for (const mutate of [
    p => { p.projectId = 'another-project'; }, p => { p.sourceMigrationSHA256 = hash('other SQL'); },
    p => { p.rpcDefinitions.pop(); }, p => { p.rpcDefinitions[0].sha256 = ''; },
    p => { p.rpcDefinitions[0].securityDefiner = true; }, p => { p.rpcDefinitions[0].searchPath = 'public'; },
    p => { p.rpcDefinitions[0].executeRoles.push('anon'); }, p => { p.rpcDefinitions[0].deniedRoles.pop(); },
    p => { p.verifiedAt = new Date(NOW - 86400001).toISOString(); },
  ]) { const bad = proof(); mutate(bad); assert.throws(() => validateDBProof(bad, migration, NOW)); }
});

function candidateFixture() {
  const plan = { baselineId: BASE, baselineCreatedAt: '2026-11-18T10:00:00.000Z', sourceCommit: SOURCE, sourceTree: TREE, title: 'Bound candidate' };
  const state = { schemaVersion: 1, siteId: SITE_ID, id: CANDIDATE, baselineId: BASE, sourceCommit: SOURCE,
    planSha256: fingerprint(plan), requestStartedAt: '2026-11-18T19:29:59.000Z', candidateCreatedAt: '2026-11-18T19:30:00.000Z' };
  const deploy = { id: CANDIDATE, site_id: SITE_ID, title: plan.title, created_at: state.candidateCreatedAt };
  const review = { schemaVersion: 1, result: 'passed', sourceCommit: SOURCE, sourceTree: TREE, candidateId: CANDIDATE,
    planSha256: fingerprint(plan), origin: `https://${CANDIDATE}--tree-token.netlify.app`, checkedAt: new Date(NOW - 1000).toISOString(),
    viewportWidths: [390, 1280], noWalletOrPaymentActions: true,
    checks: Object.fromEntries(['games', 'daily', 'campaigns', 'events', 'monthlyProgress', 'badgeCollection', 'mobileLayout', 'noMissingAssets', 'countdownUTC'].map(n => [n, true])) };
  return { plan, state, deploy, review };
}
test('only the newly created source/plan-bound candidate is eligible, never baseline or older deploys', () => {
  const { plan, state, deploy } = candidateFixture(); assertNewCandidate(state, plan, deploy);
  for (const [changeState, changeDeploy] of [
    [{ id: BASE }, { id: BASE }], [{ sourceCommit: 'e'.repeat(40) }, {}], [{ planSha256: hash('other plan') }, {}],
    [{ candidateCreatedAt: '2026-11-17T10:00:00Z' }, { created_at: '2026-11-17T10:00:00Z' }],
    [{}, { title: 'other title' }], [{}, { site_id: 'another site' }],
  ]) assert.throws(() => assertNewCandidate({ ...state, ...changeState }, plan, { ...deploy, ...changeDeploy }));
});

test('browser review binds the exact candidate and covers all tabs, phone, desktop, assets and UTC countdown', () => {
  const { plan, state, review } = candidateFixture(); validateBrowserReview(review, plan, state, NOW);
  for (const mutate of [
    r => { r.sourceCommit = 'e'.repeat(40); }, r => { r.candidateId = BASE; }, r => { r.origin = 'https://tree-token.xyz'; },
    r => { r.planSha256 = hash('different plan'); }, r => { r.viewportWidths = [1280]; },
    r => { r.checks.badgeCollection = false; }, r => { r.checks.noMissingAssets = false; },
    r => { r.checkedAt = '2026-11-18T19:00:00.000Z'; }, r => { r.noWalletOrPaymentActions = false; },
  ]) { const bad = copy(review); mutate(bad); assert.throws(() => validateBrowserReview(bad, plan, state, NOW)); }
});

test('explicit publication control pins source, merged main, candidate, original run and review file', () => {
  const control = { schemaVersion: 1, action: 'publish-arcade-cutoff', sourceCommit: SOURCE, sourceTree: TREE,
    mainCommit: 'e'.repeat(40), expectedDeploy: BASE, candidateId: CANDIDATE, planSha256: hash('plan'),
    candidateRunId: '12345', candidateArtifactId: '67890', candidateArtifactSHA256: hash('artifact'), browserReview: REVIEW_FILE };
  validatePublicationControl(control);
  assert.throws(() => validatePublicationControl({ ...control, candidateId: BASE }), /older deploy/);
  assert.throws(() => validatePublicationControl({ ...control, browserReview: '../unreviewed.json' }));
  assert.throws(() => validatePublicationControl({ ...control, action: 'publish' }));
});

test('publication waits for every queued Git build to finish, regardless of branch or age', async () => {
  let reads = 0, pauses = 0;
  const queued = { id: 'e'.repeat(24), state: 'enqueued', build_id: 'git-build', site_id: SITE_ID };
  const api = async endpoint => endpoint.includes('/deploys?') ? (++reads <= 2 ? [queued] : [{ ...queued, state: 'ready' }]) : queued;
  await waitForAllBuilds(api, CANDIDATE, { attempts: 4, pause: async ms => { assert.equal(ms, 10000); pauses++; }, log: () => {} });
  assert.equal(pauses, 2);
  await assert.rejects(waitForAllBuilds(async endpoint => endpoint.includes('/deploys?') ? [queued] : queued,
    CANDIDATE, { attempts: 2, pause: async () => {}, log: () => {} }), /publication refused/);
});

test('only exact audited inactive API orphans are exempt; a new build identity blocks', async () => {
  const [id, values] = [...AUDITED_STALE_DEPLOYS][0];
  const orphan = { id, site_id: SITE_ID, state: values[0], created_at: values[1], updated_at: values[2],
    context: values[3], commit_ref: values[4], build_id: null, published_at: null, locked: false };
  const api = record => async endpoint => endpoint.includes('/deploys?') ? [record] : record;
  assert.deepEqual(await activeDeploys(api(orphan), CANDIDATE), []);
  assert.equal((await activeDeploys(api({ ...orphan, build_id: 'new-git-build' }), CANDIDATE)).length, 1);
  assert.equal((await activeDeploys(api({ ...orphan, updated_at: '2026-11-18T20:00:00Z' }), CANDIDATE)).length, 1);
});
