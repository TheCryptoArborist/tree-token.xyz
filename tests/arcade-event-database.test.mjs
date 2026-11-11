import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';
import {TERMS,makeDraft} from '../scripts/arcade-events/core.mjs';
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

test('USDC policy migration preserves legacy history and isolates fixed v2 terms, concurrency and service-only access',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(fs.readFileSync(new URL('./fixtures/arcade-monthly/growth.sql',import.meta.url),'utf8'));
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261111172957_arcade_event_foundation.sql',import.meta.url),'utf8'));
  const challenge='11111111-1111-4111-8111-111111111111';
  await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at) values($1,$2,$3,current_date,$4,repeat('x',100),$4,clock_timestamp()+interval '4 minutes')`,[challenge,wallet,origin,'f'.repeat(64)]);
  await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at) values($1,$2,$3,$4,clock_timestamp()+interval '55 minutes')`,[token,wallet,origin,challenge]);
  await db.query('insert into private.arcade_event_organizers(wallet) values($1)',[wallet]);
  const legacy={id:'legacy-sui-draft-01',title:'Legacy SUI draft',gameId:'treeforce89',timeZone:'America/Chicago',startsAt:null,endsAt:null};
  const save=async(rpc,version,d)=>(await db.query(`select public.${rpc}($1,$2,$3::jsonb,$4) as e`,[token,origin,JSON.stringify(d),version])).rows[0].e;
  const load=async(rpc,id)=>(await db.query(`select public.${rpc}($1,$2,$3) as e`,[token,origin,id])).rows[0].e;
  const old=await save('arcade_event_save_draft_v1',0,legacy);
  const originalHistory=(await db.query('select snapshot from private.arcade_event_draft_history where event_id=$1',[legacy.id])).rows[0].snapshot;
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261111222359_arcade_event_usdc_terms.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select snapshot from private.arcade_event_draft_history where event_id=$1',[legacy.id])).rows[0].snapshot,originalHistory);
  assert.equal((await db.query('select count(*)::int as n from private.arcade_event_organizers')).rows[0].n,1);
  const preserved=await load('arcade_event_load_draft_v1',legacy.id);for(const [key,value] of Object.entries(old))assert.deepEqual(preserved[key],value);
  assert.equal(preserved.currency,'SUI');assert.equal(preserved.terms_version,1);assert.equal(preserved.entry_fee_units,null);
  assert.equal((await save('arcade_event_save_draft_v1',1,{...legacy,title:'Still a SUI draft'})).version,2);
  const draft=makeDraft({id:'canopy-crown-89-usdc',title:'Canopy Crown ’89',gameId:'treeforce89'});
  assert.deepEqual((await db.query('select private.arcade_event_terms_v2() as terms')).rows[0].terms,TERMS);
  await db.exec('set role service_role');
  await assert.rejects(save('arcade_event_save_draft_v2',2,{...draft,id:legacy.id}),/event-policy-conflict/);
  await assert.rejects(load('arcade_event_load_draft_v2',legacy.id),/event-policy-conflict/);
  const first=await save('arcade_event_save_draft_v2',0,draft);
  assert.equal(first.event_id,draft.id);assert.equal(first.version,1);assert.equal(first.terms_version,2);assert.equal(first.currency,'USDC');assert.equal(first.coin_type,TERMS.coinType);assert.equal(first.token_decimals,6);
  assert.equal(first.entry_fee_units,5000000);assert.equal(first.minimum_prize_units,25000000);assert.equal(first.entry_fee_mist,null);assert.equal(first.minimum_prize_mist,null);assert.equal(first.prize_share_bps,8000);assert.equal(first.organizer_share_bps,2000);assert.deepEqual(first.terms,TERMS);assert.equal(first.payment_enabled,false);
  assert.deepEqual(await load('arcade_event_load_draft_v2',draft.id),first);
  await assert.rejects(load('arcade_event_load_draft_v1',draft.id),/event-policy-conflict/);
  await assert.rejects(save('arcade_event_save_draft_v1',1,{...legacy,id:draft.id}),/event-policy-conflict/);
  await assert.rejects(save('arcade_event_save_draft_v2',0,draft),/event-version-conflict/);
  const second=await save('arcade_event_save_draft_v2',1,{...draft,title:'Custom tournament title'});assert.equal(second.version,2);assert.equal(second.terms_version,2);
  const third=await save('arcade_event_save_draft_v2',2,{...draft,title:'Retained event identity'});assert.equal(third.version,3);assert.equal(third.terms_version,2);assert.equal(third.event_id,first.event_id);
  for(const patch of [{version:1},{status:'scheduled'},{paymentEnabled:true},{paidEntrants:1},{terms:{...TERMS,currency:'SUI'}},{terms:{...TERMS,coinType:'0x2::sui::SUI'}},{terms:{...TERMS,entryFeeUnits:'1'}},{terms:{...TERMS,payoutTiers:[]}}])await assert.rejects(save('arcade_event_save_draft_v2',3,{...draft,...patch}),/event-invalid-draft/);
  assert.equal((await db.query('select count(*)::int as n from private.arcade_event_draft_history where event_id=$1',[draft.id])).rows[0].n,3);
  for(const update of ['payment_enabled=true','entry_fee_units=null','minimum_prize_units=1',"currency='SUI'",'terms=null',"terms=jsonb_set(terms,'{organizerShareBps}','5000')"])
   await assert.rejects(db.query(`update private.arcade_event_drafts set ${update} where event_id=$1`,[draft.id]),/check constraint/);
  await db.query("update private.arcade_event_drafts set status='locked' where event_id=$1",[draft.id]);await assert.rejects(save('arcade_event_save_draft_v2',3,draft),/event-locked/);
  await db.exec('reset role');
  for(const role of ['anon','authenticated']){
   for(const fn of ['arcade_event_load_draft_v2(text,text,text)','arcade_event_save_draft_v2(text,text,jsonb,integer)'])assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') as ok',[role,'public.'+fn])).rows[0].ok,false);
   await db.exec('set role '+role);await assert.rejects(db.query('select * from private.arcade_event_drafts'),/permission denied/);await db.exec('reset role');
  }
  assert.equal((await db.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('arcade_event_organizers','arcade_event_drafts','arcade_event_draft_history') and c.relrowsecurity")).rows[0].n,3);
  await db.query('update private.arcade_event_organizers set enabled=false');
  await assert.rejects(save('arcade_event_save_draft_v2',0,{...draft,id:'another-usdc-event'}),/event-admin-required/);
  await assert.rejects(load('arcade_event_load_draft_v2',draft.id),/event-admin-required/);
  await db.query('update private.arcade_growth_sessions set revoked_at=clock_timestamp()');
  await assert.rejects(load('arcade_event_load_draft_v2',draft.id),/invalid-session/);
  await assert.rejects(save('arcade_event_save_draft_v2',0,{...draft,id:'another-usdc-event'}),/invalid-session/);
 }finally{await db.close();}
});
