import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';

const wallet = '0x' + 'a'.repeat(64), token = 'a'.repeat(64), origin = 'https://tree-token.xyz';
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const migration = fs.readFileSync(new URL('../supabase/migrations/20261118223908_arcade_challenge_pilot.sql', import.meta.url), 'utf8');
const iso = value => new Date(value).toISOString();
const flags = { mode: 'nonpaying-pilot', identityScope: 'wallet-session-only', payable: false, prizeEligible: false, awardsEnabled: false };

function config(id = 'database-test-pilot', changes = {}) {
  const start = iso(Date.now() - 60_000), end = iso(Date.now() + 30 * 60_000);
  return {
    schemaVersion: 1, ...flags, pilotId: id,
    game: { id: 'arborist-trials', version: 'test-build-v1', ruleset: 'test-rules-v1', sourceHash: hash('test-source') },
    adapter: { id: 'test-trials-adapter', version: 'test-v1' }, challengeDate: '2026-11-18',
    window: { startsAt: start, endsAt: end }, maxAttemptSeconds: 600,
    objective: { metric: 'wins', operator: 'eq', targetUnits: '1' },
    access: { entry: 'free', purchaseRequired: false, standardCards: 4, paidAdvantages: 'forbidden' },
    ...changes,
  };
}

async function session(db, sessionToken = token, player = wallet, sourceOrigin = origin, duration = 55 * 60_000) {
  const id = randomUUID();
  await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at)
    values($1,$2,$3,current_date,$4,repeat('x',100),$4,clock_timestamp()+interval '4 minutes')`, [id, player, sourceOrigin, hash(id)]);
  await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at)
    values($1,$2,$3,$4,clock_timestamp()+($5::double precision*interval '1 millisecond'))`, [sessionToken, player, sourceOrigin, id, duration]);
}

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(fs.readFileSync(new URL('./fixtures/arcade-monthly/growth.sql', import.meta.url), 'utf8'));
  await db.exec(migration);
  await session(db);
  const admin = async fn => { await db.exec('reset role'); try { return await fn(); } finally { await db.exec('set role service_role'); } };
  const add = async (cfg = config(), status = 'enabled') => admin(async () => {
    const rulesHash = hash(JSON.stringify(cfg));
    await db.query(`insert into private.arcade_challenge_pilot_configs(pilot_id,status,rules_hash,adapter_id,adapter_version,source_hash,config,starts_at,ends_at,max_attempt_seconds)
      values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,$9::timestamptz,$10)`,
    [cfg.pilotId, status, rulesHash, cfg.adapter.id, cfg.adapter.version, cfg.game.sourceHash, JSON.stringify(cfg), cfg.window.startsAt, cfg.window.endsAt, cfg.maxAttemptSeconds]);
    return { cfg, rulesHash };
  });
  const call = async (name, args) => (await db.query(`select public.arcade_challenge_pilot_${name}_v1(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`, args)).rows[0].value;
  const loadConfig = (id = 'database-test-pilot', t = token, o = origin) => call('load_config', [t, o, id]);
  const start = (pilot, attemptToken = hash(randomUUID()), t = token, o = origin, changes = {}) => call('start', [t, o, pilot.cfg.pilotId, changes.rulesHash ?? pilot.rulesHash, attemptToken, changes.seedHex ?? hash('seed'), changes.challengeHash ?? hash('challenge')]);
  const loadAttempt = (attemptToken, requestId = null, t = token, o = origin) => call('load_attempt', [t, o, attemptToken, requestId]);
  const move = (attemptToken, changes = {}) => {
    const x = { version: 0, requestId: randomUUID(), requestHash: hash(randomUUID()), moveId: 19, response: { status: 'ok', view: { cards: [19, 27] } }, terminal: false, result: null, token, origin, ...changes };
    return call('commit_move', [x.token, x.origin, attemptToken, x.version, x.requestId, x.requestHash, x.moveId, x.response === null ? null : JSON.stringify(x.response), x.terminal, x.result === null ? null : JSON.stringify(x.result)]);
  };
  await db.exec('set role service_role');
  return { db, admin, add, call, loadConfig, start, loadAttempt, move };
}

