// Local PGlite fixture only. Never reads credentials or connects to a hosted DB.
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '../../../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';
import { createChallengePilotHandler } from '../../../netlify/challenge-functions/arcade-challenge-pilot.mjs';
import { makePilotRules } from '../../../scripts/arcade-campaigns/pilot-rules.mjs';
import { contentHash } from '../../../scripts/arcade-campaigns/core.mjs';
import { ADAPTER } from '../../../scripts/arcade-campaigns/trials-adapter.mjs';
import { pilotDatabaseError } from '../../../scripts/arcade-campaigns/pilot-errors.mjs';

export const ORIGIN = 'https://tree-token.xyz';
export const RAW_TOKEN = 'a'.repeat(64);
export const WALLET = '0x' + '1'.repeat(64);
export const WIN_SEED = '0'.repeat(63) + '5';
export const WIN_MOVES = [19, 27, 19];
export const hash = value => createHash('sha256').update(value).digest('hex');
export const requestId = randomUUID;

const RPC_FIELDS = {
  arcade_growth_read_session_v1: ['p_token_sha256', 'p_origin'],
  arcade_challenge_pilot_read_session_v1: ['p_token_sha256', 'p_origin'],
  arcade_challenge_pilot_auth_create_challenge_v1: ['p_challenge_id','p_wallet','p_origin','p_message','p_expires_at'],
  arcade_challenge_pilot_auth_read_challenge_v1: ['p_challenge_id'],
  arcade_challenge_pilot_auth_create_session_v1: ['p_challenge_id','p_wallet','p_origin','p_token_sha256','p_expires_at'],
  arcade_challenge_pilot_auth_revoke_session_v1: ['p_token_sha256','p_origin'],
  arcade_challenge_pilot_load_config_v1: ['p_token_sha256', 'p_origin', 'p_pilot_id'],
  arcade_challenge_pilot_start_v1: ['p_token_sha256', 'p_origin', 'p_pilot_id', 'p_rules_hash', 'p_attempt_token_sha256', 'p_seed_hex', 'p_challenge_hash'],
  arcade_challenge_pilot_load_attempt_v1: ['p_token_sha256', 'p_origin', 'p_attempt_token_sha256', 'p_request_id'],
  arcade_challenge_pilot_commit_move_v1: ['p_token_sha256', 'p_origin', 'p_attempt_token_sha256', 'p_expected_version', 'p_request_id', 'p_request_sha256', 'p_move_id', 'p_public_response', 'p_terminal', 'p_result'],
};

