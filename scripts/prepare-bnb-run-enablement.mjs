// Read-only preparation: no environment mutation, publication or database writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {capture,readOnly,SITE,ROUTES,TRAFFIC} from './prepare-bnb-run-release.mjs';
import {apiClient} from './release-sti-purchase.mjs';
import {readToken,fingerprint} from './release-preserved-production.mjs';
import {functionsConfig,packageTrafficRules} from './release-arcade-cutoff.mjs';
export const LIVE='6b053b8285e0ee251b84ad06';
export function enablementPlan(baseline,backing){
 assert.equal(baseline.deploy.id,LIVE);assert.equal(baseline.deploy.locked,true);
 assert.equal(Object.keys(baseline.files).length,691);assert.equal(baseline.deploy.available_functions.length,61);assert.equal(baseline.deploy.function_schedules.length,5);
 assert(!baseline.deploy.available_functions.some(f=>f.n==='arcade-bnb-binding-audit'),'Never publish diagnostic handler');
 const cfg=functionsConfig(baseline.deploy),f=cfg['arcade-bnb-run-review'];assert(f);
 assert.equal(fingerprint(f.routes),fingerprint(ROUTES.map(r=>({...r,prefer_static:false}))));assert.equal(fingerprint(f.traffic_rules),fingerprint(packageTrafficRules(TRAFFIC)));
 assert.equal(backing.result.backingEligible,false);assert.equal(backing.result.gameplayAuthorized,false);assert.equal(backing.result.reason,'generation-not-active-backed');assert.equal(backing.result.approvedGeneration,'1');
 return {schemaVersion:1,baselineId:LIVE,baseline,backing,
 environmentChanges:[{key:'BNB_RUN_REVIEW_GENERATION',value:'1',context:'production',scopes:['functions'],isSecret:false},{key:'BNB_RUN_REVIEW_ENABLED',value:'true',context:'production',scopes:['functions'],isSecret:false}],
 preservationRequest:{files:baseline.files,functions:Object.fromEntries(baseline.deploy.available_functions.map(f=>[f.n,f.d])),functions_config:cfg,function_schedules:baseline.deploy.function_schedules,draft:false,async:false,branch:baseline.deploy.branch},
 acceptance:{canonicalOrigin:'https://tree-token.xyz',path:'/api/arcade-bnb-test/run-review',noCookieStatus:401,missingSessionStatus:403,missingSessionError:'review-denied',gameplayAuthorized:false,ticketsIssued:0},
 scope:{generation:'1',readOnlyPreparation:true,environmentChanged:false,published:false,paymentsEnabled:false,gameplayAuthorized:false,newDeposits:false}};
}
export async function main(){
 const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const api=readOnly(apiClient(readToken())),baseline=await capture(api,LIVE);
 // Existing review flags must be absent, including shared/build settings, so
 // the next change can be an exact additive production/functions-only delta.
 const site=await api('sites/'+SITE);assert(!('BNB_RUN_REVIEW_ENABLED' in (site.build_settings.env||{})));assert(!('BNB_RUN_REVIEW_GENERATION' in (site.build_settings.env||{})));
 for(const p of ['accounts/69800888d1a3d0483003ae9e/env?site_id='+SITE,'accounts/69800888d1a3d0483003ae9e/env'])for(const row of await api(p))assert(!['BNB_RUN_REVIEW_ENABLED','BNB_RUN_REVIEW_GENERATION'].includes(row.key),'Unexpected existing review setting');
 execFileSync(process.execPath,['contracts/bnb-generation/scripts/check-generation-access.mjs',out+'/backing.json'],{stdio:'inherit',timeout:90000});
 const backing=JSON.parse(fs.readFileSync(out+'/backing.json'));
 const r=await fetch('https://tree-token.xyz/api/arcade-bnb-test/run-review',{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'review-disabled',gameplayAuthorized:false});assert(!r.headers.has('set-cookie'));
 assert.equal(fingerprint(await capture(api,LIVE)),fingerprint(baseline),'Production changed during planning');
 const plan={...enablementPlan(baseline,backing),preparedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
 fs.writeFileSync(out+'/plan.json',JSON.stringify(plan,null,2)+'\n');
 const result={baselineId:LIVE,planHash:fingerprint(plan),sourceCommit:plan.sourceCommit,preparedAt:plan.preparedAt,staticPaths:691,functions:61,schedules:5,backing:backing.result,...plan.scope};
 fs.writeFileSync(out+'/summary.json',JSON.stringify(result,null,2)+'\n');console.log('BNB_ENABLEMENT_PLAN '+JSON.stringify(result));
 // Sanitized capture contains hashes and provider metadata, never secret values.
 const packed=gzipSync(fs.readFileSync(out+'/plan.json')).toString('base64');for(let i=0;i<packed.length;i+=4000)console.log('BNB_ENABLEMENT_PLAN_CHUNK '+packed.slice(i,i+4000));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
