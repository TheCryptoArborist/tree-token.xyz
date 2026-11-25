import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeContinueGateway} from '../scripts/multichain/native-continue-gateway.mjs';
import {createRestoreHttpHandler} from '../scripts/multichain/continue-restore-http.mjs';
const url='https://tree-token.xyz/play/treeforce89/api/';
const request=(name,options={})=>new Request(url+name,{method:'POST',headers:{origin:'https://tree-token.xyz'},...options});
const handlers=()=>Object.fromEntries(['bnb-record','complete','prepare','activate','record','recover','offer'].map(action=>[action,async()=>Response.json({action})]));
test('default preserves native requests and blocks shared routes',async()=>{
 let calls=0;const context={};const gateway=createNativeContinueGateway({legacyHandler:async(req,ctx)=>{assert.equal(ctx,context);calls++;return new Response('native');}});
 for(const name of ['status','tree-continue','tree-continue-offer','tree-continue-recover'])assert.equal(await (await gateway(request(name),context)).text(),'native');
 assert.equal((await gateway(request('shared-continue-activate'))).status,503);assert.equal(calls,4);
});
test('shared mode blocks every legacy payment route while preserving ordinary game paths',async()=>{
 let calls=0;const gateway=createNativeContinueGateway({legacyHandler:async()=>{calls++;return new Response('native');},sharedHandlers:handlers(),readMode:async()=> 'shared'});
 for(const name of ['tree-continue','tree-continue-offer','tree-continue-recover'])assert.equal((await gateway(request(name))).status,409);
 for(const action of ['bnb-record','complete','prepare','activate','record','recover','offer'])assert.equal((await (await gateway(request('shared-continue-'+action))).json()).action,action);
 assert.equal(calls,0);await gateway(request('status'));assert.equal(calls,1);
});
test('missing adapters, failed policy and handler errors never fall back',async()=>{
 for(const readMode of [async()=> 'unknown',async()=>{throw Error('secret');},async()=> 'shared']){
 const gateway=createNativeContinueGateway({legacyHandler:()=>{throw Error('must not fall back');},readMode});
 const response=await gateway(request('shared-continue-activate'));assert.equal(response.status,503);assert.equal((await response.json()).restoreAuthorized,false);
 }
 const sharedHandlers=handlers();sharedHandlers.activate=async()=>{throw Error('private details');};
 const response=await createNativeContinueGateway({legacyHandler:()=>assert.fail(),sharedHandlers,readMode:async()=> 'shared'})(request('shared-continue-activate'));
 assert.equal(response.status,503);assert(! (await response.text()).includes('private details'));
});
test('shared gateway rejects cross-origin, query and non-POST requests',async()=>{
 const gateway=createNativeContinueGateway({legacyHandler:()=>assert.fail(),sharedHandlers:handlers(),readMode:async()=> 'shared'});
 for(const req of [request('shared-continue-prepare?x=1'),request('shared-continue-prepare',{method:'GET'}),request('shared-continue-prepare',{headers:{origin:'https://evil.test'}})])assert.equal((await gateway(req)).status,403);
});
test('gateway composes real authenticated restore HTTP boundary',async()=>{
 let calls=0;const sharedHandlers=handlers();sharedHandlers.prepare=createRestoreHttpHandler({action:'prepare',authorization:{prepare:async input=>{calls++;assert.match(input.sessionHash,/^[a-f0-9]{64}$/);return {status:'prepared',restoreAuthorized:false};}}});
 const gateway=createNativeContinueGateway({legacyHandler:()=>assert.fail(),sharedHandlers,readMode:async()=> 'shared'});
 assert.equal((await gateway(request('shared-continue-prepare'))).status,401);
 const response=await gateway(request('shared-continue-prepare',{headers:{origin:'https://tree-token.xyz',authorization:'Bearer '+'a'.repeat(64),'content-type':'application/json'},body:JSON.stringify({runId:'11111111-1111-4111-8111-111111111111',paymentId:'22222222-2222-4222-8222-222222222222',clientKey:'b'.repeat(64)})}));
 assert.equal(response.status,200);assert.equal(calls,1);
});