test('pilot migration is dormant and restricts every table/RPC to the trusted service', async () => {
  const s = await setup(); try {
    assert.equal(await s.loadConfig(), null);
    assert.equal((await s.db.query('select count(*)::int as n from private.arcade_challenge_pilot_configs')).rows[0].n, 0);
    const signatures = [
      'arcade_challenge_pilot_load_config_v1(text,text,text)', 'arcade_challenge_pilot_start_v1(text,text,text,text,text,text,text)',
      'arcade_challenge_pilot_load_attempt_v1(text,text,text,uuid)', 'arcade_challenge_pilot_commit_move_v1(text,text,text,integer,uuid,text,integer,jsonb,boolean,jsonb)',
    ];
    for (const role of ['anon', 'authenticated']) {
      for (const fn of signatures) assert.equal((await s.db.query("select has_function_privilege($1,$2,'execute') as ok", [role, 'public.' + fn])).rows[0].ok, false);
      await s.db.exec('reset role;set role ' + role);
      await assert.rejects(s.loadConfig(), /permission denied/);
      for (const table of ['configs', 'attempts', 'requests']) await assert.rejects(s.db.query('select * from private.arcade_challenge_pilot_' + table), /permission denied/);
    }
    await s.db.exec('reset role;set role service_role');
    await s.add(config(), 'draft');
    await assert.rejects(s.db.query("update private.arcade_challenge_pilot_configs set status='enabled'"), /challenge-config-operator-required/);
    await assert.rejects(s.db.query("update private.arcade_challenge_pilot_configs set rules_hash=repeat('b',64)"), /permission denied/);
    const rows = await s.db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('arcade_challenge_pilot_configs','arcade_challenge_pilot_attempts','arcade_challenge_pilot_requests')");
    assert.equal(rows.rows.length, 3); assert.equal(rows.rows.every(row => row.relrowsecurity), true);
    const procs = await s.db.query("select prosecdef from pg_proc where proname like 'arcade_challenge_pilot_%'");
    assert.equal(procs.rows.every(row => row.prosecdef === false), true);
  } finally { await s.db.close(); }
});

test('pilot configuration binds its metadata, forbids reward claims and becomes immutable on activation', async () => {
  const s = await setup(); try {
    const p = await s.add(config(), 'draft');
    assert.equal((await s.loadConfig()).enabled, false);
    await assert.rejects(s.start(p), /challenge-not-open/);
    await s.admin(() => s.db.query("update private.arcade_challenge_pilot_configs set status='enabled' where pilot_id=$1", [p.cfg.pilotId]));
    const loaded = await s.loadConfig(); assert.equal(loaded.enabled, true); assert.equal(loaded.rulesHash, p.rulesHash); assert.deepEqual(loaded.config, p.cfg);
    for (const update of ["rules_hash=repeat('b',64)", "ends_at=ends_at+interval '1 day'", "config=jsonb_set(config,'{game,version}','\"changed-build\"')", "status='draft'", 'payable=true'])
      await s.admin(() => assert.rejects(s.db.query('update private.arcade_challenge_pilot_configs set ' + update), /challenge-config-locked/));
    await s.admin(() => assert.rejects(s.db.query('delete from private.arcade_challenge_pilot_configs'), /challenge-config-locked/));
    await s.admin(() => s.db.query("update private.arcade_challenge_pilot_configs set status='disabled'"));
    await s.admin(() => assert.rejects(s.db.query("update private.arcade_challenge_pilot_configs set status='enabled'"), /challenge-config-locked/));
    await assert.rejects(s.start(p), /challenge-not-open/);
    for (const changes of [{ payable: true }, { prizeEligible: true }, { identityScope: 'verified-person' }, { game: { ...p.cfg.game, id: 'treeforce89' } }, { challengeDate: '2026-02-30' }, { maxAttemptSeconds: 3601 }])
      await assert.rejects(s.add(config('invalid-' + randomUUID(), changes)), /challenge-invalid-config|check constraint/);
    await s.admin(() => assert.rejects(s.db.query(`insert into private.arcade_challenge_pilot_configs(pilot_id,rules_hash,adapter_id,adapter_version,source_hash,config,starts_at,ends_at,max_attempt_seconds)
      values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`, ['wrong-binding', p.rulesHash, p.cfg.adapter.id, p.cfg.adapter.version, p.cfg.game.sourceHash, JSON.stringify(p.cfg), p.cfg.window.startsAt, p.cfg.window.endsAt, 600]), /challenge-invalid-config/));
  } finally { await s.db.close(); }
});

