import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {createRestoreHttpHandler} from '../scripts/multichain/continue-restore-http.mjs';
import {createRestoreAuthorization} from '../scripts/multichain/continue-restore-authorization.mjs';
const token='a'.repeat(64),origin='https://tree-token.xyz';
const prepare={runId:randomUUID(),paymentId:randomUUID(),clientKey:'b'.repeat(64)};
const activate={runId:prepare.runId,clientKey:prepare.clientKey,leaseId:randomUUID(),checkpointHash:'c'.repeat(64),policyDigest:'d'.repeat(64),requestId:randomUUID()};
const request=(body=prepare,options={})=>new Request(options.url||origin+'/play/restore-test',{method:options.method||'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json',...options.headers},...((options.method||'POST')==='GET'?{}:{body:options.raw??JSON.stringify(body)})});
for(const action of ['prepare','activate'])test(action+' forwards only validated fields and bearer hash',async()=>{
 let received;const handler=createRestoreHttpHandler({action,authorization:{[action]:async input=>{received=input;return {restoreAuthorized:false};}}});
 const input=action==='prepare'?prepare:activate,r=await handler(request(input));assert.equal(r.status,200);
 assert.deepEqual(received,{...input,sessionHash:createHash('sha256').update(token).digest('hex')});
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);assert(!(await r.text()).includes(token));
});
const cases=[
 ['foreign origin',{headers:{origin:'https://evil.invalid'}},403],
 ['missing origin',{headers:{origin:''}},403],
 ['cross-site request',{headers:{'sec-fetch-site':'cross-site'}},403],
 ['preview host',{url:'https://preview.invalid/play/restore-test',headers:{origin:'https://preview.invalid'}},403],
 ['query credential',{url:origin+'/play/restore-test?token='+token},403],
 ['GET',{method:'GET'},405],
 ['no bearer',{headers:{authorization:''}},401],
 ['cookie is not authentication',{headers:{authorization:'',cookie:'session='+token}},401],
 ['hash supplied as identity',{body:{...prepare,sessionHash:token}},400],
 ['account supplied as identity',{body:{...prepare,accountId:randomUUID()}},400],
 ['policy supplied by browser',{body:{...prepare,enabled:true}},400],
 ['wrong media type',{headers:{'content-type':'application/jsonp'}},415],
 ['malformed JSON',{raw:'{'},400],
 ['array body',{body:[]},400],
 ['missing field',{body:{runId:prepare.runId}},400],
 ['invalid UUID',{body:{...prepare,runId:token}},400],
 ['oversize body without content length',{raw:' '.repeat(2049)},400],
];
for(const [name,options,status] of cases)test(name+' rejected before service call',async()=>{
 let calls=0;const handler=createRestoreHttpHandler({action:'prepare',authorization:{prepare:async()=>{calls++;}}});
 const r=await handler(request(options.body??prepare,options));assert.equal(r.status,status);assert.equal(calls,0);
 assert.equal((await r.json()).restoreAuthorized,false);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('WWW accepted only with matching origin',async()=>{
 const handler=createRestoreHttpHandler({action:'prepare',authorization:{prepare:async()=>({restoreAuthorized:false})}});
 assert.equal((await handler(request(prepare,{url:'https://www.tree-token.xyz/play/restore-test',headers:{origin:'https://www.tree-token.xyz'}}))).status,200);
 assert.equal((await handler(request(prepare,{url:'https://www.tree-token.xyz/play/restore-test'}))).status,403);
});
test('disabled actual authorization never reaches delivery',async()=>{
 let calls=0;const authorization=createRestoreAuthorization({delivery:{prepare:async()=>{calls++;},activate:async()=>{calls++;}}});
 for(const action of ['prepare','activate']){
  const r=await createRestoreHttpHandler({action,authorization})(request(action==='prepare'?prepare:activate));
  assert.equal((await r.json()).restoreAuthorized,false);
 }assert.equal(calls,0);
});
test('post-consumption failure is review-only without retry or leaked error',async()=>{
 let calls=0;const handler=createRestoreHttpHandler({action:'activate',authorization:{activate:async()=>{calls++;throw Error('SQL secret '+token);}}});
 const r=await handler(request(activate));assert.equal(r.status,503);assert.equal(calls,1);
 const text=await r.text();assert(!text.includes(token));assert(!text.includes('SQL'));const body=JSON.parse(text);assert.equal(body.requiresPayment,false);assert.equal(body.restoreAuthorized,false);assert.equal(body.status,'review-required');
});
test('chunked body limit enforced and reader cancelled',async()=>{
 let cancelled=false,calls=0;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1025));},cancel(){cancelled=true;}});
 const r=new Request(origin+'/play/restore-test',{method:'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json'},body:stream,duplex:'half'});
 const response=await createRestoreHttpHandler({action:'prepare',authorization:{prepare:async()=>{calls++;}}})(r);
 assert.equal(response.status,400);assert.equal(cancelled,true);assert.equal(calls,0);
});
