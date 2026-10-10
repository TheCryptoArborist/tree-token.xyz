/** Disposable real PostgreSQL; explicit identity/chain/wallet/renderer fixtures.
 * Exercises the actual chain verifier, recovery, checkout and delivery code.
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {createFlightStorage} from '../flight-storage.mjs';import {DIRECT_CONTINUE as P} from '../continue-product.mjs';
import {postgresDirectRepository} from '../direct-continue-repository.mjs';import {createDirectContinueService} from '../direct-continue-service.mjs';
import {createPaidDelivery,withPaidDelivery} from '../paid-delivery.mjs';import {withPurchaseRecovery} from '../purchase-recovery.mjs';
import {createReceiptDiscovery,RECEIPT_DISCOVERY_QUERY} from '../receipt-discovery.mjs';import {directContinueVerifier} from '../direct-continue-verifier.mjs';import {createContinueGateway} from '../continue-gateway.mjs';
const require=createRequire(process.env.PAID_TEST_PACKAGE),{Pool}=require('pg');
assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'paid_delivery_ci');
const game=process.env.PAID_GAME_ROOT;if(!game)throw Error('game-checkout-required');
const {createTreeContinueAttempt}=await import(pathToFileURL(resolve(game,'app/game/tree-continue-checkout.mjs')));
const {createContinueProxy}=await import(pathToFileURL(resolve(game,'netlify/lib/tree-continue-proxy.mjs')));
const {directContinueGate}=await import(pathToFileURL(resolve(game,'netlify/lib/tree-continue-gate.mjs')));
const pool=new Pool({max:20}),key=()=>randomBytes(32).toString('hex'),digest=()=>key().replace(/0/g,'G').slice(0,43);
const settings={authOrigin:'https://account-recovery-ci.example',environment:'release-candidate'},gameOrigin='https://game-recovery-ci.example';
function role(name){return{async query(sql,params){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE '+name);const result=await db.query(sql,params);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}};}
const storage=createFlightStorage(pool,settings),lookup=role('tree_continue_recovery'),delivery=createPaidDelivery(role('tree_continue_delivery'),settings);
const chain=new Map();const reader={async getNetworkIdentity(){return{network:P.network,chainIdentifier:P.chainIdentifier};},async getFinalizedTransaction(d){if(!chain.has(d))throw Error('missing-fixture-transaction');return chain.get(d);}};
const verify=directContinueVerifier(reader);
function payment(terms,changes={}){
 const d=digest(),stamp=terms.issuedAtMs+1;
 chain.set(d,{digest:d,status:'success',finalized:true,simulated:false,checkpoint:'9000',timestampMs:stamp,sender:terms.payer,
 events:[{type:terms.eventType,packageId:terms.checkoutPackage,index:'0',fields:{...Object.fromEntries(['orderId','accountId','payer','recipient','coinType','quoteHash','checkoutId','keyEpoch'].map(k=>[k,terms[k]])),amountRaw:terms.requiredRaw,issuedAtMs:String(terms.issuedAtMs),expiresAtMs:String(terms.expiresAtMs),paidAtMs:String(stamp)}}],
 balanceChanges:[{owner:terms.payer,coinType:P.coinType,amount:'-'+terms.requiredRaw},{owner:P.recipient,coinType:P.coinType,amount:terms.requiredRaw}],...changes});return d;
}
async function fixture({ordered=true,review=true}={}){
 const actor={authenticated:true,identityMappingReviewed:true,...settings,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+key()}};
 const runId=randomUUID(),snapshot={format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:3,score:17003,lives:0,continuesUsed:0,scene:{codec:'formation-recovery.v1'}};
 await storage.register(actor,runId);const saved=await storage.save(actor,runId,randomUUID(),snapshot);
 if(review)await pool.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','recovery-ci-fixture',$2)",[saved.checkpointId,key()]);
 const config={paymentsEnabled:true,deployment:{network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),keyEpoch:'1'},metadata:{network:P.network,coinType:P.coinType,decimals:6}};
 const f={actor,runId,snapshot,saved,config,candidates:[],scans:0,now:Date.now};
 const discovery=createReceiptDiscovery({endpoint:'https://index-recovery-ci.example/graphql',verify,fetcher:async(url,options)=>{f.scans++;const body=JSON.parse(options.body);assert.equal(body.query,RECEIPT_DISCOVERY_QUERY);assert.equal(body.variables.payer,actor.wallet.address);return Response.json({data:{chainIdentifier:P.chainIdentifier,events:{nodes:f.candidates.map(d=>({transaction:{digest:d}})),pageInfo:{hasPreviousPage:false,startCursor:null}}}});}});
 const purchases=withPaidDelivery(createDirectContinueService({repository:postgresDirectRepository(pool),resolveFlight:(a,r)=>storage.resolveValidatedFlight(a,r),loadConfiguration:async()=>config,authorizeQuote:async()=>({quoteBase64:'UNSIGNED-TEST-FIXTURE',signatureBase64:'NOT-PAYABLE'}),verifyPayment:verify,now:()=>f.now()}),delivery);
 f.purchases=purchases;f.service=withPurchaseRecovery(purchases,{db:lookup,discover:discovery,...settings});f.api=c=>f.service(actor,c);
 if(ordered)f.order=(await f.api({action:'order',runId,requestId:randomUUID()})).order;
 return f;
}
const recover=f=>f.api({action:'recover_purchase',runId:f.runId});
async function counts(f){return(await pool.query("SELECT (SELECT count(*)::int FROM tree_continue_v1.receipts WHERE order_id=$1) receipts,(SELECT count(*)::int FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered') delivered",[f.order.orderId])).rows[0];}
await test('purchase recovery and default checkout integration',async t=>{
 try{
  await pool.query(await readFile(new URL('../migrations/purchase-recovery-v1.sql',import.meta.url),'utf8'));
  await t.test('no stored order is distinct from an unresolved payment',async()=>{const f=await fixture({ordered:false});const r=await recover(f);assert.equal(r.status,'not-found');assert.equal(r.requiresPayment,false);assert.equal(f.scans,0);});
  await t.test('lost browser digest is discovered and independently verified into durable receipt',async()=>{const f=await fixture();f.candidates.push(payment(f.order.terms));f.config.paymentsEnabled=false;const r=await recover(f);assert.equal(r.status,'verified');assert.equal(r.authorization,null);assert.equal(r.order.payable,false);assert.equal((await counts(f)).receipts,1);assert.equal((await counts(f)).delivered,0);assert.equal((await recover(f)).status,'verified');assert.equal(f.scans,1);});
  await t.test('twenty concurrent recoveries share a durable scan limit and one receipt',async()=>{const f=await fixture();f.candidates.push(payment(f.order.terms));await Promise.all(Array.from({length:20},()=>recover(f)));assert.equal(f.scans,1);assert.equal((await counts(f)).receipts,1);});
  await t.test('empty index remains pending even after quote expiry',async()=>{
   const f=await fixture();f.now=()=>f.order.terms.expiresAtMs+60000;
   assert.ok(f.now()>f.order.terms.expiresAtMs);
   await assert.rejects(f.api({action:'order',runId:f.runId,requestId:randomUUID()}),/quote-expired/);
   const r=await recover(f);assert.equal(r.status,'pending');assert.equal(r.requiresPayment,false);assert.equal(r.order.payable,false);assert.equal((await recover(f)).discovery,'throttled');assert.equal((await counts(f)).receipts,0);
  });
  await t.test('unrelated receipt and false transfer effects cannot qualify',async()=>{const f=await fixture();f.candidates.push(payment(f.order.terms,{sender:'0x'+key()}),payment(f.order.terms,{balanceChanges:[]}));assert.equal((await recover(f)).status,'pending');assert.equal((await counts(f)).receipts,0);});
  await t.test('cancelled order can recover a late indexed valid payment',async()=>{const f=await fixture();await f.api({action:'cancel',runId:f.runId,requestId:randomUUID(),orderId:f.order.orderId});f.candidates.push(payment(f.order.terms));assert.equal((await recover(f)).status,'verified');});
  await t.test('other account and wrong issuer cannot read purchase details',async()=>{const f=await fixture(),other=await fixture();assert.equal((await other.service(other.actor,{action:'recover_purchase',runId:f.runId})).status,'not-found');await assert.rejects(f.service({...f.actor,authOrigin:'https://evil.example'},{action:'list_purchases'}),/identity/);});
  await t.test('lookup role cannot manufacture a receipt or activate delivery',async()=>{await assert.rejects(lookup.query('SELECT * FROM tree_continue_v1.receipts'),/permission denied/);await assert.rejects(lookup.query("SELECT tree_continue_v1.paid_delivery(NULL,NULL,NULL,NULL,NULL,'status')"),/permission denied/);});
  await t.test('browser and platform roles cannot invoke purchase lookup',async()=>{for(const name of ['anon','authenticated','service_role'])await assert.rejects(role(name).query('SELECT tree_continue_v1.lookup_purchases(NULL,NULL,NULL,NULL)'),/permission denied/);});
  await t.test('browser cannot inject proof, payer, cursor authority or configuration',async()=>{const f=await fixture();for(const c of [{action:'recover_purchase',runId:f.runId,verified:true},{action:'list_purchases',payer:f.actor.wallet.address},{action:'recover_purchase',runId:f.runId,digest:digest()}])await assert.rejects(f.api(c),/invalid-recovery-command/);});
  await t.test('new checkout recovers a lost wallet reply without another submission',async()=>{
   const f=await fixture({ordered:false});let marker=null,pays=0,lives=0,resumes=0;const actions=[];
   const pending={read:()=>marker,save:v=>{marker=structuredClone(v);},clear:()=>{marker=null;}};
   const attempt=createTreeContinueAttempt({api:async c=>{actions.push(c.action);const r=await f.api(c);if(c.action==='order')f.order=r.order;return r;},identity:()=>f.actor,clientRunId:f.runId,prepare(){},pending,
    wallet:{async connect(){},async prepare(o){return o;},async pay(o){pays++;f.candidates.push(payment(o.terms));throw Error('lost-wallet-reply');},async wait(){}},
    loadPaused:async()=>({assertPaused(){assert.equal(lives,0);},restore(n){lives=n;},resume(){resumes++;}})});
   await assert.rejects(attempt.continue(),/lost-wallet-reply/);assert.equal(marker.signingAttempted,true);assert.equal(lives,0);
   await attempt.continue();assert.equal(pays,1);assert.equal(lives,3);assert.equal(resumes,1);assert.equal(marker,null);assert.equal(actions.includes('deliver'),false);assert.equal((await counts(f)).delivered,1);
  });
  await t.test('cleared browser storage still recovers existing order without wallet calls',async()=>{
   const f=await fixture();f.candidates.push(payment(f.order.terms));let lives=0;const attempt=createTreeContinueAttempt({api:f.api,identity:()=>f.actor,clientRunId:f.runId,prepare(){},pending:{read:()=>null,save(){},clear(){}},wallet:new Proxy({}, {get(){throw Error('unexpected-wallet-access');}}),loadPaused:async()=>({assertPaused(){assert.equal(lives,0);},restore(n){lives=n;},resume(){}})});await attempt.continue();assert.equal(lives,3);assert.equal((await counts(f)).delivered,1);
  });
  await t.test('paused purchases do not produce a wallet call for a new order',async()=>{const f=await fixture({ordered:false});f.config.paymentsEnabled=false;const a=createTreeContinueAttempt({api:f.api,identity:()=>f.actor,clientRunId:f.runId,prepare(){},pending:{read:()=>null},wallet:new Proxy({}, {get(){throw Error('unexpected-wallet-access');}}),loadPaused(){throw Error('unexpected-scene');}});await assert.rejects(a.continue(),/checkout-not-enabled/);});
  await t.test('BFF and gateway verify the central session and reject identity injection',async()=>{
   const f=await fixture(),token=key();let authCalls=0;const gateway=createContinueGateway({authOrigin:settings.authOrigin,gameOrigin,service:f.service,fetcher:async(url,options)=>{authCalls++;assert.equal(JSON.parse(options.body).token,token);return Response.json({status:'ok',identity:{...f.actor,environment:'preview',expiresAt:Date.now()+10000}});}});
   const proxy=createContinueProxy({gameOrigin,serviceUrl:'https://gateway-ci.example/continue',fetcher:async(url,options)=>gateway(new Request(url,options))});
   const req=c=>new Request(gameOrigin+'/api/tree-continue',{method:'POST',headers:{Origin:gameOrigin,'Content-Type':'application/json',Cookie:'__Host-tree-game-session='+token},body:JSON.stringify(c)});
   const r=await proxy(req({action:'list_purchases'}));assert.equal(r.status,200);assert.equal((await r.json()).purchases.length,1);assert.equal(authCalls,1);
   const injected=await proxy(req({action:'list_purchases',accountId:f.actor.accountId}));assert.equal(injected.status,400);assert.equal(authCalls,1);
   const bad=req({action:'list_purchases'});bad.headers.set('Origin','https://evil.example');assert.equal((await proxy(bad)).status,403);assert.equal(authCalls,1);
  });
  await t.test('expired central session never reaches a database operation',async()=>{let calls=0;const g=createContinueGateway({authOrigin:settings.authOrigin,gameOrigin,service:async()=>{calls++;},fetcher:async()=>Response.json({status:'ok',identity:{authenticated:true,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+key()},environment:'preview',expiresAt:1}})});const r=await g(new Request('https://gateway-ci.example/continue',{method:'POST',headers:{Authorization:'Bearer '+key(),'Content-Type':'application/json'},body:'{"action":"list_purchases"}'}));assert.equal(r.status,401);assert.equal(calls,0);});
  await t.test('default hosted gate stays closed despite browser activation flags',async()=>{const r=await directContinueGate(new Request(gameOrigin+'/api/tree-continue?enabled=true',{method:'POST',headers:{Origin:gameOrigin,'Content-Type':'application/json'},body:'{"action":"order","paymentsEnabled":true}'}));assert.equal(r.status,503);assert.equal((await r.json()).enabled,false);});
  await t.test('GraphQL partial errors and wrong chain never yield a receipt',async()=>{const f=await fixture();for(const response of [{data:{chainIdentifier:'wrong'},errors:[]},{data:{chainIdentifier:P.chainIdentifier},errors:[{message:'partial'}]}]){const scan=createReceiptDiscovery({endpoint:'https://index-ci.example/graphql',verify,fetcher:async()=>Response.json(response)});await assert.rejects(scan(f.order.terms),/chain-or-query/);}});
  await t.test('cursor repetition is rejected instead of looping or claiming nonpayment',async()=>{const f=await fixture();const scan=createReceiptDiscovery({endpoint:'https://index-ci.example/graphql',verify,fetcher:async()=>Response.json({data:{chainIdentifier:P.chainIdentifier,events:{nodes:[],pageInfo:{hasPreviousPage:true,startCursor:'same'}}}})});await assert.rejects(scan(f.order.terms),/cursor/);});
  await t.test('bounded scan does not authorize another payment',async()=>{const f=await fixture();let n=0;const scan=createReceiptDiscovery({endpoint:'https://index-ci.example/graphql',maxPages:2,verify,fetcher:async()=>Response.json({data:{chainIdentifier:P.chainIdentifier,events:{nodes:[],pageInfo:{hasPreviousPage:true,startCursor:String(++n)}}}})});assert.deepEqual(await scan(f.order.terms),{status:'bounded'});assert.equal(n,2);});
 }finally{await pool.end();}
});