test('attempts are bound to the original wallet, session and origin, never a client identity claim', async () => {
  const s = await setup(); try {
    const p = await s.add(), aToken = hash('bound-attempt'), a = await s.start(p, aToken);
    assert.match(a.attemptId, /^[0-9a-f-]{36}$/); assert.equal(a.wallet, wallet); assert.equal(a.sessionHash, token); assert.equal(a.identityScope, 'wallet-session-only'); assert.equal(a.prizeEligible, false);
    assert.equal(a.attemptToken, undefined); assert.equal(a.attemptTokenSha256, undefined); assert.equal(a.replay, null);
    const other = hash('other-session'), sameWallet = hash('same-wallet-new-session'), www = hash('www-session');
    await s.admin(async () => { await session(s.db, other, '0x' + 'b'.repeat(64)); await session(s.db, sameWallet, wallet); await session(s.db, www, wallet, 'https://www.tree-token.xyz'); });
    for (const [t, o] of [[other, origin], [sameWallet, origin], [www, 'https://www.tree-token.xyz']]) {
      await assert.rejects(s.loadAttempt(aToken, null, t, o), /challenge-attempt-not-found/);
      await assert.rejects(s.move(aToken, { token: t, origin: o }), /challenge-attempt-not-found/);
    }
    await assert.rejects(s.loadConfig(p.cfg.pilotId, token, 'https://evil.example'), /invalid-session/);
    await assert.rejects(s.loadAttempt(aToken, null, hash('unknown-session')), /invalid-session/);
    await assert.rejects(s.start(p, aToken), /unique constraint/);
    await assert.rejects(s.start(p, hash('new-token'), token, origin, { rulesHash: hash('different-rules') }), /challenge-rules-conflict/);
  } finally { await s.db.close(); }
});

test('server start times and expiry respect pilot, duration and original session boundaries', async () => {
  const s = await setup(); try {
    const future = await s.add(config('future-pilot', { window: { startsAt: iso(Date.now() + 60_000), endsAt: iso(Date.now() + 120_000) } }));
    await assert.rejects(s.start(future), /challenge-not-open/);
    const past = await s.add(config('past-pilot', { window: { startsAt: iso(Date.now() - 120_000), endsAt: iso(Date.now() - 1) } }));
    await assert.rejects(s.start(past), /challenge-not-open/);
    const p = await s.add(config('duration-pilot', { maxAttemptSeconds: 120 })), a = await s.start(p);
    assert.equal(Date.parse(a.expiresAt) - Date.parse(a.startedAt), 120_000); assert.ok(Date.parse(a.startedAt) <= Date.parse(a.serverNow));
    const end = iso(Date.now() + 60_000), cutoff = await s.add(config('cutoff-pilot', { window: { startsAt: iso(Date.now() - 1000), endsAt: end } }));
    assert.equal((await s.start(cutoff)).expiresAt, end);
    const shortToken = hash('short-session'); await s.admin(() => session(s.db, shortToken, wallet, origin, 30_000));
    const short = await s.start(p, hash('short-attempt'), shortToken);
    const sessionEnd = (await s.db.query('select expires_at from private.arcade_growth_sessions where token_sha256=$1', [shortToken])).rows[0].expires_at;
    assert.equal(short.expiresAt, iso(sessionEnd));
  } finally { await s.db.close(); }
});

