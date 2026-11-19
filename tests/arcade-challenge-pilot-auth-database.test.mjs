import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';
import {makePilotRules} from '../scripts/arcade-campaigns/pilot-rules.mjs';
import {contentHash} from '../scripts/arcade-campaigns/core.mjs';

const ORIGIN='https://tree-token.xyz',WWW='https://www.tree-token.xyz',WALLET='0x'+'1'.repeat(64),OTHER='0x'+'2'.repeat(64);
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const iso=value=>new Date(value).toISOString();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base=fs.readFileSync(new URL('../supabase/migrations/20261118223908_arcade_challenge_pilot.sql',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql',import.meta.url),'utf8');
const legacyNames=['arcade_growth_create_challenge_v1','arcade_growth_read_challenge_v1','arcade_growth_create_session_v1','arcade_growth_read_session_v1','arcade_growth_revoke_session_v1','arcade_growth_require_session_v1'];
const rpcSignatures=[
  'arcade_challenge_pilot_auth_create_challenge_v1(uuid,text,text,text,timestamp with time zone)',
  'arcade_challenge_pilot_auth_read_challenge_v1(uuid)',
  'arcade_challenge_pilot_auth_create_session_v1(uuid,text,text,text,timestamp with time zone)',
  'arcade_challenge_pilot_read_session_v1(text,text)',
  'arcade_challenge_pilot_auth_revoke_session_v1(text,text)',
];
const definitions=db=>db.query(`select n.nspname,p.proname,pg_get_functiondef(p.oid) as definition,p.proacl::text as acl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname=any($1::text[]) order by n.nspname,p.proname`,[legacyNames]).then(r=>r.rows);

async function fixture({upgrade=true}={}) {
  const db=new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(fs.readFileSync(new URL('./fixtures/arcade-monthly/growth.sql',import.meta.url),'utf8'));
  await db.exec(base);
  const call=(name,args=[])=>db.transaction(async tx=>{
    await tx.exec('set local role service_role');
    return (await tx.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
  });
  async function arcadeSession(token=hash(randomUUID()),wallet=WALLET) {
    const id=randomUUID();
    await db.query(`insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,expires_at)
      values($1,$2,$3,current_date,$4,repeat('legacy fixture ',10),$4,clock_timestamp()+interval '4 minutes')`,[id,wallet,ORIGIN,hash(id)]);
    await db.query(`insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,expires_at)
      values($1,$2,$3,$4,clock_timestamp()+interval '55 minutes')`,[token,wallet,ORIGIN,id]);return token;
  }
  const rules=makePilotRules({pilotId:'isolated-auth-test',challengeDate:'2026-11-18',startsAt:iso(Date.now()-60000),endsAt:iso(Date.now()+3600000),maxAttemptSeconds:900});
  await db.query(`insert into private.arcade_challenge_pilot_configs(pilot_id,status,rules_hash,adapter_id,adapter_version,source_hash,config,starts_at,ends_at,max_attempt_seconds)
    values($1,'enabled',$2,$3,$4,$5,$6,$7,$8,$9)`,[rules.pilotId,contentHash(rules),rules.adapter.id,rules.adapter.version,rules.game.sourceHash,JSON.stringify(rules),rules.window.startsAt,rules.window.endsAt,rules.maxAttemptSeconds]);
  const start=(token,attempt=hash(randomUUID()))=>call('public.arcade_challenge_pilot_start_v1',[token,ORIGIN,rules.pilotId,contentHash(rules),attempt,hash('seed'),hash('challenge')]).then(value=>({token:attempt,...value}));
  const load=(token,attempt)=>call('public.arcade_challenge_pilot_load_attempt_v1',[token,ORIGIN,attempt,null]);
  const move=(token,attempt,request=randomUUID(),version=0)=>call('public.arcade_challenge_pilot_commit_move_v1',[token,ORIGIN,attempt,version,request,hash(request),19,JSON.stringify({status:'ok'}),false,null]);
  async function challenge({wallet=WALLET,origin=ORIGIN,id=randomUUID(),remainingMs=240000,message='Synthetic local pilot challenge. '.repeat(5)}={}) {
    return call('public.arcade_challenge_pilot_auth_create_challenge_v1',[id,wallet,origin,message,iso(Date.now()+remainingMs)]);
  }
  async function session({wallet=WALLET,origin=ORIGIN,token=hash('pilot_'+randomUUID()),remainingMs=3300000,challengeRecord}={}) {
    const c=challengeRecord??await challenge({wallet,origin});
    const value=await call('public.arcade_challenge_pilot_auth_create_session_v1',[c.id,wallet,origin,token,iso(Date.now()+remainingMs)]);
    return {token,challengeId:c.id,...value};
  }
  const originalDefinitions=await definitions(db);
  if(upgrade)await db.exec(migration);
  return {db,call,rules,arcadeSession,start,load,move,challenge,session,originalDefinitions,close:()=>db.close()};
}

test('upgrade preserves all existing Arcade definitions, privileges, session rows and legacy pilot attempts',async()=>{
  const f=await fixture({upgrade:false});try{
    const token=await f.arcadeSession(),a=await f.start(token);await f.move(token,a.token);
    const before=(await f.db.query('select to_jsonb(a) as value from private.arcade_challenge_pilot_attempts a')).rows;
    const oldSession=(await f.db.query('select to_jsonb(s) as value from private.arcade_growth_sessions s')).rows;
    await f.db.exec(migration);
    assert.deepEqual(await definitions(f.db),f.originalDefinitions);
    assert.deepEqual((await f.db.query('select to_jsonb(a) as value from private.arcade_challenge_pilot_attempts a')).rows,before);
    assert.deepEqual((await f.db.query('select to_jsonb(s) as value from private.arcade_growth_sessions s')).rows,oldSession);
    const binding=(await f.db.query('select session_hash,arcade_session_hash,pilot_session_hash from private.arcade_challenge_pilot_session_bindings')).rows;
    assert.deepEqual(binding,[{session_hash:token,arcade_session_hash:token,pilot_session_hash:null}]);
    assert.equal((await f.load(token,a.token)).version,1);assert.equal((await f.move(token,a.token,randomUUID(),1)).version,2);
    const read=await f.call('public.arcade_challenge_pilot_read_session_v1',[token,ORIGIN]);assert.equal(read.sessionScope,'arcade');
  }finally{await f.close();}
});

test('pilot-only sessions authenticate a free pilot but cannot authenticate Arcade check-ins or other old RPCs',async()=>{
  const f=await fixture();try{
    const s=await f.session();assert.equal(s.sessionScope,'challenge-pilot');assert.equal(s.revoked,false);
    const read=await f.call('public.arcade_challenge_pilot_read_session_v1',[s.token,ORIGIN]);assert.equal(read.sessionScope,'challenge-pilot');
    assert.equal((await f.db.query('select count(*)::int as n from private.arcade_growth_sessions')).rows[0].n,0);
    assert.equal((await f.db.query('select count(*)::int as n from private.arcade_growth_wallet_challenges')).rows[0].n,0);
    await assert.rejects(f.call('public.arcade_growth_read_session_v1',[s.token,ORIGIN]),/arcade-growth-invalid-session/);
    await assert.rejects(f.call('public.arcade_growth_check_in_v1',[s.token,ORIGIN,['garden-bot','pvp','arborist-trials']]),/arcade-growth-invalid-session/);
    const a=await f.start(s.token);await f.move(s.token,a.token);assert.equal((await f.load(s.token,a.token)).version,1);
    const binding=(await f.db.query('select session_hash,arcade_session_hash,pilot_session_hash from private.arcade_challenge_pilot_session_bindings')).rows[0];
    assert.deepEqual(binding,{session_hash:s.token,arcade_session_hash:null,pilot_session_hash:s.token});
    assert.equal(await f.call('public.arcade_challenge_pilot_auth_read_challenge_v1',[s.challengeId]),null);
  }finally{await f.close();}
});

test('challenge consume is single-use, origin/wallet bound and disjoint from old Arcade challenges',async()=>{
  const f=await fixture();try{
    const c=await f.challenge();
    for(const [wallet,origin]of[[OTHER,ORIGIN],[WALLET,WWW]])await assert.rejects(f.session({wallet,origin,challengeRecord:c}),/challenge-auth-invalid-challenge/);
    assert.equal((await f.call('public.arcade_challenge_pilot_auth_read_challenge_v1',[c.id])).id,c.id);
    await assert.rejects(f.call('public.arcade_growth_create_session_v1',[c.id,WALLET,ORIGIN,hash('old-session-replay'),iso(Date.now()+3300000)]),/arcade-growth-invalid-challenge/);
    const s=await f.session({challengeRecord:c});await assert.rejects(f.session({challengeRecord:c}),/challenge-auth-invalid-challenge/);
    const old=await f.arcadeSession(),oldChallenge=(await f.db.query('select auth_challenge_id from private.arcade_growth_sessions where token_sha256=$1',[old])).rows[0].auth_challenge_id;
    assert.equal(await f.call('public.arcade_challenge_pilot_auth_read_challenge_v1',[oldChallenge]),null);
    await assert.rejects(f.session({challengeRecord:{id:oldChallenge}}),/challenge-auth-invalid-challenge/);
    const collision=await f.challenge();await assert.rejects(f.session({challengeRecord:collision,token:old}),/challenge-auth-invalid-input/);
    assert.equal((await f.call('public.arcade_challenge_pilot_auth_read_challenge_v1',[collision.id])).id,collision.id);
    await assert.rejects(f.call('public.arcade_challenge_pilot_read_session_v1',[s.token,WWW]),/invalid-session/);
  }finally{await f.close();}
});

test('new and old sessions keep original-session attempt binding even for the same wallet',async()=>{
  const f=await fixture();try{
    const old=await f.arcadeSession(),p=await f.session(),p2=await f.session();
    const legacy=await f.start(old),pilot=await f.start(p.token);
    await assert.rejects(f.load(p.token,legacy.token),/challenge-attempt-not-found/);
    await assert.rejects(f.load(old,pilot.token),/challenge-attempt-not-found/);
    await assert.rejects(f.load(p2.token,pilot.token),/challenge-attempt-not-found/);
    assert.equal((await f.load(old,legacy.token)).version,0);assert.equal((await f.load(p.token,pilot.token)).version,0);
    assert.equal(await f.call('public.arcade_challenge_pilot_auth_revoke_session_v1',[old,ORIGIN]),false);
    assert.equal((await f.call('public.arcade_growth_read_session_v1',[old,ORIGIN])).revoked,false);
  }finally{await f.close();}
});

test('expired challenges and session lifetimes cannot exceed the database windows',async()=>{
  const f=await fixture();try{
    for(const opts of [{remainingMs:301000},{remainingMs:-1},{origin:'https://evil.example'},{wallet:'0x'+'0'.repeat(64)},{message:'short'}])await assert.rejects(f.challenge(opts),/challenge-auth-invalid-input/);
    const c=await f.challenge({remainingMs:100});await sleep(110);assert.equal(await f.call('public.arcade_challenge_pilot_auth_read_challenge_v1',[c.id]),null);
    await assert.rejects(f.session({challengeRecord:c}),/challenge-auth-invalid-challenge/);
    const valid=await f.challenge();await assert.rejects(f.session({challengeRecord:valid,remainingMs:3601000}),/challenge-auth-invalid-input/);
    await assert.rejects(f.session({challengeRecord:valid,remainingMs:-1}),/challenge-auth-invalid-input/);
    const s=await f.session({challengeRecord:valid,remainingMs:150});await sleep(160);
    await assert.rejects(f.call('public.arcade_challenge_pilot_read_session_v1',[s.token,ORIGIN]),/invalid-session/);
    await assert.rejects(f.start(s.token),/invalid-session/);
  }finally{await f.close();}
});

test('revocation invalidates active play and accepted retries without revoking a separate Arcade session',async()=>{
  const f=await fixture();try{
    const old=await f.arcadeSession(),s=await f.session(),a=await f.start(s.token),id=randomUUID();await f.move(s.token,a.token,id);
    assert.equal(await f.call('public.arcade_challenge_pilot_auth_revoke_session_v1',[s.token,WWW]),false);
    assert.equal((await f.load(s.token,a.token)).version,1);
    assert.equal(await f.call('public.arcade_challenge_pilot_auth_revoke_session_v1',[s.token,ORIGIN]),true);
    assert.equal(await f.call('public.arcade_challenge_pilot_auth_revoke_session_v1',[s.token,ORIGIN]),true);
    for(const action of [()=>f.start(s.token),()=>f.load(s.token,a.token),()=>f.move(s.token,a.token,id)])await assert.rejects(action(),/invalid-session/);
    assert.equal((await f.call('public.arcade_growth_read_session_v1',[old,ORIGIN])).revoked,false);
    assert.equal((await f.db.query('select version from private.arcade_challenge_pilot_attempts where attempt_id=$1',[a.attemptId])).rows[0].version,1);
  }finally{await f.close();}
});

test('challenges, sessions and scope bindings are immutable except one consume or revoke',async()=>{
  const f=await fixture();try{
    const s=await f.session();await f.start(s.token);
    for(const sql of [
      "update private.arcade_challenge_pilot_wallet_challenges set message=repeat('changed',30)",
      'update private.arcade_challenge_pilot_wallet_challenges set consumed_at=null',
      "update private.arcade_challenge_pilot_sessions set expires_at=expires_at+interval '1 second'",
      'delete from private.arcade_challenge_pilot_sessions',
      'delete from private.arcade_challenge_pilot_wallet_challenges',
      'update private.arcade_challenge_pilot_session_bindings set created_at=clock_timestamp()',
      'delete from private.arcade_challenge_pilot_session_bindings',
    ])await assert.rejects(f.db.exec(sql),/immutable/);
    await assert.rejects(f.db.query('insert into private.arcade_challenge_pilot_session_bindings(session_hash) values($1)',[hash('no-source')]),/check constraint/);
    const old=await f.arcadeSession();await assert.rejects(f.db.query('insert into private.arcade_challenge_pilot_session_bindings(session_hash,arcade_session_hash,pilot_session_hash) values($1,$2,$3)',[hash('two-sources'),old,s.token]),/check constraint/);
    await assert.rejects(f.db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.exec("update private.arcade_challenge_pilot_sessions set wallet='"+OTHER+"'");}),/permission denied/);
  }finally{await f.close();}
});

test('browser roles have no auth RPC, private table or context-type access; invoker mode and grants remain scoped',async()=>{
  const f=await fixture();try{
    for(const role of ['anon','authenticated']){
      for(const sig of rpcSignatures)assert.equal((await f.db.query("select has_function_privilege($1,$2,'execute') as allowed",[role,'public.'+sig])).rows[0].allowed,false);
      for(const table of ['wallet_challenges','sessions','session_bindings'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await f.db.query('select has_table_privilege($1,$2,$3) as allowed',[role,'private.arcade_challenge_pilot_'+table,privilege])).rows[0].allowed,false);
      assert.equal((await f.db.query("select has_type_privilege($1,'private.arcade_challenge_pilot_session_context','usage') as allowed",[role])).rows[0].allowed,false);
    }
    const p=(await f.db.query("select p.proname,p.prosecdef,p.proconfig,coalesce((select bool_or(grantee=0 and privilege_type='EXECUTE') from aclexplode(p.proacl)),false) as public_execute from pg_proc p where p.proname like 'arcade_challenge_pilot_%'")).rows;
    assert.equal(p.length,20);assert(p.every(r=>!r.prosecdef&&!r.public_execute&&r.proconfig.includes('search_path=""')));
    assert.equal((await f.db.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('arcade_challenge_pilot_wallet_challenges','arcade_challenge_pilot_sessions','arcade_challenge_pilot_session_bindings') and c.relrowsecurity")).rows[0].n,3);
    assert.deepEqual(await definitions(f.db),f.originalDefinitions);
  }finally{await f.close();}
});

test('wallet challenge limits share one counter across canonical origins',async()=>{
  const f=await fixture();try{
    for(let i=0;i<5;i++)await f.challenge({origin:i%2?WWW:ORIGIN});
    await assert.rejects(f.challenge(),/challenge-auth-rate-limit/);
    assert.equal((await f.db.query('select count(*)::int as n from private.arcade_challenge_pilot_wallet_challenges')).rows[0].n,5);
    assert.equal((await f.challenge({wallet:OTHER})).wallet,OTHER);
  }finally{await f.close();}
});
