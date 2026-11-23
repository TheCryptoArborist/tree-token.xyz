// Browser-only wallet mock: never broadcasts to a public chain.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Interface,ZeroAddress} from 'ethers';import {P,KEY} from '../browser/core.mjs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const read=p=>JSON.parse(fs.readFileSync(p));const F=read('docs/multichain/generation-milestone/bnb-handoff/fork.json'),D=read('docs/multichain/generation-milestone/bnb-handoff/dependency-code.json'),S=read('docs/multichain/generation-milestone/slot-created/receipt.json');
const EP='0x1a44076050125825900e736c501f859c50fE728c',USDT='0x55d398326f99059fF775485246999027B3197955',eq=(a,b)=>a.toLowerCase()===b.toLowerCase();
const ai=new Interface(P.adapter.abi),pi=new Interface(P.pass.abi),ei=new Interface(['function delegates(address)view returns(address)']);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const results=[];
try {for(const scenario of ['complete','rejected','uncertain','wrong-account','off-origin']){
 let stage=0,sends=0;const context=await browser.newContext();const page=await context.newPage();
 await page.exposeFunction('mockRpc',async({method,params=[]})=>{
 if(['eth_accounts','eth_requestAccounts'].includes(method))return [scenario==='wrong-account'?ZeroAddress:P.admin];
 if(method==='eth_chainId')return '0x38';if(method==='eth_getTransactionCount')return '0x'+(P.baseNonce+stage).toString(16);
 if(method==='eth_getBalance')return '0x8ac7230489e80000';if(method==='eth_gasPrice')return '0x2faf080';if(method==='eth_estimateGas')return '0x'+BigInt(P.gasLimits[stage]-1).toString(16);
 if(method==='eth_getCode'){const a=params[0];return eq(a,EP)?D.endpoint:eq(a,USDT)?D.usdt:eq(a,P.addresses.adapter)&&stage>=1?F.code.adapter:eq(a,P.addresses.pass)&&stage>=2?F.code.pass:'0x';}
 if(method==='eth_getTransactionByHash'||method==='eth_getTransactionReceipt'){const i=F.session.hashes.indexOf(params[0]);assert(i>=0);return F.records[i][method==='eth_getTransactionByHash'?'transaction':'receipt'];}
 if(method==='eth_call'){const a=params[0].to,abi=eq(a,EP)?ei:eq(a,P.addresses.adapter)?ai:pi;const name=abi.parseTransaction({data:params[0].data}).name;const values={suiPeer:P.peer,route:P.route,binder:P.admin,endpoint:EP,backingNFT:'0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba',pass:stage===3?P.addresses.pass:ZeroAddress,delegates:P.admin,adapter:P.addresses.adapter,controller:P.admin,initialBuyer:P.admin,treasury:P.treasury,currency:USDT,currencyCodeHash:P.remoteCodeHashes.usdt,purchasesPaused:true,state:0,generation:0,canPlay:false};assert(name in values,name);return abi.encodeFunctionResult(name,[values[name]]);}
 if(method==='eth_sendTransaction'){sends++;assert.deepEqual(params[0],F.session.requests[stage]);if(scenario==='rejected')return {mockError:4001};const hash=F.session.hashes[stage++];if(scenario==='uncertain')return {mockError:-1};return hash;}throw Error('Unexpected '+method);
 });
 await page.addInitScript(()=>{const p={request:async r=>{const v=await window.mockRpc(r);if(v?.mockError)throw Object.assign(Error('Mock wallet error'),{code:v.mockError});return v;},on:()=>{}};window.addEventListener('eip6963:requestProvider',()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{rdns:'io.metamask',uuid:'mock'},provider:p}})));});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/')){const s=structuredClone(S);s.state.data.checkpoint.timestamp=new Date().toISOString();return route.fulfill({json:s,headers:{date:new Date().toUTCString()}});}const file=u.pathname.endsWith('app.js')?'app.js':'index.html';return route.fulfill({body:fs.readFileSync('tools/bnb-generation/'+file),contentType:file.endsWith('.js')?'application/javascript':'text/html'});});
 await page.goto((scenario==='off-origin'?'https://preview.invalid':'https://tree-token.xyz')+'/play/bnb-generation/');await page.waitForFunction(()=>!document.querySelector('#status').textContent.includes('Loading'));
 const status=()=>page.locator('#status').innerText();const until=async text=>{await page.waitForFunction(t=>document.querySelector('#status').textContent.includes(t),text,{timeout:10000});};
 if(scenario==='off-origin'){assert(await page.locator('#connect').isDisabled());assert.equal(sends,0);}else{
 await page.click('#connect');await until(scenario==='wrong-account'?'must share':'Connected');
 if(scenario==='wrong-account'){assert(await page.locator('#send').isDisabled());assert.equal(sends,0);}else{
 for(let i=0;i<(scenario==='complete'?3:1);i++){await page.click('#refresh');await until('Step '+(i+1));await page.click('#send');await until(scenario==='rejected'?'rejected':scenario==='uncertain'?'uncertain':'Submitted');}
 if(scenario==='complete'){await page.click('#check');await until('BNB deployment verified');assert.equal(sends,3);}
 if(scenario==='rejected'){assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).attempt,KEY),null);assert.equal(stage,0);}
 if(scenario==='uncertain'){await page.reload();await until('unresolved');await page.click('#connect');await until('prior wallet request');assert(await page.locator('#refresh').isDisabled());await page.locator('summary').click();await page.fill('#hash',F.session.hashes[0]);await page.click('#recover');await until('Recovered and verified');assert.equal(sends,1);assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).hashes.length,KEY),1);}
 }}results.push({scenario,passed:true,mockedWalletSends:sends});await context.close();
 }console.log(JSON.stringify({browser:'Chromium',realTransactions:0,results},null,2));}finally{await browser.close();}
