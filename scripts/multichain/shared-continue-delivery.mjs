// Source-only shared delivery. No route, production auth adapter or activation.
import {createHash,randomUUID} from 'node:crypto';
const sha=v=>createHash('sha256').update(v).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const SUI_TOKEN='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const PAYMENT_TERMS_V2=Object.freeze({
 'sui-tree':Object.freeze({network:'sui:mainnet',token:SUI_TOKEN,amount:'20000000000',recipient:'0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f'}),
 'sui-native-tree':Object.freeze({network:'sui:mainnet',token:SUI_TOKEN,amount:'20000000000',recipient:'0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f'}),
 'bnb-usdt':Object.freeze({network:'eip155:56',token:'0x55d398326f99059ff775485246999027b3197955',amount:'1000000000000000000',recipient:'0xc440f06bbc7e58b0d055815f915447e4ae0e3720'}),
});
// Returns typed, persisted evidence, never treats BNB Transfer as a Sui event.
// Run only with a trusted server connection. No user-supplied receipt objects.
export async function loadRecordedContinuePayment(db,{source,sourceId}) {
 if(source==='sui-native-tree'){
  check(/^[a-f0-9]{48}$/.test(sourceId||''),'invalid-payment-reference');
  const r=(await db.query(`select * from private.arcade_native_sui_payments where offer_id=$1`,[sourceId])).rows[0];
  check(r,'payment-not-verified');
  const legacy=(await db.query('select digest from public.tree_continue_redemptions where digest=$1 or offer_id=$2',[r.digest,sourceId])).rows;
  if(legacy.length)check((await db.query(`select 1 from private.arcade_continue_payments_v2 p join private.arcade_continue_claims_v2 c on c.payment_id=p.id
   where p.source='sui-native-tree' and p.source_id=$1 and c.state='started'`,[sourceId])).rows.length===1,'payment-already-redeemed');
  return {accountId:r.account_id,runId:r.run_id,suiWallet:r.wallet,sequence:r.sequence,receiptId:'sui:mainnet:'+r.digest,
   payment:{...PAYMENT_TERMS_V2['sui-native-tree'],payer:r.wallet}};
 }
 if(source==='bnb-usdt'){
  check(hex(sourceId),'invalid-payment-reference');
  const r=(await db.query(`select c.terms,c.payment_terms,r.payment_key,r.tx_hash from private.arcade_bnb_continue_checkouts c
   join private.arcade_bnb_continue_receipts r on r.checkout_id=c.id
   join private.arcade_bnb_continue_delivery_pending d on d.checkout_id=c.id
   where c.id=$1 and c.status in ('paid-review','consumed') and d.state='pending-review'`,[sourceId])).rows[0];
  check(r&&r.payment_terms.policyVersion==='bnb-usdt-continue-v1','payment-not-verified');
  return {accountId:r.terms.accountId,runId:r.terms.runId,suiWallet:r.terms.suiWallet,sequence:r.terms.sequence,receiptId:r.payment_key,
   payment:{network:'eip155:56',payer:r.terms.payer,token:r.payment_terms.token,amount:r.payment_terms.amount,recipient:r.payment_terms.treasury}};
 }
 check(source==='sui-tree'&&uuid(sourceId),'invalid-payment-reference');
 const r=(await db.query(`select o.account_id,o.run_id,o.terms,o.receipt_id,o.evidence from tree_continue_v1.orders o
  join tree_continue_v1.receipts r on r.order_id=o.order_id and r.receipt_id=o.receipt_id
  where o.order_id=$1 and o.state='verified'`,[sourceId])).rows[0];
 check(r&&r.evidence?.source==='chain-reader'&&r.evidence.status==='success'&&r.evidence.finalized===true,'payment-not-verified');
 return {accountId:r.account_id,runId:r.run_id,suiWallet:r.terms.payer,sequence:1,receiptId:r.receipt_id,
  payment:{network:r.terms.network,payer:r.terms.payer,token:r.terms.coinType,amount:r.terms.requiredRaw,recipient:r.terms.recipient}};
}
export async function settleRecordedContinuePayment(db,payment) {
 if(payment.source==='sui-native-tree'){
  const r=(await db.query('select * from private.arcade_native_sui_payments where offer_id=$1',[payment.source_id])).rows[0];
  check(r&&payment.receipt_id==='sui:mainnet:'+r.digest,'native-receipt-conflict');
  const result=await db.query(`insert into public.tree_continue_redemptions(digest,session_id,continuation_number,wallet,run_id,offer_id,snapshot,payment_timestamp_ms,checkpoint)
   select $1,s.session_id,$2,s.wallet,s.run_id,$3,$4,$5,$6 from public.tree_game_sessions s
   where s.session_id=$7 and s.run_id=$8 and s.wallet=$9 and s.continuation_number=$10 and not s.game_over and not s.continue_pending returning digest`,
   [r.digest,r.sequence-1,r.offer_id,r.snapshot,r.timestamp_ms,r.checkpoint,r.native_session_id,r.native_run_id,r.wallet,r.sequence]);
  check(result.rowCount===1,'native-redemption-conflict');return;
 }
 if(payment.source!=='bnb-usdt')return;
 const result=await db.query(`update private.arcade_bnb_continue_checkouts c set status='consumed'
  where c.id=$1 and c.status='paid-review' and exists(select 1 from private.arcade_bnb_continue_receipts r
  where r.checkout_id=c.id and r.payment_key=$2) returning c.id`,[payment.source_id,payment.receipt_id]);
 check(result.rowCount===1,'bnb-settlement-conflict');
}
export function createSharedContinueDelivery({pool,lockSessionAndFlight,loadPayment=loadRecordedContinuePayment,settlePayment=settleRecordedContinuePayment,consumeRun=async()=>{throw Error('run-consumption-adapter-required');}}){
 check(typeof pool?.connect==='function'&&typeof lockSessionAndFlight==='function'&&typeof loadPayment==='function','production-session-adapter-required');
 async function transact(input,fn){
  check(hex(input.sessionHash)&&uuid(input.runId),'invalid-session-reference');
  const db=await pool.connect();
  try{
   await db.query('begin');await db.query("set local statement_timeout='15s'");await db.query("set local lock_timeout='5s'");
   // Must lock authoritative session/flight on THIS connection and verify fresh
   // entitlement. Preview aliases or browser identity are not valid substitutes.
   const s=await lockSessionAndFlight(db,input.sessionHash,input.runId);
   check(s?.authenticated===true&&s.revoked===false&&s.sessionHash===input.sessionHash&&s.runId===input.runId&&uuid(s.accountId)&&
    /^0x[a-f0-9]{64}$/.test(s.suiWallet||'')&&s.origin==='https://tree-token.xyz'&&s.environment==='mainnet','invalid-session');
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`shared-continue:${s.accountId}:${s.runId}`]);
   const now=(await db.query('select floor(extract(epoch from clock_timestamp())*1000)::float8 as now')).rows[0].now;
   check(Number.isSafeInteger(s.expiresAt)&&s.expiresAt>now,'expired-session');
   const value=await fn(db,s,now);await db.query('commit');return value;
  }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{db.release();}
 }
 function checkpoint(s,now){
  const c=s.checkpoint;check(s.entitled===true&&Number.isSafeInteger(s.entitlementCheckedAt)&&s.entitlementCheckedAt<=now&&now-s.entitlementCheckedAt<=5000&&c?.validated===true&&typeof c.snapshotText==='string'&&Buffer.byteLength(c.snapshotText)<=262144&&sha(c.snapshotText)===c.hash,'unreviewed-checkpoint');
  const p=JSON.parse(c.snapshotText);check(p.runId===s.runId&&p.ruleset==='treeforce89.v1'&&p.format==='treeforce89.checkpoint.v1'&&p.lives===0&&Number.isSafeInteger(p.continuesUsed)&&p.continuesUsed>=0&&p.continuesUsed<2147483647&&p.finished!==true,'invalid-checkpoint');return {...c,sequence:p.continuesUsed+1};
 }
 const response=(s,extra={})=>({protocol:'tree-paid-delivery.v2',runId:s.runId,nativeRunId:s.nativeRunId,requiresPayment:false,restoreAuthorized:false,...extra});
 return Object.freeze({
  async importPayment(input){
   check(Object.hasOwn(PAYMENT_TERMS_V2,input.source),'invalid-payment-source');
   return transact(input,async(db,s)=>{
    const p=await loadPayment(db,{source:input.source,sourceId:input.sourceId});
    check(p.accountId===s.accountId&&p.runId===s.runId&&p.suiWallet===s.suiWallet&&typeof p.receiptId==='string'&&p.receiptId.length<=200,'payment-owner-mismatch');
    check(Number.isSafeInteger(p.sequence)&&p.sequence>0&&p.sequence<=2147483647,'invalid-payment-sequence');
    const policy=PAYMENT_TERMS_V2[input.source];check(Object.entries(policy).every(([k,v])=>p.payment?.[k]===v),'payment-policy-mismatch');
    check(input.source.startsWith('sui-')?p.payment.payer===s.suiWallet:/^0x[a-f0-9]{40}$/.test(p.payment.payer||''),'invalid-payment-payer');
    const existing=(await db.query('select * from private.arcade_continue_payments_v2 where source=$1 and source_id=$2',[input.source,input.sourceId])).rows[0];
    if(existing){check(existing.account_id===s.accountId&&existing.run_id===s.runId&&existing.receipt_id===p.receiptId&&existing.sequence===p.sequence,'receipt-conflict');return response(s,{paymentId:existing.id,status:'recorded'});}
    const id=randomUUID();await db.query(`insert into private.arcade_continue_payments_v2(id,source,source_id,receipt_id,account_id,run_id,sui_wallet,payment,sequence) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,input.source,input.sourceId,p.receiptId,s.accountId,s.runId,s.suiWallet,p.payment,p.sequence]);
    return response(s,{paymentId:id,status:'recorded'});
   });
  },
  async prepare(input){
   check(uuid(input.paymentId)&&hex(input.clientKey),'invalid-prepare');
   return transact(input,async(db,s,now)=>{
    const client=sha(input.clientKey);
    const p=(await db.query('select * from private.arcade_continue_payments_v2 where id=$1',[input.paymentId])).rows[0];
    check(p&&p.account_id===s.accountId&&p.run_id===s.runId&&p.sui_wallet===s.suiWallet,'payment-owner-mismatch');
    let row=(await db.query('select * from private.arcade_continue_claims_v2 where account_id=$1 and run_id=$2 and sequence=$3 for update',[s.accountId,s.runId,p.sequence])).rows[0];
    if(row?.state==='started')return response(s,{status:'review-required'});
    const c=checkpoint(s,now);check(c.sequence===p.sequence,'continue-sequence-mismatch');
    if(row&&row.payment_id!==p.id)return response(s,{status:'other-payment-claimed'});
    if(row&&row.checkpoint_hash!==c.hash)throw Error('checkpoint-changed');
    if(row&&row.lease_until.getTime()>now&&row.client_hash!==client)return response(s,{status:'in-use'});
    if(!row||row.lease_until.getTime()<=now){
     const lease=randomUUID(),until=Math.min(now+120000,s.expiresAt);
     row=(await db.query(`insert into private.arcade_continue_claims_v2(account_id,run_id,payment_id,checkpoint_hash,snapshot_text,client_hash,lease_id,lease_until,state,sequence)
      values($1,$2,$3,$4,$5,$6,$7,to_timestamp($8::double precision/1000),'prepared',$9)
      on conflict(account_id,run_id,sequence) do update set client_hash=excluded.client_hash,lease_id=excluded.lease_id,lease_until=excluded.lease_until returning *`,[s.accountId,s.runId,p.id,c.hash,c.snapshotText,client,lease,until,p.sequence])).rows[0];
     await db.query("insert into private.arcade_continue_events_v2(account_id,run_id,payment_id,event,lease_id,sequence) values($1,$2,$3,$4,$5,$6)",[s.accountId,s.runId,p.id,'prepared',lease,p.sequence]);
    }
    return response(s,{status:'prepared',sequence:p.sequence,paymentId:p.id,leaseId:row.lease_id,leaseExpiresAt:row.lease_until.getTime(),checkpointHash:row.checkpoint_hash,snapshotText:row.snapshot_text});
   });
  },
  async activate(input){
   check(hex(input.clientKey)&&uuid(input.leaseId)&&uuid(input.requestId)&&hex(input.checkpointHash),'invalid-activation');
   return transact(input,async(db,s,now)=>{
    const row=(await db.query('select * from private.arcade_continue_claims_v2 where account_id=$1 and run_id=$2 and lease_id=$3 for update',[s.accountId,s.runId,input.leaseId])).rows[0];
    check(row&&row.client_hash===sha(input.clientKey)&&row.lease_id===input.leaseId&&input.checkpointHash===row.checkpoint_hash,'lease-mismatch');
    if(row.state==='started')return response(s,{status:'review-required',activationId:row.activation_id});
    const c=checkpoint(s,now);check(c.sequence===row.sequence&&c.hash===row.checkpoint_hash,'continue-sequence-mismatch');
    check(row.lease_until.getTime()>now,'expired-lease');
    await consumeRun(db,s,{sequence:row.sequence,paymentId:row.payment_id,activationId:input.requestId});
    await db.query("update private.arcade_continue_claims_v2 set state='started',activation_id=$1 where account_id=$2 and run_id=$3 and sequence=$4",[input.requestId,s.accountId,s.runId,row.sequence]);
    await settlePayment(db,(await db.query('select * from private.arcade_continue_payments_v2 where id=$1',[row.payment_id])).rows[0]);
    await db.query("insert into private.arcade_continue_events_v2(account_id,run_id,payment_id,event,lease_id,sequence) values($1,$2,$3,'started',$4,$5)",[s.accountId,s.runId,row.payment_id,row.lease_id,row.sequence]);
    // Shadow-only result. A later reviewed runtime may use this durable decision;
    // this source milestone never instructs a live client to restore lives.
    return response(s,{status:'started',sequence:row.sequence,activationId:input.requestId,consumed:true,reviewOnly:true});
   });
  },
 });
}
