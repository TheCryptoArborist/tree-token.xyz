// Canonical-origin browser simulation; no real wallet/session/chain operations.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const {chromium}=await import(pathToFileURL(path.resolve(process.argv[2])).href);
const out=process.argv[3]||'/tmp/bnb-generation-review-evidence';fs.mkdirSync(out,{recursive:true});
const A='0x'+'a1'.repeat(20),B='0x'+'b2'.repeat(20),SCOPE='eip155:56:treeforce89-test:v1',PATH='/play/generation-review/',ORIGIN='https://tree-token.xyz';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});
const results=[];
async function open(width,variant='deny',origin=ORIGIN){
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(({A})=>{const handlers={};window.mock={account:A,chain:'0x38',calls:[],change(event,value){if(event==='accountsChanged')this.account=value;if(event==='chainChanged')this.chain=value;for(const fn of handlers[event]||[])fn(event==='accountsChanged'?[value]:value);}};window.ethereum={on:(e,f)=>(handlers[e]??=[]).push(f),removeListener:(e,f)=>{handlers[e]=(handlers[e]||[]).filter(x=>x!==f);},request:async({method})=>{window.mock.calls.push(method);if(method==='eth_chainId')return window.mock.chain;if(['eth_accounts','eth_requestAccounts'].includes(method))return [window.mock.account];if(method==='personal_sign')return '0x'+'ab'.repeat(65);throw Error('Forbidden wallet method '+method);}};},{A});
 const page=await context.newPage(),errors=[],actions=[],reviews=[];let active=false,release,entered;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin===origin&&[PATH,PATH+'index.html'].includes(u.pathname))return route.fulfill({contentType:'text/html',body:fs.readFileSync('play/generation-review/index.html')});
  if(u.origin===origin&&u.pathname===PATH+'app.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('play/generation-review/app.js')});
  const reply=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(u.origin===ORIGIN&&u.pathname==='/api/arcade-bnb-test'){
   assert.equal(req.method(),'POST');const b=req.postDataJSON();actions.push(b.action);
   if(b.action==='challenge')return reply(200,{wallet:A,chainId:56,scope:SCOPE,message:'Login only\nChain ID: 56',nonce:'a'.repeat(64),gameplayAuthorized:false});
   if(b.action==='sign-in'){active=true;return reply(200,{wallet:A,chainId:56,scope:SCOPE,authenticated:true,gameplayAuthorized:false});}
   if(b.action==='logout'){active=false;return reply(200,{signedOut:true,gameplayAuthorized:false});}
   assert.equal(b.action,'status','No retired trial endpoint call permitted');
   if(!active)return reply(401,{error:'invalid-session',gameplayAuthorized:false});
   return reply(200,{wallet:variant==='mismatch'?B:A,chainId:56,scope:SCOPE,authenticated:true,gameplayAuthorized:false});
  }
  if(u.origin===ORIGIN&&u.pathname==='/api/arcade-bnb-test/run-review'){
   assert.equal(req.method(),'POST');assert.equal(u.search,'');assert.deepEqual(req.postDataJSON(),{action:'issue'});reviews.push(req.postDataJSON());
   if(variant==='late'){entered?.();await new Promise(r=>release=r);}
   if(variant==='network')return route.abort();
   if(variant==='malformed')return route.fulfill({status:200,contentType:'application/json',body:'not json'});
   const responses={expired:[401,{error:'invalid-session',gameplayAuthorized:false}],limited:[429,{error:'rate-limited',gameplayAuthorized:false}],outage:[503,{error:'service-unavailable',gameplayAuthorized:false}],ticket:[200,{ticket:'bnbrun_'+'a'.repeat(64),gameplayAuthorized:false}],forged:[200,{gameplayAuthorized:true}],deny:[403,{error:'review-denied',gameplayAuthorized:false}]};
   return reply(...(responses[variant]||responses.deny));
  }
  if(u.pathname==='/favicon.ico')return route.fulfill({status:204});
  errors.push('Unexpected request '+u.pathname);return route.abort();
 });
 await page.goto(origin+PATH);await page.locator('#connect').waitFor();
 const login=async()=>{await page.locator('#connect').click();await page.locator('#sign').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('sign-in verified'));assert.equal(await page.locator('#access').isEnabled(),true);};
 const close=async()=>{assert.deepEqual(errors,[]);const calls=await page.evaluate(()=>window.mock.calls);assert(calls.every(m=>['eth_chainId','eth_accounts','eth_requestAccounts','personal_sign'].includes(m)));assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);await context.close();};
 return {page,login,close,actions,reviews,hold:()=>new Promise(r=>entered=r),release:()=>release()};
}
try{
 for(const width of [320,390,1440]){
  const x=await open(width);assert.equal(await x.page.locator('#access').isDisabled(),true);await x.login();const calls=await x.page.evaluate(()=>window.mock.calls.length);await x.page.locator('#access').click();await x.page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Review denied.'));assert.equal(await x.page.evaluate(()=>window.mock.calls.length),calls);assert.equal(x.reviews.length,1);assert(await x.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await x.page.screenshot({path:out+'/denied-'+width+'.png',fullPage:true});await x.page.locator('#logout').click();await x.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('signed out'));assert.equal(await x.page.locator('#access').isDisabled(),true);assert(!(await x.page.locator('#result').textContent()).includes('Review denied'));await x.close();results.push('sign-in / deny / logout / layout '+width);
 }
 for(const [variant,text] of [['expired','sign-in is no longer valid'],['limited','Wait a minute'],['outage','Unable to confirm'],['ticket','Unable to confirm'],['forged','Unable to confirm'],['malformed','could not finish'],['network','could not finish']]){
  const x=await open(390,variant);await x.login();await x.page.locator('#access').click();await x.page.waitForFunction(t=>document.querySelector('#result').textContent.includes(t),text);assert(!(await x.page.locator('#result').textContent()).includes('bnbrun_'));if(variant==='expired')assert(await x.page.locator('#access').isDisabled());await x.close();results.push(variant+' denied without grant');
 }
 for(const event of ['accountsChanged','chainChanged','providerReplacement']){
  const x=await open(390,'late');await x.login();const pending=x.hold();await x.page.locator('#access').click();await pending;await x.page.evaluate(({event,B})=>{if(event==='providerReplacement'){window.ethereum={request:async()=>[]};}else window.mock.change(event,event==='accountsChanged'?B:'0x1');},{event,B});x.release();await x.page.waitForFunction(()=>!document.querySelector('#connect').disabled);assert((await x.page.locator('#result').textContent()).includes('Wallet or network changed'));assert(await x.page.locator('#access').isDisabled());await x.close();results.push('late result discarded after '+event);
 }
 {const x=await open(390,'mismatch');await x.login();await x.page.locator('#status-button').click();await x.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('A test session exists'));assert(await x.page.locator('#access').isDisabled());await x.close();results.push('wrong-wallet session blocked');}
 {const x=await open(390);await x.page.locator('#status-button').click();await x.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('No BNB test session'));assert(await x.page.locator('#access').isDisabled());await x.close();results.push('absent session blocked');}
 {const x=await open(390);await x.page.evaluate(()=>window.mock.chain='0x1');await x.page.locator('#connect').click();await x.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Select BNB Smart Chain'));assert.equal(x.actions.length,0);await x.close();results.push('wrong chain blocked before challenge');}
 {const x=await open(390,'deny','https://untrusted.invalid');assert.equal(await x.page.locator('button:enabled').count(),0);assert.equal(x.actions.length,0);await x.close();results.push('noncanonical origin cannot request wallet');}
 const files=['play/generation-review/index.html','play/generation-review/app.js'].map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
 const report={passed:results.length,scenarios:results,files,mode:'mocked wallet and API on canonical origin',liveWalletTest:false,deployed:false,gameplayAuthorized:false};fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
