// Scoped static-only update, bound to reviewed replacement hashes. Derived from the repository's preservation publisher.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync,execFileSync} from 'node:child_process';
import {DELIVERY_PATHS,REPLACED_HASHES,ADDED_PATHS,assembleFiles,assertPreserved} from './grove-chess-mobile-release-plan.mjs';
import {validateBackend,compareBackend,functionsConfig,waitForAllBuilds,storedPlayHTML} from './release-arcade-cutoff.mjs';
const root=process.cwd(),dir=path.join(root,'.netlify/grove-chess-mobile-release'),siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf',mode=process.argv[2];await fs.mkdir(dir,{recursive:true});
const token=process.env.NETLIFY_AUTH_TOKEN;assert(token,'Netlify release authorization is unavailable');assert(['candidate','verify','publish'].includes(mode));assert(!process.env.GROVE_CHESS_CABINET_FIXTURE,'Fixture checks cannot authorize release');assert(/^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT||''));assert(/^[a-f0-9]{24}$/.test(process.env.EXPECTED_DEPLOY||''),'A verified published baseline is required');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.SOURCE_COMMIT);
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Commit source before releasing');
const changes=Object.fromEntries(await Promise.all(DELIVERY_PATHS.map(async p=>[p,await fs.readFile(path.join(root,p.slice(1)))])));
const overlays=Object.fromEntries(Object.entries(changes).map(([p,b])=>[p,crypto.createHash('sha1').update(b).digest('hex')]));
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const sha=(x,algorithm='sha1')=>crypto.createHash(algorithm).update(x).digest('hex');
// Existing Netlify-injected, path-guarded Arcade link snippet. This digest was
// inspected from the candidate HTML, not inferred from a mismatch. Only these
// exact bytes may be removed for the delivery comparison; static hashes remain exact.
const preservedSnippetSHA256='bf05453dc91bcf9c53db98e08829c8321193495b0839021e68d458d56e5be98d';
async function api(p,method='GET',body,binary=false){const r=await fetch('https://api.netlify.com/api/v1/'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':binary?'application/octet-stream':'application/json'},body:body===undefined?undefined:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});if(!r.ok){
 // Preserve only bounded provider error fields, never request headers or payloads.
 const error=await r.json().catch(()=>({}));
 const detail=Object.fromEntries(['code','message','error'].filter(k=>typeof error[k]==='string'||typeof error[k]==='number').map(k=>[k,String(error[k]).slice(0,1000)]));
 throw Error('Netlify request failed: '+r.status+' '+p+' '+JSON.stringify(detail));
}return r.json();}
async function readDeploy(id){const d=await api(`sites/${siteId}/deploys/${id}`);assert.equal(d.id,id);assert.equal(d.site_id,siteId);assert(Array.isArray(d.available_functions),'Full function inventory unavailable; publication refused');assert(Array.isArray(d.function_schedules),'Schedule inventory unavailable; publication refused');if(d.state==='ready')validateBackend(d);return d;}
function immutableOrigin(d){const origin=d.links?.permalink;assert(origin&&new URL(origin).protocol==='https:'&&new URL(origin).hostname===`${d.id}--tree-token.netlify.app`,'Immutable TREE deployment permalink required');return origin;}
async function inventory(id){const files={};for(let p=1;p<=100;p++){const rows=await api(`deploys/${id}/files?per_page=100&page=${p}`);assert(Array.isArray(rows));for(const f of rows){assert(f.path&&f.sha);files[f.path]=f.sha;}if(rows.length<100)return files;}throw Error('Inventory pagination exhausted; refuse publication');}
const configs=functionsConfig;
async function noBuilds(candidateId){await waitForAllBuilds(api,candidateId);}
async function environmentHash(site){const rows=await api('accounts/'+site.account_id+'/env?site_id='+siteId);assert(Array.isArray(rows));const normalized=rows.map(row=>({...row,scopes:[...row.scopes].sort(),values:[...row.values].sort((a,b)=>String(a.id).localeCompare(String(b.id)))})).sort((a,b)=>a.key.localeCompare(b.key));return sha(canonical(normalized),'sha256');}
async function snippetConfigurationHash(){const snippets=await api(`sites/${siteId}/snippets`);assert(Array.isArray(snippets),'Snippet configuration unavailable');return sha(canonical(snippets),'sha256');}
async function browserCheck(origin,label){
 const run=spawnSync(process.execPath,['scripts/check-grove-chess-page.mjs'],{cwd:root,env:{...process.env,GROVE_CHESS_TEST_BASE:origin},stdio:'inherit',timeout:180000});
 assert.equal(run.status,0,label+' browser checks failed');
 const mobile=spawnSync(process.execPath,['scripts/check-grove-chess-mobile.mjs'],{cwd:root,env:{...process.env,GROVE_CHESS_TEST_BASE:origin},stdio:'inherit',timeout:180000});
 assert.equal(mobile.status,0,label+' mobile scroll checks failed');
 const report=JSON.parse(await fs.readFile('.netlify/grove-chess-browser-checks.json','utf8'));
 assert(report.results.length===4&&report.results.every(x=>x.passed),'Incomplete browser checks');

}
let state;
if(mode==='candidate'){
 assert(!await fs.stat(dir+'/state.json').catch(()=>null),'Candidate state exists; verify it instead');
 await noBuilds();const site=await api('sites/'+siteId),baseline=await readDeploy(site.published_deploy.id);assert.equal(baseline.state,'ready');validateBackend(baseline);assert.equal(baseline.id,process.env.EXPECTED_DEPLOY,'Published baseline changed');assert(baseline.locked,'Production must remain locked');assert.equal(baseline.available_functions.length,62,'Unexpected backend inventory; reassess first');assert.equal(baseline.function_schedules.length,5);
 const originalFiles=await inventory(baseline.id),files=assembleFiles(originalFiles,overlays);
 // The existing lobby can already contain this snippet in its stored source in
 // addition to Netlify's delivery insertion. Only confirm the inspected snippet
 // is already present there; do not apply the NEW Grove Chess's one-insertion rule to
 // an untouched historical page. Every stored lobby byte remains hash-protected.
 const baselineHTML=await fetch(new URL('/play/',immutableOrigin(baseline)),{signal:AbortSignal.timeout(30000)});assert(baselineHTML.ok);
 const baselineSnippets=[...(await baselineHTML.text()).matchAll(/<script id="tree-arcade-arboretum-link">[\s\S]*?<\/script>/g)];
 assert(baselineSnippets.some(match=>sha(match[0],'sha256')===preservedSnippetSHA256),'Inspected site snippet is not present in the published baseline');
 console.log(JSON.stringify({baselineSnippetOccurrences:baselineSnippets.length,inspectedSnippetAlreadyPresent:true}));
 const buildSettingsHash=sha(canonical(site.build_settings),'sha256'),protectedEnvironmentHash=await environmentHash(site),snippetConfigHash=await snippetConfigurationHash();
 const latest=await api('sites/'+siteId);assert.equal(latest.published_deploy.id,baseline.id);assert.equal(latest.published_deploy.locked,true);
 const d=await api(`sites/${siteId}/deploys?title=Grove%20Chess%20mobile%20board%20and%20scroll%20stability`,'POST',{files,functions:Object.fromEntries(baseline.available_functions.map(f=>[f.n,f.d])),functions_config:configs(baseline),function_schedules:baseline.function_schedules,draft:false,async:false,branch:baseline.branch,commit_ref:process.env.SOURCE_COMMIT});
 state={id:d.id,baseline,files,originalFiles,overlays,buildSettingsHash,protectedEnvironmentHash,snippetConfigHash,sourceCommit:process.env.SOURCE_COMMIT};await fs.writeFile(dir+'/state.json',JSON.stringify(state));for(const key of ['required','required_functions','required_edge_functions','required_server'])assert(Array.isArray(d[key]),'Missing upload inventory: '+key);for(const key of ['required_functions','required_edge_functions','required_server'])assert.equal(d[key].length,0,'Non-static uploads prohibited: '+key);console.log(JSON.stringify({candidateId:d.id,baselineId:baseline.id,originalStaticPaths:Object.keys(originalFiles).length,newStaticPaths:ADDED_PATHS.length,changedStaticPaths:Object.keys(REPLACED_HASHES).length,functions:baseline.available_functions.length,schedules:baseline.function_schedules.length}));
 for(const hash of d.required||[]){const p=Object.keys(changes).find(p=>files[p]===hash);assert(p,'Unexpected existing file requested');await api(`deploys/${d.id}/files/${p.slice(1)}`,'PUT',changes[p],true);}
}else state=JSON.parse(await fs.readFile(dir+'/state.json','utf8'));
assert.equal(state.sourceCommit,process.env.SOURCE_COMMIT);assert.equal(state.baseline.id,process.env.EXPECTED_DEPLOY);assert.equal(canonical(state.overlays),canonical(overlays),'Source differs from candidate');assertPreserved(state.originalFiles,state.files,overlays);assert.notEqual(state.id,state.baseline.id);
let d;for(let i=0;i<60;i++){d=await readDeploy(state.id);if(d.state==='ready')break;assert.notEqual(d.state,'error','Candidate failed');await new Promise(r=>setTimeout(r,1000));}assert.equal(d.state,'ready');
async function preserve(){d=await readDeploy(state.id);assert.equal(d.state,'ready');assertPreserved(state.originalFiles,await inventory(d.id),overlays);compareBackend(d,state.baseline);assert.equal(await snippetConfigurationHash(),state.snippetConfigHash,'Site snippets changed');}

