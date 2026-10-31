import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createArcadeGrowthHandler, type ArcadeGrowthDependencies } from '../netlify/functions/arcade-growth.ts';
import { ARCADE_ENABLED_GAME_IDS, type ArcadeGrowthGameEvent, type ArcadeGrowthGameSyncResult } from '../netlify/lib/arcade-growth-games.ts';
import { ArcadeGrowthError, buildGrowthProgress, growthChallengeMessage, growthConfiguration, validateGrowthEvents,
  type GrowthChallenge, type GrowthSession, type GrowthSnapshot } from '../netlify/lib/arcade-growth-core.ts';
import { SupabaseArcadeGrowthStore, arcadeGrowthSupabaseConfig, type ArcadeGrowthStore, type GrowthChallengeInput } from '../netlify/lib/arcade-growth-store.ts';

const WALLET = `0x${'a'.repeat(64)}`;
const OTHER = `0x${'b'.repeat(64)}`;
const ORIGIN = 'https://tree-token.xyz';
const DATE = '2026-10-31';
const NOW = new Date(`${DATE}T12:00:00.000Z`);
const TOKEN = 'c'.repeat(64);
const CHALLENGE_ID = '12345678-1234-4123-8123-123456789abc';
const SIGNATURE = 'a'.repeat(128);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const snapshot = (): GrowthSnapshot => ({ wallet: WALLET, dateKey: DATE, monthKey: '2026-10', enabledGames: [...ARCADE_ENABLED_GAME_IDS],
  checkins: [], quests: [], gamesByDay: [], badges: [] });
const event = (gameId: ArcadeGrowthGameEvent['gameId'] = 'garden-bot'): ArcadeGrowthGameEvent => ({
  source: 'garden-battles', sourceId: `${gameId === 'arborist-trials' ? 'trial' : 'battle'}:fixture-${gameId}:${WALLET}`,
  wallet: WALLET, gameId, completedAt: `${DATE}T10:00:00.000Z`,
  ...(gameId !== 'arborist-trials' ? { proofDigest: '1'.repeat(31) + '2' } : {}),
});
const results = (events: ArcadeGrowthGameEvent[] = []): ArcadeGrowthGameSyncResult => ({ events, checkedAt: NOW.toISOString(),
  games: ARCADE_ENABLED_GAME_IDS.map((gameId) => ({ gameId, status: events.some((e) => e.gameId === gameId) ? 'verified' : 'no-result' })) });

class MemoryStore implements ArcadeGrowthStore {
  current = snapshot(); challenge?: GrowthChallenge; createdChallenge?: GrowthChallengeInput;
  active: GrowthSession = { wallet: WALLET, origin: ORIGIN, expiresAt: `${DATE}T13:00:00.000Z`, revoked: false };
  sessions = new Map([[hash(TOKEN), this.active]]);
  writes = 0; createSessionCalls = 0; eventCalls = 0; lastEvents: ArcadeGrowthGameEvent[] = [];
  async publicRules() { return [...this.current.enabledGames]; }
  async createChallenge(input: GrowthChallengeInput) {
    this.createdChallenge = input;
    this.challenge = { challengeId: input.challengeId, wallet: input.wallet, origin: input.origin, dateKey: input.dateKey,
      message: input.message, expiresAt: input.expiresAt, consumed: false };
    return structuredClone(this.challenge);
  }
  async readChallenge(id: string) {
    if (!this.challenge || id !== this.challenge.challengeId) throw new ArcadeGrowthError('expired-challenge', 'Expired', 401);
    return structuredClone(this.challenge);
  }
  async createSession(input: { challengeId: string; wallet: string; origin: string; tokenSha256: string; expiresAt: string }) {
    this.createSessionCalls++;
    if (!this.challenge || this.challenge.consumed) throw new ArcadeGrowthError('expired-challenge', 'Used', 401);
    this.challenge.consumed = true;
    const session = { wallet: input.wallet, origin: input.origin, expiresAt: input.expiresAt, revoked: false };
    this.sessions.set(input.tokenSha256, session); return session;
  }
  async readSession(token: string, origin: string) {
    const value = this.sessions.get(token);
    if (!value || value.revoked || value.origin !== origin) throw new ArcadeGrowthError('invalid-session', 'Invalid', 401);
    return structuredClone(value);
  }
  async revokeSession(token: string) { const value = this.sessions.get(token); if (value) value.revoked = true; }
  async snapshot(token: string, origin: string) { await this.readSession(token, origin); return structuredClone(this.current); }
  async checkIn(token: string, origin: string) {
    await this.readSession(token, origin); this.writes++;
    if (!this.current.checkins.includes(DATE)) this.current.checkins.push(DATE);
    return structuredClone(this.current);
  }
  async recordEvents(token: string, origin: string, _games: readonly string[], day: string, events: ArcadeGrowthGameEvent[]) {
    await this.readSession(token, origin); this.eventCalls++; this.lastEvents = events;
    if (day !== this.current.dateKey) throw new ArcadeGrowthError('utc-day-changed', 'Refresh', 409);
    if (events.length) {
      if (!this.current.checkins.includes(day)) this.current.checkins.push(day);
      if (!this.current.quests.some((q) => q.dateKey === day)) this.current.quests.push({ dateKey: day, gameId: events[0].gameId });
      const existing = this.current.gamesByDay.find((g) => g.dateKey === day);
      const ids = [...new Set([...(existing?.gameIds || []), ...events.map((e) => e.gameId)])];
      if (existing) existing.gameIds = ids; else this.current.gamesByDay.push({ dateKey: day, gameIds: ids });
    }
    return structuredClone(this.current);
  }
}