test('commits append one authoritative move, enforce CAS and cannot rewrite state or stored receipts', async () => {
  const s = await setup(); try {
    const p = await s.add(), aToken = hash('cas-attempt'), a = await s.start(p, aToken);
    const request = { requestId: randomUUID(), requestHash: hash('original-request'), moveId: 19 };
    const first = await s.move(aToken, request); assert.equal(first.version, 1); assert.equal(first.attemptStatus, 'active'); assert.equal(first.status, 'ok');
    const after = await s.loadAttempt(aToken, request.requestId); assert.deepEqual(after.moves, [19]); assert.equal(after.version, 1); assert.deepEqual(after.replay, { requestHash: request.requestHash, expectedVersion: 0, moveId: 19, response: first });
    await assert.rejects(s.move(aToken), /challenge-version-conflict/);
    await assert.rejects(s.move(aToken, { ...request, requestHash: hash('changed-request') }), /challenge-request-conflict/);
    await assert.rejects(s.move(aToken, { ...request, moveId: 27 }), /challenge-request-conflict/);
    assert.deepEqual(await s.move(aToken, { ...request, response: { status: 'different-retry-render' } }), first);
    for (const update of ["moves=array[27],version=1", "rules_hash=repeat('c',64)", "config='{}'::jsonb", "seed_hex=repeat('d',64)", "result='{}'::jsonb"])
      await s.admin(() => assert.rejects(s.db.query('update private.arcade_challenge_pilot_attempts set ' + update + ' where attempt_id=$1', [a.attemptId]), /challenge-attempt-immutable/));
    await s.admin(() => assert.rejects(s.db.query("update private.arcade_challenge_pilot_requests set public_response='{}'::jsonb"), /challenge-request-immutable/));
    await s.admin(() => assert.rejects(s.db.query('delete from private.arcade_challenge_pilot_requests'), /challenge-request-immutable/));
    assert.deepEqual((await s.loadAttempt(aToken)).moves, [19]);
  } finally { await s.db.close(); }
});

test('terminal receipts retain server completion time and exact retries after cutoff while new moves fail', async () => {
  const s = await setup(); try {
    const end = iso(Date.now() + 700), p = await s.add(config('short-cutoff', { window: { startsAt: iso(Date.now() - 1000), endsAt: end } }));
    const aToken = hash('terminal-attempt'); await s.start(p, aToken);
    const request = { requestId: randomUUID(), requestHash: hash('terminal-request'), terminal: true, result: { completed: true, won: true, score: 150, rounds: 3, moveCount: 1, ruleTargetMet: true, ...flags }, response: { status: 'ok', completedAt: '2000-01-01T00:00:00.000Z' } };
    const receipt = await s.move(aToken, request); assert.equal(receipt.attemptStatus, 'completed'); assert.notEqual(receipt.completedAt, '2000-01-01T00:00:00.000Z');
    assert.equal(receipt.result.completedAt, receipt.completedAt); assert.ok(Date.parse(receipt.completedAt) < Date.parse(end));
    await assert.rejects(s.move(aToken, { version: 1 }), /challenge-attempt-completed/);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(end) - Date.now()) + 10));
    assert.deepEqual(await s.move(aToken, request), receipt);
    assert.deepEqual((await s.loadAttempt(aToken, request.requestId)).replay.response, receipt);
    await assert.rejects(s.start(p), /challenge-not-open/);
    await s.admin(() => assert.rejects(s.db.query("update private.arcade_challenge_pilot_attempts set result=jsonb_set(result,'{score}','999999')"), /challenge-attempt-immutable/));
  } finally { await s.db.close(); }
});

test('new moves stop at expiry; an existing nonterminal request remains exactly retryable', async () => {
  const s = await setup(); try {
    const end = iso(Date.now() + 600), p = await s.add(config('expiry-pilot', { window: { startsAt: iso(Date.now() - 1000), endsAt: end } }));
    const aToken = hash('expiry-attempt'); await s.start(p, aToken);
    const request = { requestId: randomUUID(), requestHash: hash('expiry-request') }, first = await s.move(aToken, request);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(end) - Date.now()) + 10));
    await assert.rejects(s.move(aToken, { version: 1 }), /challenge-attempt-expired/);
    assert.deepEqual(await s.move(aToken, request), first); assert.equal((await s.loadAttempt(aToken)).version, 1);
  } finally { await s.db.close(); }
});

