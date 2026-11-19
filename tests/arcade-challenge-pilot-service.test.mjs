import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServiceFixture, assertNoPrivateState, RAW_TOKEN, WALLET, ORIGIN, WIN_MOVES, requestId } from './fixtures/arcade-challenge-pilot/service-fixture.mjs';
import { planAllocation } from '../scripts/arcade-campaigns/core.mjs';
import { syntheticDemo } from '../scripts/arcade-campaigns/synthetic-demo.mjs';
import { createPilotRpc } from '../scripts/arcade-campaigns/pilot-rpc.mjs';

async function usingFixture(fn, options) {
  const fixture = await createServiceFixture(options);
  try { return await fn(fixture); } finally { await fixture.close(); }
}
async function start(f, config) {
  const response = await f.start(config);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}
async function win(f, attemptToken) {
  let response;
  for (const [version, move] of WIN_MOVES.entries()) {
    response = await f.move(attemptToken, version, move);
    assert.equal(response.status, 200, JSON.stringify(response.body));
  }
  return response;
}
function noPrize(body) {
  assert.equal(body.mode, 'nonpaying-pilot');
  assert.equal(body.identityScope, 'wallet-session-only');
  for (const field of ['payable', 'prizeEligible', 'awardsEnabled']) assert.equal(body[field], false);
}

test('empty migration exposes no open pilot and cannot start an unconfigured challenge', () => usingFixture(async f => {
  const info = await f.call('configuration', undefined, { headers: { authorization: null } });
  assert.equal(info.status, 200); assert.equal(info.body.pilotOpen, false); noPrize(info.body);
  const missing = await f.start(); assert.equal(missing.status, 404);
  assert.equal(await f.count('attempts'), 0);
}, { seedPilot: false }));

test('actual authenticated HTTP handler + service-role SQL + pinned Trials engine computes a known win', () => usingFixture(async f => {
  const configuration = await f.call('configuration', undefined, { pilotId: f.rules.pilotId });
  assert.equal(configuration.status, 200); assert.equal(configuration.body.pilotOpen, true);
  assert.equal(configuration.body.rulesHash, f.rulesHash);
  const attempt = await start(f);
  assert.equal(attempt.version, 0); assert.equal(attempt.challenge.fifthCardEnabled, false);
  assert.equal(attempt.view.cards.length, 4); assert.equal(attempt.view.moveCount, 0);
  assertNoPrivateState(assert, attempt, { allowAttemptToken: true }); noPrize(attempt);
  const final = await win(f, attempt.attemptToken);
  assert.equal(final.body.version, 3); assert.equal(final.body.attemptStatus, 'completed');
  assert.deepEqual([final.body.result.completed, final.body.result.won, final.body.result.score, final.body.result.rounds], [true, true, 16375, 3]);
  assert.equal(final.body.result.ruleTargetMet, true); assert.equal(final.body.view.playerGrowth, 50); assert.equal(final.body.view.botGrowth, 19);
  assert.ok(Date.parse(final.body.completedAt) >= Date.parse(attempt.startedAt));
  assert.ok(Date.parse(final.body.completedAt) < Date.parse(attempt.expiresAt));
  noPrize(final.body); noPrize(final.body.result); assertNoPrivateState(assert, final.body);
  assert.equal(await f.count('requests'), 3);
  const stored = (await f.db.query('select moves,version,status,result from private.arcade_challenge_pilot_attempts')).rows[0];
  assert.deepEqual(stored.moves, WIN_MOVES); assert.equal(stored.version, 3); assert.equal(stored.result.score, 16375);
  const restored = await f.call('status', { attemptToken: attempt.attemptToken });
  assert.equal(restored.status, 200); assert.deepEqual(restored.body.result, final.body.result); assert.deepEqual(restored.body.view, final.body.view);
  assert.equal(final.headers.get('cache-control'), 'no-store');
  assert.equal(final.headers.get('netlify-cdn-cache-control'), 'no-store');
  assert.equal(final.headers.has('access-control-allow-origin'), false);
}));

test('bounded host-clock skew cannot strand a started attempt or change authoritative game timing', () => usingFixture(async f => {
  for (const skew of [-2000, 2000]) {
    const handler = f.createHandler({ clock: () => Date.now() + skew });
    const attempt = await start(f, { handler });
    assert.equal(typeof attempt.attemptToken, 'string');
    for (const [version, moveId] of WIN_MOVES.entries()) {
      const response = await f.move(attempt.attemptToken, version, moveId, requestId(), { handler });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      if (version === 2) assert.equal(response.body.result.score, 16375);
    }
  }
  assert.equal(await f.count('attempts'), 2); assert.equal(await f.count('requests'), 6);
}));

