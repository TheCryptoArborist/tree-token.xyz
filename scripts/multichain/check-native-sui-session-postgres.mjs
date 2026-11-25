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
 await owner.query(fs.readFileSync('docs/multichain/generation-milestone/mixed-chain-store/schema.sql','utf8'));
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

 // Native v2 bridge: real test signatures, actual native tables, synthetic RPC evidence.
 const {Ed25519Keypair}=await import('@mysten/sui/keypairs/ed25519');
 const {privateKeyToAccount}=await import('viem/accounts');
 const {encodeEventTopics,encodeAbiParameters,parseAbi}=await import('viem');
 const {CONTINUE_POLICY,continueTransferData}=await import('./sui-bnb-continue.mjs');
 const nativeSuiKey=new Ed25519Keypair(),nativeEvmKey=privateKeyToAccount('0x'+'67'.repeat(32));
 const linked=await fixture(nativeSuiKey.toSuiAddress()),linkedMap=await tx(db=>adapter.bind(db,linked));
 let linkedOwnership=true,linkedCheckpoint=true,linkedBadHash=false,linkedProof;
 const linkedSnapshot=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId:linkedMap.runId,lives:0,continuesUsed:0,nativeSnapshot:{runId:linked.nativeRunId,seed:1,score:0,wave:1,kills:0,perfect:0,maxStage:1,shotsFired:0,shotsHit:0,start:1,mode:'ARCADE'}});
 const bnbGateway=createNativeContinueHost({pool,legacyHandler:()=>assert.fail('no legacy fallback'),nativePaidService:{offer:()=>{throw Error('not used');}},verifyRuntime:async()=>({...runtime,runtimeDigest:hostDigest}),checkOwnership:async()=>({owned:linkedOwnership,checkedAt:Date.now()}),readReviewedCheckpoint:async()=>linkedCheckpoint?{validated:true,snapshotText:linkedSnapshot,hash:linkedBadHash?hex():sha(linkedSnapshot)}:null,readBnbPayment:async()=>linkedProof,readTransaction:reader,runtimeDigest:hostDigest,databaseIdentity:runtime.databaseIdentity,readMode:async()=> 'shared',readCutover:async()=>({legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:hostDigest,databaseIdentity:runtime.databaseIdentity,checkedAt:Date.now(),expiresAt:Date.now()+30000})});
 const nativeBnb=Object.fromEntries(['context','challenge','open','reconcile'].map(action=>[action,async input=>{
  const keys={context:[],challenge:['payer'],open:['id','suiSignature','bnbSignature'],reconcile:['id','txHash']}[action];
  const response=await bnbGateway(new Request('https://tree-token.xyz/play/treeforce89/api/shared-continue-bnb-'+action,{method:'POST',headers:{origin:input.origin,authorization:'Bearer '+input.sessionToken,'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(keys.map(k=>[k,input[k]])))}));
  const result=await response.json();if(response.status!==200)throw Error(result.code);assert.equal(result.paymentEnabled,false);assert.equal(result.restoreAuthorized,false);return result;
 }]));
 const linkedInput={origin:CONTINUE_POLICY.origin,sessionToken:linked.token,payer:nativeEvmKey.address.toLowerCase()};
 await assert.rejects(nativeBnb.challenge({...linkedInput,sessionToken:'invalid'}),/SESSION_REQUIRED/);
 linkedBadHash=true;await assert.rejects(nativeBnb.challenge(linkedInput),/REVIEW_REQUIRED/);linkedBadHash=false;
 linkedCheckpoint=false;await assert.rejects(nativeBnb.challenge(linkedInput),/REVIEW_REQUIRED/);linkedCheckpoint=true;
 linkedOwnership=false;await assert.rejects(nativeBnb.challenge(linkedInput),/REVIEW_REQUIRED/);linkedOwnership=true;
 const authenticatedContext=await nativeBnb.context(linkedInput);assert.equal(authenticatedContext.runId,linkedMap.runId);assert.equal(authenticatedContext.suiWallet,nativeSuiKey.toSuiAddress());assert.equal(authenticatedContext.nativeRunId,linked.nativeRunId);assert(!('sessionToken' in authenticatedContext));
 linkedOwnership=false;await assert.rejects(nativeBnb.context(linkedInput),/REVIEW_REQUIRED/);linkedOwnership=true;checks.push('authenticated BNB context returns native mapping without bearer and rejects lost ownership');
 const linkedChallenge=await nativeBnb.challenge(linkedInput);
 const linkedSigned={...linkedInput,id:linkedChallenge.id,suiSignature:(await nativeSuiKey.signPersonalMessage(new TextEncoder().encode(linkedChallenge.message))).signature,bnbSignature:await nativeEvmKey.signMessage({message:linkedChallenge.message})};
 linkedOwnership=false;await assert.rejects(nativeBnb.open(linkedSigned),/REVIEW_REQUIRED/);linkedOwnership=true;
 const linkedQuote=await nativeBnb.open(linkedSigned);assert.equal(linkedQuote.paymentEnabled,false);await assert.rejects(nativeBnb.open(linkedSigned));
 await owner.query('select pg_sleep(1)');
 const linkedHash='0x'+hex(),linkedBlock='0x'+hex();
 linkedProof={chainId:56,transaction:{hash:linkedHash,blockHash:linkedBlock,blockNumber:10n,from:linkedInput.payer,to:CONTINUE_POLICY.token,value:0n,input:continueTransferData()},receipt:{transactionHash:linkedHash,blockHash:linkedBlock,blockNumber:10n,status:'success',logs:[{address:CONTINUE_POLICY.token,removed:false,transactionHash:linkedHash,blockHash:linkedBlock,logIndex:0,topics:encodeEventTopics({abi:parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']),eventName:'Transfer',args:{from:linkedInput.payer,to:CONTINUE_POLICY.treasury}}),data:encodeAbiParameters([{type:'uint256'}],[BigInt(CONTINUE_POLICY.amount)])}]},block:{hash:linkedBlock,number:10n,timestamp:BigInt(Math.floor(Date.now()/1000))},finalized:{number:11n}};
 linkedOwnership=false;assert.equal((await nativeBnb.reconcile({...linkedInput,id:linkedChallenge.id,txHash:linkedHash})).paymentVerified,true);linkedOwnership=true;
 const linkedReceipt=await throughGateway('bnb-record',linked.token,{runId:linkedMap.runId,checkoutId:linkedChallenge.id,txHash:linkedHash});assert.equal(linkedReceipt.source,'bnb-usdt');
 assert.equal((await throughGateway('bnb-record',linked.token,{runId:linkedMap.runId,checkoutId:linkedChallenge.id,txHash:linkedHash})).paymentId,linkedReceipt.paymentId);
 assert.equal((await owner.query('select continuation_number from public.tree_game_sessions where session_id=$1',[linked.id])).rows[0].continuation_number,0);
 checks.push('native v2 host/HTTP sessions and reviewed checkpoint support real wallet-link signatures, synthetic receipt verification and idempotent shared import without restoration');
 checks.push('native BNB quote/open reject missing checkpoint, lost entitlement and replay; paid receipt remains reconcilable after access loss');
 // Synthetic verified BNB ledger rows; real shared loader, settlement and completion.
 const bnbActor=await fixture(),bnbMap=await tx(db=>adapter.bind(db,bnbActor)),bnbId=hex(),payer='0x'+hex().slice(0,40),bnbHash='0x'+hex(),receiptId='56:'+bnbHash+':0';
 const bnbTerms={id:bnbId,sessionHash:bnbActor.sessionHash,accountId:bnbMap.accountId,runId:bnbMap.runId,payer,suiWallet:bnbActor.wallet,sequence:1,deliveryProtocol:'tree-paid-delivery.v2',issuedAt:Date.now(),expiresAt:Date.now()+60000,status:'paid-review'};
 const bnbPrice=PAYMENT_TERMS_V2['bnb-usdt'];
 await owner.query(`insert into private.arcade_bnb_continue_checkouts(id,session_hash,account_id,run_id,payer,sequence,terms,payment_terms,issued_at,expires_at,status) values($1,$2,$3,$4,$5,1,$6,$7,clock_timestamp(),clock_timestamp()+interval '1 minute','paid-review')`,[bnbId,bnbActor.sessionHash,bnbMap.accountId,bnbMap.runId,payer,bnbTerms,{policyVersion:'bnb-usdt-continue-v1',token:bnbPrice.token,amount:bnbPrice.amount,treasury:bnbPrice.recipient}]);
 await owner.query(`insert into private.arcade_bnb_continue_receipts(checkout_id,payment_key,tx_hash,block_hash,paid_at) values($1,$2,$3,$4,clock_timestamp())`,[bnbId,receiptId,bnbHash,'0x'+hex()]);
 await owner.query('insert into private.arcade_bnb_continue_delivery_pending(checkout_id) values($1)',[bnbId]);
 const bnbSnapshot=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId:bnbMap.runId,lives:0,continuesUsed:0});
 const bnbAdapter=createNativeSuiSessionAdapter({...options,readReviewedCheckpoint:async()=>({validated:true,snapshotText:bnbSnapshot,hash:sha(bnbSnapshot)})});
 const bnbDelivery=createSharedContinueDelivery({pool,lockSessionAndFlight:bnbAdapter.lockSessionAndFlight,consumeRun:bnbAdapter.consumeRun});
 const bnbInput={sessionHash:bnbActor.sessionHash,runId:bnbMap.runId,source:'bnb-usdt',sourceId:bnbId};
 const {createBnbPaymentJournal}=await import('./browser/bnb-payment-journal.mjs');
 const bnbJournalValues=new Map(),bnbStorage={getItem:k=>bnbJournalValues.get(k)||null,setItem:(k,v)=>bnbJournalValues.set(k,v),removeItem:k=>bnbJournalValues.delete(k)};
 const bnbJournal=createBnbPaymentJournal({getSession:()=>({wallet:bnbActor.wallet,runId:bnbMap.runId,nativeRunId:bnbActor.nativeRunId,sessionToken:bnbActor.token,epoch:'fixture'}),transport:{'bnb-record':i=>throughGateway('bnb-record',bnbActor.token,i),recover:i=>throughGateway('recover',bnbActor.token,i),complete:i=>throughGateway('complete',bnbActor.token,i)},storage:bnbStorage,locks:{request:async(k,o,fn)=>fn()}});
 await bnbJournal.begin({checkoutId:bnbId,payer});
 const badHashResponse=await gateway(new Request('https://tree-token.xyz/play/treeforce89/api/shared-continue-bnb-record',{method:'POST',headers:{origin:'https://tree-token.xyz',authorization:'Bearer '+bnbActor.token,'content-type':'application/json'},body:JSON.stringify({runId:bnbMap.runId,checkoutId:bnbId,txHash:'0x'+hex()})}));assert.equal(badHashResponse.status,503);
 const bnbImports=await Promise.all(Array.from({length:8},()=>throughGateway('bnb-record',bnbActor.token,{runId:bnbMap.runId,checkoutId:bnbId,txHash:bnbHash})));assert(bnbImports.every(r=>r.paymentId===bnbImports[0].paymentId));
 const bnbPayment=await bnbJournal.record({txHash:bnbHash});assert.equal((await bnbJournal.record()).paymentId,bnbPayment.paymentId);assert.equal((await bnbJournal.recover()).status,'recovered');await assert.rejects(bnbJournal.archive());
 const bnbClient=hex(),bnbLease=await bnbDelivery.prepare({...bnbInput,paymentId:bnbPayment.paymentId,clientKey:bnbClient});
 assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,false);
 await bnbDelivery.activate({...bnbInput,paymentId:bnbPayment.paymentId,clientKey:bnbClient,leaseId:bnbLease.leaseId,checkpointHash:bnbLease.checkpointHash,requestId:randomUUID()});
 assert.equal((await owner.query('select status from private.arcade_bnb_continue_checkouts where id=$1',[bnbId])).rows[0].status,'consumed');
 assert.equal((await bnbDelivery.activate({...bnbInput,paymentId:bnbPayment.paymentId,clientKey:bnbClient,leaseId:bnbLease.leaseId,checkpointHash:bnbLease.checkpointHash,requestId:randomUUID()})).status,'review-required');
 const bnbComplete=await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId});assert.equal(bnbComplete.archiveAllowed,true);assert.equal(bnbComplete.source,'bnb-usdt');assert.equal(bnbComplete.txHash,bnbHash);assert.equal(bnbComplete.receiptId,receiptId);assert.equal(bnbComplete.payer,payer);
 const bnbStranger=await fixture();assert.equal((await throughGateway('complete',bnbStranger.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,false);
 const bnbFresh=await fixture(bnbActor.wallet);assert.equal((await throughGateway('complete',bnbFresh.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,true);
 const savedPayment=(await owner.query('select payment from private.arcade_continue_payments_v2 where id=$1',[bnbPayment.paymentId])).rows[0].payment;
 for(const patch of [{amount:'1'},{payer:'0x'+hex().slice(0,40)},{network:'eip155:1'},{token:'wrong'},{recipient:'wrong'}]){
  await owner.query('update private.arcade_continue_payments_v2 set payment=$2 where id=$1',[bnbPayment.paymentId,{...savedPayment,...patch}]);
  assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,false);
 }
 await owner.query('update private.arcade_continue_payments_v2 set payment=$2 where id=$1',[bnbPayment.paymentId,savedPayment]);
 await owner.query('update public.tree_game_sessions set continuation_number=0 where session_id=$1',[bnbActor.id]);assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,false);
 await owner.query('update public.tree_game_sessions set continuation_number=1 where session_id=$1',[bnbActor.id]);
 assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,true);
 const originalReceipt=(await owner.query('select *,paid_at::text as paid_text from private.arcade_bnb_continue_receipts where checkout_id=$1',[bnbId])).rows[0];
 const alteredHash='0x'+hex();await owner.query('update private.arcade_bnb_continue_receipts set tx_hash=$2,payment_key=$3 where checkout_id=$1',[bnbId,alteredHash,'56:'+alteredHash+':0']);
 assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,false);
 await owner.query(`update private.arcade_bnb_continue_receipts set tx_hash=$2,payment_key=$3,paid_at=clock_timestamp()+interval '1 day' where checkout_id=$1`,[bnbId,originalReceipt.tx_hash,originalReceipt.payment_key]);
 assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,false);
 await owner.query('update private.arcade_bnb_continue_receipts set paid_at=$2 where checkout_id=$1',[bnbId,originalReceipt.paid_text]);
 assert.equal((await throughGateway('complete',bnbActor.token,{paymentId:bnbPayment.paymentId})).archiveAllowed,true);
 assert.equal((await bnbJournal.archive()).status,'archived');assert.equal(bnbJournal.pending().canPay,true);assert.equal(bnbJournalValues.size,1);
 checks.push('real BNB loader/settlement consumes ledger once; completion rejects unconsumed, foreign-wallet, mismatched terms and counter evidence');
 checks.push('BNB journal imports verified receipt through authenticated host, recovers without payment, and archives only after consumption');
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
