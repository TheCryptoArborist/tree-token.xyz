import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARCADE_ENABLED_GAME_IDS,
  syncGardenParticipation,
  type ArcadeGrowthGameSyncResult,
} from '../netlify/lib/arcade-growth-games.ts';

const WALLET = `0x${'a'.repeat(64)}`;
const OPPONENT = `0x${'b'.repeat(64)}`;
const OTHER = `0x${'c'.repeat(64)}`;
const BOT = '0xbbe518c2a2025d2d95b9e5b6435911771f64d7d9fe037fbf2ec661981890d5b4';
const DATE = '2026-10-31';
const START = Date.parse(`${DATE}T00:00:00.000Z`);
const NOW = new Date(`${DATE}T18:00:00.000Z`);
const BASE = 'https://gardenbattles-production.up.railway.app';
const digest = (n = 1) => '1'.repeat(31) + '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[n];
const objectId = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

function battle({ n = 1, bot = false, won = true, at = START + 60_000, wallet = WALLET } = {}) {
  return {
    id: n,
    battle_id: objectId(n),
    player1: wallet,
    player2: bot ? BOT : OPPONENT,
    winner: won ? wallet : (bot ? BOT : OPPONENT),
    is_bot_battle: bot ? 1 : 0,
    transaction_digest: digest(n),
    finished_at: at,
    recorded_at: at + 1_000,
    battle_version: bot ? 'bot-v2' : 'pvp-v3',
    target_growth: 50,
  };
}

function trial({ saved = true, won = false, wallet = WALLET, at = START + 90_000 } = {}) {
  return {
    challenge: { id: `arborist-trial-v2-${DATE}`, date: DATE, expiresAt: START + 86_400_000 },
    rankedAttemptUsed: saved,
    result: saved ? { wallet, score: won ? 14_000 : 300, won, rounds: 8, playerGrowth: won ? 52 : 20, botGrowth: won ? 20 : 52, uniqueMoves: 4, completedAt: at } : null,
    checkIns: [{ date: DATE, completed: saved, won }],
    nftreeAccess: 'eligible',
  };
}

type Responses = { battles?: unknown; trials?: unknown; battleResponse?: () => Response; trialResponse?: () => Response };

function fixtures({ battles = [], trials = trial({ saved: false }), battleResponse, trialResponse }: Responses = {}) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === `${BASE}/api/player/${WALLET}/battles?limit=50`) {
      return battleResponse ? battleResponse() : Response.json({ battles });
    }
    if (url === `${BASE}/api/arborist-trials/today?wallet=${WALLET}`) {
      return trialResponse ? trialResponse() : Response.json(trials);
    }
    throw new Error('Unexpected source URL.');
  };
  return { calls, fetchImpl };
}

async function sync(responses: Responses = {}) {
  const mock = fixtures(responses);
  const result = await syncGardenParticipation({ wallet: WALLET, dateKey: DATE, now: NOW, fetchImpl: mock.fetchImpl });
  return { ...mock, result };
}

const game = (result: ArcadeGrowthGameSyncResult, id: string) => result.games.find((entry) => entry.gameId === id);

test('verified wins and losses in all supported modes count; reads are bounded and never submit gameplay', async () => {
  const input = {
    battles: [battle({ n: 2, bot: false, won: false, at: START + 120_000 }), battle({ n: 1, bot: true, won: true })],
    trials: trial({ won: false }),
  };
  const { result, calls } = await sync(input);
  assert.deepEqual(ARCADE_ENABLED_GAME_IDS, ['garden-bot', 'pvp', 'arborist-trials']);
  assert.deepEqual(result.events.map((event) => event.gameId).sort(), ['arborist-trials', 'garden-bot', 'pvp']);
  assert.ok(result.games.every((entry) => entry.status === 'verified'));
  assert.equal(result.checkedAt, NOW.toISOString());
  assert.ok(result.events.every((event) => event.wallet === WALLET && event.source === 'garden-battles'));
  assert.equal(result.events.find((event) => event.gameId === 'pvp')!.proofDigest, digest(2));
  assert.equal(result.events.find((event) => event.gameId === 'arborist-trials')!.proofDigest, undefined);
  assert.ok(result.events.every((event) => event.sourceId.length < 180));
  assert.deepEqual((await sync(input)).result.events, result.events, 're-sync retains stable event identities');
  assert.equal(calls.length, 2);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).origin, BASE);
    assert.equal(init!.method, 'GET');
    assert.equal(init!.redirect, 'error');
    assert.equal(init!.credentials, 'omit');
    assert.equal(init!.cache, 'no-store');
    assert.equal(init!.body, undefined);
    assert.ok(init!.signal instanceof AbortSignal);
  }
});

test('a PvP player in either seat receives participation credit without needing to win', async () => {
  const row = { ...battle(), player1: OPPONENT, player2: WALLET, winner: OPPONENT };
  const { result } = await sync({ battles: [row] });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].gameId, 'pvp');
  assert.equal(result.events[0].wallet, WALLET);
  assert.equal(result.events[0].sourceId, `battle:${row.battle_id}:${WALLET}`);
});

