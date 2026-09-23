import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
const mode=process.argv[2];
assert(['preview','verify','promote'].includes(mode),'Usage: node scripts/release-preserved-production.mjs preview|promote [deploy ID]');
const baseline=JSON.parse(fs.readFileSync('production/release-baseline-20260923.json'));
const manifest=JSON.parse(fs.readFileSync('production/manifest.json'));
const metrics=JSON.parse(fs.readFileSync('production/metrics-packages.json'));
assert.deepEqual(metrics.map(f=>f.name).sort(),['tree-liquidity','tree-volume']);
for(const f of metrics)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);
const unchanged=functions=>functions.filter(f=>!metrics.some(m=>m.name===f.n));
const configPath=path.join(process.env.APPDATA||path.join(process.env.HOME||process.env.USERPROFILE,'.config'),'netlify','Config','config.json');
let token=process.env.NETLIFY_AUTH_TOKEN;
if(!token){const cfg=JSON.parse(fs.readFileSync(configPath));const a=cfg.users[cfg.userId].auth;token=a.token||a;}
const headers={Authorization:'Bearer '+token};
async function api(p,method='GET',body){const r=await fetch('https://api.netlify.com/api/v1/'+p,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(method+' '+p+' '+r.status);return r.json();}
async function inventory(id){const rows=[];for(let page=1;;page++){const batch=await api(`deploys/${id}/files?per_page=100&page=${page}`);rows.push(...batch);if(batch.length<100)return Object.fromEntries(rows.map(f=>[f.path,f.sha]));}}
const identity=f=>Object.fromEntries(['n','d','ro','p','m','rg','r','im'].filter(k=>f[k]!=null).map(k=>[k,f[k]]));
const identities=a=>a.map(identity).sort((a,b)=>a.n.localeCompare(b.n));
const sha=b=>crypto.createHash('sha1').update(b).digest('hex');
const files=Object.fromEntries(manifest.files.map(f=>{const bytes=fs.readFileSync(f.source);assert.equal(sha(bytes),f.sha1,f.source);return [f.path,f.sha1];}));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain'),'','Release requires a clean working tree');
const commit=git('rev-parse','HEAD');
const current=await api('sites/'+siteId);assert.equal(current.published_deploy.id,baseline.deployId,'Concurrent production change; stop');
const live=await api('deploys/'+baseline.deployId);assert.equal(live.locked,true);
assert.deepEqual(await inventory(live.id),Object.fromEntries(baseline.files.map(f=>[f.path,f.sha])));
assert.deepEqual(identities(live.available_functions),identities(baseline.functions));
let id=process.argv[3];
if(mode==='preview'){
 const functions={},functions_config={};
 for(const f of live.available_functions){functions[f.n]=f.d;const c={};for(const [a,b]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region'}))if(f[a]!=null)c[b]=f[a];if(f.ro)c.routes=f.ro.map(r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null)));functions_config[f.n]=c;}
 for(const m of metrics){functions[m.name]=m.sha256;functions_config[m.name].build_data=m.buildData;}
 const body={files,functions,functions_config,function_schedules:live.function_schedules,draft:false,async:false,branch:live.branch,commit_ref:commit};
 const deploy=await api('sites/'+siteId+'/deploys?title=Verified%20V3%20volume%20and%20preserved%20Knowledge%20Trial','POST',body);id=deploy.id;
 fs.mkdirSync('.netlify',{recursive:true});fs.writeFileSync('.netlify/preserved-release.json',JSON.stringify({id,commit,baseline:live.id},null,2));
 assert((deploy.required_functions||[]).every(h=>metrics.some(m=>m.sha256===h)),'Refuse unrelated backend rebuild');
 for(const digest of deploy.required_functions||[]){const m=metrics.find(m=>m.sha256===digest);const r=await fetch('https://api.netlify.com/api/v1/deploys/'+id+'/functions/'+m.name+'?runtime='+m.runtimeVersion+'&invocation_mode='+m.invocationMode,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream'},body:fs.readFileSync(m.path)});assert(r.ok,'Function upload '+m.name+' '+r.status);}assert.equal(deploy.required_edge_functions?.length||0,0);
 for(const digest of deploy.required||[]){const f=manifest.files.find(f=>f.sha1===digest);assert(f);const r=await fetch('https://api.netlify.com/api/v1/deploys/'+id+'/files'+f.path,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream'},body:fs.readFileSync(f.source)});assert(r.ok,'Upload '+f.path);}
}
assert(id,'Deploy ID required');
let ready;for(let i=0;i<60;i++){ready=await api('deploys/'+id);if(ready.state==='ready')break;assert.notEqual(ready.state,'error');await new Promise(r=>setTimeout(r,1000));}
assert.equal(ready.state,'ready');const record=JSON.parse(fs.readFileSync('.netlify/preserved-release.json'));assert.equal(record.id,id);git('merge-base','--is-ancestor',record.commit,'HEAD');
assert.deepEqual(await inventory(id),files);assert.deepEqual(identities(unchanged(ready.available_functions)),identities(unchanged(live.available_functions)));
for(const m of metrics){const f=ready.available_functions.find(f=>f.n===m.name);assert.equal(f?.d,m.sha256);assert.equal(f?.r,m.runtimeVersion);assert.equal(f?.im,m.invocationMode);assert.deepEqual(f?.ro,live.available_functions.find(f=>f.n===m.name).ro);}assert.deepEqual(ready.function_schedules,live.function_schedules);
assert.equal((await api('sites/'+siteId)).published_deploy.id,live.id,'Production changed during verification');
if(mode==='promote'){
 // Restore a verified deploy directly; keep automatic publication locked.
 await api(`sites/${siteId}/deploys/${id}/restore`,'POST');
 await api('deploys/'+id+'/lock','POST');
 assert.equal((await api('sites/'+siteId)).published_deploy.id,id);assert.equal((await api('deploys/'+id)).locked,true);
}
const report={mode,id,commit,previous:live.id,url:'https://'+id+'--tree-token.netlify.app',files:Object.keys(files).length,functionsPreserved:unchanged(live.available_functions).length,functionsUpdated:metrics.map(f=>f.name),schedulesPreserved:live.function_schedules.length,productionChanged:mode==='promote'};
fs.writeFileSync('.netlify/preserved-release-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