test('invalid moves and reward/person claims are rejected atomically, including nested JSON', async () => {
  const s = await setup(); try {
    const p = await s.add(), aToken = hash('invalid-attempt'); await s.start(p, aToken);
    for (const changes of [{ moveId: 0 }, { moveId: 31 }, { version: -1 }, { requestId: null }, { requestHash: 'invalid' }]) await assert.rejects(s.move(aToken, changes), /challenge-invalid-move/);
    for (const changes of [
      { response: null }, { response: { payable: true } }, { response: { view: { prizeEligible: true } } }, { response: { items: [{ awardsEnabled: true }] } },
      { response: { identityScope: 'verified-person' } }, { response: { mode: 'funded-campaign' } }, { terminal: true, result: null },
      { terminal: false, result: {} }, { terminal: true, result: { nested: { paymentEnabled: true } } }, { terminal: true, result: { identityVerified: true } },
    ]) await assert.rejects(s.move(aToken, changes), /challenge-invalid-result/);
    assert.deepEqual((await s.loadAttempt(aToken)).moves, []);
    const receipt = await s.move(aToken, { terminal: true, result: { completed: false, won: false, ruleTargetMet: false, ...flags } });
    for (const target of [receipt, receipt.result]) { assert.equal(target.payable, false); assert.equal(target.prizeEligible, false); assert.equal(target.awardsEnabled, false); assert.equal(target.identityScope, 'wallet-session-only'); }
  } finally { await s.db.close(); }
});

test('revocation and expiry deny every RPC including previously accepted replay responses', async () => {
  for (const mode of ['revoked', 'expired']) {
    const s = await setup(); try {
      const p = await s.add(), aToken = hash('session-ended-attempt'); await s.start(p, aToken);
      const request = { requestId: randomUUID(), requestHash: hash('session-ended-request') }; await s.move(aToken, request);
      await s.admin(() => mode === 'revoked' ? s.db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp() where token_sha256=$1', [token]) : s.db.query("update private.arcade_growth_sessions set issued_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' where token_sha256=$1", [token]));
      for (const action of [() => s.loadConfig(), () => s.start(p), () => s.loadAttempt(aToken), () => s.move(aToken, request)]) await assert.rejects(action(), /invalid-session/);
    } finally { await s.db.close(); }
  }
});

test('active-attempt cap is wallet-scoped and version 100 must terminate without creating prizes', async () => {
  const s = await setup(); try {
    const p = await s.add(), tokens = Array.from({ length: 20 }, (_, i) => hash('capped-' + i));
    for (const t of tokens) await s.start(p, t);
    await assert.rejects(s.start(p), /challenge-attempt-limit/);
    const secondSession = hash('same-wallet-cap'); await s.admin(() => session(s.db, secondSession));
    await assert.rejects(s.start(p, hash('same-wallet-cap-attempt'), secondSession), /challenge-attempt-limit/);
    for (let version = 0; version < 99; version++) await s.move(tokens[0], { version, moveId: 1 });
    await assert.rejects(s.move(tokens[0], { version: 99 }), /challenge-invalid-result/);
    const final = await s.move(tokens[0], { version: 99, terminal: true, result: { completed: false, won: false, moveCount: 100, ruleTargetMet: false, ...flags } });
    assert.equal(final.version, 100); assert.equal(final.prizeEligible, false); assert.equal((await s.loadAttempt(tokens[0])).moves.length, 100);
    await s.start(p, hash('new-after-terminal'));
    const counts = (await s.db.query('select (select count(*) from private.arcade_challenge_pilot_attempts)::int as attempts,(select count(*) from private.arcade_challenge_pilot_requests)::int as requests')).rows[0];
    assert.deepEqual(counts, { attempts: 21, requests: 100 });
  } finally { await s.db.close(); }
});
