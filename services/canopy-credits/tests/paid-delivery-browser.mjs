/** Actual Chromium/Phaser/PostgreSQL delivery tests. Vite serves the real game
 * source; its production compilation is checked separately. Authentication,
 * checkpoint validation and already-verified receipts are explicit fixtures.
 * No hosted database, wallet provider or blockchain transaction is used.
 */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {createFlightStorage} from '../flight-storage.mjs';
import {DIRECT_CONTINUE as P,commitment} from '../continue-product.mjs';
import {postgresDirectRepository} from '../direct-continue-repository.mjs';
import {createDirectContinueService} from '../direct-continue-service.mjs';
import {createPaidDelivery,withPaidDelivery} from '../paid-delivery.mjs';
const require=createRequire(process.env.PAID_TEST_PACKAGE),{Pool}=require('pg'),{chromium}=require('playwright');
const gameRoot=resolve(process.env.PAID_GAME_ROOT),gameRequire=createRequire(resolve(gameRoot,'package.json'));
const {createServer}=await import(pathToFileURL(gameRequire.resolve('vite')));
assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'paid_delivery_ci');
const pool=new Pool({max:8}),settings={authOrigin:'https://account-browser-ci.example',environment:'release-candidate'};
const storage=createFlightStorage(pool,settings);
const scoped={async query(sql,params){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE tree_continue_delivery');const r=await db.query(sql,params);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}};
const delivery=createPaidDelivery(scoped,settings);
const vite=await createServer({root:gameRoot,configFile:resolve(gameRoot,'vite.config.ts'),server:{host:'127.0.0.1',port:4173,strictPort:true}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await mkdir('paid-evidence',{recursive:true});
const errors=[],reports=[];let browserPurchaseCalls=0,activations=0;
const key=()=>randomBytes(32).toString('hex');
const makeActor=()=>({authenticated:true,identityMappingReviewed:true,...settings,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+key()}});
function serviceFor(actor){
 const config={paymentsEnabled:true,deployment:{network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),keyEpoch:'1'},metadata:{network:P.network,coinType:P.coinType,decimals:6}};
 const purchase=createDirectContinueService({repository:postgresDirectRepository(pool),resolveFlight:(a,r)=>storage.resolveValidatedFlight(a,r),loadConfiguration:async()=>config,
  authorizeQuote:async()=>({quoteBase64:'BROWSER-CI-FIXTURE',signatureBase64:'NOT-A-VALID-SIGNATURE'}),
  verifyPayment:async(t,digest)=>{const e={source:'chain-reader',status:'success',finalized:true,digest,eventIndex:'0',amountRaw:t.requiredRaw,...Object.fromEntries(['orderId','accountId','payer','recipient','coinType','quoteHash','checkoutId','keyEpoch','network'].map(k=>[k,t[k]]))};e.evidenceHash=commitment(e);return e;}});
 return{config,service:withPaidDelivery(purchase,delivery)};
}
async function pageFor(actor,service,{wave=0,lostActivation=false}={}){
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();let lost=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());let status=200,body;
  try{
   if(url.pathname==='/api/tree-account')body={status:'ok',configured:true,identity:{...actor,environment:'preview',expiresAt:Date.now()+1800000}};
   else{
    const c=request.postDataJSON();
    if(url.pathname==='/api/tree-flight'){
     let result;
     if(c.action==='save'){await storage.register(actor,c.runId);result=await storage.save(actor,c.runId,c.requestId,c.snapshot);}
     else if(c.action==='list')result={flights:[]};
     else if(c.action==='recover')result=await storage.recover(actor,c.runId);
     else throw Error('Unexpected storage action');
     body={accountId:actor.accountId,paymentsEnabled:false,restoreAuthorized:false,result};
    }else if(url.pathname==='/api/tree-continue'){
     if(!['delivery_status','prepare_delivery','activate_delivery'].includes(c.action)){browserPurchaseCalls++;throw Error('Browser attempted purchase');}
     body=await service(actor,c);
     if(c.action==='activate_delivery'){
      activations++;if(lostActivation&&!lost){lost=true;await route.abort('failed');return;}
     }
    }else throw Error('Unexpected API path');
   }
  }catch(e){status=409;body={error:e.code==='P0001'?e.message:e.code||e.message,requiresPayment:false};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto(`http://127.0.0.1:4173/?recoveryTest=1${wave?'&wave='+wave:''}`);
 await page.waitForFunction(()=>window.__treeRecoveryTestGame?.scene.isActive('title'),{},{timeout:25000});
 await page.waitForFunction(()=>window.__treeRecoveryTestGame.registry.get('treeAccountIdentity')?.authenticated);
 return{page,context};
}
async function saveRealFlight(actor,service,wave){
 const {page,context}=await pageFor(actor,service,{wave});await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').enemies?.countActive()>0,{},{timeout:12000});
 if(wave===10)await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').enemies.getChildren().some(e=>e.kind==='boss'&&e.settled),{},{timeout:12000});
 await page.evaluate(w=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');s.run.score=17000+w;s.stage=0;s.grafted=false;s.invincible=false;s.cloakUntil=0;s.invulnUntil=0;s.lives=1;if(w===10)s.enemies.getChildren().find(e=>e.kind==='boss').hp=59;s.damagePlayer();},wave);
 await page.waitForFunction(()=>document.querySelector('.flight-recovery-box button')?.textContent==='SAVED — SAFE TO RELOAD FOR TEST',{},{timeout:12000});
 const {rows}=await pool.query('SELECT checkpoint_id,run_id,checkpoint_hash,snapshot_text FROM tree_continue_v1.checkpoints WHERE account_id=$1',[actor.accountId]);assert.equal(rows.length,1);
 await context.close();return rows[0];
}
async function seedVerified(actor,setup,saved){
 await pool.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','browser-fixture-not-anticheat',$2)",[saved.checkpoint_id,key()]);
 const order=(await setup.service(actor,{action:'order',runId:saved.run_id,requestId:randomUUID()})).order;
 await setup.service(actor,{action:'reconcile',runId:saved.run_id,requestId:randomUUID(),orderId:order.orderId,digest:key().replace(/0/g,'G').slice(0,43)});
 setup.config.paymentsEnabled=false;return order;
}
async function install(page,runId,orderId,hold=false){
 await page.evaluate(async({runId,orderId,hold})=>{
  const {createPaidFlightSceneLoader}=await import('/app/game/paid-flight-scene.mjs');
  const {createPaidFlightDelivery}=await import('/app/game/paid-flight-delivery.mjs');
  const game=window.__treeRecoveryTestGame,loader=createPaidFlightSceneLoader(game);
  const gate=hold?new Promise(resolve=>{window.releasePrepared=resolve;}):Promise.resolve();
  window.receiptDelivery=createPaidFlightDelivery({runId,expectedOrderId:orderId,identity:()=>game.registry.get('treeAccountIdentity'),
   api:async command=>{const r=await fetch('/api/tree-continue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});const body=await r.json();if(!r.ok)throw Object.assign(Error(body.error),{code:body.error});return body;},
   loadPaused:async(s,b)=>{const port=await loader.loadPaused(s,b);window.receiptScenePrepared=true;await gate;return port;}});
 },{runId,orderId,hold});
}
async function resume(page){return page.evaluate(()=>window.receiptDelivery.resume().then(ok=>({ok})).catch(e=>({error:e.code||e.message})));}
async function checkGame(page,wave){
 await page.waitForFunction(()=>{const g=window.__treeRecoveryTestGame,s=g.scene.getScene('game');return g.scene.isActive('game')&&s.lives===3&&!s.paused&&!s.physics.world.isPaused&&s.input.enabled&&s.input.keyboard.enabled&&s.input.keyboard.keys[65];},{},{timeout:10000});
 const state=await page.evaluate(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return{wave:s.run.wave+1,score:s.run.score,lives:s.lives,bossHp:s.enemies.getChildren().find(e=>e.kind==='boss')?.hp,shots:s.run.shotsFired,continued:s.run.continued};});
 assert.equal(state.wave,wave);assert.equal(state.score,17000+wave);assert.equal(state.lives,3);assert.equal(state.continued,true);if(wave===10)assert.equal(state.bossHp,59);
 await page.keyboard.down('a');try{await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').player.x<230,{},{timeout:5000});}finally{await page.keyboard.up('a');}
 await page.keyboard.down('z');try{await page.waitForFunction(before=>window.__treeRecoveryTestGame.scene.getScene('game').run.shotsFired>before,state.shots,{timeout:5000});}finally{await page.keyboard.up('z');}
}
try{
 for(const scenario of [{name:'wave3-reopen',wave:3},{name:'boss-reopen',wave:10},{name:'lost-activation-reply',wave:3,lost:true},{name:'two-page-race',wave:10,race:true}]){
  const actor=makeActor(),setup=serviceFor(actor),saved=await saveRealFlight(actor,setup.service,scenario.wave),order=await seedVerified(actor,setup,saved);
  const a=await pageFor(actor,setup.service,{lostActivation:scenario.lost});await install(a.page,saved.run_id,order.orderId,scenario.race);
  if(scenario.race){
   const first=resume(a.page);await a.page.waitForFunction(()=>window.receiptScenePrepared===true);
   const b=await pageFor(actor,setup.service);await install(b.page,saved.run_id,order.orderId);assert.equal((await resume(b.page)).error,'delivery-in-use');
   assert.equal(await b.page.evaluate(()=>window.__treeRecoveryTestGame.scene.isActive('game')),false);await b.context.close();
   await a.page.evaluate(()=>window.releasePrepared());assert.equal((await first).ok,true);
  }else{
   const result=await resume(a.page);
   if(scenario.lost){assert.ok(result.error);assert.equal(await a.page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').lives),0);assert.equal((await resume(a.page)).ok,true);}
   else assert.equal(result.ok,true,JSON.stringify(result));
  }
  await checkGame(a.page,scenario.wave);await a.page.screenshot({path:`paid-evidence/${scenario.name}.png`,fullPage:true});await a.context.close();
  // A fresh page must not replay the consumed grant, even with the same wallet.
  const fresh=await pageFor(actor,setup.service);await install(fresh.page,saved.run_id,order.orderId);assert.equal((await resume(fresh.page)).error,'delivery-review-required');await fresh.context.close();
  const consumed=(await pool.query("SELECT count(*)::int n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'",[order.orderId])).rows[0].n;assert.equal(consumed,1);
  reports.push({scenario:scenario.name,wave:scenario.wave,savedBrowserClosed:true,lives:3,correctScore:true,movement:true,shooting:true,consumptions:1,replayedPageBlocked:true});
  console.log('PAID_GAME_SCENARIO',JSON.stringify(reports.at(-1)));
 }
 assert.deepEqual(errors,[]);assert.equal(browserPurchaseCalls,0);
 console.log('PAID_GAME_RESULT',JSON.stringify({passed:reports.length,realPhaser:true,realPostgres:true,sourceServedByVite:true,authentication:'fixture',paymentEvidence:'fixture',checkpointReview:'fixture',browserPurchaseCalls,activations,pageErrors:errors.length,reports}));
}finally{await browser.close();await vite.close();await pool.end();}
