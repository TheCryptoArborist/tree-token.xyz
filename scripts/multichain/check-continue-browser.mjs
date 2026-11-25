// Headless Chromium with every request intercepted. No live site or wallet calls.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
const root='docs/multichain/generation-milestone/browser-restoration/';
for(const f of JSON.parse(fs.readFileSync(root+'provenance.json')).files)assert.equal(createHash('sha256').update(fs.readFileSync(root+f.snapshot)).digest('hex'),f.sha256);
const controller=fs.readFileSync('scripts/multichain/browser/paid-continue-controller.mjs','utf8'),renderer=fs.readFileSync('scripts/multichain/browser/native-continue-renderer.mjs','utf8');
const html=`<!doctype html><title>Isolated continue test</title><script type="module">
import {createPaidContinueController} from './controller.mjs';
import {createNativeContinueRenderer} from './renderer.mjs';
import {prepareAuthorizedContinue} from './native.mjs';
import {restoreProgress} from './progress.mjs';
window.setup=(mode='normal')=>{
 window.stats={prepared:0,activated:0,rendered:0,props:null};
 const session={accountId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',nativeRunId:'grove-'+'a'.repeat(32),epoch:'fixture-login-1',expiresAt:Date.now()+60000};
 window.session=session;
 const input={paymentId:'33333333-3333-4333-8333-333333333333',sequence:1};window.input=input;
 const nativeSnapshot={runId:session.nativeRunId,seed:12,score:55,wave:2,kills:6,perfect:1,maxStage:2,shotsFired:10,shotsHit:8,start:100,mode:'ARCADE'};
 sessionStorage.setItem('treeforce-progress:'+session.nativeRunId,JSON.stringify({maxChain:4,clearedWaves:2,cleanWaves:1,turboPickups:0,boomPickups:1,ranked:true}));
 const prepare=async({runId,paymentId})=>{
  stats.prepared++;await new Promise(r=>setTimeout(r,20));
  if(mode==='session-change')session.epoch='another-login';
  const snapshotText=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,lives:0,continuesUsed:mode==='wrong-sequence'?4:input.sequence-1,nativeSnapshot});
  const checkpointHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshotText))),x=>x.toString(16).padStart(2,'0')).join('');
  return {protocol:'tree-paid-delivery.v2',status:'prepared',restoreAuthorized:mode!=='shadow',runId:mode==='wrong-run'?crypto.randomUUID():runId,paymentId,sequence:input.sequence,leaseId:crypto.randomUUID(),policyDigest:'a'.repeat(64),leaseExpiresAt:mode==='expired'?Date.now()-1:Date.now()+10000,snapshotText,checkpointHash:mode==='tamper'?'0'.repeat(64):checkpointHash};
 };
 const activate=async({runId,requestId})=>{
  stats.activated++;if(mode==='lost-response')throw Error('connection interrupted after commit');
  if(mode==='activation-session-change')session.epoch='another-login';
  return {protocol:'tree-paid-delivery.v2',status:'started',restoreAuthorized:mode!=='activation-denied',runId,sequence:input.sequence,activationId:mode==='stale-activation'?crypto.randomUUID():requestId,consumed:true,policyDigest:(mode==='stale-policy'?'b':'a').repeat(64)};
 };
 const render=createNativeContinueRenderer({getSession:()=>session,restoreProgress,commitResume:props=>{stats.rendered++;stats.props=props;if(mode==='renderer-failure')throw Error('scene mount failed');}});
 const storage=mode==='storage-failure'?{getItem:()=>null,setItem:()=>{throw Error('storage blocked');}}:localStorage;
 window.controller=createPaidContinueController({prepare,activate,getSession:()=>session,render,prepareNativeRun:prepareAuthorizedContinue,storage,locks:mode==='no-locks'?null:navigator.locks});
 window.resume=()=>controller.resume(input).catch(e=>({status:'rejected',reason:e.message}));
 return true;
};window.ready=true;
</script>`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const checks=[];let externalRequests=0;
async function context(){const c=await browser.newContext();await c.route('**/*',route=>{
 const url=new URL(route.request().url());
 const modules={'controller.mjs':controller,'renderer.mjs':renderer,'native.mjs':fs.readFileSync(root+'upstream/authorized-continue-resume.mjs','utf8'),'progress.mjs':fs.readFileSync(root+'upstream/progress.mjs','utf8')};
 if(url.origin!=='https://tree-token.xyz'||!url.pathname.startsWith('/play/__shared-restore-test__/')){externalRequests++;return route.abort();}
 const name=url.pathname.split('/').pop();return route.fulfill({status:200,contentType:name?'application/javascript':'text/html',body:name?modules[name]||'':html});
 });return c;}
