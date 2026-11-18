import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, fingerprint, environmentFor } from './release-preserved-production.mjs';
import { SITE_ID, ACCOUNT_ID, fileInventory, publicUploadPath, isAuditedInactiveDeploy } from './release-stats-market.mjs';
import { apiClient } from './release-sti-purchase.mjs';
import { ARBORETUM_SNIPPET, assertServedContent } from './stats-market-delivery.mjs';

// This is a preservation release, never the historical root build. Capture and
// plan are GET-only. Candidate creation cannot change the current locked site.
// Publish accepts only the new, reviewed candidate created by this exact plan.
export { SITE_ID, ACCOUNT_ID };
export const DB_PROJECT = 'lehswszuekjqottolmsf';
export const MIGRATION = 'supabase/migrations/20261118192546_arcade_recovery_month_end_cutoff.sql';
export const DB_PROOF = 'production/arcade-cutoff-db-readiness-20261118.json';
export const CONTROL_FILE = 'production/arcade-cutoff-publish.json';
export const REVIEW_FILE = 'production/arcade-cutoff-browser-review.json';
export const DELIVERY_SOURCES = {
  '/play/index.html': 'production/arcade-organization-static/index.html',
  '/scripts/arcade-monthly.js': 'scripts/arcade-monthly.js',
  '/scripts/arcade-organization.js': 'scripts/arcade-organization.js',
  '/scripts/arcade-season-deadline.js': 'scripts/arcade-season-deadline.js',
  '/styles/arcade-organization.css': 'styles/arcade-organization.css',
  '/styles/arcade-season-deadline.css': 'styles/arcade-season-deadline.css',
};
export const REPLACED_PATHS = ['/play/index.html', '/scripts/arcade-monthly.js'];
export const ADDED_PATHS = Object.keys(DELIVERY_SOURCES).filter(p => !REPLACED_PATHS.includes(p));
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RECORD_DIR = '.netlify/arcade-cutoff';
const MONTHLY = 'arcade-monthly';
const PACKAGE_SOURCES = ['netlify/monthly-functions/arcade-monthly.ts', 'netlify/lib/arcade-monthly-core.ts',
  'vendor/arcade-monthly/package.json', 'vendor/arcade-monthly/package-lock.json'];
const RUNTIME_FIELDS = ['branch', 'context', 'functions_region', 'functions_region_overrides',
  'database_branch_id', 'blobs_region', 'framework', 'edge_functions_present', 'server', 'database_migrations'];
const SOURCE_PATHS = [...Object.values(DELIVERY_SOURCES), 'production/arcade-organization-static/baseline.html',
  ...PACKAGE_SOURCES, MIGRATION, DB_PROOF, 'scripts/package-arcade-monthly.mjs',
  'scripts/release-arcade-cutoff.mjs', 'scripts/release-preserved-production.mjs',
  'scripts/release-stats-market.mjs', 'scripts/release-sti-purchase.mjs', 'scripts/stats-market-delivery.mjs',
  'tests/arcade-cutoff-release.test.mjs', '.github/workflows/publish-arcade-cutoff.yml'];
const sha = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
const safeId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const safeCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const safeHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const eq = (actual, expected, label) => assert(canonical(actual) === canonical(expected), label + ' changed; stop.');
const sorted = (rows, key) => [...rows].sort((a, b) => a[key].localeCompare(b[key]));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const originFor = id => { assert(safeId(id)); return `https://${id}--tree-token.netlify.app`; };

export function scopedAPI(api, mode) {
  assert(['capture', 'plan', 'candidate', 'verify', 'publish', 'audit'].includes(mode));
  return (endpoint, method = 'GET', body) => {
    const create = mode === 'candidate' && method === 'POST' && endpoint.startsWith(`sites/${SITE_ID}/deploys?title=`);
    const lock = mode === 'publish' && method === 'POST' && /^deploys\/[a-f0-9]{24}\/lock$/.test(endpoint);
    assert(method === 'GET' || create || lock, `Remote ${method} is forbidden in ${mode} mode.`);
    return api(endpoint, method, body);
  };
}

function runtime(deploy) {
  const fields = Object.fromEntries(RUNTIME_FIELDS.filter(k => Object.hasOwn(deploy, k)).map(k => [k, deploy[k]]));
  if (fields.functions_region_overrides) fields.functions_region_overrides = sorted(fields.functions_region_overrides, 'name');
  return fields;
}

