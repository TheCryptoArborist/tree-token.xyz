import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { AUDITED_STALE_DEPLOYS } from '../scripts/release-stats-market.mjs';
import { DELIVERY_PATHS, DELIVERY_SOURCES, ARBORETUM_SNIPPET, verifyDelivery } from '../scripts/sti-purchase-delivery.mjs';

process.env.STI_PURCHASE_EXPECTED_DEPLOY ||= '6afd423531560084e7dd48e8';
const { SITE_ID, ACCOUNT_ID, BASELINE_ID, REPLACED_HASHES, ORIGINAL_CHANGES, assembleFiles,
  validateBaseline, assertNewCandidate, assertNoConcurrentDeploys, validateBrowserReport,
  assertBrowserVerification } = await import('../scripts/release-sti-purchase.mjs');
const sha1 = value => crypto.createHash('sha1').update(value).digest('hex');
const inventory = JSON.parse(await fs.readFile(new URL('../production/stats-market-release-20261118.json', import.meta.url), 'utf8')).files;
const overlays = () => DELIVERY_PATHS.map((pathname, i) => ({ path: pathname, source: DELIVERY_SOURCES[pathname], sha1: String(i + 1).repeat(40) }));
function backend() {
  return { id: BASELINE_ID, site_id: SITE_ID, context: 'production', branch: 'main', functions_region: 'cmh',
    state: 'ready', locked: true, created_at: '2026-11-18T06:14:13.201Z',
    available_functions: Array.from({ length: 49 }, (_, i) => ({ n: 'test-' + i, d: 'a'.repeat(64), id: 'id-' + i,
      oid: 'oid-' + i, a: 'account', c: 'created', r: 'nodejs22.x', rg: 'us-east-2', m: 1024, im: 'stream', s: 100, bd: {} })),
    function_schedules: Array.from({ length: 5 }, (_, i) => ({ name: 'test-' + i, cron: '0 0 * * *' })) };
}
const baseline = () => ({ site: { id: SITE_ID, account_id: ACCOUNT_ID }, deploy: backend(),
  files: Object.entries(inventory).map(([path, sha]) => ({ path, sha })) });
function candidate() {
  const id = 'b'.repeat(24), sourceCommit = 'a'.repeat(40);
  const plan = { sourceCommit, baselineCreatedAt: '2026-11-18T06:14:13.201Z', title: 'Reviewed STI repair' };
  const state = { schemaVersion: 1, siteId: SITE_ID, id, baselineId: BASELINE_ID, sourceCommit,
    planSha256: fingerprint(plan), requestStartedAt: '2026-11-18T17:00:00.000Z', candidateCreatedAt: '2026-11-18T17:00:01.000Z' };
  return { plan, state, deploy: { id, site_id: SITE_ID, created_at: state.candidateCreatedAt, title: plan.title,
    links: { permalink: `https://${id}--tree-token.netlify.app` } } };
}