test('browser scores, completion flags, paid-card flags and ordinary completion receipts are never authoritative input', () => usingFixture(async f => {
  for (const extra of [{ score: 999999 }, { seedHex: '0'.repeat(64) }, { completed: true }, { fifthMoveUnlocked: true }, { paidAdvantagesUsed: false }]) {
    const response = await f.call('start', { pilotId: f.rules.pilotId, expectedRulesHash: f.rulesHash, ...extra });
    assert.equal(response.status, 400);
  }
  assert.equal(await f.count('attempts'), 0);
  const attempt = await start(f);
  for (const extra of [{ score: 999999 }, { state: { won: true } }, { campaignId: 'another-campaign' }, { rulesHash: 'f'.repeat(64) }, { source: 'server-verification-adapter' }, { completed: true }, { fifthMoveUnlocked: true }]) {
    const response = await f.call('move', { attemptToken: attempt.attemptToken, expectedVersion: 0, requestId: requestId(), moveId: 19, ...extra });
    assert.equal(response.status, 400);
  }
  const receipt = await f.call('move', { receiptId: 'ordinary-saved-run', gameId: 'arborist-trials', completedAt: new Date().toISOString(), outcome: 'win', score: 999999 });
  assert.equal(receipt.status, 400); assert.equal(await f.count('requests'), 0);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken })).body.version, 0);
}));

test('the server rejects undealt, repeated and noninteger moves without advancing state', () => usingFixture(async f => {
  const attempt = await start(f);
  const undealt = Array.from({ length: 30 }, (_, i) => i + 1).find(id => !attempt.view.cards.some(card => card.id === id));
  assert.equal((await f.move(attempt.attemptToken, 0, undealt)).status, 400);
  assert.equal((await f.move(attempt.attemptToken, 0, 19.1)).status, 400);
  assert.equal((await f.move(attempt.attemptToken, 0, '19')).status, 400);
  assert.equal((await f.move(attempt.attemptToken, 0, 19)).status, 200);
  const repeated = await f.move(attempt.attemptToken, 1, 19);
  assert.equal(repeated.status, 400); assert.equal(repeated.body.error, 'illegal-move');
  const state = await f.call('status', { attemptToken: attempt.attemptToken });
  assert.equal(state.body.version, 1); assert.equal(state.body.view.cards.find(card => card.id === 19).playable, false);
  assert.equal(await f.count('requests'), 1);
}));

test('attempt ownership requires the original wallet, origin and exact signed-in session', () => usingFixture(async f => {
  const attempt = await start(f);
  await f.addSession({ rawToken: 'b'.repeat(64), wallet: '0x' + '2'.repeat(64) });
  await f.addSession({ rawToken: 'c'.repeat(64), wallet: WALLET });
  for (const token of ['b'.repeat(64), 'c'.repeat(64)]) {
    const response = await f.call('status', { attemptToken: attempt.attemptToken }, { rawToken: token });
    assert.equal(response.status, 404, JSON.stringify(response.body));
    assert.equal((await f.move(attempt.attemptToken, 0, 19, requestId(), { rawToken: token })).status, 404);
  }
  assert.equal((await f.call('status', { attemptToken: 'f'.repeat(64) })).status, 404);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken }, { origin: 'https://www.tree-token.xyz' })).status, 401);
  assert.equal(await f.count('requests'), 0);
}));

test('revoked and expired sessions cannot read or advance their existing attempt', () => usingFixture(async f => {
  const attempt = await start(f);
  await f.db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp() where token_sha256=$1', [f.session.tokenHash]);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken })).status, 401);
  assert.equal((await f.move(attempt.attemptToken, 0, 19)).status, 401);
  await f.db.query("update private.arcade_growth_sessions set revoked_at=null,issued_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where token_sha256=$1", [f.session.tokenHash]);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken })).status, 401);
  assert.equal(await f.count('requests'), 0);
}));

test('session authorization is repeated in the commit transaction after game calculation', () => usingFixture(async f => {
  const attempt = await start(f);
  const handler = f.createHandler({ rpc: async (name, args) => {
    if (name === 'arcade_challenge_pilot_commit_move_v1') await f.db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp() where token_sha256=$1', [f.session.tokenHash]);
    return f.rpc(name, args);
  } });
  const response = await f.move(attempt.attemptToken, 0, 19, requestId(), { handler });
  assert.equal(response.status, 401, JSON.stringify(response.body));
  assert.equal(await f.count('requests'), 0);
  assert.equal((await f.db.query('select version from private.arcade_challenge_pilot_attempts')).rows[0].version, 0);
}));