// Counts come from the fresh API capture, not a historical 616/49/5 snapshot.
export function validateBackend(deploy) {
  assert.equal(deploy.site_id, SITE_ID); assert(safeId(deploy.id), 'Invalid deployment ID.');
  assert(Array.isArray(deploy.available_functions) && deploy.available_functions.length, 'Missing complete backend inventory.');
  assert.equal(new Set(deploy.available_functions.map(f => f.n)).size, deploy.available_functions.length, 'Duplicate functions.');
  for (const f of deploy.available_functions) {
    assert(/^[a-z0-9-]+$/.test(f.n) && safeHash(f.d), 'Invalid function name or digest.');
    for (const key of ['id', 'oid', 'a', 'c', 'r', 'rg', 'm', 'im', 's', 'bd']) assert(f[key] != null, `Incomplete ${f.n} field ${key}.`);
  }
  assert(deploy.available_functions.some(f => f.n === MONTHLY), 'The existing monthly function is missing.');
  assert(Array.isArray(deploy.function_schedules), 'Missing schedule inventory.');
  assert.equal(new Set(deploy.function_schedules.map(s => s.name)).size, deploy.function_schedules.length, 'Duplicate schedules.');
  for (const schedule of deploy.function_schedules) assert(schedule.cron && deploy.available_functions.some(f => f.n === schedule.name), 'Invalid schedule.');
  assert.equal(deploy.context, 'production'); assert.equal(deploy.branch, 'main');
  assert.equal(deploy.functions_region, 'cmh', 'Unreviewed function region.');
  assert(!deploy.edge_functions_present && !deploy.server, 'Unreviewed edge/server bundle.');
  assert(deploy.database_migrations == null || deploy.database_migrations.files?.length === 0, 'Unreviewed Netlify database migration.');
}

export function compareBackend(actual, expected, monthly = null, pinnedMonthlyRecord) {
  validateBackend(actual); validateBackend(expected);
  assert.equal(actual.available_functions.length, expected.available_functions.length, 'Backend count changed.');
  const expectedByName = new Map(expected.available_functions.map(f => [f.n, f]));
  let monthlyRecord;
  for (const f of actual.available_functions) {
    const original = expectedByName.get(f.n); assert(original, 'Unapproved function.');
    const copy = { ...f }, previous = { ...original };
    for (const [override, effective] of [['mo', 'm'], ['rgo', 'rg']]) {
      if (!Object.hasOwn(previous, override) && Object.hasOwn(copy, override) && copy[override] === previous[effective]) delete copy[override];
    }
    if (f.n === MONTHLY && monthly && monthly.sha256 !== original.d) {
      assert.equal(copy.d, monthly.sha256, 'Monthly package digest differs.');
      assert.equal(copy.s, monthly.bytes, 'Monthly package size differs.');
      // Netlify's CLI maps available_functions.a to the function log service's
      // account_id; functionConfig exposes no account assignment setting:
      // https://github.com/netlify/cli/blob/3fe8202fe7424f8934d6373ac55b215c77433f7c/src/commands/logs/sources/functions.ts
      // A rebuilt, exact-digest ZIP may receive a new provider account along
      // with its package identities. Every execution/configuration field stays.
      assert(typeof copy.a === 'string' && /^\d{12}$/.test(copy.a), 'Invalid monthly provider account.');
      for (const field of ['d', 'id', 'oid', 'a', 'c', 's']) { delete copy[field]; delete previous[field]; }
    }
    eq(copy, previous, 'Complete backend record for ' + f.n);
    if (f.n === MONTHLY) {
      // Once the new candidate is verified, even package/allocation metadata
      // and API-materialized aliases must stay byte-for-value identical.
      if (pinnedMonthlyRecord !== undefined) eq(f, pinnedMonthlyRecord, 'Pinned monthly provisioning record');
      monthlyRecord = structuredClone(f);
    }
  }
  eq(sorted(actual.function_schedules, 'name'), sorted(expected.function_schedules, 'name'), 'All schedules');
  eq(runtime(actual), runtime(expected), 'All deployment runtime settings');
  return monthlyRecord;
}

export function functionsConfig(deploy) {
  validateBackend(deploy);
  const regionOverrides = new Set((deploy.functions_region_overrides || []).map(row => row.name));
  const route = r => Object.fromEntries(Object.entries({ pattern: r.p, literal: r.l, expression: r.e,
    methods: r.m, prefer_static: r.ps }).filter(([, value]) => value != null));
  return Object.fromEntries(deploy.available_functions.map(f => {
    const config = {};
    for (const [from, to] of Object.entries({ dn: 'display_name', g: 'generator', bd: 'build_data',
      p: 'priority', tr: 'traffic_rules', vcpu: 'vcpu', es: 'event_subscriptions' })) if (f[from] != null) config[to] = f[from];
    if (f.vcpu == null && Object.hasOwn(f, 'mo')) config.memory = f.mo;
    if (regionOverrides.has(f.n)) config.region = f.rgo ?? f.rg;
    if (f.ro) config.routes = f.ro.map(route);
    if (f.er) config.excluded_routes = f.er.map(route);
    return [f.n, config];
  }));
}

export function packageTrafficRules(value) {
  // zip-it-and-ship-it uses camelCase; the deploy API returns the same
  // rate-limit structure in snake_case. Preserve every other key and value.
  if (Array.isArray(value)) return value.map(packageTrafficRules);
  if (!value || typeof value !== 'object') return value;
  const keys = { rateLimitConfig: 'rate_limit_config', windowLimit: 'window_limit', windowSize: 'window_size' };
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = keys[key] || key;
    assert(!Object.hasOwn(result, normalized), 'Ambiguous rate-limit schema.');
    result[normalized] = packageTrafficRules(child);
  }
  return result;
}

