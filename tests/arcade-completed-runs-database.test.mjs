import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const {PGlite}=await import(process.env.ARCADE_TEST_PGLITE||'/tmp/arcade-completed-deps/node_modules/@electric-sql/pglite/dist/index.js');
test('completion receipts preserve first date, deduplicate runs, isolate wallets and keep existing rewards unchanged',async()=>{
 const pg=new PGlite({initialMemory:128*1024*1024});
 await pg.exec("create function public.arcade_test_now() returns timestamptz language sql stable as $$ select timestamptz '2026-11-11 23:50:00+00' $$");
 const db={exec:sql=>pg.exec(sql.replaceAll('clock_timestamp()','public.arcade_test_now()')),query:(sql,args)=>pg.query(sql.replaceAll('clock_timestamp()','public.arcade_test_now()'),args)};
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const file of ['growth.sql','participation.sql','passport.sql'])await db.exec(fs.readFileSync('tests/fixtures/arcade-monthly/'+file,'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261111053850_arcade_completed_runs.sql','utf8'));
  const wallet='0x'+'a'.repeat(64),other='0x'+'b'.repeat(64),origin='https://tree-token.xyz',token='a'.repeat(64),otherToken='b'.repeat(64);
  for(const [w,t,id]of [[wallet,token,'11111111-1111-4111-8111-111111111111'],[other,otherToken,'22222222-2222-4222-8222-222222222222']]){
   await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at) values($1,$2,$3,'2026-11-11',$4,repeat('x',100),$4,clock_timestamp()+interval '4 minutes')`,[id,w,origin,t]);
   await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at) values($1,$2,$3,$4,clock_timestamp()+interval '55 minutes')`,[t,w,origin,id]);
  }
  const event={gameId:'canopy-breaker',sourceRunKey:'c'.repeat(64),completedAt:'2026-11-11T23:45:00.000Z',score:18500,stage:2,outcome:'gameover',evidenceKind:'server-completed-run'};
  const sync=async(events,t=token)=>(await db.query('select public.arcade_completed_runs_sync_v1($1,$2,$3) as data',[t,origin,JSON.stringify(events)])).rows[0].data;
  await db.exec('set role service_role');
  let saved=await sync([event]);assert.equal(saved.runs.length,1);assert.equal(saved.runs[0].score,18500);
  await sync([event]);assert.equal((await db.query('select count(*)::int as n from private.arcade_completed_runs')).rows[0].n,1);
  await assert.rejects(sync([event],otherToken),/wallet-conflict/);
  assert.equal((await sync([],otherToken)).runs.length,0);
  await assert.rejects(sync([], 'f'.repeat(64)),/invalid-session/);
  for(const game of ['garden-bot','pvp'])await db.query(`insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,proof_digest,evidence_kind) values('garden-battles',$1,$2,$3,'2026-11-11T23:40:00Z','2026-11-11',$4,'completed-result')`,['battle:'+game+':'+wallet,wallet,game,'1'.repeat(44)]);
  await db.query(`insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind) values('treeforce89',$1,$2,'treeforce89','2026-11-11T23:40:00Z','2026-11-11','authenticated-run-start')`,['run:grove-'+'d'.repeat(32)+':'+wallet,wallet]);
  assert.deepEqual((await sync([])).runs.map(run=>run.gameId).sort(),['canopy-breaker','garden-bot','pvp']);

  await assert.rejects(sync([{...event,outcome:'playing'}]),/invalid-events/);
  await assert.rejects(sync([{...event,completedAt:'2026-11-12T00:00:00Z'}]),/invalid-time/);
  assert.equal((await db.query("select has_function_privilege('anon','public.arcade_completed_runs_sync_v1(text,text,jsonb)','execute') as ok")).rows[0].ok,false);
  assert.equal((await db.query("select has_table_privilege('authenticated','private.arcade_completed_runs','select') as ok")).rows[0].ok,false);
  assert.equal((await db.query('select count(*)::int as n from private.arcade_growth_checkins')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from private.arcade_growth_daily_quests')).rows[0].n,0);
  await db.exec('reset role');
  await db.exec("create or replace function public.arcade_test_now() returns timestamptz language sql stable as $$ select timestamptz '2026-11-12 00:10:00+00' $$");
  saved=await sync([{...event,completedAt:'2026-11-12T00:05:00.000Z',score:25000}]);assert.equal(saved.dateKey,'2026-11-12');assert.equal(saved.runs.length,0);
  const stored=(await db.query('select completed_at,score from private.arcade_completed_runs where game_id=\'canopy-breaker\'')).rows[0];assert.equal(stored.completed_at.toISOString(),'2026-11-11T23:45:00.000Z');assert.equal(Number(stored.score),25000);
 }finally{await pg.close();}
});
