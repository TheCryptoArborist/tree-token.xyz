// Disposable database tests against exact recovered native source; no hosted access.
import {createNativeSharedOffer} from './native-shared-offer.mjs';
import {createNativeContinueHost} from './native-continue-host.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';
import {createNativeSuiPaymentRecorder} from './native-sui-payment.mjs';
import {createMainnetTransactionReader} from '../../docs/multichain/generation-milestone/native-sui-payments/upstream/mainnet-transaction-reader.mjs';
import {createNativePaidRunRecovery} from './native-paid-run-recovery.mjs';
import {createNativeSuiSessionAdapter} from './native-sui-session.mjs';
import {createSharedContinueDelivery,PAYMENT_TERMS_V2} from './shared-continue-delivery.mjs';
import {createCredentialRevoker} from '../../docs/multichain/generation-milestone/native-sui-session/upstream/credential-revocation.mjs';
const netlifyMode=process.env.NETLIFY_CONTINUE_SCHEMA==='1';
const bin=process.env.BNB_PG_BIN;assert(bin,'Set BNB_PG_BIN');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mixed-continue-pg-')),data=path.join(dir,'data');
const port=5432,exe=n=>path.join(bin,n),checks=[];let started=false,owner,pool;
const hex=()=>randomBytes(32).toString('hex'),sha=s=>createHash('sha256').update(s).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')));
try{
 const args=['-D',data,'-A','trust','--no-locale','--encoding=UTF8'];if(process.env.BNB_PG_SHARE)args.push('-L',process.env.BNB_PG_SHARE);
 execFileSync(exe('initdb'),args,{env,stdio:'pipe'});execFileSync(exe('pg_ctl'),['-D',data,'-l',path.join(dir,'log'),'-o',`-k "${dir}" -h "" -p ${port}`,'-w','start'],{env,stdio:'pipe'});started=true;
 const config={host:dir,port,user:os.userInfo().username,database:'postgres',password:'',ssl:false,max:20};
 owner=new pg.Pool({...config,options:''});
 if(netlifyMode){await owner.query('create role netlifydb_owner;create role netlifydb_readonly;grant create on database postgres to netlifydb_owner;grant all on schema public to netlifydb_owner');await owner.end();owner=new pg.Pool({...config,options:'-c role=netlifydb_owner'});}
 else await owner.query('create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema private to service_role;');

 const root='docs/multichain/generation-milestone/native-sui-session/';
 const provenance=JSON.parse(fs.readFileSync(root+'provenance.json'));
 for(const f of provenance.files)assert.equal(sha(fs.readFileSync(root+f.snapshot)),f.sha256);
 checks.push('all recovered native source hashes match pinned provenance');
 await owner.query(fs.readFileSync(root+'upstream/20261016030500_tree_authentication.sql','utf8'));
 await owner.query(fs.readFileSync(root+'upstream/20261031045000_tree_paid_continue.sql','utf8'));
 if(netlifyMode){
  const catalog=()=>owner.query("select c.relname,c.relacl::text,a.attname,a.atttypid,a.attnotnull from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and a.attnum>0 order by c.relname,a.attnum");
  const nativeBefore=(await catalog()).rows;
  await assert.rejects(owner.query('select * from private.arcade_accounts_v2'),/does not exist/);
  await owner.query(fs.readFileSync('docs/multichain/generation-milestone/netlify-gateway/schema.sql','utf8'));
  assert.deepEqual((await catalog()).rows,nativeBefore);
  const retry=await owner.connect();try{await assert.rejects(retry.query(fs.readFileSync('docs/multichain/generation-milestone/netlify-gateway/schema.sql','utf8')),/already exists/);await retry.query('rollback');}finally{retry.release();}
  checks.push('proposal preserves native columns and relation grants; reapplication fails and rolls back');
  const readonly=new pg.Pool({...config,options:'-c role=netlifydb_readonly'});
  try{await assert.rejects(readonly.query('select * from private.arcade_accounts_v2'),/permission denied/);}finally{await readonly.end();}
  assert.equal((await owner.query("select count(*)::int n from pg_roles where rolname in ('anon','authenticated','service_role')")).rows[0].n,0);
  assert.equal((await owner.query("select rolsuper or rolbypassrls privileged from pg_roles where rolname=current_user")).rows[0].privileged,false);
  checks.push('Netlify owner is nonsuperuser without bypassrls; readonly denied; no Supabase roles needed');
 }else{
 await owner.query(fs.readFileSync(root+'schema.sql','utf8'));
 await owner.query(fs.readFileSync('docs/multichain/generation-milestone/shared-delivery/schema.sql','utf8'));
 // Test-only role grant. The proposed schema never grants native session writes.
 await owner.query('grant select,update on public.tree_game_sessions to service_role');
 }
 pool=new pg.Pool({...config,options:netlifyMode?'-c role=netlifydb_owner':'-c role=service_role'});
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

 // Actual pinned native reader -> evidence store -> shared claim -> native redemption.
 const paymentRoot='docs/multichain/generation-milestone/native-sui-payments/';
 for(const f of JSON.parse(fs.readFileSync(paymentRoot+'provenance.json')).files)assert.equal(sha(fs.readFileSync(paymentRoot+f.snapshot)),f.sha256);
 if(!netlifyMode){await owner.query(fs.readFileSync(paymentRoot+'schema.sql','utf8'));
 await owner.query('grant select,insert on public.tree_continue_redemptions to service_role'); // local fixture grant only
 }
 const policy=PAYMENT_TERMS_V2['sui-native-tree'];
 async function paymentFixture(wallet){
  const native=await fixture(wallet),mapping=await tx(db=>adapter.bind(db,native)),offerId=hex().slice(0,48),digest='D'+hex().replaceAll('0','1').slice(0,43);
  await owner.query("update public.tree_game_sessions set continue_pending=true,continue_offer_id=$2,continue_offer_created_at=clock_timestamp()-interval '1 minute',continue_offer_expires_at=clock_timestamp()+interval '1 minute',continue_offer_checkpoint='10',continue_snapshot=$3 where session_id=$1",[native.id,offerId,{runId:native.nativeRunId,fixture:true}]);
  const body={$kind:'Transaction',Transaction:{digest,status:{success:true},effects:{status:{success:true}},checkpoint:'11',timestampMs:Date.now()-1000,transaction:{sender:native.wallet},balanceChanges:[{coinType:policy.token,address:policy.recipient,amount:policy.amount}]}};
  return {native,mapping,offerId,digest,body};
 }
 const payCase=await paymentFixture();let evidence=payCase.body;
 const reader=createMainnetTransactionReader({network:'mainnet',core:{getTransaction:async()=>structuredClone(evidence)}});
 const recorder=createNativeSuiPaymentRecorder({pool,...options,readTransaction:reader});
 const hostDigest='1'.repeat(64);
 const gateway=createNativeContinueHost({pool,legacyHandler:()=>assert.fail('no legacy fallback'),nativePaidService:{offer:()=>{throw Error('not used');}},verifyRuntime:async()=>({...runtime,runtimeDigest:hostDigest}),checkOwnership:options.checkOwnership,readTransaction:reader,runtimeDigest:hostDigest,databaseIdentity:runtime.databaseIdentity,readMode:async()=> 'shared',readCutover:async()=>({legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:hostDigest,databaseIdentity:runtime.databaseIdentity,checkedAt:Date.now(),expiresAt:Date.now()+30000})});
 const throughGateway=async(action,token,input)=>{
  const response=await gateway(new Request('https://tree-token.xyz/play/treeforce89/api/shared-continue-'+action,{method:'POST',headers:{origin:'https://tree-token.xyz',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(input)}));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.restoreAuthorized,false);assert.equal(body.requiresPayment,false);return body;
 };
 const newOfferActor=await fixture();let offered=0;
 const offerWrapper=createNativeSharedOffer({pool,sessionAdapter:adapter,nativeOffer:async input=>{offered++;assert.equal(input.sessionToken,newOfferActor.token);return {enabled:true};}});
 await Promise.all(Array.from({length:6},()=>offerWrapper({sessionToken:newOfferActor.token,runId:newOfferActor.nativeRunId})));
 assert.equal(offered,6);assert.equal((await owner.query('select count(*)::int n from private.arcade_native_sui_runs where native_run_id=$1',[newOfferActor.nativeRunId])).rows[0].n,1);
 await assert.rejects(offerWrapper({sessionToken:newOfferActor.token,runId:'grove-'+hex().slice(0,32)}),/native-run-mismatch/);assert.equal(offered,6);
 checks.push('offer wrapper persists one authenticated run mapping across retries and rejects mismatched runs before native service');
 const pi={sessionHash:payCase.native.sessionHash,offerId:payCase.offerId,digest:payCase.digest};
 const invalid=[
  x=>x.$kind='FailedTransaction',x=>x.Transaction.effects.status.success=false,
  x=>x.Transaction.digest='B'.repeat(44),x=>x.Transaction.checkpoint='10',
  x=>x.Transaction.transaction.sender='0x'+hex(),x=>x.Transaction.balanceChanges[0].amount='1',
  x=>x.Transaction.balanceChanges[0].coinType='wrong',x=>x.Transaction.timestampMs=Date.now()+60000,
  x=>x.Transaction.balanceChanges[0].address='0x'+hex(),x=>x.Transaction.timestampMs=Date.now()-180000
 ];
 for(const mutate of invalid){evidence=structuredClone(payCase.body);mutate(evidence);await assert.rejects(recorder(pi));}
 assert.equal((await owner.query('select count(*)::int n from private.arcade_native_sui_payments')).rows[0].n,0);checks.push('native reader and recorder reject failed, mismatched, stale and underpaid Sui evidence');
 evidence=payCase.body;const recorded=await Promise.all(Array.from({length:12},()=>throughGateway('record',payCase.native.token,{offerId:pi.offerId,digest:pi.digest})));assert(recorded.every(r=>r.restoreAuthorized===false));
 assert.equal((await owner.query('select count(*)::int n from private.arcade_native_sui_payments')).rows[0].n,1);
 assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[payCase.native.id])).rows[0].continuation_number,0);
 assert.equal((await owner.query('select count(*)::int n from public.tree_continue_redemptions')).rows[0].n,0);checks.push('12 authenticated gateway verification retries record one receipt without consuming or restoring');
 const duplicate=await paymentFixture(payCase.native.wallet);evidence={...payCase.body,Transaction:{...payCase.body.Transaction,timestampMs:Date.now()-1000}};
 await assert.rejects(recorder({sessionHash:duplicate.native.sessionHash,offerId:duplicate.offerId,digest:payCase.digest}));checks.push('same Sui digest cannot fund another native offer or run');
 evidence=payCase.body;
 const nativeShared=createSharedContinueDelivery({pool,lockSessionAndFlight:seqAdapter.lockSessionAndFlight,consumeRun:seqAdapter.consumeRun});
 const sharedInput={sessionHash:payCase.native.sessionHash,runId:payCase.mapping.runId,source:'sui-native-tree',sourceId:payCase.offerId};
 const paidNative=await nativeShared.importPayment(sharedInput),page=hex(),nativeLease=await nativeShared.prepare({...sharedInput,paymentId:paidNative.paymentId,clientKey:page});
 const nativeActivation={...sharedInput,clientKey:page,leaseId:nativeLease.leaseId,checkpointHash:nativeLease.checkpointHash,requestId:randomUUID()};
 await owner.query("create function private.fail_native_redemption() returns trigger language plpgsql as $$ begin raise exception 'redemption failure'; end $$;create trigger fail_redemption before insert on public.tree_continue_redemptions for each row execute function private.fail_native_redemption();");
 await assert.rejects(nativeShared.activate(nativeActivation),/redemption failure/);
 assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[payCase.native.id])).rows[0].continuation_number,0);
 await owner.query('drop trigger fail_redemption on public.tree_continue_redemptions;drop function private.fail_native_redemption()');
 assert.equal((await throughGateway('complete',payCase.native.token,{paymentId:paidNative.paymentId})).archiveAllowed,false);
 const consumed=await nativeShared.activate(nativeActivation);assert.equal(consumed.consumed,true);assert.equal(consumed.restoreAuthorized,false);
 assert.equal((await owner.query('select digest from public.tree_continue_redemptions where offer_id=$1',[payCase.offerId])).rows[0].digest,payCase.digest);
 assert.equal((await nativeShared.importPayment(sharedInput)).paymentId,paidNative.paymentId);
 const completed=await throughGateway('complete',payCase.native.token,{paymentId:paidNative.paymentId});assert.equal(completed.archiveAllowed,true);assert.equal(completed.digest,payCase.digest);
 const outsider=await fixture();assert.equal((await throughGateway('complete',outsider.token,{paymentId:paidNative.paymentId})).archiveAllowed,false);
 const newLogin=await fixture(payCase.native.wallet);assert.equal((await throughGateway('complete',newLogin.token,{paymentId:paidNative.paymentId})).archiveAllowed,true);
 await owner.query('update public.tree_game_sessions set continuation_number=0 where session_id=$1',[payCase.native.id]);
 assert.equal((await throughGateway('complete',newLogin.token,{paymentId:paidNative.paymentId})).archiveAllowed,false);
 await owner.query('update public.tree_game_sessions set continuation_number=1 where session_id=$1',[payCase.native.id]);
 checks.push('completion requires consumed claim plus native redemption/counter; denies foreign wallet and supports fresh same-wallet login');

 assert.equal((await nativeShared.activate(nativeActivation)).status,'review-required');checks.push('native evidence settles once with shared claim and counter; redemption failure rolls all back');
 const used=await paymentFixture();await owner.query('insert into public.tree_continue_redemptions(digest,session_id,continuation_number,wallet,run_id,offer_id) values($1,$2,0,$3,$4,$5)',[used.digest,used.native.id,used.native.wallet,used.native.nativeRunId,used.offerId]);evidence=used.body;
 await assert.rejects(recorder({sessionHash:used.native.sessionHash,offerId:used.offerId,digest:used.digest}),/payment-already-redeemed/);checks.push('legacy native redemption cannot be imported as unused payment');
 const late=await paymentFixture();await owner.query("update public.tree_game_sessions set continue_offer_expires_at=clock_timestamp()-interval '1 second' where session_id=$1",[late.native.id]);late.body.Transaction.timestampMs=Date.now()-2000;evidence=late.body;
 assert.equal((await recorder({sessionHash:late.native.sessionHash,offerId:late.offerId,digest:late.digest})).status,'recorded');checks.push('timely checkpointed payment remains reconcilable after offer expiry');
 await assert.rejects(pool.query('update private.arcade_native_sui_payments set received=amount'));await assert.rejects(pool.query('delete from private.arcade_native_sui_payments'));if(netlifyMode)await assert.rejects(pool.query('truncate private.arcade_native_sui_payments'),/immutable/);checks.push('runtime cannot rewrite or delete native Sui payment evidence');

 const interrupted=await paymentFixture();evidence=interrupted.body;
 await createCredentialRevoker(owner).revoke({sessionToken:interrupted.native.token});
 const loginAgain=await fixture(interrupted.native.wallet);
 const reconciled=await recorder({sessionHash:loginAgain.sessionHash,offerId:interrupted.offerId,digest:interrupted.digest});
 const recoveredNative=await throughGateway('recover',loginAgain.token,{paymentId:reconciled.paymentId});
 assert.equal(recoveredNative.status,'recovered');assert.equal(recoveredNative.runId,interrupted.mapping.runId);assert.equal(recoveredNative.restoreAuthorized,false);
 assert.equal((await recorder({sessionHash:loginAgain.sessionHash,offerId:interrupted.offerId,digest:interrupted.digest})).paymentId,reconciled.paymentId);
 checks.push('fresh login reconciles paid native offer and recovers original run without old credential');
 const overtaken=await paymentFixture();evidence=overtaken.body;
 await recorder({sessionHash:overtaken.native.sessionHash,offerId:overtaken.offerId,digest:overtaken.digest});
 await owner.query('insert into public.tree_continue_redemptions(digest,session_id,continuation_number,wallet,run_id,offer_id) values($1,$2,0,$3,$4,$5)',[overtaken.digest,overtaken.native.id,overtaken.native.wallet,overtaken.native.nativeRunId,overtaken.offerId]);
 await assert.rejects(nativeShared.importPayment({sessionHash:overtaken.native.sessionHash,runId:overtaken.mapping.runId,source:'sui-native-tree',sourceId:overtaken.offerId}),/payment-already-redeemed/);
 checks.push('native redemption after verification is rejected by shared receipt adapter');

 const atomicPayment=await paymentFixture();evidence=atomicPayment.body;
 await owner.query("create function private.fail_shared_receipt() returns trigger language plpgsql as $$ begin raise exception 'shared receipt failure'; end $$;create trigger fail_shared_receipt before insert on private.arcade_continue_payments_v2 for each row execute function private.fail_shared_receipt();");
 await assert.rejects(recorder({sessionHash:atomicPayment.native.sessionHash,offerId:atomicPayment.offerId,digest:atomicPayment.digest}),/shared receipt failure/);
 assert.equal((await owner.query('select count(*)::int n from private.arcade_native_sui_payments where offer_id=$1',[atomicPayment.offerId])).rows[0].n,0);
 await owner.query('drop trigger fail_shared_receipt on private.arcade_continue_payments_v2;drop function private.fail_shared_receipt()');
 assert.equal((await recorder({sessionHash:atomicPayment.native.sessionHash,offerId:atomicPayment.offerId,digest:atomicPayment.digest})).status,'recorded');checks.push('native and shared payment evidence commit or roll back together');
 const excess=await paymentFixture();excess.body.Transaction.balanceChanges[0].amount=(BigInt(policy.amount)*2n).toString();evidence=excess.body;
 assert.equal((await recorder({sessionHash:excess.native.sessionHash,offerId:excess.offerId,digest:excess.digest})).sequence,1);
 const over=(await owner.query('select amount,received from private.arcade_native_sui_payments where offer_id=$1',[excess.offerId])).rows[0];assert.equal(over.amount,policy.amount);assert.equal(over.received,(BigInt(policy.amount)*2n).toString());checks.push('native overpayment remains one continue with excess recorded');

 if(process.env.NATIVE_BUNDLE_CHECK==='1'){
  const {loadNativeContinueTestBundle}=await import('./load-native-continue-test-bundle.mjs');
  const {createSharedNativeCheckout}=await import('./browser/shared-native-checkout.mjs');
  const bundle=await loadNativeContinueTestBundle();
  try{
   const player=await fixture(),snapshot={runId:player.nativeRunId,seed:1,score:0,wave:1,kills:0,perfect:0,maxStage:1,shotsFired:0,shotsHit:0,start:1,mode:'ARCADE'};
   let transaction,signatures=0;
   const client={network:'mainnet',core:{getCoinMetadata:async()=>({coinMetadata:{decimals:6}}),getTransaction:async()=>transaction},ledgerService:{getCheckpoint:async()=>({response:{checkpoint:{sequenceNumber:'10'}}})}};
   const nativePaidService=bundle.module.createPaidContinueService({pool,client,enabled:true,ownershipChecker:async()=>true});
   const packagedHost=bundle.module.createNativeContinueHost({pool,nativePaidService,legacyHandler:()=>assert.fail(),verifyRuntime:async()=>({...runtime,runtimeDigest:hostDigest}),checkOwnership:options.checkOwnership,readTransaction:createMainnetTransactionReader(client),runtimeDigest:hostDigest,databaseIdentity:runtime.databaseIdentity,readMode:async()=> 'shared',readCutover:async()=>({legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:hostDigest,databaseIdentity:runtime.databaseIdentity,checkedAt:Date.now(),expiresAt:Date.now()+30000})});
   const call=async(action,input)=>{const response=await packagedHost(new Request('https://tree-token.xyz/play/treeforce89/api/shared-continue-'+action,{method:'POST',headers:{origin:'https://tree-token.xyz',authorization:'Bearer '+player.token,'content-type':'application/json'},body:JSON.stringify(input)}));assert.equal(response.status,200);return response.json();};
   const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
   class Transaction {pure={address:v=>v};coin(input){assert.equal(input.balance,20000000000n);return input;}transferObjects(coins,to){assert.equal(to,policy.recipient);}}
   const checkout=createSharedNativeCheckout({getSession:()=>({wallet:player.wallet,nativeRunId:player.nativeRunId,sessionToken:player.token,epoch:'fixture'}),transport:{offer:i=>call('offer',i),record:i=>call('record',i),recover:i=>call('recover',i)},Transaction,storage,legacyStorage:storage,locks:{request:async(k,o,fn)=>fn()},signAndExecute:async()=>{
    signatures++;const digest='D'+hex().replaceAll('0','1').slice(0,43);transaction={$kind:'Transaction',Transaction:{digest,status:{success:true},effects:{status:{success:true}},checkpoint:'11',timestampMs:Date.now(),transaction:{sender:player.wallet},balanceChanges:[{coinType:policy.token,address:policy.recipient,amount:policy.amount}]}};return transaction;
   }});
   const offer=await checkout.review(snapshot),again=await checkout.review(snapshot);assert.equal(offer.offerId,again.offerId);
   const receipt=await checkout.pay(offer);assert.equal(receipt.status,'recorded');assert.equal(receipt.restoreAuthorized,false);
   await assert.rejects(checkout.pay(offer),/recover-existing-payment/);assert.equal((await checkout.reconcile()).paymentId,receipt.paymentId);assert.equal(signatures,1);assert.equal((await checkout.recoverPending()).status,'recovered');assert.equal(checkout.pending().canPay,false);
   assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[player.id])).rows[0].continuation_number,0);
   checks.push('bundled released native offer and shared checkout record one mocked chain payment; retry reconciles without re-signing or restoration');
   console.log(JSON.stringify({nativeBundle:bundle.evidence,chainEvidence:'mocked; no wallet or network call'},null,2));
  }finally{bundle.close();}
 }
 if(process.env.CONTINUE_PHASER_CHECK==='1'){
  const {createRestoreAuthorization}=await import('./continue-restore-authorization.mjs');
  const {checkPhaserRestore}=await import('./check-phaser-restore.mjs');
  const browserResults=[];
  for(const source of ['sui-native-tree','bnb-usdt']){
   const actor=await fixture(),mapping=await tx(db=>adapter.bind(db,actor)),sourceId=hex();
   const snapshotText=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId:mapping.runId,lives:0,continuesUsed:0,nativeSnapshot:{runId:actor.nativeRunId,seed:12,score:55,wave:2,kills:6,perfect:1,maxStage:2,shotsFired:10,shotsHit:8,start:100,mode:'ARCADE'}});
   const authAdapter=createNativeSuiSessionAdapter({...options,readReviewedCheckpoint:async()=>({validated:true,snapshotText,hash:sha(snapshotText)})});
   const delivery=createSharedContinueDelivery({pool,lockSessionAndFlight:authAdapter.lockSessionAndFlight,consumeRun:authAdapter.consumeRun,settlePayment:async()=>{},loadPayment:async()=>({accountId:mapping.accountId,runId:mapping.runId,suiWallet:actor.wallet,sequence:1,receiptId:source+':'+hex(),payment:{...PAYMENT_TERMS_V2[source],payer:source.startsWith('sui-')?actor.wallet:'0x'+hex().slice(0,40)}})});
   const payment=await delivery.importPayment({sessionHash:actor.sessionHash,runId:mapping.runId,source,sourceId});
   const authorization=createRestoreAuthorization({delivery,readReleasePolicy:async()=>({enabled:true,runtimeVerified:true,origin:'https://tree-token.xyz',environment:'isolated-test',checkpointPolicy:'native-client-nonreward-v1',releaseId:'1'.repeat(64),sourceCommit:provenance.commit,gameCodeHash:sha(fs.readFileSync('docs/multichain/generation-milestone/phaser-restoration/provenance.json')),checkedAt:Date.now(),expiresAt:Date.now()+60000})});
   browserResults.push({source,...await checkPhaserRestore({authorization,sessionToken:actor.token,paymentId:payment.paymentId,session:{accountId:mapping.accountId,runId:mapping.runId,nativeRunId:actor.nativeRunId,epoch:'isolated-fixture',expiresAt:(await owner.query('select expires_at from public.tree_game_sessions where session_id=$1',[actor.id])).rows[0].expires_at.getTime()}})});
   assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[actor.id])).rows[0].continuation_number,1);
   assert.equal((await owner.query("select count(*)::int n from private.arcade_continue_claims_v2 where run_id=$1 and state='started'",[mapping.runId])).rows[0].n,1);
  }
  checks.push('Sui and BNB typed payments each traverse real shared PostgreSQL consumption and actual Phaser restore once');
  console.log(JSON.stringify({phaserResults:browserResults,localOnly:true,releasePolicy:'isolated fixture only'},null,2));
 }
 console.log(JSON.stringify({localOnly:true,netlifyMode,passed:checks.length,checks,nativeSourceCommit:provenance.commit,productionParityVerified:false,liveRestorationEnabled:false},null,2));
}catch(error){if(!started&&fs.existsSync(path.join(dir,'log')))process.stderr.write(fs.readFileSync(path.join(dir,'log'),'utf8'));throw error;}finally{await pool?.end();await owner?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