function fixture(overrides: ArcadeGrowthDependencies = {}) {
  const store = overrides.store || new MemoryStore(); let ownerCalls = 0; let signedMessage = '';
  const handler = createArcadeGrowthHandler({ env: { ARCADE_GROWTH_ENABLED: 'true', ARCADE_GROWTH_RATE_LIMIT_SECRET: 's'.repeat(32) },
    store, now: () => new Date(NOW), randomToken: () => TOKEN, randomId: () => CHALLENGE_ID,
    verifySignature: async (message) => { signedMessage = new TextDecoder().decode(message); return true; },
    ownership: async (wallet) => { ownerCalls++; return { address: wallet, network: 'sui-mainnet', nftreeCount: 1 }; },
    syncGames: async () => results(), ...overrides });
  async function call(action = 'status', value: unknown = {}, options: { origin?: string; token?: string | null; method?: string; raw?: string } = {}) {
    const method = options.method || (action === 'status' ? 'GET' : 'POST');
    const headers: Record<string, string> = { Origin: options.origin || ORIGIN };
    if (options.token !== null) headers.Authorization = `Bearer ${options.token || TOKEN}`;
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    const response = await handler(new Request(`${ORIGIN}/api/arcade-growth?action=${action}`, { method, headers,
      ...(method === 'GET' ? {} : { body: options.raw ?? JSON.stringify(value) }) }), { ip: '192.0.2.1' });
    return { response, data: await response.json() as any };
  }
  return { store: store as MemoryStore, call, ownerCalls: () => ownerCalls, signedMessage: () => signedMessage };
}

