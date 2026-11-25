import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
import {continueLinkMessage,CONTINUE_POLICY} from './sui-bnb-continue.mjs';
const context={sessionToken:'a'.repeat(64),suiWallet:'0x'+'b'.repeat(64),payer:'0x'+'c'.repeat(40),accountId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',sequence:1,chainId:56,network:'sui:mainnet',epoch:'first',expiresAt:1000000};
const row={...context,id:'d'.repeat(64),sessionHash:createHash('sha256').update(context.sessionToken).digest('hex'),deliveryProtocol:'tree-paid-delivery.v2',expiresAt:400000};
const challenge={id:row.id,message:continueLinkMessage(row),expiresAt:row.expiresAt,paymentEnabled:false,restoreAuthorized:false};
const quote={id:row.id,chainId:56,product:CONTINUE_POLICY.product,restoreLives:3,token:CONTINUE_POLICY.token,recipient:CONTINUE_POLICY.treasury,amount:CONTINUE_POLICY.amount,expiresAt:row.expiresAt,paymentEnabled:false,reviewOnly:true,restoreAuthorized:false,continueAuthorized:false,gameplayAuthorized:false};
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']}),checks=[];
const base='https://tree-token.xyz/play/__bnb-review-test__/';
try{
 const page=await browser.newPage();let external=0;await page.route('**/*',route=>{
  if(route.request().url()===base+'review.mjs')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('scripts/multichain/browser/bnb-checkout-review.mjs','utf8')});
  if(route.request().url()!==base){external++;return route.abort();}
  return route.fulfill({contentType:'text/html',body:`<main></main><script type="module">
 import {createBnbCheckoutReview,mountBnbCheckoutReview} from './review.mjs';
 window.ctx=${JSON.stringify(context)};window.challenge=${JSON.stringify(challenge)};window.quote=${JSON.stringify(quote)};window.calls=[];window.failSui=true;window.failOpen=false;
 window.review=createBnbCheckoutReview({getContext:()=>ctx,clock:()=>100000,transport:{'bnb-challenge':async()=>challenge,'bnb-open':async()=>{calls.push('open');if(failOpen)throw Error('secret');return quote;}},signSuiMessage:async()=>{calls.push('sui');await new Promise(r=>window.release=r);if(failSui)throw Error('secret');return 'YWJj';},signBnbMessage:async()=>{calls.push('bnb');return '0x'+'e'.repeat(130);}});
 window.controls=mountBnbCheckoutReview({root:document.querySelector('main'),review});window.ready=true;
 </script>`});
 });
 await page.goto(base);await page.waitForFunction(()=>window.ready);
 const button=name=>page.getByRole('button',{name,exact:true});
 const request=button('Review wallet-link message'),sui=button('Sign link in Sui wallet'),bnb=button('Sign link in BNB wallet'),verify=button('Verify link and review terms');
 assert(await sui.isDisabled());await request.click();await page.waitForFunction(()=>review.state().phase==='challenge');assert.equal(await page.locator('pre').textContent(),challenge.message);assert(await bnb.isDisabled());checks.push('exact server link is visible before either wallet signature');
 await sui.click();assert(await sui.isDisabled());assert(await request.isDisabled());await page.evaluate(()=>release());await page.waitForFunction(()=>!review.state().busy);assert(!(await sui.isDisabled()));assert.equal(await page.getByRole('status').textContent(),'Review could not finish. No payment was requested. Check your accounts and session before continuing.');checks.push('rejection unlocks explicit retry without leaking wallet errors or prompting BNB');
 await page.evaluate(()=>{failSui=false;});await sui.click();await page.evaluate(()=>release());await page.waitForFunction(()=>review.state().phase==='sui-signed');await bnb.click();await page.waitForFunction(()=>review.state().phase==='signed');await verify.click();await page.waitForFunction(()=>review.state().phase==='reviewed');assert((await page.getByRole('status').textContent()).includes('Payments remain disabled'));assert.equal(await page.locator('button').count(),4);checks.push('separate signature clicks lead to review-only terms with no payment button');
 await page.reload();await page.waitForFunction(()=>window.ready);await request.click();await page.waitForFunction(()=>review.state().phase==='challenge');await page.evaluate(()=>{failSui=false;});await sui.click();await page.evaluate(()=>{ctx.epoch='changed';release();});await page.waitForFunction(()=>!review.state().busy);assert(await bnb.isDisabled());assert.deepEqual(await page.evaluate(()=>calls),['sui']);checks.push('account epoch change during prompt prevents the next signature');
 await page.reload();await page.waitForFunction(()=>window.ready);await request.click();await page.waitForFunction(()=>review.state().phase==='challenge');await page.evaluate(()=>{failSui=false;failOpen=true;});await sui.click();await page.evaluate(()=>release());await page.waitForFunction(()=>review.state().phase==='sui-signed');await bnb.click();await page.waitForFunction(()=>review.state().phase==='signed');await verify.click();await page.waitForFunction(()=>review.state().phase==='uncertain');assert(await verify.isDisabled());assert(await request.isDisabled());checks.push('lost verification response disables repeat verification and new checkout');
 await page.evaluate(()=>controls.destroy());assert.equal(await page.locator('section').count(),0);assert.equal(external,0);checks.push('teardown removes controls; all requests intercepted with no wallet or chain calls');
 console.log(JSON.stringify({localOnly:true,browser:browser.version(),passed:checks.length,checks,evidence:'real DOM/controller; injected wallet and endpoint fixtures'},null,2));
}finally{await browser.close();}
