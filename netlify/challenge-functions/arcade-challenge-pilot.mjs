// Isolated no-prize service. Pilot sign-in never grants other Arcade access.
import { createHash, randomBytes } from 'node:crypto';
import { contentHash } from '../../scripts/arcade-campaigns/core.mjs';
import { ADAPTER, MAX_MOVES, createChallenge, inspectReplay, publicChallenge, TrialReplayError } from '../../scripts/arcade-campaigns/trials-adapter.mjs';
import { verifyPilotRecord, verifyPilotRules } from '../../scripts/arcade-campaigns/pilot-rules.mjs';
import { PilotError } from '../../scripts/arcade-campaigns/pilot-errors.mjs';
import { createPilotRpc } from '../../scripts/arcade-campaigns/pilot-rpc.mjs';
import { createPilotAuthenticator, PILOT_AUTH_ACTIONS, PILOT_SESSION_SCOPE } from '../../scripts/arcade-campaigns/pilot-auth.mjs';

const ORIGINS = ['https://tree-token.xyz', 'https://www.tree-token.xyz'];
const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const FLAGS = { mode: 'nonpaying-pilot', identityScope: 'wallet-session-only', payable: false, prizeEligible: false, awardsEnabled: false };
const hash = text => createHash('sha256').update(text).digest('hex');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const unavailable = () => new PilotError('service-unavailable', 'Challenge verification is temporarily unavailable.', 503);

async function readBody(req, maxBytes = 4096) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '') || req.headers.has('content-encoding')) throw new PilotError('invalid-request', 'Send an uncompressed JSON request.');
  const reader = req.body?.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', size = 0;
  try {
    if (reader) for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new PilotError('request-too-large', 'The request is too large.', 413); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    const body = JSON.parse(text);
    if (!plain(body)) throw Error('object required');
    return body;
  } catch (error) {
    if (error instanceof PilotError) throw error;
    throw new PilotError('invalid-request', 'Send a valid JSON object.');
  }
}

function validSession(session, origin, now) {
  if (!Number.isFinite(now) || !session || session.revoked !== false || session.origin !== origin || !/^0x[a-f0-9]{64}$/.test(session.wallet || '') || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now) throw new PilotError('invalid-session', 'Sign in to the Arcade again.', 401);
  return session;
}

function challengeForAttempt(record, session, base) {
  // The database owns these timestamps. Independent host-clock skew must not
  // discard a successfully committed start before its token reaches the player.
  if (!plain(record) || record.wallet !== session.wallet || record.origin !== base.p_origin || record.sessionHash !== base.p_token_sha256 || !UUID.test(record.attemptId || '') || !HEX.test(record.seedHex || '') || !HEX.test(record.challengeHash || '') || !Array.isArray(record.moves) || record.moves.length > MAX_MOVES || record.version !== record.moves.length || !['active', 'completed'].includes(record.status) || !Number.isFinite(Date.parse(record.serverNow)) || !Number.isFinite(Date.parse(record.startedAt)) || !Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= Date.parse(record.startedAt) || Date.parse(record.startedAt) > Date.parse(record.serverNow)) throw unavailable();
  const frozen = verifyPilotRules(record.config);
  if (record.pilotId !== frozen.rules.pilotId || record.rulesHash !== frozen.rulesHash || record.adapterId !== ADAPTER.id || record.adapterVersion !== ADAPTER.version || record.sourceHash !== ADAPTER.sourceHash || Date.parse(record.startedAt) < Date.parse(frozen.rules.window.startsAt) || Date.parse(record.startedAt) >= Date.parse(frozen.rules.window.endsAt) || Date.parse(record.expiresAt) > Date.parse(frozen.rules.window.endsAt) || Date.parse(record.expiresAt) > Date.parse(record.startedAt) + frozen.rules.maxAttemptSeconds * 1000 || Date.parse(record.expiresAt) > Date.parse(session.expiresAt)) throw unavailable();
  const challenge = createChallenge(record.seedHex, frozen.rules.challengeDate);
  if (contentHash(challenge) !== record.challengeHash) throw unavailable();
  return challenge;
}

function derivedResult(replay) {
  return { ...FLAGS, completed: replay.completed, won: replay.completed && replay.won, score: replay.score, rounds: replay.rounds, moveCount: replay.moveCount, ruleTargetMet: replay.completed && replay.won, outcome: replay.view.phase };
}

function stateResponse(record, replay) {
  return {
    status: 'ok', kind: 'arcade-challenge-pilot-state', ...FLAGS,
    attemptId: record.attemptId, pilotId: record.pilotId, rulesHash: record.rulesHash,
    adapterId: ADAPTER.id, adapterVersion: ADAPTER.version,
    gameId: ADAPTER.gameId, gameVersion: ADAPTER.gameVersion,
    version: record.version, startedAt: record.startedAt, expiresAt: record.expiresAt, serverNow: record.serverNow,
    completedAt: record.completedAt ?? null, attemptStatus: record.status,
    view: replay.view, result: record.status === 'completed' ? record.result : null,
  };
}

