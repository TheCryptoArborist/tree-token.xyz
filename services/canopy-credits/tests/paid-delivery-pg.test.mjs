/** Real disposable PostgreSQL + actual server adapter and browser controller.
 * Identity, chain evidence, checkpoint review, and scene callbacks are fixtures.
 * No live wallet, hosted database, signing key or token transfer is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createFlightStorage} from '../flight-storage.mjs';
import {DIRECT_CONTINUE as P,commitment} from '../continue-product.mjs';
import {postgresDirectRepository} from '../direct-continue-repository.mjs';
import {createDirectContinueService} from '../direct-continue-service.mjs';
import {createPaidDelivery,withPaidDelivery} from '../paid-delivery.mjs';
import {createPaidDeliveryHttp} from '../paid-delivery-http.mjs';
const require=createRequire(process.env.PAID_TEST_PACKAGE||import.meta.url);
const {Pool}=require('pg');
const gameRoot=process.env.PAID_GAME_ROOT;
if(!gameRoot)throw Error('Game checkout required');
const {createPaidFlightDelivery}=await import(pathToFileURL(path.join(gameRoot,'app/game/paid-flight-delivery.mjs')));
if(!['127.0.0.1','localhost','::1'].includes(process.env.PGHOST)||process.env.PGDATABASE!=='paid_delivery_ci')throw Error('Disposable loopback database required');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const pool=new Pool({max:20});
const origin='https://delivery-ci.example';
const authOrigin='https://account-ci.example';
const settings={authOrigin,environment:'release-candidate'};
const key=()=>randomBytes(32).toString('hex');
const cmd=(action,runId,rest={})=>({action,runId,...rest});
const scoped={async query(sql,params){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE tree_continue_delivery');const r=await db.query(sql,params);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}};
const delivery=createPaidDelivery(scoped,settings);
const storage=createFlightStorage(pool,settings);
async function fixture({verify=true,review=true}={}){
 const actor={authenticated:true,identityMappingReviewed:true,...settings,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+key()}};
 const runId=randomUUID(),snapshot={format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:3,score:17649,lives:0,continuesUsed:0,scene:{codec:'formation-recovery.v1'}};
 await storage.register(actor,runId);const saved=await storage.save(actor,runId,randomUUID(),snapshot);
 if(review)await pool.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','explicit-ci-fixture',$2)",[saved.checkpointId,key()]);
 const config={paymentsEnabled:true,deployment:{network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),keyEpoch:'1'},metadata:{network:P.network,coinType:P.coinType,decimals:6}};
 const repository=postgresDirectRepository(pool);
 const purchases=createDirectContinueService({repository,resolveFlight:(a,r)=>storage.resolveValidatedFlight(a,r),loadConfiguration:async()=>config,
  authorizeQuote:async()=>({quoteBase64:'CI-FIXTURE-NOT-PAYABLE',signatureBase64:'CI-FIXTURE-NOT-SIGNED'}),
  verifyPayment:async(terms,digest)=>{
   const evidence={source:'chain-reader',status:'success',finalized:true,digest,eventIndex:'0',...Object.fromEntries(['orderId','accountId','payer','recipient','coinType','quoteHash','checkoutId','keyEpoch','network'].map(k=>[k,terms[k]])),amountRaw:terms.requiredRaw};
   evidence.evidenceHash=commitment(evidence);return evidence;
  }});
 const service=withPaidDelivery(purchases,delivery);
 let order=null;
 if(review){order=(await service(actor,cmd('order',runId,{requestId:randomUUID()}))).order;
  if(verify)await service(actor,cmd('reconcile',runId,{requestId:randomUUID(),orderId:order.orderId,digest:'A'.repeat(43)}));}
 return{actor,runId,snapshot,saved,order,service,config,api:c=>service(actor,c)};
}
function activation(runId,p,clientKey,requestId=randomUUID()){
 return cmd('activate_delivery',runId,{clientKey,leaseId:p.leaseId,requestId,checkpointHash:p.checkpointHash});
}
async function prepare(f,clientKey=key()){return{clientKey,p:await f.api(cmd('prepare_delivery',f.runId,{clientKey}))};}
async function expire(orderId){await pool.query("UPDATE tree_continue_v1.paid_deliveries SET lease_until=clock_timestamp()-interval '1 second' WHERE order_id=$1",[orderId]);}
async function journal(orderId){return(await pool.query("SELECT count(*)::integer n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'",[orderId])).rows[0].n;}
function controller(f,{api=f.api,identity=()=>f.actor,load,restoreError=false,resumeError=false}={}){
 let lives=0,restores=0,resumes=0,loads=0;const requests=[];
 const c=createPaidFlightDelivery({runId:f.runId,expectedOrderId:f.order?.orderId,identity,
  api:async command=>{requests.push(command);return api(command);},
  loadPaused:async(s,b)=>{
   loads++;assert.equal(s.runId,f.runId);assert.equal(s.score,17649);assert.equal(b.checkpointHash,f.saved.checkpointHash);
   if(load)return load(s,b);
   return{assertPaused(){assert.equal(lives,0);},restore(n){restores++;if(restoreError)throw Error('partial-scene-failure');lives=n;},resume(){resumes++;if(resumeError)throw Error('renderer-failure');}};
  }});
 return{c,requests,get lives(){return lives;},get restores(){return restores;},get resumes(){return resumes;},get loads(){return loads;}};
}
await test('paid delivery: actual PostgreSQL and client/server protocol',async t=>{
 try{
  await pool.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
  for(const file of ['direct-continue-schema.sql','migrations/flight-storage-v1.sql','migrations/paid-delivery-v1.sql'])await pool.query(await readFile(new URL('../'+file,import.meta.url),'utf8'));
  await t.test('unreviewed checkpoint cannot create a purchase or delivery',async()=>{const f=await fixture({review:false});await assert.rejects(f.api(cmd('order',f.runId,{requestId:randomUUID()})),/validation/);await assert.rejects(f.api(cmd('prepare_delivery',f.runId,{clientKey:key()})),/not_found/);});
  await t.test('unverified order never authorizes a restore',async()=>{const f=await fixture({verify:false});const p=await f.api(cmd('prepare_delivery',f.runId,{clientKey:key()}));assert.equal(p.status,'awaiting-verification');assert.equal(p.restoreAuthorized,false);assert.equal(p.requiresPayment,false);});
  await t.test('legacy reconciliation authorization is stripped and old deliver is blocked',async()=>{const f=await fixture();const r=await f.api(cmd('reconcile',f.runId,{requestId:randomUUID(),orderId:f.order.orderId}));assert.equal(r.authorization,null);assert.equal(r.deliveryReady,true);await assert.rejects(f.api(cmd('deliver',f.runId,{requestId:randomUUID(),orderId:f.order.orderId,receiptId:'fake'})),/protocol/);});
  await t.test('prepare binds exact persisted checkpoint and does not consume purchase',async()=>{const f=await fixture();const {p}=await prepare(f);assert.equal(p.status,'prepared');assert.equal(p.restoreAuthorized,false);assert.equal(p.checkpointHash,f.saved.checkpointHash);assert.equal(JSON.parse(p.snapshotText).score,17649);assert.equal(await journal(f.order.orderId),0);});
  await t.test('20 competing page leases grant exactly one preparation',async()=>{const f=await fixture();const values=await Promise.all(Array.from({length:20},()=>prepare(f)));assert.equal(values.filter(x=>x.p.status==='prepared').length,1);assert.equal(values.filter(x=>x.p.status==='in-use').length,19);assert.equal(await journal(f.order.orderId),0);});
  await t.test('same-page concurrent prepare retries retain one lease',async()=>{const f=await fixture(),k=key();const rows=await Promise.all(Array.from({length:10},()=>prepare(f,k)));assert.equal(new Set(rows.map(x=>x.p.leaseId)).size,1);const events=await pool.query('SELECT count(*)::int n FROM tree_continue_v1.paid_delivery_events WHERE order_id=$1',[f.order.orderId]);assert.equal(events.rows[0].n,1);});
  await t.test('wrong page key cannot activate another lease',async()=>{const f=await fixture(),{p}=await prepare(f);await assert.rejects(f.api(activation(f.runId,p,key())),/lease_mismatch/);assert.equal(await journal(f.order.orderId),0);});
  await t.test('wrong checkpoint cannot activate a valid lease',async()=>{const f=await fixture(),{p,clientKey}=await prepare(f);await assert.rejects(f.api({...activation(f.runId,p,clientKey),checkpointHash:key()}),/checkpoint_mismatch/);});
  await t.test('expiration permits recovery before activation but rejects stale owner',async()=>{const f=await fixture(),old=await prepare(f);await expire(f.order.orderId);const next=await prepare(f);assert.equal(next.p.status,'prepared');assert.notEqual(next.p.leaseId,old.p.leaseId);await assert.rejects(f.api(activation(f.runId,old.p,old.clientKey)),/lease_mismatch/);assert.equal(await journal(f.order.orderId),0);});
  await t.test('expired preparation cannot restore without reacquiring',async()=>{const f=await fixture(),{p,clientKey}=await prepare(f);await expire(f.order.orderId);await assert.rejects(f.api(activation(f.runId,p,clientKey)),/lease_expired/);});
  await t.test('duplicate activation requests commit one consumption and journal entry',async()=>{const f=await fixture(),{p,clientKey}=await prepare(f),a=activation(f.runId,p,clientKey);const result=await Promise.all(Array.from({length:12},()=>f.api(a)));assert.equal(result.filter(x=>x.replay===false).length,1);assert.equal(result.filter(x=>x.replay===true).length,11);assert.equal(await journal(f.order.orderId),1);});
  await t.test('another page or changed request cannot replay a consumed continue',async()=>{const f=await fixture(),{p,clientKey}=await prepare(f);await f.api(activation(f.runId,p,clientKey));for(const k of [clientKey,key()]){const r=await f.api(activation(f.runId,p,k));assert.equal(r.status,'review-required');assert.equal(r.restoreAuthorized,false);}assert.equal((await prepare(f)).p.status,'review-required');});
  await t.test('paused new purchases do not block already-verified recovery',async()=>{const f=await fixture();f.config.paymentsEnabled=false;assert.equal((await f.api({action:'status'})).enabled,false);const {p,clientKey}=await prepare(f);assert.equal((await f.api(activation(f.runId,p,clientKey))).status,'started');});
  await t.test('wrong payer, account and issuer are rejected',async()=>{const f=await fixture();for(const a of [{...f.actor,wallet:{family:'sui',address:'0x'+key()}},{...f.actor,accountId:randomUUID()},{...f.actor,authOrigin:'https://evil.example'}])await assert.rejects(f.service(a,cmd('prepare_delivery',f.runId,{clientKey:key()})));});
  await t.test('storage/browser/platform roles cannot invoke paid authorization',async()=>{const f=await fixture();for(const role of ['anon','authenticated','service_role','tree_continue_storage']){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE '+role);await assert.rejects(db.query('SELECT tree_continue_v1.paid_delivery($1,$2,$3,$4,$5,\'status\')',[f.actor.accountId,f.actor.wallet.address,authOrigin,'release-candidate',f.runId]),/permission denied/);}finally{await db.query('ROLLBACK');db.release();}}});
  await t.test('delivery role cannot fabricate receipts or update tables',async()=>{for(const sql of ['SELECT * FROM tree_continue_v1.receipts','UPDATE tree_continue_v1.orders SET state=\'verified\'','SELECT * FROM tree_continue_v1.paid_deliveries'])await assert.rejects(scoped.query(sql),/permission denied/);});
  await t.test('started authorization and delivery audit are immutable',async()=>{const f=await fixture(),{p,clientKey}=await prepare(f);await f.api(activation(f.runId,p,clientKey));await assert.rejects(pool.query("UPDATE tree_continue_v1.paid_deliveries SET state='prepared',activation_request=NULL WHERE order_id=$1",[f.order.orderId]),/immutable/);await assert.rejects(pool.query('DELETE FROM tree_continue_v1.paid_delivery_events WHERE order_id=$1',[f.order.orderId]),/immutable/);});
  await t.test('client restores only after durable activation and no wallet request',async()=>{const f=await fixture(),h=controller(f);await h.c.resume();assert.equal(h.restores,1);assert.equal(h.resumes,1);assert.equal(h.lives,3);assert.equal(await journal(f.order.orderId),1);assert.deepEqual(h.requests.map(x=>x.action),['prepare_delivery','activate_delivery']);assert.equal(await h.c.resume(),false);});
  await t.test('client double-click cannot restore twice',async()=>{const f=await fixture(),h=controller(f);await Promise.all([h.c.resume(),h.c.resume()]);assert.equal(h.restores,1);assert.equal(await journal(f.order.orderId),1);});
  await t.test('lost activation reply retries same request without another preparation',async()=>{const f=await fixture();let lost=false;const h=controller(f,{api:async c=>{const r=await f.api(c);if(c.action==='activate_delivery'&&!lost){lost=true;throw Error('connection-lost');}return r;}});await assert.rejects(h.c.resume(),/connection-lost/);assert.equal(h.restores,0);await h.c.resume();assert.equal(h.restores,1);assert.equal(h.requests.filter(x=>x.action==='prepare_delivery').length,1);const a=h.requests.filter(x=>x.action==='activate_delivery');assert.deepEqual(a[0],a[1]);assert.equal(await journal(f.order.orderId),1);});
  await t.test('renderer preparation failure does not consume paid authorization',async()=>{const f=await fixture(),h=controller(f,{load:async()=>{throw Error('cannot-rebuild');}});await assert.rejects(h.c.resume(),/cannot-rebuild/);assert.equal(await journal(f.order.orderId),0);});
  await t.test('partial life restoration cannot be replayed by retry',async()=>{const f=await fixture(),h=controller(f,{restoreError:true});await assert.rejects(h.c.resume(),/review-required/);await assert.rejects(h.c.resume(),/review-required/);assert.equal(h.restores,1);assert.equal(await journal(f.order.orderId),1);});
  await t.test('closing page after activation leaves review path, never a second payment',async()=>{const f=await fixture();const a=controller(f);await a.c.resume();a.c.dispose();const b=controller(f);await assert.rejects(b.c.resume(),/review-required/);assert.equal(b.restores,0);assert.equal(b.requests.some(x=>['order','pay'].includes(x.action)),false);});
  await t.test('tampered saved bytes stop before activation',async()=>{const f=await fixture(),h=controller(f,{api:async c=>{const p=await f.api(c);return p.status==='prepared'?{...p,snapshotText:p.snapshotText+' '}:p;}});await assert.rejects(h.c.resume(),/corrupt/);assert.equal(await journal(f.order.orderId),0);});
  await t.test('account switch after prepare prevents activation',async()=>{const f=await fixture();let i=f.actor;const h=controller(f,{identity:()=>i,api:async c=>{const p=await f.api(c);i={...f.actor,accountId:randomUUID()};return p;}});await assert.rejects(h.c.resume(),/account-changed/);assert.equal(await journal(f.order.orderId),0);});
  await t.test('HTTP authenticates server-side and rejects identity injection',async()=>{const f=await fixture();let calls=0;const h=createPaidDeliveryHttp({origin,resolveActor:async()=>f.actor,service:async(a,c)=>{calls++;assert.equal(a.accountId,f.actor.accountId);return f.service(a,c);}});const req=(body,headers={})=>new Request(origin+'/api/delivery',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});assert.equal((await h(req(cmd('delivery_status',f.runId)))).status,200);assert.equal((await h(req({...cmd('delivery_status',f.runId),accountId:randomUUID()}))).status,400);assert.equal((await h(req(cmd('delivery_status',f.runId),{Origin:'https://evil.example'}))).status,403);assert.equal(calls,1);});
  await t.test('HTTP rejects oversized input and redacts backend details',async()=>{const f=await fixture(),h=createPaidDeliveryHttp({origin,resolveActor:async()=>f.actor,service:async()=>{throw Error('secret-connection-details');}});const req=body=>new Request(origin+'/api/delivery',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body});assert.equal((await h(req(JSON.stringify({x:'x'.repeat(5000)})))).status,413);const r=await h(req(JSON.stringify(cmd('delivery_status',f.runId))));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret/);});
 }finally{await pool.end();}
});
