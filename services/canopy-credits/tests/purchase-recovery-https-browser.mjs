/** Real HTTPS BFF -> gateway -> session HTTP and real PostgreSQL; compiled dist
 * UI and real Phaser. Authentication and normalized chain data are explicit
 * local fixtures. No wallet, real receipt, hosted write or transaction is used.
 */
import assert from 'node:assert/strict';import {createServer} from 'node:https';
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {randomUUID,randomBytes} from 'node:crypto';
import {createFlightStorage} from '../flight-storage.mjs';import {DIRECT_CONTINUE as P} from '../continue-product.mjs';
import {postgresDirectRepository} from '../direct-continue-repository.mjs';import {createDirectContinueService} from '../direct-continue-service.mjs';import {createPaidDelivery,withPaidDelivery} from '../paid-delivery.mjs';
import {withPurchaseRecovery} from '../purchase-recovery.mjs';import {createReceiptDiscovery} from '../receipt-discovery.mjs';import {directContinueVerifier} from '../direct-continue-verifier.mjs';import {createContinueGateway} from '../continue-gateway.mjs';
const require=createRequire(process.env.PAID_TEST_PACKAGE),{Pool}=require('pg'),{chromium}=require('playwright');
assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'paid_delivery_ci');
const gameRoot=resolve(process.env.PAID_GAME_ROOT),{createContinueProxy}=await import(pathToFileURL(resolve(gameRoot,'netlify/lib/tree-continue-proxy.mjs')));
const GAME='https://127.0.0.1:4173',GATE='https://127.0.0.1:4174',AUTH='https://127.0.0.1:4175';
const tls={key:await readFile(process.env.TEST_TLS_KEY),cert:await readFile(process.env.TEST_TLS_CERT)};
const settings={authOrigin:AUTH,environment:'release-candidate'},pool=new Pool({max:12}),key=()=>randomBytes(32).toString('hex');
function role(name){return{async query(sql,params){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE '+name);const r=await db.query(sql,params);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}};}
const storage=createFlightStorage(pool,settings),delivery=createPaidDelivery(role('tree_continue_delivery'),settings),lookup=role('tree_continue_recovery');
const accounts=new Map(),sessions=new Map(),chain=new Map();let sessionChecks=0,indexReads=0,browserPayments=0,activationCalls=0;
const verify=directContinueVerifier({async getNetworkIdentity(){return{network:P.network,chainIdentifier:P.chainIdentifier};},async getFinalizedTransaction(d){const tx=chain.get(d);if(!tx)throw Error('fixture-chain-miss');return tx;}});
const discovery=createReceiptDiscovery({endpoint:AUTH+'/graphql',verify});
const gateway=createContinueGateway({authOrigin:AUTH,gameOrigin:GAME,service:(actor,command)=>accounts.get(actor.accountId).service(actor,command)});
const proxy=createContinueProxy({gameOrigin:GAME,serviceUrl:GATE+'/continue'});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
async function bytes(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>300000)throw Error('fixture-request-too-large');chunks.push(c);}return Buffer.concat(chunks);}
async function send(res,response){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
const accountView=f=>({authenticated:true,accountId:f.actor.accountId,wallet:f.actor.wallet,environment:'preview',expiresAt:Date.now()+1800000});
const authServer=createServer(tls,async(req,res)=>{try{
 const body=JSON.parse((await bytes(req)).toString());
 if(req.url==='/graphql'){
  indexReads++;assert.equal(body.variables.type,'0x'+'3'.repeat(64)+'::checkout::Purchase');
  const nodes=[...chain.values()].filter(t=>t.sender===body.variables.payer).map(t=>({transaction:{digest:t.digest}}));
  return send(res,Response.json({data:{chainIdentifier:P.chainIdentifier,events:{nodes,pageInfo:{hasPreviousPage:false,startCursor:null}}}}));
 }
 sessionChecks++;const f=sessions.get(body.token);return send(res,f&&body.action==='game-session'?Response.json({status:'ok',identity:accountView(f)}):Response.json({error:'invalid-session'},{status:401}));
}catch{res.writeHead(500);res.end();}});
const gatewayServer=createServer(tls,async(req,res)=>{try{await send(res,await gateway(new Request(GATE+req.url,{method:req.method,headers:req.headers,body:await bytes(req)})));}catch{res.writeHead(500);res.end();}});
const gameServer=createServer(tls,async(req,res)=>{try{
 const url=new URL(req.url,GAME),token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-tree-game-session='))?.split('=')[1],f=sessions.get(token);
 if(url.pathname==='/api/tree-account')return send(res,Response.json({status:'ok',configured:true,identity:f?accountView(f):null}));
 if(url.pathname==='/api/tree-continue'){
  const raw=await bytes(req),c=JSON.parse(raw.toString());if(['order','pay','deliver'].includes(c.action))browserPayments++;
  const response=await proxy(new Request(GAME+req.url,{method:req.method,headers:req.headers,body:raw}));
  if(c.action==='activate_delivery'){
   activationCalls++;f?.activationRequests.push({requestId:c.requestId,leaseId:c.leaseId,checkpointHash:c.checkpointHash});
   if(f?.loseActivation&&!f.lost&&response.ok){
    // The server committed activation, but its acknowledgement is unavailable.
    // An explicit gateway 503 avoids browser-dependent transparent socket retries.
    f.lost=true;return send(res,Response.json({error:'delivery-unavailable',requiresPayment:false},{status:503}));
   }
  }
  return send(res,response);
 }
 if(url.pathname==='/api/tree-flight'){
  if(!f)return send(res,Response.json({error:'sign-in-required'},{status:401}));const c=JSON.parse((await bytes(req)).toString());let result;
  if(c.action==='save'){await storage.register(f.actor,c.runId);result=await storage.save(f.actor,c.runId,c.requestId,c.snapshot);}
  else if(c.action==='list')result={flights:[]};else if(c.action==='recover')result=await storage.recover(f.actor,c.runId);else throw Error('fixture-storage-command');
  return send(res,Response.json({accountId:f.actor.accountId,result,paymentsEnabled:false,restoreAuthorized:false}));
 }
 const root=resolve(gameRoot,'dist'),path=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!path.startsWith(root+'/'))throw Error('invalid-static-path');const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(500);res.end('CI service error');}});
for(const [server,port] of [[authServer,4175],[gatewayServer,4174],[gameServer,4173]])await new Promise(r=>server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],reports=[];await mkdir('integration-evidence',{recursive:true});
function fixture(){
 const actor={authenticated:true,identityMappingReviewed:true,...settings,accountId:randomUUID(),wallet:{family:'sui',address:'0x'+key()}},token=key();
 const config={paymentsEnabled:true,deployment:{network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),keyEpoch:'1'},metadata:{network:P.network,coinType:P.coinType,decimals:6}};
 const purchases=withPaidDelivery(createDirectContinueService({repository:postgresDirectRepository(pool),resolveFlight:(a,r)=>storage.resolveValidatedFlight(a,r),loadConfiguration:async()=>config,authorizeQuote:async()=>({quoteBase64:'UNSIGNED-CI-ONLY',signatureBase64:'NOT-A-PAYABLE-QUOTE'}),verifyPayment:verify}),delivery);
 const f={actor,token,config,activationRequests:[],service:withPurchaseRecovery(purchases,{db:lookup,discover:discovery,...settings})};accounts.set(actor.accountId,f);sessions.set(token,f);return f;
}
async function pageFor(f,wave=0){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
 await context.addCookies([{name:'__Host-tree-game-session',value:f.token,url:GAME,secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(GAME+'/?recoveryTest=1'+(wave?'&wave='+wave:''));await page.waitForFunction(()=>window.__treeRecoveryTestGame?.scene.isActive('title'),{},{timeout:25000});await page.waitForFunction(()=>window.__treeRecoveryTestGame.registry.get('treeAccountIdentity')?.authenticated);
 assert.equal((await page.evaluate(()=>document.cookie)).includes(f.token),false);return{context,page};
}
async function exhausted(f,wave=3){
 const p=await pageFor(f,wave);await p.page.keyboard.press('Enter');await p.page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').enemies?.countActive()>0,{},{timeout:15000});
 if(wave===10)await p.page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').enemies.getChildren().some(e=>e.kind==='boss'&&e.settled),{},{timeout:12000});
 await p.page.evaluate(w=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');s.run.score=17000+w;s.updateHud();s.stage=0;s.grafted=false;s.invincible=false;s.cloakUntil=0;s.invulnUntil=0;s.lives=1;if(w===10)s.enemies.getChildren().find(e=>e.kind==='boss').hp=59;s.damagePlayer();},wave);
 await p.page.waitForFunction(()=>document.querySelector('.flight-recovery-box button')?.textContent==='SAVED — SAFE TO RELOAD FOR TEST',{},{timeout:12000});
 const saved=(await pool.query('SELECT checkpoint_id,run_id,checkpoint_hash,snapshot_text FROM tree_continue_v1.checkpoints WHERE account_id=$1',[f.actor.accountId])).rows[0];return{...p,saved};
}
async function seed(f,saved){
 await pool.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','explicit-https-ci-fixture',$2)",[saved.checkpoint_id,key()]);
 const order=(await f.service(f.actor,{action:'order',runId:saved.run_id,requestId:randomUUID()})).order,t=order.terms,digest=key().replace(/0/g,'G').slice(0,43),stamp=t.issuedAtMs+1;
 chain.set(digest,{digest,status:'success',finalized:true,simulated:false,checkpoint:'9001',timestampMs:stamp,sender:t.payer,events:[{type:t.eventType,packageId:t.checkoutPackage,index:'0',fields:{...Object.fromEntries(['orderId','accountId','payer','recipient','coinType','quoteHash','checkoutId','keyEpoch'].map(k=>[k,t[k]])),amountRaw:t.requiredRaw,issuedAtMs:String(t.issuedAtMs),expiresAtMs:String(t.expiresAtMs),paidAtMs:String(stamp)}}],balanceChanges:[{owner:t.payer,coinType:P.coinType,amount:'-'+t.requiredRaw},{owner:t.recipient,coinType:P.coinType,amount:t.requiredRaw}]});
 f.config.paymentsEnabled=false;return order;
}
async function gameplay(page,wave){
 await page.waitForFunction(()=>{const g=window.__treeRecoveryTestGame,s=g.scene.getScene('game');return g.scene.isActive('game')&&s.lives===3&&!s.paused&&!s.physics.world.isPaused&&s.input.enabled&&s.input.keyboard.enabled;},{},{timeout:15000});
 const s=await page.evaluate(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return{wave:s.run.wave+1,score:s.run.score,awards:s.extraLivesAwarded,boss:s.enemies.getChildren().find(e=>e.kind==='boss')?.hp,shots:s.run.shotsFired};});
 assert.equal(s.wave,wave);assert.equal(s.score,17000+wave);assert.equal(s.awards,1);if(wave===10)assert.equal(s.boss,59);
 await page.keyboard.down('a');try{await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').player.x<230,{},{timeout:4000});}finally{await page.keyboard.up('a');}
 await page.keyboard.down('z');try{await page.waitForFunction(n=>window.__treeRecoveryTestGame.scene.getScene('game').run.shotsFired>n,s.shots,{timeout:4000});}finally{await page.keyboard.up('z');}
}
try{
 for(const spec of [{name:'default-continue-button',wave:3,direct:true},{name:'reopen-no-local-marker',wave:10},{name:'lost-activation-default-ui',wave:3,lost:true}]){
  const f=fixture(),start=await exhausted(f,spec.wave),order=await seed(f,start.saved);let p=start;
  if(!spec.direct){await start.context.close();p=await pageFor(f);await p.page.evaluate(()=>localStorage.clear());}
  f.loseActivation=!!spec.lost;
  if(spec.direct)await p.page.getByRole('button',{name:'CONTINUE — 20,000 TREE',exact:true}).click();
  else{
   await p.page.getByRole('button',{name:'RECOVER TREE PURCHASE',exact:true}).click();
   await p.page.getByRole('button',{name:new RegExp('CHECK WAVE '+spec.wave+' ·')}).click();
   if(spec.lost){
    await p.page.waitForFunction(()=>Array.from(document.querySelectorAll('[role="status"]')).some(e=>e.textContent.includes('could not be confirmed')),{},{timeout:25000}).catch(async e=>{throw Error(e.message+' '+await p.page.locator('body').innerText());});
    assert.equal(f.lost,true);assert.equal(await p.page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').lives),0);
    const committed=(await pool.query("SELECT count(*)::int n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'",[order.orderId])).rows[0].n;assert.equal(committed,1);
    await p.page.screenshot({path:'integration-evidence/lost-activation-before-retry.png',fullPage:true});
    await p.page.getByRole('button',{name:new RegExp('CHECK WAVE '+spec.wave+' ·')}).click();
   }
  }
  await gameplay(p.page,spec.wave);
  if(spec.lost){assert.equal(f.activationRequests.length,2);assert.deepEqual(f.activationRequests[0],f.activationRequests[1]);}
  await p.page.screenshot({path:'integration-evidence/'+spec.name+'.png',fullPage:true});await p.context.close();
  const r=(await pool.query("SELECT (SELECT count(*)::int FROM tree_continue_v1.receipts WHERE order_id=$1) receipts,(SELECT count(*)::int FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered') consumed",[order.orderId])).rows[0];assert.deepEqual(r,{receipts:1,consumed:1});
  const fresh=await pageFor(f);await fresh.page.getByRole('button',{name:'RECOVER TREE PURCHASE',exact:true}).click();await fresh.page.getByRole('button',{name:new RegExp('CHECK WAVE '+spec.wave+' ·')}).click();
  await fresh.page.getByText('This continue has an activation record and needs review. Do not pay again. Keep the order and flight details below.',{exact:true}).waitFor();assert.equal(await fresh.page.evaluate(()=>window.__treeRecoveryTestGame.scene.isActive('game')),false);
  await fresh.page.screenshot({path:'integration-evidence/'+spec.name+'-review.png',fullPage:true});await fresh.context.close();
  reports.push({scenario:spec.name,compiledDefaultUI:true,httpsBffGateway:true,noBrowserDigest:true,receipts:1,consumptions:1,lives:3,movement:true,shooting:true,freshPageReview:true});console.log('DEFAULT_UI_SCENARIO',JSON.stringify(reports.at(-1)));
 }
 const f=fixture(),free=await exhausted(f);f.config.paymentsEnabled=false;
 await free.page.getByRole('button',{name:'CONTINUE — 20,000 TREE',exact:true}).click();await free.page.getByText('TREE checkout is not live yet. No payment was requested. You can start a new game for free.',{exact:true}).waitFor();
 const exhaustedDialog=free.page.getByRole('dialog',{name:'OUT OF LIVES',exact:true});
 await exhaustedDialog.getByRole('button',{name:'RECOVER TREE PURCHASE',exact:true}).click();
 const panel=free.page.getByRole('dialog',{name:'Recover TREE purchase',exact:true});await panel.getByText('No purchases were found for this signed-in account.',{exact:true}).waitFor();await panel.getByRole('button',{name:'CLOSE',exact:true}).click();
 await exhaustedDialog.getByRole('button',{name:'START NEW GAME — FREE',exact:true}).click();await free.page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').lives===3);await free.context.close();
 assert.equal(browserPayments,0);assert.deepEqual(errors,[]);
 const result={passed:reports.length+1,compiledDist:true,realHttps:true,realPostgres:true,authentication:'fixture',chainEvidence:'fixture',checkpointReview:'fixture',installedWallet:false,browserPayments,sessionChecks,indexReads,activationCalls,pageErrors:0,reports};
 await writeFile('integration-evidence/results.json',JSON.stringify(result,null,2));console.log('DEFAULT_UI_HTTPS_RESULT',JSON.stringify(result));
}catch(e){
 for(const [index,context] of browser.contexts().entries())for(const [n,page]of context.pages().entries())await page.screenshot({path:`integration-evidence/failure-${index}-${n}.png`,fullPage:true}).catch(()=>{});
 throw e;
}finally{await browser.close();for(const server of [gameServer,gatewayServer,authServer])await new Promise(r=>server.close(r));await pool.end();}
