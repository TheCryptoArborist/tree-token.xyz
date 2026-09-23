import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
const approved='5e4f6094e1647ca1d5bace65d9fd5d41ee671f17';
// PR review fix: late wallet registration retries, with manual choice/forget guards.
const reviewedWalletSha1='a401cb82afb8de801eb9c9effbc961cdbbd0e46a';
const baselineId='6ab31e7878c67aff72b0dc54';
const candidatePath='production/sti-release-candidate.json';
const statePath='.netlify/sti-production-release.json';
const changes=['/dapp/index.html','/dapp/styles.css','/dapp/interaction-bootstrap.js','/scripts/wallet.js','/dapp/sti-widget.js','/dapp/sti-purchase-core.js','/dapp/sti-stats-core.js','/assets/sti-icon.svg'];
const mode=process.argv[2];
assert(['plan','preview','verify','promote'].includes(mode),'Usage: node scripts/release-sti-preserved-production.mjs plan|preview|verify|promote');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sha=bytes=>crypto.createHash('sha1').update(bytes).digest('hex');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file));
const configPath=process.platform==='win32'?path.join(process.env.APPDATA,'netlify','Config','config.json'):process.platform==='darwin'?path.join(os.homedir(),'Library','Preferences','netlify','config.json'):path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config'),'netlify','config.json');
let token=process.env.NETLIFY_AUTH_TOKEN;
if(!token){const config=read(configPath),auth=config.users[config.userId].auth;token=typeof auth==='string'?auth:auth.token;}
assert(token,'Authenticated Netlify CLI required');
const authHeaders={Authorization:'Bearer '+token};
async function api(endpoint,method='GET',body){
  for(let attempt=0;;attempt++){
    const response=await fetch('https://api.netlify.com/api/v1/'+endpoint,{method,headers:{...authHeaders,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30_000)});
    if(method==='GET' && [429,502,503,504].includes(response.status) && attempt<4){
      const delay=Math.min(30_000,Math.max(1000,Number(response.headers.get('retry-after'))*1000||2000*(attempt+1)));
      console.log(`Retrying deployment metadata after HTTP ${response.status}`);
      await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,delay));continue;
    }
    if(!response.ok)throw Error(`${method} ${endpoint}: HTTP ${response.status}`);
    return response.json();
  }
}
async function inventory(id){
  const files=[];
  for(let page=1;;page++){const batch=await api(`deploys/${id}/files?per_page=100&page=${page}`);files.push(...batch);if(batch.length<100)break;}
  return Object.fromEntries(files.map(file=>[file.path,file.sha]));
}
const identities=functions=>functions.map(f=>{
  const fields={...f,m:f.m??f.mo,rg:f.rg??f.rgo};
  return Object.fromEntries(['n','d','id','oid','ro','p','m','rg','r','im'].filter(key=>fields[key]!=null).map(key=>[key,fields[key]]));
}).sort((a,b)=>a.n.localeCompare(b.n));
const expectedFiles=files=>Object.fromEntries(files.map(f=>[f.path,f.sha1]));
const current=await api('sites/'+siteId);
assert.equal(current.published_deploy.id,baselineId,'Production changed; prepare a new reviewed release');
const live=await api('deploys/'+baselineId);
assert.equal(live.locked,true,'Keep automatic production publishing locked');
assert([false,null].includes(live.edge_functions_present),'Unexpected edge functions require review');
assert.equal(live.available_functions.length,37);assert.equal(live.function_schedules.length,5);
git('merge-base','--is-ancestor',approved,'HEAD');

if(mode==='plan'){
  const manifest=read('production/manifest.json'),published=read('production/current-release.json');
  assert.equal(manifest.deployId,baselineId);assert.equal(published.id,baselineId);
  assert.deepEqual(await inventory(baselineId),expectedFiles(manifest.files));
  assert.deepEqual(identities(live.available_functions),identities(published.functionConfigurations));
  assert.deepEqual(live.function_schedules,published.schedules);
  const files=new Map(manifest.files.map(f=>{assert.equal(sha(fs.readFileSync(f.source)),f.sha1,f.source);return [f.path,{...f}];}));
  for(const pathname of changes){
    const source=pathname.slice(1),bytes=fs.readFileSync(source);
    const reviewedHash=source==='scripts/wallet.js'?reviewedWalletSha1:sha(execFileSync('git',['show',`${approved}:${source}`]));
    assert.equal(sha(bytes),reviewedHash,'Frontend changed since preview approval or verified review fix: '+source);
    files.set(pathname,{path:pathname,source,sha1:sha(bytes),size:bytes.length});
  }
  assert.equal(files.size,193);
  const candidate={siteId,approvedSourceCommit:approved,reviewedWalletSha1,baseline:{id:baselineId,branch:live.branch,files:manifest.files,functions:live.available_functions,schedules:live.function_schedules},changedFiles:changes,files:[...files.values()]};
  fs.writeFileSync(candidatePath,JSON.stringify(candidate,null,2)+'\n');
  console.log(JSON.stringify({candidate:candidatePath,files:files.size,changedFiles:changes,functionsPreserved:37,schedulesPreserved:5}));
  process.exit(0);
}

