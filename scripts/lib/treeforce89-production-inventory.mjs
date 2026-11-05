import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Maintenance only: no remote mutation, function rebuild, or publication mode.
export const SITE_ID = 'aa62f324-b880-47d6-85b8-4ba0700ff5bf';
export const ACCOUNT_ID = '69800888d1a3d0483003ae9e';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_BASELINE = path.join(ROOT, '.netlify/preservation-baseline-v2.json');
const RUNTIME_FIELDS = ['functions_region', 'functions_region_overrides', 'branch', 'context',
  'database_branch_id', 'blobs_region', 'framework', 'edge_functions_present', 'server', 'database_migrations'];
const BINDING = 'TREEFORCE89_DEV_DATABASE_URL';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export const fingerprint = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const same = (actual, expected, label) => check(canonical(actual) === canonical(expected), label + ' changed; stop.');
const pick = (object, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(object, key)).map(key => [key, object[key]]));

export function validateFunctions(functions) {
  check(Array.isArray(functions) && functions.length === 43, 'Expected all 43 function records.');
  check(new Set(functions.map(fn => fn.n)).size === 43, 'Duplicate function names.');
  for (const fn of functions) {
    check(typeof fn.n === 'string' && /^[a-z0-9-]+$/.test(fn.n), 'Invalid function name.');
    check(typeof fn.d === 'string' && /^[a-f0-9]{64}$/.test(fn.d), 'Missing function package SHA256.');
    for (const field of ['id', 'oid', 'a', 'c', 'r', 'rg', 'm', 'im', 's', 'bd']) {
      check(Object.hasOwn(fn, field) && fn[field] !== null, 'Incomplete function provider/runtime record.');
    }
  }
}

function validateSchedules(schedules, functions) {
  check(Array.isArray(schedules) && schedules.length === 5, 'Expected all five schedules.');
  check(new Set(schedules.map(item => item.name)).size === 5, 'Duplicate schedules.');
  for (const item of schedules) {
    check(functions.some(fn => fn.n === item.name) && typeof item.cron === 'string' && item.cron.length > 0,
      'Schedule has no function or cron expression.');
  }
}

export function runtimeFor(deploy) {
  check(deploy.site_id === SITE_ID && /^[a-f0-9]{24}$/.test(deploy.id), 'Unexpected deployment identity.');
  check(deploy.state === 'ready' && deploy.locked === true, 'Production must be ready and locked.');
  check(deploy.context === 'production', 'Expected production deploy context.');
  check(!deploy.edge_functions_present && !deploy.server, 'Edge/server bundles require separate review.');
  const migrations = deploy.database_migrations;
  check(migrations === null || migrations === undefined ||
    (Array.isArray(migrations.files) && migrations.files.length === 0), 'Database migrations require separate review.');
  return pick(deploy, RUNTIME_FIELDS);
}

export function filesFromRows(rows) {
  const files = {};
  for (const row of rows) {
    check(typeof row.path === 'string' && row.path.startsWith('/') && !Object.hasOwn(files, row.path),
      'Invalid or duplicate static file path.');
    check(typeof row.sha === 'string' && /^[a-f0-9]{40}$/.test(row.sha), 'Invalid static file SHA1.');
    files[row.path] = row.sha;
  }
  check(Object.keys(files).length > 0, 'Static file inventory is empty.');
  return files;
}

function environmentRows(rows) {
  check(Array.isArray(rows) && rows.every(row => typeof row.key === 'string' && Array.isArray(row.scopes) && Array.isArray(row.values)),
    'Invalid environment inventory.');
  check(new Set(rows.map(row => row.key)).size === rows.length, 'Duplicate environment keys.');
  return [...rows].sort((a, b) => a.key.localeCompare(b.key, 'en'));
}

