// Disposable PostgreSQL only. Independent workers exercise auth/session locks.
// No hosted URL, credentials, user wallet, or production database is accepted.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {makePilotRules} from './pilot-rules.mjs';
import {contentHash} from './core.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const ORIGIN='https://tree-token.xyz',WALLET='0x'+'8'.repeat(64);
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const quote=value=>value===null?'null':typeof value==='number'?String(value):typeof value==='boolean'?String(value):"'"+(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const iso=value=>new Date(value).toISOString();

export async function verifyPostgresPilotAuth(){
  const bin=process.env.ARCADE_PG_BIN||'',executable=name=>bin?path.join(bin,name):name;
  const postgres=execFileSync(executable('postgres'),['--version'],{encoding:'utf8'}).trim();assert(/PostgreSQL\) (16|17|18|19)\./.test(postgres));
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tree-pilot-auth-pg-')),data=path.join(directory,'data'),log=path.join(directory,'server.log');
  const port=54000+Math.floor(Math.random()*9000);
  const env={PATH:process.env.PATH,LANG:'C',PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:'postgres',PGUSER:os.userInfo().username,PGPASSWORD:'',PGPASSFILE:'/dev/null',PGSERVICEFILE:'/dev/null'};
  const cli=['-X','-A','-t','-q','-v','ON_ERROR_STOP=1'],processes=new Set(),pids=new Set(),checks=[];let started=false;
  function psql(sql,name='pilot-auth-control'){
    return new Promise((resolve,reject)=>{
      const child=spawn(executable('psql'),cli,{env:{...env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});processes.add(child);
      let stdout='',stderr='';const timer=setTimeout(()=>child.kill('SIGTERM'),15000);
      child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);
      child.on('close',code=>{clearTimeout(timer);processes.delete(child);code===0?resolve(stdout.trim()):reject(Error(stderr.trim()||'Local PostgreSQL worker failed.'));});child.stdin.end(sql);
    });
  }
  async function rpc(name,args){
    assert(/^arcade_challenge_pilot_[a-z_0-9]+$/.test(name));
    const text=await psql(`begin;set local role service_role;select pg_backend_pid();select to_jsonb(public.${name}(${args.map(quote).join(',')}));commit;`,'pilot-auth-rpc');
    const lines=text.split('\n');pids.add(Number(lines[0]));return JSON.parse(lines.slice(1).join('\n'));
  }
  function auth(name,args){return rpc('arcade_challenge_pilot_auth_'+name+'_v1',args);}
  async function challenge(wallet=WALLET,remaining=240000){return auth('create_challenge',[randomUUID(),wallet,ORIGIN,'Synthetic independent worker challenge. '.repeat(4),iso(Date.now()+remaining)]);}
  async function session({wallet=WALLET,remaining=3300000,c}={}){c??=await challenge(wallet);const token=hash('pilot_'+randomUUID());const value=await auth('create_session',[c.id,wallet,ORIGIN,token,iso(Date.now()+remaining)]);return{token,...value};}
  async function lock(sql){
    const child=spawn(executable('psql'),cli,{env:{...env,PGAPPNAME:'pilot-auth-blocker'},stdio:['pipe','pipe','pipe']});processes.add(child);let stdout='',stderr='',released=false;
    const ready=new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.includes('LOCK-READY'))resolve();});child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>{processes.delete(child);if(!released)reject(Error(stderr||'Lock worker closed '+code));});});
    child.stdin.write('begin;'+sql+";select 'LOCK-READY';\n");let timer;
    try{await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lock worker not ready.')),8000);})]);}finally{clearTimeout(timer);}
    return async()=>{released=true;const done=new Promise(resolve=>child.on('close',resolve));child.stdin.end('commit;\n');await done;};
  }
  async function waiting(count){for(let n=0;n<100;n++){if(Number(await psql("select count(*) from pg_stat_activity where application_name='pilot-auth-rpc' and wait_event_type='Lock'"))>=count)return;await sleep(25);}throw Error('Expected independent workers did not block.');}
  const safe=promise=>promise.then(value=>({ok:true,value}),error=>({ok:false,error:error.message}));
  const read=token=>rpc('arcade_challenge_pilot_read_session_v1',[token,ORIGIN]);
  const rules=makePilotRules({pilotId:'pilot-auth-pg',challengeDate:'2026-11-18',startsAt:iso(Date.now()-60000),endsAt:iso(Date.now()+3600000),maxAttemptSeconds:900});
  async function start(s){const token=hash(randomUUID());return{token,...await rpc('arcade_challenge_pilot_start_v1',[s.token,ORIGIN,rules.pilotId,contentHash(rules),token,hash('seed'),hash('challenge')])};}
  const move=(s,a)=>rpc('arcade_challenge_pilot_commit_move_v1',[s.token,ORIGIN,a.token,0,randomUUID(),hash(randomUUID()),19,{status:'ok'},false,null]);
  const count=a=>psql(`select version from private.arcade_challenge_pilot_attempts where attempt_id=${quote(a.attemptId)}`).then(Number);
  try{
    const args=['-D',data,'-A','trust','--no-locale','--encoding=UTF8'];if(process.env.ARCADE_PG_SHARE)args.push('-L',process.env.ARCADE_PG_SHARE);
    execFileSync(executable('initdb'),args,{stdio:'pipe'});execFileSync(executable('pg_ctl'),['-D',data,'-l',log,'-o',`-k "" -h 127.0.0.1 -p ${port}`,'-w','start'],{stdio:'pipe'});started=true;
    await psql('create role anon;create role authenticated;create role service_role bypassrls;');
    for(const f of ['tests/fixtures/arcade-monthly/growth.sql','supabase/migrations/20261118223908_arcade_challenge_pilot.sql','supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql'])await psql(await fs.readFile(path.join(ROOT,f),'utf8'));
    await psql('insert into private.arcade_challenge_pilot_configs(pilot_id,status,rules_hash,adapter_id,adapter_version,source_hash,config,starts_at,ends_at,max_attempt_seconds) values('+[rules.pilotId,'enabled',contentHash(rules),rules.adapter.id,rules.adapter.version,rules.game.sourceHash,rules,rules.window.startsAt,rules.window.endsAt,rules.maxAttemptSeconds].map(quote).join(',')+');');

    const c=await challenge();const releaseChallenge=await lock(`select challenge_id from private.arcade_challenge_pilot_wallet_challenges where challenge_id=${quote(c.id)} for update`);
    const consumers=[safe(session({c})),safe(session({c}))];await waiting(2);await releaseChallenge();const consumed=await Promise.all(consumers);
    assert.equal(consumed.filter(x=>x.ok).length,1);assert.match(consumed.find(x=>!x.ok).error,/challenge-auth-invalid-challenge/);
    assert.equal(Number(await psql('select count(*) from private.arcade_challenge_pilot_sessions')),1);checks.push('single-use-challenge-under-competing-workers');

    const expWallet='0x'+'3'.repeat(64),expChallenge=await challenge(expWallet,1300);
    const releaseExpired=await lock(`select challenge_id from private.arcade_challenge_pilot_wallet_challenges where challenge_id=${quote(expChallenge.id)} for update`);
    const expires= safe(session({wallet:expWallet,c:expChallenge}));await waiting(1);await sleep(Math.max(0,Date.parse(expChallenge.expiresAt)-Date.now()+80));await releaseExpired();
    assert.match((await expires).error,/challenge-auth-invalid-challenge/);checks.push('challenge-expiry-rechecked-after-row-lock');

    const cappedWallet='0x'+'4'.repeat(64);for(let i=0;i<4;i++)await challenge(cappedWallet);
    const releaseRate=await lock(`select pg_advisory_xact_lock(hashtextextended(${quote('challenge-pilot-auth-wallet:'+cappedWallet)},0))`);
    const issuers=[safe(challenge(cappedWallet)),safe(challenge(cappedWallet))];await waiting(2);await releaseRate();const issued=await Promise.all(issuers);
    assert.equal(issued.filter(x=>x.ok).length,1);assert.match(issued.find(x=>!x.ok).error,/challenge-auth-rate-limit/);checks.push('wallet-rate-limit-serializes-concurrent-challenges');

    const revoked=await session({wallet:'0x'+'5'.repeat(64)}),revokedAttempt=await start(revoked);
    const releaseRevoke=await lock(`select public.arcade_challenge_pilot_auth_revoke_session_v1(${quote(revoked.token)},${quote(ORIGIN)})`);
    const blockedMove=safe(move(revoked,revokedAttempt));await waiting(1);await releaseRevoke();assert.match((await blockedMove).error,/arcade-growth-invalid-session/);assert.equal(await count(revokedAttempt),0);checks.push('pilot-revocation-before-move');

    const short=await session({wallet:'0x'+'6'.repeat(64),remaining:1300});
    const releaseSession=await lock(`select token_sha256 from private.arcade_challenge_pilot_sessions where token_sha256=${quote(short.token)} for update`);
    const reader=safe(read(short.token));await waiting(1);await sleep(Math.max(0,Date.parse(short.expiresAt)-Date.now()+80));await releaseSession();assert.match((await reader).error,/arcade-growth-invalid-session/);checks.push('session-expiry-rechecked-after-row-lock');

    const inflight=await session({wallet:'0x'+'7'.repeat(64)}),inflightAttempt=await start(inflight);
    const releaseAttempt=await lock(`select attempt_id from private.arcade_challenge_pilot_attempts where attempt_id=${quote(inflightAttempt.attemptId)} for update`);
    const inMove=safe(move(inflight,inflightAttempt));await waiting(1);
    const lateRevoke=safe(auth('revoke_session',[inflight.token,ORIGIN]));await waiting(2);await releaseAttempt();
    assert.equal((await inMove).ok,true);assert.deepEqual(await lateRevoke,{ok:true,value:true});assert.equal(await count(inflightAttempt),1);
    assert.match((await safe(read(inflight.token))).error,/arcade-growth-invalid-session/);checks.push('in-flight-move-holds-session-lock-through-commit');

    const queued=await session({wallet:'0x'+'9'.repeat(64),remaining:1300});
    const releaseStart=await lock(`select pg_advisory_xact_lock(hashtextextended(${quote('challenge-pilot:'+queued.wallet+':'+rules.pilotId)},0))`);
    const queuedStart=safe(start(queued));await waiting(1);await sleep(Math.max(0,Date.parse(queued.expiresAt)-Date.now()+80));await releaseStart();
    assert.match((await queuedStart).error,/challenge-not-open/);checks.push('session-expiry-rechecked-after-start-advisory-lock');
    assert.equal(Number(await psql('select count(*) from private.arcade_growth_sessions')),0);assert.equal(Number(await psql('select count(*) from private.arcade_growth_wallet_challenges')),0);
    assert(pids.size>=16);return{schemaVersion:1,result:'passed',checkedAt:iso(Date.now()),postgres,environment:'disposable-local-loopback',syntheticSessions:true,productionMutated:false,
      sourceMigration:'supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql',sourceMigrationSHA256:hash(await fs.readFile(path.join(ROOT,'supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql'),'utf8')),independentWorkerCount:pids.size,checks};
  }finally{for(const child of processes)child.kill('SIGTERM');if(started)execFileSync(executable('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});await fs.rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))verifyPostgresPilotAuth().then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
