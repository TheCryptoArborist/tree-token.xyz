// Disposable local PostgreSQL only: no credentials, hosted URL, or shared database.
// Requires PostgreSQL 16+ binaries supplied in ARCADE_PG_BIN (or on PATH).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createChallengePilotHandler } from '../../netlify/challenge-functions/arcade-challenge-pilot.mjs';
import { makePilotRules } from './pilot-rules.mjs';
import { contentHash } from './core.mjs';
import { ADAPTER } from './trials-adapter.mjs';
import { pilotDatabaseError } from './pilot-errors.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'https://tree-token.xyz';
const RAW_TOKEN = 'a'.repeat(64), WALLET = '0x' + '1'.repeat(64);
const hash = value => createHash('sha256').update(value).digest('hex');
const quote = value => value === null ? 'null' : typeof value === 'number' ? String(value) : typeof value === 'boolean' ? String(value) : "'" + (typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''") + "'";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const RPC_FIELDS = {
  arcade_growth_read_session_v1: ['p_token_sha256', 'p_origin'],
  arcade_challenge_pilot_load_config_v1: ['p_token_sha256', 'p_origin', 'p_pilot_id'],
  arcade_challenge_pilot_start_v1: ['p_token_sha256', 'p_origin', 'p_pilot_id', 'p_rules_hash', 'p_attempt_token_sha256', 'p_seed_hex', 'p_challenge_hash'],
  arcade_challenge_pilot_load_attempt_v1: ['p_token_sha256', 'p_origin', 'p_attempt_token_sha256', 'p_request_id'],
  arcade_challenge_pilot_commit_move_v1: ['p_token_sha256', 'p_origin', 'p_attempt_token_sha256', 'p_expected_version', 'p_request_id', 'p_request_sha256', 'p_move_id', 'p_public_response', 'p_terminal', 'p_result'],
};

