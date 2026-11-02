import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SITE_ID, ACCOUNT_ID, canonical, fingerprint, environmentFor, filesFromRows, validateFunctions,
  assertPreserved, captureCurrent, readOnlyApi, readToken, saveBaseline, loadBaseline, main,
} from '../scripts/release-preserved-production.mjs';

const ID = '6ae8112dce29c5db8b725ff0';
const functions = Array.from({ length: 41 }, (_, index) => ({
  n: 'test-' + index, d: 'a'.repeat(64), id: 'provider-' + index, oid: 'object-' + index,
  a: 'account-' + index, c: 'created', r: 'nodejs22.x', rg: 'us-east-2', m: 1024, im: 'stream', s: 100,
  bd: { bootstrapVersion: '2.24.0' }, ro: [{ p: '/api/test-' + index, m: [] }],
  tr: { action: { type: 'rate_limit' } },
}));
const schedules = functions.slice(0, 5).map(fn => ({ name: fn.n, cron: '5 * * * *' }));
const binding = { key: 'TREEFORCE89_DEV_DATABASE_URL', scopes: ['functions'], is_secret: true,
  values: [{ id: 'value-id', context: 'production', context_parameter: null }] };
const deploy = { id: ID, site_id: SITE_ID, state: 'ready', locked: true, context: 'production',
  available_functions: functions, function_schedules: schedules, functions_region: 'cmh',
  functions_region_overrides: [], database_branch_id: 'production', blobs_region: 'us-east-2',
  edge_functions_present: false, server: null, database_migrations: { files: [] } };
const site = { id: SITE_ID, account_id: ACCOUNT_ID, published_deploy: { id: ID, locked: true }, build_settings: {} };
const clone = value => structuredClone(value);

function fakeApi(transform = () => {}) {
  const calls = [];
  const api = async endpoint => {
    calls.push(endpoint);
    let value;
    if (endpoint === 'sites/' + SITE_ID) value = site;
    else if (endpoint === 'deploys/' + ID) value = deploy;
    else if (endpoint.startsWith('deploys/' + ID + '/files?')) value = [{ path: '/index.html', sha: 'b'.repeat(40) }];
    else if (endpoint.startsWith('accounts/' + ACCOUNT_ID + '/env')) value = endpoint.includes('site_id=') ? [binding] : [];
    else throw Error('Unexpected test endpoint');
    value = clone(value);
    transform(endpoint, value, calls);
    return value;
  };
  api.calls = calls;
  return api;
}

