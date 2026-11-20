import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { ARBORETUM_SNIPPET } from '../scripts/market-insights-delivery.mjs';
import { AUDITED_STALE_DEPLOYS } from '../scripts/release-stats-market.mjs';
import {
  SITE_ID, ACCOUNT_ID, CONTROL_FILE, REVIEW_FILE, DELIVERY_SOURCES, REPLACED_HASHES, REQUIRED_PROVIDER_SYMBOLS,
  assembleFiles, compareBackend, validateBaseline, validateUploadRequirements,
  assertNewCandidate, validatePublicationControl, validateControlCommit,
  validateLayoutReport, validateBrowserReview, scopedAPI, activeDeploys,
  waitForAllBuilds, publicChecks,
} from '../scripts/release-market-overview.mjs';

const expectedDeploy = '6affc6cb821278e5a2a481e2';
const digest = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const files = () => ({ '/index.html': 'a'.repeat(40), '/dapp/index.html': 'b'.repeat(40),
  '/play/index.html': 'c'.repeat(40), '/play/challenge/index.html': 'd'.repeat(40),
  '/market-insights/sentiment.js': 'e'.repeat(40),
  '/play/multichaintest/original/bnb/enable/index.html': '1'.repeat(40),
  '/play/multichaintest/original/bnb/enable/app.js': '2'.repeat(40),
  '/play/multichaintest/original/bnb/enable/core.js': '3'.repeat(40),
  '/play/multichaintest/original/bnb/buy/index.html': '4'.repeat(40),
  '/play/multichaintest/original/bnb/buy/app.js': '5'.repeat(40),
  '/play/multichaintest/original/bnb/buy/core.js': '6'.repeat(40), ...REPLACED_HASHES });
const overlays = () => Object.entries(DELIVERY_SOURCES).map(([path, source], i) => ({ path, source, sha1: String(i + 1).repeat(40) }));
function backend() {
  return { id: expectedDeploy, site_id: SITE_ID, state: 'ready', locked: true, context: 'production', branch: 'main', functions_region: 'cmh',
    available_functions: Array.from({ length: 50 }, (_, i) => ({ n: i ? 'function-' + i : 'arcade-monthly',
      d: 'a'.repeat(64), id: 'id-' + i, oid: 'oid-' + i, a: 'account', c: 'created', r: 'nodejs22.x',
      rg: 'us-east-2', m: 1024, im: 'stream', s: 100, bd: { bootstrapVersion: '2.24.0' },
      ro: [], er: [], tr: { action: 'keep' }, futureProviderField: { retain: true } })),
    function_schedules: Array.from({ length: 5 }, (_, i) => ({ name: i ? 'function-' + i : 'arcade-monthly', cron: '0 0 * * *' })) };
}
function candidate() {
  const plan = { sourceCommit: 'a'.repeat(40), sourceTree: 'c'.repeat(40), baselineId: expectedDeploy,
    baselineCreatedAt: '2026-11-19T19:50:00.000Z', title: 'TREE reviewed Market Overview', ...assembleFiles(files(), overlays()) };
  const state = { schemaVersion: 1, siteId: SITE_ID, id: 'b'.repeat(24), baselineId: expectedDeploy,
    sourceCommit: plan.sourceCommit, planSha256: fingerprint(plan), requestStartedAt: '2026-11-19T20:00:00.000Z',
    candidateCreatedAt: '2026-11-19T20:00:01.000Z' };
  const deploy = { id: state.id, site_id: SITE_ID, created_at: state.candidateCreatedAt, title: plan.title };
  const origin = 'https://' + state.id + '--tree-token.netlify.app';
  return { plan, state, deploy, origin };
}

test('exactly the two reviewed existing market files change; no added or removed paths', () => {
  const before = files(), result = assembleFiles(before, overlays());
  assert.deepEqual(result.changedOriginals, Object.keys(DELIVERY_SOURCES).sort());
  assert.deepEqual(result.addedPaths, []);
  assert.deepEqual(Object.keys(result.files).sort(), Object.keys(before).sort());
  for (const [pathname, hash] of Object.entries(before)) if (!(pathname in DELIVERY_SOURCES)) assert.equal(result.files[pathname], hash);
  for (const change of [
    [...overlays(), { path: '/other.js', source: 'other.js', sha1: 'f'.repeat(40) }],
    [...overlays(), { path: '/dapp/index.html', source: 'dapp/index.html', sha1: 'f'.repeat(40) }],
    overlays().slice(0, 1), [...overlays(), overlays()[0]],
    overlays().map((row, i) => i ? row : { ...row, source: 'other.html' }),
  ]) assert.throws(() => assembleFiles(before, change));
  for (const pathname of Object.keys(REPLACED_HASHES)) {
    assert.throws(() => assembleFiles({ ...before, [pathname]: 'f'.repeat(40) }, overlays()), /baseline changed/);
    const missing = { ...before }; delete missing[pathname];
    assert.throws(() => assembleFiles(missing, overlays()), /baseline changed/);
  }
  assert.throws(() => assembleFiles(before, overlays().map(row => ({ ...row, sha1: before[row.path] }))), /Both reviewed/);
});

