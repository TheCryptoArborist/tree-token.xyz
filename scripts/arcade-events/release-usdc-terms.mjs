import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {TERMS} from './core.mjs';

// This release changes only the closed workshop and its isolated draft handler.
// Apply and verify the additive USDC database migration before invoking it.
const root=path.resolve(import.meta.dirname,'../..');
const mode=process.argv[2]||'candidate',target=process.argv[3]||'preview';
assert(['candidate','verify','publish'].includes(mode),'Unknown release operation');
assert.equal(target,'preview','Only the closed event workshop may be released');
const dir=path.join(root,'.netlify/arcade-event-usdc-'+target);
fs.mkdirSync(dir,{recursive:true});
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
const handlerName='arcade-events';
const approvedPaths={
 '/play/events/preview/index.html':'production/arcade-events-static/index.html',
 '/scripts/arcade-events/core.mjs':'scripts/arcade-events/core.mjs',
 '/scripts/arcade-events/preview.mjs':'scripts/arcade-events/preview.mjs',
 '/scripts/arcade-events/server-controls.mjs':'scripts/arcade-events/server-controls.mjs',
 '/styles/arcade-events-preview-v1.css':'styles/arcade-events-preview-v1.css'
};
const canonical=x=>JSON.stringify(x,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
const sha=(bytes,algorithm='sha1')=>crypto.createHash(algorithm).update(bytes).digest('hex');
const PACKAGE=JSON.parse(fs.readFileSync(path.join(root,'.netlify/arcade-events-functions/manifest.json')));
assert.equal(PACKAGE.name,handlerName);
assert.equal(PACKAGE.runtimeVersion,'nodejs22.x');
assert.equal(PACKAGE.invocationMode,'stream');
assert.equal(sha(fs.readFileSync(path.join(root,PACKAGE.path)),'sha256'),PACKAGE.sha256,'Package bytes changed');
for(const source of PACKAGE.sourceFiles)assert.equal(sha(fs.readFileSync(path.join(root,source.path)),'sha256'),source.sha256,'Packaged source changed: '+source.path);
assert.equal(TERMS.version,2);
assert.equal(TERMS.currency,'USDC');
assert(/^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT||''),'A recorded source commit is required');
assert(/^[a-f0-9]{24}$/.test(process.env.EXPECTED_DEPLOY||''),'The expected locked baseline is required');

