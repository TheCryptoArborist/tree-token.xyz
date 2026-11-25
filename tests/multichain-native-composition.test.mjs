import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createNativeContinueComposition} from '../scripts/multichain/native-continue-composition.mjs';
const token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex'),runId='grove-'+'b'.repeat(32);
const snapshot={runId,seed:1,score:5,wave:1,kills:0,perfect:0,maxStage:1,shotsFired:0,shotsHit:0,start:1,mode:'ARCADE'};
const inputs={record:{offerId:'b'.repeat(48),digest:'D'.repeat(44)},recover:{paymentId:'11111111-1111-4111-8111-111111111111'},offer:{runId,snapshot,lives:0}};
const req=(action,input,headers={})=>new Request('https://tree-token.xyz/play/treeforce89/api/shared-continue-'+action,{method:'POST',headers:{origin:'https://tree-token.xyz',authorization:'Bearer '+token,'content-type':'application/json',...headers},body:JSON.stringify(input)});
function setup(service){return createNativeContinueComposition({legacyHandler:()=>assert.fail('legacy called'),readMode:async()=> 'shared',readCutover:async()=>({legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:'1'.repeat(64),databaseIdentity:'2'.repeat(64),checkedAt:Date.now(),expiresAt:Date.now()+30000}),authorization:{prepare:service,activate:service},recordPayment:service,recoverPayment:service,nativeOffer:service});}
for(const action of Object.keys(inputs)){
 test(action+' authenticates, projects response and never grants restoration',async()=>{
  let calls=0;const gateway=setup(async input=>{calls++;assert.deepEqual(input,{...inputs[action],...(action==='offer'?{sessionToken:token}:{sessionHash:hash})});return {status:'recorded',offerId:'b'.repeat(48),sessionToken:token,checkpoint:{secret:true},restoreAuthorized:true,requiresPayment:true};});
  const response=await gateway(req(action,inputs[action]));assert.equal(response.status,200);const body=await response.json();assert.equal(body.restoreAuthorized,false);assert.equal(body.requiresPayment,false);assert(!JSON.stringify(body).includes(token));assert(!Object.hasOwn(body,'checkpoint'));assert.equal(calls,1);
 });
 test(action+' rejects browser identity, missing bearer, invalid fields and oversize bodies',async()=>{
  let calls=0;const gateway=setup(async()=>{calls++;});
  assert.equal((await gateway(req(action,{...inputs[action],wallet:'0x1'}))).status,400);
  assert.equal((await gateway(req(action,inputs[action],{authorization:''}))).status,401);
  assert.equal((await gateway(req(action,{}))).status,400);
  assert.equal((await gateway(req(action,{padding:'x'.repeat(3000)}))).status,400);assert.equal(calls,0);
 });
 test(action+' errors are review-only without credential or provider error exposure',async()=>{
  const response=await setup(async()=>{throw Error(token);})(req(action,inputs[action]));assert.equal(response.status,503);const body=await response.json();assert.equal(body.restoreAuthorized,false);assert.equal(body.requiresPayment,false);assert(!JSON.stringify(body).includes(token));
 });
}
test('offer rejects wrong-run checkpoint and nonzero lives before service',async()=>{
 const gateway=setup(()=>assert.fail());
 for(const input of [{...inputs.offer,lives:1},{...inputs.offer,snapshot:{...snapshot,runId:'grove-'+'c'.repeat(32)}},{...inputs.offer,snapshot:{...snapshot,shotsHit:1}}])assert.equal((await gateway(req('offer',input))).status,400);
});
test('composition requires every service',()=>{assert.throws(()=>createNativeContinueComposition({}),/complete-native-services-required/);});
test('shared mode requires a fresh trusted drain attestation; never falls back',async()=>{
 const now=100000;let calls=0;
 const valid={legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:'1'.repeat(64),databaseIdentity:'2'.repeat(64),checkedAt:now,expiresAt:now+30000};
 for(const proof of [null,{...valid,legacyWritersDrained:false},{...valid,paymentsPaused:false},{...valid,checkedAt:now-5001},{...valid,checkedAt:now+1},{...valid,expiresAt:now},{...valid,expiresAt:now+60001},{...valid,runtimeDigest:''}]){
  const fn=async()=>{calls++;};const gateway=createNativeContinueComposition({legacyHandler:()=>assert.fail(),readMode:async()=> 'shared',readCutover:async()=>proof,clock:()=>now,authorization:{prepare:fn,activate:fn},recordPayment:fn,recoverPayment:fn,nativeOffer:fn});
  assert.equal((await gateway(req('record',inputs.record))).status,503);
 }assert.equal(calls,0);
});
test('draining denies new payments but cannot cancel a previously admitted legacy request',async()=>{
 let mode='legacy',release;const pending=new Promise(resolve=>{release=resolve;});let calls=0;
 const fn=async()=>({});const gateway=createNativeContinueComposition({legacyHandler:async()=>{calls++;await pending;return new Response('legacy completed');},readMode:async()=>mode,authorization:{prepare:fn,activate:fn},recordPayment:fn,recoverPayment:fn,nativeOffer:fn});
 const legacy=new Request('https://tree-token.xyz/play/treeforce89/api/tree-continue',{method:'POST'});
 const inflight=gateway(legacy);await new Promise(resolve=>setImmediate(resolve));mode='draining';
 assert.equal((await gateway(legacy)).status,503);assert.equal(calls,1);release();assert.equal(await (await inflight).text(),'legacy completed');
 mode='shared';assert.equal((await gateway(req('record',inputs.record))).status,503);
});

