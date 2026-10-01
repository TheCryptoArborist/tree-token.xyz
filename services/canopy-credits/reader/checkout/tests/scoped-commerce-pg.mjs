/** Real separate PostgreSQL logins + exact quote/BCS/receipt pipeline.
 * The database is disposable; identities, node responses, deployment IDs and
 * checkpoint approvals are fixtures. Never connects to Supabase or signs a Sui tx.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {MAINNET,createMainnetReader} from '../../../mainnet-reader.mjs';
import {DIRECT_CONTINUE as P,commitment} from '../../../continue-product.mjs';
import {createScopedCommerce} from '../../../scoped-commerce.mjs';
import {createFlightStorage} from '../../../flight-storage.mjs';
import {createPaidDelivery,withPaidDelivery} from '../../../paid-delivery.mjs';
import {createDirectReceiptReader} from '../direct-receipt-reader.mjs';
import {Purchase,quoteFields} from '../codec.mjs';
import {authorizeQuoteForReview,validateQuoteEnvelope} from '../quote-authority.mjs';
if(!['127.0.0.1','localhost','::1'].includes(process.env.PGHOST)||process.env.PGDATABASE!=='scoped_commerce_ci')throw Error('Disposable loopback scoped_commerce_ci required');
const require=createRequire(process.env.DIRECT_TEST_PACKAGE||import.meta.url),{Pool}=require('pg');
const admin=new Pool({max:20}),pools={};
const hex=()=>randomBytes(32).toString('hex'),D=MAINNET.genesisDigest;
const settings={authOrigin:'https://scoped-commerce-ci.example',environment:'release-candidate'};
const actor={authenticated:true,identityMappingReviewed:true,...settings,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+'1'.repeat(64)}};
const keys=generateKeyPairSync('ed25519');
const deployment={network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),initialSharedVersion:'1',keyEpoch:'1',quotePublicKey:keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex')};
const config={paymentsEnabled:true,deployment,metadata:{network:P.network,coinType:P.coinType,decimals:6}};
const stamp=ms=>({seconds:BigInt(Math.floor(ms/1000)),nanos:(ms%1000)*1000000});
function digest(){let n=BigInt('0x'+randomBytes(32).toString('hex'))|(1n<<255n),out='';const chars='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n){out=chars[Number(n%58n)]+out;n/=58n;}return out;}
let storage,delivery;
async function fixture({review=true,order=true,identity=actor,badQuote=false}={}){
 const now=Date.now(),runId=randomUUID(),snapshot={format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:3,score:17649,lives:0,continuesUsed:0,scene:{codec:'formation-recovery.v1'}};
 await storage.register(identity,runId);const saved=await storage.save(identity,runId,randomUUID(),snapshot);
 if(review)await admin.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','explicit-scoped-ci-fixture',$2)",[saved.checkpointId,hex()]);
 const state={now,terms:null,digest:digest(),reads:0,signatures:0,offline:false,underpaid:false,noCheckpoint:false,badQuote};
 const reader=createDirectReceiptReader({deployment,connect:options=>createMainnetReader({
  getServiceInfo:async()=>({response:{chain:'mainnet',chainId:D,checkpointHeight:1n,timestamp:stamp(now+2000)}}),
  getCoinInfo:async()=>({response:{coinType:P.coinType,metadata:{id:'0x'+'5'.repeat(64),decimals:6,name:'Thickquidity',symbol:'Tree'}}}),
  getTransaction:async request=>{
   state.reads++;if(state.offline)throw Error('ci-node-offline');assert.equal(request.digest,state.digest);
   const terms=state.terms,{domain,...q}=quoteFields(terms,deployment);
   const transaction={digest:state.digest,checkpoint:1n,timestamp:stamp(now+2000),transaction:{sender:terms.payer},
    effects:{digest:D,transactionDigest:state.digest,status:{success:true},eventsDigest:D},
    events:{digest:D,events:[{packageId:deployment.packageId,sender:terms.payer,eventType:terms.eventType,contents:{value:Purchase.serialize({schema_version:1,...q,paid_at_ms:String(now+1000)}).toBytes()}}]},
    balanceChanges:[{address:terms.payer,coinType:P.coinType,amount:'-'+P.requiredRaw},{address:P.recipient,coinType:P.coinType,amount:state.underpaid?'1':P.requiredRaw}]};
   if(state.noCheckpoint)delete transaction.checkpoint;return{response:{transaction}};
  },
  getCheckpoint:async()=>({response:{checkpoint:{sequenceNumber:1n,digest:D,summary:{timestamp:stamp(now+2000),contentDigest:D},contents:{digest:D,transactions:[{transaction:state.digest,effects:D}]}}}}),
 },{now:()=>now+2000,decodeReceipt:options.decodeReceipt})});
 const options={orderPool:pools.orders,settlementPool:pools.settlement,settings,
  resolveFlight:(a,r)=>storage.resolveValidatedFlight(a,r),loadConfiguration:async()=>config,
  authorizeQuote:async(t,d)=>{state.signatures++;state.terms=t;const env=authorizeQuoteForReview(t,d,keys.privateKey);return state.badQuote?{...env,signatureBase64:Buffer.alloc(64).toString('base64')}:env;},
  verifyPayment:reader.verifyPayment,now:()=>now};
 const commerce=createScopedCommerce(options),service=withPaidDelivery(commerce,delivery);
 const command=(action,extras={})=>({action,runId,requestId:randomUUID(),...extras});
 let ordered=order?await service(identity,command('order')):null;
 return {actor:identity,runId,saved,state,options,commerce,service,command,get ordered(){return ordered;},
  async order(){ordered=await service(identity,command('order'));return ordered;},
  reconcile:()=>service(identity,command('reconcile',{orderId:ordered.order.orderId,digest:state.digest}))};
}
async function orderRow(f){return(await admin.query('SELECT state,envelope,evidence,receipt_id FROM tree_continue_v1.orders WHERE account_id=$1 AND run_id=$2',[f.actor.accountId,f.runId])).rows[0];}
async function counts(){return(await admin.query('SELECT (SELECT count(*)::int FROM tree_continue_v1.orders) AS orders,(SELECT count(*)::int FROM tree_continue_v1.receipts) AS receipts,reserved_raw::text AS reserved FROM tree_continue_v1.commerce_policy')).rows[0];}
const identityArgs=f=>[f.actor.accountId,f.actor.wallet.address,settings.authOrigin,settings.environment,f.runId];
async function rawSave(f,terms,state='ordered',envelope=null,pool=pools.orders){return pool.query('SELECT tree_continue_v1.commerce_save_order($1,$2,$3,$4,$5,$6,$7,$8)',[...identityArgs(f),terms,state,envelope]);}
async function rawSettle(f,evidence,pool=pools.settlement){return pool.query('SELECT tree_continue_v1.commerce_settle($1,$2,$3,$4,$5,$6,$7)',[...identityArgs(f),f.ordered.order.orderId,evidence]);}
await test('role-separated commerce using actual unprivileged login connections',async t=>{
 try{
  await admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
  for(const file of ['direct-continue-schema.sql','migrations/flight-storage-v1.sql','migrations/paid-delivery-v1.sql','migrations/scoped-commerce-v1.sql'])await admin.query(await readFile(new URL('../../../'+file,import.meta.url),'utf8'));
  for(const name of ['orders','settlement','delivery','storage']){
   const user='commerce_ci_'+name,password=hex();
   // Names are fixed here; the password is random disposable test data, not logged.
   await admin.query(`CREATE ROLE ${user} LOGIN PASSWORD '${password}'; GRANT tree_continue_${name} TO ${user};`);
   pools[name]=new Pool({user,password,max:16});
  }
  storage=createFlightStorage(pools.storage,settings);delivery=createPaidDelivery(pools.delivery,settings);
  await t.test('migration starts paused with no deployment, zero cap and revised admin',async()=>{
   const p=(await pools.orders.query('SELECT tree_continue_v1.commerce_policy_read() AS p')).rows[0].p;
   assert.equal(p.newOrdersEnabled,false);assert.equal(p.settlementEnabled,false);assert.equal(p.deployment,null);assert.equal(p.totalLimitRaw,'0');
   assert.equal(p.adminWallet,'0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4');
   assert.equal(p.pilotWallet,'0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6');
  });
  // ONLY this disposable test DB receives fictional deployment IDs and cap.
  await admin.query('UPDATE tree_continue_v1.commerce_policy SET auth_origin=$1,pilot_wallet=$2,deployment=$3,total_limit_raw=20000000000000,new_orders_enabled=true,settlement_enabled=true',[settings.authOrigin,actor.wallet.address,deployment]);
  await t.test('all commerce calls use separate non-owner session logins',async()=>{
   const names=[];for(const name of ['orders','settlement','delivery','storage']){const r=(await pools[name].query('SELECT session_user AS name')).rows[0];names.push(r.name);assert.equal(r.name,'commerce_ci_'+name);}assert.equal(new Set(names).size,4);
  });
  await t.test('real signed order is saved without giving order login receipt rights',async()=>{
   const f=await fixture(),r=await orderRow(f);assert.equal(f.ordered.order.amountRaw,P.requiredRaw);assert.equal(r.evidence,null);
   assert.equal(validateQuoteEnvelope(f.state.terms,deployment,r.envelope,f.state.now+1).signature.length,64);
   await assert.rejects(rawSettle(f,{},pools.orders),/permission denied/);
  });
  await t.test('settlement login cannot create orders, attach signatures or cancel',async()=>{
   const f=await fixture();for(const state of ['ordered','cancelled'])await assert.rejects(rawSave(f,f.state.terms,state,null,pools.settlement),/permission denied/);
  });
  await t.test('neither commerce login has direct private table access or checkpoint approval',async()=>{
   for(const p of [pools.orders,pools.settlement])for(const name of ['orders','receipts','checkpoints','checkpoint_reviews','commerce_policy'])await assert.rejects(p.query('SELECT * FROM tree_continue_v1.'+name),/permission denied/);
   for(const p of [pools.orders,pools.settlement])await assert.rejects(p.query("UPDATE tree_continue_v1.checkpoint_reviews SET outcome='validated'"),/permission denied/);
  });
  await t.test('commerce logins cannot activate delivery or become each other',async()=>{
   await assert.rejects(pools.orders.query('SET ROLE tree_continue_settlement'),/permission denied/);
   await assert.rejects(pools.settlement.query('SET ROLE tree_continue_orders'),/permission denied/);
   for(const p of [pools.orders,pools.settlement])await assert.rejects(p.query("SELECT tree_continue_v1.paid_delivery($1,$2,$3,$4,$5,'status')",[actor.accountId,actor.wallet.address,settings.authOrigin,settings.environment,randomUUID()]),/permission denied/);
  });
  await t.test('platform and browser roles cannot invoke new commerce functions',async()=>{
   for(const role of ['anon','authenticated','service_role']){const db=await admin.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE '+role);await assert.rejects(db.query('SELECT tree_continue_v1.commerce_policy_read()'),/permission denied/);}finally{await db.query('ROLLBACK');db.release();}}
  });
  await t.test('database-owner pool is refused even though it could execute functions',async()=>{
   const f=await fixture({order:false}),s=createScopedCommerce({...f.options,orderPool:admin});await assert.rejects(s(actor,f.command('order')),/dedicated_role/);assert.equal(await orderRow(f),undefined);
  });
  await t.test('swapped credentials and same pool are rejected',async()=>{
   const f=await fixture({order:false});assert.throws(()=>createScopedCommerce({...f.options,settlementPool:pools.orders}),/separate_pools/);
   const s=createScopedCommerce({...f.options,orderPool:pools.settlement,settlementPool:pools.orders});await assert.rejects(s(actor,f.command('order')),/dedicated_role/);
  });
  await t.test('unreviewed flight cannot create order, consume cap or sign',async()=>{
   const f=await fixture({review:false,order:false}),before=await counts();await assert.rejects(f.order(),/validation/);assert.deepEqual(await counts(),before);assert.equal(f.state.signatures,0);
  });
  await t.test('bad signature rolls back creation and capacity reservation',async()=>{
   const f=await fixture({order:false,badQuote:true}),before=await counts();await assert.rejects(f.order(),/quote-authorization/);assert.deepEqual(await counts(),before);assert.equal(await orderRow(f),undefined);
  });
  await t.test('ten same-flight requests retain one order, one signature and one reservation',async()=>{
   const f=await fixture({order:false}),before=await counts();const r=await Promise.all(Array.from({length:10},()=>f.order()));
   assert.equal(new Set(r.map(x=>x.order.orderId)).size,1);assert.equal(f.state.signatures,1);const after=await counts();assert.equal(after.orders,before.orders+1);assert.equal(BigInt(after.reserved)-BigInt(before.reserved),20000000000n);
  });
  await t.test('retry after committed order response is lost returns original order',async()=>{
   const f=await fixture(),before=await counts(),id=f.ordered.order.orderId;const r=await f.order();assert.equal(r.order.orderId,id);assert.deepEqual(await counts(),before);assert.equal(f.state.signatures,1);
  });
  await t.test('fixed price and recipient remain enforced even bypassing JS',async()=>{
   const f=await fixture();for(const change of [{requiredRaw:'1'},{recipient:'0x'+'9'.repeat(64)},{restoreLives:99}]){const terms={...f.state.terms,...change};delete terms.quoteHash;terms.quoteHash=commitment(terms);await assert.rejects(rawSave(f,terms),/fixed_product/);}
  });
  await t.test('order login cannot self-certify payment through state argument',async()=>{
   const f=await fixture();for(const state of ['verified','delivered'])await assert.rejects(rawSave(f,f.state.terms,state),/cannot_settle/);assert.equal((await orderRow(f)).evidence,null);
  });
  await t.test('quote cannot be rewritten after storage',async()=>{
   const f=await fixture(),r=await orderRow(f);await assert.rejects(rawSave(f,f.state.terms,'ordered',{...r.envelope,signatureBase64:Buffer.alloc(64).toString('base64')}),/immutable/);assert.deepEqual((await orderRow(f)).envelope,r.envelope);
  });
  await t.test('account and issuer substitutions are rejected by SQL binding',async()=>{
   const f=await fixture();for(const a of [[randomUUID(),actor.wallet.address,settings.authOrigin,settings.environment,f.runId],[actor.accountId,'0x'+'8'.repeat(64),settings.authOrigin,settings.environment,f.runId],[actor.accountId,actor.wallet.address,'https://foreign.example',settings.environment,f.runId]])await assert.rejects(pools.orders.query('SELECT tree_continue_v1.commerce_read($1,$2,$3,$4,$5)',a),/identity_mismatch/);
  });
  await t.test('competing flights cannot exceed a one-purchase remaining cap',async()=>{
   const a=await fixture({order:false}),b=await fixture({order:false}),before=await counts();await admin.query('UPDATE tree_continue_v1.commerce_policy SET total_limit_raw=reserved_raw+20000000000');
   try{const r=await Promise.allSettled([a.order(),b.order()]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.match(r.find(x=>x.status==='rejected').reason.message,/cap_reached/);const after=await counts();assert.equal(after.orders,before.orders+1);assert.equal(BigInt(after.reserved)-BigInt(before.reserved),20000000000n);}finally{await admin.query('UPDATE tree_continue_v1.commerce_policy SET total_limit_raw=20000000000000');}
  });
  await t.test('actual receipt pipeline settles once under ten concurrent retries',async()=>{
   const f=await fixture(),before=await counts(),r=await Promise.all(Array.from({length:10},()=>f.reconcile()));assert.ok(r.every(x=>x.status==='verified'&&x.authorization===null));assert.equal((await counts()).receipts,before.receipts+1);assert.equal(f.state.reads,1);assert.equal((await orderRow(f)).evidence.amountRaw,P.requiredRaw);
  });
  await t.test('underpaid or uncheckpointed evidence never reaches settlement',async()=>{
   for(const flag of ['underpaid','noCheckpoint']){const f=await fixture(),before=await counts();f.state[flag]=true;await assert.rejects(f.reconcile());assert.equal((await orderRow(f)).evidence,null);assert.deepEqual(await counts(),before);}
  });
  await t.test('node outage rolls back with signed order intact',async()=>{
   const f=await fixture(),before=await orderRow(f);f.state.offline=true;await assert.rejects(f.reconcile(),/ci-node-offline/);assert.deepEqual(await orderRow(f),before);
  });
  await t.test('SQL settlement independently rejects mismatched evidence and string finalized',async()=>{
   const f=await fixture();await f.reconcile();const original=(await orderRow(f)).evidence;
   for(const patch of [{amountRaw:'1'},{recipient:'0x'+'8'.repeat(64)},{finalized:'true'},{checkpoint:null},{timestampMs:f.state.now+45001}]){const e={...original,...patch};delete e.evidenceHash;e.evidenceHash=commitment(e);await assert.rejects(rawSettle(f,e));}assert.deepEqual((await orderRow(f)).evidence,original);
  });
  await t.test('cancel retains capacity and a timely real-receipt fixture can still settle',async()=>{
   const f=await fixture(),before=await counts();await f.service(actor,f.command('cancel',{orderId:f.ordered.order.orderId}));assert.equal((await orderRow(f)).state,'cancelled');assert.equal((await counts()).reserved,before.reserved);assert.equal((await f.reconcile()).status,'verified');
  });
  await t.test('pausing new orders preserves settlement and receipt-bound one-time delivery',async()=>{
   const f=await fixture();await admin.query('UPDATE tree_continue_v1.commerce_policy SET new_orders_enabled=false');
   try{await assert.rejects(f.order(),/disabled/);await f.reconcile();const clientKey=hex(),p=await f.service(actor,{action:'prepare_delivery',runId:f.runId,clientKey});
    const cmd={action:'activate_delivery',runId:f.runId,clientKey,leaseId:p.leaseId,requestId:randomUUID(),checkpointHash:p.checkpointHash};const first=await f.service(actor,cmd),retry=await f.service(actor,cmd);assert.equal(first.lives,3);assert.equal(first.restoreAuthorized,true);assert.equal(retry.replay,true);
    await f.reconcile();assert.equal((await orderRow(f)).state,'delivered');const n=(await admin.query("SELECT count(*)::int n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'",[f.ordered.order.orderId])).rows[0].n;assert.equal(n,1);
   }finally{await admin.query('UPDATE tree_continue_v1.commerce_policy SET new_orders_enabled=true');}
  });
  await t.test('separate settlement emergency gate cannot be bypassed by JS config',async()=>{
   const f=await fixture();await admin.query('UPDATE tree_continue_v1.commerce_policy SET settlement_enabled=false');try{await assert.rejects(f.reconcile(),/settlement_disabled/);assert.equal((await orderRow(f)).evidence,null);}finally{await admin.query('UPDATE tree_continue_v1.commerce_policy SET settlement_enabled=true');}
  });
  await t.test('runtime deployment disagreement is rejected before signing or reading',async()=>{
   const f=await fixture({order:false}),s=createScopedCommerce({...f.options,loadConfiguration:async()=>({...config,deployment:{...deployment,checkoutId:'0x'+'9'.repeat(64)}})});await assert.rejects(s(actor,f.command('order')),/deployment_mismatch/);assert.equal(f.state.signatures,0);assert.equal(f.state.reads,0);
  });
  await t.test('legacy deliver and unverified identity are refused',async()=>{
   const f=await fixture();await assert.rejects(f.commerce(actor,f.command('deliver')),/action_not_allowed/);await assert.rejects(f.commerce({...actor,identityMappingReviewed:false},{action:'status'}),/verified_identity/);
  });
 }finally{await Promise.all(Object.values(pools).map(p=>p.end()));await admin.end();}
});
