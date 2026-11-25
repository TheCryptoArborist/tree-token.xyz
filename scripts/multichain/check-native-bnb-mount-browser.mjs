import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
import {continueLinkMessage,CONTINUE_POLICY} from './sui-bnb-continue.mjs';
const context={sessionToken:'a'.repeat(64),suiWallet:'0x'+'b'.repeat(64),payer:'0x'+'c'.repeat(40),accountId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',sequence:1,chainId:56,network:'sui:mainnet',epoch:'first',expiresAt:1000000};
const row={...context,id:'d'.repeat(64),sessionHash:createHash('sha256').update(context.sessionToken).digest('hex'),deliveryProtocol:'tree-paid-delivery.v2',expiresAt:400000};
const challenge={id:row.id,message:continueLinkMessage(row),expiresAt:row.expiresAt,paymentEnabled:false,restoreAuthorized:false};
const quote={id:row.id,chainId:56,product:CONTINUE_POLICY.product,restoreLives:3,token:CONTINUE_POLICY.token,recipient:CONTINUE_POLICY.treasury,amount:CONTINUE_POLICY.amount,expiresAt:row.expiresAt,paymentEnabled:false,reviewOnly:true,restoreAuthorized:false,continueAuthorized:false,gameplayAuthorized:false};
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']}),checks=[];
const base='https://tree-token.xyz/play/__bnb-mount-test__/';
const modules=['native-bnb-review-mount.mjs','native-continue-transport.mjs','bnb-review-wallets.mjs','bnb-connected-review.mjs','bnb-checkout-review.mjs'];
try{
 const page=await browser.newPage();let external=0;
 await page.route('**/*',route=>{
  const name=route.request().url().slice(base.length);
  if(route.request().url().startsWith(base)&&modules.includes(name))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('scripts/multichain/browser/'+name,'utf8')});
  if(route.request().url()!==base){external++;return route.abort();}
  return route.fulfill({contentType:'text/html',body:`<main><p id="preserved">Existing checkout</p></main><script type="module">
 import {mountNativeBnbReview} from './native-bnb-review-mount.mjs';
 const ctx=${JSON.stringify(context)},challenge=${JSON.stringify(challenge)},quote=${JSON.stringify(quote)};
 window.session={sessionToken:ctx.sessionToken,nativeRunId:'grove-'+'a'.repeat(32),epoch:'first',expiresAt:ctx.expiresAt};window.listeners={};window.calls=[];window.requests=[];window.waitContext=false;window.waitSui=false;window.failContext=false;
 const account={address:ctx.suiWallet,chains:['sui:mainnet'],features:['sui:signPersonalMessage']};
 const wallet={accounts:[account],features:{'sui:signPersonalMessage':{signPersonalMessage:async input=>{calls.push('sui');if(waitSui)await new Promise(r=>window.releaseSui=r);return {signature:'YWJj'};}}}};
 const provider={on:(n,f)=>{listeners[n]=f;},removeListener:n=>{delete listeners[n];},request:async({method,params})=>{calls.push(method);if(method==='eth_accounts')return [ctx.payer];if(method==='eth_chainId')return '0x38';if(method==='personal_sign'){window.signed=params;return '0x'+'e'.repeat(130);}throw Error('forbidden wallet method');}};
 window.start=()=>{window.mount=mountNativeBnbReview({root:document.querySelector('main'),getSession:()=>session,getSui:()=>({wallet,account,network:'sui:mainnet'}),subscribeSui:fn=>{window.suiListener=fn;return()=>{window.suiListener=null;};},provider,origin:'https://tree-token.xyz',clock:()=>100000,fetch:async(url,options)=>{
 requests.push({url,options});if(!url.startsWith('https://tree-token.xyz/play/treeforce89/api/'))throw Error();
 if(url.endsWith('bnb-context')){if(waitContext)await new Promise(r=>window.releaseContext=r);if(failContext)throw Error('private provider details');return Response.json({...ctx,nativeRunId:session.nativeRunId,paymentEnabled:false,restoreAuthorized:false});}
 if(url.endsWith('bnb-challenge'))return Response.json(challenge);
 if(url.endsWith('bnb-open'))return Response.json(quote);
 throw Error('forbidden endpoint');
 }});return mount.ready;};window.ready=true;
 </script>`});
 });
 await page.goto(base);await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>start()),true);
 assert.equal(await page.locator('#preserved').textContent(),'Existing checkout');assert.equal(await page.locator('button').count(),4);checks.push('mount assembles real transport, context, wallet adapters and controls without replacing checkout');
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 await click('Review wallet-link message');await page.waitForFunction(()=>!document.querySelectorAll('button')[1].disabled);await click('Sign link in Sui wallet');await page.waitForFunction(()=>!document.querySelectorAll('button')[2].disabled);await click('Sign link in BNB wallet');await page.waitForFunction(()=>!document.querySelectorAll('button')[3].disabled);await click('Verify link and review terms');await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Review verified'));
 const requests=await page.evaluate(()=>requests);assert.deepEqual(requests.map(r=>r.url.split('/').pop()),['shared-continue-bnb-context','shared-continue-bnb-challenge','shared-continue-bnb-open']);assert(requests.every(r=>r.options.credentials==='omit'&&r.options.redirect==='error'&&r.options.headers.Authorization==='Bearer '+context.sessionToken));assert((await page.evaluate(()=>calls)).every(c=>['eth_accounts','eth_chainId','sui','personal_sign'].includes(c)));checks.push('assembled click flow uses canonical authenticated requests and only personal-message wallet methods');
 await page.evaluate(()=>mount.destroy());assert.equal(await page.locator('button').count(),0);assert.equal(await page.evaluate(()=>Object.keys(listeners).length),0);assert.equal(await page.evaluate(()=>suiListener),null);assert.equal(await page.locator('#preserved').count(),1);checks.push('teardown removes controls and subscriptions while preserving host checkout');
 await page.evaluate(()=>{waitContext=true;start();});await page.waitForFunction(()=>!!window.releaseContext);await page.evaluate(()=>{mount.destroy();releaseContext();});assert.equal(await page.evaluate(()=>mount.ready),false);assert.equal(await page.locator('button').count(),0);checks.push('teardown during context load prevents late mounting');
 await page.evaluate(()=>{waitContext=false;failContext=true;});assert.equal(await page.evaluate(()=>start()),false);assert((await page.getByRole('status').textContent()).includes('Review unavailable'));assert(!(await page.locator('main').textContent()).includes('private provider details'));assert.equal(await page.evaluate(()=>Object.keys(listeners).length),0);await page.evaluate(()=>mount.destroy());checks.push('failed context leaves safe status and cleans wallet listeners');
 await page.evaluate(()=>{failContext=false;waitSui=true;});assert.equal(await page.evaluate(()=>start()),true);await click('Review wallet-link message');await page.waitForFunction(()=>!document.querySelectorAll('button')[1].disabled);await click('Sign link in Sui wallet');await page.waitForFunction(()=>!!window.releaseSui);await page.evaluate(()=>{mount.destroy();releaseSui();});await page.waitForFunction(()=>Object.keys(listeners).length===0);assert.equal(await page.locator('button').count(),0);assert.equal(external,0);checks.push('leaving during wallet prompt never remounts or requests another wallet; no live requests');
 console.log(JSON.stringify({localOnly:true,passed:checks.length,checks,browser:browser.version(),evidence:'real assembled modules with injected wallet/provider/server responses; no extensions or chain calls'},null,2));
}finally{await browser.close();}