async function page(c,mode='normal'){const p=await c.newPage();await p.goto('https://tree-token.xyz/play/__shared-restore-test__/');await p.waitForFunction(()=>window.ready);await p.evaluate(mode=>setup(mode),mode);return p;}
try{
 const c=await context(),p=await page(c);
 const results=await p.evaluate(()=>Promise.all(Array.from({length:12},()=>resume())));
 assert.equal(results.filter(r=>r.status==='restored').length,1);assert.equal((await p.evaluate(()=>stats)).activated,1);
 const props=await p.evaluate(()=>stats.props);assert.equal(props.initialScene,'game');assert.equal(props.resumeRun.score,55);assert.equal(props.resumeRun.wave,2);assert.equal(props.resumeRun.maxChain,4);assert.equal(props.resumeRun.ranked,true);assert.equal(props.serverRunId,props.resumeRun.runId);
 checks.push('12 clicks activate and enqueue native restore once, preserving progress and scene props');
 await p.reload();await p.waitForFunction(()=>window.ready);await p.evaluate(()=>setup());assert.equal((await p.evaluate(()=>resume())).status,'review-required');assert.equal((await p.evaluate(()=>stats)).activated,0);checks.push('refreshed page cannot replay a completed restore');await c.close();
 const tabs=await context(),a=await page(tabs),b=await page(tabs);const race=await Promise.all([a.evaluate(()=>resume()),b.evaluate(()=>resume())]);
 assert.equal(race.filter(r=>r.status==='restored').length,1);assert.equal((await a.evaluate(()=>stats.activated))+(await b.evaluate(()=>stats.activated)),1);checks.push('real Web Locks and localStorage serialize two tabs for the same run/sequence');await tabs.close();
 for(const [mode,error] of [['shadow','restoration-not-enabled'],['tamper','checkpoint-integrity-failed'],['wrong-run','invalid-prepare-binding'],['expired','invalid-prepare-binding'],['wrong-sequence','invalid-native-checkpoint'],['session-change','session-changed'],['storage-failure','storage blocked']]){
  const ctx=await context(),tab=await page(ctx,mode),r=await tab.evaluate(()=>resume());assert.equal(r.reason,error);assert.equal(await tab.evaluate(()=>stats.activated),0);assert.equal(await tab.evaluate(()=>stats.rendered),0);checks.push(mode+' prevents activation and rendering');await ctx.close();
 }
 for(const mode of ['lost-response','activation-denied','stale-activation','stale-policy','activation-session-change','renderer-failure']){
  const ctx=await context(),tab=await page(ctx,mode);assert.equal((await tab.evaluate(()=>resume())).status,'review-required');const n=await tab.evaluate(()=>stats.rendered);assert.equal(n,mode==='renderer-failure'?1:0);
  await tab.reload();await tab.waitForFunction(()=>window.ready);await tab.evaluate(()=>setup());assert.equal((await tab.evaluate(()=>resume())).status,'review-required');assert.equal(await tab.evaluate(()=>stats.activated),0);assert.equal(await tab.evaluate(()=>stats.rendered),0);checks.push(mode+' leaves durable review marker and cannot retry after reload');await ctx.close();
 }
 const seq=await context(),sp=await page(seq);assert.equal((await sp.evaluate(()=>resume())).status,'restored');await sp.evaluate(()=>{input.sequence=2;input.paymentId='44444444-4444-4444-8444-444444444444';});assert.equal((await sp.evaluate(()=>resume())).status,'restored');assert.equal(await sp.evaluate(()=>stats.rendered),2);checks.push('separate paid sequence permits one further restore of the same run');await seq.close();
 const missing=await context(),mp=await page(missing);await assert.rejects(mp.evaluate(()=>setup('no-locks')),/durable-browser-support-required/);checks.push('missing cross-tab lock support fails closed');await missing.close();
 assert.equal(externalRequests,0);
 console.log(JSON.stringify({localOnly:true,browser:browser.version(),passed:checks.length,checks,liveRequests:0,authorization:'explicit test fixtures only',liveRestorationEnabled:false},null,2));
}finally{await browser.close();}
