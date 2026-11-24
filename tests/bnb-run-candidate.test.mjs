import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {candidateAPI,uploads,compare,checkEndpoint} from '../scripts/create-bnb-run-candidate.mjs';
import {ROUTES,TRAFFIC,SITE} from '../scripts/prepare-bnb-run-release.mjs';
const plan=JSON.parse(fs.readFileSync('docs/multichain/generation-milestone/run-release/plan.json'));
function candidate(){const d=structuredClone(plan.baseline.deploy);d.id='a'.repeat(24);d.locked=false;d.published_at=null;d.available_functions.push({...d.available_functions[0],n:'arcade-bnb-run-review',d:plan.package.sha256,r:'nodejs24.x',im:'stream',ro:ROUTES.map(r=>({p:r.pattern,l:r.literal,e:null,m:[],ps:false})),tr:TRAFFIC});return d;}
test('exact preserved backend plus one inactive function passes',()=>assert.equal(compare(candidate(),plan.baseline,plan.package.sha256).n,'arcade-bnb-run-review'));
test('provider/runtime/schedule/admission drift and publication are rejected',()=>{
 for(const change of [d=>d.available_functions[0].oid='changed',d=>d.available_functions.pop(),d=>d.function_schedules.pop(),d=>d.functions_region='iad',d=>d.locked=true,d=>d.published_at='now',d=>d.available_functions.at(-1).r='nodejs22.x',d=>d.available_functions.at(-1).tr={},d=>d.available_functions.at(-1).ro=[]]){const d=candidate();change(d);assert.throws(()=>compare(d,plan.baseline,plan.package.sha256));}
});
test('upload allowlist refuses any old package or static file',()=>{const d={required:[],required_functions:[plan.package.sha256],required_edge_functions:[],required_server:[]};uploads(d,plan.package.sha256);for(const k of Object.keys(d)){const x=structuredClone(d);x[k]=['bad'];assert.throws(()=>uploads(x,plan.package.sha256));}});
test('candidate API has no lock, settings, restore or delete operations',async()=>{const calls=[];const a=candidateAPI(async p=>calls.push(p));await a(`sites/${SITE}/deploys?title=test`,'POST',{});for(const p of [`deploys/${'a'.repeat(24)}/lock`,`sites/${SITE}`,`sites/${SITE}/deploys/${'a'.repeat(24)}/restore`])assert.throws(()=>a(p,'POST',{}));assert.equal(calls.length,1);});
test('hosted smoke requires disabled responses and preserved auth denial',async()=>{
 const fetcher=async u=>Response.json(u.endsWith('/run-review')?{error:'review-disabled',gameplayAuthorized:false}:{error:'origin-denied',gameplayAuthorized:false},{status:u.endsWith('/run-review')?503:403,headers:{'Cache-Control':'no-store'}});
 assert.equal((await checkEndpoint('https://example.invalid',fetcher)).walletUsed,false);
 await assert.rejects(checkEndpoint('https://example.invalid',async()=>Response.json({gameplayAuthorized:true})));
});
