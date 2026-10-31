import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createArcadeGrowthHandler, type ArcadeGrowthDependencies } from '../netlify/functions/arcade-growth.ts';
import { ArcadeGrowthError, GROWTH_ELIGIBLE_GAME_IDS, type GrowthSnapshot } from '../netlify/lib/arcade-growth-core.ts';
import { ARCADE_ENABLED_GAME_IDS } from '../netlify/lib/arcade-growth-games.ts';
import { readTreeforceParticipationSession, treeforceRunId, treeforceDatabaseIdentity, validateTreeforceTransportOptions,
  type TreeforceParticipationSession } from '../netlify/lib/arcade-treeforce-session.ts';
import type { ArcadeGrowthStore, GrowthTreeforcePlayInput, GrowthTreeforcePlayResult } from '../netlify/lib/arcade-growth-store.ts';

const ORIGIN = 'https://tree-token.xyz';
const WALLET = '0x' + 'a'.repeat(64);
const OTHER = '0x' + 'b'.repeat(64);
const RUN = 'grove-' + 'c'.repeat(32);
const SECOND_RUN = 'grove-' + 'd'.repeat(32);
const TOKEN = 'e'.repeat(64);
const HASH = createHash('sha256').update(TOKEN).digest('hex');
const NOW = new Date('2026-10-31T21:00:00.000Z');
const EXPIRES = '2026-10-31T22:00:00.000Z';
const session = (): TreeforceParticipationSession => ({ wallet: WALLET, runId: RUN, sessionExpiresAt: EXPIRES, verifiedAt: NOW.toISOString() });
const snapshot = (): GrowthSnapshot => ({ wallet: WALLET, dateKey: '2026-10-31', monthKey: '2026-10',
  enabledGames: [...ARCADE_ENABLED_GAME_IDS], eligibleGames: [...GROWTH_ELIGIBLE_GAME_IDS],
  checkins: ['2026-10-31'], quests: [{ dateKey: '2026-10-31', gameId: 'treeforce89' }],
  gamesByDay: [{ dateKey: '2026-10-31', gameIds: ['treeforce89'] }], badges: [] });
const receipt = (): GrowthTreeforcePlayResult => ({ snapshot: snapshot(), participation: {
  saved: true, runId: RUN, sourceId: `run:${RUN}:${WALLET}`, dateKey: '2026-10-31',
  recordedAt: NOW.toISOString(), alreadyRecorded: false,
} });

function fixture(overrides: ArcadeGrowthDependencies = {}) {
  const calls: GrowthTreeforcePlayInput[] = [];
  const order: string[] = [];
  const store = { recordTreeforcePlay: async (input: GrowthTreeforcePlayInput) => {
    order.push('write'); calls.push(structuredClone(input));
    const result = receipt(); result.participation.alreadyRecorded = calls.length > 1; return result;
  } } as ArcadeGrowthStore;
  const handler = createArcadeGrowthHandler({ env: { ARCADE_GROWTH_ENABLED: 'true' }, store,
    now: () => new Date(NOW),
    treeforceSession: async (input) => {
      order.push('authenticate'); assert.equal(input.tokenSha256, HASH); assert.equal(input.runId, RUN);
      return session();
    },
    ownership: async (wallet) => { order.push('ownership'); return { address: wallet, network: 'sui-mainnet', nftreeCount: 1 }; },
    ...overrides });
  async function call(payload: unknown = { runId: RUN }, options: { origin?: string | null; authorization?: string | null; site?: string; method?: string; action?: string } = {}) {
    const method = options.method || 'POST';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.origin !== null) headers.Origin = options.origin || ORIGIN;
    if (options.authorization !== null) headers.Authorization = options.authorization || `Bearer ${TOKEN}`;
    if (options.site) headers['Sec-Fetch-Site'] = options.site;
    const response = await handler(new Request(`${ORIGIN}/api/arcade-growth?action=${options.action || 'treeforce-play'}`, {
      method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }),
    }), { ip: '192.0.2.10' });
    return { response, data: await response.json() as any };
  }
  return { call, calls, order };
}

