import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCADE_ENABLED_GAME_IDS } from '../netlify/lib/arcade-growth-games.ts';
import { GROWTH_ELIGIBLE_GAME_IDS, buildGrowthProgress, growthConfiguration, growthEnabledGames, validateGrowthEvents,
  type GrowthSnapshot } from '../netlify/lib/arcade-growth-core.ts';
import { SupabaseArcadeGrowthStore, type GrowthTreeforcePlayInput } from '../netlify/lib/arcade-growth-store.ts';

const WALLET = `0x${'a'.repeat(64)}`;
const RUN = `grove-${'b'.repeat(32)}`;
const DATE = '2026-10-31';
const NOW = new Date(`${DATE}T12:00:00.000Z`);
const input: GrowthTreeforcePlayInput = { wallet: WALLET, runId: RUN,
  sessionExpiresAt: `${DATE}T13:00:00.000Z`, verifiedAt: NOW.toISOString() };
function snapshot(): GrowthSnapshot { return { wallet: WALLET, dateKey: DATE, monthKey: '2026-10',
  enabledGames: [...ARCADE_ENABLED_GAME_IDS], eligibleGames: [...GROWTH_ELIGIBLE_GAME_IDS], checkins: [DATE],
  quests: [{ dateKey: DATE, gameId: 'treeforce89' }], gamesByDay: [{ dateKey: DATE, gameIds: ['treeforce89'] }], badges: [] }; }
function result() { return { snapshot: snapshot(), participation: { saved: true, runId: RUN,
  sourceId: `run:${RUN}:${WALLET}`, dateKey: DATE, recordedAt: NOW.toISOString(), alreadyRecorded: false } }; }

test('October configuration exposes four eligibility rules while retaining three required Passport games', () => {
  const config = growthConfiguration(ARCADE_ENABLED_GAME_IDS, NOW);
  assert.deepEqual(config.enabledGames.map((game) => game.id), [...ARCADE_ENABLED_GAME_IDS]);
  assert.equal(config.eligibleGames.length, 4);
  assert.equal(config.eligibleGames.find((game) => game.id === 'treeforce89')!.creditRule, 'start-run');
  assert.equal(config.eligibleGames.find((game) => game.id === 'treeforce89')!.href, '/play/treeforce89/');
  assert.ok(config.enabledGames.every((game) => game.creditRule === 'complete-result'));
  assert.match(config.questRule, /first wave/);
  const picks = [0, 1, 2].map((offset) => growthConfiguration(ARCADE_ENABLED_GAME_IDS,
    new Date(NOW.getTime() + offset * 86_400_000)).todayPick.id).sort();
  assert.deepEqual(picks, ['arborist-trials', 'garden-bot', 'treeforce89']);
});

test('October TREE FORCE participation retains its optional stamp without completing any required game', () => {
  const progress = buildGrowthProgress(snapshot());
  assert.equal(progress.checkedInDays, 1); assert.equal(progress.questDays, 1);
  assert.deepEqual(progress.today, { checkedIn: true, questCompleted: true, gameIds: ['treeforce89'] });
  assert.deepEqual(progress.passport.completedGameIds, []); assert.equal(progress.passport.complete, false);
  assert.equal(progress.passport.enabledGames.length, 3);
  assert.deepEqual(progress.passport.optionalGames.map((game) => game.id), ['treeforce89']);
  assert.deepEqual(progress.passport.optionalCompletedGameIds, ['treeforce89']);
});

test('October three-game Passport completion is preserved with or without optional participation', () => {
  for (const withTreeforce of [false, true]) {
    const saved = snapshot();
    saved.quests[0].gameId = 'garden-bot';
    saved.gamesByDay[0].gameIds = [...ARCADE_ENABLED_GAME_IDS, ...(withTreeforce ? ['treeforce89' as const] : [])];
    saved.badges = [{ id: 'arcade-passport', monthKey: '2026-10', earnedAt: NOW.toISOString() }];
    const progress = buildGrowthProgress(saved);
    assert.deepEqual(progress.passport.completedGameIds, [...ARCADE_ENABLED_GAME_IDS]);
    assert.equal(progress.passport.complete, true); assert.equal(progress.badges[0].id, 'arcade-passport');
    assert.equal(progress.passport.optionalCompletedGameIds.length, withTreeforce ? 1 : 0);
  }
});

