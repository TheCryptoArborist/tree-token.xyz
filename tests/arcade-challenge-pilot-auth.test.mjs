import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Ed25519Keypair } from '../vendor/arcade-monthly/node_modules/@mysten/sui/dist/keypairs/ed25519/index.mjs';
import { Secp256k1Keypair } from '../vendor/arcade-monthly/node_modules/@mysten/sui/dist/keypairs/secp256k1/index.mjs';
import { Secp256r1Keypair } from '../vendor/arcade-monthly/node_modules/@mysten/sui/dist/keypairs/secp256r1/index.mjs';
import { MultiSigPublicKey } from '../vendor/arcade-monthly/node_modules/@mysten/sui/dist/multisig/index.mjs';
import { pilotSignInMessage, verifyPilotPersonalMessage } from '../scripts/arcade-campaigns/pilot-auth.mjs';
import { createPilotRpc } from '../scripts/arcade-campaigns/pilot-rpc.mjs';
import { createServiceFixture, ORIGIN, RAW_TOKEN, WIN_MOVES, hash } from './fixtures/arcade-challenge-pilot/service-fixture.mjs';

async function fixture(fn) {
  const f = await createServiceFixture();
  try { return await fn(f); } finally { await f.close(); }
}
async function challenge(f, wallet, options) {
  const r = await f.call('auth-challenge', { wallet }, options);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.challenge.sessionScope, 'challenge-pilot');
  return r.body.challenge;
}
async function signIn(f, keypair = Ed25519Keypair.generate(), options) {
  const wallet = keypair.toSuiAddress(), issued = await challenge(f, wallet, options);
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const r = await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature }, options);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { session: r.body.session, issued, signature, wallet };
}

test('real Ed25519, Secp256k1 and Secp256r1 signatures create only scoped pilot sessions without NFTree ownership', () => fixture(async f => {
  const before = (await f.db.query('select count(*)::int as n from private.arcade_growth_sessions')).rows[0].n;
  for (const Type of [Ed25519Keypair, Secp256k1Keypair, Secp256r1Keypair]) {
    const { session, issued, wallet } = await signIn(f, Type.generate());
    assert.match(session.token, /^pilot_[a-f0-9]{64}$/);
    assert.equal(session.sessionScope, 'challenge-pilot');
    assert.equal(session.wallet, wallet); assert.equal(session.origin, ORIGIN);
    assert.ok(Date.parse(session.expiresAt) > Date.now() + 3500000);
    assert.ok(Date.parse(session.expiresAt) <= Date.now() + 3600000);
    assert.equal(issued.message, pilotSignInMessage({ wallet, origin: ORIGIN, challengeId: issued.challengeId, expiresAt: issued.expiresAt }));
    assert.match(issued.message, /Audience: tree-arcade:challenge-pilot:v1/);
    assert.match(issued.message, /No NFTree or purchase is required/);
    assert.match(issued.message, /grants no check-ins, rewards, event access, payments, transfers/);
    const read = await f.rpc('arcade_challenge_pilot_read_session_v1', { p_token_sha256: hash(session.token), p_origin: ORIGIN });
    assert.equal(read.sessionScope, 'challenge-pilot'); assert.equal(read.wallet, wallet);
  }
  assert.equal((await f.db.query('select count(*)::int as n from private.arcade_growth_sessions')).rows[0].n, before);
  assert.equal((await f.db.query('select count(*)::int as n from private.arcade_growth_wallet_challenges')).rows[0].n, 1);
  assert.equal(f.calls.some(name => name.startsWith('arcade_growth_')), false);
  assert.equal(await f.count('attempts'), 0);
}));

test('ordinary multisig personal messages verify with the pinned SDK and remain bound to the multisig address', () => fixture(async f => {
  const a = Ed25519Keypair.generate(), b = Secp256k1Keypair.generate();
  const publicKey = MultiSigPublicKey.fromPublicKeys({ threshold: 2, publicKeys: [{ publicKey: a.getPublicKey(), weight: 1 }, { publicKey: b.getPublicKey(), weight: 1 }] });
  const wallet = publicKey.toSuiAddress(), issued = await challenge(f, wallet), bytes = new TextEncoder().encode(issued.message);
  const signature = publicKey.combinePartialSignatures([(await a.signPersonalMessage(bytes)).signature, (await b.signPersonalMessage(bytes)).signature]);
  const r = await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.session.wallet, wallet);
  assert.equal(await verifyPilotPersonalMessage({ message: issued.message, signature, wallet: a.toSuiAddress() }), false);
}));

