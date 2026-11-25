import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeContinueHost} from '../scripts/multichain/native-continue-host.mjs';
import {createNativeContinueTransport} from '../scripts/multichain/browser/native-continue-transport.mjs';
const origin='https://tree-token.xyz',session={sessionToken:'a'.repeat(64),nativeRunId:'grove-'+'b'.repeat(32),epoch:'first',expiresAt:Date.now()+60000};
const response=()=>Response.json({restoreAuthorized:false,status:'recorded'});
for(const action of ['bnb-challenge','bnb-open','bnb-reconcile','offer','record','recover','prepare','activate'])test('canonical '+action+' transport sends once without cookies or redirects',async()=>{
 let count=0;const transport=createNativeContinueTransport({origin,getSession:()=>session,fetch:async(url,options)=>{count++;assert.equal(url,origin+'/play/treeforce89/api/shared-continue-'+action);assert.equal(options.headers.Authorization,'Bearer '+session.sessionToken);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');return response();}});
 await transport[action]({runId:session.nativeRunId});assert.equal(count,1);
});
test('wallet/run epoch changes during request require review without retry',async()=>{
 let current={...session},calls=0;const transport=createNativeContinueTransport({origin,getSession:()=>current,fetch:async()=>{calls++;current={...current,epoch:'second'};return response();}});
 await assert.rejects(transport.record({}),/session-changed/);assert.equal(calls,1);
});
test('lost response and failed server response never retry or trigger another action',async()=>{
 for(const fail of [async()=>{throw Error('lost');},async()=>new Response('secret',{status:503})]){
 let calls=0;const transport=createNativeContinueTransport({origin,getSession:()=>session,fetch:async()=>{calls++;return fail();}});await assert.rejects(transport.activate({}));assert.equal(calls,1);
 }
});
test('reject preview host, wrong run, missing session and oversize payload before sending',async()=>{
 assert.throws(()=>createNativeContinueTransport({origin:'https://preview.netlify.app',getSession:()=>session}),/canonical/);
 const transport=createNativeContinueTransport({origin,getSession:()=>session,fetch:()=>assert.fail()});await assert.rejects(transport.offer({runId:'other'}));await assert.rejects(transport.record({data:'x'.repeat(3000)}));
 await assert.rejects(createNativeContinueTransport({origin,getSession:()=>null,fetch:()=>assert.fail()}).record({}));
});
test('record response cannot grant restoration',async()=>{
 const transport=createNativeContinueTransport({origin,getSession:()=>session,fetch:async()=>Response.json({restoreAuthorized:true})});await assert.rejects(transport.record({}),/invalid-continue-response/);
});
const digest='1'.repeat(64),identity='2'.repeat(64);
const dependencies={pool:{connect:()=>assert.fail('unexpected database access')},legacyHandler:async()=>new Response('legacy'),nativePaidService:{offer:()=>assert.fail()},verifyRuntime:()=>assert.fail(),checkOwnership:()=>assert.fail(),readTransaction:()=>assert.fail(),runtimeDigest:digest,databaseIdentity:identity};
const req=()=>new Request(origin+'/play/treeforce89/api/shared-continue-record',{method:'POST',headers:{origin,authorization:'Bearer '+session.sessionToken,'content-type':'application/json'},body:JSON.stringify({offerId:'a'.repeat(48),digest:'D'.repeat(44)})});
test('host defaults to legacy with no database activity',async()=>{
 const host=createNativeContinueHost(dependencies);assert.equal((await host(req())).status,503);assert.equal(await (await host(new Request(origin+'/play/treeforce89/api/status'))).text(),'legacy');
});
test('host rejects drain evidence for another runtime or database',async()=>{
 for(const change of [{runtimeDigest:'3'.repeat(64)},{databaseIdentity:'3'.repeat(64)}]){
 const host=createNativeContinueHost({...dependencies,readMode:async()=> 'shared',readCutover:async()=>({legacyWritersDrained:true,paymentsPaused:true,runtimeDigest:digest,databaseIdentity:identity,checkedAt:Date.now(),expiresAt:Date.now()+30000,...change})});assert.equal((await host(req())).status,503);
 }
});
test('host rejects incomplete native binding',()=>{assert.throws(()=>createNativeContinueHost({...dependencies,runtimeDigest:''}),/verified-native-host-required/);});
test('expired session blocks before send and expiry during response requires review',async()=>{
 let now=session.expiresAt,calls=0;
 const transport=createNativeContinueTransport({origin,getSession:()=>session,clock:()=>now,fetch:async()=>{calls++;now=session.expiresAt;return response();}});
 await assert.rejects(transport.record({}),/native-session-required/);assert.equal(calls,0);
 now=session.expiresAt-1;await assert.rejects(transport.record({}),/session-changed/);assert.equal(calls,1);
});
test('changed shared run during response parsing is rejected',async()=>{
 let current={...session,runId:'first'};
 const transport=createNativeContinueTransport({origin,getSession:()=>current,fetch:async()=>({ok:true,json:async()=>{current={...current,runId:'second'};return {restoreAuthorized:false};}})});
 await assert.rejects(transport.recover({}),/session-changed/);
});
test('BNB signature transport permits bounded larger body and rejects restoration',async()=>{
 let calls=0;const transport=createNativeContinueTransport({origin,getSession:()=>session,fetch:async()=>{calls++;return response();}});
 await transport['bnb-open']({suiSignature:'A'.repeat(5000)});
 await assert.rejects(transport['bnb-open']({suiSignature:'A'.repeat(9000)}),/request-too-large/);assert.equal(calls,1);
 const bad=createNativeContinueTransport({origin,getSession:()=>session,fetch:async()=>Response.json({restoreAuthorized:true})});
 for(const action of ['bnb-challenge','bnb-open','bnb-reconcile'])await assert.rejects(bad[action]({}),/invalid-continue-response/);
});
