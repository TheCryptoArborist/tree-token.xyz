import fs from 'node:fs';import assert from 'node:assert/strict';
import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const base='https://tree-token.xyz/play/__recovery-test__/',checks=[];
try{
 const page=await browser.newPage();let external=0;
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url===base+'controls.mjs')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('scripts/multichain/browser/checkout-recovery-controls.mjs','utf8')});
  if(url===base)return route.fulfill({contentType:'text/html',body:`<main></main><script type="module">
 import {mountCheckoutRecoveryControls} from './controls.mjs';
 window.state={kind:'legacy',canPay:false};window.calls=0;window.recovered=0;window.fail=false;
 window.controls=mountCheckoutRecoveryControls({root:document.querySelector('main'),checkout:{pending:()=>state,reconcile:async input=>{calls++;window.input=input;await new Promise(r=>window.release=r);if(fail)throw Error('private detail');state={kind:'shared',canPay:false,hasDigest:true,canRecover:true};return {status:'recorded'};},archiveCompleted:async()=>{state={kind:'none',canPay:true};return {status:'archived'};},recoverPending:async()=>({status:'recovered',restoreAuthorized:false,requiresPayment:false})},onRecovered:()=>{recovered++;}});window.ready=true;
 </script>`});
  external++;return route.abort();
 });
 await page.goto(base);await page.waitForFunction(()=>window.ready);
 assert(await page.getByRole('button',{name:'Verify existing payment'}).isDisabled());assert(await page.getByRole('button',{name:'Recover paid run'}).isDisabled());checks.push('legacy pending checkout disables both shared recovery actions');
 await page.evaluate(()=>{state={kind:'shared',canPay:false,hasDigest:false,canRecover:false};controls.refresh();});
 await page.getByRole('textbox').fill('D'.repeat(44));await page.getByRole('button',{name:'Verify existing payment'}).click();
 assert(await page.getByRole('button',{name:'Verify existing payment'}).isDisabled());assert(await page.getByRole('textbox').isDisabled());assert.equal(await page.evaluate(()=>calls),1);checks.push('verification disables input and actions while request is pending');
 await page.evaluate(()=>{fail=true;release();});await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('could not finish'));
 assert(!(await page.getByRole('button',{name:'Verify existing payment'}).isDisabled()));assert.equal(await page.getByRole('textbox').inputValue(),'D'.repeat(44));checks.push('failed verification retains digest and enables manual retry without payment control');
 await page.evaluate(()=>{fail=false;});await page.getByRole('button',{name:'Verify existing payment'}).click();await page.evaluate(()=>release());
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Payment verified'));assert(await page.getByRole('textbox').isDisabled());assert(!(await page.getByRole('button',{name:'Recover paid run'}).isDisabled()));checks.push('verified payment enables recovery and locks the known digest');
 await page.getByRole('button',{name:'Recover paid run'}).click();await page.waitForFunction(()=>recovered===1);assert((await page.getByRole('status').textContent()).includes('separate review'));checks.push('recovery reports separate restoration review without signing or game activation');
 await page.getByRole('button',{name:'Check completion'}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Completed payment archived'));assert(await page.getByRole('button',{name:'Check completion'}).isDisabled());checks.push('completion control archives only through its service and then disables recovery actions');
 await page.evaluate(()=>controls.destroy());assert.equal(await page.locator('section').count(),0);assert.equal(external,0);checks.push('controls teardown cleanly and make no live requests');
 console.log(JSON.stringify({localOnly:true,browser:browser.version(),passed:checks.length,checks,services:'injected UI fixtures, no wallet or database'},null,2));
}finally{await browser.close();}
