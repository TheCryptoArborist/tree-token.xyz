// Browser-only QA. Every API call and wallet method is synthetic; no real wallet
// is connected and no authentication, chain or payment request reaches a service.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

assert(process.argv[2],'Pass the installed Playwright module path.');
const modulePath=path.resolve(process.argv[2]);
const {chromium}=await import(pathToFileURL(modulePath).href);
const playwrightVersion=JSON.parse(fs.readFileSync(path.join(path.dirname(modulePath),'package.json'),'utf8')).version;
const root=process.cwd(),pagePath='/play/multichaintest/game/bnb/',apiPath='/api/arcade-bnb-test';
const target=new URL(pagePath,process.argv[3]||'https://tree-token.xyz');
assert(['https:','http:'].includes(target.protocol)&&!target.username&&!target.password,'Use an HTTP(S) page origin without credentials.');
const liveAssets=Boolean(process.argv[3]),out=path.join(root,'.netlify');
fs.mkdirSync(out,{recursive:true});
const A='0x'+'a1'.repeat(20),B='0x'+'b2'.repeat(20),SCOPE='eip155:56:treeforce89-test:v1';
const COOKIE='__Secure-tree_bnb_test',TOKEN='bnbtest_'+'0'.repeat(64);
const scenarios=[],screenshots=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceCommit=process.env.REVIEWED_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.REVIEWED_SHA)assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceCommit,'Reviewed source differs from checkout.');

function fakeProvider({installed,chain,wallet}){
  const handlers=new Map();
  const state={chain,wallet,calls:[],rejectSign:false,holdSign:false,pendingSign:false,resolveSign:null};
  const provider={
    on(event,fn){const set=handlers.get(event)||new Set();set.add(fn);handlers.set(event,set);},
    removeListener(event,fn){handlers.get(event)?.delete(fn);},
    async request(request){
      state.calls.push({method:request.method,params:request.params});
      if(request.method==='eth_chainId')return state.chain;
      if(request.method==='eth_accounts'||request.method==='eth_requestAccounts')return [state.wallet];
      if(request.method==='personal_sign'){
        if(state.rejectSign){const error=Error('User rejected the signature');error.code=4001;throw error;}
        if(state.holdSign){state.pendingSign=true;await new Promise(resolve=>{state.resolveSign=resolve;});state.pendingSign=false;}
        return '0x'+'12'.repeat(65);
      }
      throw Error('Unexpected wallet method: '+request.method);
    }
  };
  window.__bnbMock={
    state,
    install(){window.ethereum=provider;},
    emit(event,value){
      if(event==='accountsChanged')state.wallet=value[0];
      if(event==='chainChanged')state.chain=value;
      for(const fn of handlers.get(event)||[])fn(value);
    },
    releaseSign(){state.resolveSign?.();}
  };
  if(installed)window.__bnbMock.install();
}