test('identical retries retain their original response after later moves, finish and pilot closure', () => usingFixture(async f => {
  const attempt = await start(f), firstId = requestId();
  const first = await f.move(attempt.attemptToken, 0, 19, firstId); assert.equal(first.status, 200);
  assert.deepEqual((await f.move(attempt.attemptToken, 0, 19, firstId)).body, first.body);
  await f.move(attempt.attemptToken, 1, 27);
  await f.move(attempt.attemptToken, 2, 19);
  await f.db.query("update private.arcade_challenge_pilot_configs set status='disabled' where pilot_id=$1", [f.rules.pilotId]);
  const retry = await f.move(attempt.attemptToken, 0, 19, firstId);
  assert.equal(retry.status, 200); assert.deepEqual(retry.body, first.body);
  assert.equal((await f.move(attempt.attemptToken, 0, 27, firstId)).status, 409);
  assert.equal((await f.move(attempt.attemptToken, 1, 19, firstId)).status, 409);
  assert.equal((await f.move(attempt.attemptToken, 3, 27)).status, 409);
  assert.equal(await f.count('requests'), 3);
}));

test('simultaneous identical requests produce one recorded move and identical responses', () => usingFixture(async f => {
  const attempt = await start(f), id = requestId();
  let loaded = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const handler = f.createHandler({ rpc: async (name, args) => {
    const value = await f.rpc(name, args);
    if (name === 'arcade_challenge_pilot_load_attempt_v1') { loaded += 1; if (loaded === 2) release(); await barrier; }
    return value;
  } });
  const results = await Promise.all([f.move(attempt.attemptToken, 0, 19, id, { handler }), f.move(attempt.attemptToken, 0, 19, id, { handler })]);
  assert.deepEqual(results.map(r => r.status), [200, 200]); assert.deepEqual(results[0].body, results[1].body);
  assert.equal(await f.count('requests'), 1);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken })).body.version, 1);
  // Two overlapping handler executions are tested. PGlite's single DB connection
  // does not prove cross-worker PostgreSQL lock scheduling; SQL uses row locks.
}));

test('simultaneous divergent requests at the same version accept exactly one move', () => usingFixture(async f => {
  const attempt = await start(f);
  let loaded = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const handler = f.createHandler({ rpc: async (name, args) => {
    const value = await f.rpc(name, args);
    if (name === 'arcade_challenge_pilot_load_attempt_v1') { loaded += 1; if (loaded === 2) release(); await barrier; }
    return value;
  } });
  const legal = attempt.view.legalMoveIds.slice(0, 2); assert.equal(legal.length, 2);
  const results = await Promise.all(legal.map(move => f.move(attempt.attemptToken, 0, move, requestId(), { handler })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409], JSON.stringify(results.map(r => r.body)));
  assert.equal(results.find(r => r.status === 409).body.error, 'version-conflict');
  assert.equal(await f.count('requests'), 1);
}));

test('changed rules, game build, challenge hash and server seed fail closed before another move', () => usingFixture(async f => {
  assert.equal((await f.call('start', { pilotId: f.rules.pilotId, expectedRulesHash: 'f'.repeat(64) })).status, 409);
  const attempt = await start(f);
  const changes = [
    record => ({ ...record, seedHex: 'f'.repeat(64) }),
    record => ({ ...record, challengeHash: 'f'.repeat(64) }),
    record => ({ ...record, sourceHash: 'f'.repeat(64) }),
    record => ({ ...record, rulesHash: 'f'.repeat(64) }),
    record => ({ ...record, config: { ...record.config, game: { ...record.config.game, version: 'unapproved-build' } } }),
  ];
  for (const change of changes) {
    const handler = f.createHandler({ rpc: async (name, args) => { const record = await f.rpc(name, args); return name === 'arcade_challenge_pilot_load_attempt_v1' ? change(record) : record; } });
    assert.equal((await f.move(attempt.attemptToken, 0, 19, requestId(), { handler })).status, 503);
  }
  assert.equal(await f.count('requests'), 0);
}));

test('the attempt deadline is exclusive and the database rechecks it after calculation', () => usingFixture(async f => {
  const attempt = await start(f);
  const atCutoff = f.createHandler({ rpc: async (name, args) => {
    const value = await f.rpc(name, args);
    return name === 'arcade_challenge_pilot_load_attempt_v1' ? { ...value, serverNow: attempt.expiresAt } : value;
  } });
  assert.equal((await f.move(attempt.attemptToken, 0, 19, requestId(), { handler: atCutoff })).status, 409);
  assert.equal(await f.count('requests'), 0);
  const handler = f.createHandler({ rpc: async (name, args) => {
    if (name === 'arcade_challenge_pilot_commit_move_v1') {
      const remaining = Date.parse(attempt.expiresAt) - Date.now() + 20;
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    }
    return f.rpc(name, args);
  } });
  const late = await f.move(attempt.attemptToken, 0, 19, requestId(), { handler });
  assert.equal(late.status, 409, JSON.stringify(late.body)); assert.equal(late.body.error, 'attempt-expired');
  assert.equal(await f.count('requests'), 0);
}, { endOffsetMs: 1200 }));

