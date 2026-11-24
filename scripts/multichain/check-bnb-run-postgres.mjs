// Disposable local PostgreSQL only; never accepts a database URL or credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn,execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRunAuthorization} from './bnb-run-authorization.mjs';
import {createRunHttp,createRunStore,PATH} from './bnb-run-http.mjs';
const bin=process.env.BNB_PG_BIN;if(!bin)throw Error('Set BNB_PG_BIN to local PostgreSQL binaries');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bnb-run-pg-')),data=path.join(dir,'data'),port=String(55000+Math.floor(Math.random()*500)),env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:port,PGUSER:os.userInfo().username,PGDATABASE:'postgres',PGPASSWORD:''};
const exe=n=>path.join(bin,n),checks=[];let started=false;
const sql=q=>new Promise((resolve,reject)=>{const p=spawn(exe('psql'),['-X','-qAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err)):resolve(out.trim()));p.stdin.end(q);});
const sh='a'.repeat(64),wallet='0x'+'1'.repeat(40),hash=n=>n.toString(16).padStart(64,'0');
const call=(action,row)=>`set role service_role;select public.arcade_bnb_run_review_v1('${action}','${JSON.stringify(row)}'::jsonb);`;
function row(n){return {hash:hash(n),sessionHash:sh,wallet,chainId:56,scope:'treeforce89-generation-review:v1',generation:'2',issuedAt:Date.now()-100,expiresAt:Date.now()+50000,consumed:false};}
try{
 const args=['-D',data,'-A','trust','--no-locale','--encoding=UTF8'];if(process.env.BNB_PG_SHARE)args.push('-L',process.env.BNB_PG_SHARE);execFileSync(exe('initdb'),args,{stdio:'pipe'});execFileSync(exe('pg_ctl'),['-D',data,'-l',path.join(dir,'log'),'-o',`-k "" -h 127.0.0.1 -p ${port}`,'-w','start'],{stdio:'pipe'});started=true;
 await sql('create role anon;create role authenticated;create role service_role bypassrls;create schema private;');
 await sql(fs.readFileSync('supabase/migrations/20261120193912_arcade_bnb_test_auth.sql','utf8'));
 const fingerprint="select md5(string_agg(pg_get_functiondef(oid)||coalesce(proacl::text,''),'' order by oid)) from pg_proc where proname like 'arcade_bnb_test_%'";
 const before=await sql(fingerprint);await sql(fs.readFileSync('supabase/migrations/20261124060157_arcade_bnb_run_review.sql','utf8'));assert.equal(await sql(fingerprint),before);checks.push('existing identity function definitions and grants unchanged');
 await sql(`with c as (insert into private.arcade_bnb_test_challenges(nonce,wallet,address,message_hash,issued_at,expires_at,consumed_at) values('${sh}','${wallet}','${wallet}','${sh}',clock_timestamp()-interval '1 second',clock_timestamp()+interval '4 minutes',clock_timestamp()) returning *) insert into private.arcade_bnb_test_sessions(token_sha256,challenge_nonce,wallet,issued_at,expires_at) select '${sh}',nonce,wallet,consumed_at,clock_timestamp()+interval '50 minutes' from c;`);
 const r=row(1);assert.equal(await sql(call('insert',r)),'true');assert.equal(await sql(call('insert',r)),'false');checks.push('durable insert and duplicate denial');
 assert.equal(await sql(call('consume',{...r,generation:'1'})),'false');assert.equal(await sql(`set role service_role;select public.arcade_bnb_run_review_v1(null,'${JSON.stringify(r)}'::jsonb);`),'false');checks.push('wrong generation and null action rejected');
 const results=await Promise.all(Array.from({length:12},()=>sql(call('consume',r))));assert.equal(results.filter(x=>x==='true').length,1);checks.push('12 independent workers: exactly one consumption');
 assert.equal(JSON.parse(await sql(call('read',{hash:r.hash}))).consumed,true);checks.push('consumption persists across connections');
 const expiry=row(2);expiry.expiresAt=Date.now()+400;assert.equal(await sql(call('insert',expiry)),'true');await sql('select pg_sleep(0.5)');assert.equal(await sql(call('consume',expiry)),'false');checks.push('database-clock expiry');
 for(let n=3;n<=5;n++)assert.equal(await sql(call('insert',row(n))),'true');assert.equal(await sql(call('insert',row(6))),'false');checks.push('five-per-minute durable session rate limit');
 await assert.rejects(sql(`set role anon;select public.arcade_bnb_run_review_v1('read','{"hash":"${hash(1)}"}');`));await assert.rejects(sql('set role authenticated;select * from private.arcade_bnb_run_reviews;'));checks.push('public RPC and table permissions denied');
 const blocker=spawn(exe('psql'),['-X','-qAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let output='';const ready=new Promise(resolve=>blocker.stdout.on('data',d=>{output+=d;if(output.includes('LOCKED'))resolve();}));blocker.stdin.write(`begin;select public.arcade_bnb_test_revoke_session_v1('${sh}');select 'LOCKED';\n`);await ready;
 let settled=false;const consume=sql(call('consume',row(3))).then(r=>{settled=true;return r;});await sql('select pg_sleep(0.15)');assert.equal(settled,false);const closed=new Promise(resolve=>blocker.on('close',resolve));blocker.stdin.end('commit;\n');await closed;assert.equal(await consume,'false');checks.push('revocation commit wins while consumption waits on session lock');
 assert.equal(await sql(call('insert',row(7))),'false');checks.push('revoked session cannot issue');
 assert.equal(await sql("select relrowsecurity from pg_class where oid='private.arcade_bnb_run_reviews'::regclass"),'t');assert.equal(await sql("select prosecdef from pg_proc where oid='public.arcade_bnb_run_review_v1(text,jsonb)'::regprocedure"),'f');checks.push('RLS enabled and security invoker');
 // Full HTTP -> coordinator -> store adapter -> real PostgreSQL integration.
 // Only the chain-positive proof is synthetic; identity and tickets use the DB.
 const raw='bnbtest_'+'b'.repeat(64),hs=createHash('sha256').update(raw).digest('hex');
 await sql(`with c as (insert into private.arcade_bnb_test_challenges(nonce,wallet,address,message_hash,issued_at,expires_at,consumed_at) values('${hs}','${wallet}','${wallet}','${hs}',clock_timestamp()-interval '1 second',clock_timestamp()+interval '4 minutes',clock_timestamp()) returning *) insert into private.arcade_bnb_test_sessions(token_sha256,challenge_nonce,wallet,issued_at,expires_at) select '${hs}',nonce,wallet,consumed_at,clock_timestamp()+interval '50 minutes' from c;`);
 const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
 const store=createRunStore(async(name,args)=>{assert.equal(name,'arcade_bnb_run_review_v1');return JSON.parse(await sql(`set role service_role;select public.${name}(${quote(args.p_action)},${quote(JSON.stringify(args.p_data))}::jsonb);`));});
 let eligible=true;
 const service=createRunAuthorization({readSession:async h=>JSON.parse(await sql(`set role service_role;select public.arcade_bnb_test_read_session_v1(${quote(h)});`)||'null'),store,approvedGeneration:'2',assess:async()=>({backingEligible:eligible,gameplayAuthorized:false,wallet,approvedGeneration:'2',checkedAt:new Date().toISOString(),bnb:{state:2,generation:'2',canPlay:true,owner:wallet},sui:{eligible:true,generation:'2'}})});
 const http=createRunHttp({service,admit:async()=>true});
 const req=b=>new Request('https://tree-token.xyz'+PATH,{method:'POST',headers:{origin:'https://tree-token.xyz','content-type':'application/json',cookie:'__Secure-tree_bnb_test='+raw},body:JSON.stringify(b)});
 const issued=await http(req({action:'issue'}));assert.equal(issued.status,200);const ticket=(await issued.json()).ticket;
 const responses=await Promise.all([http(req({action:'consume',ticket})),http(req({action:'consume',ticket}))]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,403]);for(const response of responses)assert.equal((await response.json()).gameplayAuthorized,false);checks.push('HTTP plus real session/store: concurrent consume one 200 and one 403, no game grant');
 const next=await http(req({action:'issue'}));assert.equal(next.status,200);const t2=(await next.json()).ticket;eligible=false;assert.equal((await http(req({action:'consume',ticket:t2}))).status,403);eligible=true;checks.push('HTTP backing loss denies existing durable ticket');
 await sql(`select public.arcade_bnb_test_revoke_session_v1('${hs}');`);assert.equal((await http(req({action:'consume',ticket:t2}))).status,403);assert.equal((await http(req({action:'issue'}))).status,403);checks.push('HTTP real database revocation denies issue and consume');
 assert.equal((await http(req({action:'issue',wallet}))).status,400);checks.push('HTTP refuses client identity override');
 // Disposable-only retention fixtures; never use real hosted sessions.
 await sql(`insert into private.arcade_bnb_run_reviews(hash,session_hash,wallet,generation,issued_at,expires_at) select md5('retention-'||n)::text||md5('retention-'||n)::text,'${sh}','${wallet}','1',clock_timestamp()-interval '8 days',clock_timestamp()-interval '8 days'+interval '30 seconds' from generate_series(1,1001) n;`);
 const keep=await sql("select count(*) from private.arcade_bnb_run_reviews where expires_at>=statement_timestamp()-interval '7 days'");
 const countSql=fs.readFileSync('scripts/multichain/maintenance/bnb-run-retention-count.sql','utf8'),cleanupSql=fs.readFileSync('scripts/multichain/maintenance/bnb-run-retention-batch.sql','utf8');
 assert.equal(await sql(countSql),'1001');assert.equal(await sql(cleanupSql),'1000');assert.equal(await sql(countSql),'1');checks.push('retention batch deletes at most 1000 records expired over seven days');
 assert.equal(await sql("select count(*) from private.arcade_bnb_run_reviews where expires_at>=statement_timestamp()-interval '7 days'"),keep);assert.equal(await sql(`select count(*) from private.arcade_bnb_test_sessions where token_sha256 in ('${sh}','${hs}')`),'2');checks.push('retention preserves recent tickets and identity sessions');
 await assert.rejects(sql('set role service_role;'+cleanupSql));checks.push('runtime service role cannot execute retention deletion');
 console.log(JSON.stringify({localOnly:true,checks,passed:checks.length},null,2));
}finally{if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