function checkedPublicResponse(value) {
  if (!plain(value) || value.status !== 'ok' || value.mode !== FLAGS.mode || value.identityScope !== FLAGS.identityScope || value.payable !== false || value.prizeEligible !== false || value.awardsEnabled !== false || !UUID.test(value.attemptId || '') || !Number.isSafeInteger(value.version) || value.version < 0 || value.version > MAX_MOVES || !plain(value.view) || !['active', 'completed'].includes(value.attemptStatus)) throw unavailable();
  const forbidden = new Set(['seed', 'seedHex', 'rng', 'sessionHash', 'token_sha256', 'attempt_token_sha256', 'secret', 'wallet', 'origin']);
  const walk = item => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) { if (forbidden.has(key)) throw unavailable(); walk(child); }
  };
  walk(value);
  if (value.result !== null && (!plain(value.result) || value.result.payable !== false || value.result.prizeEligible !== false || value.result.awardsEnabled !== false || value.result.identityScope !== FLAGS.identityScope)) throw unavailable();
  return value;
}

export function createChallengePilotHandler(deps = {}) {
  const clock = deps.clock || Date.now, entropy = deps.randomBytes || randomBytes;
  return async req => {
    try {
      const url = new URL(req.url), action = url.searchParams.get('action') || 'configuration';
      if (!['configuration', 'start', 'status', 'move', ...PILOT_AUTH_ACTIONS].includes(action)) throw new PilotError('not-found', 'Unknown challenge action.', 404);
      if (req.method !== (action === 'configuration' ? 'GET' : 'POST')) throw new PilotError('method-not-allowed', 'Method not allowed.', 405);
      const origin = req.headers.get('origin') || url.origin;
      if (!ORIGINS.includes(origin) || !ORIGINS.includes(url.origin) || req.headers.get('sec-fetch-site') === 'cross-site') throw new PilotError('origin-not-allowed', 'Use the official TREE Arcade.', 403);
      if (action === 'configuration' && !url.searchParams.has('pilotId')) return json({ status: 'ok', ...FLAGS, game: ADAPTER, pilotOpen: false, message: 'Arborist Trials pilot support. No funded campaign is open through this service.' });
      if (PILOT_AUTH_ACTIONS.includes(action)) {
        const authenticate = createPilotAuthenticator({ rpc: deps.rpc || createPilotRpc(), clock, entropy: deps.authRandomBytes, nonce: deps.authRandomUUID, verifyPersonalMessage: deps.verifyPersonalMessage });
        const result = await authenticate({ action, body: await readBody(req, action === 'auth-session' ? 24576 : 4096), origin, authorization: req.headers.get('authorization') });
        return json({ status: 'ok', ...FLAGS, ...result });
      }
      const auth = /^Bearer ((?:pilot_)?[a-f0-9]{64})$/.exec(req.headers.get('authorization') || '');
      if (!auth) throw new PilotError('invalid-session', 'Sign in to the Arcade first.', 401);
      const rpc = deps.rpc || createPilotRpc(), base = { p_token_sha256: hash(auth[1]), p_origin: origin };
      const session = validSession(await rpc('arcade_challenge_pilot_read_session_v1', base), origin, clock());
      if (session.sessionScope !== (auth[1].startsWith('pilot_') ? PILOT_SESSION_SCOPE : 'arcade')) throw new PilotError('invalid-session', 'Sign in to the challenge again.', 401);
      if (action === 'configuration') {
        const pilotId = url.searchParams.get('pilotId');
        if (!/^[a-z0-9][a-z0-9-]{5,79}$/.test(pilotId || '')) throw new PilotError('invalid-request', 'Choose a valid pilot.');
        const record = await rpc('arcade_challenge_pilot_load_config_v1', { ...base, p_pilot_id: pilotId });
        if (!record) throw new PilotError('pilot-not-found', 'This pilot is unavailable.', 404);
        const frozen = verifyPilotRecord(record), now = Date.parse(record.serverNow);
        return json({ status: 'ok', ...FLAGS, pilotOpen: record.enabled && now >= Date.parse(record.startsAt) && now < Date.parse(record.endsAt), serverNow: record.serverNow, rulesHash: frozen.rulesHash, rules: frozen.rules });
      }
      const body = await readBody(req);
      if (action === 'start') {
        if (!exact(body, ['pilotId', 'expectedRulesHash']) || !/^[a-z0-9][a-z0-9-]{5,79}$/.test(body.pilotId || '') || !HEX.test(body.expectedRulesHash || '')) throw new PilotError('invalid-request', 'Choose a pilot and its current rules.');
        const pilot = await rpc('arcade_challenge_pilot_load_config_v1', { ...base, p_pilot_id: body.pilotId });
        if (!pilot) throw new PilotError('pilot-not-found', 'This pilot is unavailable.', 404);
        const frozen = verifyPilotRecord(pilot);
        if (body.expectedRulesHash !== frozen.rulesHash) throw new PilotError('rules-changed', 'Reload the pilot rules before starting.', 409);
        const now = Date.parse(pilot.serverNow);
        if (!pilot.enabled || now < Date.parse(pilot.startsAt) || now >= Date.parse(pilot.endsAt)) throw new PilotError('pilot-not-open', 'This pilot is not open for play.', 409);
        const attemptToken = entropy(32).toString('hex'), seedHex = entropy(32).toString('hex');
        if (!HEX.test(attemptToken) || !HEX.test(seedHex)) throw unavailable();
        const challenge = createChallenge(seedHex, frozen.rules.challengeDate);
        const record = await rpc('arcade_challenge_pilot_start_v1', { ...base, p_pilot_id: body.pilotId, p_rules_hash: frozen.rulesHash, p_attempt_token_sha256: hash(attemptToken), p_seed_hex: seedHex, p_challenge_hash: contentHash(challenge) });
        validSession(session, origin, Date.parse(record.serverNow));
        const bound = challengeForAttempt(record, session, base);
        if (record.version !== 0 || record.seedHex !== seedHex || record.pilotId !== body.pilotId || record.rulesHash !== frozen.rulesHash || record.status !== 'active') throw unavailable();
        return json({ ...checkedPublicResponse(stateResponse(record, inspectReplay(bound, []))), attemptToken, challenge: publicChallenge(bound) });
      }
      const fields = action === 'status' ? ['attemptToken'] : ['attemptToken', 'expectedVersion', 'requestId', 'moveId'];
      if (!exact(body, fields) || !HEX.test(body.attemptToken || '') || (action === 'move' && (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || body.expectedVersion >= MAX_MOVES || !UUID.test(body.requestId || '') || !Number.isSafeInteger(body.moveId) || body.moveId < 1 || body.moveId > 30))) throw new PilotError('invalid-request', 'Send only the attempt token and a valid move request.');
      const attemptHash = hash(body.attemptToken);
      const record = await rpc('arcade_challenge_pilot_load_attempt_v1', { ...base, p_attempt_token_sha256: attemptHash, p_request_id: action === 'move' ? body.requestId : null });
      if (!record) throw new PilotError('attempt-not-found', 'This attempt is unavailable for this session.', 404);
      validSession(session, origin, Date.parse(record.serverNow));
      const challenge = challengeForAttempt(record, session, base);
      const requestHash = action === 'move' ? contentHash({ kind: 'arcade-pilot-move-v1', attemptId: record.attemptId, rulesHash: record.rulesHash, expectedVersion: body.expectedVersion, requestId: body.requestId, moveId: body.moveId }) : null;
      if (action === 'move' && record.replay) {
        if (record.replay.requestHash !== requestHash || record.replay.expectedVersion !== body.expectedVersion || record.replay.moveId !== body.moveId) throw new PilotError('request-conflict', 'This request identifier was already used for a different move.', 409);
        return json(checkedPublicResponse(record.replay.response));
      }
      const before = inspectReplay(challenge, record.moves);
      if (action === 'status') return json(checkedPublicResponse(stateResponse(record, before)));
      if (record.status !== 'active' || before.completed || before.view.phase === 'move-limit') throw new PilotError('attempt-finished', 'This attempt has already finished.', 409);
      if (Date.parse(record.serverNow) >= Date.parse(record.expiresAt)) throw new PilotError('attempt-expired', 'This attempt has expired.', 409);
      if (record.version !== body.expectedVersion) throw new PilotError('version-conflict', 'Reload the attempt before making another move.', 409);
      const next = inspectReplay(challenge, [...record.moves, body.moveId]);
      const terminal = next.completed || next.view.phase === 'move-limit';
      const response = stateResponse({ ...record, version: record.version + 1, status: terminal ? 'completed' : 'active', result: terminal ? derivedResult(next) : null }, next);
      // The DB rechecks session, current pilot status, deadlines, CAS and retry identity
      // while holding the attempt row lock. The client never submits this response/result.
      const saved = await rpc('arcade_challenge_pilot_commit_move_v1', { ...base, p_attempt_token_sha256: attemptHash, p_expected_version: body.expectedVersion, p_request_id: body.requestId, p_request_sha256: requestHash, p_move_id: body.moveId, p_public_response: response, p_terminal: terminal, p_result: terminal ? derivedResult(next) : null });
      return json(checkedPublicResponse(saved));
    } catch (error) {
      const failure = error instanceof PilotError ? error : error instanceof TrialReplayError ? new PilotError('illegal-move', 'Choose a currently available card.') : unavailable();
      return json({ status: 'error', ...FLAGS, error: failure.code, message: failure.message }, failure.status);
    }
  };
}

export default createChallengePilotHandler();
export const config = { path: '/api/arcade-challenge-pilot', method: ['GET', 'POST'], rateLimit: { action: 'rate_limit', aggregateBy: ['domain', 'ip'], windowSize: 60, windowLimit: 60 } };
