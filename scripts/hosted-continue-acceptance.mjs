/** Real hosted read-only acceptance. Ephemeral unfunded key signs only the
 * server-issued personal-message challenge. Never builds/signs a transaction.
 * No session, signature, key or cookie is logged or included in artifacts.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
if(process.env.HOSTED_CONTINUE_ACCEPTANCE!=='READ_ONLY_NO_PAYMENTS')throw Error('explicit-readonly-mode-required');
const require=createRequire(process.env.PAID_TEST_PACKAGE),{chromium}=require('playwright');
const gameRequire=createRequire(resolve(process.env.PAID_GAME_ROOT,'app/game/tree-payments/package.json'));
const {Ed25519Keypair}=await import(pathToFileURL(gameRequire.resolve('@mysten/sui/keypairs/ed25519')));
const origin='https://deploy-preview-3--treeforce89.netlify.app';
const keypair=new Ed25519Keypair(),address=keypair.toSuiAddress();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage(),checks=[];let stage='preflight',loggedIn=false,chain=null;
const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,300)));
await mkdir('hosted-evidence',{recursive:true});
function passed(name){checks.push(name);console.log('HOSTED_CHECK',name);}
async function post(path,data,extra={}){
 const r=await context.request.post(origin+path,{data,headers:{Origin:origin,...extra},timeout:30000,maxRedirects:0});
 let body;try{body=await r.json();}catch{throw Error('non-json-hosted-response');}
 assert.ok(!Object.hasOwn(body,'accessToken')&&!Object.hasOwn(body,'token'),'no-browser-token');
 return {status:r.status(),body};
}
try{
 const pre=await context.request.get(origin+'/api/tree-continue',{timeout:20000});
 assert.equal(pre.status(),200);assert.equal((await pre.json()).mode,'hosted-checkout-disabled');passed('correct-hosted-readonly-gate');
 stage='guest';assert.equal((await post('/api/tree-continue',{action:'list_purchases'})).status,401);passed('guest-denied');
 stage='personal-message-sign-in';
 const challenge=await post('/api/tree-account-inline',{action:'challenge',family:'sui',address,chainId:'sui:mainnet'});
 assert.equal(challenge.status,200,'challenge status');assert.equal(typeof challenge.body.message,'string');
 assert.ok(challenge.body.message.includes(address));
 const signed=await keypair.signPersonalMessage(new TextEncoder().encode(challenge.body.message));
 const login=await post('/api/tree-account-inline',{action:'verify',signature:signed.signature});
 assert.equal(login.status,200,'verify status');assert.equal(login.body.identity?.authenticated,true);assert.equal(login.body.identity.wallet.address,address);loggedIn=true;
 const savedSession=(await context.cookies(origin)).find(c=>c.name==='__Host-tree-game-session');
 assert.ok(savedSession?.httpOnly&&savedSession?.secure);passed('real-personal-message-sign-in-and-httponly-session');
 stage='mainnet-probe';const status=await post('/api/tree-continue',{action:'status'});
 assert.equal(status.status,200,'hosted status');assert.equal(status.body.enabled,false);assert.equal(status.body.checkoutConfigured,false);
 chain=status.body.chain;assert.equal(chain?.ready,true,'live chain probe');assert.equal(chain.network,'sui:mainnet');assert.equal(chain.chainIdentifier,'35834a8a');assert.equal(chain.decimals,6);assert.equal(chain.paymentAmountRaw,'20000000000');assert.equal(chain.receiptVerificationConfigured,false);passed('real-hosted-mainnet-network-and-tree-metadata');
 stage='database-lookup';const list=await post('/api/tree-continue',{action:'list_purchases'});
 assert.equal(list.status,200);assert.equal(list.body.accountId,login.body.identity.accountId);assert.deepEqual(list.body.purchases,[]);passed('real-account-scoped-empty-purchase-lookup');
 const missing=await post('/api/tree-continue',{action:'recover_purchase',runId:randomUUID()});assert.equal(missing.status,200);assert.equal(missing.body.status,'not-found');assert.equal(missing.body.authorization,null);passed('missing-order-not-a-payment');
 stage='monetary-boundaries';for(const action of ['order','reconcile','prepare_delivery','activate_delivery']){
  const r=await post('/api/tree-continue',{action,runId:randomUUID()});assert.equal(r.status,503);assert.equal(r.body.error,'checkout-not-enabled');
 }passed('order-and-delivery-mutations-disabled');
 assert.equal((await post('/api/tree-continue',{action:'list_purchases',payer:address})).status,400);
 assert.equal((await post('/api/tree-continue',{action:'list_purchases'},{Origin:'https://foreign.example'})).status,403);passed('identity-injection-and-foreign-origin-denied');
 stage='hosted-browser-ui';await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('button',{name:'SIGN OUT',exact:true}).waitFor({timeout:30000});
 const entry=page.locator('.game-frame > .tree-purchase-recovery');
 const dialog=page.getByRole('dialog',{name:'Recover TREE purchase',exact:true});
 for(const viewport of [{width:390,height:844},{width:320,height:640},{width:1200,height:1000}]){
  await page.setViewportSize(viewport);await entry.scrollIntoViewIfNeeded();
  const aboveCanvas=await entry.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector('.screen-bezel').getBoundingClientRect();return a.bottom<=b.top+1&&a.width<=innerWidth;});
  assert.equal(aboveCanvas,true,'recovery entry above canvas without horizontal overflow');
  await page.screenshot({path:`hosted-evidence/recovery-entry-${viewport.width}.png`,fullPage:true});
  // Normal pointer interaction: never force a click or remove the preview toolbar.
  await entry.click({timeout:30000});
  await dialog.getByText('No purchases were found for this signed-in account.',{exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:`hosted-evidence/purchase-lookup-${viewport.width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'CLOSE',exact:true}).click();
 }
 passed('real-hosted-compiled-purchase-panel-at-three-widths');
 stage='revocation';const logout=await post('/api/tree-account',{action:'logout'});assert.equal(logout.status,200);loggedIn=false;
 const stale=await post('/api/tree-continue',{action:'list_purchases'},{Cookie:savedSession.name+'='+savedSession.value});assert.equal(stale.status,401);passed('revoked-session-cannot-query');
 assert.equal(errors.length,0);passed('no-browser-page-errors');
 const result={checkedAt:new Date().toISOString(),passed:checks.length,checks,gameOrigin:origin,chain,realHostedServices:true,authentication:'real-personal-message-unfunded-ephemeral-key',installedWallet:false,transactionsSigned:0,purchasesCreated:0,paidReceiptsSeeded:0,paidContinuesActivated:0,gameplayRecoveryNotRetested:true,viewportWidths:[390,320,1200]};
 await writeFile('hosted-evidence/results.json',JSON.stringify(result,null,2));console.log('HOSTED_READONLY_RESULT',JSON.stringify(result));
}catch(e){await page.screenshot({path:'hosted-evidence/diagnostic.png',fullPage:true}).catch(()=>{});const buttons=await page.locator('button').allTextContents().catch(()=>[]);await writeFile('hosted-evidence/failure.json',JSON.stringify({stage,checks,chain,error:String(e.message).slice(0,400),errors,buttons}));console.error('HOSTED_ACCEPTANCE_FAILED_STAGE',stage);throw Error('Hosted read-only acceptance failed at '+stage);}
finally{if(loggedIn)await post('/api/tree-account',{action:'logout'}).catch(()=>{});await browser.close();}
