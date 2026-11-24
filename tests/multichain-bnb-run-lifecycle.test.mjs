import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRunLifecycle, RUN_RULES} from '../scripts/multichain/bnb-run-lifecycle.mjs';
import {BNB_ORIGIN, BNB_IDENTITY_SCOPE} from '../scripts/multichain/bnb-game-access-core.mjs';
import retired from '../docs/multichain/generation-milestone/review-acceptance/backing-observation.json' with {type:'json'};
const sha = s => createHash('sha256').update(s).digest('hex');
const sessionToken='bnbtest_'+'a'.repeat(64), ticket='bnbrun_'+'b'.repeat(64), wallet='0x'+'1'.repeat(40);
function setup({verifier=true}={}) {
 let now=1000000, row=null;
 const c={writes:0,proofCalls:0,session:{authenticated:true,revoked:false,origin:BNB_ORIGIN,scope:BNB_IDENTITY_SCOPE,chainId:56,wallet,expiresAt:new Date(now+3600000).toISOString()},advance:n=>now+=n};
 c.proof=()=>({backingEligible:true,gameplayAuthorized:false,wallet,approvedGeneration:'2',checkedAt:new Date(now).toISOString(),bnb:{generation:'2',state:2,canPlay:true,owner:wallet},sui:{eligible:true,generation:'2'}});
 // Only a unit-test double; independent PostgreSQL tests cover durable atomicity.
 const store={read:async()=>structuredClone(row),start:async q=>{c.writes++;return row??=( {...q,chainId:56,status:'active',revision:0,leaseUntil:now+15000,expiresAt:now+300000});},close:async()=>{if(row)row.status='closed';return true;},renew:async q=>{if(row.status!=='active'||row.revision!==q.revision)return null;row.revision++;row.leaseUntil=now+15000;return structuredClone(row);},finish:async q=>{if(row.status!=='active'||row.revision!==q.revision)return false;row.status='finished';row.score=q.score;return true;}};
 c.verifier=async({run})=>({verified:true,runId:run.id,rules:run.rules,evidenceHash:'c'.repeat(64),score:123});
 c.service=createRunLifecycle({readSession:async h=>h===sha(sessionToken)?structuredClone(c.session):null,store,assess:async()=>{c.proofCalls++;return c.proof();},approvedGeneration:'2',clock:()=>now,...(verifier?{verifyCompletion:q=>c.verifier(q)}:{})});
 c.start=(patch={})=>c.service.start({sessionToken,ticket,origin:BNB_ORIGIN,...patch});
 c.renew=(patch={})=>c.service.renew({sessionToken,runId:sha(ticket),origin:BNB_ORIGIN,...patch});
 c.finish=(patch={})=>c.service.finish({sessionToken,runId:sha(ticket),origin:BNB_ORIGIN,evidence:{score:99999999},...patch});
 c.row=()=>row;return c;
}
test('verified fixture score comes from server verifier, never client score; no game grant',async()=>{const c=setup();const r=await c.start();assert.equal(r.gameplayAuthorized,false);assert.equal(r.reviewOnly,true);c.advance(5000);await c.renew();const f=await c.finish();assert.equal(f.score,123);assert.equal(f.gameplayAuthorized,false);assert.equal(c.proofCalls,3);await assert.rejects(c.finish());});
test('missing production verifier denies every score',async()=>{const c=setup({verifier:false});await c.start();await assert.rejects(c.finish(),/unverified-score/);assert.equal(c.row().status,'active');});
for(const [name,change] of [
 ['revocation',c=>c.session.revoked=true],['logout',c=>c.session.authenticated=false],['expiry',c=>c.advance(3600001)],
 ['wrong chain',c=>c.session.chainId=1],['wrong scope',c=>c.session.scope='sui'],['wrong origin',c=>c.session.origin='https://evil.invalid'],
 ['wallet change',c=>c.session.wallet='0x'+'2'.repeat(40)]
])test(name+' denies run actions',async()=>{const c=setup();await c.start();change(c);await assert.rejects(c.renew());await assert.rejects(c.finish());});
for(const [name,patch] of [
 ['retired backing',{backingEligible:false}],['stale generation',{approvedGeneration:'1'}],['stale read',{checkedAt:new Date(0).toISOString()}],
 ['client gameplay claim',{gameplayAuthorized:true}],['wrong owner',{bnb:{generation:'2',state:2,canPlay:true,owner:'0x'+'2'.repeat(40)}}],
 ['redemption lock',{bnb:{generation:'2',state:3,canPlay:false,owner:wallet}}],['missing custody',{sui:{eligible:false,generation:'2'}}]
])test(name+' terminally closes an existing run',async()=>{const c=setup();await c.start();const p=c.proof;c.proof=()=>({...p(),...patch});await assert.rejects(c.renew());assert.equal(c.row().status,'closed');c.proof=p;await assert.rejects(c.finish());await assert.rejects(c.start());});
test('RPC outage closes run; recovery cannot resurrect',async()=>{const c=setup();await c.start();c.proof=()=>{throw Error('RPC unavailable');};await assert.rejects(c.renew());assert.equal(c.row().status,'closed');});
test('recorded mainnet retired generation cannot allocate',async()=>{const c=setup();c.proof=()=>({...retired.result,checkedAt:new Date(1000000).toISOString()});await assert.rejects(c.start());assert.equal(c.writes,0);});
test('expired lease cannot renew or finalize',async()=>{const c=setup();await c.start();c.advance(15000);await assert.rejects(c.renew());await assert.rejects(c.finish());});
test('wrong origin, missing token and wrong session denied',async()=>{const c=setup();await assert.rejects(c.start({origin:'https://evil.invalid'}));await assert.rejects(c.start({sessionToken:''}));await assert.rejects(c.start({sessionToken:'bnbtest_'+'f'.repeat(64)}));assert.equal(c.writes,0);});
for(const [name,patch] of [['unverified',{verified:false}],['other run',{runId:'d'.repeat(64)}],['other rules',{rules:'old'}],['fractional score',{score:1.2}],['negative score',{score:-1}],['infinite score',{score:Infinity}],['bad evidence hash',{evidenceHash:'client'}]])test('reject completion '+name,async()=>{const c=setup();await c.start();const v=c.verifier;c.verifier=async q=>({...await v(q),...patch});await assert.rejects(c.finish(),/unverified-score/);assert.equal(c.row().status,'active');});
test('entitlement rechecked after delayed verifier, before final commit',async()=>{const c=setup();await c.start();const v=c.verifier;c.verifier=async q=>{const p=c.proof;c.proof=()=>({...p(),backingEligible:false});return v(q);};await assert.rejects(c.finish());assert.equal(c.row().status,'closed');});
test('unreviewed generation rejected at construction',()=>assert.throws(()=>createRunLifecycle({approvedGeneration:'0'})));
test('concurrent renewal while verifier runs rejects old-revision finalization',async()=>{const c=setup();await c.start();const v=c.verifier;c.verifier=async q=>{await c.renew();return v(q);};await assert.rejects(c.finish(),/finalization-denied/);assert.equal(c.row().status,'active');});
test('revocation during verification denies final commit',async()=>{const c=setup();await c.start();const v=c.verifier;c.verifier=async q=>{c.session.revoked=true;return v(q);};await assert.rejects(c.finish(),/invalid-session/);assert.equal(c.row().status,'active');});
test('assessment timestamp is not refreshed by slow reader completion',async()=>{const c=setup();const p=c.proof;c.proof=()=>{const stale=p();c.advance(6000);return stale;};await assert.rejects(c.start(),/stale-backing/);assert.equal(c.writes,0);});
