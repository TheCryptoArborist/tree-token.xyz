import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, fingerprint, readToken, environmentFor } from './release-preserved-production.mjs';

// A frontend-only, fix-forward release. Existing backend packages are reused by
// digest; this script never uploads a function, changes an environment variable,
// unlocks a deploy, or accepts an arbitrary older deployment for publication.
export const SITE_ID = 'aa62f324-b880-47d6-85b8-4ba0700ff5bf';
export const ACCOUNT_ID = '69800888d1a3d0483003ae9e';
export const BASELINE_ID = process.env.ROOTCASTER_EXPECTED_DEPLOY || '6af2269339c88800be3ea322';
export const ORIGINAL_CHANGES = [];
// Historical orphaned API deploys individually audited on 2026-11-10.
// These are not builds: all have null build_id/published_at and unchanged,
// months-old states. Any new, changed, or genuinely queued deploy still blocks.
export const AUDITED_STALE_DEPLOYS = new Map([["6ac52820279f7eb4a8d2457f","prepared","2026-10-06T16:56:00.762Z","2026-10-06T16:56:01.973Z","branch-deploy",null],["6ac527e17cf112fbffd1d846","prepared","2026-10-06T16:54:57.216Z","2026-10-06T16:54:57.618Z","branch-deploy",null],["6ac5279f64ded4fdb3ab3beb","uploading","2026-10-06T16:53:51.055Z","2026-10-06T16:53:51.539Z","deploy-preview",null],["6ac52772cdbea704934a7104","uploading","2026-10-06T16:53:06.576Z","2026-10-06T16:53:07.286Z","branch-deploy","12d07ac0db1f50521043cd71bdb5032f93306336"],["6ac51f782d2f32b1d81cc2ee","uploading","2026-10-06T16:19:04.294Z","2026-10-06T16:19:05.810Z","branch-deploy",null],["6ac51ee343f065a97870c8c1","uploading","2026-10-06T16:16:35.120Z","2026-10-06T16:16:35.721Z","deploy-preview",null],["6aaef0c3bef6988a2854e692","uploading","2026-09-19T20:29:55.569Z","2026-09-19T20:30:44.597Z","branch-deploy",null],["6aaa1e51ab04ece07223c51a","uploading","2026-09-16T04:42:57.276Z","2026-09-16T04:42:57.695Z","deploy-preview",null],["6a88c1e0f4f19fa43716b98e","new","2026-08-21T21:23:44.980Z","2026-08-21T21:23:44.980Z","deploy-preview",null],["6a862cb81463fc03bfff46fa","new","2026-08-19T22:22:48.312Z","2026-08-19T22:22:48.312Z","deploy-preview",null]]);
export function isAuditedInactiveDeploy(deploy) {
  const expected = AUDITED_STALE_DEPLOYS.get(deploy?.id);
  if (!expected || deploy.site_id !== SITE_ID || deploy.build_id != null ||
      deploy.published_at != null || deploy.locked === true) return false;
  return [deploy.state, deploy.created_at, deploy.updated_at, deploy.context,
    deploy.commit_ref ?? null].every((value, i) => value === expected[i + 1]);
}

export const ROOTCASTER_PATHS = ['/rootcaster/index.html', '/rootcaster/rootcaster.css', '/rootcaster/whisperleaf-watch.webp'];
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME_FIELDS = ['branch', 'context', 'functions_region', 'functions_region_overrides',
  'database_branch_id', 'blobs_region', 'framework', 'edge_functions_present', 'server', 'database_migrations'];
const SOURCE_PATHS = ['rootcaster', 'scripts/release-rootcaster.mjs'];
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const eq = (a, b, label) => assert(canonical(a) === canonical(b), `${label} changed; stop.`);
const sortBy = (rows, field) => [...rows].sort((a, b) => a[field].localeCompare(b[field]));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const safeId = id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
const validPath = pathname => typeof pathname === 'string' && /^\/[A-Za-z0-9_./@-]+$/.test(pathname) &&
  !pathname.split('/').some(part => part === '..' || part === '.');

export function publicUploadPath(pathname) {
  assert(validPath(pathname), 'Invalid public upload path.');
  // Netlify's deployed-file inventory canonicalizes paths to lowercase. Keep
  // local filenames intact, but plan and upload using the hosted identity.
  return pathname.toLowerCase();
}

