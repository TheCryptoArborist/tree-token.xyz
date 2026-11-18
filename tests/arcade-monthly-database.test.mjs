import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const {PGlite}=await import(process.env.ARCADE_TEST_PGLITE||new URL('../vendor/arcade-monthly/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url).href);
const cutoffMigration = new URL('../supabase/migrations/20261118192546_arcade_recovery_month_end_cutoff.sql', import.meta.url);
test('monthly qualification, streak recovery, replay protection and browser-role isolation',async()=>{
 const pg=new PGlite({initialMemory:128*1024*1024});await pg.exec("create function public.arcade_test_now() returns timestamptz language sql stable as $$ select timestamptz '2026-11-25 12:00:00+00' $$");const db={exec:sql=>pg.exec(sql.replaceAll('clock_timestamp()','public.arcade_test_now()')),query:(sql,args)=>pg.query(sql.replaceAll('clock_timestamp()','public.arcade_test_now()'),args),close:()=>pg.close()};try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of ['growth.sql','participation.sql','passport.sql'])await db.exec(fs.readFileSync(new URL('./fixtures/arcade-monthly/'+file,import.meta.url),'utf8'));
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261107211943_arcade_monthly_rewards.sql',import.meta.url),'utf8');
 await db.exec(sql);
 const reconciliation=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(p=>p.endsWith('_arcade_recovery_reconciliation.sql'));await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+reconciliation,import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(cutoffMigration,'utf8'));
 const wallet='0x'+'a'.repeat(64),token='a'.repeat(64),origin='https://tree-token.xyz',id='11111111-1111-4111-8111-111111111111';
 await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at) values($1,$2,$3,current_date,$4,repeat('x',100),$4,clock_timestamp()+interval '4 minutes')`,[id,wallet,origin,'f'.repeat(64)]);
 await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at) values($1,$2,$3,$4,clock_timestamp()+interval '55 minutes')`,[token,wallet,origin,id]);
 const status=async()=> (await db.query('select public.arcade_monthly_status_v1($1,$2) as s',[token,origin])).rows[0].s;
 await db.query(`insert into private.arcade_growth_checkins(wallet,date_key,source) select $1,date '2026-11-01'+n,'manual' from generate_series(0,19) n`,[wallet]);
 for(let n=1;n<=19;n++)await db.query(`insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind) values('garden-battles',$1,$2,'arborist-trials',$3::timestamptz,$3::date,'completed-result')`,['trial:'+n+':'+wallet,wallet,'2026-11-'+String(n).padStart(2,'0')]);
 await db.query(`insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind) values('garden-battles',$1,$2,'arborist-trials','2026-11-01','2026-11-01','completed-result'),('treeforce89',$3,$2,'treeforce89','2026-11-22','2026-11-22','authenticated-run-start')`,['trial:duplicate-day:'+wallet,wallet,'run:grove-'+'a'.repeat(32)+':'+wallet]);
 let s=await status();assert.equal(s.monthlyReward.verifiedQuestDays,19);assert.equal(s.monthlyReward.qualified,false);assert.equal(s.attendance.checkedInDays,20);
 await db.query(`insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind) values('garden-battles',$1,$2,'arborist-trials','2026-11-20','2026-11-20','completed-result')`,['trial:twentieth:'+wallet,wallet]);
 s=await status();assert.equal(s.monthlyReward.verifiedQuestDays,20);assert.equal(s.monthlyReward.qualified,true);assert.equal((await db.query('select count(*)::int as n from private.arcade_monthly_reward_qualifications')).rows[0].n,1);
 await db.query(`insert into private.arcade_growth_checkins(wallet,date_key,source) values($1,'2026-11-22','game-participation'),($1,'2026-11-23','manual'),($1,'2026-11-24','manual')`,[wallet]);
 assert.equal((await status()).attendance.streak,3);
 const intent=(await db.query("select public.arcade_recovery_intent_v1($1,$2,'2026-11-21',null) as i",[token,origin])).rows[0].i;
 const confirm=()=>db.query('select public.arcade_recovery_confirm_v1($1,$2,$3,$4,clock_timestamp()) as s',[token,origin,intent.id,'1'.repeat(44)]);
 const recovered=(await confirm()).rows[0].s;assert.equal(recovered.attendance.streak,24);assert.equal(recovered.monthlyReward.verifiedQuestDays,20);assert.deepEqual(recovered.attendance.recoveredDates,['2026-11-21']);await confirm();
 assert.equal((await db.query('select count(*)::int as n from private.arcade_checkin_recovery_intents where digest is not null')).rows[0].n,1);
 await assert.rejects(db.query("select public.arcade_recovery_intent_v1($1,$2,'2026-11-25',null)",[token,origin]),/invalid-date/);
 await assert.rejects(db.query("select public.arcade_recovery_intent_v1($1,$2,'2026-10-31',null)",[token,origin]),/invalid-date/);
 await assert.rejects(db.query("select public.arcade_recovery_intent_v1($1,$2,'2026-11-21',null)",[token,origin]),/already-checked-in/);
 await assert.rejects(db.query("select public.arcade_recovery_confirm_v1($1,$2,$3,$4,clock_timestamp())",[token,origin,intent.id,'2'.repeat(44)]),/payment-used/);
 assert.equal((await db.query("select has_function_privilege('anon','public.arcade_monthly_status_v1(text,text)','execute') as ok")).rows[0].ok,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.arcade_recovery_confirm_v1(text,text,uuid,text,timestamp with time zone)','execute') as ok")).rows[0].ok,false);
 await db.exec('set role service_role');assert.equal((await status()).monthlyReward.verifiedQuestDays,20);await db.exec('reset role');
 await pg.exec("create or replace function public.arcade_test_now() returns timestamptz language sql stable as $$ select timestamptz '2026-12-01 00:00:10+00' $$");
 await db.query("update private.arcade_growth_sessions set issued_at=clock_timestamp()-interval '5 minutes',expires_at=clock_timestamp()+interval '50 minutes' where token_sha256=$1",[token]);
 const late=(await db.query("insert into private.arcade_checkin_recovery_intents(wallet,date_key,created_at,expires_at) values($1,'2026-11-29','2026-11-30 23:55:00+00','2026-12-01 00:10:00+00') returning id",[wallet])).rows[0].id;
 const rolled=(await db.query("select public.arcade_recovery_confirm_v1($1,$2,$3,$4,'2026-11-30 23:59:00+00') as s",[token,origin,late,'3'.repeat(44)])).rows[0].s;
 assert.equal(rolled.monthKey,'2026-12');assert.equal(rolled.monthlyReward.verifiedQuestDays,0);
 assert.equal((await db.query("select source from private.arcade_growth_checkins where wallet=$1 and date_key='2026-11-29'",[wallet])).rows[0].source,'paid-recovery');
 await assert.rejects(db.query("select public.arcade_recovery_intent_v1($1,$2,'2026-11-30',null)",[token,origin]),/invalid-date/);
 await db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp() where token_sha256=$1',[token]);await assert.rejects(status(),/invalid-session/);
 }finally{await db.close();}
});

