// Disposable database tests against exact recovered native source; no hosted access.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';
import {createNativePaidRunRecovery} from './native-paid-run-recovery.mjs';
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
 const loadPayment=async()=>({accountId:mapped.accountId,runId:mapped.runId,suiWallet:f.wallet,sequence:1,receiptId:'fixture:'+hex(),payment:{...PAYMENT_TERMS_V2['bnb-usdt'],payer:'0x'+hex().slice(0,40)}});
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

 // Sequence-aware native consumption and paid recovery; chain evidence remains a fixture.
 const repeat=await fixture(),rm=await tx(db=>adapter.bind(db,repeat));
 const seqAdapter=createNativeSuiSessionAdapter({...options,readReviewedCheckpoint:async(db,{runId,nativeRunId})=>{
  const row=(await db.query('select continuation_number from public.tree_game_sessions where run_id=$1',[nativeRunId])).rows[0];
  const snapshotText=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,lives:0,continuesUsed:row.continuation_number});
  return {validated:true,snapshotText,hash:sha(snapshotText)};
 }});
 const proofs=new Map(),seqService=createSharedContinueDelivery({pool,lockSessionAndFlight:seqAdapter.lockSessionAndFlight,consumeRun:seqAdapter.consumeRun,settlePayment:async()=>{},loadPayment:async(_db,{sourceId})=>proofs.get(sourceId)});
 let credential=repeat.sessionHash;
 const paid=async(sequence,source='bnb-usdt')=>{const sourceId=hex();proofs.set(sourceId,{accountId:rm.accountId,runId:rm.runId,suiWallet:repeat.wallet,sequence,receiptId:source+':'+hex(),payment:{...PAYMENT_TERMS_V2[source],payer:source==='sui-tree'?repeat.wallet:'0x'+hex().slice(0,40)}});return seqService.importPayment({sessionHash:credential,runId:rm.runId,source,sourceId});};
 const one=await paid(1,'sui-tree'),oneBnb=await paid(1);
 const clients=Array.from({length:12},()=>hex());
 const contenders=await Promise.all(clients.map((clientKey,i)=>seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:i%2?one.paymentId:oneBnb.paymentId,clientKey})));
 assert.equal(contenders.filter(x=>x.status==='prepared').length,1);const winner=contenders.findIndex(x=>x.status==='prepared'),lease1=contenders[winner];
 const act1={sessionHash:credential,runId:rm.runId,clientKey:clients[winner],leaseId:lease1.leaseId,checkpointHash:lease1.checkpointHash,requestId:randomUUID()};
 const activations=await Promise.all(Array.from({length:12},()=>seqService.activate(act1)));assert.equal(activations.filter(x=>x.consumed).length,1);
 assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[repeat.id])).rows[0].continuation_number,1);checks.push('mixed Sui/BNB race increments native counter once with shared claim');
 const two=await paid(2),skip=await paid(3);
 await owner.query('update public.tree_game_sessions set game_over=true where session_id=$1',[repeat.id]);
 await assert.rejects(seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:skip.paymentId,clientKey:hex()}),/continue-sequence-mismatch/);
 assert.equal((await seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:one.paymentId,clientKey:hex()})).status,'review-required');checks.push('paid sequence cannot skip forward or reuse an earlier consumption');
 const key2=hex(),lease2=await seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:two.paymentId,clientKey:key2});
 const act2={sessionHash:credential,runId:rm.runId,clientKey:key2,leaseId:lease2.leaseId,checkpointHash:lease2.checkpointHash,requestId:randomUUID()};
 await owner.query("create function private.fail_sequence_journal() returns trigger language plpgsql as $$ begin if new.sequence=2 and new.event='started' then raise exception 'injected'; end if;return new;end $$;create trigger fail_sequence before insert on private.arcade_continue_events_v2 for each row execute function private.fail_sequence_journal();");
 await assert.rejects(seqService.activate(act2),/injected/);assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[repeat.id])).rows[0].continuation_number,1);
 await owner.query('drop trigger fail_sequence on private.arcade_continue_events_v2;drop function private.fail_sequence_journal()');
 assert.equal((await seqService.activate(act2)).sequence,2);checks.push('second continue advances once; journal failure rolls back native counter and claim');
 await owner.query('update public.tree_game_sessions set game_over=true where session_id=$1',[repeat.id]);
 const key3=hex(),lease3=await seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:skip.paymentId,clientKey:key3});
 await createCredentialRevoker(owner).revoke({sessionToken:repeat.token});
 const fresh=await fixture(repeat.wallet),recover=createNativePaidRunRecovery({pool,...options});
 await assert.rejects(recover({sessionHash:stranger.sessionHash,paymentId:skip.paymentId}),/recovery-unavailable/);
 const noOwnership=createNativePaidRunRecovery({pool,...options,checkOwnership:async()=>({owned:false,checkedAt:Date.now()})});
 await assert.rejects(noOwnership({sessionHash:fresh.sessionHash,paymentId:skip.paymentId}),/recovery-entitlement-required/);checks.push('paid recovery rejects foreign wallet and ownership loss');
 await owner.query("create function private.fail_recovery_journal() returns trigger language plpgsql as $$ begin raise exception 'recovery failure'; end $$;create trigger fail_recovery before insert on private.arcade_native_paid_recoveries for each row execute function private.fail_recovery_journal();");
 await assert.rejects(recover({sessionHash:fresh.sessionHash,paymentId:skip.paymentId}),/recovery failure/);
 assert.equal((await owner.query('select session_token_hash from public.tree_game_sessions where session_id=$1',[fresh.id])).rows[0].session_token_hash,fresh.sessionHash);
 await owner.query('drop trigger fail_recovery on private.arcade_native_paid_recoveries;drop function private.fail_recovery_journal()');checks.push('failed recovery journals roll back both native credential changes');
 const recovered=await recover({sessionHash:fresh.sessionHash,paymentId:skip.paymentId});assert.equal(recovered.status,'recovered');assert.equal(recovered.restoreAuthorized,false);credential=fresh.sessionHash;
 assert.equal((await recover({sessionHash:credential,paymentId:skip.paymentId})).status,'recovered');
 assert.equal((await owner.query('select count(*)::int n from private.arcade_native_paid_recoveries where payment_id=$1',[skip.paymentId])).rows[0].n,1);
 await assert.rejects(tx(db=>adapter.lockSessionAndFlight(db,repeat.sessionHash,rm.runId)),/native-session-required/);checks.push('fresh signed session recovers paid run idempotently without another payment or grant');
 assert.equal((await seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:skip.paymentId,clientKey:hex()})).status,'in-use');
 await owner.query("update private.arcade_continue_claims_v2 set lease_until=clock_timestamp()-interval '1 second' where run_id=$1 and sequence=3",[rm.runId]);
 const newKey=hex(),newLease=await seqService.prepare({sessionHash:credential,runId:rm.runId,paymentId:skip.paymentId,clientKey:newKey});
 await assert.rejects(seqService.activate({sessionHash:credential,runId:rm.runId,clientKey:key3,leaseId:lease3.leaseId,checkpointHash:lease3.checkpointHash,requestId:randomUUID()}),/lease-mismatch/);
 assert.equal((await seqService.activate({sessionHash:credential,runId:rm.runId,clientKey:newKey,leaseId:newLease.leaseId,checkpointHash:newLease.checkpointHash,requestId:randomUUID()})).sequence,3);checks.push('recovered payment respects old lease then consumes third continue once');
 const after=await fixture(repeat.wallet);assert.equal((await recover({sessionHash:after.sessionHash,paymentId:skip.paymentId})).status,'review-required');
 assert.equal((await owner.query('select session_token_hash from public.tree_game_sessions where session_id=$1',[after.id])).rows[0].session_token_hash,after.sessionHash);checks.push('lost activation response cannot recover consumed payment as a new grant');
 console.log(JSON.stringify({localOnly:true,passed:checks.length,checks,nativeSourceCommit:provenance.commit,productionParityVerified:false,liveRestorationEnabled:false},null,2));
}finally{await pool?.end();await owner?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