test('fresh capture and exact read-back validate all 41 full records and five schedules', async () => {
  const a = await captureCurrent(fakeApi(), ID);
  assertPreserved(await captureCurrent(fakeApi(), ID), a);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-preservation-'));
  try {
    const filename = path.join(tmp, 'baseline.json');
    saveBaseline(filename, a);
    assert.deepEqual(loadBaseline(filename), a);
    assert.throws(() => saveBaseline(filename, a), /already exists/);
    const corrupt = clone(a); corrupt.functions[0].id = 'changed';
    fs.writeFileSync(filename, JSON.stringify(corrupt));
    assert.throws(() => loadBaseline(filename), /integrity/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

for (const field of ['d', 'id', 'oid', 'a', 'c', 'r', 'rg', 'm', 'im', 'bd', 'ro', 'tr', 's']) {
  test('rejects complete function record drift: ' + field, async () => {
    const baseline = await captureCurrent(fakeApi(), ID);
    const changed = clone(baseline);
    changed.functions[0][field] = field === 'd' ? 'c'.repeat(64) : 'changed';
    assert.throws(() => assertPreserved(changed, baseline), /functions changed/);
  });
}

test('rejects missing fields, additions, removals, and duplicate functions', () => {
  const missing = clone(functions); delete missing[0].oid;
  assert.throws(() => validateFunctions(missing), /Incomplete/);
  assert.throws(() => validateFunctions(functions.slice(1)), /41/);
  assert.throws(() => validateFunctions([...functions, functions[0]]), /41/);
  assert.throws(() => validateFunctions([...functions.slice(1), functions[1]]), /Duplicate/);
});

test('rejects schedule, runtime, static, and protected environment drift', async () => {
  const baseline = await captureCurrent(fakeApi(), ID);
  for (const mutate of [
    x => { x.schedules[0].cron = '0 * * * *'; },
    x => { x.runtime.functions_region = 'sfo'; },
    x => { x.files['/index.html'] = 'c'.repeat(40); },
    x => { x.files['/extra.html'] = 'c'.repeat(40); },
    x => { x.environment.site.sha256 = 'changed'; },
    x => { x.environment.requiredBinding.valueId = 'changed'; },
  ]) {
    const changed = clone(baseline); mutate(changed);
    assert.throws(() => assertPreserved(changed, baseline), /changed; stop/);
  }
});

test('null, missing, and empty route methods are distinct', async () => {
  const baseline = await captureCurrent(fakeApi(), ID);
  const changed = clone(baseline);
  changed.functions[0].ro[0].m = null;
  assert.throws(() => assertPreserved(changed, baseline), /functions changed/);
  delete changed.functions[0].ro[0].m;
  assert.throws(() => assertPreserved(changed, baseline), /functions changed/);
});

test('requires expected publication and rejects concurrent publication and lock changes', async () => {
  await assert.rejects(captureCurrent(fakeApi(), undefined), /explicit expected/);
  await assert.rejects(captureCurrent(fakeApi(), 'a'.repeat(24)), /Published deployment changed/);
  for (const mutate of [value => { value.published_deploy.id = 'a'.repeat(24); },
    value => { value.published_deploy.locked = false; }]) {
    let count = 0;
    const api = fakeApi((endpoint, value) => {
      if (endpoint === 'sites/' + SITE_ID && ++count === 2) mutate(value);
    });
    await assert.rejects(captureCurrent(api, ID), /Publication or lock changed/);
  }
});

test('rejects function, schedule, and environment changes during capture', async () => {
  for (const target of ['function', 'schedule', 'environment']) {
    let count = 0;
    const api = fakeApi((endpoint, value) => {
      if (target !== 'environment' && endpoint === 'deploys/' + ID && ++count === 2) {
        if (target === 'function') value.available_functions[0].id = 'changed';
        else value.function_schedules[0].cron = '0 * * * *';
      }
      if (target === 'environment' && endpoint.includes('/env?site_id=') && ++count > 2) {
        value[0].values[0].id = 'changed';
      }
    });
    await assert.rejects(captureCurrent(api, ID), /during inventory changed/);
  }
});

test('rejects wrong site, account, active migrations, and edge/server bundles', async () => {
  for (const [target, mutate] of [
    ['site', x => { x.id = 'other'; }], ['site', x => { x.account_id = 'other'; }],
    ['deploy', x => { x.database_migrations = { files: ['migration.sql'] }; }],
    ['deploy', x => { x.edge_functions_present = true; }], ['deploy', x => { x.server = { name: 'server' }; }],
  ]) {
    await assert.rejects(captureCurrent(fakeApi((endpoint, value) => {
      if (endpoint === (target === 'site' ? 'sites/' + SITE_ID : 'deploys/' + ID)) mutate(value);
    }), ID));
  }
});

test('environment scopes, context IDs, and build settings are protected without saving values', () => {
  const env = { site: [binding], siteFunctions: [binding], shared: [], sharedFunctions: [],
    buildSettings: { env: { SECRET: 'do-not-save-this-secret' } } };
  const before = environmentFor(env);
  assert(!JSON.stringify(before).includes('do-not-save-this-secret'));
  const changed = clone(env); changed.buildSettings.env.SECRET = 'rotated';
  assert.notEqual(environmentFor(changed).buildSettingsSha256, before.buildSettingsSha256);
  for (const mutate of [
    x => { x.site[0].is_secret = false; x.siteFunctions[0].is_secret = false; },
    x => { x.site[0].values[0].context = 'dev'; x.siteFunctions[0].values[0].context = 'dev'; },
    x => { x.siteFunctions = []; },
  ]) {
    const bad = clone(env); mutate(bad);
    assert.throws(() => environmentFor(bad));
  }
});

test('static inventories reject duplicates, empty results, and malformed digests', () => {
  const row = { path: '/index.html', sha: 'b'.repeat(40) };
  assert.throws(() => filesFromRows([row, row]), /duplicate/);
  assert.throws(() => filesFromRows([]), /empty/);
  assert.throws(() => filesFromRows([{ ...row, sha: 'bad' }]), /SHA1/);
});

test('build-settings audit timestamps do not look like configuration drift', async () => {
  const baseline = await captureCurrent(fakeApi((endpoint, value) => {
    if (endpoint === 'sites/' + SITE_ID) value.build_settings.updated_at = 'before-merge';
  }), ID);
  const after = await captureCurrent(fakeApi((endpoint, value) => {
    if (endpoint === 'sites/' + SITE_ID) value.build_settings.updated_at = 'after-merge';
  }), ID);
  assertPreserved(after, baseline);
  assert.notEqual(after.observations.buildSettingsUpdatedAt, baseline.observations.buildSettingsUpdatedAt);
  assert(!Object.hasOwn(after.environment.buildSettingsFieldsSha256, 'updated_at'));
});

test('every real build setting and its field presence remain protected', async () => {
  const baseline = await captureCurrent(fakeApi((endpoint, value) => {
    if (endpoint === 'sites/' + SITE_ID) value.build_settings = {
      updated_at: 'before', created_at: 'created', cmd: 'npm run build', dir: 'dist',
      repo_branch: 'main', stop_builds: false, env: { SECRET: 'original' },
    };
  }), ID);
  for (const field of ['created_at', 'cmd', 'dir', 'repo_branch', 'stop_builds', 'env', 'new_setting']) {
    for (const remove of [false, true]) {
      if (field === 'new_setting' && remove) continue;
      const changed = await captureCurrent(fakeApi((endpoint, value) => {
        if (endpoint !== 'sites/' + SITE_ID) return;
        value.build_settings = {
          updated_at: 'after', created_at: 'created', cmd: 'npm run build', dir: 'dist',
          repo_branch: 'main', stop_builds: false, env: { SECRET: 'original' },
        };
        if (remove) delete value.build_settings[field];
        else value.build_settings[field] = field === 'env' ? { SECRET: 'changed' } : 'changed';
      }), ID);
      assert.throws(() => assertPreserved(changed, baseline), /environment changed/);
    }
  }
});

test('audit timestamp changes during one inventory read are accepted', async () => {
  let read = 0;
  const captured = await captureCurrent(fakeApi((endpoint, value) => {
    if (endpoint === 'sites/' + SITE_ID) value.build_settings.updated_at = String(++read);
  }), ID);
  assert.equal(captured.schemaVersion, 2);
});

test('network operations are GETs and credential-bearing errors are redacted', async () => {
  const calls = [];
  const api = readOnlyApi('private-token', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }) };
  });
  await api('sites/' + SITE_ID);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  assert(!Object.hasOwn(calls[0].options, 'body'));
  for (const invalid of ['https://evil.example', 'sites/../deploys', 'deploys/' + ID + '/restore']) {
    await assert.rejects(api(invalid), /Invalid inventory endpoint/);
  }
  assert.equal(calls.length, 1);
  const failing = readOnlyApi('private-token', async () => { throw Error('private-token'); });
  await assert.rejects(failing('sites/' + SITE_ID), error => !error.message.includes('private-token'));
});