export async function createServiceFixture(options = {}) {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(fs.readFileSync(new URL('../arcade-monthly/growth.sql', import.meta.url), 'utf8'));
    await db.exec(fs.readFileSync(new URL('../../../supabase/migrations/20261118223908_arcade_challenge_pilot.sql', import.meta.url), 'utf8'));
    await db.exec(fs.readFileSync(new URL('../../../supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql', import.meta.url), 'utf8'));
    const now = Date.now();
    const rules = makePilotRules({
      pilotId: options.pilotId ?? 'local-arborist-pilot', challengeDate: '2026-11-18',
      startsAt: new Date(now + (options.startOffsetMs ?? -60000)).toISOString(),
      endsAt: new Date(now + (options.endOffsetMs ?? 3600000)).toISOString(),
      maxAttemptSeconds: options.maxAttemptSeconds ?? 900,
    });
    const rulesHash = contentHash(rules);

    async function addSession({ rawToken = RAW_TOKEN, wallet = WALLET, origin = ORIGIN, remainingMs = 3300000 } = {}) {
      const id = randomUUID(), tokenHash = hash(rawToken), expiry = new Date(Date.now() + remainingMs).toISOString();
      await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at)
        values($1,$2,$3,current_date,$4,repeat('fixture only ',10),$4,clock_timestamp()+interval '4 minutes')`, [id, wallet, origin, hash(id)]);
      await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at)
        values($1,$2,$3,$4,$5::timestamptz)`, [tokenHash, wallet, origin, id, expiry]);
      return { rawToken, tokenHash, wallet, origin, expiresAt: expiry };
    }
    const session = await addSession();

    async function addPilotSession({ rawToken = 'pilot_' + hash(randomUUID()), wallet = WALLET, origin = ORIGIN, remainingMs = 3300000 } = {}) {
      const id = randomUUID(), tokenHash = hash(rawToken), expiresAt = new Date(Date.now() + remainingMs).toISOString();
      await rpc('arcade_challenge_pilot_auth_create_challenge_v1', { p_challenge_id:id,p_wallet:wallet,p_origin:origin,
        p_message:'Synthetic local fixture challenge only. '.repeat(4),p_expires_at:new Date(Date.now()+240000).toISOString() });
      const value = await rpc('arcade_challenge_pilot_auth_create_session_v1', {
        p_challenge_id:id,p_wallet:wallet,p_origin:origin,p_token_sha256:tokenHash,p_expires_at:expiresAt,
      });
      return { rawToken,tokenHash,...value };
    }

    async function insertPilot(pilotRules = rules, status = options.pilotStatus ?? 'enabled') {
      await db.query(`insert into private.arcade_challenge_pilot_configs(pilot_id,status,rules_hash,adapter_id,adapter_version,source_hash,config,starts_at,ends_at,max_attempt_seconds)
        values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,$9::timestamptz,$10)`, [pilotRules.pilotId, status, contentHash(pilotRules), ADAPTER.id, ADAPTER.version, ADAPTER.sourceHash, JSON.stringify(pilotRules), pilotRules.window.startsAt, pilotRules.window.endsAt, pilotRules.maxAttemptSeconds]);
    }
    if (options.seedPilot !== false) await insertPilot();

    const calls = [];
    async function rpc(name, args) {
      const fields = RPC_FIELDS[name];
      if (!fields || Object.keys(args).length !== fields.length || fields.some(field => !Object.hasOwn(args, field))) throw Error('Unexpected local RPC shape: ' + name);
      calls.push(name);
      const values = fields.map(field => args[field] !== null && typeof args[field] === 'object' ? JSON.stringify(args[field]) : args[field]);
      // PGlite has one connection. Transactions isolate role changes, but this
      // harness does not claim to reproduce separate PostgreSQL worker locks.
      try {
        return await db.transaction(async tx => {
          await tx.exec('set local role service_role');
          const row = await tx.query(`select public.${name}(${fields.map((_, index) => '$' + (index + 1)).join(',')}) as value`, values);
          return row.rows[0].value;
        });
      } catch (error) { const mapped = pilotDatabaseError(error.message); mapped.cause = error; throw mapped; }
    }

    let entropyCount = 0;
    function entropy(size) {
      if (size !== 32) throw Error('Unexpected entropy length.');
      entropyCount += 1;
      return entropyCount % 2 ? Buffer.from(hash('local-attempt-' + entropyCount), 'hex') : Buffer.from(WIN_SEED, 'hex');
    }
    function createHandler(deps = {}) { return createChallengePilotHandler({ rpc, randomBytes: entropy, ...options.handlerDependencies, ...deps }); }
    const handler = createHandler();

    async function call(action, body, config = {}) {
      const target = config.handler ?? handler;
      const method = config.method ?? (action === 'configuration' ? 'GET' : 'POST');
      const headers = new Headers({ origin: config.origin ?? ORIGIN, authorization: 'Bearer ' + (config.rawToken ?? RAW_TOKEN), 'content-type': 'application/json' });
      for (const [name, value] of Object.entries(config.headers ?? {})) value === null ? headers.delete(name) : headers.set(name, value);
      const query = new URLSearchParams({ action });
      if (config.pilotId) query.set('pilotId', config.pilotId);
      const req = new Request((config.urlOrigin ?? ORIGIN) + '/api/arcade-challenge-pilot?' + query, { method, headers, ...(method === 'GET' || method === 'HEAD' ? {} : { body: config.rawBody ?? JSON.stringify(body) }) });
      const response = await target(req);
      return { status: response.status, headers: response.headers, body: await response.json() };
    }
    const start = (config = {}) => call('start', { pilotId: rules.pilotId, expectedRulesHash: rulesHash }, config);
    const move = (attemptToken, expectedVersion, moveId, id = randomUUID(), config = {}) => call('move', { attemptToken, expectedVersion, requestId: id, moveId }, config);
    const count = async table => {
      if (!['attempts', 'requests'].includes(table)) throw Error('Unknown test table.');
      return (await db.query(`select count(*)::int as n from private.arcade_challenge_pilot_${table}`)).rows[0].n;
    };
    return { db, rules, rulesHash, session, calls, handler, rpc, createHandler, addSession, addPilotSession, insertPilot, call, start, move, count, close: () => db.close() };
  } catch (error) { await db.close(); throw error; }
}

export function assertNoPrivateState(assert, payload, { allowAttemptToken = false } = {}) {
  const forbidden = new Set(['seed', 'seedHex', 'rng', 'botMoves', 'player2Moves', 'sessionHash', 'token_sha256', 'attempt_token_sha256', 'secret', 'wallet', 'origin']);
  if (!allowAttemptToken) forbidden.add('attemptToken');
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.equal(forbidden.has(key), false, 'Private field exposed: ' + key); inspect(child); }
  }
  inspect(payload);
}
