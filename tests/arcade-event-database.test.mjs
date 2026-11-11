import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';
const wallet='0x'+'a'.repeat(64),token='a'.repeat(64),origin='https://tree-token.xyz';
test('durable drafts: organizer authorization, optimistic concurrency, audit history, fixed holder-only economics and locked terms',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(fs.readFileSync(new URL('./fixtures/arcade-monthly/growth.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261111172957_arcade_event_foundation.sql',import.meta.url),'utf8'));
 const id='11111111-1111-4111-8111-111111111111';
 await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at) values($1,$2,$3,current_date,$4,repeat('x',100),$4,clock_timestamp()+interval '4 minutes')`,[id,wallet,origin,'f'.repeat(64)]);
 await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at) values($1,$2,$3,$4,clock_timestamp()+interval '55 minutes')`,[token,wallet,origin,id]);
 const draft={id:'defend-the-canopy-01',title:'Defend the Canopy',gameId:'treeforce89',timeZone:'America/Chicago',startsAt:null,endsAt:null,paymentEnabled:true,terms:{entryFeeMist:'1',access:'public'}};
 const save=async(version,d=draft)=>(await db.query('select public.arcade_event_save_draft_v1($1,$2,$3::jsonb,$4) as e',[token,origin,JSON.stringify(d),version])).rows[0].e;
 await db.exec('set role service_role');await assert.rejects(save(0),/event-admin-required/);await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int as n from private.arcade_event_drafts')).rows[0].n,0);
 await db.query('insert into private.arcade_event_organizers(wallet) values($1)',[wallet]);
 await db.exec('set role service_role');const first=await save(0);assert.equal(first.version,1);assert.equal(first.payment_enabled,false);assert.equal(first.access_requirement,'nftree-holder-only');assert.equal(first.entry_fee_mist,5000000000);assert.equal(first.minimum_prize_mist,25000000000);assert.equal(first.prize_share_bps,8000);
 const restored=(await db.query('select public.arcade_event_load_draft_v1($1,$2,$3) as e',[token,origin,draft.id])).rows[0].e;assert.deepEqual(restored,first);
 await assert.rejects(save(0),/event-version-conflict/);assert.equal((await save(1,{...draft,title:'Revised draft'})).version,2);
 await assert.rejects(save(1),/event-version-conflict/);
 assert.equal((await db.query('select count(*)::int as n from private.arcade_event_draft_history')).rows[0].n,2);
 await assert.rejects(save(2,{...draft,startsAt:'2026-11-15T00:00Z',endsAt:'2026-11-14T00:00Z'}),/check constraint/);
 await assert.rejects(save(2,{...draft,gameId:'unknown'}),/event-invalid-draft/);
 await assert.rejects(db.query('update private.arcade_event_drafts set payment_enabled=true'),/check constraint/);
 await db.query("update private.arcade_event_drafts set status='locked'");await assert.rejects(save(2),/event-locked/);await db.exec('reset role');
 await db.query('update private.arcade_event_organizers set enabled=false where wallet=$1',[wallet]);await assert.rejects(save(2),/event-admin-required/);
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query(`select has_function_privilege($1,'public.arcade_event_save_draft_v1(text,text,jsonb,integer)','execute') as ok`,[role])).rows[0].ok,false);
  await db.exec('set role '+role);await assert.rejects(db.query('select * from private.arcade_event_drafts'),/permission denied/);await db.exec('reset role');
 }
 await db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp()');await assert.rejects(save(2),/invalid-session/);
 }finally{await db.close();}
});