test('the configured bot cannot receive credit for its human opponent’s game', async () => {
  const fetchImpl: typeof fetch = async (input) => String(input).includes('/battles?')
    ? Response.json({ battles: [battle({ bot: true })] })
    : Response.json(trial({ saved: false }));
  const result = await syncGardenParticipation({ wallet: BOT, dateKey: DATE, now: NOW, fetchImpl });
  assert.equal(result.events.length, 0);
  assert.equal(game(result, 'garden-bot')!.status, 'unavailable');
});

test('invalid wallets and historical, future, or malformed requested days make no network calls', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => { calls += 1; throw new Error('Must not call.'); };
  for (const wallet of ['bad-wallet', 'https://example.test', `0x${'0'.repeat(64)}`]) {
    await assert.rejects(syncGardenParticipation({ wallet, dateKey: DATE, now: NOW, fetchImpl }));
  }
  for (const dateKey of ['2026-10-30', '2026-11-01', '2026-02-30', '2026-10-31T00:00:00Z']) {
    await assert.rejects(syncGardenParticipation({ wallet: WALLET, dateKey, now: NOW, fetchImpl }));
  }
  await assert.rejects(syncGardenParticipation({ wallet: WALLET, dateKey: DATE, now: new Date(NaN), fetchImpl }));
  assert.equal(calls, 0);
});

test('UTC midnight counts for today, while prior-day history is not imported or fabricated', async () => {
  const old = { ...battle({ n: 2, at: START - 1 }), transaction_digest: null, battle_version: null };
  const { result } = await sync({ battles: [battle({ at: START }), old] });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].completedAt, `${DATE}T00:00:00.000Z`);
  assert.equal(game(result, 'pvp')!.status, 'verified');
  assert.equal(game(result, 'garden-bot')!.status, 'no-result');
});

test('at the 50-record cap, validated positives survive while incomplete coverage remains explicit', async () => {
  const battles = Array.from({ length: 50 }, (_, i) => battle({ n: i + 1, at: START + 60_000 - i }));
  const { result } = await sync({ battles, trials: trial() });
  assert.equal(result.events.filter((event) => event.gameId === 'pvp').length, 50);
  assert.equal(result.events.filter((event) => event.gameId === 'arborist-trials').length, 1);
  assert.equal(result.events.filter((event) => event.gameId === 'garden-bot').length, 0);
  assert.equal(game(result, 'garden-bot')!.status, 'partial');
  assert.equal(game(result, 'pvp')!.status, 'partial');
  assert.match(game(result, 'pvp')!.message!, /Previously saved progress is unchanged/);
  assert.match(game(result, 'garden-bot')!.message!, /missing results cannot be ruled out/);
});

test('capped descending history can establish daily coverage when its oldest result predates the UTC boundary', async () => {
  const battles = Array.from({ length: 50 }, (_, i) => battle({ n: i + 1, at: i === 49 ? START - 1 : START + 60_000 - i }));
  const { result } = await sync({ battles });
  assert.equal(result.events.length, 49);
  assert.equal(game(result, 'pvp')!.status, 'verified');
});

test('explicit incomplete-history markers preserve verified positives without claiming full coverage', async () => {
  for (const marker of [{ truncated: true }, { hasMore: true }, { hasNextPage: true }, { complete: false }]) {
    const { result } = await sync({ battleResponse: () => Response.json({ battles: [battle()], ...marker }) });
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].gameId, 'pvp');
    assert.equal(game(result, 'pvp')!.status, 'partial');
    assert.equal(game(result, 'garden-bot')!.status, 'partial');
  }
});

test('partial coverage alone never creates credit, and malformed partial records remain unavailable', async () => {
  const empty = await sync({ battleResponse: () => Response.json({ battles: [], truncated: true }) });
  assert.deepEqual(empty.result.events, []);
  assert.equal(game(empty.result, 'pvp')!.status, 'partial');
  assert.equal(game(empty.result, 'garden-bot')!.status, 'partial');
  const invalid = await sync({ battleResponse: () => Response.json({ battles: [{ ...battle(), winner: OTHER }], truncated: true }) });
  assert.deepEqual(invalid.result.events, []);
  assert.equal(game(invalid.result, 'pvp')!.status, 'unavailable');
});

test('wrong wallets, contradictory modes, unknown versions, and invalid winners are rejected', async () => {
  const badRows = [
    { ...battle(), player1: OTHER },
    { ...battle(), player2: WALLET },
    { ...battle(), winner: OTHER },
    { ...battle(), is_bot_battle: '0' },
    { ...battle(), is_bot_battle: 1 },
    { ...battle({ bot: true }), is_bot_battle: 0 },
    { ...battle({ bot: true }), battle_version: 'pvp-v3' },
    { ...battle(), battle_version: 'bot-v2' },
    { ...battle(), battle_version: 'unknown-version' },
    { ...battle(), battle_id: 'made-up-battle' },
  ];
  for (const row of badRows) {
    const { result } = await sync({ battles: [row] });
    assert.equal(result.events.length, 0);
    assert.equal(game(result, 'pvp')!.status, 'unavailable');
  }
});