test('first-wave save authenticates existing game credential, rechecks ownership and session, and returns only its receipt', async () => {
  const f = fixture(); const { response, data } = await f.call();
  assert.equal(response.status, 200);
  assert.deepEqual(f.order, ['authenticate', 'ownership', 'authenticate', 'write']);
  assert.deepEqual(f.calls, [session()]);
  assert.deepEqual(data, { status: 'ok', participation: receipt().participation });
  assert.equal(JSON.stringify(data).includes(TOKEN), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('retries and continued original runs return one stable source identity', async () => {
  const f = fixture(); const first = await f.call(); const retry = await f.call();
  assert.equal(first.data.participation.alreadyRecorded, false);
  assert.equal(retry.data.participation.alreadyRecorded, true);
  assert.equal(retry.data.participation.sourceId, first.data.participation.sourceId);
  assert.equal(retry.data.participation.recordedAt, first.data.participation.recordedAt);
});

test('a midnight retry returns the original saved day without applying lobby current-day validation', async () => {
  const f = fixture({ now: () => new Date('2026-11-01T00:00:02Z') });
  const { response, data } = await f.call();
  assert.equal(response.status, 200); assert.equal(data.participation.dateKey, '2026-10-31');
});

test('client wallet, timestamps, outcomes, scores and achievement fields never reach storage', async () => {
  for (const field of ['wallet', 'dateKey', 'recordedAt', 'score', 'cleared', 'completed', 'achievement', 'action']) {
    const f = fixture(); const { response } = await f.call({ runId: RUN, [field]: 'untrusted' });
    assert.equal(response.status, 400, field); assert.deepEqual(f.order, []); assert.equal(f.calls.length, 0);
  }
});

test('missing or invalid game identity and credential fail before ownership/storage', async () => {
  for (const runId of [undefined, '', 'grove-1', RUN.toUpperCase(), 'x'.repeat(10000)]) {
    const f = fixture(); assert.equal((await f.call({ runId })).response.status, 400); assert.deepEqual(f.order, []);
  }
  for (const authorization of [null, 'Bearer invalid', `Bearer ${TOKEN.toUpperCase()}`, `Basic ${TOKEN}`]) {
    const f = fixture(); assert.equal((await f.call({ runId: RUN }, { authorization })).response.status, 401); assert.deepEqual(f.order, []);
  }
});

test('missing, foreign and cross-site browser origins cannot report participation', async () => {
  for (const origin of [null, 'null', 'https://unrelated.example', 'https://tree-token.xyz.evil.example']) {
    const f = fixture(); assert.equal((await f.call(undefined, { origin })).response.status, 403); assert.deepEqual(f.order, []);
  }
  const f = fixture(); assert.equal((await f.call(undefined, { site: 'cross-site' })).response.status, 403); assert.deepEqual(f.order, []);
});

test('read-only or disabled endpoint cannot save and unknown/expired game sessions never fall back to Daily Growth auth', async () => {
  assert.equal((await fixture().call(undefined, { method: 'GET' })).response.status, 405);
  const disabled = fixture({ env: { ARCADE_GROWTH_ENABLED: 'false' } });
  assert.equal((await disabled.call()).response.status, 503); assert.deepEqual(disabled.order, []);
  const expired = fixture({ treeforceSession: async () => { throw new ArcadeGrowthError('invalid-game-session', 'Expired', 401); } });
  assert.equal((await expired.call()).response.status, 401); assert.equal(expired.calls.length, 0);
});

test('ownership failure and session revocation during ownership lookup cannot save', async () => {
  const noNft = fixture({ ownership: async () => ({ address: WALLET, network: 'sui-mainnet', nftreeCount: 0 }) });
  assert.equal((await noNft.call()).response.status, 403); assert.equal(noNft.calls.length, 0);
  let reads = 0;
  const revoked = fixture({ treeforceSession: async () => {
    if (++reads === 2) throw new ArcadeGrowthError('invalid-game-session', 'Expired', 401);
    return session();
  } });
  assert.equal((await revoked.call()).response.status, 401); assert.equal(reads, 2); assert.equal(revoked.calls.length, 0);
});

test('changed account or run during the final authentication fails closed', async () => {
  for (const change of [{ wallet: OTHER }, { runId: SECOND_RUN }]) {
    let reads = 0;
    const f = fixture({ treeforceSession: async () => ({ ...session(), ...(++reads === 2 ? change : {}) }) });
    assert.equal((await f.call()).response.status, 409); assert.equal(f.calls.length, 0);
  }
});

test('private database and token details never escape storage errors', async () => {
  const f = fixture({ treeforceSession: async () => { throw Error(`postgres://private:secret@internal.invalid ${TOKEN}`); } });
  const { response, data } = await f.call();
  assert.equal(response.status, 503); assert.equal(JSON.stringify(data).includes('postgres'), false);
  assert.equal(JSON.stringify(data).includes(TOKEN), false); assert.equal(f.calls.length, 0);
});

test('session reader queries only the exact hashed credential and derives the wallet and timestamps from its row', async () => {
  let count = 0;
  const value = await readTreeforceParticipationSession({ tokenSha256: HASH, runId: RUN, env: {}, now: NOW,
    query: async (text, values) => {
      count++; assert.match(text, /^SELECT /); assert.match(text, /FROM public\.tree_game_sessions/);
      assert.equal(/\b(UPDATE|INSERT|DELETE|CREATE|ALTER|DROP)\b/.test(text), false);
      assert.deepEqual(values, [HASH]); assert.equal(text.includes(TOKEN), false);
      return { rows: [{ wallet: WALLET, run_id: RUN, expires_at: EXPIRES, verified_at: NOW.toISOString() }] };
    } });
  assert.equal(count, 1); assert.deepEqual(value, session());
});

test('session reader rejects missing, expired, changed, stale and ambiguous records', async () => {
  const row = { wallet: WALLET, run_id: RUN, expires_at: EXPIRES, verified_at: NOW.toISOString() };
  for (const [rows, status] of [
    [[], 401], [[{ ...row, expires_at: NOW.toISOString() }], 401],
    [[{ ...row, run_id: SECOND_RUN }], 409], [[{ ...row, verified_at: '2026-10-31T20:59:40Z' }], 503],
    [[{ ...row, verified_at: '2026-10-31T21:00:10Z' }], 503], [[{ ...row, wallet: 'not-a-wallet' }], 503], [[row, row], 503],
  ] as const) {
    await assert.rejects(() => readTreeforceParticipationSession({ tokenSha256: HASH, runId: RUN, env: {}, now: NOW,
      query: async () => ({ rows: [...rows] }) }), (error: unknown) => error instanceof ArcadeGrowthError && error.status === status);
  }
});

test('database binding refuses defaults, unapproved providers and a different Netlify database', async () => {
  for (const url of ['', 'https://example.com', 'postgres://x:y@host.example/db',
    'postgres://x:y@unrelated.db.netlify.com/netlifydb', 'postgres://x:y@unrelated.db.netlify.com/production']) {
    assert.throws(() => treeforceDatabaseIdentity(url), (error: unknown) => error instanceof ArcadeGrowthError && error.status === 503);
  }
  await assert.rejects(() => readTreeforceParticipationSession({ tokenSha256: HASH, runId: RUN, env: { NETLIFY_DB_URL: 'postgres://private' }, now: NOW }),
    (error: unknown) => error instanceof ArcadeGrowthError && error.status === 503);
  assert.equal(treeforceRunId(RUN), RUN);
});

test('database transport options cannot override authority or load local TLS files', () => {
  const base = 'postgres://netlifydb_owner:fixture@unrelated.db.netlify.com/netlifydb?sslmode=require';
  assert.doesNotThrow(() => validateTreeforceTransportOptions(new URL(base + '&channel_binding=require')));
  for (const option of ['host=other.db.netlify.com', 'port=1234', 'user=other', 'password=other',
    'sslrootcert=/etc/passwd', 'sslcert=/tmp/fixture', 'sslkey=/tmp/fixture', 'options=-c%20search_path%3Devil',
    'sslmode=disable', 'channel_binding=disable']) {
    assert.throws(() => validateTreeforceTransportOptions(new URL(base + '&' + option)),
      (error: unknown) => error instanceof ArcadeGrowthError && error.status === 503);
  }
});

test('session timestamp freshness is checked after a slow lookup finishes', async () => {
  let clock = new Date(NOW);
  const value = await readTreeforceParticipationSession({ tokenSha256: HASH, runId: RUN, env: {}, now: () => clock,
    query: async () => {
      clock = new Date(NOW.getTime() + 7000);
      return { rows: [{ wallet: WALLET, run_id: RUN, expires_at: EXPIRES, verified_at: clock.toISOString() }] };
    } });
  assert.equal(value.verifiedAt, '2026-10-31T21:00:07.000Z');
});