function gate(){let enter,release;const entered=new Promise(resolve=>{enter=resolve;}),wait=new Promise(resolve=>{release=resolve;});return {enter,entered,release,wait};}
let browser;
async function open(width,{installed=true,chain='0x38'}={}){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(fakeProvider,{installed,chain,wallet:A});
  await context.addCookies([{name:'existing_arcade_sentinel',value:'unchanged',url:target.origin+'/',httpOnly:true,secure:target.protocol==='https:',sameSite:'Strict'}]);
  const page=await context.newPage(),errors=[],unexpected=[],requests=[],modules=[];
  const state={active:false,wallet:A,gateAction:null,gate:null,nonce:0};
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(new URL(response.url()).pathname===pagePath+'app.js')modules.push(response);
  });
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===target.origin&&url.pathname===apiPath){
      assert.equal(request.method(),'POST');
      assert.equal(request.headers()['content-type'],'application/json');
      const body=JSON.parse(request.postData());requests.push(body);
      if(state.gateAction===body.action){state.gate.enter();await state.gate.wait;}
      const headers={'content-type':'application/json','cache-control':'no-store'};
      const json=(data,status=200)=>route.fulfill({status,headers,body:JSON.stringify(data)});
      if(body.action==='challenge'){
        const nonce=(++state.nonce).toString(16).padStart(64,'0');
        return json({chainId:56,wallet:body.wallet,scope:SCOPE,gameplayAuthorized:false,nonce,
          message:'tree-token.xyz wants you to sign in with your Ethereum account:\n'+body.wallet+'\n\nBNB test sign-in\n\nURI: https://tree-token.xyz'+pagePath+'\nVersion: 1\nChain ID: 56\nNonce: '+nonce,
          expiresAt:new Date(Date.now()+300000).toISOString()});
      }
      if(body.action==='sign-in'){
        state.active=true;state.wallet=body.wallet;
        headers['set-cookie']=COOKIE+'='+TOKEN+'; Path='+apiPath+'; Max-Age=3590; HttpOnly; Secure; SameSite=Strict';
        return json({authenticated:true,wallet:state.wallet,chainId:56,scope:SCOPE,gameplayAuthorized:false});
      }
      if(body.action==='logout'){
        state.active=false;headers['set-cookie']=COOKIE+'=; Path='+apiPath+'; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
        return json({signedOut:true,gameplayAuthorized:false});
      }
      const cookie=await request.headerValue('cookie');
      if(!state.active||!cookie?.includes(COOKIE+'='+TOKEN))return json({error:'invalid-session',gameplayAuthorized:false},401);
      if(body.action==='status')return json({authenticated:true,wallet:state.wallet,chainId:56,scope:SCOPE,gameplayAuthorized:false});
      if(body.action==='entitlement')return json({reason:'production-backed-pass-not-enabled',gameplayAuthorized:false},403);
      throw Error('Unexpected API action: '+body.action);
    }
    if(url.origin===target.origin&&[pagePath,pagePath+'index.html',pagePath+'app.js'].includes(url.pathname)){
      if(liveAssets)return route.continue();
      const filename=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
      return route.fulfill({status:200,contentType:filename.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,filename))});
    }
    if(url.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
    unexpected.push({url:url.origin+url.pathname,method:request.method()});
    return route.abort('blockedbyclient');
  });
  const response=await page.goto(target.href,{waitUntil:'load'});
  assert(response?.ok(),'BNB sign-in page failed to load.');
  await page.locator('#connect').waitFor({state:'visible'});
  assert.equal(modules.length,1,'Expected one application module.');
  assert(modules[0].ok(),'Application module failed to load.');
  assert.equal(sha(await modules[0].body()),sha(fs.readFileSync(path.join(root,pagePath,'app.js'))),'Served application module differs from reviewed source.');
  const done=async(name,detail={})=>{
    const methods=await page.evaluate(()=>window.__bnbMock.state.calls.map(x=>x.method));
    assert(methods.every(method=>['eth_chainId','eth_accounts','eth_requestAccounts','personal_sign'].includes(method)),'Unexpected wallet method.');
    assert.equal(await page.getByRole('button',{name:'Start BNB game (not enabled)',exact:true}).isDisabled(),true,'Gameplay must remain disabled.');
    assert.deepEqual(unexpected,[],'Unexpected network request; tests must remain isolated.');
    assert.deepEqual(errors,[],'Browser runtime error.');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow at '+width);
    scenarios.push({name,width,passed:true,apiActions:requests.map(x=>x.action),walletMethods:methods,...detail});
    await context.close();
  };
  return {context,page,state,requests,done};
}
const expectStatus=async(page,text)=>page.waitForFunction(expected=>document.getElementById('status').textContent.includes(expected),text);
const connect=async page=>{await page.locator('#connect').click();await expectStatus(page,'Connected.');};
const signIn=async page=>{await page.locator('#sign').click();await expectStatus(page,'BNB sign-in verified.');};