test('recovery cutoff preserves payment history and enforces the exclusive UTC season boundary', async t => {
 const pg = new PGlite({initialMemory:128*1024*1024});
 const db = {
  exec: sql => pg.exec(sql.replaceAll('clock_timestamp()', 'public.arcade_test_now()')),
  query: (sql, args) => pg.query(sql.replaceAll('clock_timestamp()', 'public.arcade_test_now()'), args),
 };
 const iso = value => new Date(value).toISOString();
 const setClock = async value => {
  // Only the local fixture clock is substituted; production SQL has no test hook.
  const instant = iso(value);
  await pg.exec(`create or replace function public.arcade_test_now() returns timestamptz
   language sql stable as $$ select timestamptz '${instant}' $$`);
 };
 const origin = 'https://tree-token.xyz';
 let identity = 0;
 const createSession = async () => {
  const seed = (++identity).toString(16).padStart(64, '0');
  const actor = {wallet:'0x'+seed, token:seed};
  const challenge = '00000000-0000-4000-8000-'+identity.toString(16).padStart(12, '0');
  await db.query(`insert into private.arcade_growth_wallet_challenges
   (challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at)
   values($1,$2,$3,(clock_timestamp() at time zone 'UTC')::date,$4,repeat('x',100),$4,clock_timestamp()+interval '4 minutes')`,
  [challenge,actor.wallet,origin,seed]);
  await db.query(`insert into private.arcade_growth_sessions
   (token_sha256,wallet,origin,auth_challenge_id,expires_at)
   values($1,$2,$3,$4,clock_timestamp()+interval '55 minutes')`,
  [actor.token,actor.wallet,origin,challenge]);
  return actor;
 };
 const renewSession = actor => db.query(`update private.arcade_growth_sessions
  set issued_at=clock_timestamp()-interval '5 minutes',expires_at=clock_timestamp()+interval '50 minutes'
  where token_sha256=$1`, [actor.token]);
 const asService = async action => {
  await db.exec('set role service_role');
  try { return await action(); } finally { await db.exec('reset role'); }
 };
 const newIntent = async (actor, date) => (await db.query(
  'select public.arcade_recovery_intent_v1($1,$2,$3,null) as intent', [actor.token,origin,date]
 )).rows[0].intent;
 const lookupIntent = async (actor, id) => (await db.query(
  'select public.arcade_recovery_intent_v1($1,$2,null,$3) as intent', [actor.token,origin,id]
 )).rows[0].intent;
 const confirm = async (actor, id, digest, paidAt) => (await db.query(
  'select public.arcade_recovery_confirm_v1($1,$2,$3,$4,$5::timestamptz) as status',
  [actor.token,origin,id,digest,paidAt]
 )).rows[0].status;
 const seedIntent = async (actor, date, createdAt, expiresAt) => (await db.query(
  `insert into private.arcade_checkin_recovery_intents(wallet,date_key,created_at,expires_at)
   values($1,$2,$3::timestamptz,$4::timestamptz) returning id`, [actor.wallet,date,createdAt,expiresAt]
 )).rows[0].id;
 const savedIntent = async id => (await db.query(
  'select to_jsonb(i) as saved from private.arcade_checkin_recovery_intents i where id=$1', [id]
 )).rows[0].saved;
 const history = async () => (await db.query(`select jsonb_build_object(
  'intents',(select jsonb_agg(to_jsonb(i) order by id) from private.arcade_checkin_recovery_intents i),
  'checkins',(select jsonb_agg(to_jsonb(c) order by wallet,date_key) from private.arcade_growth_checkins c),
  'badges',(select jsonb_agg(to_jsonb(b) order by wallet,month_key,badge_id) from private.arcade_growth_monthly_badges b),
  'qualifications',(select jsonb_agg(to_jsonb(q) order by wallet,month_key) from private.arcade_monthly_reward_qualifications q)
 ) as saved`)).rows[0].saved;
 try {
  await setClock('2026-12-01T00:02:00Z');
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for (const file of ['growth.sql','participation.sql','passport.sql']) {
   await db.exec(fs.readFileSync(new URL('./fixtures/arcade-monthly/'+file, import.meta.url),'utf8'));
  }
  for (const file of ['20261107211943_arcade_monthly_rewards.sql','20261107214147_arcade_recovery_reconciliation.sql']) {
   await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+file, import.meta.url),'utf8'));
  }

  // Seed old terms and already-earned history BEFORE installing the new policy.
  const octoberActor = await createSession();
  const octoberIntent = await seedIntent(octoberActor,'2026-10-29','2026-10-31T23:55:00Z','2026-11-01T00:10:00Z');
  const recordedActor = await createSession();
  const recordedIntent = await seedIntent(recordedActor,'2026-11-29','2026-11-30T23:55:00Z','2026-12-01T00:10:00Z');
  await db.query(`update private.arcade_checkin_recovery_intents
   set digest=$2,paid_at='2026-12-01T00:00:00Z',confirmed_at='2026-12-01T00:01:00Z' where id=$1`,
  [recordedIntent,'A'.repeat(44)]);
  await db.query(`insert into private.arcade_growth_checkins(wallet,date_key,source)
   values($1,'2026-11-27','manual'),($1,'2026-11-28','manual'),($1,'2026-11-29','paid-recovery')`, [recordedActor.wallet]);
  await db.query(`select private.arcade_growth_award_badges_v1($1,'2026-11-01',
   private.arcade_growth_month_games_v1('2026-11-01',array['garden-bot','pvp','arborist-trials','treeforce89'],true))`, [recordedActor.wallet]);
  await db.query(`insert into private.arcade_monthly_reward_qualifications(wallet,month_key,qualifying_dates)
   values($1,'2026-10-01',array(select date '2026-10-01'+n from generate_series(0,19) n))`, [recordedActor.wallet]);
  const beforeMigration = await history();
  await db.exec(fs.readFileSync(cutoffMigration,'utf8'));

  await t.test('migration preserves issued terms, earned history and already-confirmed receipt idempotence', async () => {
   assert.deepEqual(await history(), beforeMigration);
   const receiptBefore = await savedIntent(recordedIntent);
   await asService(() => confirm(recordedActor,recordedIntent,'A'.repeat(44),'2026-12-01T00:00:00Z'));
   assert.deepEqual(await savedIntent(recordedIntent), receiptBefore);
   assert.deepEqual(await history(), beforeMigration);
   await assert.rejects(asService(() => confirm(recordedActor,recordedIntent,'B'.repeat(44),'2026-12-01T00:00:00Z')), /payment-used/);
  });

  await t.test('new checkout expiry is the earlier of fifteen minutes and the next UTC month, independent of database time zone', async () => {
   const cases = [
    ['2026-11-18T12:30:00Z','2026-11-17','2026-11-18T12:45:00Z','Pacific/Kiritimati'],
    ['2026-11-30T23:55:00Z','2026-11-29','2026-12-01T00:00:00Z','Pacific/Kiritimati'],
    ['2026-12-31T23:55:00Z','2026-12-30','2027-01-01T00:00:00Z','America/Los_Angeles'],
    ['2028-02-29T23:55:00Z','2028-02-28','2028-03-01T00:00:00Z','America/Los_Angeles'],
   ];
   for (const [now,date,expires,timeZone] of cases) {
    await setClock(now);
    await db.query("select set_config('TimeZone',$1,false)", [timeZone]);
    const actor = await createSession();
    const intent = await asService(() => newIntent(actor,date));
    assert.equal(iso(intent.createdAt), iso(now));
    assert.equal(iso(intent.expiresAt), iso(expires));
    const reused = await asService(() => newIntent(actor,date));
    assert.equal(reused.id, intent.id);
    assert.equal(iso(reused.expiresAt), iso(expires));
   }
   await db.exec("set time zone 'UTC'");
  });

  await t.test('service RPC rejects November payments at or after the exact cutoff even under an old longer expiry', async () => {
   await setClock('2026-12-01T00:00:05Z');
   const actor = await createSession();
   const id = await seedIntent(actor,'2026-11-29','2026-11-30T23:55:00Z','2026-12-01T00:10:00Z');
   const before = await savedIntent(id);
   for (const paidAt of ['2026-12-01T00:00:00Z','2026-12-01T00:00:00.001Z','2026-12-01T00:00:04Z']) {
    await assert.rejects(asService(() => confirm(actor,id,'C'.repeat(44),paidAt)), /arcade-recovery-payment-season-closed/);
   }
   assert.deepEqual(await savedIntent(id), before, 'rejection must not change original checkout terms');
   assert.equal((await db.query('select count(*)::int as n from private.arcade_growth_checkins where wallet=$1',[actor.wallet])).rows[0].n, 0);
   assert.equal((await db.query('select count(*)::int as n from private.arcade_growth_monthly_badges where wallet=$1',[actor.wallet])).rows[0].n, 0);
   await assert.rejects(asService(() => newIntent(actor,'2026-11-30')), /invalid-date/);
   assert.equal((await asService(() => lookupIntent(actor,id))).id, id, 'closed checkout remains available to reconcile an on-time receipt');
  });

  for (const [name,createdAt,date,paidAt,verifiedAt,monthKey,digest] of [
   ['November payment verified in December','2026-11-30T23:55:00Z','2026-11-29','2026-11-30T23:59:59.999Z','2026-12-02T12:00:00Z','2026-11','D'.repeat(44)],
   ['December payment verified in January','2026-12-31T23:55:00Z','2026-12-30','2026-12-31T23:59:59.999Z','2027-01-02T12:00:00Z','2026-12','E'.repeat(44)],
  ]) {
   await t.test(name+' retains its original attendance month without quest credit', async () => {
    await setClock(createdAt);
    const actor = await createSession();
    await db.query(`insert into private.arcade_growth_checkins(wallet,date_key,source)
     values($1,($2::date-2),'manual'),($1,($2::date-1),'manual')`, [actor.wallet,date]);
    const intent = await asService(() => newIntent(actor,date));
    await setClock(verifiedAt);
    await renewSession(actor);
    const result = await asService(() => confirm(actor,intent.id,digest,paidAt));
    assert.equal(result.monthKey, verifiedAt.slice(0,7));
    assert.equal(result.monthlyReward.verifiedQuestDays, 0);
    assert.equal(result.monthlyReward.qualified, false);
    assert.equal(result.attendance.checkedInDays, 0, 'verification must not create attendance in the new month');
    const receipt = await savedIntent(intent.id);
    assert.equal(iso(receipt.paid_at), iso(paidAt));
    assert.equal(iso(receipt.confirmed_at), iso(verifiedAt));
    const attendance = (await db.query(`select source,created_at from private.arcade_growth_checkins
     where wallet=$1 and date_key=$2::date`, [actor.wallet,date])).rows[0];
    assert.equal(attendance.source, 'paid-recovery');
    assert.equal(iso(attendance.created_at), iso(verifiedAt), 'insertion time is distinct from the eligible payment date');
    const badges = (await db.query(`select to_char(month_key,'YYYY-MM') as month,badge_id,earned_at
     from private.arcade_growth_monthly_badges where wallet=$1`, [actor.wallet])).rows;
    assert.equal(badges.length, 1);
    assert.equal(badges[0].month, monthKey);
    assert.equal(badges[0].badge_id, 'seedling');
    assert.equal(iso(badges[0].earned_at), iso(verifiedAt));
    assert.equal((await db.query('select count(*)::int as n from private.arcade_growth_game_events where wallet=$1',[actor.wallet])).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int as n from private.arcade_growth_daily_quests where wallet=$1',[actor.wallet])).rows[0].n, 0);
    await asService(() => confirm(actor,intent.id,digest,paidAt));
    assert.deepEqual(await savedIntent(intent.id), receipt, 'replay does not rewrite receipt timestamps');
    await assert.rejects(asService(() => newIntent(actor,date)), /invalid-date/);
   });
  }

  await t.test('October checkout retains its original cross-boundary payment terms', async () => {
   await setClock('2026-11-02T12:00:00Z');
   await renewSession(octoberActor);
   const originalExpiry = (await savedIntent(octoberIntent)).expires_at;
   await asService(() => confirm(octoberActor,octoberIntent,'F'.repeat(44),'2026-11-01T00:05:00Z'));
   const receipt = await savedIntent(octoberIntent);
   assert.equal(receipt.expires_at, originalExpiry);
   assert.equal(iso(receipt.paid_at), '2026-11-01T00:05:00.000Z');
   assert.equal((await db.query(`select source from private.arcade_growth_checkins
    where wallet=$1 and date_key='2026-10-29'`,[octoberActor.wallet])).rows[0].source, 'paid-recovery');
   const actor = await createSession();
   const expired = await seedIntent(actor,'2026-10-29','2026-10-31T23:55:00Z','2026-11-01T00:10:00Z');
   await assert.rejects(asService(() => confirm(actor,expired,'G'.repeat(44),'2026-11-01T00:10:00.001Z')), /arcade-recovery-payment-time/);
  });

  await t.test('service-only invoker permissions, RLS and wallet binding remain intact', async () => {
   for (const signature of ['public.arcade_recovery_intent_v1(text,text,date,uuid)','public.arcade_recovery_confirm_v1(text,text,uuid,text,timestamp with time zone)']) {
    for (const role of ['anon','authenticated','service_role']) {
     const granted = (await db.query('select has_function_privilege($1,$2,\'execute\') as ok',[role,signature])).rows[0].ok;
     assert.equal(granted, role==='service_role');
    }
    const fn = (await db.query('select prosecdef,proconfig from pg_proc where oid=$1::regprocedure',[signature])).rows[0];
    assert.equal(fn.prosecdef, false);
    assert.deepEqual(fn.proconfig, ['search_path=""']);
   }
   assert.equal((await db.query("select relrowsecurity from pg_class where oid='private.arcade_checkin_recovery_intents'::regclass")).rows[0].relrowsecurity, true);
   for (const role of ['anon','authenticated']) {
    assert.equal((await db.query("select has_table_privilege($1,'private.arcade_checkin_recovery_intents','SELECT,INSERT,UPDATE') as ok",[role])).rows[0].ok, false);
   }
   const actor = await createSession();
   await assert.rejects(asService(() => lookupIntent(actor,octoberIntent)), /invalid-intent/);
   await assert.rejects(asService(() => confirm(actor,octoberIntent,'F'.repeat(44),'2026-11-01T00:05:00Z')), /invalid-intent/);
  });
 } finally {
  await pg.close();
 }
});