export function storedPlayHTML(bytes, expectedSHA1) {
  assert(/^[a-f0-9]{40}$/.test(expectedSHA1), 'Missing captured HTML SHA1.');
  if (sha(bytes, 'sha1') === expectedSHA1) return Buffer.from(bytes);
  const html = bytes.toString('utf8'), at = html.lastIndexOf(ARBORETUM_SNIPPET);
  assert(at >= 0, 'Current HTML does not match the captured inventory.');
  const suffix = html.slice(at + ARBORETUM_SNIPPET.length);
  assert(/^\s*<\/body>\s*<\/html>\s*$/i.test(suffix), 'Unexpected live HTML injection.');
  const stored = Buffer.from(html.slice(0, at) + suffix);
  assert.equal(sha(stored, 'sha1'), expectedSHA1, 'HTML differs beyond the one known delivery snippet.');
  return stored;
}

export function organizeFreshHTML(bytes) {
  const html = bytes.toString('utf8');
  assert(!/arcade-(?:organization|season-deadline)\.(?:js|css)/.test(html), 'These assets already exist in current HTML; review a new release scope.');
  assert(!/data-arcade-review-preview|arcade-preview-readonly|arcade-review-notice/.test(html), 'A sandbox preview cannot be published.');
  assert.equal((html.match(/<\/head>/g) || []).length, 1, 'Ambiguous head insertion.');
  assert.equal((html.match(/<\/body>/g) || []).length, 1, 'Ambiguous body insertion.');
  return Buffer.from(html.replace('</head>', '<link rel="stylesheet" href="/styles/arcade-season-deadline.css"><link rel="stylesheet" href="/styles/arcade-organization.css"></head>')
    .replace('</body>', '<script type="module" src="/scripts/arcade-organization.js"></script></body>'));
}

export function assembleFiles(baselineFiles, overlays) {
  for (const pathname of REPLACED_PATHS) assert(baselineFiles[pathname], 'Missing existing Arcade path: ' + pathname);
  for (const pathname of ADDED_PATHS) assert(!Object.hasOwn(baselineFiles, pathname), 'New asset already exists; re-review the scope: ' + pathname);
  const files = { ...baselineFiles }, sources = {};
  for (const item of overlays) {
    const pathname = publicUploadPath(item.path);
    assert(Object.hasOwn(DELIVERY_SOURCES, pathname), 'Unapproved overlay path.');
    assert(!Object.hasOwn(sources, pathname), 'Duplicate overlay.');
    assert.equal(item.source, DELIVERY_SOURCES[pathname], 'Unapproved overlay source.');
    assert(/^[a-f0-9]{40}$/.test(item.sha1), 'Invalid overlay SHA1.');
    files[pathname] = item.sha1; sources[pathname] = item.source;
  }
  eq(Object.keys(sources).sort(), Object.keys(DELIVERY_SOURCES).sort(), 'Complete overlay inventory');
  const changedOriginals = Object.keys(baselineFiles).filter(p => files[p] !== baselineFiles[p]).sort();
  eq(changedOriginals, [...REPLACED_PATHS].sort(), 'Exactly the two approved existing paths');
  assert(Object.keys(baselineFiles).every(p => Object.hasOwn(files, p)), 'Existing path removed.');
  return { files, sources, changedOriginals, addedPaths: [...ADDED_PATHS].sort() };
}

export function validateDBProof(proof, migrationBytes, now = Date.now()) {
  assert.equal(proof.schemaVersion, 1); assert.equal(proof.projectId, DB_PROJECT);
  assert.equal(proof.sourceMigration, MIGRATION);
  assert.equal(proof.sourceMigrationSHA256, sha(migrationBytes), 'DB proof is for different migration bytes.');
  assert(/^\d{14}$/.test(proof.appliedMigration?.version || ''), 'Missing applied migration version.');
  assert.equal(proof.appliedMigration.name, 'arcade_recovery_month_end_cutoff');
  const age = now - Date.parse(proof.verifiedAt);
  assert(Number.isFinite(age) && age >= -300000 && age <= 86400000, 'Read-only DB readiness proof must be from the last 24 hours.');
  assert.equal(proof.rpcDefinitions?.length, 2, 'Both live recovery RPC definitions must be checked.');
  eq(proof.rpcDefinitions.map(r => r.name).sort(), ['arcade_recovery_confirm_v1', 'arcade_recovery_intent_v1'], 'Recovery RPC inventory');
  for (const rpc of proof.rpcDefinitions) {
    assert(safeHash(rpc.sha256), 'Missing live RPC definition hash.');
    assert.equal(rpc.securityDefiner, false); assert.equal(rpc.searchPath, '');
    eq([...rpc.executeRoles].sort(), ['postgres', 'service_role'], 'Recovery RPC execute roles');
    eq([...rpc.deniedRoles].sort(), ['PUBLIC', 'anon', 'authenticated'], 'Browser role restrictions');
  }
  return { path: DB_PROOF, sha256: fingerprint(proof), projectId: proof.projectId,
    verifiedAt: proof.verifiedAt, migrationSHA256: proof.sourceMigrationSHA256,
    appliedMigration: proof.appliedMigration, rpcDefinitions: proof.rpcDefinitions,
    verification: 'Operator-supplied read-only production SQL verification; not inferred from public HTTP configuration.' };
}

