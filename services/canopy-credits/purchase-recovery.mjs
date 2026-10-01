import {randomUUID} from 'node:crypto';
import {validateFixedContinueTerms,publicContinueOrder} from './continue-product.mjs';
import {DELIVERY_PROTOCOL} from './paid-delivery.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const check=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
/** DB must use tree_continue_recovery, not a browser/platform connection.
 * purchases must already be withPaidDelivery-wrapped. discover finds a candidate;
 * the existing independent chain verifier and durable receipt claim still decide.
 */
export function withPurchaseRecovery(purchases,{db,discover,authOrigin,environment}){
 check(typeof purchases==='function'&&typeof db?.query==='function'&&typeof discover==='function','invalid-recovery-service');
 check(new URL(authOrigin).origin===authOrigin&&authOrigin.startsWith('https:')&&['release-candidate','mainnet'].includes(environment),'invalid-recovery-issuer');
 return async(actor,command)=>{
  check(actor?.authenticated===true&&actor.identityMappingReviewed===true&&actor.authOrigin===authOrigin&&actor.environment===environment&&id(actor.accountId)&&actor.wallet?.family==='sui'&&/^0x[a-f0-9]{64}$/.test(actor.wallet.address||'')&&!/^0x0+$/.test(actor.wallet.address),'verified-recovery-identity-required');
  const action=command?.action;
  if(!['list_purchases','recover_purchase'].includes(action))return purchases(actor,command);
  const allowed=action==='list_purchases'?['action','afterOrderId']:['action','runId'];
  check(command&&Object.keys(command).every(k=>allowed.includes(k))&&(action==='list_purchases'?(!command.afterOrderId||id(command.afterOrderId)):id(command.runId)),'invalid-recovery-command');
  const args=[actor.accountId,actor.wallet.address,authOrigin,environment];
  async function lookup(){const r=await db.query('SELECT tree_continue_v1.lookup_purchases($1::uuid,$2,$3,$4,$5::uuid,$6::uuid) AS result',[...args,command.runId||null,command.afterOrderId||null]);check(r.rows?.length===1&&r.rows[0].result,'invalid-purchase-lookup');return r.rows[0].result;}
  const value=await lookup();
  const common={deliveryProtocol:DELIVERY_PROTOCOL,requiresPayment:false,accountId:actor.accountId};
  if(action==='list_purchases'){
   check(Array.isArray(value.rows)&&value.rows.length<=25&&typeof value.hasMore==='boolean','invalid-purchase-list');
   for(const row of value.rows)check(id(row.orderId)&&id(row.runId)&&['ordered','cancelled','verified','delivered'].includes(row.state)&&Number.isInteger(row.wave)&&row.wave>=1&&row.wave<=10&&Number.isSafeInteger(row.score)&&row.score>=0,'invalid-purchase-row');
   return{...common,purchases:value.rows,afterOrderId:value.hasMore?value.rows.at(-1)?.orderId:null};
  }
  const record=value.record;
  if(record===null)return{...common,status:'not-found',order:null,authorization:null};
  const terms=validateFixedContinueTerms(record?.terms);
  check(terms.accountId===actor.accountId&&terms.payer===actor.wallet.address&&terms.runId===command.runId,'purchase-owner-mismatch');
  let discovery={status:'not-needed'};
  if(!record.hasEvidence){
   const r=await db.query('SELECT tree_continue_v1.reserve_receipt_scan($1::uuid,$2,$3,$4,$5::uuid) AS reserved',[...args,command.runId]);
   check(r.rows?.length===1,'invalid-scan-reservation');
   if(r.rows[0].reserved){discovery=await discover(terms);check(['found','pending','bounded','unavailable'].includes(discovery?.status),'invalid-receipt-discovery');}
   else discovery={status:'throttled'};
  }
  // This call re-reads and locks the durable order and independently verifies any
  // discovered digest. A GraphQL hit is never accepted as a receipt by itself.
  const result=await purchases(actor,{action:'reconcile',runId:command.runId,orderId:terms.orderId,requestId:randomUUID(),...(discovery.status==='found'?{digest:discovery.digest}:{})});
  check(result.deliveryProtocol===DELIVERY_PROTOCOL&&result.authorization===null,'unsafe-reconciliation-response');
  return{...result,...common,discovery:discovery.status,order:publicContinueOrder(terms,null,false),retryAfterMs:10000};
 };
}
