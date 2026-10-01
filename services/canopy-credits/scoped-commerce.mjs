/** Server-only role-separated adapter for the existing purchase orchestrator.
 * Pools must have DIFFERENT least-privilege login credentials. No credentials,
 * keys, policy activation, HTTP route or on-chain transaction are created here.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createDirectContinueService } from './direct-continue-service.mjs';
import { validateFixedContinueTerms, commitment } from './continue-product.mjs';
import { uuid, address } from './mainnet-payment.mjs';
import { validateQuoteEnvelope } from './reader/checkout/quote-authority.mjs';
const check = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
const roles = Object.freeze({ order: 'tree_continue_orders', settlement: 'tree_continue_settlement' });
const roleCheck = `SELECT current_user AS effective_user,session_user AS login,
 (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls FROM pg_roles WHERE rolname=session_user) AS elevated,
 pg_has_role(session_user,$1,'USAGE') AS intended,
 pg_has_role(session_user,$2,'MEMBER') AS opposite,
 pg_has_role(session_user,'tree_continue_delivery','MEMBER') AS delivery,
 has_table_privilege(session_user,'tree_continue_v1.orders','INSERT,UPDATE,DELETE') AS direct_orders,
 has_table_privilege(session_user,'tree_continue_v1.receipts','INSERT,UPDATE,DELETE') AS direct_receipts,
 has_table_privilege(session_user,'tree_continue_v1.checkpoint_reviews','INSERT,UPDATE,DELETE') AS reviews,
 has_table_privilege(session_user,'tree_continue_v1.commerce_policy','INSERT,UPDATE,DELETE') AS policy`;
function actorSnapshot(actor, settings) {
 check(actor?.authenticated === true && actor.identityMappingReviewed === true && actor.wallet?.family === 'sui' &&
  actor.authOrigin === settings.authOrigin && actor.environment === settings.environment, 'commerce_verified_identity_required');
 return Object.freeze({ authenticated: true, identityMappingReviewed: true, ...settings,
  accountId: uuid(actor.accountId), wallet: Object.freeze({ family: 'sui', address: address(actor.wallet.address) }) });
}
async function ensureRole(db, mode) {
 const other = mode === 'order' ? 'settlement' : 'order';
 const { rows } = await db.query(roleCheck, [roles[mode], roles[other]]), r = rows[0];
 check(rows.length === 1 && r && r.intended === true && r.elevated === false && r.opposite === false &&
  r.delivery === false && r.direct_orders === false && r.direct_receipts === false && r.reviews === false && r.policy === false,
  'commerce_dedicated_role_required');
 // The login itself must be restricted: SET ROLE from postgres is not sufficient.
 return r.login;
}
async function policy(db) {
 const { rows } = await db.query('SELECT tree_continue_v1.commerce_policy_read() AS result');
 check(rows.length === 1 && rows[0].result, 'commerce_policy_missing'); return rows[0].result;
}
function repository(pool, mode, actor) {
 const context = new AsyncLocalStorage();
 const active = () => { const c = context.getStore(); check(c, 'commerce_transaction_required'); return c; };
 const identity = [actor.accountId, actor.wallet.address, actor.authOrigin, actor.environment];
 return {
  async transact(accountId, runId, callback) {
   check(accountId === actor.accountId, 'commerce_account_mismatch'); uuid(runId);
   const db = await pool.connect();
   try {
    await ensureRole(db, mode);
    await db.query('BEGIN'); await db.query("SET LOCAL statement_timeout='15s'");
    await db.query("SET LOCAL lock_timeout='10s'"); await db.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
    const { rows } = await db.query('SELECT tree_continue_v1.commerce_read($1::uuid,$2,$3,$4,$5::uuid) AS result', [...identity,runId]);
    check(rows.length === 1, 'commerce_invalid_read');
    const result = await context.run({ db, runId, claim: null }, () => callback(rows[0].result));
    await db.query('COMMIT'); return result;
   } catch (error) { await db.query('ROLLBACK').catch(() => {}); throw error; }
   finally { db.release(); }
  },
  async save(record) {
   const c = active(); validateFixedContinueTerms(record.terms);
   check(record.terms.accountId === actor.accountId && record.terms.payer === actor.wallet.address && record.terms.runId === c.runId,
    'commerce_record_owner_mismatch');
   if (mode === 'order') {
    check(['ordered','cancelled'].includes(record.state) && record.evidence === null && record.receiptId === null,
     'commerce_order_role_cannot_settle');
    await c.db.query('SELECT tree_continue_v1.commerce_save_order($1::uuid,$2,$3,$4,$5::uuid,$6::jsonb,$7,$8::jsonb)',
     [...identity,c.runId,JSON.stringify(record.terms),record.state,record.envelope ? JSON.stringify(record.envelope) : null]);
   } else {
    check(record.state === 'verified' && c.claim?.orderId === record.terms.orderId && c.claim.receiptId === record.receiptId,
     'commerce_settlement_claim_required');
    const { evidenceHash, ...rest } = record.evidence || {};
    check(evidenceHash === commitment(rest), 'commerce_evidence_hash_mismatch');
    await c.db.query('SELECT tree_continue_v1.commerce_settle($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7::jsonb)',
     [...identity,c.runId,record.terms.orderId,JSON.stringify(record.evidence)]);
   }
  },
  async claimReceipt(receiptId, orderId) {
   check(mode === 'settlement', 'commerce_order_role_cannot_claim');
   // Claim and order update happen atomically in commerce_settle, not in two
   // separately committed requests. The existing service calls save next.
   const c = active(); uuid(orderId);
   check(typeof receiptId === 'string' && receiptId.length < 160, 'commerce_invalid_receipt_id');
   check(!c.claim || c.claim.receiptId === receiptId && c.claim.orderId === orderId, 'commerce_claim_changed');
   c.claim = { receiptId, orderId };
  },
 };
}
/** Compose with withPaidDelivery and withPurchaseRecovery at the server boundary.
 * The quote authority and real receipt reader are separate injected services.
 * The signed envelope is verified again here before the order transaction commits.
 */
