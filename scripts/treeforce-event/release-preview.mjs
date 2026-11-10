import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'.netlify/treeforce-event-preview');fs.mkdirSync(dir,{recursive:true});
const saved=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/netlify/config.json'))),a=saved.users[saved.userId].auth,token=typeof a==='string'?a:a.token;
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf',mode=process.argv[2]||'candidate';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const sha=(x,algo='sha1')=>crypto.createHash(algo).update(x).digest('hex');
async function api(p,method='GET',body,binary=false){const r=await fetch('https://api.netlify.com/api/v1/'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':binary?'application/octet-stream':'application/json'},body:body?binary?body:JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Netlify '+r.status+' '+p);return r.json();}
async function inventory(id){const out={};for(let p=1;p<30;p++){const rows=await api(`deploys/${id}/files?per_page=100&page=${p}`);for(const f of rows)out[f.path]=f.sha;if(rows.length<100)return out;}throw Error('Inventory overflow');}
function configs(d){return Object.fromEntries(d.available_functions.map(f=>{const c={};for(const [s,l]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',p:'priority',tr:'traffic_rules',mo:'memory',rgo:'region',vcpu:'vcpu',es:'event_subscriptions'}))if(f[s]!=null)c[l]=f[s];const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));if(f.ro)c.routes=f.ro.map(route);if(f.er)c.excluded_routes=f.er.map(route);return[f.n,c];}));}
async function noBuilds(){
 // Batch read-only pages; inspect every returned page before accepting exhaustion.
 for(let page=1;page<=1000;page+=10){
  const pages=await Promise.all(Array.from({length:10},(_,i)=>api(`sites/${siteId}/deploys?per_page=100&page=${page+i}`)));
  let exhausted=false;
  for(const rows of pages){
   assert(Array.isArray(rows),'Invalid deployment listing');
   assert(!rows.some(x=>['new','pending_review','accepted','enqueued','building','uploading','uploaded','processing','prepared','retrying'].includes(x.state)),'Active build; wait before publishing');
   if(rows.length<100)exhausted=true;
  }
  if(exhausted)return;
 }
 throw Error('Deployment listing exceeded pagination limit; publication refused');
}
async function protectedEnvironmentHash(site){const rows=await api('accounts/'+site.account_id+'/env?site_id='+siteId);assert(Array.isArray(rows));const normalized=[...rows].map(row=>({...row,scopes:[...row.scopes].sort(),values:[...row.values].sort((a,b)=>String(a.id).localeCompare(String(b.id)))})).sort((a,b)=>a.key.localeCompare(b.key));return sha(canonical(normalized),'sha256');}
let state;
if(mode==='candidate'){
 await noBuilds();const site=await api('sites/'+siteId),baseline=await api('deploys/'+site.published_deploy.id);assert(baseline.locked);assert.equal(baseline.function_schedules.length,5);
 const files=await inventory(baseline.id),originalFiles={...files},changes={};
 const p='/play/events/treeforce89-preview/index.html';assert(!files[p],'Preview path already exists; capture and review before replacing');
 const bytes=fs.readFileSync(root+p);changes[p]=bytes;files[p]=sha(bytes);
 assert.deepEqual(Object.keys(originalFiles).filter(p=>files[p]!==originalFiles[p]),[],'Existing static paths must remain identical');
 const environmentHash=sha(canonical(site.build_settings),'sha256'),protectedEnvHash=await protectedEnvironmentHash(site);
 const d=await api(`sites/${siteId}/deploys?title=TreeForce89%2025%20SUI%20event%20preview%20only`,'POST',{files,functions:Object.fromEntries(baseline.available_functions.map(f=>[f.n,f.d])),functions_config:configs(baseline),function_schedules:baseline.function_schedules,draft:false,async:false,branch:baseline.branch,commit_ref:process.env.SOURCE_COMMIT||null});
 state={id:d.id,baseline,files,originalFiles,environmentHash,protectedEnvHash};fs.writeFileSync(dir+'/state.json',JSON.stringify(state));assert.equal(d.required_functions?.length||0,0,'No backend uploads permitted');
 for(const hash of d.required||[]){const p=Object.keys(changes).find(p=>files[p]===hash);assert(p);await api(`deploys/${d.id}/files/${p.slice(1)}`,'PUT',changes[p],true);}
}else state=JSON.parse(fs.readFileSync(dir+'/state.json'));
assert(['candidate','verify','publish'].includes(mode));
if(mode==='verify')await noBuilds();
let d;for(let i=0;i<50;i++){d=await api('deploys/'+state.id);if(d.state==='ready')break;assert.notEqual(d.state,'error');await new Promise(r=>setTimeout(r,1000));}assert.equal(d.state,'ready');assert.equal(canonical(await inventory(d.id)),canonical(state.files));assert.equal(canonical(d.function_schedules),canonical(state.baseline.function_schedules));assert.equal(d.available_functions.length,state.baseline.available_functions.length);
for(const old of state.baseline.available_functions){const f={...d.available_functions.find(f=>f.n===old.n)};for(const [o,e]of [['mo','m'],['rgo','rg']])if(!Object.hasOwn(old,o)&&f[o]===old[e])delete f[o];assert.equal(canonical(f),canonical(old),'Function changed: '+old.n);}
for(const k of ['functions_region','functions_region_overrides','branch','context','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations'])assert.equal(canonical(d[k]),canonical(state.baseline[k]),'Runtime changed: '+k);
if(mode==='publish'){await noBuilds();const site=await api('sites/'+siteId);assert.equal(site.published_deploy.id,state.baseline.id,'Concurrent publication');assert.equal(sha(canonical(site.build_settings),'sha256'),state.environmentHash);assert.equal(await protectedEnvironmentHash(site),state.protectedEnvHash,'Protected environment changed');await api('deploys/'+d.id+'/lock','POST');assert.equal((await api('sites/'+siteId)).published_deploy.id,d.id);assert.equal((await api('deploys/'+d.id)).locked,true);assert.equal(canonical(await inventory(d.id)),canonical(state.files));}
const report={id:d.id,baseline:state.baseline.id,mode,state:d.state,staticPaths:Object.keys(state.files).length,preservedStaticPaths:Object.keys(state.originalFiles).length,functionsPreserved:d.available_functions.length,schedulesPreserved:d.function_schedules.length,changedPaths:[],addedPaths:['/play/events/treeforce89-preview/index.html'],gameAndWalletJavaScriptUnchanged:true,files:state.files};fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,files:undefined}));
