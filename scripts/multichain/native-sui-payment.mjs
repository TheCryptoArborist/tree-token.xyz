// Server-only source adapter. readTransaction must be the trusted mainnet reader,
// never a browser-supplied transaction. No route or restoration is enabled here.
import {randomUUID} from 'node:crypto';
import {PAYMENT_TERMS_V2} from './shared-continue-delivery.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const normalize=v=>{check(/^0x[a-fA-F0-9]{1,64}$/.test(v||''),'invalid-sui-address');return '0x'+v.slice(2).toLowerCase().padStart(64,'0');};
export function createNativeSuiPaymentRecorder({pool,verifyRuntime,readTransaction}) {
 check(typeof pool?.connect==='function'&&typeof verifyRuntime==='function'&&typeof readTransaction==='function','trusted-sui-payment-adapters-required');
 return async({sessionHash,offerId,digest})=>{
  check(/^[a-f0-9]{64}$/.test(sessionHash||'')&&/^[a-f0-9]{48}$/.test(offerId||'')&&/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(digest||''),'invalid-payment-reference');
  // Network evidence is obtained independently; credentials/offer are rechecked
  // under the native row lock after this potentially slow read.
  const proof=await readTransaction(digest);
  check(proof?.network==='mainnet'&&proof.success===true&&/^\d+$/.test(proof.checkpoint||'')&&Number.isSafeInteger(proof.timestampMs)&&proof.timestampMs>0&&Array.isArray(proof.balanceChanges),'unverified-sui-payment');
  const db=await pool.connect();
  try{
   await db.query('begin');await db.query("set local lock_timeout='5s'");await db.query("set local statement_timeout='15s'");
   const runtime=await verifyRuntime(db);
   check(runtime?.verified===true&&runtime.origin==='https://tree-token.xyz'&&runtime.network==='sui:mainnet'&&/^[a-f0-9]{64}$/.test(runtime.databaseIdentity||''),'unverified-native-runtime');
   const rows=(await db.query('select * from public.tree_game_sessions where session_token_hash=$1 or continue_offer_id=$2 order by session_id for update',[sessionHash,offerId])).rows;
   const auth=rows.find(r=>r.session_token_hash===sessionHash),offer=rows.find(r=>r.continue_offer_id===offerId);
   const now=Number((await db.query('select floor(extract(epoch from clock_timestamp())*1000)::float8 as now')).rows[0].now);
   check(auth&&offer&&auth.expires_at.getTime()>now&&auth.wallet===offer.wallet,'payment-session-required');
   const mapping=(await db.query(`select m.id,a.id as account_id from private.arcade_native_sui_runs m
    join private.arcade_native_sui_accounts a on a.id=m.account_id and a.database_identity=m.database_identity
    where m.native_run_id=$1 and m.database_identity=$2 and a.wallet=$3`,[offer.run_id,runtime.databaseIdentity,auth.wallet])).rows[0];
   check(mapping,'native-mapping-required');
   const existing=(await db.query('select * from private.arcade_native_sui_payments where offer_id=$1',[offerId])).rows[0];
   if(existing){
    check(existing.digest===digest&&existing.wallet===auth.wallet,'payment-conflict');
    const shared=(await db.query("select id from private.arcade_continue_payments_v2 where source='sui-native-tree' and source_id=$1 and receipt_id=$2",[offerId,'sui:mainnet:'+digest])).rows[0];
    check(shared,'shared-payment-missing');await db.query('commit');return {status:'recorded',paymentId:shared.id,offerId,digest,runId:existing.run_id,sequence:existing.sequence,restoreAuthorized:false};
   }
   check(!(await db.query('select digest from public.tree_continue_redemptions where digest=$1 or offer_id=$2',[digest,offerId])).rows.length,'payment-already-redeemed');
   check(offer.game_over===true&&(offer.continue_pending===true||offer.expires_at.getTime()<=now)&&!offer.cleared&&Number.isSafeInteger(offer.continuation_number)&&offer.continuation_number>=0&&offer.continuation_number<2147483647,'offer-not-pending');
   const start=offer.continue_offer_created_at?.getTime(),end=offer.continue_offer_expires_at?.getTime();
   check(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<end&&/^\d+$/.test(offer.continue_offer_checkpoint||'')&&BigInt(proof.checkpoint)>BigInt(offer.continue_offer_checkpoint)&&proof.timestampMs>=start-30000&&proof.timestampMs<end&&proof.timestampMs<=now&&normalize(proof.sender)===auth.wallet,'payment-offer-mismatch');
   const policy=PAYMENT_TERMS_V2['sui-tree'];
   check(auth.wallet!==policy.recipient,'treasury-cannot-pay-self');
   let received=0n;
   for(const change of proof.balanceChanges){
    check(typeof change.coinType==='string'&&/^-?\d+$/.test(change.amount||''),'invalid-balance-change');
    if(change.coinType===policy.token&&change.owner?.kind==='AddressOwner'&&normalize(change.owner.address)===policy.recipient)received+=BigInt(change.amount);
   }
   // Preserve native >=20,000 TREE behavior; excess does not buy extra continues.
   check(received>=BigInt(policy.amount),'insufficient-tree-payment');
   check(offer.continue_snapshot&&offer.continue_snapshot.runId===offer.run_id,'missing-native-snapshot');
   await db.query(`insert into private.arcade_native_sui_payments(offer_id,digest,account_id,run_id,sequence,native_session_id,native_run_id,wallet,amount,received,checkpoint,timestamp_ms,snapshot)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[offerId,digest,mapping.account_id,mapping.id,offer.continuation_number+1,offer.session_id,offer.run_id,auth.wallet,policy.amount,received.toString(),proof.checkpoint,proof.timestampMs,offer.continue_snapshot]);
   const paymentId=randomUUID();
   await db.query(`insert into private.arcade_continue_payments_v2(id,source,source_id,receipt_id,account_id,run_id,sequence,sui_wallet,payment)
    values($1,'sui-native-tree',$2,$3,$4,$5,$6,$7,$8)`,[paymentId,offerId,'sui:mainnet:'+digest,mapping.account_id,mapping.id,offer.continuation_number+1,auth.wallet,{...policy,payer:auth.wallet}]);
   await db.query('commit');return {status:'recorded',paymentId,offerId,digest,runId:mapping.id,sequence:offer.continuation_number+1,restoreAuthorized:false};
  }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{db.release();}
 };
}