export async function verifyPostgresPilot() {
  const bin = process.env.ARCADE_PG_BIN || '';
  const executable = name => bin ? path.join(bin, name) : name;
  const version = execFileSync(executable('postgres'), ['--version'], { encoding: 'utf8' }).trim();
  assert(/PostgreSQL\) (16|17|18|19)\./.test(version), 'Use PostgreSQL 16 or later.');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tree-pilot-pg-'));
  const data = path.join(directory, 'data'), log = path.join(directory, 'server.log');
  // Only bind to loopback. A random high port avoids other disposable instances.
  const port = 54000 + Math.floor(Math.random() * 9000);
  const env = { PATH: process.env.PATH, LANG: 'C', PGHOST: '127.0.0.1', PGPORT: String(port), PGDATABASE: 'postgres', PGUSER: os.userInfo().username, PGAPPNAME: 'tree-pilot-check', PGPASSWORD: '', PGPASSFILE: '/dev/null', PGSERVICEFILE: '/dev/null' };
  const cli = ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'];
  const pids = new Set(), assertions = [];
  let started = false;
  const processes = new Set();

  function psql(sql, name = 'tree-pilot-check') {
    return new Promise((resolve, reject) => {
      const child = spawn(executable('psql'), cli, { env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
      processes.add(child); let stdout = '', stderr = '';
      const timeout = setTimeout(() => child.kill('SIGTERM'), 15000);
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', code => { clearTimeout(timeout); processes.delete(child); code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || 'Local psql failed.')); });
      child.stdin.end(sql);
    });
  }
  const json = async sql => JSON.parse(await psql(sql));
  async function rpc(name, args) {
    const fields = RPC_FIELDS[name];
    assert(fields && fields.length === Object.keys(args).length && fields.every(field => Object.hasOwn(args, field)), 'Unexpected local RPC.');
    try {
      const text = await psql(`begin; set local role service_role; select pg_backend_pid(); select public.${name}(${fields.map(field => quote(args[field])).join(',')}); commit;`, 'tree-pilot-rpc');
      const lines = text.split('\n'); pids.add(Number(lines[0])); return JSON.parse(lines.slice(1).join('\n'));
    } catch (error) { throw pilotDatabaseError(error.message); }
  }
  async function lock(sql) {
    const child = spawn(executable('psql'), cli, { env: { ...env, PGAPPNAME: 'tree-pilot-blocker' }, stdio: ['pipe', 'pipe', 'pipe'] });
    processes.add(child); let stdout = '', stderr = '', released = false;
    const ready = new Promise((resolve, reject) => {
      child.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('LOCK-READY')) resolve(); });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject); child.on('close', code => { processes.delete(child); if (!released) reject(new Error(stderr || 'Blocker closed early: ' + code)); });
    });
    child.stdin.write('begin; ' + sql + "; select 'LOCK-READY';\n");
    let timeout;
    try { await Promise.race([ready, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Blocker did not acquire its lock.')), 8000); })]); }
    finally { clearTimeout(timeout); }
    return async () => { released = true; const done = new Promise(resolve => child.on('close', resolve)); child.stdin.end('commit;\n'); await done; };
  }
  async function waiting(count) {
    for (let n = 0; n < 100; n++) {
      const actual = Number(await psql("select count(*) from pg_stat_activity where application_name='tree-pilot-rpc' and wait_event_type='Lock'"));
      if (actual >= count) return;
      await delay(25);
    }
    throw Error('Expected independent PostgreSQL workers did not block on the test lock.');
  }
  async function addSession(rawToken = RAW_TOKEN) {
    const id = randomUUID();
    await psql(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at) values(${quote(id)},${quote(WALLET)},${quote(ORIGIN)},current_date,${quote(hash(id))},repeat('local fixture only ',10),${quote(hash(id))},clock_timestamp()+interval '4 minutes'); insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at) values(${quote(hash(rawToken))},${quote(WALLET)},${quote(ORIGIN)},${quote(id)},clock_timestamp()+interval '1 hour');`);
  }
  async function addPilot(id, endOffset = 3600000) {
    const rules = makePilotRules({ pilotId: id, challengeDate: '2026-11-18', startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + endOffset).toISOString(), maxAttemptSeconds: 900 });
    const values = [rules.pilotId, 'enabled', contentHash(rules), ADAPTER.id, ADAPTER.version, ADAPTER.sourceHash, rules, rules.window.startsAt, rules.window.endsAt, rules.maxAttemptSeconds];
    await psql('insert into private.arcade_challenge_pilot_configs(pilot_id,status,rules_hash,adapter_id,adapter_version,source_hash,config,starts_at,ends_at,max_attempt_seconds) values(' + values.map(quote).join(',') + ');');
    return rules;
  }
  let entropyCount = 0;
  const handler = createChallengePilotHandler({ rpc, randomBytes: () => Buffer.from(++entropyCount % 2 ? hash('local-attempt-' + entropyCount) : '0'.repeat(63) + '5', 'hex') });
  async function call(action, body, token = RAW_TOKEN) {
    const result = await handler(new Request(ORIGIN + '/api/arcade-challenge-pilot?action=' + action, { method: 'POST', headers: { origin: ORIGIN, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: result.status, body: await result.json() };
  }
  const start = (rules, token) => call('start', { pilotId: rules.pilotId, expectedRulesHash: contentHash(rules) }, token);
  const move = (attempt, id, moveId = 19, token) => call('move', { attemptToken: attempt.body.attemptToken, expectedVersion: 0, requestId: id, moveId }, token);
  const count = attempt => json(`select jsonb_build_object('version',version,'receipts',(select count(*) from private.arcade_challenge_pilot_requests r where r.attempt_id=a.attempt_id)) from private.arcade_challenge_pilot_attempts a where attempt_id=${quote(attempt.body.attemptId)};`);
  const attemptLock = attempt => lock(`select attempt_id from private.arcade_challenge_pilot_attempts where attempt_id=${quote(attempt.body.attemptId)} for update;`);

  try {
    const initArgs = ['-D', data, '-A', 'trust', '--no-locale', '--encoding=UTF8'];
    if (process.env.ARCADE_PG_SHARE) initArgs.push('-L', process.env.ARCADE_PG_SHARE);
    execFileSync(executable('initdb'), initArgs, { stdio: 'pipe' });
    execFileSync(executable('pg_ctl'), ['-D', data, '-l', log, '-o', `-k "" -h 127.0.0.1 -p ${port}`, '-w', 'start'], { stdio: 'pipe' }); started = true;
    await psql('create role anon; create role authenticated; create role service_role bypassrls;');
    await psql(await fs.readFile(path.join(ROOT, 'tests/fixtures/arcade-monthly/growth.sql'), 'utf8'));
    await psql(await fs.readFile(path.join(ROOT, 'supabase/migrations/20261118223908_arcade_challenge_pilot.sql'), 'utf8'));
    await addSession();
    const rules = await addPilot('postgres-race-pilot');

    for (const kind of ['different-request', 'identical-retry', 'conflicting-retry']) {
      const attempt = await start(rules); assert.equal(attempt.status, 200);
      const release = await attemptLock(attempt), id = randomUUID();
      const pending = [move(attempt, id), move(attempt, kind === 'different-request' ? randomUUID() : id, kind === 'identical-retry' ? 19 : 27)];
      await waiting(2); await release();
      const results = await Promise.all(pending);
      assert.deepEqual(results.map(r => r.status).sort(), kind === 'identical-retry' ? [200, 200] : [200, 409]);
      if (kind === 'identical-retry') assert.deepEqual(results[0], results[1]);
      else assert.equal(results.find(r => r.status === 409).body.error, kind === 'different-request' ? 'version-conflict' : 'request-conflict');
      assert.deepEqual(await count(attempt), { version: 1, receipts: 1 }); assertions.push(kind);
    }

    // An already-calculated move blocked behind an operator's disable must fail.
    const disableRules = await addPilot('postgres-disabled-race'), disabled = await start(disableRules);
    const releaseDisable = await lock(`update private.arcade_challenge_pilot_configs set status='disabled' where pilot_id=${quote(disableRules.pilotId)};`);
    const blockedDisable = move(disabled, randomUUID()); await waiting(1); await releaseDisable();
    assert.equal((await blockedDisable).body.error, 'attempt-expired'); assert.deepEqual(await count(disabled), { version: 0, receipts: 0 }); assertions.push('disable-before-commit');

    // Revocation wins the session row lock before the next service operation.
    const revokeToken = 'b'.repeat(64); await addSession(revokeToken); const revoked = await start(rules, revokeToken);
    const releaseRevocation = await lock(`update private.arcade_growth_sessions set revoked_at=clock_timestamp() where token_sha256=${quote(hash(revokeToken))};`);
    const blockedRevoke = move(revoked, randomUUID(), 19, revokeToken); await waiting(1); await releaseRevocation();
    assert.equal((await blockedRevoke).status, 401); assert.deepEqual(await count(revoked), { version: 0, receipts: 0 }); assertions.push('revocation-before-commit');

    const cutoffRules = await addPilot('postgres-cutoff-race', 2500), cutoff = await start(cutoffRules);
    const releaseCutoff = await attemptLock(cutoff), blockedCutoff = move(cutoff, randomUUID()); await waiting(1);
    await delay(Math.max(0, Date.parse(cutoffRules.window.endsAt) - Date.now() + 100)); await releaseCutoff();
    assert.equal((await blockedCutoff).body.error, 'attempt-expired'); assert.deepEqual(await count(cutoff), { version: 0, receipts: 0 }); assertions.push('cutoff-while-row-locked');

    // Competing starts serialize on the wallet/pilot advisory lock at slot 20.
    const capRules = await addPilot('postgres-attempt-cap');
    for (let index = 0; index < 19; index++) assert.equal((await start(capRules)).status, 200);
    const releaseCap = await lock(`select pg_advisory_xact_lock(hashtextextended(${quote('challenge-pilot:' + WALLET + ':' + capRules.pilotId)},0));`);
    const capped = [start(capRules), start(capRules)]; await waiting(2); await releaseCap();
    const capResults = await Promise.all(capped); assert.deepEqual(capResults.map(r => r.status).sort(), [200, 429]);
    assert.equal(capResults.find(r => r.status === 429).body.error, 'attempt-limit');
    assert.equal(Number(await psql(`select count(*) from private.arcade_challenge_pilot_attempts where pilot_id=${quote(capRules.pilotId)}`)), 20); assertions.push('concurrent-active-attempt-cap');

    assert(pids.size >= 12, 'The verifier must exercise independent database workers.');
    return { schemaVersion: 1, result: 'passed', checkedAt: new Date().toISOString(), postgres: version, environment: 'disposable-local-loopback', syntheticSessions: true, productionMutated: false, independentWorkerCount: pids.size, checks: assertions };
  } finally {
    for (const child of processes) child.kill('SIGTERM');
    if (started) execFileSync(executable('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    await fs.rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPostgresPilot().then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