test('fresh baseline requires the observed fifty complete backend records, five schedules and critical current routes', () => {
  const baseline = { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID, deploy: backend(), files: files(),
    marketSHA1: REPLACED_HASHES['/market-insights/index.html'], environment: { site: { entries: 1 }, snippetsSha256: 'f'.repeat(64) } };
  assert.deepEqual(validateBaseline(baseline, expectedDeploy), files());
  assert.throws(() => validateBaseline(baseline, 'f'.repeat(24)));
  for (const key of ['locked', 'state', 'site_id', 'context']) {
    const changed = structuredClone(baseline); changed.deploy[key] = false;
    assert.throws(() => validateBaseline(changed, expectedDeploy));
  }
  for (const kind of ['available_functions', 'function_schedules']) {
    const changed = structuredClone(baseline); changed.deploy[kind].pop();
    assert.throws(() => validateBaseline(changed, expectedDeploy));
  }
  for (const pathname of ['/play/challenge/index.html', '/dapp/index.html', '/market-insights/sentiment.js',
    '/play/multichaintest/original/bnb/enable/index.html', '/play/multichaintest/original/bnb/enable/app.js',
    '/play/multichaintest/original/bnb/enable/core.js',
    '/play/multichaintest/original/bnb/buy/index.html', '/play/multichaintest/original/bnb/buy/app.js',
    '/play/multichaintest/original/bnb/buy/core.js']) {
    const changed = structuredClone(baseline); delete changed.files[pathname];
    assert.throws(() => validateBaseline(changed, expectedDeploy));
  }
});

test('complete function/provider/runtime records and schedules are preserved without field exceptions', () => {
  const old = backend(); compareBackend(structuredClone(old), old);
  for (const field of ['d', 'id', 'oid', 'a', 'c', 'r', 'rg', 'm', 'im', 's', 'bd', 'ro', 'er', 'tr', 'futureProviderField']) {
    const changed = structuredClone(old); changed.available_functions[0][field] = 'changed';
    assert.throws(() => compareBackend(changed, old), field);
  }
  const materialized = structuredClone(old); materialized.available_functions[0].mo = 1024;
  assert.throws(() => compareBackend(materialized, old), /Every complete backend record/);
  for (const field of ['branch', 'context', 'functions_region', 'functions_region_overrides', 'database_branch_id',
    'blobs_region', 'framework', 'edge_functions_present', 'server', 'database_migrations']) {
    const changed = structuredClone(old); changed[field] = 'changed';
    assert.throws(() => compareBackend(changed, old), field);
  }
  const schedule = structuredClone(old); schedule.function_schedules[0].cron = 'changed';
  assert.throws(() => compareBackend(schedule, old));
  const removed = structuredClone(old); removed.available_functions.pop();
  assert.throws(() => compareBackend(removed, old));
});

test('upload requirements may request only the two changed static digests; all backend and unchanged uploads stop', () => {
  const { plan } = candidate();
  const request = { required: Object.keys(DELIVERY_SOURCES).map(path => plan.files[path]), required_functions: [], required_edge_functions: [], required_server: [] };
  validateUploadRequirements(request, plan);
  for (const key of ['required_functions', 'required_edge_functions', 'required_server']) {
    assert.throws(() => validateUploadRequirements({ ...request, [key]: ['changed'] }, plan));
  }
  assert.throws(() => validateUploadRequirements({ ...request, required: [plan.files['/dapp/index.html']] }, plan));
  for (const key of Object.keys(request)) { const missing = { ...request }; delete missing[key]; assert.throws(() => validateUploadRequirements(missing, plan)); }
  assert.throws(() => validateUploadRequirements({ ...request, required: [request.required[0], request.required[0]] }, plan));
});