export function validateBrowserReview(report, plan, state, now = Date.now()) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.result, 'passed');
  assert.equal(report.sourceCommit, plan.sourceCommit); assert.equal(report.sourceTree, plan.sourceTree);
  assert.equal(report.candidateId, state.id); assert.equal(report.planSha256, fingerprint(plan));
  assert.equal(report.origin, originFor(state.id)); assert.equal(report.noWalletOrPaymentActions, true);
  const at = Date.parse(report.checkedAt);
  assert(Number.isFinite(at) && at >= Date.parse(state.candidateCreatedAt) && at <= now + 300000 && now - at <= 86400000,
    'Candidate browser review must be current and after candidate creation.');
  assert(Array.isArray(report.viewportWidths) && report.viewportWidths.some(w => Number.isInteger(w) && w >= 320 && w <= 430)
    && report.viewportWidths.some(w => Number.isInteger(w) && w >= 1024), 'Review a phone and desktop width.');
  for (const name of ['games', 'daily', 'campaigns', 'events', 'monthlyProgress', 'badgeCollection', 'mobileLayout', 'noMissingAssets', 'countdownUTC']) {
    assert.equal(report.checks?.[name], true, 'Missing candidate browser check: ' + name);
  }
}

export function validatePublicationControl(control, action = 'publish-arcade-cutoff') {
  assert(['publish-arcade-cutoff', 'audit-arcade-cutoff'].includes(action), 'Invalid release control action.');
  assert.equal(control.schemaVersion, 1); assert.equal(control.action, action);
  for (const key of ['sourceCommit', 'sourceTree', 'mainCommit']) assert(safeCommit(control[key]), 'Invalid control ' + key);
  for (const key of ['expectedDeploy', 'candidateId']) assert(safeId(control[key]), 'Invalid control ' + key);
  assert.notEqual(control.expectedDeploy, control.candidateId, 'An older deploy cannot be restored.');
  assert(safeHash(control.planSha256), 'Missing reviewed plan digest.');
  assert(/^[1-9]\d*$/.test(String(control.candidateRunId)), 'Missing candidate workflow run.');
  assert(/^[1-9]\d*$/.test(String(control.candidateArtifactId)), 'Missing candidate artifact identity.');
  assert(safeHash(control.candidateArtifactSHA256), 'Missing candidate artifact digest.');
  assert.equal(control.browserReview, REVIEW_FILE);
}

function assertSource(commit, sourceTree) {
  assert(safeCommit(commit), 'Pin the exact committed source.');
  assert.equal(git('rev-parse', 'HEAD'), commit, 'Checkout differs from reviewed source.');
  if (sourceTree) assert.equal(git('rev-parse', 'HEAD^{tree}'), sourceTree, 'Source tree changed.');
  assert.equal(git('diff', '--name-only', commit, '--', ...SOURCE_PATHS), '', 'Uncommitted release changes.');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHS), '', 'Commit all release sources first.');
  for (const filename of SOURCE_PATHS) git('cat-file', '-e', `${commit}:${filename}`);
}