test('unfinished games and local/practice counters cannot produce verified events', async () => {
  const { result } = await sync({
    battles: [{ ...battle(), winner: null }],
    trials: { ...trial({ saved: false }), checkIns: [{ date: DATE, completed: true, won: true }], practiceCompleted: true },
  });
  assert.deepEqual(result.events, []);
  assert.ok(result.games.every((entry) => entry.status === 'no-result'));
});

test('current completed battles require a correctly encoded transaction digest and a nonfuture timestamp', async () => {
  for (const value of [null, '', 'transaction', '0'.repeat(44), '1'.repeat(32), 'z'.repeat(44), '2'.repeat(33)]) {
    const { result } = await sync({ battles: [{ ...battle(), transaction_digest: value }] });
    assert.equal(result.events.length, 0, String(value));
    assert.equal(game(result, 'pvp')!.status, 'unavailable', String(value));
  }
  for (const at of [NOW.getTime() + 1, START + 86_400_000, -1, 1.5, '1793404860000']) {
    const { result } = await sync({ battles: [{ ...battle(), finished_at: at }] });
    assert.equal(result.events.length, 0);
    assert.equal(game(result, 'pvp')!.status, 'unavailable');
  }
});

test('duplicate original records are idempotent; conflicting identities, reused digests, and unsorted history fail closed', async () => {
  const row = battle();
  assert.equal((await sync({ battles: [row, row] })).result.events.length, 1);
  const invalidHistories = [
    [row, { ...row, transaction_digest: digest(2) }],
    [row, { ...row, battle_id: objectId(2) }],
    [row, battle({ n: 2, at: START + 120_000 })],
  ];
  for (const battles of invalidHistories) {
    const { result } = await sync({ battles });
    assert.equal(result.events.length, 0);
    assert.equal(game(result, 'pvp')!.status, 'unavailable');
  }
});

test('upstream HTTP, JSON, source-error, redirect, and size failures are unavailable rather than no-result', async () => {
  const failures = [
    () => Response.json({ error: 'temporarily unavailable' }, { status: 503 }),
    () => new Response('<html>site fallback</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{"battles":', { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ battles: [battle()], ok: false }),
    () => Response.json({ battles: [battle()], error: 'partial database read' }),
    () => Response.redirect('https://example.test', 302),
    () => Response.json({ battles: [battle()] }, { headers: { 'content-length': String(200_000) } }),
    () => new Response(' '.repeat(128 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ battles: 'not an array' }),
    () => Response.json({ battles: Array(51).fill(battle()) }),
  ];
  for (const battleResponse of failures) {
    const { result } = await sync({ battleResponse, trials: trial() });
    assert.deepEqual(result.events.map((event) => event.gameId), ['arborist-trials']);
    assert.equal(game(result, 'pvp')!.status, 'unavailable');
  }
});

test('transport rejection is isolated to its source', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).includes('/battles?')) throw new DOMException('Connection aborted', 'AbortError');
    return Response.json(trial());
  };
  const result = await syncGardenParticipation({ wallet: WALLET, dateKey: DATE, now: NOW, fetchImpl });
  assert.equal(game(result, 'pvp')!.status, 'unavailable');
  assert.equal(game(result, 'arborist-trials')!.status, 'verified');
});

test('Trial verification binds the official result to this wallet and the current challenge', async () => {
  const original = trial();
  const invalid = [
    trial({ wallet: OTHER }),
    { ...original, rankedAttemptUsed: false },
    { ...original, result: null },
    { ...original, challenge: { ...original.challenge, date: '2026-10-30' } },
    { ...original, challenge: { ...original.challenge, id: 'arborist-trial-v2-2026-10-30' } },
    { ...original, challenge: { ...original.challenge, id: 'free-practice-2026-10-31' } },
    { ...original, result: { ...original.result, won: 1 } },
    { ...original, result: { ...original.result, rounds: 0 } },
    { ...original, result: { ...original.result, completedAt: START - 1 } },
    { ...original, result: { ...original.result, completedAt: NOW.getTime() + 1 } },
    { ...original, result: { ...original.result, completedAt: START + 86_400_000 } },
    { ...original, result: { ...original.result, completedAt: String(START + 1) } },
  ];
  for (const trials of invalid) {
    const { result } = await sync({ battles: [battle()], trials });
    assert.deepEqual(result.events.map((event) => event.gameId), ['pvp']);
    assert.equal(game(result, 'arborist-trials')!.status, 'unavailable');
  }
});

test('a saved official Trial remains evidence even when the latest eligibility read is unavailable', async () => {
  const { result } = await sync({ trials: { ...trial(), nftreeAccess: 'unavailable', fifthMoveAccess: 'unavailable' } });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].gameId, 'arborist-trials');
  assert.equal(game(result, 'arborist-trials')!.status, 'verified');
});

test('empty successful responses report no result yet, not fabricated attendance or a historical backfill', async () => {
  const { result } = await sync();
  assert.deepEqual(result.events, []);
  assert.ok(result.games.every((entry) => entry.status === 'no-result'));
  assert.equal(result.games.length, 3);
  assert.ok(!result.games.some((entry) => String(entry.gameId).includes('treeforce')));
});
