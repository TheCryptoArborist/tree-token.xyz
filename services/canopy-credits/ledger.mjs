/** Dependency-injected server-only PostgreSQL adapters. Not browser callable.
 * query must be a parameterized PostgreSQL client; runtime/ingest use separate DB roles.
 * Never import preview identities/balances implicitly. Resolve an approved identity mapping first.
 */
import {check,uuid,validateStoredTerms,verifyFromReader} from './mainnet-payment.mjs';
const commandFields={open_run:['runId','ruleset'],reserve:['runId','sku'],commit:['reservationId','checkpointRef'],
  deliver:['reservationId','checkpointRef'],release:['reservationId'],recover:['runId']};
export function validateCommand(c) {
  check(c&&typeof c==='object'&&!Array.isArray(c)&&Object.hasOwn(commandFields,c.action),'invalid-command');
  const keys=commandFields[c.action];
  check(Object.keys(c).length===keys.length+1&&keys.every(k=>Object.hasOwn(c,k))&&Object.keys(c).every(k=>k==='action'||keys.includes(k)),'unexpected-command-fields');
  if(c.runId)uuid(c.runId);if(c.reservationId)uuid(c.reservationId);
  if(c.action==='open_run')check(typeof c.ruleset==='string'&&c.ruleset.length>0&&c.ruleset.length<=100,'invalid-ruleset');
  if(c.action==='reserve')check(c.sku==='treeforce89.continue.v1','unsupported-sku');
  if(['commit','deliver'].includes(c.action))check(typeof c.checkpointRef==='string'&&/^[a-f0-9]{64}$/.test(c.checkpointRef),'checkpoint-required');
  return c;
}
function caller(actor) { check(actor?.authenticated===true&&actor.environment==='isolated-ledger'&&actor.identityMappingReviewed===true,'reviewed-server-identity-required');return uuid(actor.accountId); }
async function one(db,sql,params) {const r=await db.query(sql,params);check(r.rows?.length===1,'invalid-db-response');return r.rows[0].result;}
export function runtimeLedger(db) {
  return Object.freeze({
    balance(actor){return one(db,'SELECT canopy_credits_v1.balance($1::uuid) AS result',[caller(actor)]);},
    execute(actor,requestId,command){return one(db,'SELECT canopy_credits_v1.execute($1::uuid,$2::uuid,$3::jsonb) AS result',[caller(actor),uuid(requestId),JSON.stringify(validateCommand(command))]);},
  });
}
export function settlementWorker(db,reader) {
  return Object.freeze({
    register(actor){return one(db,'SELECT canopy_credits_v1.register_account($1::uuid) AS result',[caller(actor)]);},
    order(actor,terms){const account=caller(actor);validateStoredTerms(terms);check(terms.accountId===account,'order-account-mismatch');return one(db,'SELECT canopy_credits_v1.record_order($1::uuid,$2::uuid,$3::jsonb) AS result',[terms.orderId,account,JSON.stringify(terms)]);},
    async settle(actor,requestId,orderId,digest,eventIndex){
      const account=caller(actor);uuid(orderId);uuid(requestId);
      const terms=await one(db,'SELECT canopy_credits_v1.get_order($1::uuid,$2::uuid) AS result',[account,orderId]);
      check(terms,'order-not-found');check(terms.accountId===account,'order-account-mismatch');
      const evidence=await verifyFromReader(terms,digest,eventIndex,reader);
      return one(db,'SELECT canopy_credits_v1.credit_receipt($1::uuid,$2::uuid,$3::uuid,$4::jsonb) AS result',[account,requestId,orderId,JSON.stringify(evidence)]);
    },
  });
}