export function fileInventory(rows) {
  assert(Array.isArray(rows), 'Expected static inventory rows.');
  const files = {};
  for (const row of rows) {
    assert(validPath(row.path) && !Object.hasOwn(files, row.path), 'Invalid or duplicate static path.');
    assert(/^[a-f0-9]{40}$/.test(row.sha), 'Invalid static SHA1.');
    files[row.path] = row.sha;
  }
  assert(Object.keys(files).length, 'Empty static inventory.');
  return files;
}

function runtime(deploy) {
  const result = Object.fromEntries(RUNTIME_FIELDS.filter(k => Object.hasOwn(deploy, k)).map(k => [k, deploy[k]]));
  if (result.functions_region_overrides) result.functions_region_overrides = sortBy(result.functions_region_overrides, 'name');
  return result;
}

export function validateBackend(deploy) {
  assert.equal(deploy.site_id, SITE_ID, 'Wrong deployment site.');
  assert(safeId(deploy.id), 'Invalid deployment ID.');
  assert.equal(deploy.available_functions?.length, 46, 'Expected all 46 current function packages.');
  assert.equal(new Set(deploy.available_functions.map(f => f.n)).size, 46, 'Duplicate function names.');
  for (const f of deploy.available_functions) {
    assert(/^[a-z0-9-]+$/.test(f.n) && /^[a-f0-9]{64}$/.test(f.d), 'Invalid function name or digest.');
    for (const key of ['id', 'oid', 'a', 'c', 'r', 'rg', 'm', 'im', 's', 'bd']) {
      assert(f[key] != null, `Incomplete ${f.n} provider/runtime field ${key}.`);
    }
  }
  assert.equal(deploy.function_schedules?.length, 5, 'Expected five schedules.');
  assert.equal(new Set(deploy.function_schedules.map(s => s.name)).size, 5, 'Duplicate schedules.');
  for (const s of deploy.function_schedules) assert(deploy.available_functions.some(f => f.n === s.name) && s.cron, 'Invalid schedule.');
  assert.equal(deploy.context, 'production', 'Expected the existing production environment context.');
  assert.equal(deploy.functions_region, 'cmh', 'Unexpected function region.');
  assert(!deploy.edge_functions_present && !deploy.server, 'Unreviewed edge/server bundle.');
  assert(deploy.database_migrations == null || deploy.database_migrations.files?.length === 0, 'Unreviewed database migration.');
}

export function compareBackend(actual, expected) {
  validateBackend(actual); validateBackend(expected);
  const expectedByName = new Map(expected.available_functions.map(f => [f.n, f]));
  const normalized = actual.available_functions.map(f => {
    const original = expectedByName.get(f.n);
    assert(original, 'Unexpected function.');
    const copy = { ...f };
    // The API may materialize an omitted override equal to its already-recorded
    // effective setting. No runtime, provider identity, route, traffic rule,
    // package digest, or unknown field is omitted from the comparison.
    for (const [override, effective] of [['mo', 'm'], ['rgo', 'rg']]) {
      if (!Object.hasOwn(original, override) && Object.hasOwn(copy, override) && copy[override] === original[effective]) delete copy[override];
    }
    return copy;
  });
  eq(sortBy(normalized, 'n'), sortBy(expected.available_functions, 'n'), 'Complete function provider/runtime records');
  eq(sortBy(actual.function_schedules, 'name'), sortBy(expected.function_schedules, 'name'), 'All schedules');
  eq(runtime(actual), runtime(expected), 'Deployment runtime and explicit region overrides');
}

export function validateBaseline(baseline) {
  assert.equal(baseline.site?.id, SITE_ID); assert.equal(baseline.site?.account_id, ACCOUNT_ID);
  assert(safeId(BASELINE_ID), 'Expected deployment ID must be 24 lowercase hex characters.');
  assert.equal(baseline.deploy?.id, BASELINE_ID, 'This release requires the newly captured current baseline.');
  assert.equal(baseline.deploy.state, 'ready'); assert.equal(baseline.deploy.locked, true);
  validateBackend(baseline.deploy);
  const files = fileInventory(baseline.files);
  assert(Object.keys(files).length >= 359, 'Incomplete current live baseline.');
  return files;
}

