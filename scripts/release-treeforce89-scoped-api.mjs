import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SITE_ID,canonical,fingerprint,readOnlyApi,readToken,captureCurrent,assertPreserved,validateSnapshot,filesFromRows} from './lib/treeforce89-production-inventory.mjs';
import {reuseFunctions} from './release-treeforce89-gameplay.mjs';
export const BASELINE='6aec00c92d9060d410e986e0';
export const TARGET='treeforce89-dev';
const same=(a,b,label)=>assert.equal(canonical(a),canonical(b),label);
export function assertScopedFunctions(actual,original,digest){
 assert.equal(actual.length,43);assert.equal(new Set(actual.map(f=>f.n)).size,43);
 same(actual.filter(f=>f.n!==TARGET),original.filter(f=>f.n!==TARGET),'An unrelated backend changed');
 const previous=original.find(f=>f.n===TARGET),next=actual.find(f=>f.n===TARGET);
 assert.equal(next.d,digest);assert.notEqual(next.d,previous.d);
 const packageIdentity=new Set(['d','id','oid','c','s','a']);
 const stable=f=>Object.fromEntries(Object.entries(f).filter(([key])=>!packageIdentity.has(key)));
 same(stable(next),stable(previous),'TREE FORCE runtime/routes/configuration changed');
}
export async function main(mode=process.argv[2]){
 assert(['candidate','published'].includes(mode));
 const baseline=JSON.parse(readFileSync('docs/treeforce89-payment-readiness-baseline.json'));
 validateSnapshot(baseline);assert.equal(baseline.deployId,BASELINE);
 assert.equal(fingerprint(baseline),'0a2aa7df594c6d850a1dbdbcff7f7256def74b87e5d9de09e8e4eb16f9ee6334');
 const input=JSON.parse(readFileSync('.netlify/treeforce89-scoped-api/function.json'));
 assert.equal(input.name,TARGET);assert.equal(input.path,'.netlify/treeforce89-scoped-api/treeforce89-dev.zip');
 const bytes=readFileSync(input.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),input.sha256);
 const previous=baseline.functions.find(f=>f.n===TARGET);
 assert.equal(input.runtime,previous.r);assert.equal(input.invocationMode,previous.im);same(input.buildData,previous.bd,'Bootstrap build data');
 const token=readToken(),get=readOnlyApi(token),reportPath='.netlify/treeforce89-scoped-api/candidate.json';
 const inventory=async id=>{const rows=[];for(let page=1;page<=100;page++){
  const batch=await get(`deploys/${id}/files?per_page=100&page=${page}`);assert(Array.isArray(batch));rows.push(...batch);
  if(batch.length<100)return filesFromRows(rows);
 }throw Error('Static inventory exceeded bounds');};
 const check=async id=>{
  const d=await get('deploys/'+id);assert.equal(d.site_id,SITE_ID);assert.equal(d.state,'ready');
  assertScopedFunctions(d.available_functions,baseline.functions,input.sha256);
  same(d.function_schedules,baseline.schedules,'Schedules');
  for(const [key,value]of Object.entries(baseline.runtime))same(d[key],value,'Runtime '+key);
  same(await inventory(id),baseline.files,'Static files');return d;
 };
 const publicStatus=async origin=>{
  const r=await fetch(origin+'/play/treeforce89/api/status',{method:'POST',headers:{Origin:origin},signal:AbortSignal.timeout(25000)});
  assert.equal(r.status,200);const status=await r.json();
  for(const key of ['schemaReady','isolationVerified','paymentSchemaReady','paymentsEnabled'])assert.equal(status[key],true,key);
  return status;
 };
 let report;
 if(mode==='candidate'){
  assertPreserved(await captureCurrent(get,BASELINE),baseline);
  const body={files:baseline.files,...reuseFunctions(baseline.functions),function_schedules:baseline.schedules,draft:false,async:false,branch:baseline.runtime.branch};
  body.functions[TARGET]=input.sha256;
  const request=async(endpoint,method,body,raw=false)=>{
   assert((method==='POST'&&endpoint.startsWith(`sites/${SITE_ID}/deploys?`))||
    (method==='PUT'&&/^deploys\/[a-f0-9]{24}\/functions\/treeforce89-dev\?runtime=nodejs22\.x&invocation_mode=stream$/.test(endpoint)));
   let r;try{r=await fetch('https://api.netlify.com/api/v1/'+endpoint,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':raw?'application/octet-stream':'application/json'},body:raw?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});}catch{throw Error('Scoped deploy request failed; raw details withheld');}
   assert(r.ok,'Scoped deploy HTTP '+r.status);return r.json();
  };
  const created=await request(`sites/${SITE_ID}/deploys?title=TREE%20FORCE%20scoped%20payment%20API`,'POST',body);
  assert(/^[a-f0-9]{24}$/.test(created.id));
  report={id:created.id,baseline:BASELINE,mode,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),verified:false};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  assert.equal(created.required?.length||0,0,'Refuse every static upload');
  assert.equal(created.required_edge_functions?.length||0,0);assert.equal(created.required_server?.length||0,0);
  same(created.required_functions,[input.sha256],'Refuse unrelated function uploads');
  assert.equal((await get('sites/'+SITE_ID)).published_deploy.id,BASELINE);
  await request(`deploys/${created.id}/functions/${TARGET}?runtime=nodejs22.x&invocation_mode=stream`,'PUT',bytes,true);
  let ready=false;for(let i=0;i<60;i++){
   const d=await get('deploys/'+created.id);assert.notEqual(d.state,'error');
   if(d.state==='ready'){ready=true;break;}await new Promise(r=>setTimeout(r,1000));
  }assert(ready);
  const candidate=await check(created.id);assert.equal(candidate.published_at,null);
  const status=await publicStatus(candidate.links.permalink);
  assertPreserved(await captureCurrent(get,BASELINE),baseline);
  report={...report,verified:true,candidateUrl:candidate.links.permalink,status,
   changedFunctions:[TARGET],unchangedFunctionRecords:42,functions:candidate.available_functions,
   staticFiles:293,staticInventorySha256:fingerprint(baseline.files),schedules:5,
   schedulesSha256:fingerprint(baseline.schedules),runtimeSha256:fingerprint(baseline.runtime),environment:baseline.environment,
   noStaticChanges:true,noEnvironmentChanges:true,noMigrations:true,productionPublished:false};
 }else{
  report=JSON.parse(readFileSync(reportPath));assert.equal(report.verified,true);assert.equal(report.baseline,BASELINE);
  await check(report.id);const actual=await captureCurrent(get,report.id);
  assertPreserved(actual,{...baseline,deployId:report.id,functions:report.functions});
  report={...report,mode,status:await publicStatus('https://tree-token.xyz'),productionPublished:true,locked:true,verifiedAt:new Date().toISOString()};
 }
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,environment:undefined,functions:undefined,functionCount:43}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