export function environmentFor({ site, siteFunctions, shared, sharedFunctions, buildSettings }) {
  site = environmentRows(site);
  siteFunctions = environmentRows(siteFunctions);
  shared = environmentRows(shared);
  sharedFunctions = environmentRows(sharedFunctions);
  same(siteFunctions, site.filter(row => row.scopes.includes('functions')), 'Filtered site environment');
  same(sharedFunctions, shared.filter(row => row.scopes.includes('functions')), 'Filtered shared environment');
  const binding = siteFunctions.find(row => row.key === BINDING);
  check(binding?.is_secret === true && canonical(binding.scopes) === canonical(['functions']) &&
    binding.values.length === 1 && binding.values[0].context === 'production' &&
    !binding.values[0].context_parameter && typeof binding.values[0].id === 'string',
    'The persistent production TREE FORCE database binding is missing or changed.');
  const summarize = rows => ({ entries: rows.length, sha256: fingerprint(rows) });
  return {
    site: summarize(site), siteFunctions: summarize(siteFunctions),
    shared: summarize(shared), sharedFunctions: summarize(sharedFunctions),
    // Netlify advances this audit timestamp on repository events even when no
    // build/deployment occurs. Preserve every setting and its field presence.
    buildSettingsSha256: fingerprint(Object.fromEntries(Object.entries(buildSettings)
      .filter(([key]) => key !== 'updated_at'))),
    buildSettingsFieldsSha256: Object.fromEntries(Object.entries(buildSettings)
      .filter(([key]) => key !== 'updated_at').map(([key, value]) => [key, fingerprint(value)])),
    requiredBinding: {
      key: BINDING, isSecret: true, scopes: ['functions'],
      context: 'production', valueId: binding.values[0].id,
    },
    // Netlify masks production secret values. Hashes cover only returned records.
    secretValueVerification: 'API-visible records and value IDs only; masked secret bytes are not readable',
    deployOverrideVerification: 'Deploy-specific overrides are not exposed by these GET endpoints',
  };
}

export function validateSnapshot(snapshot) {
  check(snapshot.schemaVersion === 2 && snapshot.siteId === SITE_ID && snapshot.accountId === ACCOUNT_ID,
    'Wrong baseline schema, site, or account.');
  check(/^[a-f0-9]{24}$/.test(snapshot.deployId), 'Invalid baseline deployment ID.');
  validateFunctions(snapshot.functions);
  validateSchedules(snapshot.schedules, snapshot.functions);
  check(snapshot.runtime?.context === 'production', 'Missing production runtime configuration.');
  check(snapshot.environment?.requiredBinding?.key === BINDING && snapshot.environment.siteFunctions.entries > 0,
    'Missing protected environment evidence.');
  filesFromRows(Object.entries(snapshot.files).map(([filePath, sha]) => ({ path: filePath, sha })));
}

export function assertPreserved(actual, expected) {
  validateSnapshot(expected);
  validateSnapshot(actual);
  for (const field of ['siteId', 'accountId', 'deployId', 'functions', 'schedules', 'runtime', 'files', 'environment']) {
    same(actual[field], expected[field], field);
  }
}

export function readToken(env = process.env) {
  check(!env.DEBUG && !env.NODE_DEBUG, 'Unset debug logging before inventory.');
  check(typeof env.NETLIFY_AUTH_TOKEN === 'string' && env.NETLIFY_AUTH_TOKEN.length > 0,
    'Missing NETLIFY_AUTH_TOKEN.');
  return env.NETLIFY_AUTH_TOKEN;
}

export function readOnlyApi(token, fetchImpl = globalThis.fetch) {
  return async endpoint => {
    check(typeof token === 'string' && token.length > 0, 'Missing Netlify credential.');
    check(typeof endpoint === 'string' && !endpoint.startsWith('/') && !endpoint.includes('..') &&
      /^(sites|deploys|accounts)\/[a-f0-9-]+(?:\/(?:files|env))?(?:\?[^#]*)?$/.test(endpoint), 'Invalid inventory endpoint.');
    let response;
    try {
      response = await fetchImpl('https://api.netlify.com/api/v1/' + endpoint, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
    } catch {
      throw new Error('Netlify inventory GET failed; raw details withheld.');
    }
    check(response.ok, 'Netlify inventory GET failed (HTTP ' + response.status + '); raw details withheld.');
    try { return await response.json(); }
    catch { throw new Error('Invalid Netlify inventory JSON; raw details withheld.'); }
  };
}

async function inventory(api, deployId) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api(`deploys/${deployId}/files?per_page=100&page=${page}`);
    check(Array.isArray(batch), 'Invalid static inventory response.');
    rows.push(...batch);
    if (batch.length < 100) return filesFromRows(rows);
  }
  throw new Error('Static inventory exceeds the bounded reader.');
}

async function environment(api, site) {
  const base = 'accounts/' + ACCOUNT_ID + '/env';
  const query = '?site_id=' + SITE_ID;
  const [allSite, siteFunctions, shared, sharedFunctions] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'),
  ]);
  return environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings });
}

