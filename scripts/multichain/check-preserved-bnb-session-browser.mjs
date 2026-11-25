// Offline differential regression: every request is fulfilled locally or aborted.
// Never forwards wallet signatures, payments, or API calls to production.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
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
  'sui:signPersonalMessage':{version:'1.1.0',signPersonalMessage:async({message})=>{window.fixtureAudit.signatures++;return {bytes:btoa(String.fromCharCode(...message)),signature:'local-fixture-only'};}},
  'sui:signTransaction':{version:'2.0.0',signTransaction:forbidden},
  'sui:signAndExecuteTransaction':{version:'2.0.0',signAndExecuteTransaction:forbidden}
 }};
 window.fixtureSwitch=()=>{accounts=[account('0x'+'c'.repeat(64))];change();};
 window.addEventListener('wallet-standard:app-ready',e=>e.detail.register(w));
 window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet',{detail:({register})=>register(w)}));
 if(pending)sessionStorage.setItem('treeforce89-pending-continue:'+wallet,JSON.stringify({wallet,offerId:'d'.repeat(48),digest:'1'.repeat(44),startedAt:Date.now()}));
}
try {
 for(const width of [390,1000]) for(const scenario of ['switch','expiry','pending']) {
 const results=[];
 for(const candidate of [false,true]) {
 const page=await browser.newPage({viewport:{width,height:850}}),errors=[],unexpected=[],calls=[];
 await page.clock.install();
 await page.addInitScript(fixture,{wallet,pending:scenario==='pending'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());let p=u.pathname;if(p.endsWith('/'))p+='index.html';
 const file=path.join(root,p.startsWith(receipt.prefix+'/')?'candidate'+p:'captured'+p);
 const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 if(u.origin==='https://tree-token.xyz'&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:p.endsWith('.html')?'text/html':/\.m?js$/.test(p)?'application/javascript':p.endsWith('.css')?'text/css':'application/octet-stream'});
 if(u.origin==='https://tree-token.xyz'&&p==='/api/treeforce89-leaderboard'&&req.method()==='GET')return json({entries:[]});
 if(u.origin==='https://tree-token.xyz'&&req.method()==='POST') {
 const now=await page.evaluate(()=>Date.now());
 if(p==='/play/treeforce89/api/tree-challenge') {
 assert.deepEqual(req.postDataJSON(),{wallet});calls.push('challenge');const nonce='e'.repeat(64),expiresAt=now+300000;
 return json({nonce,expiresAt,message:["TREE FORCE '89 wallet login",'Origin: https://tree-token.xyz','Network: sui:mainnet','Wallet: '+wallet,'Nonce: '+nonce,'Expires: '+new Date(expiresAt).toISOString(),'This signature does not authorize a token transfer.'].join('\n')});
 }
 if(p==='/play/treeforce89/api/tree-session') {assert.equal(req.postDataJSON().signature,'local-fixture-only');calls.push('session');return json({sessionToken:token,runId:'grove-'+'f'.repeat(32),expiresAt:now+3600000});}
 if(p==='/play/treeforce89/api/tree-logout') {assert.equal(req.headers().authorization,'Bearer '+token);calls.push('logout');return json({loggedOut:true});}
 if(p==='/play/treeforce89/api/tree-continue'&&scenario==='pending') {assert.equal(req.headers().authorization,'Bearer '+token);assert.deepEqual(req.postDataJSON(),{offerId:'d'.repeat(48),digest:'1'.repeat(44)});calls.push('recover');return json({error:'Fixture: payment not yet verified'},409);}
 }
 if(['image','font'].includes(req.resourceType()) || (u.origin==='https://tree-token.xyz'&&p.startsWith('/play/treeforce89/assets/')&&/\.(png|jpe?g|webp)$/.test(p)))return route.fulfill({status:204});unexpected.push(p);return route.abort();
 });
 await page.goto('https://tree-token.xyz'+(candidate?receipt.prefix+'/':'/play/treeforce89/'));
 await page.getByRole('button',{name:'Connect Sui wallet',exact:true}).click();
 await page.getByRole('button',{name:/Local Test Wallet/}).click();
 await page.getByRole('button',{name:'Verify NFTree & Play',exact:true}).click();
 await page.locator('.nftree-wallet-bar').waitFor({timeout:10000}).catch(async e=>{console.error({scenario,candidate,calls,errors,unexpected,text:await page.locator('#root').innerText()});throw e;});
 await page.locator('.nftree-game-shell canvas').first().waitFor({state:'attached'});
 if(scenario==='pending') {
 await page.getByRole('button',{name:'Check payment & continue',exact:true}).click();
 await page.getByText('Fixture: payment not yet verified',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/Pay 20,000/}).count(),0);
 results.push(await page.locator('.continuation-review').innerText());
 assert.ok(await page.evaluate(wallet=>sessionStorage.getItem('treeforce89-pending-continue:'+wallet),wallet));
 }
 if(scenario==='expiry') {
 await page.clock.fastForward(3600001);
 await page.getByRole('button',{name:'Verify & resume run',exact:true}).waitFor();
 assert.equal(await page.locator('.nftree-game-shell .game-viewport').isVisible(),false);
 } else {
 await page.evaluate(()=>window.fixtureSwitch());
 await page.locator('.nftree-wallet-bar').waitFor({state:'detached'});
 await page.getByRole('button',{name:'Verify NFTree & Play',exact:true}).waitFor();
 }
 await page.waitForFunction(()=>!document.querySelector('.continuation-review'));
 assert.equal(await page.getByText('BNB review only. Payments remain disabled.',{exact:true}).count(),0);
 assert.deepEqual(await page.evaluate(()=>window.fixtureAudit),{signatures:1,transactions:0});
 assert.deepEqual(calls,['challenge','session',...(scenario==='pending'?['recover']:[]),...(scenario==='expiry'?[]:['logout'])]);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 results.push(await page.locator('#root').innerText());await page.close();
 }
 const n=results.length/2;assert.deepEqual(results.slice(n),results.slice(0,n));
 checks.push(`${scenario} at ${width}px: captured and candidate match; native session lifecycle preserved; no transaction or BNB request`);
 }
 console.log(JSON.stringify({localOnly:true,passed:checks.length,checks,browser:browser.version(),limitations:['Synthetic Wallet Standard signatures and server sessions only; no extension, NFT ownership or backend verification.','Media stubbed; game canvas mounting, expiry suspension and account-change teardown checked, not game mechanics or successful paid resume.']},null,2));
}finally{await browser.close();}