test('read-only modes cannot create or lock; candidate identity cannot refer to an old deploy or changed source', () => {
  let calls = 0;
  for (const mode of ['capture', 'plan', 'verify', 'audit']) {
    const api = scopedAPI(() => { calls++; }, mode);
    assert.throws(() => api('deploys/' + 'b'.repeat(24) + '/lock', 'POST'));
    assert.throws(() => api('sites/' + SITE_ID + '/deploys?title=test', 'POST'));
  }
  assert.equal(calls, 0);
  const { plan, state, deploy } = candidate(); assertNewCandidate(state, plan, deploy);
  for (const mutation of [{ id: expectedDeploy }, { baselineId: 'f'.repeat(24) }, { sourceCommit: 'f'.repeat(40) },
    { planSha256: 'f'.repeat(64) }, { candidateCreatedAt: '2020-01-01T00:00:00.000Z' }]) {
    assert.throws(() => assertNewCandidate({ ...state, ...mutation }, plan, deploy));
  }
});

test('publication control binds immutable source/artifact/candidate and an otherwise unchanged merged main tree', () => {
  const { plan, state } = candidate();
  const control = { schemaVersion: 1, action: 'publish-market-overview', sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree,
    mainCommit: 'd'.repeat(40), expectedDeploy, candidateId: state.id, planSha256: fingerprint(plan), candidateRunId: 123,
    candidateArtifactId: 456, candidateArtifactSHA256: 'e'.repeat(64), browserReview: REVIEW_FILE };
  validatePublicationControl(control);
  const info = { mode: 'publish', parents: [control.mainCommit], mainTree: control.sourceTree,
    changedFiles: [CONTROL_FILE, REVIEW_FILE], message: '[skip netlify] [publish market overview] Publish reviewed chart' };
  validateControlCommit(control, info);
  for (const mutation of [{ candidateId: expectedDeploy }, { sourceCommit: 'bad' }, { planSha256: 'bad' },
    { candidateRunId: 0 }, { candidateArtifactSHA256: 'bad' }, { browserReview: 'other.json' }]) {
    assert.throws(() => validatePublicationControl({ ...control, ...mutation }));
  }
  for (const mutation of [{ parents: [] }, { parents: [control.mainCommit, 'f'.repeat(40)] }, { mainTree: 'f'.repeat(40) },
    { changedFiles: [CONTROL_FILE, REVIEW_FILE, 'market-insights/insights.js'] }, { message: '[publish market overview]' }]) {
    assert.throws(() => validateControlCommit(control, { ...info, ...mutation }));
  }
});

test('automated layout evidence and actual-provider review are separately bound to the candidate', () => {
  const { plan, state, origin } = candidate();
  const layout = { passed: true, testOnly: true, sourceCommit: plan.sourceCommit, candidateId: state.id, baseURL: origin,
    results: [320, 390, 768, 1363].map(width => ({ width, passed: true })) };
  validateLayoutReport(layout, origin, plan, state);
  for (const mutation of [{ passed: false }, { testOnly: false }, { candidateId: 'c'.repeat(24) }, { baseURL: 'https://tree-token.xyz' },
    { sourceCommit: 'f'.repeat(40) }, { results: layout.results.slice(1) }, { results: [...layout.results, layout.results[0]] },
    { results: layout.results.map((row, i) => ({ ...row, passed: i !== 0 })) }]) {
    assert.throws(() => validateLayoutReport({ ...layout, ...mutation }, origin, plan, state));
  }
  const now = Date.parse('2026-11-19T20:05:00Z');
  const review = { schemaVersion: 1, result: 'passed', testOnly: false, sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree,
    candidateId: state.id, planSha256: fingerprint(plan), origin, checkedAt: '2026-11-19T20:04:00Z', noWalletOrPaymentActions: true,
    provider: 'TradingView', symbols: REQUIRED_PROVIDER_SYMBOLS, viewportWidths: [1363],
    checks: { othersChartRendered: true, ethDominanceRendered: true, stablecoinMarketCapRendered: true,
      defiMarketCapRendered: true, altcoinsVsBtcRendered: true, populatedData: true, chartInteraction: true, sourceLinks: true } };
  validateBrowserReview(review, plan, state, now);
  for (const mutation of [{ testOnly: true }, { testOnly: undefined }, { symbols: REQUIRED_PROVIDER_SYMBOLS.slice(1) },
    { symbols: [...REQUIRED_PROVIDER_SYMBOLS.slice(0, -1), 'CRYPTOCAP:TOTAL3'] }, { origin: 'https://tree-token.xyz' },
    { noWalletOrPaymentActions: false }, { viewportWidths: [390] }, { checkedAt: '2026-11-19T19:59:00Z' },
    { checkedAt: '2026-11-18T20:00:00Z' }, { checks: { ...review.checks, altcoinsVsBtcRendered: false } },
    { checks: { ...review.checks, populatedData: false } }]) {
    assert.throws(() => validateBrowserReview({ ...review, ...mutation }, plan, state, now));
  }
  for (const key of Object.keys(review.checks)) {
    const missing = structuredClone(review); delete missing.checks[key];
    assert.throws(() => validateBrowserReview(missing, plan, state, now), key);
  }
  assert.throws(() => validateBrowserReview(layout, plan, state, now));
});