test('anonymous status exposes frozen rules and rotating pick without private progress or fabricated zero counts', async () => {
  const f = fixture(); const { response, data } = await f.call('status', {}, { token: null, origin: 'https://review.example' });
  assert.equal(response.status, 200); assert.equal(data.authenticated, false);
  assert.equal('progress' in data, false); assert.equal('checkedInDays' in data, false);
  assert.deepEqual(data.configuration.enabledGames.map((g: any) => g.id), [...ARCADE_ENABLED_GAME_IDS]);
  assert.equal(data.configuration.resetAt, '2026-11-01T00:00:00.000Z');
  assert.equal(f.ownerCalls(), 0); assert.equal(f.store.writes, 0);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('any explicit enable override except exact true disables the feature before storage or ownership', async () => {
  for (const flag of ['false', '', 'TRUE', '1', '0', ' true ', 'invalid']) {
    const f = fixture({ env: { ARCADE_GROWTH_ENABLED: flag, TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET: 's'.repeat(32) } });
    for (const action of ['status', 'challenge', 'session', 'check-in', 'sync']) assert.equal((await f.call(action)).response.status, 503);
    assert.equal(f.ownerCalls(), 0); assert.equal(f.store.writes, 0); assert.equal(f.store.createdChallenge, undefined);
  }
});

test('reviewed release defaults enabled with complete existing configuration and rate-secret fallback', async () => {
  const env = { TREE_RAFFLE_SUPABASE_URL: 'https://project.supabase.co', TREE_RAFFLE_SUPABASE_SECRET_KEY: 'server-secret',
    TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET: 's'.repeat(32) };
  assert.deepEqual(arcadeGrowthSupabaseConfig(env), { url: env.TREE_RAFFLE_SUPABASE_URL, secretKey: env.TREE_RAFFLE_SUPABASE_SECRET_KEY });
  const f = fixture({ env });
  assert.equal((await f.call('status', {}, { token: null })).response.status, 200);
  assert.equal((await f.call('challenge', { wallet: WALLET }, { token: null })).response.status, 200);
  assert.match(f.store.createdChallenge!.requestFingerprint, /^[0-9a-f]{64}$/);
  assert.equal((await f.call('check-in')).response.status, 200);
});

test('enabled-by-default never bypasses missing storage or missing and invalid sign-in protection', async () => {
  const unconfigured = createArcadeGrowthHandler({ env: {} });
  const response = await unconfigured(new Request(`${ORIGIN}/api/arcade-growth?action=status`));
  assert.equal(response.status, 503); assert.equal((await response.json()).error, 'service-unavailable');
  for (const env of [{}, { TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET: 's'.repeat(31) },
    { ARCADE_GROWTH_RATE_LIMIT_SECRET: 'short', TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET: 's'.repeat(32) }]) {
    const f = fixture({ env });
    assert.equal((await f.call('challenge', { wallet: WALLET }, { token: null })).response.status, 503);
    assert.equal(f.store.createdChallenge, undefined); assert.equal(f.ownerCalls(), 0);
  }
});

test('canonical origin, wallet, UTC date and nonce are bound into the exact signed message', async () => {
  const f = fixture(); const { data } = await f.call('challenge', { wallet: WALLET }, { token: null });
  assert.equal(data.challenge.challengeId, CHALLENGE_ID);
  assert.match(data.challenge.message, /URI: https:\/\/tree-token.xyz\/play\//);
  assert.ok(data.challenge.message.includes(`Wallet: ${WALLET}\nUTC date: ${DATE}`));
  assert.match(data.challenge.message, /does not authorize a transaction/);
  assert.equal(data.challenge.expiresAt, `${DATE}T12:05:00.000Z`);
  assert.equal(f.store.createdChallenge!.nonceSha256, hash(TOKEN));
  assert.match(f.store.createdChallenge!.requestFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(data).includes('192.0.2.1'), false);
  const login = await f.call('session', { wallet: WALLET, challengeId: CHALLENGE_ID, signature: SIGNATURE }, { token: null });
  assert.equal(login.response.status, 200); assert.equal(f.signedMessage(), data.challenge.message);
  assert.equal(login.data.session.token, TOKEN); assert.equal(login.data.progress.checkedInDays, 0);
  assert.equal(f.store.sessions.has(TOKEN), false, 'only token hash reaches the server store');
  assert.equal(f.store.sessions.has(hash(TOKEN)), true);
});

test('preview/foreign origins cannot authenticate or write; www is bound separately', async () => {
  const f = fixture();
  for (const origin of ['https://review.example', 'https://tree-token.xyz.evil.test', 'null']) {
    for (const action of ['challenge', 'session', 'check-in', 'sync', 'status']) assert.equal((await f.call(action, {}, { origin })).response.status, 403);
  }
  await f.call('challenge', { wallet: WALLET });
  const wrongOrigin = await f.call('session', { wallet: WALLET, challengeId: CHALLENGE_ID, signature: SIGNATURE }, { origin: 'https://www.tree-token.xyz' });
  assert.equal(wrongOrigin.data.error, 'expired-challenge');
  assert.equal(f.store.createSessionCalls, 0);
});

test('invalid signature, changed wallet and expired challenge never create a session', async () => {
  const f = fixture({ verifySignature: async () => false }); await f.call('challenge', { wallet: WALLET });
  assert.equal((await f.call('session', { wallet: WALLET, challengeId: CHALLENGE_ID, signature: SIGNATURE })).data.error, 'invalid-signature');
  assert.equal((await f.call('session', { wallet: OTHER, challengeId: CHALLENGE_ID, signature: SIGNATURE })).data.error, 'expired-challenge');
  f.store.challenge!.expiresAt = `${DATE}T11:59:59.000Z`;
  assert.equal((await f.call('session', { wallet: WALLET, challengeId: CHALLENGE_ID, signature: SIGNATURE })).data.error, 'expired-challenge');
  assert.equal(f.store.createSessionCalls, 0); assert.equal(f.ownerCalls(), 1);
});

test('verification network failure is unavailable, never mislabeled as a bad signature', async () => {
  const f = fixture({ verifySignature: async () => { throw new Error('private transport detail'); } });
  await f.call('challenge', { wallet: WALLET });
  const { response, data } = await f.call('session', { wallet: WALLET, challengeId: CHALLENGE_ID, signature: SIGNATURE });
  assert.equal(response.status, 503); assert.equal(data.error, 'verification-unavailable');
  assert.equal(JSON.stringify(data).includes('private transport'), false); assert.equal(f.store.createSessionCalls, 0);
});

test('replayed and concurrent session requests consume one challenge at most once', async () => {
  const f = fixture(); await f.call('challenge', { wallet: WALLET });
  const payload = { wallet: WALLET, challengeId: CHALLENGE_ID, signature: SIGNATURE };
  const replies = await Promise.all([f.call('session', payload), f.call('session', payload)]);
  assert.deepEqual(replies.map((r) => r.response.status).sort(), [200, 401]);
  assert.equal((await f.call('session', payload)).data.error, 'expired-challenge');
});

test('ownership is freshly checked on every write; no eligible NFT or partial scan cannot grant progress', async () => {
  for (const ownership of [async () => ({ address: WALLET, network: 'sui-mainnet', nftreeCount: 0 }),
    async () => { throw new Error('partial scan'); }, async () => ({ address: OTHER, network: 'sui-mainnet', nftreeCount: 9 })]) {
    const f = fixture({ ownership });
    for (const action of ['check-in', 'sync']) assert.ok((await f.call(action)).response.status >= 400);
    assert.equal(f.store.writes, 0); assert.equal(f.store.eventCalls, 0);
  }
  const f = fixture(); await f.call('check-in'); await f.call('check-in');
  assert.equal(f.ownerCalls(), 2); assert.deepEqual(f.store.current.checkins, [DATE]); assert.equal(f.store.current.quests.length, 0);
});

test('client game claims, day overrides and malformed bodies are rejected without source or DB writes', async () => {
  const f = fixture();
  for (const value of [{ events: [event()] }, { dateKey: '2026-10-01' }, { checkedIn: true }, { wallet: OTHER }]) {
    assert.equal((await f.call('sync', value)).response.status, 400);
  }
  assert.equal((await f.call('check-in', {}, { raw: '{' })).response.status, 400);
  assert.equal((await f.call('check-in', {}, { raw: ' '.repeat(16_385) })).response.status, 413);
  assert.equal(f.store.writes, 0); assert.equal(f.store.eventCalls, 0); assert.equal(f.ownerCalls(), 0);
});

test('missing, revoked and expired bearer sessions cannot write; logout needs no ownership', async () => {
  const f = fixture();
  assert.equal((await f.call('check-in', {}, { token: null })).data.error, 'authentication-required');
  assert.equal((await f.call('check-in', {}, { token: 'x' })).data.error, 'invalid-session');
  f.store.active.expiresAt = `${DATE}T11:00:00.000Z`;
  assert.equal((await f.call('check-in')).data.error, 'invalid-session');
  f.store.active.expiresAt = `${DATE}T13:00:00.000Z`;
  assert.equal((await f.call('logout')).response.status, 200);
  assert.equal((await f.call('check-in')).data.error, 'invalid-session'); assert.equal(f.ownerCalls(), 0);
});

test('verified official participation grants one quest and attendance while collecting all passport games', async () => {
  const f = fixture({ syncGames: async () => results(ARCADE_ENABLED_GAME_IDS.map(event)) });
  const first = await f.call('sync'); const second = await f.call('sync');
  assert.equal(first.response.status, 200); assert.equal(second.response.status, 200);
  assert.equal(first.data.progress.checkedInDays, 1); assert.equal(first.data.progress.questDays, 1);
  assert.equal(first.data.progress.passport.complete, true); assert.equal(first.data.progress.today.gameIds.length, 3);
  assert.equal(first.data.progress.calendar.length, 31); assert.equal(f.store.lastEvents.length, 3);
});

test('partial or unavailable game sources preserve saved credit and never fabricate new attendance', async () => {
  const syncGames = async () => ({ events: [], checkedAt: NOW.toISOString(),
    games: ARCADE_ENABLED_GAME_IDS.map((gameId) => ({ gameId, status: 'unavailable' as const, message: 'Source unavailable.' })) });
  const f = fixture({ syncGames }); const first = await f.call('sync');
  assert.equal(first.data.progress.checkedInDays, 0); assert.ok(first.data.sync.games.every((g: any) => g.status === 'unavailable'));
  await f.call('check-in'); const second = await f.call('sync');
  assert.equal(second.data.progress.checkedInDays, 1); assert.equal(second.data.progress.questDays, 0);
  assert.equal(second.data.sync.games.length, 3);
});

test('a validated positive result can grant credit while incomplete history remains explicitly partial', async () => {
  const f = fixture({ syncGames: async () => ({ events: [event('pvp')], checkedAt: NOW.toISOString(),
    games: ARCADE_ENABLED_GAME_IDS.map((gameId) => ({ gameId, status: gameId === 'arborist-trials' ? 'no-result' as const : 'partial' as const })) }) });
  const { response, data } = await f.call('sync');
  assert.equal(response.status, 200); assert.equal(data.progress.questDays, 1);
  assert.deepEqual(data.progress.passport.completedGameIds, ['pvp']);
  assert.equal(data.progress.passport.complete, false);
  assert.equal(data.sync.games.find((game: any) => game.gameId === 'pvp').status, 'partial');
  assert.equal(data.sync.games.find((game: any) => game.gameId === 'garden-bot').status, 'partial');
});

test('the DB revalidates a session revoked while ownership is in flight', async () => {
  const store = new MemoryStore();
  const f = fixture({ store, ownership: async () => { store.active.revoked = true; return { address: WALLET, network: 'sui-mainnet', nftreeCount: 1 }; } });
  assert.equal((await f.call('check-in')).data.error, 'invalid-session'); assert.equal(store.writes, 0);
});

test('source lookups crossing UTC midnight never credit the old day as today', async () => {
  let time = new Date(`${DATE}T23:59:59.000Z`);
  const store = new MemoryStore(); store.active.expiresAt = '2026-11-01T00:30:00.000Z';
  const f = fixture({ store, now: () => new Date(time), syncGames: async () => { time = new Date('2026-11-01T00:00:01.000Z'); return results([event()]); } });
  assert.equal((await f.call('sync')).data.error, 'utc-day-changed'); assert.equal(store.eventCalls, 0);
});

test('malformed, wrong-wallet, duplicated, future or old-day events fail closed before persistence', async () => {
  for (const events of [[{ ...event(), wallet: OTHER }], [{ ...event(), gameId: 'tree-force-89' }],
    [{ ...event(), completedAt: '2026-10-30T23:59:59.000Z' }], [{ ...event(), completedAt: '2026-10-31T13:00:00.000Z' }], [event(), event()]]) {
    const f = fixture({ syncGames: async () => results(events as ArcadeGrowthGameEvent[]) });
    assert.equal((await f.call('sync')).response.status, 503); assert.equal(f.store.eventCalls, 0);
  }
});

test('progress validation rejects inconsistent saved data; full month includes future empty days and permanent badges', () => {
  const data = snapshot(); data.checkins = ['2026-10-01', '2026-10-02', DATE];
  data.badges = [{ id: 'seedling', monthKey: '2026-09', earnedAt: '2026-09-03T12:00:00Z' }];
  const progress = buildGrowthProgress(data);
  assert.equal(progress.calendar.length, 31); assert.equal(progress.milestones[0].earned, true);
  assert.equal(progress.badges[0].label, 'Seedling'); assert.equal(progress.badges[0].monthKey, '2026-09');
  assert.throws(() => buildGrowthProgress({ ...data, quests: [{ dateKey: DATE, gameId: 'pvp' }] }));
  assert.throws(() => buildGrowthProgress({ ...data, checkins: [DATE, DATE] }));
  const feb = { ...snapshot(), dateKey: '2028-02-01', monthKey: '2028-02' };
  assert.equal(buildGrowthProgress(feb).calendar.length, 29);
  assert.ok(buildGrowthProgress(feb).calendar.slice(1).every((day) => !day.checkedIn && !day.questCompleted));
  assert.notEqual(growthConfiguration(ARCADE_ENABLED_GAME_IDS, NOW).todayPick.id,
    growthConfiguration(ARCADE_ENABLED_GAME_IDS, new Date('2026-11-01T00:00:00Z')).todayPick.id);
  for (let day = 1; day <= 31; day++) assert.notEqual(growthConfiguration(ARCADE_ENABLED_GAME_IDS,
    new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`)).todayPick.id, 'pvp');
  assert.ok(growthConfiguration(ARCADE_ENABLED_GAME_IDS, NOW).enabledGames.some((game) => game.id === 'pvp'));
});

test('challenge format rejects other origins and result validator accepts only current wallet-owned events', () => {
  assert.throws(() => growthChallengeMessage({ wallet: WALLET, origin: 'https://preview.test', challengeId: CHALLENGE_ID,
    nonce: TOKEN, now: NOW, expiresAt: `${DATE}T12:05:00.000Z` }));
  assert.deepEqual(validateGrowthEvents([event()], WALLET, DATE, NOW), [event()]);
});

test('Supabase configuration pairs are never mixed and private errors never escape', async () => {
  assert.deepEqual(arcadeGrowthSupabaseConfig({ TREE_RAFFLE_SUPABASE_URL: 'https://project.supabase.co', TREE_RAFFLE_SUPABASE_SECRET_KEY: 'server-secret' }),
    { url: 'https://project.supabase.co', secretKey: 'server-secret' });
  assert.throws(() => arcadeGrowthSupabaseConfig({ ARCADE_GROWTH_SUPABASE_URL: 'https://one.supabase.co', TREE_RAFFLE_SUPABASE_SECRET_KEY: 'other-key' }));
  assert.throws(() => arcadeGrowthSupabaseConfig({ TREE_RAFFLE_SUPABASE_URL: 'https://project.supabase.co/unsafe', TREE_RAFFLE_SUPABASE_SECRET_KEY: 'secret' }));
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-secret' }, async (url, init) => {
    calls.push({ url: String(url), init }); return Response.json({ message: 'private raw database value' }, { status: 500 });
  });
  await assert.rejects(store.publicRules(ARCADE_ENABLED_GAME_IDS), (error: any) => error.code === 'service-unavailable' && !error.message.includes('private raw'));
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/arcade_growth_public_rules_v1');
  assert.equal(calls[0].init!.method, 'POST'); assert.ok(calls[0].init!.signal instanceof AbortSignal);
});

test('store maps atomic replay, expired session and UTC race failures to stable API errors', async () => {
  for (const [message, expected] of [['arcade-growth-invalid-challenge', 'expired-challenge'], ['arcade-growth-invalid-session', 'invalid-session'],
    ['arcade-growth-day-changed', 'utc-day-changed'], ['arcade-growth-rate-limited', 'rate-limited']]) {
    const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'secret' }, async () => Response.json({ message }, { status: 400 }));
    await assert.rejects(store.publicRules(ARCADE_ENABLED_GAME_IDS), (error: any) => error.code === expected);
  }
});
