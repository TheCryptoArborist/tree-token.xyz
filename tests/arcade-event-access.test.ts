import {test} from 'node:test';import assert from 'node:assert/strict';
import {NFTREE_TYPE} from '../netlify/lib/tree-nftree-overview.ts';
import {requireEventHolder} from '../netlify/lib/arcade-event-access.ts';
import {createEventHandler} from '../netlify/event-functions/arcade-events.ts';
const wallet='0x'+'a'.repeat(64),origin='https://tree-token.xyz',now=Date.parse('2026-11-11T18:00Z'),session={wallet,origin,revoked:false,expiresAt:new Date(now+60000).toISOString()};
const own=(patch:any={})=>({address:wallet,network:'sui-mainnet',nftreeType:NFTREE_TYPE,methodology:'canonical-nftree-direct-and-kiosk-cap-v2',nftreeCount:1,directCount:1,kioskCount:0,...patch});
test('direct and wallet-controlled Kiosk NFTrees qualify; other Arcade access does not',async()=>{
 for(const o of [own(),own({directCount:0,kioskCount:1})])assert.equal((await requireEventHolder(session,origin,async()=>o,()=>now)).nftreeCount,1);
 await assert.rejects(requireEventHolder(session,origin,async()=>own({nftreeCount:0,directCount:0,liquidityAccess:true,lockedTree:1000000}),()=>now),{code:'nftree-required',status:403});
 for(const patch of [{address:'0x'+'b'.repeat(64)},{nftreeType:'unrelated::NFT'},{network:'sui-testnet'},{nftreeCount:2},{nftreeCount:NaN},{nftreeCount:1,directCount:0,kioskCount:0},{methodology:'browser-asserted'}])await assert.rejects(requireEventHolder(session,origin,async()=>own(patch),()=>now),{code:'ownership-unavailable',status:503});
});
test('entry and subsequent ranked run must each obtain fresh ownership; transfer away blocks the next check',async()=>{
 let calls=0;const read=async()=>own(++calls===1?{}:{nftreeCount:0,directCount:0});
 await requireEventHolder(session,origin,read,()=>now);
 await assert.rejects(requireEventHolder(session,origin,read,()=>now),{code:'nftree-required'});assert.equal(calls,2);
});
test('chain failures and session expiry never fall back to prior eligibility',async()=>{
 await assert.rejects(requireEventHolder(session,origin,async()=>{throw Error('provider unavailable');},()=>now),{code:'ownership-unavailable'});
 for(const patch of [{revoked:true},{origin:'https://evil.example'},{expiresAt:new Date(now).toISOString()},{expiresAt:'invalid'}])await assert.rejects(requireEventHolder({...session,...patch},origin,async()=>own(),()=>now),{code:'invalid-session'});
 let clock=now;await assert.rejects(requireEventHolder(session,origin,async()=>{clock+=120000;return own();},()=>clock),{code:'invalid-session'});
});
const request=(action:string,method='GET',data?:any,headers:any={})=>new Request(`${origin}/api/arcade-events?action=${action}`,{method,headers:{Authorization:'Bearer '+'a'.repeat(64),Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
test('eligibility handler binds signed-in wallet and never opens entry or requests a payment',async()=>{
 let reads=0;const handler=createEventHandler({clock:()=>now,rpc:async(name:string)=>{assert.equal(name,'arcade_growth_read_session_v1');return session;},ownership:async(w:string)=>{reads++;assert.equal(w,wallet);return own();}});
 const response=await handler(request('eligibility')),data=await response.json();assert.equal(response.status,200);assert.equal(data.entryOpen,false);assert.equal(data.paymentEnabled,false);assert.equal(data.wallet,wallet);assert.equal(reads,1);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.has('access-control-allow-origin'),false);
 for(const h of [{Origin:'https://evil.example'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await handler(request('eligibility','GET',undefined,h))).status,403);
 assert.equal((await handler(request('eligibility','GET',undefined,{Authorization:''}))).status,401);
 assert.equal((await handler(request('entry'))).status,404);assert.equal((await handler(request('run-start'))).status,404);
});
test('organizer save canonicalizes fixed NFTree-only rules and rejects client launch/ownership assertions',async()=>{
 let saved:any;const handler=createEventHandler({clock:()=>now,rpc:async(name:string,args:any)=>{if(name==='arcade_growth_read_session_v1')return session;assert.equal(name,'arcade_event_save_draft_v1');saved=args;return {version:1,payment_enabled:false};}});
 const payload={draft:{id:'defend-the-canopy-01',title:'Defend the Canopy',gameId:'treeforce89'},expectedVersion:0};
 assert.equal((await handler(request('admin-save','POST',payload))).status,200);assert.equal(saved.p_expected_version,0);assert.equal(saved.p_draft.terms.access,'nftree-holder-only');assert.equal(saved.p_draft.paymentEnabled,false);
 for(const patch of [{paymentEnabled:true},{ownership:own()},{terms:{access:'public'}}])assert.equal((await handler(request('admin-save','POST',{...payload,draft:{...payload.draft,...patch}}))).status,400);
 assert.equal((await handler(request('admin-save','POST',{...payload,expectedVersion:-1}))).status,400);
});
