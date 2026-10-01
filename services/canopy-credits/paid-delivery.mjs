import {createHash} from 'node:crypto';
import {encodeCheckpoint} from './flight-storage.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=(ok,code)=>{if(!ok)fail(code);};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hex=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export const DELIVERY_PROTOCOL='tree-paid-delivery.v1';
/** Dedicated scoped DB connection. Actor is supplied by verified server auth,
 * never parsed from client JSON. No wallet, signer, issuer or receipt writer.
 */
export function createPaidDelivery(db,{authOrigin,environment}){
 check(typeof db?.query==='function','delivery-database-required');
 const url=new URL(authOrigin);check(url.protocol==='https:'&&url.origin===authOrigin,'invalid-auth-origin');
 check(['release-candidate','mainnet'].includes(environment),'invalid-delivery-environment');
 return async(actor,command)=>{
  check(actor?.authenticated===true&&actor.identityMappingReviewed===true&&actor.authOrigin===authOrigin&&actor.environment===environment&&
   actor.wallet?.family==='sui'&&/^0x[0-9a-f]{64}$/.test(actor.wallet.address||'')&&uuid(actor.accountId),'verified-delivery-identity-required');
  const fields={delivery_status:['runId'],prepare_delivery:['runId','clientKey'],activate_delivery:['runId','clientKey','leaseId','requestId','checkpointHash']};
  const action=command?.action;check(Object.hasOwn(fields,action),'invalid-delivery-command');
  const keys=fields[action];check(Object.keys(command).length===keys.length+1&&keys.every(k=>Object.hasOwn(command,k))&&uuid(command.runId),'invalid-delivery-command');
  if(keys.includes('clientKey'))check(hex(command.clientKey),'delivery-client-required');
  if(action==='activate_delivery')check(uuid(command.leaseId)&&uuid(command.requestId)&&hex(command.checkpointHash),'invalid-delivery-activation');
  const clientHash=command.clientKey?createHash('sha256').update(command.clientKey,'utf8').digest('hex'):null;
  const result=await db.query('SELECT tree_continue_v1.paid_delivery($1::uuid,$2,$3,$4,$5::uuid,$6,$7,$8::uuid,$9::uuid,$10) AS result',
   [actor.accountId,actor.wallet.address,authOrigin,environment,command.runId,{delivery_status:'status',prepare_delivery:'prepare',activate_delivery:'activate'}[action],
    clientHash,command.leaseId||null,command.requestId||null,command.checkpointHash||null]);
  const value=result.rows?.[0]?.result;
  check(result.rows?.length===1&&value?.protocol===DELIVERY_PROTOCOL&&value.runId===command.runId&&value.requiresPayment===false,'invalid-delivery-response');
  if(value.status==='prepared'){
   check(action==='prepare_delivery'&&typeof value.snapshotText==='string','invalid-delivery-checkpoint');
   const encoded=encodeCheckpoint(command.runId,JSON.parse(value.snapshotText));
   check(encoded.text===value.snapshotText&&encoded.hash===value.checkpointHash,'delivery-checkpoint-corrupt');
  }
  if(value.restoreAuthorized===true)check(action==='activate_delivery'&&value.status==='started'&&value.lives===3&&value.leaseId===command.leaseId&&value.activationId===command.requestId,'invalid-delivery-authorization');
  return value;
 };
}
/** Public service boundary for the new protocol. The old internal purchase
 * orchestrator must NOT be exposed directly: its legacy deliver command lacks
 * a page lease. Reconciliation may confirm funds, but never grants lives here.
 */
export function withPaidDelivery(purchases,delivery){
 return async(actor,command)=>{
  if(['delivery_status','prepare_delivery','activate_delivery'].includes(command?.action))return delivery(actor,command);
  check(['status','order','reconcile','cancel'].includes(command?.action),'delivery-protocol-required');
  const result=await purchases(actor,command);
  if(command.action==='status')return{...result,deliveryProtocol:DELIVERY_PROTOCOL};
  if(command.action==='reconcile')return{...result,authorization:null,deliveryReady:result.status==='verified',deliveryProtocol:DELIVERY_PROTOCOL};
  return result;
 };
}