test('pilot token plays and resumes an authoritative match, and pilot logout cannot revoke a legacy Arcade session', () => fixture(async f => {
  const { session } = await signIn(f);
  const config = { rawToken: session.token };
  const started = await f.start(config);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const firstId = randomUUID();
  const first = await f.move(started.body.attemptToken, 0, WIN_MOVES[0], firstId, config);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual((await f.move(started.body.attemptToken, 0, WIN_MOVES[0], firstId, config)).body, first.body);
  assert.equal((await f.call('status', { attemptToken: started.body.attemptToken }, config)).body.version, 1);
  const legacyLogout = await f.call('auth-logout', {}, { rawToken: RAW_TOKEN });
  assert.equal(legacyLogout.status, 401);
  assert.equal((await f.start()).status, 200);
  const signedOut = await f.call('auth-logout', {}, config);
  assert.equal(signedOut.status, 200); assert.equal(signedOut.body.sessionScope, 'challenge-pilot');
  assert.equal((await f.call('status', { attemptToken: started.body.attemptToken }, config)).status, 401);
  assert.equal((await f.move(started.body.attemptToken, 0, WIN_MOVES[0], firstId, config)).status, 401);
  assert.equal((await f.call('auth-logout', {}, config)).status, 200);
  assert.equal((await f.start()).status, 200);
}));

test('neither complete nor stripped pilot tokens authorize the original Arcade session reader', () => fixture(async f => {
  const { session } = await signIn(f);
  for (const raw of [session.token, session.token.slice('pilot_'.length)]) {
    await assert.rejects(f.rpc('arcade_growth_read_session_v1', { p_token_sha256: hash(raw), p_origin: ORIGIN }), error => error.status === 401);
  }
  assert.equal((await f.start({ rawToken: session.token.slice('pilot_'.length) })).status, 401);
  const confused = f.createHandler({ rpc: async (name, args) => {
    const value = await f.rpc(name, args);
    return name === 'arcade_challenge_pilot_read_session_v1' ? { ...value, sessionScope: 'arcade' } : value;
  } });
  assert.equal((await f.start({ rawToken: session.token, handler: confused })).status, 401);
  let fetched = false;
  const transport = createPilotRpc({ getEnv: key => key.endsWith('_URL') ? 'https://fixture.supabase.co' : 'test-secret', fetchImpl: async () => { fetched = true; throw Error('Unexpected original Arcade call'); } });
  await assert.rejects(transport('arcade_growth_create_session_v1', {}), error => error.status === 503);
  await assert.rejects(transport('arcade_growth_read_session_v1', {}), error => error.status === 503);
  assert.equal(fetched, false);
}));

test('wrong wallet, message, signing intent, nonce, origin and expired challenge cannot issue a session', () => fixture(async f => {
  const key = Ed25519Keypair.generate(), other = Ed25519Keypair.generate(), wallet = key.toSuiAddress();
  const issued = await challenge(f, wallet), bytes = new TextEncoder().encode(issued.message);
  for (const signature of [
    (await key.signPersonalMessage(new TextEncoder().encode(issued.message + ' altered'))).signature,
    (await other.signPersonalMessage(bytes)).signature,
    (await key.signTransaction(bytes)).signature,
    'not-a-serialized-signature',
  ]) {
    const r = await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature });
    assert.equal(r.status, 403, JSON.stringify(r.body)); assert.equal(r.body.error, 'invalid-signature');
  }
  const { signature } = await key.signPersonalMessage(bytes);
  for (const changes of [{ wallet: other.toSuiAddress() }, { challengeId: randomUUID() }]) {
    assert.equal((await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature, ...changes })).status, 403);
  }
  assert.equal((await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature }, { origin: 'https://www.tree-token.xyz', urlOrigin: 'https://www.tree-token.xyz' })).status, 403);
  const expired = f.createHandler({ rpc: async (name, args) => {
    const record = await f.rpc(name, args);
    return name === 'arcade_challenge_pilot_auth_read_challenge_v1' ? { ...record, expiresAt: new Date(Date.now() - 1000).toISOString() } : record;
  } });
  assert.equal((await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature }, { handler: expired })).status, 403);
  assert.equal(f.calls.includes('arcade_challenge_pilot_auth_create_session_v1'), false);
}));