const bnbInputs={'bnb-challenge':{payer:'0x'+'a'.repeat(40)},'bnb-open':{id:'b'.repeat(64),suiSignature:'YWJj',bnbSignature:'0x'+'c'.repeat(130)},'bnb-reconcile':{id:'b'.repeat(64),txHash:'0x'+'d'.repeat(64)}};
function bnbSetup(service,enabled=true){const fn=async()=>({});return createNativeContinueComposition({legacyHandler:()=>assert.fail('legacy called'),readMode:async()=> 'shared',readCutover:async()=>({legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:'1'.repeat(64),databaseIdentity:'2'.repeat(64),checkedAt:Date.now(),expiresAt:Date.now()+30000}),authorization:{prepare:fn,activate:fn},recordPayment:fn,recoverPayment:fn,nativeOffer:fn,...(enabled?{bnbCheckout:{challenge:service,open:service,reconcile:service}}:{})});}
for(const [action,input] of Object.entries(bnbInputs)){
 test(action+' derives credentials, projects response and forces review-only flags',async()=>{
  let calls=0;const gateway=bnbSetup(async got=>{calls++;assert.deepEqual(got,{...input,sessionToken:token,origin:'https://tree-token.xyz'});return {id:input.id,message:'link',paymentVerified:true,sessionToken:token,checkpoint:'secret',paymentEnabled:true,continueAuthorized:true,gameplayAuthorized:true,restoreAuthorized:true};});
  const res=await gateway(req(action,input));assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');const body=await res.json();
  for(const flag of ['paymentEnabled','continueAuthorized','gameplayAuthorized','restoreAuthorized','requiresPayment'])assert.equal(body[flag],false);
  assert.equal(body.reviewOnly,true);assert(!JSON.stringify(body).includes(token));assert(!('checkpoint' in body));assert.equal(calls,1);
 });
 test(action+' rejects injected identity and malformed requests before service',async()=>{
  let calls=0;const gateway=bnbSetup(async()=>{calls++;});
  for(const field of ['sessionToken','origin','runId','accountId','deliveryProtocol','amount'])assert.equal((await gateway(req(action,{...input,[field]:'injected'}))).status,400);
  assert.equal((await gateway(req(action,input,{authorization:''}))).status,401);
  assert.equal((await gateway(req(action,input,{origin:'https://evil.test'}))).status,403);
  assert.equal((await gateway(req(action,{}))).status,400);
  assert.equal((await gateway(req(action,{...input,padding:'x'.repeat(9000)}))).status,400);
  assert.equal(calls,0);
 });
 test(action+' unavailable or failing service never falls back or leaks provider errors',async()=>{
  for(const gateway of [bnbSetup(null,false),bnbSetup(()=>{throw Error('private-provider-secret');})]){
   const res=await gateway(req(action,input));assert.equal(res.status,503);const text=await res.text();assert(!text.includes('private-provider-secret'));assert.equal(JSON.parse(text).requiresPayment,false);
  }
 });
}
test('BNB open bounds signatures while allowing a larger valid envelope',async()=>{
 let calls=0;const gateway=bnbSetup(async()=>{calls++;return {};});
 assert.equal((await gateway(req('bnb-open',{...bnbInputs['bnb-open'],suiSignature:'A'.repeat(5000)}))).status,200);
 for(const patch of [{suiSignature:'A'.repeat(6001)},{suiSignature:'bad!'},{bnbSignature:'0x1234'}])assert.equal((await gateway(req('bnb-open',{...bnbInputs['bnb-open'],...patch}))).status,400);
 assert.equal(calls,1);
});
