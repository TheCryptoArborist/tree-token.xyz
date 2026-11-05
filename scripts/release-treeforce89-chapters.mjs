// Only a new, unpublished frontend candidate and read-only verification are supported.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SITE_ID,canonical,fingerprint,readOnlyApi,readToken,captureCurrent,
 assertPreserved,loadBaseline,filesFromRows} from './lib/treeforce89-production-inventory.mjs';

export const BASELINE='6aecab809924c531a486d91e';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=(a,b)=>createHash(a).update(b).digest('hex');
const same=(a,b,label)=>assert(canonical(a)===canonical(b),label);
export function planFiles(baseline,input,approved){
 assert.equal(baseline.deployId,BASELINE);assert.equal(input.expectedProduction,BASELINE);
 assert.equal(input.siteId,SITE_ID);assert.equal(input.requiredFunctions,43);
 assert.equal(input.requiredSchedules,5);assert.equal(input.backendBuilt,false);
 assert.equal(input.environmentChanges,false);assert.equal(input.migrationsIncluded,false);
 assert.equal(input.files.length,13);
 same(input.files.map(({source,...f})=>f),approved.files,'Reviewed frontend bytes changed');
 const files={...baseline.files};
 for(const f of input.files){
  assert(f.path.startsWith('/play/treeforce89/')&&!f.path.includes('..'));
  const bytes=readFileSync(f.source);assert.equal(hash('sha1',bytes),f.sha);
  assert.equal(hash('sha256',bytes),f.sha256);assert.equal(bytes.length,f.bytes);
  const publicPath=f.path.toLowerCase();
  assert(!input.files.some(other=>other!==f&&other.path.toLowerCase()===publicPath),'Case-colliding upload paths');
  files[publicPath]=f.sha;
 }
 const changed=Object.keys(baseline.files).filter(p=>files[p]!==baseline.files[p]).sort();
 assert(changed.length>0);assert(changed.every(p=>input.files.some(f=>f.path.toLowerCase()===p)));
 assert.equal(files['/netlify.toml'],baseline.files['/netlify.toml']);
 return {files,changed,added:Object.keys(files).filter(p=>!Object.hasOwn(baseline.files,p)).sort()};
}
export function reuseFunctions(functions){
 assert.equal(functions.length,43);const digests={},config={};
 const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));
 for(const f of functions){
  digests[f.n]=f.d;const c={};
  for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',p:'priority',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))if(f[short]!=null)c[long]=f[short];
  if(Object.hasOwn(f,'mo'))c.memory=f.m;
  if(Object.hasOwn(f,'rgo'))c.region=f.rg;
  if(f.ro)c.routes=f.ro.map(route);if(f.er)c.excluded_routes=f.er.map(route);config[f.n]=c;
 }
 return {functions:digests,functions_config:config};
}
export function verifyServedHTML(expected,served,baseline){
 const pattern=/<script id="tree-arcade-arboretum-link">[\s\S]*?<\/script>/g;
 const live=baseline.match(pattern)||[],actual=served.match(pattern)||[];
 assert.equal(live.length,1,'Expected one existing hosting snippet');
 same(actual,live,'Hosting-injected script changed');
 assert.equal((expected.match(pattern)||[]).length,0);
 const normalized=s=>s.replace(/>\s+</g,'><').trim();
 assert.equal(normalized(served.replace(actual[0],'')),normalized(expected),'Served HTML differs beyond the existing hosting snippet');
}
async function publicChecks(origin,input){
 assert(/^https:\/\/(?:tree-token\.xyz|[a-f0-9]{24}--tree-token\.netlify\.app)$/.test(origin));
 for(const f of input.files){
  const r=await fetch(origin+f.path,{signal:AbortSignal.timeout(45000)});
  assert.equal(r.status,200,'Public asset unavailable: '+f.path);
  const served=Buffer.from(await r.arrayBuffer());
  if(f.path.endsWith('/index.html')){
   const current=await fetch('https://tree-token.xyz'+f.path,{signal:AbortSignal.timeout(45000)});assert.equal(current.status,200);
   verifyServedHTML(readFileSync(f.source,'utf8'),served.toString('utf8'),await current.text());
  }else assert.equal(hash('sha1',served),f.sha,'Served bytes changed: '+f.path);
 }
 const status=await fetch(origin+'/play/treeforce89/api/status',{method:'POST',headers:{Origin:origin},signal:AbortSignal.timeout(45000)});
 assert.equal(status.status,200);const body=await status.json();
 assert.equal(body.schemaReady,true);assert.equal(body.isolationVerified,true);
 assert.equal(body.paymentSchemaReady,true);assert.equal(body.paymentsEnabled,true);
 const denied=await fetch(origin+'/play/treeforce89/api/tree-run',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(45000)});
 assert.equal(denied.status,401,'Unauthenticated game access must remain denied');
 return {publicAssetsByteExact:true,htmlMatchesWithExistingHostingSnippet:true,schemaReady:true,isolationVerified:true,paymentSchemaReady:true,paymentsEnabled:true,unauthenticatedRunDenied:true};
}
export async function main(mode=process.argv[2]){
 assert(['candidate','published'].includes(mode));
 const token=readToken(),get=readOnlyApi(token);
 const baseline=loadBaseline(resolve(root,'.netlify/treeforce89-chapters-baseline.json'));
 const input=JSON.parse(readFileSync(resolve(root,'.netlify/treeforce89-chapters-release/release-input.json')));
 const approved=JSON.parse(readFileSync(resolve(root,'docs/treeforce89-chapters-release-plan.json')));
 const plan=planFiles(baseline,input,approved);
 const inventory=async id=>{
  const rows=[];for(let page=1;page<=100;page++){
   const batch=await get(`deploys/${id}/files?per_page=100&page=${page}`);assert(Array.isArray(batch));rows.push(...batch);
   if(batch.length<100)return filesFromRows(rows);
  }throw Error('Static inventory exceeded bounds');
 };
 const checkCandidate=async id=>{
  const d=await get('deploys/'+id);assert.equal(d.site_id,SITE_ID);assert.equal(d.state,'ready');
  same(d.available_functions,baseline.functions,'Backend identity/runtime changed; stop');
  same(d.function_schedules,baseline.schedules,'Schedule changed; stop');
  for(const [key,value]of Object.entries(baseline.runtime))same(d[key],value,'Runtime '+key+' changed; stop');
  const actualFiles=await inventory(id);
  if(canonical(actualFiles)!==canonical(plan.files))console.log(JSON.stringify({staticDifferences:[...new Set([...Object.keys(actualFiles),...Object.keys(plan.files)])].filter(p=>actualFiles[p]!==plan.files[p])}));
  same(actualFiles,plan.files,'Complete static inventory mismatch');return d;
 };
 const reportPath=resolve(root,'.netlify/treeforce89-chapters-candidate.json');
 let report;
 if(mode==='candidate'){
  assertPreserved(await captureCurrent(get,BASELINE),baseline);
  const original=await get('deploys/'+BASELINE);assert.equal(original.locked,true);
  const liveStatus=await fetch('https://tree-token.xyz/play/treeforce89/api/status',{method:'POST',headers:{Origin:'https://tree-token.xyz'}});
  assert.equal(liveStatus.status,200);assert.equal((await liveStatus.json()).paymentsEnabled,true);
  const body={files:plan.files,...reuseFunctions(baseline.functions),function_schedules:baseline.schedules,
   draft:false,async:false,branch:original.branch,
   commit_ref:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};
  // No environment, DB binding, migration, runtime package or function upload is supplied.
  const request=async(endpoint,method,body,raw=false)=>{
   assert((method==='POST'&&endpoint.split('?')[0]===`sites/${SITE_ID}/deploys`)||(method==='PUT'&&/^deploys\/[a-f0-9]{24}\/files\/play\/treeforce89\//.test(endpoint)));
   let response;try{response=await fetch('https://api.netlify.com/api/v1/'+endpoint,{
    method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':raw?'application/octet-stream':'application/json'},
    body:raw?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});}catch{throw Error('Candidate request failed; details withheld');}
   assert(response.ok,'Candidate request HTTP '+response.status);return response.json();
  };
  const created=await request(`sites/${SITE_ID}/deploys?title=TREE%20FORCE%20bonus%20rounds%20and%20audio`,'POST',body);
  assert(/^[a-f0-9]{24}$/.test(created.id));
  report={id:created.id,baseline:BASELINE,sourceCommit:body.commit_ref,mode:'candidate',productionChanged:false};
  mkdirSync(resolve(root,'.netlify'),{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.equal(created.required_functions?.length||0,0,'Refuse any function upload');
  assert.equal(created.required_edge_functions?.length||0,0,'Refuse any edge function upload');
  assert.equal(created.required_server?.length||0,0,'Refuse any server upload');
  assert.equal((await get('sites/'+SITE_ID)).published_deploy.id,BASELINE,'Unexpected publication; stop');
  for(const digest of created.required||[]){const f=input.files.find(f=>f.sha===digest);assert(f,'Refuse unrelated upload');
   await request(`deploys/${created.id}/files/${encodeURI(f.path.slice(1))}`,'PUT',readFileSync(f.source),true);
  }
  let ready=false;for(let i=0;i<60;i++){
   const d=await get('deploys/'+created.id);assert.notEqual(d.state,'error','Candidate failed');
   if(d.state==='ready'){ready=true;break;}await new Promise(r=>setTimeout(r,1000));
  }assert(ready,'Candidate not ready');
  const candidate=await checkCandidate(created.id);
  const checks=await publicChecks(candidate.links.permalink,input);
  assertPreserved(await captureCurrent(get,BASELINE),baseline);
  report={...report,checks,files:plan.files,changed:plan.changed,added:plan.added,
   functions:43,schedules:5,functionRecordsSha256:fingerprint(baseline.functions),
   schedulesSha256:fingerprint(baseline.schedules),runtimeSha256:fingerprint(baseline.runtime),
   environment:baseline.environment,candidateUrl:candidate.links.permalink,
   verified:true,noFunctionUploads:true,noEnvironmentChanges:true,noMigrations:true};
 }else{
  report=JSON.parse(readFileSync(reportPath));assert.equal(report.verified,true);
  assert.equal(report.baseline,BASELINE);await checkCandidate(report.id);
  const actual=await captureCurrent(get,report.id);
  same(actual.functions,baseline.functions,'Published function identities changed');same(actual.schedules,baseline.schedules,'Published schedules changed');
  same(actual.runtime,baseline.runtime,'Published runtime changed');same(actual.environment,baseline.environment,'Published environment changed');same(actual.files,plan.files,'Published files changed');
  report={...report,mode:'published',productionChanged:true,publishedChecks:await publicChecks('https://tree-token.xyz',input),locked:true};
 }
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,files:undefined,environment:undefined}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
