// Actual reviewed page assets, mocked API and wallet. No service or chain writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {assertServedContent} from './rootcaster-served-content.mjs';

assert(process.argv[2],'Pass the installed Playwright module path.');
const modulePath=path.resolve(process.argv[2]);
const {chromium}=await import(pathToFileURL(modulePath).href);
const playwrightVersion=JSON.parse(fs.readFileSync(path.join(path.dirname(modulePath),'package.json'),'utf8')).version;
const sourceCommit=process.env.BNB_BACKING_SOURCE_COMMIT||process.env.REVIEWED_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceCommit);
const root=process.cwd(),pagePath='/play/multichaintest/game/bnb/',apiPath='/api/arcade-bnb-test';
const target=new URL(pagePath,process.argv[3]||'https://tree-token.xyz');
assert(['http:','https:'].includes(target.protocol)&&!target.username&&!target.password);
const liveAssets=Boolean(process.argv[3]),out=path.join(root,'.netlify');
fs.mkdirSync(out,{recursive:true});
const A='0x'+'a1'.repeat(20),B='0x'+'b2'.repeat(20),scope='eip155:56:treeforce89-test:v1';
const nftId='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const scenarios=[],screenshots=[];
const freshProof=()=>({schemaVersion:1,mode:'original-one-slot-diagnostic',inspectedWallet:A,
  checkedAt:new Date().toISOString(),gameplayAuthorized:false,productionReady:false,
  classification:'trial-retired',blockers:['production-backing-registry-not-approved','retired-one-slot-trial'],
  backing:{nftId,sourceCustodyConfirmed:false,lifecycle:'released'},
  bnb:{chainId:56,passState:'Retired',ownerMatches:false,canPlay:false,finality:'finalized',
    blockNumber:'123456',blockHash:'0x'+'ab'.repeat(32)},sui:{checkpoint:'234567'},
});
let browser;
async function open(width,{variant='retired'}={}){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(({A})=>{
    const handlers=new Map(),state={wallet:A,calls:[]};
    window.__backingMock={state,change(wallet){state.wallet=wallet;for(const fn of handlers.get('accountsChanged')||[])fn([wallet]);}};
    window.ethereum={
      on(event,fn){const list=handlers.get(event)||[];list.push(fn);handlers.set(event,list);},
      removeListener(event,fn){handlers.set(event,(handlers.get(event)||[]).filter(x=>x!==fn));},
      async request({method}){
        state.calls.push(method);
        if(method==='eth_chainId')return '0x38';
        if(method==='eth_accounts'||method==='eth_requestAccounts')return [state.wallet];
        if(method==='personal_sign')return '0x'+'12'.repeat(65);
        throw Error('Unexpected wallet request');
      },
    };
  },{A});
  const page=await context.newPage(),errors=[],unexpected=[],actions=[],modules=[];
  const state={active:false,variant,held:false,release:null,entered:null};
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(new URL(r.url()).pathname===pagePath+'app.js')modules.push(r);});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===target.origin&&url.pathname===apiPath){
      assert.equal(req.method(),'POST');
      const body=JSON.parse(req.postData());actions.push(body.action);
      const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',
        headers:{'cache-control':'no-store'},body:JSON.stringify({gameplayAuthorized:false,...data})});
      if(body.action==='challenge')return reply({chainId:56,wallet:A,scope,nonce:'ab'.repeat(32),message:'BNB-only login\nChain ID: 56'});
      if(body.action==='sign-in'){state.active=true;return reply({authenticated:true,wallet:A,chainId:56,scope});}
      if(body.action==='logout'){state.active=false;return reply({signedOut:true});}
      if(!state.active)return reply({error:'invalid-session'},401);
      if(body.action==='status')return reply({authenticated:true,wallet:A,chainId:56,scope});
      if(body.action==='entitlement'){
        if(state.held){state.entered();await new Promise(resolve=>{state.release=resolve;});}
        if(state.variant==='unavailable')return reply({error:'backing-check-unavailable'},503);
        if(state.variant==='unauthorized'){state.active=false;return reply({error:'invalid-session'},401);}
        const proof=freshProof();
        if(state.variant==='held'){
          proof.classification='trial-active-backed';proof.backing.lifecycle='held';proof.backing.sourceCustodyConfirmed=true;
          proof.bnb.passState='Active';proof.bnb.ownerMatches=true;proof.bnb.canPlay=true;
          proof.blockers=['production-backing-registry-not-approved'];
        }
        if(state.variant==='malformed')proof.gameplayAuthorized=true;
        if(state.variant==='stale')proof.checkedAt=new Date(Date.now()-120000).toISOString();
        if(state.variant==='wrongwallet')proof.inspectedWallet=B;
        return reply({reason:'production-backed-pass-not-enabled',backingCheck:proof},403);
      }
      throw Error('Unexpected API action');
    }
    if(url.origin===target.origin&&[pagePath,pagePath+'index.html',pagePath+'app.js'].includes(url.pathname)){
      if(liveAssets)return route.continue();
      const file=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
      return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,file))});
    }
    if(url.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
    unexpected.push(req.method()+' '+url.origin+url.pathname);return route.abort('blockedbyclient');
  });
  const response=await page.goto(target.href,{waitUntil:'load'});
  assert(response?.ok());
  assertServedContent('index.html',await response.body(),fs.readFileSync(path.join(root,pagePath,'index.html')));
  await page.locator('#connect').waitFor();
  assert.equal(modules.length,1);assert(modules[0].ok());
  assert.equal(sha(await modules[0].body()),sha(fs.readFileSync(path.join(root,pagePath,'app.js'))));
  await page.locator('#connect').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Connected.'));
  await page.locator('#sign').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('BNB sign-in verified.'));
  const done=async name=>{
    assert(await page.locator('#start-game').isDisabled(),'A diagnostic must never enable gameplay.');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow.');
    const methods=await page.evaluate(()=>window.__backingMock.state.calls);
    assert(methods.every(x=>['eth_chainId','eth_accounts','eth_requestAccounts','personal_sign'].includes(x)));
    assert.equal(methods.filter(x=>x==='personal_sign').length,1,'A backing read must not request another signature.');
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    scenarios.push({name,width,passed:true,apiActions:actions,walletMethods:methods});
    await context.close();
  };
  return{page,state,done};
}
const resultContains=(page,text)=>page.waitForFunction(value=>document.getElementById('result').textContent.includes(value),text);
try{
  browser=await chromium.launch({channel:'chromium',headless:true});
  for(const width of [1440,390,320]){
    const {page,done}=await open(width);
    await page.locator('#access').click();await resultContains(page,'The BNB trial pass is retired.');
    assert((await page.locator('#result').innerText()).includes('Original NFTree #2720 was released on Sui.'));
    if(width===1440||width===320){const file='bnb-backing-'+width+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});screenshots.push(file);}
    await page.locator('#logout').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('was signed out'));
    assert(!(await page.locator('#result').innerText()).includes('The BNB trial pass is retired.'));
    assert(await page.locator('#access').isDisabled());
    await done('retired and released trial shown; logout clears observation');
    const held=await open(width,{variant:'held'});
    await held.page.locator('#access').click();await resultContains(held.page,'does not grant BNB game access');
    await held.done('held active fixture remains a diagnostic, never game access');
  }
  for(const variant of ['unavailable','malformed','stale','wrongwallet','unauthorized']){
    const {page,done}=await open(320,{variant});
    await page.locator('#access').click();
    if(variant==='unauthorized'){
      await resultContains(page,'Sign in again');assert(await page.locator('#access').isDisabled());
    }else await resultContains(page,'Unable to verify');
    await done(variant+' backing response cannot imply eligibility');
  }
  const pending=await open(390);pending.state.held=true;
  const entered=new Promise(resolve=>{pending.state.entered=resolve;});
  await pending.page.locator('#access').click();await entered;
  await pending.page.evaluate(B=>window.__backingMock.change(B),B);
  pending.state.release();
  await pending.page.waitForFunction(()=>!document.getElementById('connect').disabled);
  await resultContains(pending.page,'Wallet or network changed.');
  assert(!(await pending.page.locator('#result').innerText()).includes('The BNB trial pass is retired.'));
  await pending.done('late backing response cannot overwrite changed wallet state');
  const report={passed:true,sourceCommit,candidateId:process.env.BNB_BACKING_CANDIDATE_ID||null,
    planSha256:process.env.BNB_BACKING_PLAN_SHA256||null,pageURL:target.href,liveAssets,
    viewportWidths:[1440,390,320],mockedWallet:true,mockedApi:true,installedWalletVerified:false,
    noWalletOrPaymentActions:true,gameplayAuthorized:false,playwrightVersion,checkedAt:new Date().toISOString(),
    appSha256:sha(fs.readFileSync(path.join(root,pagePath,'app.js'))),
    htmlSha256:sha(fs.readFileSync(path.join(root,pagePath,'index.html'))),scenarios,screenshots};
  fs.writeFileSync(path.join(out,'bnb-backing-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,sourceCommit,candidateId:report.candidateId,scenarioCount:scenarios.length,
    viewportWidths:report.viewportWidths,mockedWallet:true,mockedApi:true,gameplayAuthorized:false,liveAssets}));
}finally{await browser?.close();}
