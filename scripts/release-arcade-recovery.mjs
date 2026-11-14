import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'.netlify/arcade-recovery-release');
fs.mkdirSync(dir,{recursive:true});
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf',name='arcade-monthly';
const token=process.env.NETLIFY_AUTH_TOKEN,source=process.env.SOURCE_COMMIT,expected=process.env.EXPECTED_DEPLOY;
assert(token,'Netlify release authorization is required');
assert(/^[a-f0-9]{40}$/.test(source||''),'A source commit is required');
assert(/^[a-f0-9]{24}$/.test(expected||''),'The expected locked deployment is required');
const pack=JSON.parse(fs.readFileSync(root+'/.netlify/arcade-monthly-functions/manifest.json'));
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const sha=(x,algo='sha256')=>crypto.createHash(algo).update(x).digest('hex');
async function api(p,method='GET',body,binary=false){
 const r=await fetch('https://api.netlify.com/api/v1/'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':binary?'application/octet-stream':'application/json'},body:body===undefined?undefined:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 assert(r.ok,'Netlify request failed: '+r.status+' '+p);return r.json();
}
async function inventory(id){const out={};for(let page=1;page<=100;page++){const rows=await api(`deploys/${id}/files?per_page=100&page=${page}`);assert(Array.isArray(rows));for(const f of rows){assert(typeof f.path==='string'&&typeof f.sha==='string');out[f.path]=f.sha;}if(rows.length<100)return out;}throw Error('Incomplete file inventory; release refused');}
function configs(d){return Object.fromEntries(d.available_functions.map(f=>{const c={};for(const [s,l]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',p:'priority',tr:'traffic_rules',mo:'memory',rgo:'region',vcpu:'vcpu',es:'event_subscriptions'}))if(f[s]!=null)c[l]=f[s];const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));if(f.ro)c.routes=f.ro.map(route);if(f.er)c.excluded_routes=f.er.map(route);return[f.n,c];}));}
async function noBuilds(){for(let page=1;page<=1000;page+=10){const pages=await Promise.all(Array.from({length:10},(_,i)=>api(`sites/${siteId}/deploys?per_page=100&page=${page+i}`)));let exhausted=false;for(const rows of pages){assert(Array.isArray(rows));const active=rows.filter(x=>['new','pending_review','accepted','enqueued','building','uploading','uploaded','processing','prepared','retrying'].includes(x.state));assert(!active.length,'Active deployment blocks publication: '+active.map(x=>x.id+' '+x.state).join(', '));if(rows.length<100)exhausted=true;}if(exhausted)return;}throw Error('Incomplete deploy listing; release refused');}
async function environmentHash(site){const rows=await api('accounts/'+site.account_id+'/env?site_id='+siteId);assert(Array.isArray(rows));return sha(canonical(rows.map(row=>({...row,scopes:[...row.scopes].sort(),values:[...row.values].sort((a,b)=>String(a.id).localeCompare(String(b.id)))})).sort((a,b)=>a.key.localeCompare(b.key))));}
assert.equal(pack.name,name);assert.equal(pack.runtimeVersion,'nodejs22.x');assert.equal(pack.invocationMode,'stream');
const bytes=fs.readFileSync(root+'/'+pack.path);assert.equal(sha(bytes),pack.sha256);
for(const f of pack.sourceFiles)assert.equal(sha(fs.readFileSync(root+'/'+f.path)),f.sha256,'Package/source mismatch: '+f.path);
await noBuilds();
const site=await api('sites/'+siteId),baseline=await api('deploys/'+site.published_deploy.id);
assert.equal(baseline.id,expected,'Production changed; recapture before release');assert.equal(baseline.locked,true);assert.equal(baseline.function_schedules.length,5);
const old=baseline.available_functions.find(f=>f.n===name);assert(old,'Recovery handler must already exist');assert.equal(old.r,pack.runtimeVersion);assert.equal(old.im,pack.invocationMode);assert.equal(canonical(old.bd),canonical(pack.buildData));
assert.equal(canonical(old.ro.map(r=>({pattern:r.p,literal:r.l,methods:r.m}))),canonical(pack.routes),'Do not change recovery routes');
const files=await inventory(baseline.id),buildHash=sha(canonical(site.build_settings)),envHash=await environmentHash(site);
assert(Object.keys(files).length>=513,'Unexpectedly incomplete production inventory');
const functionMap=Object.fromEntries(baseline.available_functions.map(f=>[f.n,f.d]));functionMap[name]=pack.sha256;
const candidate=await api(`sites/${siteId}/deploys?title=Fix%20paid%20Arcade%20check-in%20recovery`,'POST',{files,functions:functionMap,functions_config:configs(baseline),function_schedules:baseline.function_schedules,draft:false,async:false,branch:baseline.branch,commit_ref:source});
fs.writeFileSync(dir+'/state.json',JSON.stringify({id:candidate.id,baseline,files,sourceCommit:source,buildHash,envHash},null,2));
assert.equal((candidate.required||[]).length,0,'This backend-only release must not upload static files');
assert((candidate.required_functions||[]).every(h=>h===pack.sha256),'Unrelated function upload refused');
for(const h of candidate.required_functions||[])await api(`deploys/${candidate.id}/functions/${name}?runtime=${pack.runtimeVersion}&invocation_mode=${pack.invocationMode}`,'PUT',bytes,true);
let d;for(let i=0;i<60;i++){d=await api('deploys/'+candidate.id);if(d.state==='ready')break;assert.notEqual(d.state,'error');await new Promise(r=>setTimeout(r,1000));}assert.equal(d.state,'ready');
async function verifyInventory(deploy){
 assert.equal(canonical(await inventory(deploy.id)),canonical(files),'Static inventory changed');
 assert.equal(canonical(deploy.function_schedules),canonical(baseline.function_schedules),'Schedules changed');
 assert.equal(deploy.available_functions.length,baseline.available_functions.length);
 for(const previous of baseline.available_functions){const actual={...deploy.available_functions.find(f=>f.n===previous.n)};assert(actual.n);if(previous.n!==name){for(const [optional,effective]of [['mo','m'],['rgo','rg']])if(!Object.hasOwn(previous,optional)&&actual[optional]===previous[effective])delete actual[optional];assert.equal(canonical(actual),canonical(previous),'Unrelated function changed: '+previous.n);}else{assert.equal(actual.d,pack.sha256);for(const key of ['n','r','im','m','rg','ro','er','bd','tr','p','g','dn','vcpu','es'])assert.equal(canonical(actual[key]),canonical(previous[key]),'Recovery runtime/config changed: '+key);}}
 for(const key of ['functions_region','functions_region_overrides','branch','context','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations'])assert.equal(canonical(deploy[key]),canonical(baseline[key]),'Site runtime changed: '+key);
}
async function publicChecks(base){
 const status=await fetch(base+'/api/arcade-monthly?action=status',{signal:AbortSignal.timeout(20000)});assert.equal(status.status,200);const data=await status.json();assert.equal(data.authenticated,false);assert.equal(data.configuration.recovery.amountBaseUnits,'20000000000');assert.equal(data.configuration.recovery.price,'20000');
 const rejected=await fetch(base+'/api/arcade-monthly?action=verify',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});assert.equal(rejected.status,401,'Unauthenticated verification must stay blocked');
}
await verifyInventory(d);await publicChecks(d.links.permalink);
await noBuilds();const before=await api('sites/'+siteId);
assert.equal(before.published_deploy.id,baseline.id,'Concurrent publication');assert.equal(sha(canonical(before.build_settings)),buildHash);assert.equal(await environmentHash(before),envHash,'Protected environment changed');
await api('deploys/'+d.id+'/lock','POST');
const publishedSite=await api('sites/'+siteId),published=await api('deploys/'+d.id);
assert.equal(publishedSite.published_deploy.id,d.id);assert.equal(published.locked,true);await verifyInventory(published);
assert.equal(sha(canonical(publishedSite.build_settings)),buildHash);assert.equal(await environmentHash(publishedSite),envHash);await publicChecks('https://tree-token.xyz');
const report={release:'Arcade paid check-in recovery metadata fix',published:true,id:d.id,baseline:baseline.id,sourceCommit:source,publishedAt:published.published_at,staticPaths:Object.keys(files).length,preservedStaticPaths:Object.keys(files).length,functions:published.available_functions.length,unchangedFunctions:published.available_functions.length-1,replacedFunction:name,functionSha256:pack.sha256,schedulesPreserved:published.function_schedules.length,configurationPreserved:true,protectedEnvironmentPreserved:true,sdkVersion:'2.26.1',publicStatusAndUnauthorizedChecks:true,databaseWrites:false,files};
fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,files:undefined}));
