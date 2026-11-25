// Offline preserved-runtime review regression: every request is fulfilled locally or aborted.
// Never forwards wallet signatures, payments, or API calls to production.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
import {continueLinkMessage,CONTINUE_POLICY} from './sui-bnb-continue.mjs';
const root=process.argv[2];if(!root)throw Error('candidate-directory-required');const receipt=JSON.parse(fs.readFileSync(path.join(root,'provenance.json'))),checks=[];
for(const f of receipt.captured){const b=fs.readFileSync(path.join(root,'captured'+f.path));assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);if(f.path.startsWith('/play/treeforce89/assets/')&&!f.path.endsWith('/index-review-r19.js'))assert.deepEqual(fs.readFileSync(path.join(root,'candidate'+receipt.prefix+'/assets/'+path.basename(f.path))),b);}checks.push('captured files and every unchanged copied module retain exact hashes');
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'candidate'+receipt.prefix+'/assets/index-review-r19.js'))).digest('hex'),receipt.entryCandidateSha256);
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const wallet='0x'+'a'.repeat(64), token='b'.repeat(64);
function fixture({wallet,pending}) {
 const listeners=new Set(); const account=address=>({address,publicKey:new Uint8Array(32),chains:['sui:mainnet'],features:['sui:signPersonalMessage','sui:signTransaction','sui:signAndExecuteTransaction']});
 let accounts=[]; window.fixtureAudit={signatures:0,transactions:0};
 const change=()=>listeners.forEach(fn=>fn({accounts}));
 const forbidden=async()=>{window.fixtureAudit.transactions++;throw Error('Transactions forbidden in fixture');};
 const w={version:'1.0.0',name:'Local Test Wallet',icon:'data:image/svg+xml;base64,PHN2Zy8+',chains:['sui:mainnet'],get accounts(){return accounts;},features:{
  'standard:connect':{version:'1.0.0',connect:async()=>{accounts=[account(wallet)];change();return {accounts};}},
  'standard:disconnect':{version:'1.0.0',disconnect:async()=>{accounts=[];change();}},
  'standard:events':{version:'1.0.0',on:(_event,fn)=>{listeners.add(fn);return()=>listeners.delete(fn);}},
  'sui:signPersonalMessage':{version:'1.1.0',signPersonalMessage:async({message})=>{window.fixtureAudit.signatures++;if(window.holdSignature)await new Promise(r=>window.releaseSignature=r);return {bytes:btoa(String.fromCharCode(...message)),signature:'local-fixture-only'};}},
  'sui:signTransaction':{version:'2.0.0',signTransaction:forbidden},
  'sui:signAndExecuteTransaction':{version:'2.0.0',signAndExecuteTransaction:forbidden}
 }};
 window.fixtureSwitch=()=>{accounts=[account('0x'+'c'.repeat(64))];change();};
 window.addEventListener('wallet-standard:app-ready',e=>e.detail.register(w));
 window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet',{detail:({register})=>register(w)}));
 const evmListeners=new Map();window.evmCalls=[];
 const payer='0x'+'c'.repeat(40);
 const provider={on:(event,fn)=>{if(!evmListeners.has(event))evmListeners.set(event,new Set());evmListeners.get(event).add(fn);},removeListener:(event,fn)=>evmListeners.get(event)?.delete(fn),request:async({method})=>{
 window.evmCalls.push(method);if(method==='eth_accounts'||method==='eth_requestAccounts')return [payer];if(method==='eth_chainId')return '0x38';if(method==='personal_sign'){if(window.holdEvm)await new Promise(r=>window.releaseSignature=r);return '0x'+'e'.repeat(130);}return forbidden();}};
 window.evmListenerCount=()=>[...evmListeners.values()].reduce((n,s)=>n+s.size,0);
 window.evmSwitch=()=>{for(const fn of [...evmListeners.get('accountsChanged')||[]])fn([]);};
 window.addEventListener('eip6963:requestProvider',()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'11111111-1111-4111-8111-111111111111',name:'Local BNB Wallet'},provider}})));
 if(pending)sessionStorage.setItem('treeforce89-pending-continue:'+wallet,JSON.stringify({wallet,offerId:'d'.repeat(48),digest:'1'.repeat(44),startedAt:Date.now()}));
}
// Instrument only the intercepted response, never the candidate on disk.
function testEntry(bytes){
 let text=bytes.toString();
 const flag='pending:()=>Mh(p.session.wallet),enabled:false';
 const hook='};return r&&r.wallet===';
 assert.equal(text.split(flag).length,2);assert.equal(text.split(hook).length,2);
 return text.replace(flag,flag.replace('false','true')).replace(hook,'};window.__openReview=()=>{b(undefined);v(true)};return r&&r.wallet===');
}
try {
 for(const width of [390,1000]) for(const scenario of ['complete','close-sui','switch-sui','switch-bnb']) {
 const page=await browser.newPage({viewport:{width,height:850}}),errors=[],unexpected=[],calls=[];
 let sessionExpiry,challenge;
 await page.addInitScript(fixture,{wallet,pending:false});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());let p=u.pathname;if(p.endsWith('/'))p+='index.html';
 const file=path.join(root,p.startsWith(receipt.prefix+'/')?'candidate'+p:'captured'+p);
 const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 if(u.origin==='https://tree-token.xyz'&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:p===receipt.prefix+'/assets/index-review-r19.js'?testEntry(fs.readFileSync(file)):fs.readFileSync(file),contentType:p.endsWith('.html')?'text/html':/\.m?js$/.test(p)?'application/javascript':p.endsWith('.css')?'text/css':'application/octet-stream'});
 if(u.origin==='https://tree-token.xyz'&&p==='/api/treeforce89-leaderboard'&&req.method()==='GET')return json({entries:[]});
 if(u.origin==='https://tree-token.xyz'&&req.method()==='POST') {
 const now=await page.evaluate(()=>Date.now());
 if(p==='/play/treeforce89/api/tree-challenge') {
 assert.deepEqual(req.postDataJSON(),{wallet});calls.push('challenge');const nonce='e'.repeat(64),expiresAt=now+300000;
 return json({nonce,expiresAt,message:["TREE FORCE '89 wallet login",'Origin: https://tree-token.xyz','Network: sui:mainnet','Wallet: '+wallet,'Nonce: '+nonce,'Expires: '+new Date(expiresAt).toISOString(),'This signature does not authorize a token transfer.'].join('\n')});
 }
 if(p==='/play/treeforce89/api/tree-session') {assert.equal(req.postDataJSON().signature,'local-fixture-only');calls.push('session');sessionExpiry=now+3600000;return json({sessionToken:token,runId:'grove-'+'f'.repeat(32),expiresAt:sessionExpiry});}
 if(p==='/play/treeforce89/api/tree-logout') {assert.equal(req.headers().authorization,'Bearer '+token);calls.push('logout');return json({loggedOut:true});}
 if(p.startsWith('/play/treeforce89/api/shared-continue-')) {
 assert.equal(req.headers().authorization,'Bearer '+token);
 const action=p.split('/').pop();calls.push(action);
 const context={suiWallet:wallet,payer:'0x'+'c'.repeat(40),accountId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',nativeRunId:'grove-'+'f'.repeat(32),sequence:1,network:'sui:mainnet',expiresAt:sessionExpiry,paymentEnabled:false,restoreAuthorized:false};
 if(action==='shared-continue-bnb-context')return json(context);
 if(action==='shared-continue-bnb-challenge') {
 const row={...context,id:'d'.repeat(64),sessionHash:createHash('sha256').update(token).digest('hex'),deliveryProtocol:'tree-paid-delivery.v2',expiresAt:now+240000};
 challenge={id:row.id,message:continueLinkMessage(row),expiresAt:row.expiresAt,paymentEnabled:false,restoreAuthorized:false};return json(challenge);
 }
 if(action==='shared-continue-bnb-open')return json({id:challenge.id,chainId:56,product:CONTINUE_POLICY.product,restoreLives:3,token:CONTINUE_POLICY.token,recipient:CONTINUE_POLICY.treasury,amount:CONTINUE_POLICY.amount,expiresAt:challenge.expiresAt,paymentEnabled:false,reviewOnly:true,restoreAuthorized:false,continueAuthorized:false,gameplayAuthorized:false});
 }

 }
 if(['image','font'].includes(req.resourceType()) || (u.origin==='https://tree-token.xyz'&&p.startsWith('/play/treeforce89/assets/')&&/\.(png|jpe?g|webp)$/.test(p)))return route.fulfill({status:204});unexpected.push(p);return route.abort();
 });
 await page.goto('https://tree-token.xyz'+receipt.prefix+'/');
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 await click('Connect Sui wallet');await page.getByRole('button',{name:/Local Test Wallet/}).click();await click('Verify NFTree & Play');
 await page.locator('.nftree-wallet-bar').waitFor();await page.locator('.nftree-game-shell canvas').first().waitFor({state:'attached'});
 await page.evaluate(()=>window.__openReview());
 await click('Connect Local BNB Wallet');
 await click('Review wallet-link message');
 await page.getByRole('button',{name:'Sign link in Sui wallet',exact:true}).waitFor();
 if(scenario!=='complete'&&scenario!=='switch-bnb')await page.evaluate(()=>window.holdSignature=true);
 await click('Sign link in Sui wallet');
 if(scenario==='complete'||scenario==='switch-bnb') {
 if(scenario==='switch-bnb')await page.evaluate(()=>window.holdEvm=true);
 await click('Sign link in BNB wallet');
 }
 if(scenario==='complete'){
 await click('Verify link and review terms');await page.getByText(/Review verified: 1 USDT/).waitFor();
 assert.equal(calls.filter(x=>x==='shared-continue-bnb-open').length,1);
 await click('Close review');
 }else{
 await page.waitForFunction(()=>!!window.releaseSignature);
 if(scenario==='close-sui')await click('Close review');
 if(scenario==='switch-sui')await page.evaluate(()=>window.fixtureSwitch());
 if(scenario==='switch-bnb')await page.evaluate(()=>window.evmSwitch());
 await page.waitForFunction(()=>window.evmListenerCount()===0);
 await page.evaluate(()=>window.releaseSignature());
 // Give the resolved signature and React cleanup a full task turn to settle.
 await page.evaluate(()=>new Promise(r=>setTimeout(r,50)));
 assert.equal(calls.filter(x=>x==='shared-continue-bnb-open').length,0);
 assert.equal(await page.getByRole('button',{name:'Verify link and review terms',exact:true}).count(),0);
 }
 assert.equal(await page.evaluate(()=>window.evmListenerCount()),0);
 assert.equal(await page.evaluate(()=>window.fixtureAudit.transactions),0);
 assert((await page.evaluate(()=>window.evmCalls)).every(m=>['eth_accounts','eth_chainId','eth_requestAccounts','personal_sign'].includes(m)));
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 assert.deepEqual(calls.filter(x=>x.startsWith('shared-continue-')),['shared-continue-bnb-context','shared-continue-bnb-challenge',...(scenario==='complete'?['shared-continue-bnb-open']:[])]);
 checks.push(`${scenario} at ${width}px: review lifecycle in preserved runtime, no transaction or unexpected request`);
 await page.close();
 }
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'candidate'+receipt.prefix+'/assets/index-review-r19.js'))).digest('hex'),receipt.entryCandidateSha256);
 console.log(JSON.stringify({localOnly:true,testOnlyResponseInstrumentation:true,passed:checks.length,checks,browser:browser.version(),limitations:['Synthetic wallets and API responses; no real signatures, chain verification or payment.','Checkout opened with a test-only callback and enabled in intercepted bytes only; candidate stays disabled on disk.','Media stubbed; game-over mechanics and successful paid restoration are not covered.']},null,2));
}finally{await browser.close();}