export function createScopedCommerce({ orderPool, settlementPool, settings, resolveFlight, loadConfiguration,
 authorizeQuote, verifyPayment, now = Date.now }) {
 check(orderPool !== settlementPool && typeof orderPool?.connect === 'function' && typeof settlementPool?.connect === 'function',
  'commerce_separate_pools_required');
 check(settings && new URL(settings.authOrigin).origin === settings.authOrigin && settings.authOrigin.startsWith('https:') &&
  ['release-candidate','mainnet'].includes(settings.environment), 'commerce_invalid_settings');
 for (const f of [resolveFlight,loadConfiguration,authorizeQuote,verifyPayment,now]) check(typeof f === 'function','commerce_dependency_required');
 const pinnedSettings = Object.freeze({ authOrigin: settings.authOrigin, environment: settings.environment });
 return async (inputActor, inputCommand) => {
  const actor = actorSnapshot(inputActor,pinnedSettings), command = structuredClone(inputCommand);
  check(['status','order','cancel','reconcile'].includes(command?.action),'commerce_action_not_allowed');
  const mode = command.action === 'reconcile' ? 'settlement' : 'order', pool = mode === 'order' ? orderPool : settlementPool;
  let p; const db = await pool.connect();
  try { await ensureRole(db,mode); p = await policy(db); } finally { db.release(); }
  check(p.authOrigin === actor.authOrigin && p.environment === actor.environment,'commerce_policy_issuer_mismatch');
  if(command.action === 'status' && (!p.newOrdersEnabled || !p.deployment)) return { enabled:false,
   orderPolicyEnabled:p.newOrdersEnabled,settlementPolicyEnabled:p.settlementEnabled };
  if(command.action === 'order') check(p.newOrdersEnabled === true && actor.wallet.address === p.pilotWallet,'commerce_sales_disabled_or_not_pilot');
  if(command.action === 'reconcile') check(p.settlementEnabled === true,'commerce_settlement_disabled');
  const config = structuredClone(await loadConfiguration());
  check(config?.deployment && p.deployment && commitment(config.deployment) === commitment(p.deployment),'commerce_runtime_deployment_mismatch');
  if(command.action === 'status') return { enabled:config.paymentsEnabled === true && p.newOrdersEnabled === true && actor.wallet.address === p.pilotWallet,
   orderPolicyEnabled:p.newOrdersEnabled,settlementPolicyEnabled:p.settlementEnabled };
  // SQL rechecks policy/caps under locks, independently of the application gate.
  config.paymentsEnabled = command.action === 'order' && config.paymentsEnabled === true && p.newOrdersEnabled === true;
  const purchases = createDirectContinueService({ repository:repository(pool,mode,actor),resolveFlight,
   loadConfiguration:async()=>config,
   authorizeQuote:async(terms,d)=>{
    check(mode === 'order','commerce_quote_role_required');
    const envelope=await authorizeQuote(terms,d);
    validateQuoteEnvelope(terms,d,envelope,now());
    return {quoteBase64:envelope.quoteBase64,signatureBase64:envelope.signatureBase64,payable:false};
   },
   verifyPayment:async(...args)=>{check(mode === 'settlement','commerce_settlement_role_required');return verifyPayment(...args);},now });
  return purchases(actor,command);
 };
}