export function functionsConfig(deploy) {
  validateBackend(deploy);
  const overrides = new Set((deploy.functions_region_overrides || []).map(row => row.name));
  return Object.fromEntries(deploy.available_functions.map(f => {
    const config = {};
    for (const [from, to] of Object.entries({ dn: 'display_name', g: 'generator', bd: 'build_data', p: 'priority', tr: 'traffic_rules' })) {
      if (f[from] != null) config[to] = f[from];
    }
    // Keep explicit overrides explicit, and leave the inherited defaults alone.
    if (Object.hasOwn(f, 'mo')) config.memory = f.mo;
    if (overrides.has(f.n)) config.region = f.rgo ?? f.rg;
    if (f.ro) config.routes = f.ro.map(r => Object.fromEntries(Object.entries({
      pattern: r.p, literal: r.l, expression: r.e, methods: r.m, prefer_static: r.ps,
    }).filter(([, v]) => v != null)));
    // functionConfig has no runtime/invocation-mode property in Netlify's
    // official OpenAPI schema. Exact package reuse + post-create r/im checks
    // preserve those fields rather than submitting unsupported settings.
    return [f.n, config];
  }));
}

export function assembleFiles(baselineFiles, overlays) {
  const files = { ...baselineFiles }, sources = {};
  for (const item of overlays) {
    const publicPath = publicUploadPath(item.path);
    assert(/^[a-f0-9]{40}$/.test(item.sha1), 'Invalid overlay.');
    assert(!Object.hasOwn(sources, publicPath), 'Duplicate or case-colliding public overlay.');
    if (Object.hasOwn(baselineFiles, publicPath) && baselineFiles[publicPath] !== item.sha1) assert(ORIGINAL_CHANGES.includes(publicPath), 'Unapproved existing-file replacement: ' + publicPath);
    else assert(ROOTCASTER_PATHS.includes(publicPath), 'Unapproved new public path.');
    files[publicPath] = item.sha1; sources[publicPath] = item.source;
  }
  const changedOriginals = Object.keys(baselineFiles).filter(p => files[p] !== baselineFiles[p]).sort();
  eq(changedOriginals, [...ORIGINAL_CHANGES].sort(), 'Only approved original files must change');
  assert(files['/index.html'], 'Missing rewards entry.');
  assert(Object.keys(baselineFiles).every(p => Object.hasOwn(files, p)), 'Baseline path removed.');
  eq(Object.keys(sources).sort(), [...ROOTCASTER_PATHS].sort(), 'Unexpected gallery overlays');
  assert(ROOTCASTER_PATHS.every(p => !Object.hasOwn(baselineFiles,p)), 'Gallery path already exists; stop for review.');
  return { files, sources, changedOriginals, addedPaths: Object.keys(files).filter(p => !Object.hasOwn(baselineFiles, p)).sort() };
}

function overlayFiles() {
  return ROOTCASTER_PATHS.map(publicPath => {
    const local = publicPath.slice(1), filename = path.join(ROOT, local);
    assert(!fs.lstatSync(filename).isSymbolicLink(), 'Symlink refused.');
    const bytes = fs.readFileSync(filename);
    return {path: publicPath, source: local, sha1: sha1(bytes), size: bytes.length};
  });
}

function assertSource(commit, branch) {
  assert(/^[a-f0-9]{40}$/.test(commit), 'Pin an exact committed source SHA.');
  assert.equal(git('rev-parse', 'HEAD'), commit, 'HEAD changed after release planning.');
  assert.equal(git('branch', '--show-current'), branch, 'Source branch changed.');
  assert(branch && branch !== 'HEAD', 'Use a named source branch.');
  assert.equal(git('diff', '--name-only', commit, '--', ...SOURCE_PATHS), '', 'Release source has uncommitted changes.');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHS), '', 'Commit all release source files first.');
  for (const p of SOURCE_PATHS) git('cat-file', '-e', `${commit}:${p}`);
}

function writeRecord(filename, value, exclusive = false) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const options = { mode: 0o600, ...(exclusive ? { flag: 'wx' } : {}) };
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', options);
  fs.writeFileSync(filename + '.sha256', fingerprint(value) + '\n', options);
}
function readRecord(filename) {
  const value = read(filename);
  assert.equal(fs.readFileSync(filename + '.sha256', 'utf8').trim(), fingerprint(value), 'Local release record integrity failed.');
  return value;
}