test('capture refuses missing or unreviewed baseline IDs before accessing credentials', () => {
  for (const id of [undefined, 'c'.repeat(24)]) {
    const env = { ...process.env };
    if (id) env.STI_PURCHASE_EXPECTED_DEPLOY = id; else delete env.STI_PURCHASE_EXPECTED_DEPLOY;
    const result = spawnSync(process.execPath, [new URL('../scripts/release-sti-purchase.mjs', import.meta.url).pathname, 'capture'], { env, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /STI_PURCHASE_EXPECTED_DEPLOY must identify/); assert.equal(result.stdout, '');
  }
});

test('the actual 614-path current inventory yields precisely 615 paths and 611 unchanged originals', () => {
  assert.deepEqual(validateBaseline(baseline()), inventory);
  const result = assembleFiles(inventory, overlays());
  assert.equal(Object.keys(result.files).length, 615);
  assert.deepEqual(result.changedOriginals, ORIGINAL_CHANGES);
  assert.deepEqual(result.addedPaths, ['/dapp/sti-purchase.css']);
  assert.equal(Object.keys(inventory).filter(p => result.files[p] === inventory[p]).length, 611);
  for (const [pathname, hash] of Object.entries(inventory)) {
    if (!ORIGINAL_CHANGES.includes(pathname)) assert.equal(result.files[pathname], hash, pathname);
  }
  assert.equal(result.files['/dapp/app.js'], inventory['/dapp/app.js']);
  assert.equal(result.files['/scripts/wallet.js'], inventory['/scripts/wallet.js']);
});

test('stale bytes, reduced inventory, missing backend records and an unlocked baseline stop release planning', () => {
  for (const pathname of ORIGINAL_CHANGES) {
    assert.throws(() => assembleFiles({ ...inventory, [pathname]: 'f'.repeat(40) }, overlays()), /baseline changed/);
  }
  for (const mutate of [
    b => b.files.pop(), b => b.deploy.available_functions.pop(), b => b.deploy.function_schedules.pop(),
    b => b.deploy.locked = false, b => b.deploy.id = 'f'.repeat(24), b => b.site.account_id = 'other',
  ]) {
    const b = baseline(); mutate(b); assert.throws(() => validateBaseline(b));
  }
});

test('only the four explicit overlay sources may enter the release', () => {
  for (const pathname of ['/index.html', '/scripts/wallet.js', '/dapp/app.js', '/other.js']) {
    assert.throws(() => assembleFiles(inventory, [...overlays(), { path: pathname, source: 'other.js', sha1: 'f'.repeat(40) }]), /Unapproved/);
  }
  for (let i = 0; i < DELIVERY_PATHS.length; i++) {
    assert.throws(() => assembleFiles(inventory, overlays().filter((_, j) => i !== j)), /overlay inventory/);
  }
  assert.throws(() => assembleFiles(inventory, [...overlays(), { ...overlays()[0], path: '/DAPP/index.html' }]), /Duplicate/);
  assert.throws(() => assembleFiles(inventory, overlays().map((item, i) => i ? item : { ...item, source: 'dapp/index.html' })), /overlay source/);
  assert.throws(() => assembleFiles({ ...inventory, '/dapp/sti-purchase.css': 'f'.repeat(40) }, overlays()), /already exists/);
  assert.throws(() => assembleFiles(inventory, overlays().map(item => item.path === '/dapp/index.html' ? { ...item, sha1: REPLACED_HASHES[item.path] } : item)), /three approved/);
});

test('candidate identity and four-width browser evidence bind the exact reviewed source and new deployment', () => {
  const { plan, state, deploy } = candidate(); assertNewCandidate(state, plan, deploy);
  for (const mutation of [{ id: BASELINE_ID }, { baselineId: 'c'.repeat(24) }, { sourceCommit: 'c'.repeat(40) },
    { planSha256: 'bad' }, { candidateCreatedAt: '2020-01-01T00:00:00Z' }]) {
    assert.throws(() => assertNewCandidate({ ...state, ...mutation }, plan, deploy));
  }
  assert.throws(() => assertNewCandidate(state, plan, { ...deploy, title: 'unrelated deploy' }));
  const report = { baseURL: deploy.links.permalink, sourceCommit: plan.sourceCommit, candidateId: state.id,
    results: [320, 390, 768, 1363].map(width => ({ width, passed: true })) };
  validateBrowserReport(report, report.baseURL, plan.sourceCommit, state.id);
  for (const mutation of [{ results: report.results.slice(1) }, { baseURL: 'https://other.invalid' },
    { candidateId: 'c'.repeat(24) }, { sourceCommit: 'c'.repeat(40) },
    { results: report.results.map((entry, i) => ({ ...entry, passed: i !== 0 })) }]) {
    assert.throws(() => validateBrowserReport({ ...report, ...mutation }, report.baseURL, plan.sourceCommit, state.id));
  }
  const proof = { report, candidateId: state.id, sourceCommit: plan.sourceCommit, origin: report.baseURL,
    reportSha256: fingerprint(report), checkedAt: '2026-11-18T17:05:00Z' };
  assertBrowserVerification(proof, state, plan, deploy);
  assert.throws(() => assertBrowserVerification({ ...proof, reportSha256: 'changed' }, state, plan, deploy));
  assert.throws(() => assertBrowserVerification(null, state, plan, deploy));
});

test('pending deployments block publication, including changed records for previously audited inactive deploys', async () => {
  const [id, [state, created_at, updated_at, context, commit_ref]] = [...AUDITED_STALE_DEPLOYS][0];
  const record = { id, site_id: SITE_ID, state, created_at, updated_at, context, commit_ref, build_id: null, published_at: null, locked: null };
  const candidateId = 'b'.repeat(24);
  const api = async endpoint => endpoint.startsWith('sites/') ? [{ id, state }, { id: candidateId, state: 'ready' }] : record;
  await assertNoConcurrentDeploys(api, candidateId);
  await assert.rejects(assertNoConcurrentDeploys(async endpoint => endpoint.startsWith('sites/') ? [{ id: 'f'.repeat(24), state: 'building' }] : { id: 'f'.repeat(24), state: 'building', site_id: SITE_ID }, candidateId), /nonterminal deploy/);
  await assert.rejects(assertNoConcurrentDeploys(async endpoint => endpoint.startsWith('sites/') ? [{ id, state }] : { ...record, build_id: 'resumed-build' }, candidateId), /nonterminal deploy/);
});

async function deliveryFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sti-purchase-release-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bodies = {
    '/dapp/index.html': '<!doctype html><html><body>Stats<script src="app.js?v=current"></script><link rel="stylesheet" href="stats-market.css"><link rel="stylesheet" href="sti-purchase.css">' + ARBORETUM_SNIPPET + '</body></html>',
    '/dapp/sti-widget.js': 'export const widget = true;\n',
    '/dapp/sti-purchase-core.js': 'export const core = true;\n',
    '/dapp/sti-purchase.css': '.stats-sti { width: 100%; }\n',
  };
  for (const [pathname, body] of Object.entries(bodies)) {
    const filename = path.join(root, DELIVERY_SOURCES[pathname]);
    await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, body);
  }
  const plan = { sources: { ...DELIVERY_SOURCES }, files: { ...inventory, ...Object.fromEntries(DELIVERY_PATHS.map(p => [p, sha1(bodies[p])])) } };
  const responses = {}, calls = [];
  const fetchImpl = async input => {
    const pathname = new URL(input).pathname; calls.push(pathname);
    const entry = responses[pathname] || {}, source = pathname === '/dapp/' ? '/dapp/index.html' : pathname;
    let body = entry.body ?? bodies[source];
    if (source.endsWith('.html') && !entry.body) body = body.replace('</body>', ARBORETUM_SNIPPET + '</body>');
    return new Response(body, { status: entry.status ?? 200, headers: {
      'Content-Type': entry.type ?? (source.endsWith('.js') ? 'application/javascript' : source.endsWith('.css') ? 'text/css' : 'text/html'),
    } });
  };
  return { root, plan, bodies, responses, calls, fetchImpl };
}

