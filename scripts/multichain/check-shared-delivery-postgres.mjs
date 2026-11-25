// Disposable localhost database only. Does not accept hosted credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';
import {createSharedContinueDelivery} from './shared-continue-delivery.mjs';
import {createPostgresContinueStore} from './sui-bnb-continue-store.mjs';
import {createSuiBnbContinue,CONTINUE_POLICY,continueTransferData} from './sui-bnb-continue.mjs';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';import {privateKeyToAccount} from 'viem/accounts';
import {parseAbi,encodeEventTopics,encodeAbiParameters} from 'viem';
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
 await owner.query(fs.readFileSync('supabase/migrations/20261120193912_arcade_bnb_test_auth.sql','utf8'));
 const fingerprint="select md5(string_agg(pg_get_functiondef(oid)||coalesce(proacl::text,''),'' order by oid)) as hash from pg_proc where proname like 'arcade_bnb_test_%'";
 const before=(await owner.query(fingerprint)).rows[0].hash;
 await owner.query('alter default privileges in schema private grant all on tables to service_role;');
 await owner.query(fs.readFileSync('docs/multichain/generation-milestone/mixed-chain-store/schema.sql','utf8'));
 await owner.query('alter default privileges in schema private revoke all on tables from service_role;');
 assert.equal((await owner.query(fingerprint)).rows[0].hash,before);checks.push('existing identity functions and grants unchanged');
 await owner.query(fs.readFileSync('docs/multichain/generation-milestone/shared-delivery/schema.sql','utf8'));
 // Explicit test-only authoritative session/flight fixtures, not production tables.
 await owner.query(`create table private.test_sui_sessions(hash text primary key,account_id uuid, wallet text,expires_at timestamptz,revoked boolean default false);
 create table private.test_sui_flights(id uuid primary key,account_id uuid,lives integer default 0,continues integer default 0,finished boolean default false);
 grant select,update on private.test_sui_sessions,private.test_sui_flights to service_role;`);
 pool=new pg.Pool({...config,options:'-c role=service_role'});
 async function lockSuiRun(db,sessionHash,runId){
  const s=(await db.query('select * from private.test_sui_sessions where hash=$1 for update',[sessionHash])).rows[0];
  const f=(await db.query('select * from private.test_sui_flights where id=$1::uuid for update',[runId])).rows[0];
  if(!s||!f||s.account_id!==f.account_id)return null;
  return {authenticated:true,revoked:s.revoked,sessionHash,accountId:s.account_id,runId,suiWallet:s.wallet,
   sequence:1,deliveryProtocol:'tree-paid-delivery.v1',expiresAt:s.expires_at.getTime(),lives:f.lives,continuesUsed:f.continues,finished:f.finished,continueAllowed:true,ruleset:'treeforce89.v1'};
 }
 const store=createPostgresContinueStore({pool,lockSuiRun});
 async function fixture(overrides={}) {
  const row={id:hex(),sessionHash:hex(),accountId:randomUUID(),runId:randomUUID(),suiWallet:'0x'+hex(),payer:'0x'+hex().slice(0,40),sequence:1,deliveryProtocol:'tree-paid-delivery.v1',issuedAt:Date.now()-10,expiresAt:Date.now()+60000,status:'challenge',...overrides};
  await owner.query("insert into private.test_sui_sessions values($1,$2,$3,clock_timestamp()+interval '1 hour',false)",[row.sessionHash,row.accountId,row.suiWallet]);
  await owner.query('insert into private.test_sui_flights(id,account_id) values($1,$2)',[row.runId,row.accountId]);return row;
 }
 const payment=r=>{const txHash='0x'+hex();return {id:r.id,sessionHash:r.sessionHash,txHash,paymentKey:`56:${txHash}:0`,blockHash:'0x'+hex(),paidAt:Math.ceil(r.issuedAt/1000)*1000};};
 const checkpoints=new Map(),proofs=new Map();
 async function auth(db,h,r){const s=await lockSuiRun(db,h,r);return s?{...s,origin:'https://tree-token.xyz',environment:'mainnet',entitled:true,entitlementCheckedAt:Date.now(),checkpoint:checkpoints.get(r)}:null;}
 const service=createSharedContinueDelivery({pool,lockSessionAndFlight:auth,loadPayment:async(_db,{sourceId})=>proofs.get(sourceId)});
 const policies=(await import('./shared-continue-delivery.mjs')).PAYMENT_TERMS_V2;
 async function run(){const r=await fixture();const snapshotText=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId:r.runId,lives:0,continuesUsed:0,wave:1,score:0,scene:{fixture:true}});checkpoints.set(r.runId,{validated:true,snapshotText,hash:sha(snapshotText)});return r;}
 async function pay(r,source){const sourceId=hex();proofs.set(sourceId,{accountId:r.accountId,runId:r.runId,suiWallet:r.suiWallet,receiptId:source+':'+hex(),payment:{...policies[source],payer:source==='sui-tree'?r.suiWallet:r.payer}});return service.importPayment({...r,source,sourceId});}
 const r=await run(),sui=await pay(r,'sui-tree'),bnb=await pay(r,'bnb-usdt');assert.notEqual(sui.paymentId,bnb.paymentId);checks.push('Sui TREE and BNB USDT retain distinct typed payment records for one run');
 const clients=Array.from({length:12},()=>hex());const prepared=await Promise.all(clients.map((clientKey,i)=>service.prepare({...r,paymentId:i%2?sui.paymentId:bnb.paymentId,clientKey})));
 const win=prepared.findIndex(p=>p.status==='prepared');assert.equal(prepared.filter(p=>p.status==='prepared').length,1);const lease=prepared[win];
 assert.equal((await owner.query('select count(*)::int n from private.arcade_continue_claims_v2')).rows[0].n,1);checks.push('12 competing Sui/BNB preparations share exactly one run claim');
 const activation={...r,clientKey:clients[win],leaseId:lease.leaseId,checkpointHash:lease.checkpointHash,requestId:randomUUID()};
 const activated=await Promise.all(Array.from({length:12},()=>service.activate(activation)));
 assert.equal(activated.filter(x=>x.consumed===true).length,1);assert(activated.every(x=>x.restoreAuthorized===false));
 assert.equal((await owner.query("select count(*)::int n from private.arcade_continue_events_v2 where event='started'")).rows[0].n,1);checks.push('12 activation retries consume once, one journal event, no live restore grant');
 assert.equal((await service.prepare({...r,paymentId:sui.paymentId,clientKey:hex()})).status,'review-required');checks.push('another payment or refreshed page cannot reacquire a consumed run');
 assert.equal((await owner.query('select count(*)::int n from private.arcade_continue_payments_v2')).rows[0].n,2);checks.push('losing payment remains recorded for recovery/refund review');
 const u=await run(),p=await pay(u,'bnb-usdt'),client=hex();checkpoints.get(u.runId).validated=false;await assert.rejects(service.prepare({...u,paymentId:p.paymentId,clientKey:client}),/unreviewed-checkpoint/);checkpoints.get(u.runId).validated=true;
 const prepared2=await service.prepare({...u,paymentId:p.paymentId,clientKey:client});
 await assert.rejects(service.activate({...u,clientKey:hex(),leaseId:prepared2.leaseId,requestId:randomUUID(),checkpointHash:prepared2.checkpointHash}),/lease-mismatch/);checks.push('unreviewed checkpoint and wrong page cannot consume');
 await owner.query("update private.arcade_continue_claims_v2 set lease_until=clock_timestamp()-interval '1 second' where account_id=$1 and run_id=$2",[u.accountId,u.runId]);
 await assert.rejects(service.activate({...u,clientKey:client,leaseId:prepared2.leaseId,requestId:randomUUID(),checkpointHash:prepared2.checkpointHash}),/expired-lease/);
 const newClient=hex(),renewed=await service.prepare({...u,paymentId:p.paymentId,clientKey:newClient});assert.notEqual(renewed.leaseId,prepared2.leaseId);checks.push('expired page lease can be prepared again without another payment');
 const blocker=await owner.connect();await blocker.query('begin');await blocker.query('update private.test_sui_sessions set revoked=true where hash=$1',[u.sessionHash]);
 let settled=false;const race=service.activate({...u,clientKey:newClient,leaseId:renewed.leaseId,requestId:randomUUID(),checkpointHash:renewed.checkpointHash}).catch(e=>e).finally(()=>{settled=true;});
 await owner.query('select pg_sleep(0.1)');assert.equal(settled,false);await blocker.query('commit');blocker.release();assert((await race) instanceof Error);checks.push('revocation committed before activation denies consumption');
 const x=await run(),xp=await pay(x,'sui-tree'),xc=hex(),xl=await service.prepare({...x,paymentId:xp.paymentId,clientKey:xc});
 await owner.query("create function private.reject_shared_event() returns trigger language plpgsql as $$ begin if new.event='started' then raise exception 'injected failure'; end if;return new;end $$;create trigger reject_shared before insert on private.arcade_continue_events_v2 for each row execute function private.reject_shared_event();");
 const xa={...x,clientKey:xc,leaseId:xl.leaseId,requestId:randomUUID(),checkpointHash:xl.checkpointHash};await assert.rejects(service.activate(xa));assert.equal((await owner.query('select state from private.arcade_continue_claims_v2 where run_id=$1',[x.runId])).rows[0].state,'prepared');
 await owner.query('drop trigger reject_shared on private.arcade_continue_events_v2;drop function private.reject_shared_event();');assert.equal((await service.activate(xa)).consumed,true);checks.push('consumption and journal rollback together; retry is recoverable');
 await assert.rejects(pool.query('delete from private.arcade_continue_payments_v2'));await assert.rejects(pool.query('update private.arcade_continue_payments_v2 set payment=payment'));await assert.rejects(pool.query("update private.arcade_continue_claims_v2 set state='prepared' where run_id=$1",[x.runId]));checks.push('runtime cannot rewrite payment or reopen consumed claim');
 // Actual BNB ledger loader, not normalized injected payment evidence.
 const liveAdapter=createSharedContinueDelivery({pool,lockSessionAndFlight:auth});const b=await run();await store.insertChallenge(b);await store.open(b);const tx='0x'+hex();await store.recordPayment({id:b.id,sessionHash:b.sessionHash,txHash:tx,paymentKey:'56:'+tx+':0',blockHash:'0x'+hex(),paidAt:Date.now()});
 const imported=await liveAdapter.importPayment({...b,source:'bnb-usdt',sourceId:b.id});const bp=await liveAdapter.prepare({...b,paymentId:imported.paymentId,clientKey:hex()});assert.equal(bp.status,'prepared');assert.equal(bp.restoreAuthorized,false);checks.push('actual persisted BNB receipt adapter feeds the shared run claim');
 const replay=await liveAdapter.importPayment({...b,source:'bnb-usdt',sourceId:b.id});assert.equal(replay.paymentId,imported.paymentId);checks.push('lost import response recovers the same payment identity');
 const preview=createSharedContinueDelivery({pool,lockSessionAndFlight:async(...args)=>({...await auth(...args),environment:'release-candidate'})});await assert.rejects(preview.importPayment({...b,source:'bnb-usdt',sourceId:b.id}),/invalid-session/);checks.push('preview identity cannot be relabelled as production');
 // Load the exact Sui-only source schema and read its native verified receipt.
 for(const file of ['direct-continue-schema.sql','flight-storage-v1.sql','paid-delivery-v1.sql'])await owner.query(fs.readFileSync('docs/multichain/generation-milestone/delivery-compatibility/upstream/'+file,'utf8'));
 await owner.query('grant usage on schema tree_continue_v1 to service_role;grant select on tree_continue_v1.orders,tree_continue_v1.receipts to service_role;');
 const sr=await run(),sc=checkpoints.get(sr.runId),order=randomUUID();
 await owner.query('select tree_continue_v1.register_flight($1,$2,$3,$4,$5)',[sr.accountId,sr.suiWallet,'https://tree-token.xyz','mainnet',sr.runId]);
 const cp=(await owner.query('select tree_continue_v1.store_checkpoint($1,$2,$3,$4,$5,$6,$7,$8) data',[sr.accountId,sr.suiWallet,'https://tree-token.xyz','mainnet',sr.runId,randomUUID(),sc.snapshotText,sc.hash])).rows[0].data;
 await owner.query("insert into tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) values($1,'validated','explicit-fixture',$2)",[cp.checkpointId,hex()]);
 const terms={kind:'direct-continue',product:'treeforce89.continue.v1',requiredRaw:policies['sui-tree'].amount,network:'sui:mainnet',recipient:policies['sui-tree'].recipient,accountId:sr.accountId,runId:sr.runId,orderId:order,payer:sr.suiWallet,flightHash:sc.hash,coinType:policies['sui-tree'].token,decimals:6,quantity:1,restoreLives:3};
 await owner.query("insert into tree_continue_v1.orders(account_id,run_id,order_id,terms,state) values($1,$2,$3,$4,'ordered')",[sr.accountId,sr.runId,order,terms]);
 await assert.rejects(liveAdapter.importPayment({...sr,source:'sui-tree',sourceId:order}),/payment-not-verified/);
 const receipt='sui:mainnet:'+hex();await owner.query('insert into tree_continue_v1.receipts(receipt_id,order_id) values($1,$2)',[receipt,order]);
 await owner.query("update tree_continue_v1.orders set state='verified',receipt_id=$1,evidence=$2 where order_id=$3",[receipt,{source:'chain-reader',status:'success',finalized:true,fixture:true},order]);
 const si=await liveAdapter.importPayment({...sr,source:'sui-tree',sourceId:order});assert.equal((await liveAdapter.prepare({...sr,paymentId:si.paymentId,clientKey:hex()})).status,'prepared');
 assert.equal((await owner.query('select state from tree_continue_v1.orders where order_id=$1',[order])).rows[0].state,'verified');checks.push('native Sui verified receipt feeds shared claim without rewriting Sui terms/order state');
 const stale=createSharedContinueDelivery({pool,lockSessionAndFlight:async(...args)=>({...await auth(...args),entitlementCheckedAt:Date.now()-6000})});
 await assert.rejects(stale.prepare({...sr,paymentId:si.paymentId,clientKey:hex()}),/unreviewed-checkpoint/);checks.push('stale entitlement proof cannot prepare or resume');
 console.log(JSON.stringify({localOnly:true,passed:checks.length,checks,identity:'explicit SQL fixtures; production adapter unresolved',liveRestorationEnabled:false},null,2));
}finally{await pool?.end();await owner?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
