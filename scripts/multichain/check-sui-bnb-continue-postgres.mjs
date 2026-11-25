// Disposable localhost database only. Does not accept hosted credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';
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
 const a=await fixture();assert.equal(await store.insertChallenge(a),true);assert.equal((await createPostgresContinueStore({pool,lockSuiRun}).read(a.id)).accountId,a.accountId);checks.push('challenge durable across adapter instances');
 const snapshot=(await store.read(a.id)).paymentTerms;assert.equal(snapshot.amount,'1000000000000000000');assert.equal(snapshot.policyVersion,'bnb-usdt-continue-v1');
 await owner.query("update private.arcade_bnb_continue_checkouts set payment_terms=jsonb_set(payment_terms,'{amount}','\"2\"'::jsonb) where id=$1",[a.id]);await assert.rejects(store.read(a.id),/unreviewed-payment-policy/);await owner.query('update private.arcade_bnb_continue_checkouts set payment_terms=$1::jsonb where id=$2',[JSON.stringify(snapshot),a.id]);checks.push('immutable payment policy snapshot rejects changed pricing instead of reinterpreting old receipts');
 const opened=await Promise.all(Array.from({length:12},()=>store.open(a)));assert.equal(opened.filter(Boolean).length,1);checks.push('12 independent connections consume one link challenge once');
 const receipt=payment(a);receipt.paidAt=Date.now();
 const paid=await Promise.all(Array.from({length:12},()=>store.recordPayment(receipt)));assert(paid.every(v=>v===true));
 assert.equal((await owner.query('select count(*)::int as n from private.arcade_bnb_continue_receipts')).rows[0].n,1);
 assert.equal((await owner.query('select count(*)::int as n from private.arcade_bnb_continue_delivery_pending')).rows[0].n,1);checks.push('12 receipt retries persist one receipt and one delivery candidate');
 const recovered=await store.deliveryCandidate({id:a.id,sessionHash:a.sessionHash});assert.equal(recovered.protocol,'tree-mixed-payment-review.v1');assert.equal(recovered.deliveryCompatible,false);assert.equal(recovered.targetDeliveryProtocol,'tree-paid-delivery.v1');assert.equal(recovered.restoreAuthorized,false);assert.equal(recovered.authorization,null);assert.equal(recovered.payment.network,'eip155:56');assert.equal(recovered.accessWallet.family,'sui');checks.push('typed delivery candidate is recoverable and never grants lives');
 assert.equal(await store.recordPayment({...receipt,blockHash:'0x'+hex()}),false);checks.push('same transaction cannot change recorded block evidence');
 const b=await fixture({payer:a.payer});await store.insertChallenge(b);await assert.rejects(store.open(b));assert.equal((await store.read(b.id)).status,'challenge');checks.push('payer uniqueness spans different sessions/accounts');
 const otherPayer={...a,id:hex(),payer:'0x'+hex().slice(0,40)};await store.insertChallenge(otherPayer);await assert.rejects(store.open(otherPayer));checks.push('run/continue uniqueness holds across different BNB payers');
 const c=await fixture();await store.insertChallenge(c);await store.open(c);
 await assert.rejects(store.recordPayment({...receipt,id:c.id,sessionHash:c.sessionHash,paidAt:Date.now()}));
 assert.equal((await store.read(c.id)).status,'open');checks.push('receipt cannot be claimed by another checkout; failed claim rolls back');
 const d=await fixture();await store.insertChallenge(d);await store.open(d);
 await owner.query("create function private.reject_pending() returns trigger language plpgsql as $$ begin raise exception 'injected delivery insert failure'; end $$;create trigger fail_pending before insert on private.arcade_bnb_continue_delivery_pending for each row execute function private.reject_pending();");
 const dp=payment(d);dp.paidAt=Date.now();await assert.rejects(store.recordPayment(dp));assert.equal((await store.read(d.id)).status,'open');
 assert.equal((await owner.query('select count(*)::int as n from private.arcade_bnb_continue_receipts where checkout_id=$1',[d.id])).rows[0].n,0);
 await owner.query('drop trigger fail_pending on private.arcade_bnb_continue_delivery_pending;drop function private.reject_pending();');
 assert.equal(await store.recordPayment(dp),true);checks.push('receipt/order/delivery insert roll back together and retry succeeds');
 const e=await fixture();await store.insertChallenge(e);
 const blocker=await owner.connect();await blocker.query('begin');await blocker.query('update private.test_sui_sessions set revoked=true where hash=$1',[e.sessionHash]);
 let settled=false;const pending=store.open(e).then(v=>{settled=true;return v;},err=>{settled=true;return err;});
 await owner.query('select pg_sleep(0.1)');assert.equal(settled,false);await blocker.query('commit');blocker.release();assert((await pending) instanceof Error);checks.push('session revocation committed while opener waits prevents checkout');
 const f=await fixture();await store.insertChallenge(f);await owner.query('update private.test_sui_flights set lives=3 where id=$1',[f.runId]);await assert.rejects(store.open(f));checks.push('flight state rechecked under lock before opening');
 const rate=await fixture();const admissions=await Promise.allSettled(Array.from({length:12},()=>store.insertChallenge({...rate,id:hex()})));assert.equal(admissions.filter(x=>x.status==='fulfilled'&&x.value===true).length,5);await assert.rejects(store.insertChallenge({...rate,id:hex()}),/rate-limited/);checks.push('five-per-minute challenge limit serialized by session lock');
 await assert.rejects(store.deliveryCandidate({id:a.id,sessionHash:hex()}));checks.push('another session cannot recover a payment candidate');
 const changed=await fixture();await store.insertChallenge(changed);await assert.rejects(store.open({...changed,payer:'0x'+hex().slice(0,40)}),/signed-terms-changed/);checks.push('stored signed terms cannot be changed at opening');
 const oldSession=await fixture();await store.insertChallenge(oldSession);await owner.query("update private.test_sui_sessions set expires_at=clock_timestamp()-interval '1 second' where hash=$1",[oldSession.sessionHash]);await assert.rejects(store.open(oldSession));checks.push('expired session cannot open an unexpired checkout');
 const expired=await fixture({issuedAt:Date.now()-100,expiresAt:Date.now()+1000});await store.insertChallenge(expired);await owner.query('select pg_sleep(1.1)');assert.equal(await store.open(expired),false);checks.push('database-clock quote expiry');
 await assert.rejects(pool.query('delete from private.arcade_bnb_continue_receipts'));
 await assert.rejects(pool.query('update private.arcade_bnb_continue_checkouts set terms=terms'));
 await assert.rejects(pool.query('delete from private.arcade_bnb_continue_checkouts'));
 await assert.rejects(pool.query("update private.arcade_bnb_continue_receipts set tx_hash=tx_hash"));
 const role=await owner.connect();try {await role.query('set role anon');await assert.rejects(role.query('select * from private.arcade_bnb_continue_checkouts'));}finally{await role.query('reset role');role.release();}
 assert.equal((await owner.query("select count(*)::int as n from pg_class where relname like 'arcade_bnb_continue_%' and relkind='r' and relrowsecurity")).rows[0].n,3);checks.push('private RLS tables; public access and runtime receipt edits/deletes denied');
 // Full service: real wallet signatures, actual PG store, synthetic chain receipt.
 const sui=new Ed25519Keypair(),bnb=privateKeyToAccount('0x'+'56'.repeat(32)),token=hex();
 const full=await fixture({sessionHash:sha(token),suiWallet:sui.toSuiAddress(),payer:bnb.address.toLowerCase()});
 const readSuiRun=async raw=>{if(raw!==token)return null;const db=await owner.connect();try{const s=await lockSuiRun(db,sha(raw),full.runId);return {...s,entitled:true,checkedAt:new Date().toISOString()};}finally{db.release();}};
 const transactionHash='0x'+hex(),bh='0x'+hex();
 const service=createSuiBnbContinue({readSuiRun,store,readPayment:async()=>({chainId:56,transaction:{hash:transactionHash,blockHash:bh,blockNumber:10n,from:full.payer,to:CONTINUE_POLICY.token,value:0n,input:continueTransferData()},receipt:{transactionHash,blockHash:bh,blockNumber:10n,status:'success',logs:[{address:CONTINUE_POLICY.token,removed:false,transactionHash,blockHash:bh,logIndex:0,topics:encodeEventTopics({abi:parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']),eventName:'Transfer',args:{from:full.payer,to:CONTINUE_POLICY.treasury}}),data:encodeAbiParameters([{type:'uint256'}],[BigInt(CONTINUE_POLICY.amount)])}]},block:{hash:bh,number:10n,timestamp:BigInt(Math.floor(Date.now()/1000))},finalized:{number:11n}})});
 const input={sessionToken:token,origin:CONTINUE_POLICY.origin,payer:full.payer};
 const challenge=await service.challenge(input);
 const open=await service.open({...input,id:challenge.id,suiSignature:(await sui.signPersonalMessage(new TextEncoder().encode(challenge.message))).signature,bnbSignature:await bnb.signMessage({message:challenge.message})});
 assert.equal(open.paymentEnabled,false);
 // Advance to the first whole block second admitted by the quote.
 await owner.query('select pg_sleep(1)');
 const verified=await service.reconcile({...input,id:challenge.id,txHash:transactionHash});assert.equal(verified.paymentVerified,true);assert.equal(verified.continueAuthorized,false);
 assert.equal((await store.deliveryCandidate({id:challenge.id,sessionHash:sha(token)})).payment.txHash,transactionHash);checks.push('real two-wallet signatures -> coordinator -> PostgreSQL receipt -> typed pending delivery');
 console.log(JSON.stringify({localOnly:true,positivePayment:'synthetic chain receipt; real signatures and PostgreSQL',passed:checks.length,checks,livePaymentsEnabled:false},null,2));
}finally{await pool?.end();await owner?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