test('unknown or duplicate monthly rules fail closed; Garden validation cannot accept TREE FORCE claims', () => {
  assert.deepEqual(ARCADE_ENABLED_GAME_IDS, ['garden-bot', 'pvp', 'arborist-trials']);
  assert.throws(() => buildGrowthProgress({ ...snapshot(), eligibleGames: ['treeforce89'] }));
  for (const enabled of [[], ['future-game'], ['treeforce89', 'treeforce89'], [...GROWTH_ELIGIBLE_GAME_IDS, 'treeforce89'], [null]]) {
    assert.throws(() => growthEnabledGames(enabled));
  }
  assert.throws(() => buildGrowthProgress({ ...snapshot(), eligibleGames: [...GROWTH_ELIGIBLE_GAME_IDS, 'future-game'] as any }));
  assert.throws(() => validateGrowthEvents([{ source: 'treeforce89', sourceId: `run:${RUN}:${WALLET}`,
    gameId: 'treeforce89', wallet: WALLET, completedAt: NOW.toISOString() }], WALLET, DATE, NOW));
  assert.throws(() => validateGrowthEvents([{ source: 'garden-battles', sourceId: `battle:fixture:${WALLET}`,
    gameId: 'treeforce89', wallet: WALLET, completedAt: NOW.toISOString() }], WALLET, DATE, NOW));
});

test('November rollover starts four required games without removing permanent October badges', () => {
  const saved: GrowthSnapshot = { ...snapshot(), dateKey: '2026-11-01', monthKey: '2026-11', enabledGames: [...GROWTH_ELIGIBLE_GAME_IDS],
    checkins: [], quests: [], gamesByDay: [],
    badges: [{ id: 'arcade-passport', monthKey: '2026-10', earnedAt: NOW.toISOString() }] };
  const progress = buildGrowthProgress(saved);
  assert.equal(progress.checkedInDays, 0); assert.equal(progress.questDays, 0);
  assert.equal(progress.passport.enabledGames.length, 4); assert.deepEqual(progress.passport.completedGameIds, []);
  assert.deepEqual(progress.passport.optionalGames, []);
  assert.deepEqual(progress.passport.optionalCompletedGameIds, []); assert.equal(progress.passport.complete, false);
  assert.equal(progress.badges[0].monthKey, '2026-10'); assert.equal(progress.calendar.length, 30);
});

test('configuration trusts either saved monthly set during deployment and keeps TREE FORCE rotation unique', () => {
  const november = new Date('2026-11-01T12:00:00.000Z');
  for (const enabled of [ARCADE_ENABLED_GAME_IDS, GROWTH_ELIGIBLE_GAME_IDS]) {
    const config = growthConfiguration(enabled, november);
    assert.deepEqual(config.enabledGames.map((game) => game.id), [...enabled]);
    assert.equal(config.ruleVersion, 'arcade-growth-v1');
    const picks = [0, 1, 2].map((offset) => growthConfiguration(enabled,
      new Date(november.getTime() + offset * 86_400_000)).todayPick.id).sort();
    assert.deepEqual(picks, ['arborist-trials', 'garden-bot', 'treeforce89']);
  }
  const required = growthConfiguration(GROWTH_ELIGIBLE_GAME_IDS, november).enabledGames.find((game) => game.id === 'treeforce89')!;
  assert.equal(required.creditRule, 'start-run'); assert.equal(required.href, '/play/treeforce89/');
});

test('November saved TREE FORCE participation counts as the fourth required game without rewriting activity', () => {
  const day = '2026-11-01';
  const saved: GrowthSnapshot = { ...snapshot(), dateKey: day, monthKey: '2026-11', enabledGames: [...GROWTH_ELIGIBLE_GAME_IDS],
    checkins: [day], quests: [{ dateKey: day, gameId: 'treeforce89' }], gamesByDay: [{ dateKey: day, gameIds: ['treeforce89'] }] };
  const prior = structuredClone(saved);
  const progress = buildGrowthProgress(saved);
  assert.deepEqual(progress.passport.completedGameIds, ['treeforce89']); assert.equal(progress.passport.complete, false);
  assert.deepEqual(progress.passport.optionalGames, []); assert.deepEqual(progress.passport.optionalCompletedGameIds, []);
  assert.equal(progress.checkedInDays, 1); assert.equal(progress.questDays, 1);
  assert.deepEqual(saved, prior);
});

