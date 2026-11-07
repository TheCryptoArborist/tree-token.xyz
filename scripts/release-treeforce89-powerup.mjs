import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {readToken,canonical} from './lib/treeforce89-production-inventory.mjs';
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf',target='treeforce89-scores';
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'.netlify/powerup-release');fs.mkdirSync(dir,{recursive:true});
const token=readToken(),hash=(a,v)=>crypto.createHash(a).update(v).digest('hex');
const eq=(a,b,label)=>assert.equal(canonical(a),canonical(b),label);
async function api(p,method='GET',body,binary=false){const r=await fetch('https://api.netlify.com/api/v1/'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':binary?'application/octet-stream':'application/json'},...(body?{body:binary?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});assert(r.ok,`Netlify HTTP ${r.status} ${method} ${p}`);return r.status===204?null:r.json();}
async function inventory(id){const rows=[];for(let page=1;page<=20;page++){const next=await api(`deploys/${id}/files?per_page=100&page=${page}`);rows.push(...next);if(next.length<100)return Object.fromEntries(rows.map(f=>[f.path,f.sha]));}throw Error('Inventory overflow');}
function reuse(deploy){return Object.fromEntries(deploy.available_functions.map(f=>{const c={};for(const [a,b]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',p:'priority',tr:'traffic_rules'}))if(f[a]!=null)c[b]=f[a];if(Object.hasOwn(f,'mo'))c.memory=f.mo;if(Object.hasOwn(f,'rgo'))c.region=f.rgo;if(f.ro)c.routes=f.ro.map(r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null)));return[f.n,c];}));}
const record=path.join(dir,'release.json');
const mode=process.argv[2];assert(['candidate','verify','publish'].includes(mode));
let state;
if(mode==='candidate'){
 assert(!fs.existsSync(record),'Candidate already exists');
 const site=await api('sites/'+siteId),baseline=await api('deploys/'+site.published_deploy.id);assert(baseline.locked&&baseline.state==='ready');assert.equal(baseline.available_functions.length,44);assert.equal(baseline.function_schedules.length,5);
 const files=await inventory(baseline.id),sources={};
 const overlay=JSON.parse(fs.readFileSync(path.join(root,'.netlify/treeforce89-powerup-release/release-input.json')));
 for(const f of overlay.files){const p=f.path.toLowerCase();assert(p.startsWith('/play/treeforce89/'));const bytes=fs.readFileSync(f.source);assert.equal(hash('sha1',bytes),f.sha);if(files[p]&&files[p]!==f.sha)assert(['/play/treeforce89/index.html','/play/treeforce89/gateway.css'].includes(p),'Only game HTML/CSS can replace an existing path');files[p]=f.sha;sources[p]=f.source;}
 const config=reuse(baseline);
 const before=await api('sites/'+siteId);assert.equal(before.published_deploy.id,baseline.id,'Concurrent production release');
 const created=await api('sites/'+siteId+'/deploys','POST',{files,functions:Object.fromEntries(baseline.available_functions.map(f=>[f.n,f.d])),functions_config:config,function_schedules:baseline.function_schedules,draft:false,async:false,branch:baseline.branch});
 state={id:created.id,baseline,files,sourceCommit:process.env.SOURCE_COMMIT||null,createdAt:new Date().toISOString()};fs.writeFileSync(record,JSON.stringify(state,null,2));
 assert(!(created.required_functions?.length),'Refuse existing backend uploads');
 for(const digest of created.required||[]){const p=Object.keys(sources).find(p=>files[p]===digest);assert(p,'Unchanged static upload requested');await api('deploys/'+created.id+'/files'+p,'PUT',fs.readFileSync(sources[p]),true);}
}else state=JSON.parse(fs.readFileSync(record));
let deploy;for(let i=0;i<60;i++){deploy=await api('deploys/'+state.id);if(deploy.state==='ready')break;assert(!['error','rejected'].includes(deploy.state));await new Promise(r=>setTimeout(r,1000));}assert.equal(deploy.state,'ready');
assert.equal(deploy.available_functions.length,44);
for(const old of state.baseline.available_functions){const current={...deploy.available_functions.find(f=>f.n===old.n)};for(const [override,effective]of [['mo','m'],['rgo','rg']])if(!Object.hasOwn(old,override)&&current[override]===old[effective])delete current[override];eq(current,old,'Protected function '+old.n);}
eq(deploy.function_schedules,state.baseline.function_schedules,'Schedules');eq(await inventory(state.id),state.files,'Complete static inventory');
for(const key of ['database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations','context','functions_region'])eq(deploy[key],state.baseline[key],'Runtime '+key);
if(mode==='publish'){const live=await api('sites/'+siteId);assert.equal(live.published_deploy.id,state.baseline.id,'Concurrent production release; recapture');assert(live.published_deploy.locked);await api('deploys/'+state.id+'/lock','POST');const published=await api('sites/'+siteId);assert.equal(published.published_deploy.id,state.id);assert(published.published_deploy.locked);}
console.log(JSON.stringify({id:state.id,url:`https://${state.id}--tree-token.netlify.app/play/treeforce89/`,mode,functionsPreserved:44,functionsAdded:0,schedulesPreserved:5,files:Object.keys(state.files).length,sourceCommit:state.sourceCommit}));