function writeRecord(filename, value, exclusive = false) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const options = { mode: 0o600, ...(exclusive ? { flag: 'wx' } : {}) };
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', options);
  fs.writeFileSync(filename + '.sha256', fingerprint(value) + '\n', options);
}
function readRecord(filename) {
  const value = read(filename);
  assert.equal(fs.readFileSync(filename + '.sha256', 'utf8').trim(), fingerprint(value), 'Release record integrity failed.');
  return value;
}
async function inventory(api, id) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api(`deploys/${id}/files?per_page=100&page=${page}`);
    assert(Array.isArray(batch), 'Invalid static inventory.'); rows.push(...batch);
    if (batch.length < 100) return fileInventory(rows);
  }
  throw Error('Incomplete static inventory; release refused.');
}
async function protectedEnvironment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [allSite, siteFunctions, shared, sharedFunctions, snippets] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'), api(`sites/${SITE_ID}/snippets`),
  ]);
  assert(Array.isArray(snippets), 'Missing site snippet configuration.');
  return { ...environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings }),
    snippetsSha256: fingerprint(snippets) };
}
function snapshotDeploy(deploy) {
  return { id: deploy.id, site_id: deploy.site_id, state: deploy.state, locked: deploy.locked,
    created_at: deploy.created_at, published_at: deploy.published_at, available_functions: deploy.available_functions,
    function_schedules: deploy.function_schedules, ...runtime(deploy) };
}
function validateBaseline(baseline, expected) {
  assert.equal(baseline.schemaVersion, 1); assert.equal(baseline.siteId, SITE_ID); assert.equal(baseline.accountId, ACCOUNT_ID);
  assert.equal(baseline.deploy.id, expected); assert.equal(baseline.deploy.state, 'ready'); assert.equal(baseline.deploy.locked, true);
  validateBackend(baseline.deploy);
  const files = fileInventory(Object.entries(baseline.files).map(([pathname, digest]) => ({ path: pathname, sha: digest })));
  assert(files['/play/index.html'] && files['/scripts/arcade-monthly.js'] && files['/index.html'], 'Incomplete current site inventory.');
  assert.equal(baseline.playSHA1, files['/play/index.html']);
  assert(baseline.environment?.site?.entries > 0 && baseline.environment.snippetsSha256, 'Missing protected configuration evidence.');
  return files;
}
async function assertLiveBaseline(api, baseline) {
  const site = await api(`sites/${SITE_ID}`);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, baseline.deploy.id, 'Production changed; capture and review a new candidate.');
  assert.equal(site.published_deploy.locked, true, 'Current production lock changed.');
  const deploy = await api(`deploys/${baseline.deploy.id}`);
  assert.equal(deploy.state, 'ready'); assert.equal(deploy.locked, true);
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, deploy.id), baseline.files, 'Complete current static inventory');
  eq(await protectedEnvironment(api, site), baseline.environment, 'Protected environment/settings/snippets');
}
function overlayFiles(baseline, directory) {
  const current = fs.readFileSync(path.join(directory, 'baseline-play.html'));
  assert.equal(sha(current, 'sha1'), baseline.playSHA1, 'Captured current HTML changed.');
  const reviewedBase = fs.readFileSync(path.join(ROOT, 'production/arcade-organization-static/baseline.html'));
  assert(current.equals(reviewedBase), 'Live /play changed: rebase and review the Arcade source before proceeding.');
  const fresh = organizeFreshHTML(current);
  assert(fresh.equals(fs.readFileSync(path.join(ROOT, DELIVERY_SOURCES['/play/index.html']))), 'Arcade HTML must be exactly fresh production plus the three approved asset imports.');
  return Object.entries(DELIVERY_SOURCES).map(([publicPath, source]) => {
    const filename = path.join(ROOT, source);
    assert(!fs.lstatSync(filename).isSymbolicLink(), 'Symlink refused.');
    return { path: publicPath, source, sha1: sha(fs.readFileSync(filename), 'sha1') };
  });
}
export function monthlyPackage(filename, deploy, root = ROOT) {
  if (!filename) return null;
  const pack = read(filename), original = deploy.available_functions.find(f => f.n === MONTHLY);
  assert.equal(pack.name, MONTHLY); assert.equal(pack.path, '.netlify/arcade-monthly-functions/arcade-monthly.zip');
  assert.equal(pack.runtimeVersion, original.r); assert.equal(pack.invocationMode, original.im);
  eq(pack.buildData, original.bd, 'Monthly bootstrap configuration');
  eq(pack.routes, original.ro.map(r => ({ pattern: r.p, literal: r.l, methods: r.m })), 'Monthly routes');
  eq(packageTrafficRules(pack.trafficRules), original.tr, 'Monthly rate limit');
  eq(pack.sourceFiles.map(f => f.path).sort(), [...PACKAGE_SOURCES].sort(), 'Isolated monthly source inventory');
  for (const source of pack.sourceFiles) assert.equal(sha(fs.readFileSync(path.join(root, source.path))), source.sha256, 'Monthly ZIP/source mismatch.');
  const bytes = fs.readFileSync(path.join(root, pack.path));
  assert.equal(sha(bytes), pack.sha256, 'Monthly ZIP digest mismatch.');
  return { ...pack, bytes: bytes.length, manifest: path.relative(root, filename) };
}

export function assertNewCandidate(state, plan, deploy) {
  assert.equal(state.schemaVersion, 1); assert.equal(state.siteId, SITE_ID);
  assert(safeId(state.id) && state.id !== plan.baselineId, 'Only the new candidate from this plan may be published.');
  assert.equal(state.baselineId, plan.baselineId); assert.equal(state.planSha256, fingerprint(plan));
  assert.equal(state.sourceCommit, plan.sourceCommit); assert.equal(deploy.id, state.id); assert.equal(deploy.site_id, SITE_ID);
  assert.equal(deploy.created_at, state.candidateCreatedAt, 'Candidate creation identity changed.');
  assert(Date.parse(deploy.created_at) >= Date.parse(state.requestStartedAt) - 10000, 'Refusing an older deployment.');
  assert(Date.parse(deploy.created_at) > Date.parse(plan.baselineCreatedAt), 'Candidate predates the baseline.');
  assert.equal(deploy.title, plan.title, 'Candidate title changed.');
}

