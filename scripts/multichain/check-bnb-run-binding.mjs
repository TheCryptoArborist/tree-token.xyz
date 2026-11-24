// Read-only RPC check using the existing production binding, only in CI memory.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {apiClient} from '../release-sti-purchase.mjs';import {readToken,fingerprint} from '../release-preserved-production.mjs';
import {runtimeConfiguration} from '../../netlify/bnb-test-functions/arcade-bnb-test.mjs';
import {createRunRpc} from './bnb-run-http.mjs';import {createBnbTestRpc} from './bnb-test-auth-service.mjs';
const site='aa62f324-b880-47d6-85b8-4ba0700ff5bf',account='69800888d1a3d0483003ae9e';
export function productionValues(siteRows,sharedRows){
 const values=new Map();for(const rows of [sharedRows,siteRows])for(const r of rows){
  if(!r.scopes?.includes('functions'))continue;
  if(!['BNB_TEST_SUPABASE_URL','BNB_TEST_SUPABASE_SECRET_KEY','TREE_KNOWLEDGE_TRIAL_SUPABASE_URL','TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY','BNB_RUN_REVIEW_ENABLED'].includes(r.key))continue;
  const matches=r.values.filter(v=>v.context==='production'||v.context==='all');
  const exact=matches.filter(v=>v.context==='production');const chosen=exact.length?exact:matches;
  assert(chosen.length===1&&typeof chosen[0].value==='string','Unresolved production binding');values.set(r.key,chosen[0].value);
 }
 assert(values.get('BNB_RUN_REVIEW_ENABLED')!=='true','Review endpoint already enabled');return values;
}
export async function main(){
 const api=apiClient(readToken()),url=`accounts/${account}/env`;
 const get=()=>Promise.all([api(url+`?site_id=${site}&scope=functions`),api(url+'?scope=functions')]);
 const before=await get();
 console.log('Binding metadata '+JSON.stringify(before.flat().filter(r=>['BNB_TEST_SUPABASE_URL','BNB_TEST_SUPABASE_SECRET_KEY','TREE_KNOWLEDGE_TRIAL_SUPABASE_URL','TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY','BNB_RUN_REVIEW_ENABLED'].includes(r.key)).map(r=>({key:r.key,scopes:r.scopes,secret:r.is_secret,values:r.values.map(v=>({context:v.context,hasValue:typeof v.value==='string'}))}))));
 const values=productionValues(...before),c=runtimeConfiguration(n=>values.get(n));
 console.log('Production binding resolved');
 // Never print credentials or API response bodies. Calls are restricted to reads.
 const run=createRunRpc({url:c.getEnv('BNB_TEST_SUPABASE_URL'),key:c.getEnv('BNB_TEST_SUPABASE_SECRET_KEY')});
 const identity=createBnbTestRpc({getEnv:c.getEnv});
 assert.equal(await run('arcade_bnb_run_review_v1',{p_action:'read',p_data:{hash:'0'.repeat(64)}}),null);
 assert.equal(await identity('arcade_bnb_test_read_session_v1',{p_token_sha256:'0'.repeat(64)}),null);
 assert.equal(fingerprint(await get()),fingerprint(before),'Binding changed during check');
 const r=await fetch('https://tree-token.xyz/api/arcade-bnb-test/run-review',{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'review-disabled',gameplayAuthorized:false});
 const report={checkedAt:new Date().toISOString(),project:'lehswszuekjqottolmsf',sameProductionBinding:true,runRpcMissingTicket:null,identityRpcMissingSession:null,configurationUnchanged:true,canonicalStatus:503,enabled:false,userRowsWritten:0,credentialsSaved:false,execution:'GitHub CI using production binding; not an enabled Netlify request',gameplayAuthorized:false};
 fs.mkdirSync('/tmp/bnb-binding-result',{recursive:true});fs.writeFileSync('/tmp/bnb-binding-result/verified.json',JSON.stringify(report,null,2)+'\n');console.log('BNB_BINDING_VERIFIED '+JSON.stringify(report));
}
if(process.argv[1]?.endsWith('/check-bnb-run-binding.mjs'))main().catch(()=>{console.error('Binding verification failed; credentials and response details withheld.');process.exitCode=1;});