test('legacy deployment modes are rejected before credentials or network access', async () => {
  for (const mode of ['preview', 'promote', 'deploy', 'verify unexpected']) {
    await assert.rejects(main(mode.split(' ')), /Read-only usage/);
  }
});

test('CLI credentials support Linux and Windows paths and DEBUG is refused', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-auth-'));
  try {
    const folder = path.join(tmp, '.config/netlify'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'config.json'), JSON.stringify({ userId: 'user', users: { user: { auth: { token: 'linux' } } } }));
    assert.equal(readToken({}, tmp), 'linux');
    assert.equal(readToken({ NETLIFY_AUTH_TOKEN: 'environment' }, tmp), 'environment');
    assert.throws(() => readToken({ DEBUG: 'true', NETLIFY_AUTH_TOKEN: 'hidden' }, tmp), /Unset/);
    fs.rmSync(folder, { recursive: true });
    const windows = path.join(tmp, 'AppData/netlify/Config'); fs.mkdirSync(windows, { recursive: true });
    fs.writeFileSync(path.join(windows, 'config.json'), JSON.stringify({ userId: 'user', users: { user: { auth: 'windows' } } }));
    assert.equal(readToken({ APPDATA: path.join(tmp, 'AppData') }, tmp), 'windows');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('object key order is immaterial while array order and field presence remain protected', () => {
  assert.equal(fingerprint({ a: 1, b: 2 }), fingerprint({ b: 2, a: 1 }));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
  assert.notEqual(canonical({}), canonical({ a: null }));
});