export async function captureCurrent(api, expectedDeployId) {
  check(typeof expectedDeployId === 'string' && /^[a-f0-9]{24}$/.test(expectedDeployId), 'An explicit expected deployment ID is required.');
  const site = await api('sites/' + SITE_ID);
  check(site.id === SITE_ID && site.account_id === ACCOUNT_ID, 'Unexpected production site/account.');
  check(site.published_deploy?.id === expectedDeployId, 'Published deployment changed; stop.');
  const deploy = await api('deploys/' + expectedDeployId);
  validateFunctions(deploy.available_functions);
  validateSchedules(deploy.function_schedules, deploy.available_functions);
  const runtime = runtimeFor(deploy);
  check(deploy.id === expectedDeployId, 'Wrong deployment returned.');
  const [files, protectedEnvironment] = await Promise.all([inventory(api, expectedDeployId), environment(api, site)]);
  const snapshot = {
    schemaVersion: 2, capturedAt: new Date().toISOString(), siteId: SITE_ID, accountId: ACCOUNT_ID,
    deployId: expectedDeployId, functions: deploy.available_functions, schedules: deploy.function_schedules,
    runtime, files, environment: protectedEnvironment,
    observations: { buildSettingsUpdatedAt: site.build_settings.updated_at ?? null },
  };
  validateSnapshot(snapshot);
  // Recheck both publication and mutable configuration at the end of the read.
  const endSite = await api('sites/' + SITE_ID);
  check(endSite.id === SITE_ID && endSite.account_id === ACCOUNT_ID &&
    endSite.published_deploy?.id === expectedDeployId && endSite.published_deploy.locked === true,
    'Publication or lock changed during inventory; stop.');
  const endDeploy = await api('deploys/' + expectedDeployId);
  same(endDeploy.available_functions, snapshot.functions, 'Function records during inventory');
  same(endDeploy.function_schedules, snapshot.schedules, 'Schedules during inventory');
  same(runtimeFor(endDeploy), snapshot.runtime, 'Runtime during inventory');
  same(await environment(api, endSite), snapshot.environment, 'Environment during inventory');
  return snapshot;
}

export function saveBaseline(filename, snapshot) {
  validateSnapshot(snapshot);
  check(!fs.existsSync(filename) && !fs.existsSync(filename + '.sha256'), 'Baseline already exists; choose a new reviewed filename.');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(filename + '.sha256', fingerprint(snapshot) + '\n', { flag: 'wx', mode: 0o600 });
}

export function loadBaseline(filename) {
  const baseline = JSON.parse(fs.readFileSync(filename, 'utf8'));
  check(fingerprint(baseline) === fs.readFileSync(filename + '.sha256', 'utf8').trim(), 'Baseline integrity check failed.');
  validateSnapshot(baseline);
  return baseline;
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    baseline: { type: 'string', default: DEFAULT_BASELINE },
    'expected-deploy': { type: 'string' }, report: { type: 'string' },
  } });
  const mode = positionals[0] || 'verify';
  check(positionals.length <= 1 && ['capture', 'verify'].includes(mode),
    'Read-only usage: capture --expected-deploy ID [--baseline FILE] | verify [--baseline FILE] [--report FILE]. Publication modes are disabled.');
  const filename = path.resolve(values.baseline);
  const baseline = mode === 'verify' ? loadBaseline(filename) : undefined;
  const expectedDeploy = mode === 'capture' ? values['expected-deploy'] : baseline.deployId;
  if (mode === 'verify' && values['expected-deploy']) same(values['expected-deploy'], baseline.deployId, 'Expected baseline deployment');
  if (mode === 'capture') {
    check(!fs.existsSync(filename) && !fs.existsSync(filename + '.sha256'), 'Baseline already exists; refusing to replace it.');
    check(expectedDeploy, 'Capture requires --expected-deploy ID.');
  }
  const snapshot = await captureCurrent(readOnlyApi(readToken()), expectedDeploy);
  if (mode === 'capture') saveBaseline(filename, snapshot);
  else assertPreserved(snapshot, baseline);
  const report = {
    mode, result: 'passed', checkedAt: new Date().toISOString(), deployId: snapshot.deployId,
    baselineSha256: fingerprint(baseline || snapshot), functions: snapshot.functions.length,
    schedules: snapshot.schedules.length, staticFiles: Object.keys(snapshot.files).length,
    completeFunctionRecordsMatch: true, runtimeMatch: true, environmentRecordsMatch: true,
    siteFunctionEnvironmentEntries: snapshot.environment.siteFunctions.entries,
    locked: true, remoteMethods: ['GET'], productionChanged: false,
    limitations: [snapshot.environment.secretValueVerification, snapshot.environment.deployOverrideVerification],
  };
  if (values.report) {
    const reportPath = path.resolve(values.report);
    check(reportPath !== filename && reportPath !== filename + '.sha256', 'Report must not overwrite the baseline.');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

