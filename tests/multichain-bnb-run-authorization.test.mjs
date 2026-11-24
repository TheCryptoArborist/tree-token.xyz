import test from 'node:test';import assert from 'node:assert/strict';import {createRunAuthorization} from '../scripts/multichain/bnb-run-authorization.mjs';
import {BNB_ORIGIN,BNB_IDENTITY_SCOPE} from '../scripts/multichain/bnb-game-access-core.mjs';import {createHash} from 'node:crypto';
const token='bnbtest_'+'a'.repeat(64),sha=s=>createHash('sha256').update(s).digest('hex'),wallet='0x'+'1'.repeat(40);
function setup(){
 let now=1000000,n=0;const rows=new Map(),s={authenticated:true,revoked:false,origin:BNB_ORIGIN,scope:BNB_IDENTITY_SCOPE,chainId:56,wallet,expiresAt:new Date(now+3600000).toISOString()};
 const ctx={s,rows,advance:ms=>now+=ms,checks:0,hook:()=>{}};
 // Test-only atomic store. NOT a production persistence implementation.
 const store={insert:async row=>{if(rows.has(row.hash))return false;rows.set(row.hash,structuredClone(row));return true;},read:async h=>structuredClone(rows.get(h)),consume:async q=>{ctx.hook();const r=rows.get(q.hash);if(!r||r.consumed||r.expiresAt<=now||s.revoked||Date.parse(s.expiresAt)<=now||s.wallet!==q.wallet||r.sessionHash!==q.sessionHash||r.generation!==q.generation)return false;r.consumed=true;return true;}};
 ctx.proof=()=>({backingEligible:true,gameplayAuthorized:false,wallet:s.wallet,approvedGeneration:'2',checkedAt:new Date(now).toISOString(),bnb:{generation:'2',state:2,canPlay:true,owner:s.wallet},sui:{eligible:true,generation:'2'}});
 ctx.service=createRunAuthorization({readSession:async h=>h===sha(token)?structuredClone(s):null,store,assess:async()=>{ctx.checks++;return ctx.proof();},approvedGeneration:'2',clock:()=>now,entropy:()=>Buffer.alloc(32,++n)});
 ctx.issue=()=>ctx.service.issue({sessionToken:token,origin:BNB_ORIGIN});ctx.consume=t=>ctx.service.consume({sessionToken:token,ticket:t,origin:BNB_ORIGIN});return ctx;
}
test('fresh session and backing checked twice; raw tokens not persisted; no game grant',async()=>{const c=setup(),t=await c.issue(),r=await c.consume(t.ticket);assert.equal(c.checks,2);assert(r.acceptedForReview);assert.equal(r.gameplayAuthorized,false);assert(!JSON.stringify([...c.rows.values()]).includes(token));await assert.rejects(c.consume(t.ticket));});
test('concurrent consumption has exactly one winner',async()=>{const c=setup(),t=await c.issue();const r=await Promise.allSettled([c.consume(t.ticket),c.consume(t.ticket)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);});
for(const [name,change]of [['expired',c=>c.advance(3600001)],['revoked',c=>c.s.revoked=true],['wrong scope',c=>c.s.scope='sui'],['wrong origin',c=>c.s.origin='https://evil.invalid'],['wrong chain',c=>c.s.chainId=1],['unauthenticated',c=>c.s.authenticated=false]])test('session denial: '+name,async()=>{const c=setup();change(c);await assert.rejects(c.issue());assert.equal(c.rows.size,0);});
test('expired ticket rejected',async()=>{const c=setup(),t=await c.issue();c.advance(60001);await assert.rejects(c.consume(t.ticket));});
test('revocation racing atomic consume rejected',async()=>{const c=setup(),t=await c.issue();c.hook=()=>c.s.revoked=true;await assert.rejects(c.consume(t.ticket));});
test('ownership loss after ticket issue rejected',async()=>{const c=setup(),t=await c.issue(),p=c.proof;c.proof=()=>({...p(),backingEligible:false});await assert.rejects(c.consume(t.ticket));});
test('different session cannot consume ticket',async()=>{const c=setup(),t=await c.issue();await assert.rejects(c.service.consume({sessionToken:'bnbtest_'+'b'.repeat(64),ticket:t.ticket,origin:BNB_ORIGIN}));});
for(const [name,patch]of [['stale proof',{checkedAt:new Date(0).toISOString()}],['wrong generation',{approvedGeneration:'1'}],['client grant',{gameplayAuthorized:true}],['wrong wallet',{wallet:'0x'+'2'.repeat(40)}]])test('reject '+name,async()=>{const c=setup(),p=c.proof;c.proof=()=>({...p(),...patch});await assert.rejects(c.issue());});
test('wrong HTTP origin rejected',async()=>{const c=setup();await assert.rejects(c.service.issue({sessionToken:token,origin:'https://evil.invalid'}));});
test('reader outage creates no ticket',async()=>{const c=setup();c.proof=()=>{throw Error('RPC unavailable')};await assert.rejects(c.issue());assert.equal(c.rows.size,0);});
import live from '../docs/multichain/generation-milestone/access-reader/live-denial.json' with {type:'json'};
test('recorded live retired backing cannot create run ticket',async()=>{const c=setup();c.proof=()=>({...live.result,checkedAt:new Date(1000000).toISOString()});await assert.rejects(c.issue());assert.equal(c.rows.size,0);});
test('ticket cannot cross generations',async()=>{const c=setup(),t=await c.issue();[...c.rows.values()][0].generation='1';await assert.rejects(c.consume(t.ticket));});
test('session wallet changed after issue rejected',async()=>{const c=setup(),t=await c.issue();c.s.wallet='0x'+'2'.repeat(40);await assert.rejects(c.consume(t.ticket));});
