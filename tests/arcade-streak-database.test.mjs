import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';const {PGlite}=createRequire(new URL('../vendor/arcade-discovery-tests/package.json',import.meta.url))('@electric-sql/pglite');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261109123020_arcade_streak_notifications.sql',import.meta.url),'utf8');
test('transactional milestones, gap/month rules, recovery exclusion, rollback, duplicate and role protection',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create table private.arcade_growth_checkins(wallet text,date_key date,source text,created_at timestamptz default now(),primary key(wallet,date_key));create table private.arcade_growth_monthly_badges(wallet text,month_key date,badge_id text,earned_at timestamptz default now());`);await db.exec(migration);
 const w=n=>'0x'+n.toString(16).padStart(64,'0');
 async function history(n,days,{gap,paid}={}){for(let ago=days-1;ago>=1;ago--)if(ago!==gap)await db.query(`insert into private.arcade_growth_checkins values($1,(clock_timestamp() at time zone 'UTC')::date-$2::integer,$3,now())`,[w(n),ago,ago===paid?'paid-recovery':'manual']);await db.query(`insert into private.arcade_growth_checkins values($1,(clock_timestamp() at time zone 'UTC')::date,'manual',now()) on conflict do nothing`,[w(n)]);}
 for(const n of [3,7,14,30,60,90]){await history(n,n);const {rows}=await db.query('select milestone from private.arcade_streak_milestones where wallet=$1',[w(n)]);assert.deepEqual(rows.map(x=>x.milestone),[n]);}
 for(const n of [1,2,4,8,29,31]){await history(n+100,n);assert.equal((await db.query('select * from private.arcade_streak_milestones where wallet=$1',[w(n+100)])).rows.length,0);}
 await history(300,7,{gap:1});await history(301,7,{paid:1});for(const n of [300,301])assert.equal((await db.query('select * from private.arcade_streak_milestones where wallet=$1',[w(n)])).rows.length,0);
 // 60 days necessarily crosses calendar months; the single result above is 60.
 await db.query(`insert into private.arcade_growth_checkins select wallet,date_key,source,created_at from private.arcade_growth_checkins where wallet=$1 on conflict do nothing`,[w(3)]);assert.equal((await db.query('select * from private.arcade_streak_milestones where wallet=$1',[w(3)])).rows.length,1);
 await db.exec('begin');await history(900,3);await db.exec('rollback');assert.equal((await db.query('select * from private.arcade_streak_milestones where wallet=$1',[w(900)])).rows.length,0);
 for(const role of ['anon','authenticated']){assert.equal((await db.query(`select has_function_privilege($1,'public.arcade_streak_milestones_v1(bigint,text)','execute') as ok`,[role])).rows[0].ok,false);}
 assert.equal((await db.query(`select has_function_privilege('service_role','public.arcade_streak_milestones_v1(bigint,text)','execute') as ok`)).rows[0].ok,true);
 await db.exec("grant usage on schema private to service_role;grant select,insert on private.arcade_growth_checkins to service_role;grant select on private.arcade_growth_monthly_badges to service_role;");
 await db.query('delete from private.arcade_growth_checkins where wallet=$1',[w(3)]);await history(3,3);assert.equal((await db.query('select * from private.arcade_streak_milestones where wallet=$1',[w(3)])).rows.length,1);
 await db.exec('set role service_role');const serviceRead=await db.query("select * from public.arcade_streak_milestones_v1(0,'')");assert.equal(serviceRead.rows.length,6);await db.exec('reset role');
 const r=await db.query('select * from public.arcade_streak_milestones_v1(0,\'\')');assert.equal(r.rows.length,6);await db.close();
});
