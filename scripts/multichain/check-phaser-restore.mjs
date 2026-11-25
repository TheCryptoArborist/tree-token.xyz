// Invoked by the disposable native PostgreSQL checker. All browser traffic is intercepted.
import {createRestoreHttpHandler} from './continue-restore-http.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {build} from '../../vendor/continue-browser-test/node_modules/esbuild/lib/main.js';
import {chromium} from '../../vendor/continue-browser-test/node_modules/playwright/index.mjs';
export async function checkPhaserRestore({authorization,sessionToken,paymentId,session}) {
 const root='docs/multichain/generation-milestone/phaser-restoration/';
 for(const f of JSON.parse(fs.readFileSync(root+'provenance.json')).files)assert.equal(createHash('sha256').update(fs.readFileSync(root+f.snapshot)).digest('hex'),f.sha256);
 const bundle=await build({entryPoints:[root+'upstream/arcade.ts'],bundle:true,format:'esm',platform:'browser',write:false,nodePaths:[path.resolve('vendor/continue-browser-test/node_modules')],logLevel:'silent'});
 const moduleText=bundle.outputFiles[0].text;
 const handlers=Object.fromEntries(['prepare','activate'].map(action=>[action,createRestoreHttpHandler({action,authorization})]));
 const base='https://tree-token.xyz/play/__phaser-restore-test__/';let activations=0,preparations=0,blocked=0;
 const foreign=await handlers.prepare(new Request(base+'prepare',{method:'POST',headers:{origin:'https://tree-token.xyz','content-type':'application/json',authorization:'Bearer '+'0'.repeat(64)},body:JSON.stringify({runId:session.runId,paymentId,clientKey:'1'.repeat(64)})}));
 assert.equal(foreign.status,503);assert.equal((await foreign.json()).restoreAuthorized,false);
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const html=`<!doctype html><style>body{margin:0}#game{width:480px;height:720px}</style><div id="game"></div><script type="module">
 import {createCanopyGame} from './game.mjs';import {createPaidContinueController} from './controller.mjs';import {createNativeContinueRenderer} from './renderer.mjs';import {prepareAuthorizedContinue} from './native.mjs';import {restoreProgress} from './progress.mjs';
 const session=${JSON.stringify(session)},paymentId=${JSON.stringify(paymentId)};
 const post=async(action,input)=>{const r=await fetch('./'+action,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+${JSON.stringify(sessionToken)}},body:JSON.stringify(input)});if(!r.ok)throw Error('request failed');return r.json();};
 window.mounts=0;
 const render=createNativeContinueRenderer({getSession:()=>session,restoreProgress,commitResume:props=>{
  window.mounts++;window.game=createCanopyGame(document.getElementById('game'),props);
  game.events.on('poststep',()=>{const scene=game.scene.getScene('game');if(scene?.player&&scene.run&&!window.restored){window.restored={lives:scene.lives,run:{...scene.run},active:game.scene.isActive('game')};scene.physics.pause();scene.scene.pause();}});
 }});
 const controller=createPaidContinueController({prepare:i=>post('prepare',i),activate:i=>post('activate',i),getSession:()=>session,prepareNativeRun:prepareAuthorizedContinue,render});
 window.resume=()=>controller.resume({paymentId,sequence:1});window.ready=true;
 </script>`;
 try{
  const context=await browser.newContext({viewport:{width:600,height:800}});
  await context.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith('https://tree-token.xyz/assets/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160"><rect width="640" height="160" fill="#23543a"/></svg>'});
   if(!url.startsWith(base)){blocked++;return route.abort();}
   const name=url.slice(base.length);
   if(['prepare','activate'].includes(name)){
    if(name==='activate')activations++;else preparations++;
    const req=route.request();
    const response=await handlers[name](new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),body:req.postData()}));
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   const files={'controller.mjs':'scripts/multichain/browser/paid-continue-controller.mjs','renderer.mjs':'scripts/multichain/browser/native-continue-renderer.mjs','native.mjs':'docs/multichain/generation-milestone/browser-restoration/upstream/authorized-continue-resume.mjs','progress.mjs':'docs/multichain/generation-milestone/browser-restoration/upstream/progress.mjs'};
   return route.fulfill({contentType:name?'application/javascript':'text/html',body:!name?html:name==='game.mjs'?moduleText:fs.readFileSync(files[name],'utf8')});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await page.waitForFunction(()=>window.ready);
  const result=await page.evaluate(()=>Promise.all([resume(),resume()]));assert.equal(result.filter(x=>x.status==='restored').length,1);
  await page.waitForFunction(()=>window.restored,{},{timeout:15000});
  const restored=await page.evaluate(()=>window.restored);assert.equal(restored.lives,3);assert.equal(restored.run.runId,session.nativeRunId);assert.equal(restored.run.score,55);assert.equal(restored.run.wave,2);assert.equal(restored.active,true);assert.equal(await page.evaluate(()=>window.mounts),1);assert.equal(await page.locator('canvas').count(),1);
  assert.equal(activations,1);assert.equal(preparations,1);assert.deepEqual(errors,[]);
  await page.evaluate(()=>game.destroy(true));await page.waitForFunction(()=>document.querySelectorAll('canvas').length===0);
  await page.reload();await page.waitForFunction(()=>window.ready);assert.equal((await page.evaluate(()=>resume())).status,'review-required');assert.equal(await page.evaluate(()=>window.mounts),0);assert.equal(activations,1);assert.equal(blocked,0);
  return {browser:browser.version(),lives:restored.lives,score:restored.run.score,wave:restored.run.wave,mounts:1,activations,refreshBlocked:true,teardownVerified:true,liveRequests:0,foreignCredentialDenied:true,transport:'strict Fetch handler with native bearer hash',assets:'explicit placeholder textures; artwork not validated'};
 }finally{await browser.close();}
}