await preserve();
async function verifyDelivery(origin){for(const [p,digest]of Object.entries(state.overlays)){const r=await fetch(new URL(p,origin),{signal:AbortSignal.timeout(30000)});assert(r.ok,'Grove Chess path unavailable: '+p);const bytes=Buffer.from(await r.arrayBuffer());if(p.endsWith('.html')){assert.equal(sha(storedPlayHTML(bytes,digest)),digest,'Grove Chess HTML differs beyond the exact preserved site snippet');}else assert.equal(sha(bytes),digest,'Grove Chess bytes mismatch: '+p);}}
if(mode==='verify'){await noBuilds(state.id);const origin=immutableOrigin(d);await verifyDelivery(origin);await browserCheck(origin,'candidate');await preserve();state.verified=true;await fs.writeFile(dir+'/state.json',JSON.stringify(state));}
if(mode==='publish'){
 assert.equal(state.verified,true,'Candidate delivery and browser checks required');await noBuilds(state.id);const site=await api('sites/'+siteId);assert.equal(site.published_deploy.id,state.baseline.id,'Concurrent publication detected');assert.equal(sha(canonical(site.build_settings),'sha256'),state.buildSettingsHash);assert.equal(await environmentHash(site),state.protectedEnvironmentHash,'Protected environment changed');await preserve();
 assert(!d.published_at,'Candidate already published; inspect before continuing');assert.equal(site.published_deploy.locked,true);
 await api('deploys/'+d.id+'/lock','POST');assert.equal((await api('sites/'+siteId)).published_deploy.id,d.id);d=await readDeploy(d.id);assert.equal(d.locked,true);await preserve();console.log(JSON.stringify({published:true,deployId:d.id,locked:true}));
 await verifyDelivery('https://tree-token.xyz');await browserCheck('https://tree-token.xyz','canonical');
 const finalSite=await api('sites/'+siteId);assert.equal(finalSite.published_deploy.id,d.id);assert.equal(sha(canonical(finalSite.build_settings),'sha256'),state.buildSettingsHash);assert.equal(await environmentHash(finalSite),state.protectedEnvironmentHash);await preserve();
}
const report={id:d.id,baseline:state.baseline.id,mode,state:d.state,sourceCommit:state.sourceCommit,staticPaths:Object.keys(state.files).length,preservedStaticPaths:Object.keys(state.originalFiles).length-Object.keys(REPLACED_HASHES).length,functionsPreserved:d.available_functions.length,schedulesPreserved:d.function_schedules.length,changedExistingPaths:Object.keys(REPLACED_HASHES),addedPaths:ADDED_PATHS,walletsEnabled:true,cosmeticHoldingsReadOnly:true,trialGamesPerBrowser:2,nftreeRequiredAfterTrial:true,paymentsEnabled:false,onChainDeployments:false,otherGameAndWalletCodeUnchanged:true,siteSnippetConfigurationUnchanged:true,preservedSnippetSHA256,canonicalBrowserChecksPassed:mode==='publish',canonicalPath:'https://tree-token.xyz/play/grove-chess/',files:state.files};await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,files:undefined},null,2));