test('delivered HTML, both modules, scoped stylesheet and canonical route must match exact reviewed bytes', async t => {
  const f = await deliveryFixture(t);
  await verifyDelivery('https://tree-token.xyz', f.plan, f.root, f.fetchImpl);
  assert.deepEqual(f.calls, [...DELIVERY_PATHS, '/dapp/']);
  for (const pathname of DELIVERY_PATHS) {
    f.responses[pathname] = { body: 'modified public asset' };
    await assert.rejects(verifyDelivery('https://tree-token.xyz', f.plan, f.root, f.fetchImpl));
    delete f.responses[pathname];
  }
  f.responses['/dapp/'] = { status: 404 };
  await assert.rejects(verifyDelivery('https://tree-token.xyz', f.plan, f.root, f.fetchImpl), /canonical Stats route/);
});

test('delivery rejects incorrect MIME types, unrelated origins, stale source maps and lost current Stats dependencies', async t => {
  const f = await deliveryFixture(t);
  await assert.rejects(verifyDelivery('https://other.invalid', f.plan, f.root, f.fetchImpl), /origin/);
  await assert.rejects(verifyDelivery('https://tree-token.xyz', { ...f.plan, sources: { ...f.plan.sources, '/dapp/index.html': 'dapp/index.html' } }, f.root, f.fetchImpl), /public-source mapping/);
  f.responses['/dapp/sti-widget.js'] = { type: 'text/html' };
  await assert.rejects(verifyDelivery('https://tree-token.xyz', f.plan, f.root, f.fetchImpl), /content type/);
  delete f.responses['/dapp/sti-widget.js'];
  const missing = { ...f.plan, files: { ...f.plan.files } }; delete missing.files['/dapp/stats-market.css'];
  await assert.rejects(verifyDelivery('https://tree-token.xyz', missing, f.root, f.fetchImpl), /absent from production inventory/);
  await fs.writeFile(path.join(f.root, DELIVERY_SOURCES['/dapp/sti-widget.js']), 'changed local source');
  await assert.rejects(verifyDelivery('https://tree-token.xyz', f.plan, f.root, f.fetchImpl), /Local upload bytes/);
});