function apiClient(token) {
  return async (endpoint, method = 'GET', body) => {
    let response;
    try {
      response = await fetch('https://api.netlify.com/api/v1/' + endpoint, {
        method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: 'Bearer ' + token, ...(body != null ? { 'Content-Type': 'application/json' } : {}) },
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch { throw Error(`Netlify ${method} request failed; raw details withheld.`); }
    assert(response.ok, `Netlify ${method} failed (HTTP ${response.status}); raw details withheld.`);
    try { return await response.json(); } catch { throw Error('Invalid Netlify response; raw details withheld.'); }
  };
}
async function inventory(api, id) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api(`deploys/${id}/files?per_page=100&page=${page}`);
    assert(Array.isArray(batch), 'Invalid file inventory.'); rows.push(...batch);
    if (batch.length < 100) return fileInventory(rows);
  }
  throw Error('File inventory exceeded bounded reader.');
}
async function protectedEnvironment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [allSite, siteFunctions, shared, sharedFunctions] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'),
  ]);
  return environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings });
}
async function assertLiveBaseline(api, baseline, plan) {
  const site = await api('sites/' + SITE_ID);
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, BASELINE_ID, 'Production changed; capture and review a new release.');
  assert.equal(site.published_deploy.locked, true, 'Production lock changed.');
  const deploy = await api('deploys/' + BASELINE_ID);
  assert.equal(deploy.locked, true); assert.equal(deploy.state, 'ready');
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, BASELINE_ID), validateBaseline(baseline), 'Current baseline static files');
  const settings = { ...site.build_settings }; delete settings.updated_at;
  const original = { ...baseline.site.build_settings }; delete original.updated_at;
  eq(settings, original, 'Site build settings');
  if (plan) eq(await protectedEnvironment(api, site), plan.environment, 'Protected API-visible environment');
  return { site, deploy };
}

export function assertNewCandidate(state, plan, deploy) {
  assert.equal(state.schemaVersion, 1); assert.equal(state.siteId, SITE_ID);
  assert(safeId(state.id) && state.id !== BASELINE_ID, 'Only this newly created candidate may be published.');
  assert.equal(state.baselineId, BASELINE_ID); assert.equal(state.planSha256, fingerprint(plan));
  assert.equal(state.sourceCommit, plan.sourceCommit); assert.equal(deploy.id, state.id); assert.equal(deploy.site_id, SITE_ID);
  assert.equal(deploy.created_at, state.candidateCreatedAt, 'Candidate creation identity changed.');
  assert(Date.parse(deploy.created_at) >= Date.parse(state.requestStartedAt) - 10000, 'Refusing an older deployment.');
  assert(Date.parse(deploy.created_at) > Date.parse(plan.baselineCreatedAt), 'Candidate predates baseline.');
  assert.equal(deploy.title, plan.title, 'Unexpected candidate title.');
}

async function verifyCandidate(api, baseline, plan, state) {
  await assertLiveBaseline(api, baseline, plan);
  const deploy = await api('deploys/' + state.id);
  assertNewCandidate(state, plan, deploy); assert.equal(deploy.state, 'ready', 'Candidate not ready.');
  assert(!deploy.published_at, 'Candidate was already published; review the recorded release.');
  compareBackend(deploy, baseline.deploy);
  eq(await inventory(api, state.id), plan.files, 'Complete hosted candidate static inventory');
  await assertLiveBaseline(api, baseline, plan);
  return deploy;
}