test('all unknown nonterminal deployments block publication; only exact audited inactive records are ignored', async () => {
  const [id, fields] = AUDITED_STALE_DEPLOYS.entries().next().value;
  const [state, created_at, updated_at, context, commit_ref] = fields;
  const stale = { id, site_id: SITE_ID, state, created_at, updated_at, context, commit_ref, build_id: null, published_at: null, locked: null };
  const candidateId = 'b'.repeat(24), queued = { id: 'c'.repeat(24), state: 'enqueued' };
  const api = async endpoint => endpoint.startsWith('sites/') ? [stale, { id: candidateId, state: 'uploading' }, queued] : endpoint.endsWith(id) ? stale : queued;
  assert.deepEqual(await activeDeploys(api, candidateId), [queued]);
  await assert.rejects(waitForAllBuilds(api, candidateId, { attempts: 1, pause: async () => {}, log: () => {} }), /Queued or nonterminal/);
  const resumed = { ...stale, build_id: 'real-build' };
  const resumedAPI = async endpoint => endpoint.startsWith('sites/') ? [resumed] : resumed;
  assert.equal((await activeDeploys(resumedAPI, candidateId)).length, 1);
});

test('canonical delivery verifies exact two source bytes and accepts only the single known body-end snippet', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'market-overview-release-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bodies = { '/market-insights/index.html': '<html><body><script src="/market-insights/insights.js"></script><script src="/market-insights/sentiment.js"></script></body></html>',
    '/market-insights/insights.js': 'const symbol="CRYPTOCAP:STABLE.C.D";\n' };
  for (const [pathname, body] of Object.entries(bodies)) {
    await fs.mkdir(path.dirname(path.join(root, pathname)), { recursive: true }); await fs.writeFile(path.join(root, pathname), body);
  }
  const plan = { candidateId: 'b'.repeat(24), sources: DELIVERY_SOURCES, files: { '/market-insights/sentiment.js': 'a'.repeat(40),
    ...Object.fromEntries(Object.entries(bodies).map(([pathname, body]) => [pathname, digest(body)])) } };
  const responses = {}, calls = [];
  const fetchImpl = async url => {
    const pathname = new URL(url).pathname; calls.push(pathname);
    const source = pathname === '/market-insights/' ? '/market-insights/index.html' : pathname, custom = responses[pathname] || {};
    const body = custom.body ?? (source.endsWith('.html') ? bodies[source].replace('</body>', ARBORETUM_SNIPPET + '</body>') : bodies[source]);
    return new Response(body, { status: custom.status ?? 200, headers: { 'content-type': custom.type ?? (source.endsWith('.js') ? 'application/javascript' : 'text/html') } });
  };
  await publicChecks('https://tree-token.xyz', plan, root, fetchImpl);
  assert.deepEqual(calls, [...Object.keys(DELIVERY_SOURCES), '/market-insights/']);
  responses['/market-insights/insights.js'] = { body: 'changed' };
  await assert.rejects(publicChecks('https://tree-token.xyz', plan, root, fetchImpl), /bytes differ/);
  responses['/market-insights/insights.js'] = { type: 'text/html' };
  await assert.rejects(publicChecks('https://tree-token.xyz', plan, root, fetchImpl), /content type/);
  delete responses['/market-insights/insights.js'];
  responses['/market-insights/'] = { status: 404 };
  await assert.rejects(publicChecks('https://tree-token.xyz', plan, root, fetchImpl), /route unavailable/);
  delete responses['/market-insights/'];
  responses['/market-insights/index.html'] = { body: bodies['/market-insights/index.html'].replace('</body>', ARBORETUM_SNIPPET + ARBORETUM_SNIPPET + '</body>') };
  await assert.rejects(publicChecks('https://tree-token.xyz', plan, root, fetchImpl), /HTML mutation/);
  await assert.rejects(publicChecks('https://unrelated.invalid', plan, root, fetchImpl), /origin/);
});

