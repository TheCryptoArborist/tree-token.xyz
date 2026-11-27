import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { growthConfiguration } from '../netlify/lib/arcade-growth-core.ts';

const load = path => readFile(new URL(path, import.meta.url), 'utf8');
const games = ['garden-bot', 'pvp', 'arborist-trials', 'treeforce89'];

test('Grove Chess rotates as a completed result without becoming a Passport requirement', () => {
  const picks = Array.from({ length: 4 }, (_, day) =>
    growthConfiguration(games, new Date(Date.UTC(2026, 11, day + 1))));
  const chess = picks.find(config => config.todayPick.id === 'grove-chess');
  assert.equal(new Set(picks.map(config => config.todayPick.id)).size, 4);
  assert.equal(chess.todayPick.href, '/play/grove-chess/?mode=online');
  assert.equal(chess.todayPick.creditRule, 'complete-result');
  assert.deepEqual(chess.enabledGames.map(game => game.id), games);
});

test('only eligible online results credit signed-in seats on the match completion day', async () => {
  const { PGlite } = await import(process.env.ARCADE_TEST_PGLITE ||
    new URL('../vendor/arcade-monthly/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ['growth.sql', 'participation.sql', 'passport.sql']) {
      await db.exec(await load('./fixtures/arcade-monthly/' + file));
    }
    for (const file of [
      '20261125064318_grove_chess_rooms.sql',
      '20261125181009_grove_chess_records.sql',
      '20261127193200_grove_chess_daily_task.sql',
    ]) {
      await db.exec(await load('../supabase/migrations/' + file));
    }
    const white = '0x' + 'a'.repeat(64), black = '0x' + 'b'.repeat(64);
    const whiteId = 'a'.repeat(64), blackId = 'b'.repeat(64);
    await db.query('insert into private.grove_chess_players(id) values ($1),($2)', [whiteId, blackId]);
    const save = async (index, whiteWallet, blackWallet, eligible, age = '1 minute') => {
      const room = '11111111-1111-4111-8111-' + String(index).padStart(12, '0');
      await db.query(`insert into private.grove_chess_rooms
        (id,white_id,black_id,white_wallet,black_wallet,status,revision,pgn,result,updated_at)
        values ($1,$2,$3,$4,$5,'finished',5,'fixture','verified',now()-$6::interval)`,
      [room, whiteId, blackId, whiteWallet, blackWallet, age]);
      await db.query(`select public.grove_chess_records_v1('record',null,null,$1,5,'fixture',$2)`,
        [room, { eligible }]);
      return room;
    };
    const room = await save(1, white, black, true);
    await save(2, white, black, false);
    await save(3, white, white, true);
    await save(4, white, black, true, '2 days');
    await save(5, white, null, true);
    await db.query(`select public.grove_chess_records_v1('record',null,null,$1,5,'fixture',$2)`,
      [room, { eligible: true }]);

    const { rows: events } = await db.query(`select wallet, game_id, evidence_kind,
      date_key::text as day,(completed_at at time zone 'UTC')::date::text as expected_day
      from private.arcade_growth_game_events order by wallet`);
    assert.deepEqual(events.map(event => event.wallet), [white, white, black]);
    assert(events.every(event => event.game_id === 'grove-chess' &&
      event.evidence_kind === 'completed-result' && event.day === event.expected_day));

    const day = events[0].day;
    const { rows: [{ snapshot }] } = await db.query(
      'select private.arcade_growth_wallet_chess_snapshot_v1($1,$2,$3) as snapshot', [white, day, games]);
    assert.deepEqual(snapshot.checkins, [day]);
    assert.deepEqual(snapshot.quests, [{ dateKey: day, gameId: 'grove-chess' }]);
    assert.deepEqual(snapshot.gamesByDay, [{ dateKey: day, gameIds: ['grove-chess'] }]);
    assert.deepEqual(snapshot.enabledGames, games);
    assert.equal(snapshot.eligibleGames.at(-1), 'grove-chess');
    const { rows: [{ old }] } = await db.query(
      'select private.arcade_growth_wallet_snapshot_v1($1,$2,$3) as old', [white, day, games]);
    assert.deepEqual(old.eligibleGames, games);
    assert.deepEqual(old.gamesByDay, []);
    await db.exec('set role authenticated');
    await assert.rejects(db.query(
      'select public.arcade_growth_grove_chess_snapshot_v1($1,$2,$3)',
      [whiteId, 'https://tree-token.xyz', games]), /permission denied/);
  } finally {
    await db.close();
  }
});
