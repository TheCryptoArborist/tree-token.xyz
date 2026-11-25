// Disposable database tests against exact recovered native source; no hosted access.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';
import {createNativeSuiSessionAdapter} from './native-sui-session.mjs';
import {createSharedContinueDelivery,PAYMENT_TERMS_V2} from './shared-continue-delivery.mjs';
import {createCredentialRevoker} from '../../docs/multichain/generation-milestone/native-sui-session/upstream/credential-revocation.mjs';
const bin=process.env.BNB_PG_BIN;assert(bin,'Set BNB_PG_BIN');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mixed-continue-pg-')),data=path.join(dir,'data');
const port=55000+Math.floor(Math.random()*500),exe=n=>path.join(bin,n),checks=[];let started=false,owner,pool;
const hex=()=>randomBytes(32).toString('hex'),sha=s=>createHash('sha256').update(s).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')));
try{
 const args=['-D',data,'-A','trust','--no-locale','--encoding=UTF8'];if(process.env.BNB_PG_SHARE)args.push('-L',process.env.BNB_PG_SHARE);
 execFileSync(exe('initdb'),args,{env,stdio:'pipe'});execFileSync(exe('pg_ctl'),['-D',data,'-l',path.join(dir,'log'),'-o',`-k "" -h 127.0.0.1 -p ${port}`,'-w','start'],{env,stdio:'pipe'});started=true;
 const config={host:'127.0.0.1',port,user:os.userInfo().username,database:'postgres',password:'',ssl:false,max:20};
 owner=new pg.Pool({...config,options:''});await owner.query('create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema private to service_role;');

 const root='docs/multichain/generation-milestone/native-sui-session/';
 const provenance=JSON.parse(fs.readFileSync(root+'provenance.json'));
 for(const f of provenance.files)assert.equal(sha(fs.readFileSync(root+f.snapshot)),f.sha256);
 checks.push('all recovered native source hashes match pinned provenance');
 await owner.query(fs.readFileSync(root+'upstream/20261016030500_tree_authentication.sql','utf8'));
 await owner.query(fs.readFileSync(root+'upstream/20261031045000_tree_paid_continue.sql','utf8'));
 await owner.query(fs.readFileSync(root+'schema.sql','utf8'));
 await owner.query(fs.readFileSync('docs/multichain/generation-milestone/shared-delivery/schema.sql','utf8'));
 // Test-only role grant. The proposed schema never grants native session writes.
 await owner.query('grant select,update on public.tree_game_sessions to service_role');
 pool=new pg.Pool({...config,options:'-c role=service_role'});
 const runtime={verified:true,origin:'https://tree-token.xyz',network:'sui:mainnet',databaseIdentity:hex()};
 const options={verifyRuntime:async()=>runtime,checkOwnership:async()=>({owned:true,checkedAt:Date.now()})};
 const adapter=createNativeSuiSessionAdapter(options);
 const tx=async fn=>{const db=await pool.connect();try{await db.query('begin');const r=await fn(db);await db.query('commit');return r;}catch(e){await db.query('rollback');throw e;}finally{db.release();}};
 async function fixture(wallet='0x'+hex()){
  const token=hex(),sessionHash=sha(token),nativeRunId='grove-'+hex().slice(0,32),id=hex().slice(0,48);
  await owner.query("insert into public.tree_game_sessions(session_id,wallet,session_token_hash,run_id,expires_at,game_over) values($1,$2,$3,$4,clock_timestamp()+interval '1 hour',true)",[id,wallet,sessionHash,nativeRunId]);
  return {token,sessionHash,nativeRunId,id,wallet};
 }
 const f=await fixture(),bindings=await Promise.all(Array.from({length:12},()=>tx(db=>adapter.bind(db,f))));
 const mapped=bindings[0];assert(bindings.every(x=>x.runId===mapped.runId&&x.accountId===mapped.accountId));checks.push('12 native binding retries persist one account and one mapped run');
 const other=await fixture(f.wallet),om=await tx(db=>adapter.bind(db,other));assert.equal(om.accountId,mapped.accountId);assert.notEqual(om.runId,mapped.runId);checks.push('new native run retains wallet account but receives distinct run identity');
 const stranger=await fixture();await assert.rejects(tx(db=>adapter.lockSessionAndFlight(db,stranger.sessionHash,mapped.runId)),/native-session-required/);
 await assert.rejects(tx(db=>adapter.bind(db,{...f,nativeRunId:stranger.nativeRunId})),/native-run-mismatch/);checks.push('foreign credential and mismatched native run cannot acquire mapping');
 const session=await tx(db=>adapter.lockSessionAndFlight(db,f.sessionHash,mapped.runId));assert.equal(session.authenticated,true);assert.equal(session.checkpoint,null);checks.push('native session authenticates without inventing reviewed checkpoint');
 const base={sessionHash:f.sessionHash,runId:mapped.runId};
 const loadPayment=async()=>({accountId:mapped.accountId,runId:mapped.runId,suiWallet:f.wallet,receiptId:'fixture:'+hex(),payment:{...PAYMENT_TERMS_V2['bnb-usdt'],payer:'0x'+hex().slice(0,40)}});
 const shared=createSharedContinueDelivery({pool,lockSessionAndFlight:adapter.lockSessionAndFlight,loadPayment});
 const payment=await shared.importPayment({...base,source:'bnb-usdt',sourceId:hex()});
 await assert.rejects(shared.prepare({...base,paymentId:payment.paymentId,clientKey:hex()}),/unreviewed-checkpoint/);checks.push('shared engine refuses native client snapshot by default');
 const preview=createNativeSuiSessionAdapter({...options,verifyRuntime:async()=>({...runtime,network:'preview'})});
 await assert.rejects(tx(db=>preview.bind(db,f)),/unverified-native-runtime/);checks.push('runtime provenance cannot relabel preview as mainnet');
 const stale=createNativeSuiSessionAdapter({...options,checkOwnership:async()=>({owned:true,checkedAt:Date.now()-6000})});
 assert.equal((await tx(db=>stale.lockSessionAndFlight(db,f.sessionHash,mapped.runId))).entitled,false);checks.push('cached ownership is not stamped fresh');
 const lost=createNativeSuiSessionAdapter({...options,checkOwnership:async()=>({owned:false,checkedAt:Date.now()})});
 assert.equal((await tx(db=>lost.lockSessionAndFlight(db,f.sessionHash,mapped.runId))).entitled,false);checks.push('ownership loss denies entitlement');
 const snapshotText=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId:mapped.runId,lives:0,continuesUsed:0});
 const reviewed=createNativeSuiSessionAdapter({...options,readReviewedCheckpoint:async()=>({validated:true,snapshotText,hash:sha(snapshotText)})});
 const integrated=createSharedContinueDelivery({pool,lockSessionAndFlight:reviewed.lockSessionAndFlight,loadPayment});
 const key=hex(),prepared=await integrated.prepare({...base,paymentId:payment.paymentId,clientKey:key});assert.equal(prepared.restoreAuthorized,false);
 await owner.query('update public.tree_game_sessions set continuation_number=1 where session_id=$1',[f.id]);
 await assert.rejects(integrated.activate({...base,clientKey:key,leaseId:prepared.leaseId,checkpointHash:prepared.checkpointHash,requestId:randomUUID()}),/unreviewed-checkpoint/);
 await owner.query('update public.tree_game_sessions set continuation_number=0 where session_id=$1',[f.id]);checks.push('native Sui consumption change invalidates prepared shared activation');
 // Execute the unmodified native logout service, not a synthetic revoke flag.
 await createCredentialRevoker(owner).revoke({sessionToken:f.token});
 await assert.rejects(integrated.activate({...base,clientKey:key,leaseId:prepared.leaseId,checkpointHash:prepared.checkpointHash,requestId:randomUUID()}),/native-session-required/);checks.push('actual native logout invalidates prepared shared activation');
 // Demonstrate the shared read lock is the same row lock used by native logout.
 const holder=await pool.connect();await holder.query('begin');await adapter.lockSessionAndFlight(holder,other.sessionHash,om.runId);
 let done=false;const logout=createCredentialRevoker(owner).revoke({sessionToken:other.token}).then(r=>{done=true;return r;});
 await owner.query('select pg_sleep(0.1)');assert.equal(done,false);await holder.query('commit');holder.release();assert.equal((await logout).sessionRevoked,true);
 await assert.rejects(tx(db=>adapter.lockSessionAndFlight(db,other.sessionHash,om.runId)),/native-session-required/);checks.push('native logout waits for shared row lock then prevents subsequent admission');
 const expired=await fixture();await owner.query("update public.tree_game_sessions set expires_at=clock_timestamp()-interval '1 second' where session_id=$1",[expired.id]);
 await assert.rejects(tx(db=>adapter.bind(db,expired)),/native-session-required/);checks.push('expired bearer cannot create a mapping');
 await assert.rejects(pool.query('update private.arcade_native_sui_runs set account_id=$1',[randomUUID()]));
 await assert.rejects(pool.query('delete from private.arcade_native_sui_accounts'));checks.push('runtime cannot rewrite or delete native identity bindings');
 console.log(JSON.stringify({localOnly:true,passed:checks.length,checks,nativeSourceCommit:provenance.commit,productionParityVerified:false,liveRestorationEnabled:false},null,2));
}finally{await pool?.end();await owner?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