assert.equal(git('status','--porcelain'),'','Commit the reviewed release plan first');
const candidate=read(candidatePath),commit=git('rev-parse','HEAD');
assert.equal(candidate.siteId,siteId);assert.equal(candidate.approvedSourceCommit,approved);assert.equal(candidate.baseline.id,baselineId);
assert.equal(candidate.reviewedWalletSha1,reviewedWalletSha1);
assert.equal(sha(fs.readFileSync('scripts/wallet.js')),reviewedWalletSha1);
assert.deepEqual(candidate.changedFiles,changes);
assert.deepEqual(await inventory(baselineId),expectedFiles(candidate.baseline.files));
assert.deepEqual(identities(live.available_functions),identities(candidate.baseline.functions));
assert.deepEqual(live.function_schedules,candidate.baseline.schedules);
for(const file of candidate.files)assert.equal(sha(fs.readFileSync(file.source)),file.sha1,'Candidate bytes changed: '+file.source);
const expected=expectedFiles(candidate.files);
assert.equal(Object.keys(expected).length,193);
const actualChanges=Object.keys(expected).filter(p=>expected[p]!==expectedFiles(candidate.baseline.files)[p]);
assert.deepEqual(actualChanges.sort(),[...changes].sort());
assert(candidate.baseline.files.every(f=>Object.hasOwn(expected,f.path)),'Baseline file removed');
let state;
if(mode==='preview'){
  const functions={},functions_config={};
  for(const f of live.available_functions){
    functions[f.n]=f.d;
    const normalized={...f,m:f.m??f.mo,rg:f.rg??f.rgo},config={};
    for(const [from,to] of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region'}))if(normalized[from]!=null)config[to]=normalized[from];
    if(f.ro)config.routes=f.ro.map(r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,value])=>value!=null)));
    functions_config[f.n]=config;
  }
  // Reuse the currently published branch context and packages; never build source functions.
  const deploy=await api(`sites/${siteId}/deploys?title=Native%20STI%20with%20preserved%20production%20backend`,'POST',{files:expected,functions,functions_config,function_schedules:live.function_schedules,draft:false,async:false,branch:live.branch,commit_ref:commit});
  state={id:deploy.id,commit,approvedSourceCommit:approved,baseline:baselineId,candidateDigest:digest(candidate)};
  fs.mkdirSync('.netlify',{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
  assert.equal(deploy.required_functions?.length||0,0,'Refuse any backend rebuild or replacement');
  assert.equal(deploy.required_edge_functions?.length||0,0);
  for(const hash of deploy.required||[]){
    const file=candidate.files.find(f=>f.sha1===hash);assert(file,'Unexpected requested upload');
    const response=await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files${file.path}`,{method:'PUT',headers:{...authHeaders,'Content-Type':'application/octet-stream'},body:fs.readFileSync(file.source),signal:AbortSignal.timeout(30_000)});
    assert(response.ok,`Upload ${file.path}: ${response.status}`);
  }
}else state=read(statePath);
assert.equal(state.candidateDigest,digest(candidate),'Release plan changed');
git('merge-base','--is-ancestor',state.commit,'HEAD');
let ready;
for(let i=0;i<90;i++){ready=await api('deploys/'+state.id);if(ready.state==='ready')break;assert.notEqual(ready.state,'error');await new Promise(resolve=>setTimeout(resolve,1000));}
assert.equal(ready.state,'ready');
assert.deepEqual(await inventory(state.id),expected,'Hosted static inventory mismatch');
assert.deepEqual(identities(ready.available_functions),identities(live.available_functions),'Backend identity/configuration mismatch');
assert.deepEqual(ready.function_schedules,live.function_schedules,'Schedule mismatch');
assert.equal(Boolean(ready.edge_functions_present),Boolean(live.edge_functions_present));
assert.equal((await api('sites/'+siteId)).published_deploy.id,baselineId,'Production changed during verification');
if(mode==='promote'){
  assert.equal(git('branch','--show-current'),'main','Merge the reviewed PR before promotion');
  assert.equal(git('rev-parse','origin/main'),commit,'Use the current merged main');
  await api(`sites/${siteId}/deploys/${state.id}/restore`,'POST');
  await api(`deploys/${state.id}/lock`,'POST');
  assert.equal((await api('sites/'+siteId)).published_deploy.id,state.id);
  ready=await api('deploys/'+state.id);assert.equal(ready.locked,true);
  assert.deepEqual(identities(ready.available_functions),identities(live.available_functions));
  assert.deepEqual(ready.function_schedules,live.function_schedules);
}
const report={mode,id:state.id,commit,sourceCommit:state.commit,approvedSourceCommit:approved,previous:baselineId,url:`https://${state.id}--tree-token.netlify.app`,files:193,functionsPreserved:37,schedulesPreserved:5,productionChanged:mode==='promote'};
fs.writeFileSync('.netlify/sti-production-report.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('.netlify/sti-production-deploy.json',JSON.stringify(ready,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
