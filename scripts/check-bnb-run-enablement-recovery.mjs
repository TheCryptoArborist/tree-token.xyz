// Retire this task's incomplete, unpublished upload; verify original live state.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {capture,SITE} from './prepare-bnb-run-release.mjs';
import {fingerprint,readToken} from './release-preserved-production.mjs';
import {apiClient} from './release-sti-purchase.mjs';
const ID='6b05e3d127c690a986593ce7',LIVE='6b053b8285e0ee251b84ad06';
const api=apiClient(readToken()),plan=JSON.parse(fs.readFileSync('docs/multichain/generation-milestone/run-enablement/plan.json'));
const d=await api('deploys/'+ID);assert.equal(d.site_id,SITE);assert(!d.published_at&&!d.locked);assert.equal(d.required_functions.length,61);
const before=await capture(api,LIVE);assert.equal(fingerprint(before),fingerprint(plan.baseline),'Original protected baseline not restored');
let cancellation;
try{await api(`deploys/${ID}/cancel`,'POST');cancellation='requested';}catch{cancellation='not accepted; unpublished upload retained';}
const after=await capture(api,LIVE);assert.equal(fingerprint(after),fingerprint(plan.baseline));
const r=await fetch('https://tree-token.xyz/api/arcade-bnb-test/run-review',{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'review-disabled',gameplayAuthorized:false});
const final=await api('deploys/'+ID);assert(!final.published_at&&!final.locked);
console.log('BNB_ENABLEMENT_RECOVERY '+JSON.stringify({checkedAt:new Date().toISOString(),baselineId:LIVE,baselineHash:fingerprint(after),candidateId:ID,candidateState:final.state,cancellation,requiredFunctions:61,environmentRestored:true,productionUnchanged:true,endpointStatus:503,gameplayAuthorized:false}));
