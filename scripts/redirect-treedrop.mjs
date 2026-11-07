import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, fingerprint, readToken } from './release-preserved-production.mjs';

export const SITE_ID = '9eb97780-a23e-423e-9bb6-282e1aadd160';
export const ACCOUNT_ID = '69800888d1a3d0483003ae9e';
export const BASELINE_ID = '6a89d2b2ceda1c578f9baa02';
export const MAIN_SITE_ID = 'aa62f324-b880-47d6-85b8-4ba0700ff5bf';
export const TARGET = 'https://tree-token.xyz/rewards/';
export const REDIRECT_TEXT = `/ ${TARGET} 301!\n/index.html ${TARGET} 301!\n`;
export const REDIRECT_SHA1 = crypto.createHash('sha1').update(REDIRECT_TEXT).digest('hex');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME_FIELDS = ['branch', 'context', 'functions_region', 'functions_region_overrides',
  'database_branch_id', 'blobs_region', 'framework', 'edge_functions_present', 'server', 'database_migrations'];
const IDENTITY_FIELDS = ['id', 'site_id', 'created_at', 'title', 'state', 'locked', ...RUNTIME_FIELDS,
  'available_functions', 'function_schedules'];
const eq = (a, b, label) => assert.equal(canonical(a), canonical(b), `${label} changed; stop.`);
const sorted = (rows, key) => [...rows].sort((a, b) => a[key].localeCompare(b[key]));
const validId = id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function retainedDeploy(deploy) {
  return Object.fromEntries(IDENTITY_FIELDS.filter(k => Object.hasOwn(deploy, k)).map(k => [k, deploy[k]]));
}
function runtime(deploy) {
  const result = Object.fromEntries(RUNTIME_FIELDS.filter(k => Object.hasOwn(deploy, k)).map(k => [k, deploy[k]]));
  if (result.functions_region_overrides) result.functions_region_overrides = sorted(result.functions_region_overrides, 'name');
  return result;
}
export function validateBackend(deploy) {
  assert.equal(deploy.site_id, SITE_ID); assert(validId(deploy.id));
  assert.equal(deploy.context, 'production'); assert.equal(deploy.functions_region, 'cmh');
  assert.equal(deploy.available_functions?.length, 2, 'Preserve both TreeDrop functions.');
  eq(deploy.available_functions.map(f => f.n).sort(), ['nftree-holder-snapshot', 'send-telegram-alert'], 'Function names');
  for (const f of deploy.available_functions) {
    assert(/^[a-f0-9]{64}$/.test(f.d), 'Missing original function package digest.');
    for (const key of ['id', 'oid', 'a', 'c', 'r', 'im', 's', 'bd', 'ro']) assert(f[key] != null, `Incomplete ${f.n} ${key}.`);
  }
  eq(deploy.function_schedules, [], 'Zero original schedules');
  assert(!deploy.edge_functions_present && !deploy.server, 'Unreviewed edge/server bundle.');
  assert(deploy.database_migrations == null || deploy.database_migrations.files?.length === 0, 'Unreviewed migrations.');
}
export function compareBackend(actual, original) {
  validateBackend(actual); validateBackend(original);
  const originals = new Map(original.available_functions.map(f => [f.n, f]));
  const normalized = actual.available_functions.map(f => {
    const expected = originals.get(f.n), copy = { ...f };
    // This historical deployment omitted defaults for the snapshot function.
    // Only a returned default equal to its verified cmh/1024MB setting may be
    // materialized. Provider IDs, runtime, invocation mode and routes stay exact.
    for (const [key, value] of Object.entries({ m: expected.m ?? 1024, mo: expected.mo ?? expected.m ?? 1024,
      rg: expected.rg ?? 'us-east-2', rgo: expected.rgo ?? expected.rg ?? 'us-east-2' })) {
      if (!Object.hasOwn(expected, key) && Object.hasOwn(copy, key) && copy[key] === value) delete copy[key];
    }
    return copy;
  });
  eq(sorted(normalized, 'n'), sorted(original.available_functions, 'n'), 'Complete TreeDrop package/provider records');
  eq(runtime(actual), runtime(original), 'TreeDrop runtime and region overrides');
}
export function functionsConfig(deploy) {
  validateBackend(deploy);
  const regions = new Set((deploy.functions_region_overrides || []).map(r => r.name));
  return Object.fromEntries(deploy.available_functions.map(f => {
    const config = {};
    for (const [from, to] of Object.entries({ dn: 'display_name', g: 'generator', bd: 'build_data', p: 'priority', tr: 'traffic_rules' })) {
      if (f[from] != null) config[to] = f[from];
    }
    if (Object.hasOwn(f, 'mo')) config.memory = f.mo;
    if (regions.has(f.n)) config.region = f.rgo ?? f.rg;
    config.routes = f.ro.map(r => Object.fromEntries(Object.entries({ pattern: r.p, literal: r.l,
      expression: r.e, methods: r.m, prefer_static: r.ps }).filter(([, v]) => v != null)));
    return [f.n, config];
  }));
}
export function redirectFiles(original) {
  assert(original && Object.keys(original).length === 7, 'Expected all seven original TreeDrop files.');
  assert(!Object.hasOwn(original, '/_redirects'), 'Existing redirect rules need separate review.');
  for (const [p, digest] of Object.entries(original)) assert(p.startsWith('/') && !p.includes('..') && /^[a-f0-9]{40}$/.test(digest), 'Invalid original static file.');
  return { ...original, '/_redirects': REDIRECT_SHA1 };
}
function apiClient(token) {
  return async (endpoint, method = 'GET', body) => {
    let response;
    try { response = await fetch('https://api.netlify.com/api/v1/' + endpoint, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: 'Bearer ' + token, ...(body != null ? { 'Content-Type': 'application/json' } : {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    }); } catch { throw Error(`Netlify ${method} failed; raw details withheld.`); }
    assert(response.ok, `Netlify ${method} failed (HTTP ${response.status}); raw details withheld.`);
    try { return await response.json(); } catch { throw Error('Invalid Netlify response; raw details withheld.'); }
  };
}
async function inventory(api, id) {
  const files = {};
  for (let page = 1; page <= 20; page++) {
    const rows = await api(`deploys/${id}/files?per_page=100&page=${page}`);
    assert(Array.isArray(rows), 'Invalid file inventory.');
    for (const row of rows) {
      assert(typeof row.path === 'string' && !Object.hasOwn(files, row.path) && /^[a-f0-9]{40}$/.test(row.sha), 'Invalid or duplicate inventory file.');
      files[row.path] = row.sha;
    }
    if (rows.length < 100) return files;
  }
  throw Error('Inventory exceeded bounded reader.');
}
async function environment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [local, shared] = await Promise.all([api(base + query), api(base)]);
  assert(Array.isArray(local) && Array.isArray(shared), 'Invalid environment inventory.');
  const settings = { ...site.build_settings }; delete settings.updated_at;
  return { siteSha256: fingerprint(sorted(local, 'key')), sharedSha256: fingerprint(sorted(shared, 'key')),
    siteEntries: local.length, sharedEntries: shared.length, buildSettingsSha256: fingerprint(settings),
    verification: 'API-visible values and identifiers only; masked secret bytes cannot be compared' };
}
function writeRecord(filename, data, exclusive = false) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const opts = { mode: 0o600, ...(exclusive ? { flag: 'wx' } : {}) };
  fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n', opts);
  fs.writeFileSync(filename + '.sha256', fingerprint(data) + '\n', opts);
}
function readRecord(filename) {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  assert.equal(fs.readFileSync(filename + '.sha256', 'utf8').trim(), fingerprint(data), 'Redirect record integrity failure.');
  return data;
}
function checkSource(plan) {
  assert.equal(git('rev-parse', 'HEAD'), plan.sourceCommit, 'Source commit changed.');
  assert.equal(git('branch', '--show-current'), plan.sourceBranch, 'Source branch changed.');
  assert.equal(git('diff', '--name-only', plan.sourceCommit, '--', 'scripts/redirect-treedrop.mjs'), '', 'Commit redirect script changes first.');
  git('cat-file', '-e', `${plan.sourceCommit}:scripts/redirect-treedrop.mjs`);
}
export async function verifyMainTarget(api, expectedMainId, fetchImpl = globalThis.fetch) {
  assert(validId(expectedMainId), 'Pin the verified main-site deployment with --expected-main-deploy ID.');
  const main = await api('sites/' + MAIN_SITE_ID);
  assert.equal(main.published_deploy?.id, expectedMainId, 'Main-site publication changed.');
  assert.equal(main.published_deploy.locked, true, 'Keep the new main-site release locked.');
  let response;
  try { response = await fetchImpl(TARGET, { redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw Error('Cannot verify the live NFTree Rewards destination.'); }
  assert.equal(response.status, 200, 'NFTree Rewards destination must return HTTP 200.');
  assert(response.headers.get('content-type')?.includes('text/html'), 'Destination is not an HTML page.');
  assert(/<title>[^<]*NFTree Rewards/i.test(await response.text()), 'Destination does not identify NFTree Rewards.');
  return { deployId: expectedMainId, url: TARGET, status: 200 };
}
async function assertCurrent(api, plan, requireLock) {
  const site = await api('sites/' + SITE_ID);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, BASELINE_ID, 'TreeDrop changed; stop and review.');
  const deploy = await api('deploys/' + BASELINE_ID);
  assert.equal(deploy.state, 'ready');
  if (requireLock) assert.equal(deploy.locked, true, 'TreeDrop must stay locked during release.');
  compareBackend(deploy, plan.baseline);
  eq(await inventory(api, BASELINE_ID), plan.originalFiles, 'Original TreeDrop files');
  eq(await environment(api, site), plan.environment, 'TreeDrop protected configuration');
  return { site, deploy };
}
export function assertFreshCandidate(state, plan, deploy) {
  assert.equal(state.schemaVersion, 1); assert.equal(state.siteId, SITE_ID);
  assert(validId(state.id) && state.id !== BASELINE_ID, 'Only the new redirect candidate may be published.');
  assert.equal(state.planSha256, fingerprint(plan)); assert.equal(state.sourceCommit, plan.sourceCommit);
  assert.equal(deploy.id, state.id); assert.equal(deploy.site_id, SITE_ID); assert.equal(deploy.title, plan.title);
  assert.equal(deploy.created_at, state.createdAt);
  assert(Date.parse(deploy.created_at) >= Date.parse(state.requestStartedAt) - 10000, 'Refusing an older redirect deployment.');
  assert(Date.parse(deploy.created_at) > Date.parse(plan.baseline.created_at), 'Candidate predates the baseline.');
}
export async function verifyRedirects(baseUrl, fetchImpl = globalThis.fetch) {
  for (const pathname of ['/', '/index.html', '/?treedrop_probe=1']) {
    const response = await fetchImpl(new URL(pathname, baseUrl), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 301, 'Expected permanent redirect for ' + pathname);
    const expected = TARGET + (pathname.includes('?') ? '?treedrop_probe=1' : '');
    assert.equal(response.headers.get('location'), expected, 'Unexpected redirect destination or lost query.');
  }
}
async function verifyCandidate(api, plan, state) {
  await assertCurrent(api, plan, true); await verifyMainTarget(api, plan.mainDeployId);
  const deploy = await api('deploys/' + state.id);
  assertFreshCandidate(state, plan, deploy); assert.equal(deploy.state, 'ready');
  assert(!deploy.published_at, 'Redirect candidate already published; inspect its release record.');
  compareBackend(deploy, plan.baseline);
  eq(await inventory(api, state.id), plan.files, 'Redirect candidate static inventory');
  await verifyRedirects(`https://${state.id}--nftgiftbag.netlify.app`);
  await assertCurrent(api, plan, true);
  return deploy;
}

export async function main(args = process.argv.slice(2)) {
  const { positionals, values } = parseArgs({ args, strict: true, allowPositionals: true, options: {
    'expected-baseline': { type: 'string' }, 'expected-main-deploy': { type: 'string' },
    'expected-candidate': { type: 'string' }, plan: { type: 'string', default: '.netlify/treedrop-redirect-plan.json' },
    state: { type: 'string', default: '.netlify/treedrop-redirect-candidate.json' },
  } });
  const mode = positionals[0];
  assert(positionals.length === 1 && ['plan', 'preview', 'verify', 'publish'].includes(mode),
    'Usage: redirect-treedrop.mjs plan|preview|verify|publish --expected-baseline ID [--expected-main-deploy ID] [--expected-candidate ID]');
  assert.equal(values['expected-baseline'], BASELINE_ID, 'Specify the reviewed TreeDrop baseline ID explicitly.');
  const planFile = path.resolve(ROOT, values.plan), stateFile = path.resolve(ROOT, values.state);
  const token = readToken(), api = apiClient(token);
  let plan, state, deploy;
  if (mode === 'plan') {
    assert(!fs.existsSync(planFile), 'Plan already exists; use a new filename.');
    const site = await api('sites/' + SITE_ID);
    assert.equal(site.account_id, ACCOUNT_ID); assert.equal(site.published_deploy?.id, BASELINE_ID);
    const baseline = await api('deploys/' + BASELINE_ID); validateBackend(baseline); assert.equal(baseline.state, 'ready');
    const originalFiles = await inventory(api, BASELINE_ID), files = redirectFiles(originalFiles);
    plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: BASELINE_ID,
      baseline: retainedDeploy(baseline), originalFiles, files, environment: await environment(api, site),
      mainDeployId: values['expected-main-deploy'], sourceCommit: git('rev-parse', 'HEAD'), sourceBranch: git('branch', '--show-current'),
      createdAt: new Date().toISOString(), title: `TreeDrop rewards entry redirect ${git('rev-parse', '--short=12', 'HEAD')}` };
    checkSource(plan); await verifyMainTarget(api, plan.mainDeployId); await assertCurrent(api, plan, false);
    writeRecord(planFile, plan, true);
  } else {
    plan = readRecord(planFile); assert.equal(plan.siteId, SITE_ID); assert.equal(plan.baselineId, BASELINE_ID);
    checkSource(plan); eq(plan.files, redirectFiles(plan.originalFiles), 'Only the two exact entry redirects may be added');
    if (values['expected-main-deploy']) assert.equal(values['expected-main-deploy'], plan.mainDeployId);
    await verifyMainTarget(api, plan.mainDeployId); await assertCurrent(api, plan, mode !== 'preview');
  }
  if (mode === 'preview') {
    assert(!fs.existsSync(stateFile), 'Candidate state exists; verify it or select a new filename.');
    let { deploy: current } = await assertCurrent(api, plan, false);
    if (current.locked !== true) {
      // Lock only the CURRENT deploy before creating anything: no content change.
      await api(`deploys/${BASELINE_ID}/lock`, 'POST');
      for (let i = 0; i < 30; i++) {
        current = await api('deploys/' + BASELINE_ID); if (current.locked === true) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    await assertCurrent(api, plan, true);
    const requestStartedAt = new Date().toISOString();
    deploy = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(plan.title)}`, 'POST', {
      files: plan.files, functions: Object.fromEntries(plan.baseline.available_functions.map(f => [f.n, f.d])),
      functions_config: functionsConfig(plan.baseline), function_schedules: [],
      draft: false, async: false, branch: plan.baseline.branch, framework: plan.baseline.framework,
    });
    state = { schemaVersion: 1, siteId: SITE_ID, id: deploy.id, planSha256: fingerprint(plan),
      sourceCommit: plan.sourceCommit, requestStartedAt, createdAt: deploy.created_at, verifiedAt: null };
    writeRecord(stateFile, state, true); assertFreshCandidate(state, plan, deploy);
    for (const k of ['required_functions', 'required_edge_functions', 'required_server']) assert(!deploy[k]?.length, 'Refuse backend upload.');
    assert((deploy.required || []).every(sha => sha === REDIRECT_SHA1), 'Refuse any original-file upload.');
    if (deploy.required?.length) {
      let response;
      try { response = await fetch(`https://api.netlify.com/api/v1/deploys/${state.id}/files/_redirects`, {
        method: 'PUT', redirect: 'error', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' },
        body: REDIRECT_TEXT, signal: AbortSignal.timeout(30000),
      }); } catch { throw Error('Redirect upload failed; raw details withheld.'); }
      assert(response.ok, `Redirect upload failed HTTP ${response.status}.`);
    }
    for (let i = 0; i < 90; i++) {
      deploy = await api('deploys/' + state.id); if (deploy.state === 'ready') break;
      assert(!['error', 'canceled', 'rejected'].includes(deploy.state), 'Redirect deploy failed.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else if (mode !== 'plan') state = readRecord(stateFile);
  if (state) {
    if (values['expected-candidate']) assert.equal(state.id, values['expected-candidate']);
    deploy = await verifyCandidate(api, plan, state);
    if (mode === 'publish') {
      assert.equal(values['expected-candidate'], state.id, 'Publish requires explicit reviewed candidate ID.');
      assert(state.verifiedAt, 'Verify the redirect candidate before publication.');
      assert.equal(git('ls-remote', '--heads', 'origin', `refs/heads/${plan.sourceBranch}`).split(/\s+/)[0], plan.sourceCommit, 'Push exact redirect source first.');
      checkSource(plan); await verifyMainTarget(api, plan.mainDeployId); await assertCurrent(api, plan, true);
      // A new verified candidate is published+locked through lock, never restore.
      await api(`deploys/${state.id}/lock`, 'POST');
      for (let i = 0; i < 60; i++) {
        const site = await api('sites/' + SITE_ID);
        if (site.published_deploy?.id === state.id && site.published_deploy.locked === true) break;
        assert([BASELINE_ID, state.id].includes(site.published_deploy?.id), 'Concurrent TreeDrop publication.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const site = await api('sites/' + SITE_ID);
      assert.equal(site.published_deploy?.id, state.id); assert.equal(site.published_deploy.locked, true);
      deploy = await api('deploys/' + state.id); compareBackend(deploy, plan.baseline);
      eq(await inventory(api, state.id), plan.files, 'Published TreeDrop files');
      eq(await environment(api, site), plan.environment, 'Published TreeDrop configuration');
      await verifyRedirects('https://www.treedrop.xyz');
      state.publishedAt = new Date().toISOString();
    }
    state.verifiedAt = new Date().toISOString(); writeRecord(stateFile, state);
  }
  const report = { mode, result: 'passed', checkedAt: new Date().toISOString(), siteId: SITE_ID,
    baselineId: BASELINE_ID, candidateId: state?.id || null, mainDeployId: plan.mainDeployId,
    sourceCommit: plan.sourceCommit, originalFilesPreserved: 7, functionsPreserved: 2, schedulesPreserved: 0,
    addedPath: '/_redirects', redirectSha1: REDIRECT_SHA1, destination: TARGET, productionChanged: mode === 'publish' };
  writeRecord(path.join(ROOT, '.netlify/treedrop-redirect-report.json'), report);
  console.log(JSON.stringify(report, null, 2)); return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
