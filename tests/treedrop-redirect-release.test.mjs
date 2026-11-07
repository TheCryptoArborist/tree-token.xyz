import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE_ID, BASELINE_ID, TARGET, REDIRECT_TEXT, REDIRECT_SHA1, redirectFiles,
  retainedDeploy, compareBackend, functionsConfig, verifyMainTarget, verifyRedirects,
  assertFreshCandidate } from '../scripts/redirect-treedrop.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

function baseline() {
  return { id: BASELINE_ID, site_id: SITE_ID, created_at: '2026-08-22T16:47:46Z',
    context: 'production', branch: 'main', framework: 'vite', functions_region: 'cmh',
    functions_region_overrides: [], database_branch_id: null, blobs_region: 'us-east-2',
    edge_functions_present: null, server: null, database_migrations: null, function_schedules: [],
    available_functions: ['nftree-holder-snapshot', 'send-telegram-alert'].map((n, i) => ({
      n, d: 'a'.repeat(64), id: 'provider-' + i, oid: 'object-' + i, a: 'account-' + i,
      c: '2026-08-22T16:00:00Z', r: 'nodejs24.x', im: 'stream', s: 64000, bd: { runtimeAPIVersion: 2 },
      p: 10, dn: null, g: null, ro: [{ p: '/.netlify/functions/' + n, l: '/.netlify/functions/' + n, e: null,
        m: i ? ['GET', 'POST'] : ['GET'], ps: false }], ...(i ? { m: 1024, rg: 'us-east-2' } : {}),
    })) };
}

test('only root and index receive forced permanent redirects; APIs have no wildcard rule', () => {
  assert.equal(REDIRECT_TEXT, '/ https://tree-token.xyz/rewards/ 301!\n/index.html https://tree-token.xyz/rewards/ 301!\n');
  assert.equal(REDIRECT_TEXT.trim().split('\n').length, 2);
  assert(!REDIRECT_TEXT.includes('*') && !REDIRECT_TEXT.includes('/api/') && !REDIRECT_TEXT.includes('/.netlify/'));
  const files = Object.fromEntries(Array.from({ length: 7 }, (_, i) => ['/file-' + i, 'a'.repeat(40)]));
  const result = redirectFiles(files);
  assert.equal(Object.keys(result).length, 8); assert.equal(result['/_redirects'], REDIRECT_SHA1);
  for (const [p, digest] of Object.entries(files)) assert.equal(result[p], digest);
  assert.throws(() => redirectFiles({ ...files, '/_redirects': 'b'.repeat(40) }), /seven|Existing/);
});

test('old-site function routes and exact package/provider/runtime identities stay protected', () => {
  const original = baseline(), actual = structuredClone(original);
  actual.available_functions[0].m = 1024; actual.available_functions[0].rg = 'us-east-2';
  actual.available_functions[0].mo = 1024; actual.available_functions[0].rgo = 'us-east-2';
  compareBackend(actual, original);
  for (const key of ['d', 'id', 'oid', 'r', 'ro', 'im', 'bd']) {
    const changed = structuredClone(original); changed.available_functions[0][key] = 'changed';
    assert.throws(() => compareBackend(changed, original), /changed|digest/);
  }
  actual.available_functions[0].m = 2048;
  assert.throws(() => compareBackend(actual, original), /records/);
  const newSchedule = structuredClone(original); newSchedule.function_schedules = [{ name: 'nftree-holder-snapshot', cron: '* * * * *' }];
  assert.throws(() => compareBackend(newSchedule, original), /schedules/);
});

test('request retains API route methods without inventing historical memory/region overrides', () => {
  const configs = functionsConfig(baseline());
  assert.equal(Object.keys(configs).length, 2);
  assert.deepEqual(configs['send-telegram-alert'].routes[0].methods, ['GET', 'POST']);
  assert.deepEqual(configs['nftree-holder-snapshot'].routes[0].methods, ['GET']);
  for (const config of Object.values(configs)) assert(!('region' in config) && !('memory' in config) && !('runtime' in config));
});

test('retained baseline excludes opaque deploy tokens and unrelated personal metadata', () => {
  const original = { ...baseline(), skew_protection_token: 'must-not-save', user_id: 'must-not-save', ssl_url: 'unneeded' };
  const safe = retainedDeploy(original);
  assert(!('skew_protection_token' in safe) && !('user_id' in safe));
  assert.deepEqual(safe.available_functions, original.available_functions);
});

test('main destination must be the pinned locked release with a working NFTree Rewards page', async () => {
  const id = 'c'.repeat(24), api = async () => ({ published_deploy: { id, locked: true } });
  const html = async () => new Response('<title>NFTree Rewards | TREE</title>', { status: 200, headers: { 'content-type': 'text/html' } });
  assert.deepEqual(await verifyMainTarget(api, id, html), { deployId: id, url: TARGET, status: 200 });
  await assert.rejects(verifyMainTarget(api, 'd'.repeat(24), html), /publication changed/);
  await assert.rejects(verifyMainTarget(api, id, async () => new Response('missing', { status: 404 })), /HTTP 200/);
  await assert.rejects(verifyMainTarget(api, id, async () => new Response('<title>Old site</title>', { headers: { 'content-type': 'text/html' } })), /identify/);
});

test('live redirect verification checks both entry paths and query-string preservation', async () => {
  const requests = [];
  const good = async (url, options) => {
    requests.push([String(url), options]);
    return new Response(null, { status: 301, headers: { location: TARGET + (new URL(url).search || '') } });
  };
  await verifyRedirects('https://preview.example', good);
  assert.equal(requests.length, 3); assert(requests.every(([, options]) => options.method === 'HEAD' && options.redirect === 'manual'));
  await assert.rejects(verifyRedirects('https://preview.example', async () => new Response(null, { status: 302, headers: { location: TARGET } })), /permanent/);
  await assert.rejects(verifyRedirects('https://preview.example', async () => new Response(null, { status: 301, headers: { location: TARGET } })), /lost query/);
});

test('publication identity excludes the baseline and any older deployment', () => {
  const plan = { sourceCommit: 'f'.repeat(40), baseline: baseline(), title: 'new redirect' };
  const state = { schemaVersion: 1, siteId: SITE_ID, id: 'b'.repeat(24), planSha256: fingerprint(plan),
    sourceCommit: plan.sourceCommit, requestStartedAt: '2026-11-07T18:00:00Z', createdAt: '2026-11-07T18:00:01Z' };
  const deploy = { id: state.id, site_id: SITE_ID, title: plan.title, created_at: state.createdAt };
  assertFreshCandidate(state, plan, deploy);
  assert.throws(() => assertFreshCandidate({ ...state, id: BASELINE_ID }, plan, deploy), /new redirect/);
  const old = { ...state, createdAt: '2026-11-06T00:00:00Z' };
  assert.throws(() => assertFreshCandidate(old, plan, { ...deploy, created_at: old.createdAt }), /older/);
});