export async function capture(api, filename) {
  assert(safeId(BASELINE_ID), 'Invalid expected deployment ID.');
  assert(!fs.existsSync(filename), 'Baseline capture already exists.');
  const site = await api('sites/' + SITE_ID);
  assert.equal(site.id,SITE_ID); assert.equal(site.account_id,ACCOUNT_ID);
  assert.equal(site.published_deploy?.id,BASELINE_ID,'Live deployment differs from explicitly selected baseline.');
  const deploy = await api('deploys/' + BASELINE_ID);
  validateBackend(deploy);
  const files = await inventory(api,BASELINE_ID);
  const baseline = {site,deploy,files:Object.entries(files).map(([path,sha])=>({path,sha}))};
  validateBaseline(baseline);
  const environment = await protectedEnvironment(api,site);
  await assertLiveBaseline(api,baseline,{environment});
  writeRecord(filename,baseline,true);
  console.log('Captured the explicitly selected current deployment; no remote changes.');
  return {baselineId:BASELINE_ID,staticFiles:Object.keys(files).length,functions:46,schedules:5};
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    baseline: { type: 'string', default: '.netlify/rootcaster-baseline.json' },
    plan: { type: 'string', default: '.netlify/rootcaster-plan.json' },
    state: { type: 'string', default: '.netlify/rootcaster-candidate.json' },
    'source-commit': { type: 'string' }, 'expected-candidate': { type: 'string' },
  } });
  const mode = positionals[0];
  assert(positionals.length === 1 && ['capture', 'plan', 'preview', 'verify', 'publish'].includes(mode),
    'Usage: release-rootcaster.mjs capture|plan|preview|verify|publish [--source-commit SHA] [--expected-candidate ID]');
  const baselinePath = path.resolve(ROOT, values.baseline), planPath = path.resolve(ROOT, values.plan), statePath = path.resolve(ROOT, values.state);
  const api = apiClient(readToken());
  if (mode === 'capture') return capture(api, baselinePath);
  const baseline = readRecord(baselinePath), baselineFiles = validateBaseline(baseline); // Credential stays in memory; never enters a release record.
  let plan;
  if (mode === 'plan') {
    assert(!fs.existsSync(planPath), 'Release plan already exists; use a new reviewed filename.');
    const sourceCommit = values['source-commit'] || git('rev-parse', 'HEAD'), sourceBranch = git('branch', '--show-current');
    assertSource(sourceCommit, sourceBranch);
    const { site } = await assertLiveBaseline(api, baseline);
    const overlay = assembleFiles(baselineFiles, overlayFiles());
    plan = { schemaVersion: 1, siteId: SITE_ID, baselineId: BASELINE_ID, baselineSha256: fingerprint(baseline),
      baselineCreatedAt: baseline.deploy.created_at, createdAt: new Date().toISOString(), sourceCommit, sourceBranch,
      title: `TreeRootCaster public gallery ${sourceCommit.slice(0, 12)}; preserve 46 backend packages`,
      ...overlay, backend: { functions: baseline.deploy.available_functions, schedules: baseline.deploy.function_schedules, runtime: runtime(baseline.deploy) },
      environment: await protectedEnvironment(api, site) };
    await assertLiveBaseline(api, baseline, plan);
    writeRecord(planPath, plan, true);
  } else {
    plan = readRecord(planPath);
    assert.equal(plan.baselineSha256, fingerprint(baseline)); assert.equal(plan.baselineId, BASELINE_ID);
    assertSource(plan.sourceCommit, plan.sourceBranch);
    if (values['source-commit']) assert.equal(values['source-commit'], plan.sourceCommit);
    eq(assembleFiles(baselineFiles, overlayFiles()), { files: plan.files, sources: plan.sources,
      changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths }, 'Local upload bytes and release inventory');
    await assertLiveBaseline(api, baseline, plan);
  }
  let state, deploy;
  if (mode === 'preview') {
    assert(!fs.existsSync(statePath), 'Candidate state exists; verify it or choose a new state path.');
    const requestStartedAt = new Date().toISOString();
    deploy = await api(`sites/${SITE_ID}/deploys?title=${encodeURIComponent(plan.title)}`, 'POST', {
      files: plan.files, functions: Object.fromEntries(baseline.deploy.available_functions.map(f => [f.n, f.d])),
      functions_config: functionsConfig(baseline.deploy), function_schedules: baseline.deploy.function_schedules,
      draft: false, async: false, branch: baseline.deploy.branch,
    });
    state = { schemaVersion: 1, siteId: SITE_ID, id: deploy.id, baselineId: BASELINE_ID,
      sourceCommit: plan.sourceCommit, planSha256: fingerprint(plan), requestStartedAt,
      candidateCreatedAt: deploy.created_at, verifiedAt: null };
    writeRecord(statePath, state, true);
    assertNewCandidate(state, plan, deploy);
    for (const field of ['required_functions', 'required_edge_functions', 'required_server']) assert(!(deploy[field]?.length), 'Refuse backend/server upload request.');
    for (const digest of deploy.required || []) {
      const publicPath = Object.keys(plan.sources).find(p => plan.files[p] === digest);
      assert(publicPath, 'Netlify requested an unchanged or unapproved upload.');
      const bytes = fs.readFileSync(path.join(ROOT, plan.sources[publicPath]));
      assert.equal(sha1(bytes), digest, 'Upload bytes changed.');
      let response;
      try { response = await fetch(`https://api.netlify.com/api/v1/deploys/${state.id}/files${publicPath}`, {
        method: 'PUT', redirect: 'error', headers: { Authorization: 'Bearer ' + readToken(), 'Content-Type': 'application/octet-stream' },
        body: bytes, signal: AbortSignal.timeout(30000),
      }); } catch { throw Error('Static upload failed; raw details withheld.'); }
      assert(response.ok, `Static upload failed (HTTP ${response.status}).`);
    }
    for (let attempt = 0; attempt < 90; attempt++) {
      deploy = await api('deploys/' + state.id);
      if (deploy.state === 'ready') break;
      assert(!['error', 'rejected', 'canceled'].includes(deploy.state), 'Candidate deployment failed.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else if (mode !== 'plan') state = readRecord(statePath);
  if (state) {
    if (values['expected-candidate']) assert.equal(state.id, values['expected-candidate']);
    if (mode === 'publish') assert.equal(values['expected-candidate'], state.id, 'Publish requires the explicit reviewed candidate ID.');
    deploy = await verifyCandidate(api, baseline, plan, state);
    if (mode === 'publish') {
      assert(state.verifiedAt, 'Run verify on the review candidate before publication.');
      const remoteHead = git('ls-remote', '--heads', 'origin', `refs/heads/${plan.sourceBranch}`).split(/\s+/)[0];
      assert.equal(remoteHead, plan.sourceCommit, 'Push the exact reviewed source commit before publication.');
      assertSource(plan.sourceCommit, plan.sourceBranch);
      // Official Netlify OpenAPI: locking a new unpublished deploy publishes it
      // first and locks it. This is only permitted for the newly-created candidate
      // above; it is never used as a rollback/restore mechanism.
      for (let page=1; ; page++) {
        assert(page<=100, 'Deploy history exceeds bounded concurrency check.');
        const pending=await api(`sites/${SITE_ID}/deploys?per_page=100&page=${page}`);
        assert(Array.isArray(pending), 'Invalid deploy history.');
        for (const summary of pending) {
          if (summary.id === state.id || ['ready','error','rejected','canceled'].includes(summary.state)) continue;
          // Query each audited orphan's full current record; a changed state,
          // resumed build or any unknown nonterminal deployment is a hard stop.
          const full = await api('deploys/' + summary.id);
          assert(isAuditedInactiveDeploy(full),
            `Unreviewed nonterminal deploy ${summary.id} (state: ${summary.state}); stop before publication.`);
        }
        if(pending.length<100) break;
      }
      await assertLiveBaseline(api, baseline, plan);
      await api(`deploys/${state.id}/lock`, 'POST');
      for (let attempt = 0; attempt < 60; attempt++) {
        const site = await api('sites/' + SITE_ID);
        if (site.published_deploy?.id === state.id && site.published_deploy.locked === true) break;
        assert([BASELINE_ID, state.id].includes(site.published_deploy?.id), 'Concurrent publication detected.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const site = await api('sites/' + SITE_ID);
      assert.equal(site.published_deploy?.id, state.id); assert.equal(site.published_deploy.locked, true);
      deploy = await api('deploys/' + state.id); assert.equal(deploy.locked, true);
      compareBackend(deploy, baseline.deploy);
      eq(await inventory(api, state.id), plan.files, 'Published static inventory');
      eq(await protectedEnvironment(api, site), plan.environment, 'Published environment');
      state.publishedAt = new Date().toISOString();
    }
    state.verifiedAt = new Date().toISOString(); writeRecord(statePath, state);
  }
  const report = { mode, result: 'passed', checkedAt: new Date().toISOString(), baselineId: BASELINE_ID,
    candidateId: state?.id || null, sourceCommit: plan.sourceCommit, sourceBranch: plan.sourceBranch,
    staticFiles: Object.keys(plan.files).length, changedOriginals: plan.changedOriginals, addedPaths: plan.addedPaths,
    functionsPreserved: 46, schedulesPreserved: 5, planSha256: fingerprint(plan), productionChanged: mode === 'publish',
    url: state ? `https://${state.id}--tree-token.netlify.app/` : null };
  writeRecord(path.join(ROOT, '.netlify/rootcaster-release-report.json'), report);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
