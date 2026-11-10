import {normalizeEnvironment} from '../../treeforce-production-release/environment.mjs';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {readToken} from '../../release-preserved-production.mjs';
const token=readToken(),siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const hash=(b,a='sha1')=>crypto.createHash(a).update(b).digest('hex');
async function api(p,method='GET',body,binary=false){const r=await fetch('https://api.netlify.com/api/v1/'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':binary?'application/octet-stream':'application/json'},body:body===undefined?undefined:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Netlify HTTP '+r.status+' '+p);return r.json()}
async function inventory(id){const out={};for(let p=1;p<50;p++){const rows=await api(`deploys/${id}/files?per_page=100&page=${p}`);for(const f of rows)out[f.path]=f.sha;if(rows.length<100)return out}throw Error('Inventory overflow')}
const baseline=JSON.parse(fs.readFileSync('release/session-baseline.json'));assert.equal(baseline.available_functions.length,46);assert.equal(baseline.function_schedules.length,5);assert(baseline.locked);
const site=await api('sites/'+siteId);assert.equal(site.published_deploy.id,baseline.id);
const env=await api('accounts/69800888d1a3d0483003ae9e/env?site_id='+siteId);
const originalFiles=await inventory(baseline.id);
const files={...originalFiles},changes={};function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.name==='report.json'||ent.name.endsWith('-original.js'))continue;if(ent.isDirectory())walk(p);else{const dest=('/play/treeforce89/'+path.relative('release/session-return',p)).toLowerCase();changes[dest]=p;files[dest]=hash(fs.readFileSync(p))}}}walk('release/session-return');
const expectedAdditions=['/play/treeforce89/assets/index-session-r2.js','/play/treeforce89/assets/arcade-session-r2.js'].sort();assert.deepEqual(Object.keys(files).filter(p=>!(p in originalFiles)).sort(),expectedAdditions,'Unexpected addition');assert.deepEqual(Object.keys(originalFiles).filter(p=>originalFiles[p]!==files[p]),['/play/treeforce89/index.html'],'Unexpected production modification');
const functions=Object.fromEntries(baseline.available_functions.map(f=>[f.n,f.d]));const configs={};
for(const f of baseline.available_functions){const c={};for(const [s,l]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',p:'priority',tr:'traffic_rules',mo:'memory',rgo:'region',vcpu:'vcpu',es:'event_subscriptions'}))if(f[s]!=null)c[l]=f[s];const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));if(f.ro)c.routes=f.ro.map(route);if(f.er)c.excluded_routes=f.er.map(route);configs[f.n]=c}
const active=await api('sites/'+siteId+'/deploys?per_page=100');assert(!active.some(x=>['new','pending_review','accepted','enqueued','building','uploading','uploaded','processing','prepared','retrying'].includes(x.state)),'Active deployment');
assert.equal((await api('deploys/'+baseline.id)).locked,true,'Production must remain locked');
for(const [p,h]of Object.entries(originalFiles))if(p!=='/play/treeforce89/index.html')assert.equal(files[p],h,'Unapproved static file changed');
assert.equal(Object.keys(functions).length,46);
// Locked deploys prevent new candidates from publishing automatically:
// https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#locked-deploys
// User authorized the approved mobile promotion into the main game.
// User authorized promotion of the approved mobile changes to the main game.
// This stage cannot unlock or publish; existing modules and all test files stay intact.
const d=await api('sites/'+siteId+'/deploys?title=TreeForce89%20approved%20retro%20ending%20and%20session%20return','POST',{files,functions,functions_config:configs,function_schedules:baseline.function_schedules,draft:false,async:false,branch:baseline.branch});
fs.writeFileSync('release/session-created.json',JSON.stringify({id:d.id}));
assert.equal(d.context,'production','Unexpected candidate context');
assert.equal((d.required_functions||[]).length,0,'No backend uploads permitted');
assert.equal((await api('sites/'+siteId)).published_deploy.id,baseline.id,'Locked production unexpectedly changed');
fs.writeFileSync('release/session-state.json',JSON.stringify({id:d.id,baseline:baseline.id,files,functions,siteSettings:hash(canonical(site.build_settings),'sha256'),environment:hash(canonical(env),'sha256'),environmentNormalized:hash(canonical(normalizeEnvironment(env)),'sha256'),environmentEntries:env.length,environmentLatestUpdate:env.map(r=>r.updated_at).sort().at(-1)}));console.log({candidate:d.id,required:d.required?.length,functions:d.required_functions});
for(const sha of d.required||[]){const p=Object.keys(changes).find(p=>files[p]===sha);assert(p);await api('deploys/'+d.id+'/files/'+p.slice(1),'PUT',fs.readFileSync(changes[p]),true)}
console.log('Candidate upload complete');
