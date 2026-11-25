// Publish a fresh preservation snapshot with only reviewed generation-1 flags.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {capture,inventory,runtime,SITE,ACCOUNT} from './prepare-bnb-run-release.mjs';
import {LIVE} from './prepare-bnb-run-enablement.mjs';
import {fingerprint,readToken} from './release-preserved-production.mjs';
import {apiClient} from './release-sti-purchase.mjs';
import {waitForAllBuilds} from './release-arcade-cutoff.mjs';
const KEYS=['BNB_RUN_REVIEW_GENERATION','BNB_RUN_REVIEW_ENABLED'];
const eq=(a,b)=>assert.equal(fingerprint(a),fingerprint(b),'Preservation mismatch');
export function stripReviewedFlags(rows,site){
 const flags=rows.filter(r=>KEYS.includes(r.key));assert.equal(flags.length,site?2:0,'Unexpected review setting scope');
 for(const r of flags){assert.equal(r.is_secret,false);assert.deepEqual(r.scopes,['functions']);assert.equal(r.values.length,1);const v=r.values[0];assert.equal(v.context,'production');assert(!v.context_parameter);assert.equal(v.value,r.key===KEYS[0]?'1':'true');}
 return rows.filter(r=>!KEYS.includes(r.key));
}
export async function normalizedCapture(api,id){
 const normalized=async p=>{const value=await api(p);if(p.startsWith(`accounts/${ACCOUNT}/env`))return stripReviewedFlags(value,p.includes('site_id='+SITE));return value;};
 return capture(normalized,id);
}
export function compareCandidate(d,baseline){
 assert.equal(d.site_id,SITE);assert.equal(d.state,'ready');eq(d.available_functions,baseline.deploy.available_functions);eq(d.function_schedules,baseline.deploy.function_schedules);eq(runtime(d),runtime(baseline.deploy));
}
export async function checkEnabled(origin='https://tree-token.xyz'){
 const url=origin+'/api/arcade-bnb-test/run-review',headers={Origin:'https://tree-token.xyz','Content-Type':'application/json'};
 const checks=origin==='https://tree-token.xyz'?[{status:401,error:'invalid-session'},{status:403,error:'review-denied',cookie:'__Secure-tree_bnb_test=bnbtest_'+'0'.repeat(64)}]:[{status:403,error:'wrong-origin'}];
 for(const c of checks){const r=await fetch(url,{method:'POST',headers:{...headers,...(c.cookie?{Cookie:c.cookie}:{})},body:JSON.stringify({action:'issue'}),redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,c.status);assert.deepEqual(await r.json(),{error:c.error,gameplayAuthorized:false});assert(r.headers.get('cache-control')?.includes('no-store'));assert(!r.headers.has('set-cookie'));}
 return checks.map(({status,error})=>({status,error}));
}
export async function main(){
 const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const plan=JSON.parse(fs.readFileSync('docs/multichain/generation-milestone/run-enablement/plan.json'));
 assert.equal(plan.baselineId,LIVE);assert.equal(plan.scope.generation,'1');assert(Date.now()-Date.parse(plan.preparedAt)<3600000,'Refresh the preparation after one hour');
 const raw=apiClient(readToken());let candidateId;
 const api=(p,m='GET',b)=>{assert(m==='GET'||(m==='POST'&&(p.startsWith(`sites/${SITE}/deploys?title=`)||candidateId&&p===`deploys/${candidateId}/lock`)));return raw(p,m,b);};
 eq(await normalizedCapture(api,LIVE),plan.baseline);
 const d=await api(`sites/${SITE}/deploys?title=Generation%201%20read-only%20review`,'POST',plan.preservationRequest);candidateId=d.id;assert(/^[a-f0-9]{24}$/.test(candidateId)&&candidateId!==LIVE);assert(!d.published_at&&!d.locked);
 fs.writeFileSync(out+'/candidate.json',JSON.stringify({id:candidateId,baselineId:LIVE}));console.log('BNB_ENABLEMENT_CANDIDATE '+candidateId);
 for(const k of ['required','required_functions','required_edge_functions','required_server'])assert.equal(d[k].length,0,'Existing package unexpectedly missing');
 let ready;for(let i=0;i<90;i++){ready=await api('deploys/'+candidateId);if(ready.state==='ready')break;assert(!['error','canceled','rejected'].includes(ready.state));await new Promise(r=>setTimeout(r,1000));}
 const verify=async published=>{const d=await api('deploys/'+candidateId);compareCandidate(d,plan.baseline);eq(await inventory(api,candidateId),plan.baseline.files);assert.equal(Boolean(d.locked),published);assert.equal(Boolean(d.published_at),published);return d;};
 await verify(false);await checkEnabled(`https://${candidateId}--tree-token.netlify.app`);await waitForAllBuilds(api,candidateId);
 eq(await normalizedCapture(api,LIVE),plan.baseline);await verify(false);
 await api(`deploys/${candidateId}/lock`,'POST');
 const live=await normalizedCapture(api,candidateId),published=await verify(true);eq(live.files,plan.baseline.files);eq(live.protected,plan.baseline.protected);
 const checks=await checkEnabled();
 const auth=await fetch('https://tree-token.xyz/api/arcade-bnb-test',{method:'POST',headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json'},body:JSON.stringify({action:'entitlement'}),redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(auth.status,401);assert.equal((await auth.json()).error,'invalid-session');
 const result={id:candidateId,baselineId:LIVE,planHash:fingerprint(plan),publishedAt:published.published_at,locked:true,staticPaths:691,functions:61,schedules:5,environmentChanges:plan.environmentChanges,checks,existingAuthStatus:401,gameplayAuthorized:false,paymentsEnabled:false,authenticatedWalletTest:false};
 fs.writeFileSync(out+'/published.json',JSON.stringify(result,null,2)+'\n');console.log('BNB_ENABLEMENT_PUBLISHED '+JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
