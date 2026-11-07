import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE_ID, BASELINE_ID, fileInventory, assembleFiles, functionsConfig,
  compareBackend, assertNewCandidate } from '../scripts/release-nftree-rewards.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

const h = digit => digit.repeat(40);
function backend() {
  const functions = Array.from({ length: 43 }, (_, i) => ({
    n: `test-${i}`, d: 'a'.repeat(64), id: `provider-${i}`, oid: `object-${i}`,
    a: `account-${i}`, c: '2026-11-01T00:00:00Z', r: i === 0 ? 'nodejs24.x' : 'nodejs22.x',
    rg: 'us-east-2', m: 1024, im: 'stream', s: 1000 + i, bd: { runtimeAPIVersion: 2 },
    dn: null, g: null, obl: 'extension', oblv: 34,
  }));
  functions[0].mo = 1024; functions[0].rgo = 'us-east-2';
  functions[0].ro = [{ p: '/api/example', l: '/api/example', e: null, m: ['GET'], ps: false }];
  functions[0].tr = { action: { type: 'rate_limit', config: { rate_limit_config: { window_limit: 30, window_size: 60 } } } };
  return { id: BASELINE_ID, site_id: SITE_ID, available_functions: functions,
    function_schedules: Array.from({ length: 5 }, (_, i) => ({ name: `test-${i}`, cron: `${i} * * * *` })),
    branch: 'main', context: 'production', functions_region: 'cmh',
    functions_region_overrides: [{ name: 'test-0', region: 'cmh' }], database_branch_id: 'production',
    blobs_region: 'us-east-2', framework: null, edge_functions_present: null, server: null,
    database_migrations: { files: [] } };
}
const overlays = () => [
  { path: '/index.html', sha1: h('a'), source: 'home.html' },
  { path: '/play/index.html', sha1: h('b'), source: 'play.html' },
  { path: '/rewards/index.html', sha1: h('c'), source: 'rewards.html' },
  { path: '/rewards/assets/app.js', sha1: h('d'), source: 'app.js' },
  { path: '/scripts/nftree-rewards-entry.js', sha1: h('e'), source: 'entry.js' },
];
const originalFiles = { '/index.html': h('1'), '/play/index.html': h('2'), '/play/canopybreaker/index.html': h('3'), '/_headers': h('4') };

test('release reuses every untouched digest without needing original local file bytes', () => {
  const plan = assembleFiles(originalFiles, overlays());
  assert.equal(plan.files['/play/canopybreaker/index.html'], h('3'));
  assert.equal(plan.files['/_headers'], h('4'));
  assert.equal(Object.keys(plan.files).length, 7);
  assert.deepEqual(plan.changedOriginals, ['/index.html', '/play/index.html']);
});

test('release refuses unrelated replacements, public backend uploads, omitted entry points and duplicate overlays', () => {
  assert.throws(() => assembleFiles(originalFiles, [...overlays(), { path: '/_headers', sha1: h('5') }]), /Unapproved existing/);
  assert.throws(() => assembleFiles(originalFiles, [...overlays(), { path: '/netlify/functions/a.zip', sha1: h('5') }]), /Unapproved new/);
  assert.throws(() => assembleFiles(originalFiles, overlays().filter(x => x.path !== '/rewards/index.html')), /Missing rewards/);
  assert.throws(() => assembleFiles(originalFiles, [...overlays(), overlays()[0]]), /Duplicate/);
  assert.throws(() => assembleFiles(originalFiles, overlays().filter(x => x.path !== '/index.html')), /Only approved original/);
});

test('mixed-case build filenames use lowercase hosted paths while retaining exact source names', () => {
  const mixed = overlays().map(item => item.path === '/rewards/assets/app.js'
    ? { ...item, path: '/rewards/assets/App-AbCdEF.js', source: 'rewards-app/dist/assets/App-AbCdEF.js' } : item);
  const plan = assembleFiles(originalFiles, mixed);
  assert.equal(plan.files['/rewards/assets/app-abcdef.js'], h('d'));
  assert.equal(plan.sources['/rewards/assets/app-abcdef.js'], 'rewards-app/dist/assets/App-AbCdEF.js');
  assert(!Object.hasOwn(plan.files, '/rewards/assets/App-AbCdEF.js'));
  assert.throws(() => assembleFiles(originalFiles, [...mixed, {
    path: '/rewards/assets/app-abcdef.js', sha1: h('5'), source: 'another.js',
  }]), /case-colliding/);
});