let token=process.env.NETLIFY_AUTH_TOKEN;
if(!token){const saved=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/netlify/config.json'))),auth=saved.users[saved.userId].auth;token=typeof auth==='string'?auth:auth.token;}
assert(token,'Netlify authorization is required');
async function api(resource,method='GET',body,binary=false){
 const response=await fetch('https://api.netlify.com/api/v1/'+resource,{method,headers:{Authorization:'Bearer '+token,'Content-Type':binary?'application/octet-stream':'application/json'},body:body===undefined?undefined:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Netlify '+response.status+' '+resource);
 return response.json();
}
async function inventory(id){
 const files={};
 for(let page=1;page<30;page++){
  const rows=await api(`deploys/${id}/files?per_page=100&page=${page}`);
  assert(Array.isArray(rows),'Invalid static inventory');
  for(const file of rows)files[file.path]=file.sha;
  if(rows.length<100)return files;
 }
 throw Error('Static inventory exceeded pagination limit');
}
function configs(deploy){
 return Object.fromEntries(deploy.available_functions.map(fn=>{
  const config={};
  for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',p:'priority',tr:'traffic_rules',mo:'memory',rgo:'region',vcpu:'vcpu',es:'event_subscriptions'}))if(fn[short]!=null)config[long]=fn[short];
  const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,value])=>value!=null));
  if(fn.ro)config.routes=fn.ro.map(route);
  if(fn.er)config.excluded_routes=fn.er.map(route);
  return [fn.n,config];
 }));
}
async function noBuilds(){
 // Check every returned page, including pages after the first short page.
 for(let page=1;page<=1000;page+=10){
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>api(`sites/${siteId}/deploys?per_page=100&page=${page+i}`)));
  let exhausted=false;
  for(const result of results){
   if(result.status==='rejected')throw result.reason;
   const rows=result.value;
   assert(Array.isArray(rows),'Invalid deployment listing');
   const active=rows.filter(deploy=>['new','pending_review','accepted','enqueued','building','uploading','uploaded','processing','prepared','retrying'].includes(deploy.state));
   assert(!active.length,'Active deployment; wait before publishing: '+active.map(deploy=>deploy.id+' '+deploy.state).join(', '));
   if(rows.length<100)exhausted=true;
  }
  if(exhausted)return;
 }
 throw Error('Deployment listing exceeded pagination limit; publication refused');
}
async function protectedEnvironmentHash(site){
 const rows=await api('accounts/'+site.account_id+'/env?site_id='+siteId);
 assert(Array.isArray(rows),'Invalid environment inventory');
 const normalized=[...rows].map(row=>({...row,scopes:[...row.scopes].sort(),values:[...row.values].sort((a,b)=>String(a.id).localeCompare(String(b.id)))})).sort((a,b)=>a.key.localeCompare(b.key));
 return sha(canonical(normalized),'sha256');
}
function normalizeAliases(fn,original){
 const normalized={...fn};
 for(const [override,effective]of [['mo','m'],['rgo','rg']])if(!Object.hasOwn(original,override)&&normalized[override]===original[effective])delete normalized[override];
 return normalized;
}
function verifyFunctions(deploy,baseline){
 assert.equal(canonical(deploy.available_functions.map(fn=>fn.n).sort()),canonical(baseline.available_functions.map(fn=>fn.n).sort()),'Function inventory changed');
 for(const original of baseline.available_functions){
  const current=normalizeAliases(deploy.available_functions.find(fn=>fn.n===original.n),original);
  if(original.n!==handlerName){assert.equal(canonical(current),canonical(original),'Unrelated function changed: '+original.n);continue;}
  assert.equal(current.d,PACKAGE.sha256,'Wrong event package');
  assert.equal(current.s,fs.statSync(path.join(root,PACKAGE.path)).size,'Wrong event package byte size');
  assert.equal(canonical(current.bd),canonical(PACKAGE.buildData),'Wrong event build metadata');
  // A new package receives new immutable provisioning identities and timestamps.
  // Execution/provider configuration outside these package fields stays exact.
  const packageFields=new Set(['d','id','oid','s','c','bd']);
  const stable=record=>Object.fromEntries(Object.entries(record).filter(([key])=>!packageFields.has(key)));
  assert.equal(canonical(stable(current)),canonical(stable(original)),'Event execution configuration changed');
 }
}
async function verifyConfiguration(origin){
 const response=await fetch(origin+'/api/arcade-events?action=configuration&release='+process.env.SOURCE_COMMIT,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
 assert(response.ok,'Event configuration did not respond successfully');
 const config=await response.json();
 assert.equal(config.status,'ok');
 assert.equal(config.access,'nftree-holder-only');
 assert.equal(config.draftFormatVersion,2);
 assert.equal(canonical(config.terms),canonical(TERMS),'Published event policy differs from packaged USDC terms');
 for(const flag of ['paymentEnabled','scoringEnabled','awardsEnabled'])assert.equal(config[flag],false,'Event must remain closed: '+flag);
 assert.equal(canonical(config.checks),canonical(['before-entry-payment','before-each-ranked-run']));
 return {termsVersion:config.terms.version,currency:config.terms.currency,paymentEnabled:false,scoringEnabled:false,awardsEnabled:false};
}
async function ready(id){
 for(let attempt=0;attempt<50;attempt++){
  const deploy=await api('deploys/'+id);
  if(deploy.state==='ready')return deploy;
  assert.notEqual(deploy.state,'error','Candidate deployment failed');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error('Candidate did not become ready');
}
async function verifyDeployment(deploy,state){
 assert.equal(canonical(await inventory(deploy.id)),canonical(state.files),'Static inventory changed');
 assert.equal(canonical(deploy.function_schedules),canonical(state.baseline.function_schedules),'Schedules changed');
 verifyFunctions(deploy,state.baseline);
 for(const key of ['functions_region','functions_region_overrides','branch','context','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations'])assert.equal(canonical(deploy[key]),canonical(state.baseline[key]),'Runtime changed: '+key);
}

let state;
if(mode==='candidate'){
 await noBuilds();
 const site=await api('sites/'+siteId),baseline=await api('deploys/'+site.published_deploy.id);
 assert.equal(baseline.id,process.env.EXPECTED_DEPLOY,'Published baseline changed');
 assert.equal(baseline.locked,true,'Published baseline must be locked');
 assert.equal(baseline.function_schedules.length,5);
 const originalHandler=baseline.available_functions.find(fn=>fn.n===handlerName);
 assert(originalHandler,'This replacement requires the existing event foundation');
 assert.equal(PACKAGE.runtimeVersion,originalHandler.r);
 assert.equal(PACKAGE.invocationMode,originalHandler.im);
 const route=r=>Object.fromEntries(Object.entries(r).filter(([,value])=>value!=null&&value!==false));
 assert.equal(canonical(PACKAGE.routes.map(route)),canonical(configs(baseline)[handlerName].routes.map(route)),'The event package changed its route');
 const traffic=JSON.parse(JSON.stringify(PACKAGE.trafficRules).replaceAll('"rateLimitConfig":','"rate_limit_config":').replaceAll('"windowLimit":','"window_limit":').replaceAll('"windowSize":','"window_size":'));
 assert.equal(canonical(traffic),canonical(originalHandler.tr),'The event package changed its rate limit');
 const files=await inventory(baseline.id),originalFiles={...files},changes={};
 for(const [publishedPath,sourcePath]of Object.entries(approvedPaths)){
  assert(Object.hasOwn(originalFiles,publishedPath),'This release may not add a static path: '+publishedPath);
  changes[publishedPath]=fs.readFileSync(path.join(root,sourcePath));
  files[publishedPath]=sha(changes[publishedPath]);
 }
 assert.deepEqual(Object.keys(originalFiles).filter(file=>files[file]!==originalFiles[file]&&!Object.hasOwn(approvedPaths,file)),[],'Unapproved existing static path changed');
 const functionsConfig=configs(baseline);
 functionsConfig[handlerName]={...functionsConfig[handlerName],build_data:PACKAGE.buildData,memory:originalHandler.mo??originalHandler.m,region:originalHandler.rgo??originalHandler.rg};
 const environmentHash=sha(canonical(site.build_settings),'sha256'),protectedEnvHash=await protectedEnvironmentHash(site);
 const deploy=await api(`sites/${siteId}/deploys?title=Canopy%20Crown%20USDC%20prize%20rules%20preview`,'POST',{files,functions:{...Object.fromEntries(baseline.available_functions.map(fn=>[fn.n,fn.d])),[handlerName]:PACKAGE.sha256},functions_config:functionsConfig,function_schedules:baseline.function_schedules,draft:false,async:false,branch:baseline.branch,commit_ref:process.env.SOURCE_COMMIT});
 assert(/^[a-f0-9]{24}$/.test(deploy.id),'Unexpected deploy identifier');
 state={id:deploy.id,baseline,files,originalFiles,environmentHash,protectedEnvHash,target,sourceCommit:process.env.SOURCE_COMMIT,packageSha256:PACKAGE.sha256};
 fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state));
 assert((deploy.required_functions||[]).every(hash=>hash===PACKAGE.sha256),'Unrelated function upload refused');
 for(const digest of deploy.required_functions||[]){
  assert.equal(digest,PACKAGE.sha256);
  const response=await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/functions/${handlerName}?runtime=${PACKAGE.runtimeVersion}&invocation_mode=${PACKAGE.invocationMode}`,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:fs.readFileSync(path.join(root,PACKAGE.path)),signal:AbortSignal.timeout(45000)});
  assert(response.ok,'Event function upload failed');
 }
 for(const hash of deploy.required||[]){
  const publishedPath=Object.keys(changes).find(file=>files[file]===hash);
  assert(publishedPath,'Unrelated static upload refused');
  await api(`deploys/${deploy.id}/files/${publishedPath.slice(1)}`,'PUT',changes[publishedPath],true);
 }
}else{
 state=JSON.parse(fs.readFileSync(path.join(dir,'state.json')));
 assert.equal(state.sourceCommit,process.env.SOURCE_COMMIT,'Release source changed');
 assert.equal(state.baseline.id,process.env.EXPECTED_DEPLOY,'Release baseline changed');
 assert.equal(state.packageSha256,PACKAGE.sha256,'Release package changed');
}

let deploy=await ready(state.id);
await verifyDeployment(deploy,state);
const candidateConfiguration=await verifyConfiguration(`https://${deploy.id}--tree-token.netlify.app`);
if(mode==='verify')await noBuilds();
let canonicalConfiguration;
if(mode==='publish'){
 await noBuilds();
 const site=await api('sites/'+siteId);
 assert.equal(site.published_deploy.id,state.baseline.id,'Concurrent publication');
 assert.equal((await api('deploys/'+state.baseline.id)).locked,true,'Baseline lock changed');
 assert.equal(sha(canonical(site.build_settings),'sha256'),state.environmentHash,'Build configuration changed');
 assert.equal(await protectedEnvironmentHash(site),state.protectedEnvHash,'Protected environment changed');
 await api('deploys/'+deploy.id+'/lock','POST');
 const published=await api('sites/'+siteId);
 assert.equal(published.published_deploy.id,deploy.id,'Wrong published deployment');
 deploy=await api('deploys/'+deploy.id);
 assert.equal(deploy.locked,true,'Published deployment is not locked');
 await verifyDeployment(deploy,state);
 assert.equal(sha(canonical(published.build_settings),'sha256'),state.environmentHash,'Build configuration changed during publication');
 assert.equal(await protectedEnvironmentHash(published),state.protectedEnvHash,'Protected environment changed during publication');
 canonicalConfiguration=await verifyConfiguration('https://tree-token.xyz');
}
const report={id:deploy.id,baseline:state.baseline.id,mode,state:deploy.state,target,sourceCommit:state.sourceCommit,staticPaths:Object.keys(state.files).length,preservedStaticPaths:Object.keys(state.originalFiles).filter(file=>state.originalFiles[file]===state.files[file]).length,changedPaths:Object.keys(state.originalFiles).filter(file=>state.originalFiles[file]!==state.files[file]),addedPaths:[],functionsPreserved:state.baseline.available_functions.length-1,replacedFunction:handlerName,previousPackageSha256:state.baseline.available_functions.find(fn=>fn.n===handlerName).d,packageSha256:PACKAGE.sha256,functionsTotal:deploy.available_functions.length,schedulesPreserved:deploy.function_schedules.length,eventExecutionConfigurationPreserved:true,buildConfigurationHash:state.environmentHash,protectedEnvironmentHash:state.protectedEnvHash,candidateConfiguration,canonicalConfiguration,existingWalletAndGameJavaScriptUnchanged:true,paidEntryEnabled:false,eventWorkshopOnly:true,nftreeOnly:true,terms:TERMS,databaseMigrationVerification:'Required separately before workflow dispatch',files:state.files};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined}));