test('one-use nonce cannot issue a second session, and verifier outages never become an invalid signature or session', () => fixture(async f => {
  const { issued, signature, wallet } = await signIn(f);
  const again = await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature });
  assert.equal(again.status, 403); assert.equal(again.body.error, 'invalid-challenge');
  const key = Ed25519Keypair.generate(), next = await challenge(f, key.toSuiAddress());
  const outage = f.createHandler({ verifyPersonalMessage: async () => { throw Error('PRIVATE_ENVIRONMENT_DETAIL'); } });
  const r = await f.call('auth-session', { wallet: key.toSuiAddress(), challengeId: next.challengeId, signature: 'test-only-unavailable' }, { handler: outage });
  assert.equal(r.status, 503); assert.equal(r.body.error, 'verification-unavailable');
  assert.equal(JSON.stringify(r.body).includes('PRIVATE_ENVIRONMENT_DETAIL'), false);
  assert.equal(f.calls.filter(name => name === 'arcade_challenge_pilot_auth_create_session_v1').length, 1);
}));

test('database expiry is rechecked after signature verification without consuming the expired nonce', () => fixture(async f => {
  let expiresAt;
  const handler = f.createHandler({
    clock: () => Date.now() - 289000,
    verifyPersonalMessage: async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(expiresAt) - Date.now()) + 20));
      return true;
    },
  });
  const wallet = Ed25519Keypair.generate().toSuiAddress();
  const issued = await challenge(f, wallet, { handler }); expiresAt = issued.expiresAt;
  const r = await f.call('auth-session', { wallet, challengeId: issued.challengeId, signature: 'LOCAL_EXPIRY_TEST_ONLY' }, { handler });
  assert.equal(r.status, 403, JSON.stringify(r.body)); assert.equal(r.body.error, 'invalid-challenge');
  const state = (await f.db.query('select consumed_at is null as unconsumed,(select count(*)::int from private.arcade_challenge_pilot_sessions) as sessions from private.arcade_challenge_pilot_wallet_challenges where challenge_id=$1', [issued.challengeId])).rows[0];
  assert.deepEqual(state, { unconsumed: true, sessions: 0 });
}));

test('auth actions retain strict origins, methods, bounded JSON and reject reward or extra authority claims', () => fixture(async f => {
  const wallet = Ed25519Keypair.generate().toSuiAddress();
  for (const patch of [{ origin: 'https://attacker.example' }, { urlOrigin: 'https://attacker.example' }, { headers: { 'sec-fetch-site': 'cross-site' } }])
    assert.equal((await f.call('auth-challenge', { wallet }, patch)).status, 403);
  assert.equal((await f.call('auth-challenge', undefined, { method: 'GET' })).status, 405);
  for (const extra of [{ sessionScope: 'arcade' }, { payable: true }, { nftreeOwned: true }, { expiresAt: '2099-01-01T00:00:00Z' }])
    assert.equal((await f.call('auth-challenge', { wallet, ...extra })).status, 400);
  assert.equal((await f.call('auth-session', {}, { rawBody: JSON.stringify({ signature: 'x'.repeat(25000) }) })).status, 413);
  assert.equal((await f.call('auth-challenge', { wallet }, { headers: { 'content-type': 'text/plain' } })).status, 400);
  assert.equal((await f.call('auth-logout', { wallet })).status, 400);
  assert.equal(f.calls.includes('arcade_challenge_pilot_auth_create_session_v1'), false);
}));