test('unknown, upcoming and disabled pilot states cannot start a run', () => usingFixture(async f => {
  assert.equal((await f.start()).status, 409);
  assert.equal(await f.count('attempts'), 0);
  await f.db.query("update private.arcade_challenge_pilot_configs set status='disabled' where pilot_id=$1", [f.rules.pilotId]);
  const config = await f.call('configuration', undefined, { pilotId: f.rules.pilotId });
  assert.equal(config.status, 200); assert.equal(config.body.pilotOpen, false);
  assert.equal((await f.start()).status, 409);
}, { startOffsetMs: 30000 }));

test('strict HTTP origins, methods, payload sizes and authentication reject unsupported requests', () => usingFixture(async f => {
  const attempt = await start(f);
  for (const patch of [{ origin: 'https://attacker.example' }, { urlOrigin: 'https://attacker.example' }, { headers: { 'sec-fetch-site': 'cross-site' } }]) assert.equal((await f.call('status', { attemptToken: attempt.attemptToken }, patch)).status, 403);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken }, { headers: { authorization: null } })).status, 401);
  assert.equal((await f.call('status', undefined, { method: 'GET' })).status, 405);
  assert.equal((await f.call('status', { attemptToken: attempt.attemptToken }, { headers: { 'content-type': 'text/plain' } })).status, 400);
  assert.equal((await f.call('status', {}, { rawBody: '{"padding":"' + 'x'.repeat(5000) + '"}' })).status, 413);
  assert.equal((await f.call('status', {}, { rawBody: '{broken json' })).status, 400);
  assert.equal((await f.call('status', {}, { rawBody: Buffer.from([0xff]) })).status, 400);
  assert.equal(await f.count('requests'), 0);
}));

test('a no-prize receipt cannot be passed directly to the funded-campaign allocation format', () => usingFixture(async f => {
  const attempt = await start(f), final = await win(f, attempt.attemptToken);
  const demo = syntheticDemo();
  assert.throws(() => planAllocation(demo.frozen, { ...demo.manifest, runs: [final.body] }, demo.asOf), /stable evidence ID/);
  const plan = planAllocation(demo.frozen, { ...demo.manifest, runs: [{ ...demo.manifest.runs[0], ...final.body }] }, demo.asOf);
  assert.equal(plan.accounting.qualifierCount, 0); assert.equal(plan.payable, false); assert.equal(plan.launchReady, false);
}));

test('server-only RPC transport scopes credentials and sanitizes unavailable/backend failures', async () => {
  const fakeSecret = 'local-fixture-secret-never-a-real-key', seen = [];
  const getEnv = name => name === 'ARCADE_GROWTH_SUPABASE_URL' ? 'https://local-pilot-fixture.supabase.co' : name === 'ARCADE_GROWTH_SUPABASE_SECRET_KEY' ? fakeSecret : undefined;
  const rpc = createPilotRpc({ getEnv, fetchImpl: async (url, init) => { seen.push({ url, init }); return Response.json({ message: 'challenge-request-conflict details ' + fakeSecret }, { status: 400 }); } });
  await assert.rejects(rpc('arcade_challenge_pilot_load_attempt_v1', { p_token_sha256: 'a'.repeat(64) }), error => error.code === 'request-conflict' && !error.message.includes(fakeSecret));
  assert.equal(seen[0].url, 'https://local-pilot-fixture.supabase.co/rest/v1/rpc/arcade_challenge_pilot_load_attempt_v1');
  assert.equal(seen[0].init.method, 'POST'); assert.equal(seen[0].init.headers.apikey, fakeSecret);
  await assert.rejects(rpc('arbitrary_table_reader', {}), /temporarily unavailable/); assert.equal(seen.length, 1);
  const broken = createPilotRpc({ getEnv, fetchImpl: async () => new Response('upstream proxy failed ' + fakeSecret, { status: 502 }) });
  await assert.rejects(broken('arcade_challenge_pilot_read_session_v1', {}), error => error.status === 503 && !error.message.includes(fakeSecret));
  assert.throws(() => createPilotRpc({ getEnv: () => undefined }), /temporarily unavailable/);
});