test('November Passport needs all four games while preserving every previously awarded badge', () => {
  const day = '2026-11-01';
  const saved: GrowthSnapshot = { ...snapshot(), dateKey: day, monthKey: '2026-11', enabledGames: [...GROWTH_ELIGIBLE_GAME_IDS],
    checkins: [day], quests: [{ dateKey: day, gameId: 'garden-bot' }], gamesByDay: [{ dateKey: day, gameIds: [...ARCADE_ENABLED_GAME_IDS] }],
    badges: [{ id: 'arcade-passport', monthKey: '2026-10', earnedAt: NOW.toISOString() },
      { id: 'arcade-passport', monthKey: '2026-11', earnedAt: `${day}T00:01:00.000Z` }] };
  const incomplete = buildGrowthProgress(saved);
  assert.equal(incomplete.passport.complete, false); assert.equal(incomplete.passport.completedGameIds.length, 3);
  assert.deepEqual(incomplete.badges.map(({ label, ...badge }) => badge), saved.badges);
  saved.gamesByDay[0].gameIds.push('treeforce89');
  const complete = buildGrowthProgress(saved);
  assert.equal(complete.passport.complete, true); assert.deepEqual(complete.passport.completedGameIds, [...GROWTH_ELIGIBLE_GAME_IDS]);
  assert.deepEqual(complete.badges, incomplete.badges);
});

test('public rules accept the database four-game set while submitting the backward-compatible three-game fallback', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-test-key' }, async (_url, init) => {
    calls.push(JSON.parse(String(init!.body))); return Response.json([...GROWTH_ELIGIBLE_GAME_IDS]);
  });
  assert.deepEqual(await store.publicRules(ARCADE_ENABLED_GAME_IDS), [...GROWTH_ELIGIBLE_GAME_IDS]);
  assert.deepEqual(calls, [{ p_enabled_games: [...ARCADE_ENABLED_GAME_IDS] }]);
});

test('store submits only trusted identity/credential timing context and accepts the exact persisted receipt', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-test-key' }, async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init!.body)) }); return Response.json(result());
  });
  const saved = await store.recordTreeforcePlay(input);
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/arcade_growth_record_treeforce_play_v1');
  assert.deepEqual(calls[0].body, { p_wallet: WALLET, p_run_id: RUN, p_session_expires_at: input.sessionExpiresAt, p_verified_at: input.verifiedAt });
  assert.equal('p_token' in calls[0].body, false); assert.equal('p_date_key' in calls[0].body, false);
  assert.equal(saved.participation.saved, true); assert.equal(saved.participation.alreadyRecorded, false);
  assert.equal(saved.participation.runId, RUN);
});

test('receipt recovery preserves the original saved day rather than assigning a retry to the current day', async () => {
  const prior = result(); prior.participation.alreadyRecorded = true;
  prior.participation.dateKey = '2026-10-30'; prior.participation.recordedAt = '2026-10-30T23:59:59.000Z';
  const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-test-key' }, async () => Response.json(prior));
  const saved = await store.recordTreeforcePlay(input);
  assert.equal(saved.participation.dateKey, '2026-10-30'); assert.equal(saved.participation.alreadyRecorded, true);
  assert.equal(saved.snapshot.dateKey, DATE);
});

test('store rejects changed run/wallet/day receipts and malformed credential context', async () => {
  for (const mutation of [
    (payload: ReturnType<typeof result>) => { payload.participation.runId = `grove-${'c'.repeat(32)}`; },
    (payload: ReturnType<typeof result>) => { payload.participation.sourceId = `run:${RUN}:0x${'d'.repeat(64)}`; },
    (payload: ReturnType<typeof result>) => { payload.participation.dateKey = '2026-10-30'; },
    (payload: ReturnType<typeof result>) => { payload.snapshot.wallet = `0x${'d'.repeat(64)}`; },
  ]) {
    const payload = result(); mutation(payload);
    const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-test-key' }, async () => Response.json(payload));
    await assert.rejects(store.recordTreeforcePlay(input));
  }
  let calls = 0;
  const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-test-key' }, async () => { calls++; return Response.json(result()); });
  await assert.rejects(store.recordTreeforcePlay({ ...input, runId: 'browser-invented-run' }));
  await assert.rejects(store.recordTreeforcePlay({ ...input, sessionExpiresAt: 'not a date' }));
  await assert.rejects(store.recordTreeforcePlay({ ...input, verifiedAt: 'not a date' }));
  assert.equal(calls, 0);
});

test('expired/revoked lease and stale verification errors remain safe, distinct API failures', async () => {
  for (const [message, code, status] of [
    ['arcade-growth-invalid-game-session', 'invalid-treeforce-session', 401],
    ['arcade-growth-stale-game-verification', 'verification-unavailable', 503],
    ['arcade-growth-event-conflict', 'verification-unavailable', 503],
  ] as const) {
    const store = new SupabaseArcadeGrowthStore({ url: 'https://project.supabase.co', secretKey: 'server-test-key' }, async () => Response.json({ message }, { status: 400 }));
    await assert.rejects(store.recordTreeforcePlay(input), (error: any) => error.code === code && error.status === status);
  }
});