test('inventory rejects duplicate paths, path traversal and non-SHA1 digests', () => {
  assert.throws(() => fileInventory([{ path: '/a', sha: h('1') }, { path: '/a', sha: h('2') }]), /duplicate/);
  assert.throws(() => fileInventory([{ path: '/rewards/../secret', sha: h('1') }]), /Invalid/);
  assert.throws(() => fileInventory([{ path: '/a', sha: 'not-a-hash' }]), /Invalid/);
});

test('request preserves explicit overrides, routes and rate limits without inventing runtime properties', () => {
  const configs = functionsConfig(backend());
  assert.equal(Object.keys(configs).length, 43);
  assert.deepEqual(configs['test-0'].routes, [{ pattern: '/api/example', literal: '/api/example', methods: ['GET'], prefer_static: false }]);
  assert.equal(configs['test-0'].region, 'us-east-2'); assert.equal(configs['test-0'].memory, 1024);
  assert.deepEqual(configs['test-0'].traffic_rules, backend().available_functions[0].tr);
  assert(!Object.hasOwn(configs['test-1'], 'region')); assert(!Object.hasOwn(configs['test-1'], 'memory'));
  assert(!Object.hasOwn(configs['test-0'], 'runtime'));
});

test('all backend identities, routes, traffic protections, runtime and schedules are protected', () => {
  const expected = backend(); compareBackend(structuredClone(expected), expected);
  for (const field of ['d', 'r', 'id', 'oid', 'bd', 'ro', 'tr', 'obl', 'oblv']) {
    const changed = structuredClone(expected); changed.available_functions[0][field] = field === 'd' ? 'b'.repeat(64) : 'changed';
    assert.throws(() => compareBackend(changed, expected), /changed|Incomplete/);
  }
  const dropped = structuredClone(expected); dropped.available_functions.pop();
  assert.throws(() => compareBackend(dropped, expected), /43/);
  const schedule = structuredClone(expected); schedule.function_schedules[0].cron = '0 0 * * *';
  assert.throws(() => compareBackend(schedule, expected), /schedules/);
  const region = structuredClone(expected); region.functions_region_overrides.push({ name: 'test-1', region: 'cmh' });
  assert.throws(() => compareBackend(region, expected), /runtime/);
});

test('only matching effective memory/region materialization is tolerated', () => {
  const expected = backend(), actual = structuredClone(expected);
  actual.available_functions[1].mo = 1024; actual.available_functions[1].rgo = 'us-east-2';
  compareBackend(actual, expected);
  actual.available_functions[1].mo = 2048;
  assert.throws(() => compareBackend(actual, expected), /records/);
  const unknown = structuredClone(expected); unknown.available_functions[1].unexpected = true;
  assert.throws(() => compareBackend(unknown, expected), /records/);
});

test('publication accepts only the newly-created candidate from this pinned source plan', () => {
  const plan = { sourceCommit: 'a'.repeat(40), baselineCreatedAt: '2026-11-07T10:00:00Z', title: 'new rewards release' };
  const state = { schemaVersion: 1, siteId: SITE_ID, id: 'b'.repeat(24), baselineId: BASELINE_ID,
    planSha256: fingerprint(plan), sourceCommit: plan.sourceCommit, requestStartedAt: '2026-11-07T11:00:00Z',
    candidateCreatedAt: '2026-11-07T11:00:01Z' };
  const deploy = { id: state.id, site_id: SITE_ID, created_at: state.candidateCreatedAt, title: plan.title };
  assertNewCandidate(state, plan, deploy);
  assert.throws(() => assertNewCandidate({ ...state, id: BASELINE_ID }, plan, deploy), /newly created/);
  assert.throws(() => assertNewCandidate(state, { ...plan, sourceCommit: 'c'.repeat(40) }, deploy), /equal/);
  const old = { ...state, candidateCreatedAt: '2026-11-06T11:00:00Z' };
  assert.throws(() => assertNewCandidate(old, plan, { ...deploy, created_at: old.candidateCreatedAt }), /older/);
  assert.throws(() => assertNewCandidate(state, plan, { ...deploy, site_id: 'wrong' }), /equal/);
});