export async function activeDeploys(api, candidateId) {
  const active = [];
  for (let page = 1; page <= 100; page++) {
    const rows = await api(`sites/${SITE_ID}/deploys?per_page=100&page=${page}`);
    assert(Array.isArray(rows), 'Invalid deploy history.');
    for (const summary of rows) {
      if (summary.id === candidateId || ['ready', 'error', 'rejected', 'canceled'].includes(summary.state)) continue;
      const full = await api(`deploys/${summary.id}`);
      if (!isAuditedInactiveDeploy(full)) active.push({ id: full.id, state: full.state });
    }
    if (rows.length < 100) return active;
  }
  throw Error('Incomplete deploy history; publication refused.');
}
export async function waitForAllBuilds(api, candidateId, { attempts = 91, pause = delay, log = console.log } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const active = await activeDeploys(api, candidateId);
    if (!active.length) return;
    assert(attempt + 1 < attempts, 'Queued or nonterminal deploys remain; publication refused.');
    log(`Waiting for ${active.length} nonterminal deployment(s) before publication.`);
    await pause(10000);
  }
}
async function publicChecks(origin, plan) {
  assert(origin === 'https://tree-token.xyz' || origin === originFor(plan.candidateId), 'Unapproved public check origin.');
  for (const [publicPath, source] of Object.entries(plan.sources)) {
    const pathname = publicPath === '/play/index.html' ? '/play/' : publicPath;
    const response = await fetch(new URL(pathname, origin), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Public delivery failed: ' + pathname);
    const expected = fs.readFileSync(path.join(ROOT, source));
    assert.equal(sha(expected, 'sha1'), plan.files[publicPath], 'Local delivery bytes changed.');
    const type = response.headers.get('content-type') || '';
    assert(publicPath.endsWith('.js') ? /javascript|ecmascript/i.test(type) : publicPath.endsWith('.css') ? /text\/css/i.test(type) : /text\/html/i.test(type), 'Unexpected content type.');
    assertServedContent(path.basename(publicPath), Buffer.from(await response.arrayBuffer()), expected);
  }
  const response = await fetch(origin + '/api/arcade-monthly?action=status', { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Monthly public status failed.');
  const status = await response.json();
  assert.equal(status.authenticated, false); assert.equal(status.configuration?.recovery?.price, '20000');
  assert.equal(status.configuration.recovery.amountBaseUnits, '20000000000');
  assert.equal(status.configuration.recovery.cutoffPolicy, 'utc-month-end-v1');
  assert.equal(status.configuration.recovery.cutoffEffectiveMonth, '2026-11');
}
async function verifyCandidate(api, baseline, plan, state, allowInitialPin = false) {
  await assertLiveBaseline(api, baseline);
  const deploy = await api(`deploys/${state.id}`);
  assertNewCandidate(state, plan, deploy); assert.equal(deploy.state, 'ready'); assert(!deploy.published_at, 'Candidate already published; inspect the recorded release.');
  assert(state.monthlyProviderRecord || allowInitialPin, 'Candidate monthly provisioning record was not pinned.');
  const monthlyRecord = compareBackend(deploy, baseline.deploy, plan.monthly, state.monthlyProviderRecord ?? undefined);
  eq(await inventory(api, state.id), plan.files, 'Complete candidate static inventory');
  await publicChecks(originFor(state.id), { ...plan, candidateId: state.id });
  await assertLiveBaseline(api, baseline);
  state.monthlyProviderRecord ??= monthlyRecord;
  return deploy;
}
async function verifyPublished(api, baseline, plan, state) {
  const site = await api(`sites/${SITE_ID}`), published = await api(`deploys/${state.id}`);
  assert.equal(site.published_deploy?.id, state.id); assert.equal(site.published_deploy.locked, true);
  assert.equal(published.state, 'ready'); assert.equal(published.locked, true); assertNewCandidate(state, plan, published);
  assert(state.monthlyProviderRecord, 'Published audit requires the pinned candidate monthly record.');
  compareBackend(published, baseline.deploy, plan.monthly, state.monthlyProviderRecord);
  eq(await inventory(api, state.id), plan.files, 'Complete published static inventory');
  eq(await protectedEnvironment(api, site), baseline.environment, 'Published protected configuration');
  return published;
}
async function upload(token, endpoint, bytes) {
  let response;
  try { response = await fetch('https://api.netlify.com/api/v1/' + endpoint, { method: 'PUT', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(45000) }); }
  catch { throw Error('Upload transport failed; inspect this candidate before any retry. Raw details withheld.'); }
  assert(response.ok, `Upload failed (HTTP ${response.status}); raw details withheld.`);
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    directory: { type: 'string', default: RECORD_DIR }, 'source-commit': { type: 'string' },
    'expected-deploy': { type: 'string' }, 'monthly-manifest': { type: 'string' },
    'browser-report': { type: 'string' }, 'expected-candidate': { type: 'string' }, 'main-commit': { type: 'string' },
  } });
  const mode = positionals[0];
  assert(positionals.length === 1 && ['capture', 'plan', 'candidate', 'verify', 'publish', 'audit'].includes(mode), 'Use capture|plan|candidate|verify|publish|audit.');
  const expected = values['expected-deploy'] || process.env.ARCADE_CUTOFF_EXPECTED_DEPLOY;
  assert(safeId(expected), 'An explicit expected locked production deployment is required.');
  assert(!process.env.DEBUG && !process.env.NODE_DEBUG, 'Unset debug logging for authenticated release requests.');
  const token = process.env.NETLIFY_AUTH_TOKEN;
  assert(token, 'The existing NETLIFY_AUTH_TOKEN release connection is required.');
  const api = scopedAPI(apiClient(token), mode), directory = path.resolve(ROOT, values.directory);
  const baselinePath = path.join(directory, 'baseline.json'), planPath = path.join(directory, 'plan.json'), statePath = path.join(directory, 'candidate.json');
  if (mode === 'capture') {
    assert(!fs.existsSync(baselinePath), 'Use a fresh capture directory.');
    const site = await api(`sites/${SITE_ID}`), deploy = await api(`deploys/${expected}`);
    assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
    assert.equal(site.published_deploy?.id, expected, 'The expected production baseline changed.');
    assert.equal(site.published_deploy.locked, true);
    const files = await inventory(api, expected), environment = await protectedEnvironment(api, site);
    const baseline = { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID, capturedAt: new Date().toISOString(),
      deploy: snapshotDeploy(deploy), files, environment, playSHA1: files['/play/index.html'] };
    validateBaseline(baseline, expected);
    const response = await fetch(originFor(expected) + '/play/', { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Current play HTML unavailable.');
    const html = storedPlayHTML(Buffer.from(await response.arrayBuffer()), baseline.playSHA1);
    await assertLiveBaseline(api, baseline);
    fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, 'baseline-play.html'), html, { flag: 'wx' });
    writeRecord(baselinePath, baseline, true);
    console.log(JSON.stringify({ mode, productionChanged: false, baselineId: expected, staticFiles: Object.keys(files).length,
      backendRecords: deploy.available_functions.length, schedules: deploy.function_schedules.length }));
    return;
  }
  const baseline = readRecord(baselinePath), baselineFiles = validateBaseline(baseline, expected);
  let plan;
  if (mode === 'plan') {
    assert(!fs.existsSync(planPath), 'Plan already exists.');
    const sourceCommit = values['source-commit'] || git('rev-parse', 'HEAD'), sourceTree = git('rev-parse', 'HEAD^{tree}');
    assertSource(sourceCommit, sourceTree); await assertLiveBaseline(api, baseline);
    const dbReadiness = validateDBProof(read(path.join(ROOT, DB_PROOF)), fs.readFileSync(path.join(ROOT, MIGRATION)));
    plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: expected, baselineSha256: fingerprint(baseline), baselineCreatedAt: baseline.deploy.created_at,
      createdAt: new Date().toISOString(), sourceCommit, sourceTree, sourceBranch: git('branch', '--show-current'),
      title: `TREE Arcade cutoff ${sourceCommit.slice(0, 12)}; preserve current production`,
      ...assembleFiles(baselineFiles, overlayFiles(baseline, directory)), dbReadiness,
      monthly: monthlyPackage(values['monthly-manifest'] ? path.resolve(ROOT, values['monthly-manifest']) : null, baseline.deploy) };
    writeRecord(planPath, plan, true);
  } else {
    plan = readRecord(planPath); assert.equal(plan.baselineSha256, fingerprint(baseline)); assert.equal(plan.baselineId, expected);
    assertSource(plan.sourceCommit, plan.sourceTree);
    if (values['source-commit']) assert.equal(values['source-commit'], plan.sourceCommit);
    eq(assembleFiles(baselineFiles, overlayFiles(baseline, directory)), { files: plan.files, sources: plan.sources,
      changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths }, 'Local release sources');
    eq(monthlyPackage(plan.monthly ? path.join(ROOT, plan.monthly.manifest) : null, baseline.deploy), plan.monthly, 'Isolated monthly package');
    eq(validateDBProof(read(path.join(ROOT, DB_PROOF)), fs.readFileSync(path.join(ROOT, MIGRATION)),
      mode === 'audit' ? Date.parse(plan.createdAt) : Date.now()), plan.dbReadiness, 'DB readiness evidence');
    if (mode !== 'audit') await assertLiveBaseline(api, baseline);
  }
  let state, deploy;
  if (mode === 'candidate') {
    assert(!fs.existsSync(statePath), 'Candidate exists; verify it instead of creating another.');
    const functions = Object.fromEntries(baseline.deploy.available_functions.map(f => [f.n, f.d]));
    if (plan.monthly) functions[MONTHLY] = plan.monthly.sha256;
    const requestStartedAt = new Date().toISOString();
    deploy = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(plan.title)}`, 'POST', { files: plan.files,
      functions, functions_config: functionsConfig(baseline.deploy), function_schedules: baseline.deploy.function_schedules,
      draft: false, async: false, branch: baseline.deploy.branch });
    state = { schemaVersion: 1, siteId: SITE_ID, id: deploy.id, baselineId: expected, sourceCommit: plan.sourceCommit,
      planSha256: fingerprint(plan), requestStartedAt, candidateCreatedAt: deploy.created_at,
      technicalVerifiedAt: null, browserReview: null, monthlyProviderRecord: null };
    writeRecord(statePath, state, true); assertNewCandidate(state, plan, deploy);
    for (const field of ['required_edge_functions', 'required_server']) assert(Array.isArray(deploy[field]) && deploy[field].length === 0, 'Unapproved edge/server upload.');
    assert(Array.isArray(deploy.required) && Array.isArray(deploy.required_functions), 'Missing upload requirements.');
    for (const digest of deploy.required) {
      const pathname = Object.keys(plan.sources).find(p => plan.files[p] === digest);
      assert(pathname, 'Unchanged or unapproved static upload requested.');
      const bytes = fs.readFileSync(path.join(ROOT, plan.sources[pathname])); assert.equal(sha(bytes, 'sha1'), digest);
      await upload(token, `deploys/${state.id}/files${pathname}`, bytes);
    }
    assert(deploy.required_functions.every(digest => plan.monthly && digest === plan.monthly.sha256), 'Unrelated backend upload requested.');
    if (deploy.required_functions.length) {
      assert.equal(deploy.required_functions.length, 1, 'Duplicate backend upload.');
      await upload(token, `deploys/${state.id}/functions/${MONTHLY}?runtime=${encodeURIComponent(plan.monthly.runtimeVersion)}&invocation_mode=${encodeURIComponent(plan.monthly.invocationMode)}`,
        fs.readFileSync(path.join(ROOT, plan.monthly.path)));
    }
    for (let attempt = 0; attempt < 120; attempt++) {
      deploy = await api(`deploys/${state.id}`);
      if (deploy.state === 'ready') break;
      assert(!['error', 'rejected', 'canceled'].includes(deploy.state), 'Candidate failed; production remains locked.');
      await delay(1000);
    }
  } else if (mode !== 'plan') state = readRecord(statePath);
  if (state) {
    if (values['expected-candidate']) assert.equal(state.id, values['expected-candidate']);
    if (mode === 'audit') {
      assert.equal(values['expected-candidate'], state.id, 'Audit requires the explicit bound candidate ID.');
      deploy = await verifyPublished(api, baseline, plan, state);
      await publicChecks('https://tree-token.xyz', { ...plan, candidateId: state.id });
      await verifyPublished(api, baseline, plan, state);
      state.lastAuditedAt = new Date().toISOString(); state.publishedAt = deploy.published_at;
    } else {
      deploy = await verifyCandidate(api, baseline, plan, state, mode === 'candidate'); state.technicalVerifiedAt = new Date().toISOString();
    }
    if ((mode === 'verify' || mode === 'audit') && values['browser-report']) {
      const report = read(path.resolve(ROOT, values['browser-report'])); validateBrowserReview(report, plan, state);
      state.browserReview = { report, sha256: fingerprint(report) };
    }
    if (mode === 'publish') {
      assert.equal(values['expected-candidate'], state.id, 'Explicit reviewed candidate ID required.');
      assert(state.browserReview, 'Review the ready candidate before publication.');
      assert.equal(state.browserReview.sha256, fingerprint(state.browserReview.report));
      validateBrowserReview(state.browserReview.report, plan, state);
      const mainCommit = values['main-commit']; assert(safeCommit(mainCommit), 'Exact merged main commit required.');
      assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0], mainCommit, 'Remote main changed.');
      assert.equal(git('rev-parse', `${mainCommit}^{tree}`), plan.sourceTree, 'Main differs from the complete reviewed candidate source tree.');
      await waitForAllBuilds(api, state.id);
      await assertLiveBaseline(api, baseline);
      const beforeLock = await api(`deploys/${state.id}`);
      assertNewCandidate(state, plan, beforeLock); assert.equal(beforeLock.state, 'ready');
      assert(!beforeLock.published_at, 'Candidate was published while waiting; inspect it before continuing.');
      compareBackend(beforeLock, baseline.deploy, plan.monthly, state.monthlyProviderRecord);
      // Recheck after the queue wait. An ordinary Git build never gets an
      // exception; only the already-audited inactive historical API records do.
      assert.equal((await activeDeploys(api, state.id)).length, 0, 'A new queued build blocks publication.');
      assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0], mainCommit, 'Main changed while waiting.');
      state.publicationRequestedAt = new Date().toISOString(); state.mainCommit = mainCommit; writeRecord(statePath, state);
      // This endpoint locks and publishes only the newly created candidate.
      // There is no restore, unlock, settings write, or old-deploy code path.
      await api(`deploys/${state.id}/lock`, 'POST');
      for (let attempt = 0; attempt < 60; attempt++) {
        const current = await api(`sites/${SITE_ID}`);
        assert([expected, state.id].includes(current.published_deploy?.id), 'Concurrent publication detected.');
        if (current.published_deploy.id === state.id && current.published_deploy.locked === true) break;
        await delay(1000);
      }
      await verifyPublished(api, baseline, plan, state);
      await publicChecks('https://tree-token.xyz', { ...plan, candidateId: state.id });
      await verifyPublished(api, baseline, plan, state);
      state.publishedAt = new Date().toISOString();
    }
    writeRecord(statePath, state);
  }
  const changedMonthly = !!plan.monthly && plan.monthly.sha256 !== baseline.deploy.available_functions.find(f => f.n === MONTHLY).d;
  const report = { schemaVersion: 1, mode, result: 'passed', checkedAt: new Date().toISOString(), baselineId: expected,
    candidateId: state?.id ?? null, sourceCommit: plan.sourceCommit, sourceTree: plan.sourceTree, planSha256: fingerprint(plan),
    staticFiles: Object.keys(plan.files).length, baselineStaticFiles: Object.keys(baselineFiles).length,
    preservedStaticFiles: Object.keys(baselineFiles).length - plan.changedOriginals.length,
    changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths, files: plan.files,
    backendRecords: baseline.deploy.available_functions.length, preservedBackendRecords: baseline.deploy.available_functions.length - Number(changedMonthly),
    replacedFunction: changedMonthly ? MONTHLY : null, monthlySHA256: plan.monthly?.sha256 ?? null,
    monthlyProviderRecordSHA256: state?.monthlyProviderRecord ? fingerprint(state.monthlyProviderRecord) : null,
    schedulesPreserved: baseline.deploy.function_schedules.length, protectedConfigurationSHA256: fingerprint(baseline.environment),
    dbReadiness: plan.dbReadiness, browserReviewSHA256: state?.browserReview?.sha256 ?? null,
    productionChanged: mode === 'publish', publishedCandidateVerified: ['publish', 'audit'].includes(mode),
    productionLocked: true, mainCommit: state?.mainCommit ?? null,
    url: state ? originFor(state.id) + '/play/' : null };
  writeRecord(path.join(directory, 'report.json'), report);
  console.log(JSON.stringify({ ...report, files: undefined, dbReadiness: undefined }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
