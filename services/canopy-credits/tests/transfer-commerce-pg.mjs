/** Disposable Postgres + real reader normalization; chain responses are fixtures.
 * No live payment, wallet signature, or user gameplay grant is created. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createPlatformRuntime} from '../platform-runtime.mjs';
import {createFlightStorage} from '../flight-storage.mjs';
import {platformDatabase} from '../platform-database.mjs';
import {MAINNET,createMainnetReader} from '../mainnet-reader.mjs';
import {DIRECT_CONTINUE as P,TRANSFER_DEPLOYMENT,transferReference,commitment} from '../continue-product.mjs';
import {transferPaymentVerifier} from '../transfer-payment.mjs';
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='transfer_commerce_ci')throw Error('Disposable transfer_commerce_ci required');
const {Pool}=createRequire(process.env.DIRECT_TEST_PACKAGE)('pg');
const pool=new Pool({max:2,connectionTimeoutMillis:3000}),auxiliaryPool=new Pool({max:2,connectionTimeoutMillis:3000});
const settings={authOrigin:'https://transfer-ci.example',environment:'release-candidate'};
const actor={authenticated:true,identityMappingReviewed:true,...settings,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+'1'.repeat(64)}};
const stamp=ms=>({seconds:BigInt(Math.floor(ms/1000)),nanos:(ms%1000)*1000000});
const D=MAINNET.genesisDigest,hex=()=>randomBytes(32).toString('hex');
function randomDigest(){const chars='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=BigInt('0x'+hex())|(1n<<255n),out='';while(n){out=chars[Number(n%58n)]+out;n/=58n;}return out;}
const storage=createFlightStorage(platformDatabase(auxiliaryPool,'storage'),settings);
async function fixture(){
 const runId=randomUUID(),now=Date.now(),state={digest:randomDigest(),reads:0,patch:null};
 await storage.register(actor,runId);
 await storage.save(actor,runId,randomUUID(),{format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:3,score:17649,lives:0,continuesUsed:0,scene:{codec:'formation-recovery.v1'}});
 const reader=createMainnetReader({
  getServiceInfo:async()=>({response:{chain:'mainnet',chainId:D,checkpointHeight:1n,timestamp:stamp(now+2000)}}),
  getCoinInfo:async()=>({response:{coinType:P.coinType,metadata:{id:'0x'+'5'.repeat(64),decimals:6,name:'Thickquidity',symbol:'TREE'}}}),
  getTransaction:async request=>{
   state.reads++;assert.equal(request.digest,state.digest);
   const text=transferReference(state.terms),pure=Uint8Array.from([text.length,...Buffer.from(text)]);
   const tx={digest:state.digest,checkpoint:1n,timestamp:stamp(now+2000),
    transaction:{sender:actor.wallet.address,kind:{data:{oneofKind:'programmableTransaction',programmableTransaction:{inputs:[{kind:1,pure}],commands:[{command:{oneofKind:'moveCall',moveCall:{package:'0x1',module:'string',function:'utf8',typeArguments:[],arguments:[{kind:2,input:0}]}}}]}}}},
    effects:{digest:D,transactionDigest:state.digest,status:{success:true}},balanceChanges:[{address:actor.wallet.address,coinType:P.coinType,amount:'-'+P.requiredRaw},{address:P.recipient,coinType:P.coinType,amount:P.requiredRaw}]};
   state.patch?.(tx);return{response:{transaction:tx}};
  },
  getCheckpoint:async()=>({response:{checkpoint:{sequenceNumber:1n,digest:D,summary:{timestamp:stamp(now+2000),contentDigest:D},contents:{digest:D,transactions:[{transaction:state.digest,effects:D}]}}}})
 },{now:()=>now+2000});
 const verify=transferPaymentVerifier(reader);
 const service=createPlatformRuntime({pool,auxiliaryPool,settings,configuration:{paymentsEnabled:true,deployment:TRANSFER_DEPLOYMENT,metadata:{network:P.network,coinType:P.coinType,decimals:6}},verifyPayment:verify,discover:async()=>({status:'found',digest:state.digest})});
 const command=(action,extra={})=>({action,runId,requestId:randomUUID(),...extra});
 const order=async()=>{const result=await service(actor,command('order'));state.terms=result.order.terms;return result;};
 const row=async()=>(await pool.query('SELECT * FROM tree_continue_v1.orders WHERE run_id=$1',[runId])).rows[0];
 const reconcile=()=>service(actor,command('reconcile',{orderId:state.terms.orderId,digest:state.digest}));
 return{runId,state,service,command,order,row,reconcile,verify};
}
async function asRole(role,sql,args){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE '+role);const r=await db.query(sql,args);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
const args=f=>[actor.accountId,actor.wallet.address,settings.authOrigin,settings.environment,f.runId];
async function rawSettle(f,e){return asRole('tree_continue_settlement','SELECT tree_continue_v1.commerce_settle($1,$2,$3,$4,$5,$6,$7)',[...args(f),f.state.terms.orderId,e]);}
await test('standard transfers through real PostgreSQL and receipt-bound delivery',async t=>{
 try{
  await pool.query('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;');
  for(const f of ['direct-continue-schema.sql','migrations/flight-storage-v1.sql','migrations/paid-delivery-v1.sql','migrations/purchase-recovery-v1.sql','migrations/scoped-commerce-v1.sql','migrations/transfer-commerce-v1.sql'])await pool.query(await readFile(new URL('../'+f,import.meta.url),'utf8'));
  const before=(await pool.query('SELECT * FROM tree_continue_v1.commerce_policy')).rows[0];assert.equal(before.new_orders_enabled,false);assert.equal(before.settlement_enabled,false);assert.equal(before.deployment,null);
  await pool.query('UPDATE tree_continue_v1.commerce_policy SET auth_origin=$1,pilot_wallet=$2,deployment=$3,total_limit_raw=20000000000000,new_orders_enabled=true,settlement_enabled=true',[settings.authOrigin,actor.wallet.address,TRANSFER_DEPLOYMENT]);
  await t.test('ten order retries retain one immutable order without signing keys or manual flight review',async()=>{
   const f=await fixture(),r=await Promise.all(Array.from({length:10},()=>f.order()));assert.equal(new Set(r.map(x=>x.order.orderId)).size,1);assert.equal((await f.row()).envelope,null);assert.equal((await storage.recover(actor,f.runId)).validation,'unreviewed');
  });
  await t.test('failed, underpaid, uncheckpointed and wrong-reference transfers cannot settle',async()=>{
   for(const patch of [tx=>tx.effects.status.success=false,tx=>tx.balanceChanges[1].amount='1',tx=>delete tx.checkpoint,tx=>tx.transaction.kind.data.programmableTransaction.inputs[0].pure[1]=0]){
    const f=await fixture();await f.order();f.state.patch=patch;await assert.rejects(f.reconcile());assert.equal((await f.row()).evidence,null);
   }
  });
  await t.test('ten settlement retries claim one transaction and never grant lives directly',async()=>{
   const f=await fixture();await f.order();const r=await Promise.all(Array.from({length:10},()=>f.reconcile()));assert.ok(r.every(x=>x.status==='verified'&&x.authorization===null));assert.equal(f.state.reads,1);assert.equal((await pool.query('SELECT count(*)::int n FROM tree_continue_v1.receipts WHERE order_id=$1',[f.state.terms.orderId])).rows[0].n,1);
  });
  await t.test('lost response is recovered from the server order without a second payment',async()=>{
   const f=await fixture();await f.order();const r=await f.service(actor,{action:'recover_purchase',runId:f.runId});assert.equal(r.status,'verified');assert.equal(r.requiresPayment,false);assert.equal(r.order.orderId,f.state.terms.orderId);assert.equal(f.state.reads,1);
  });
  await t.test('one paid casual flight restores three lives and preserves wave/score',async()=>{
   const f=await fixture();await f.order();await f.reconcile();const clientKey=hex();
   const p=await f.service(actor,{action:'prepare_delivery',runId:f.runId,clientKey});const saved=JSON.parse(p.snapshotText);assert.equal(saved.wave,3);assert.equal(saved.score,17649);
   const c={action:'activate_delivery',runId:f.runId,clientKey,leaseId:p.leaseId,requestId:randomUUID(),checkpointHash:p.checkpointHash};
   const first=await f.service(actor,c),retry=await f.service(actor,c);assert.equal(first.lives,3);assert.equal(first.restoreAuthorized,true);assert.equal(retry.replay,true);
   assert.equal((await f.service(actor,{action:'prepare_delivery',runId:f.runId,clientKey:hex()})).status,'review-required');
   assert.equal((await f.row()).state,'delivered');assert.equal((await pool.query("SELECT count(*)::int n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'",[f.state.terms.orderId])).rows[0].n,1);
  });
  await t.test('a transaction cannot be claimed for another flight, even by the settlement role',async()=>{
   const a=await fixture(),b=await fixture();await a.order();await b.order();await a.reconcile();const old=(await a.row()).evidence;
   const e={...old,orderId:b.state.terms.orderId,quoteHash:b.state.terms.quoteHash,paymentReference:transferReference(b.state.terms)};delete e.evidenceHash;e.evidenceHash=commitment(e);
   await assert.rejects(rawSettle(b,e),/receipt_already_used/);assert.equal((await b.row()).evidence,null);
  });
  await t.test('SQL refuses changed price/recipient, forged evidence and extra receipt index',async()=>{
   const f=await fixture();await f.order();
   for(const patch of [{amountRaw:'1'},{recipient:'0x'+'9'.repeat(64)},{eventIndex:'1'},{finalized:'true'},{paymentReference:'wrong'}]){
    const e={...await f.verify(f.state.terms,f.state.digest),...patch};delete e.evidenceHash;e.evidenceHash=commitment(e);await assert.rejects(rawSettle(f,e));
   }assert.equal((await f.row()).evidence,null);
  });
  await t.test('order and public roles still cannot self-certify payment',async()=>{
   const f=await fixture();await f.order();for(const role of ['tree_continue_orders','anon','authenticated','service_role'])await assert.rejects(asRole(role,'SELECT tree_continue_v1.commerce_settle($1,$2,$3,$4,$5,$6,$7)',[...args(f),f.state.terms.orderId,{}]),/permission denied/);
  });
  await t.test('sales pause still permits reconciliation and cannot be bypassed by runtime settings',async()=>{
   const f=await fixture();await f.order();await pool.query('UPDATE tree_continue_v1.commerce_policy SET new_orders_enabled=false');
   try{assert.equal((await f.service(actor,{action:'status'})).enabled,false);await assert.rejects(f.order(),/disabled/);assert.equal((await f.reconcile()).status,'verified');}finally{await pool.query('UPDATE tree_continue_v1.commerce_policy SET new_orders_enabled=true');}
  });
 }finally{await pool.end();await auxiliaryPool.end();}
});