try{
  browser=await chromium.launch({channel:'chromium',headless:true});
  for(const width of [1440,390,320]){
    {
      const {page,done}=await open(width,{installed:false});
      assert(await page.locator('#sign').isDisabled());assert(await page.locator('#access').isDisabled());
      if(width===1440||width===320){
        const filename='bnb-test-auth-'+width+'.png';await page.screenshot({path:path.join(out,filename),fullPage:true});screenshots.push(filename);
      }
      await page.locator('#connect').click();await expectStatus(page,'No EVM wallet detected');
      assert(await page.locator('#sign').isDisabled());
      await done('disconnected layout and missing-wallet help');
    }
    {
      const {context,page,state,requests,done}=await open(width);
      await connect(page);await signIn(page);
      const signing=await page.evaluate(()=>window.__bnbMock.state.calls.filter(x=>x.method==='personal_sign'));
      assert.equal(signing.length,1);assert.equal(signing[0].params[1],A);
      const message=Buffer.from(signing[0].params[0].slice(2),'hex').toString('utf8');
      assert(message.startsWith('tree-token.xyz wants you to sign in'));assert(message.includes('Chain ID: 56'));
      const cookie=(await context.cookies(target.origin+apiPath)).find(x=>x.name===COOKIE);
      assert(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Strict'&&cookie.path===apiPath,'Test session cookie attributes differ.');
      assert.equal(await page.evaluate(()=>document.cookie.includes('__Secure-tree_bnb_test')),false);
      await page.locator('#status-button').click();await expectStatus(page,'Test session active for '+A);
      await page.locator('#access').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('production-backed-pass-not-enabled'));
      state.active=false;
      await page.locator('#status-button').click();await expectStatus(page,'No BNB test session.');assert(await page.locator('#access').isDisabled());
      await signIn(page);await page.locator('#logout').click();await expectStatus(page,'This BNB test session was signed out.');
      const remaining=await context.cookies(target.origin+apiPath);
      assert(!remaining.some(x=>x.name===COOKIE),'Logout must clear the test cookie.');
      assert(remaining.some(x=>x.name==='existing_arcade_sentinel'&&x.value==='unchanged'),'Unrelated cookie must survive.');
      assert(await page.locator('#access').isDisabled());
      assert.equal(requests.filter(x=>x.action==='sign-in').length,2);
      await done('personal-message sign-in, cookie, denial, expiry and isolated logout',{privateCookie:true,otherCookiePreserved:true});
    }
  }
  {
    const {page,requests,done}=await open(390);await connect(page);
    await page.evaluate(()=>{window.__bnbMock.state.rejectSign=true;});
    await page.locator('#sign').click();await expectStatus(page,'User rejected the signature');
    assert(await page.locator('#access').isDisabled());assert.equal(requests.filter(x=>x.action==='sign-in').length,0);
    assert(await page.locator('#sign').isEnabled());await done('signature rejection creates no session');
  }
  for(const event of ['accountsChanged','chainChanged']){
    const {page,state,done}=await open(390);await connect(page);
    state.gateAction='sign-in';state.gate=gate();
    await page.locator('#sign').click();await state.gate.entered;
    await page.evaluate(({event,B})=>window.__bnbMock.emit(event,event==='accountsChanged'?[B]:'0x1'),{event,B});
    state.gate.release();await expectStatus(page,'Wallet changed.');
    assert(await page.locator('#access').isDisabled());assert(await page.locator('#sign').isDisabled());
    assert.equal(await page.locator('#wallet').innerText(),'No BNB wallet selected.');
    await done(event+' while sign-in response is pending');
  }
  {
    const {page,requests,done}=await open(390);await connect(page);
    await page.evaluate(()=>{window.__bnbMock.state.holdSign=true;});
    await page.locator('#sign').click();await page.waitForFunction(()=>window.__bnbMock.state.pendingSign);
    await page.evaluate(()=>{window.__bnbMock.emit('chainChanged','0x1');window.__bnbMock.releaseSign();});
    await expectStatus(page,'Wallet changed.');assert.equal(requests.filter(x=>x.action==='sign-in').length,0);
    assert(await page.locator('#access').isDisabled());await done('chain change during wallet prompt blocks sign-in');
  }
  {
    const {page,state,requests,done}=await open(320,{installed:false});
    await page.evaluate(()=>window.__bnbMock.install());await connect(page);
    state.gateAction='challenge';state.gate=gate();await page.locator('#sign').click();await state.gate.entered;
    await page.evaluate(B=>window.__bnbMock.emit('accountsChanged',[B]),B);
    state.gate.release();await expectStatus(page,'Wallet changed.');
    assert.equal(await page.evaluate(()=>window.__bnbMock.state.calls.filter(x=>x.method==='personal_sign').length),0);
    assert.equal(requests.filter(x=>x.action==='sign-in').length,0);await done('late provider injection still handles account changes');
  }
  {
    const {page,done}=await open(320,{chain:'0x1'});await page.locator('#connect').click();await expectStatus(page,'Select BNB Smart Chain');
    assert(await page.locator('#sign').isDisabled());
    assert.equal(await page.evaluate(()=>window.__bnbMock.state.calls.some(x=>x.method==='eth_requestAccounts')),false);
    await done('wrong network blocked without automatic switching');
  }
  const report={
    sourceCommit,candidateId:process.env.BNB_TEST_CANDIDATE_ID||null,planSha256:process.env.BNB_TEST_PLAN_SHA256||null,
    pageURL:target.href,liveAssets,viewportWidths:[1440,390,320],passed:true,noWalletOrPaymentActions:true,
    mockedWallet:true,mockedApi:true,installedWalletVerified:false,playwrightVersion,checkedAt:new Date().toISOString(),
    appSha256:sha(fs.readFileSync(path.join(root,pagePath,'app.js'))),screenshots,scenarios,
  };
  fs.writeFileSync(path.join(out,'bnb-test-auth-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,sourceCommit,candidateId:report.candidateId,viewportWidths:report.viewportWidths,scenarioCount:scenarios.length,playwrightVersion,noWalletOrPaymentActions:true,mockedWallet:true,liveAssets}));
}finally{await browser?.close();}
