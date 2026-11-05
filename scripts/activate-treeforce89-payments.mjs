// One reviewed environment flag; no asset/function uploads, builds or migrations.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SITE_ID,canonical,fingerprint,readToken,readOnlyApi,captureCurrent,assertPreserved,loadBaseline,filesFromRows} from './lib/treeforce89-production-inventory.mjs';
import {reuseFunctions} from './release-treeforce89-gameplay.mjs';
export const BASELINE='6aec00c92d9060d410e986e0';
export const FLAG='TREEFORCE89_PAID_CONTINUES_ENABLED';
const root=fileURLToPath(new URL('../',import.meta.url));
const same=(a,b,label)=>assert.equal(canonical(a),canonical(b),label);

export function withoutApprovedFlag(rows,siteSpecific){
 assert(Array.isArray(rows));
 const flags=rows.filter(r=>r.key===FLAG);
 if(!siteSpecific){assert.equal(flags.length,0,'Shared flag unexpectedly present');return rows;}
 assert.equal(flags.length,1,'Exactly one site flag is required');
 const flag=flags[0];
 same(flag.scopes,['functions'],'Flag must affect functions only');
 assert.equal(flag.is_secret,false,'Flag must remain a non-secret boolean');
 assert.equal(flag.values.length,1,'No preview/branch values allowed');
 const value=flag.values[0];
 assert.equal(value.context,'production');assert(!value.context_parameter);
 assert.equal(value.value,'true');
 return rows.filter(r=>r.key!==FLAG);
}

export async function main(mode=process.argv[2]){
 assert(['candidate','published'].includes(mode));
 const token=readToken(),get=readOnlyApi(token);
 const baseline=loadBaseline(resolve(root,'.netlify/treeforce89-payment-baseline.json'));
 assert.equal(baseline.deployId,BASELINE);
 const protectedGet=async endpoint=>{
  const value=await get(endpoint);
  return endpoint.includes('/env')?withoutApprovedFlag(value,endpoint.includes('site_id='+SITE_ID)):value;
 };
 const reportPath=resolve(root,'.netlify/treeforce89-payment-candidate.json');
 const checkPublic=async origin=>{
  const response=await fetch(origin+'/play/treeforce89/api/status',{method:'POST',headers:{Origin:origin},signal:AbortSignal.timeout(45000)});
  assert.equal(response.status,200);const status=await response.json();
  for(const key of ['schemaReady','isolationVerified','paymentSchemaReady','paymentsEnabled'])assert.equal(status[key],true,key);
  return status;
 };
 const checkCandidate=async id=>{
  const d=await get('deploys/'+id);assert.equal(d.site_id,SITE_ID);assert.equal(d.state,'ready');
  same(d.available_functions,baseline.functions,'Complete function records');
  same(d.function_schedules,baseline.schedules,'All schedules');
  for(const [key,value] of Object.entries(baseline.runtime))same(d[key],value,'Runtime '+key);
  const rows=[];let done=false;
  for(let page=1;page<=100;page++){
   const batch=await get(`deploys/${id}/files?per_page=100&page=${page}`);assert(Array.isArray(batch));rows.push(...batch);
   if(batch.length<100){done=true;break;}
  }
  assert(done);same(filesFromRows(rows),baseline.files,'Every static file');
  return d;
 };
 let report;
 if(mode==='candidate'){
  assertPreserved(await captureCurrent(protectedGet,BASELINE),baseline);
  const body={files:baseline.files,...reuseFunctions(baseline.functions),function_schedules:baseline.schedules,draft:false,async:false,branch:baseline.runtime.branch};
  let response;
  try{response=await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/deploys?title=TREE%20FORCE%2020000%20TREE%20continue%20activation`,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});}catch{throw Error('Candidate creation failed; raw details withheld');}
  assert(response.ok,'Candidate HTTP '+response.status);
  const created=await response.json();assert(/^[a-f0-9]{24}$/.test(created.id));
  report={id:created.id,baseline:BASELINE,mode,verified:false};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  for(const key of ['required','required_functions','required_edge_functions','required_server'])assert.equal(created[key]?.length||0,0,'Refuse all uploads');
  assert.equal((await get('sites/'+SITE_ID)).published_deploy.id,BASELINE);
  let ready=false;
  for(let i=0;i<45;i++){const d=await get('deploys/'+created.id);assert.notEqual(d.state,'error');if(d.state==='ready'){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
  assert(ready);const candidate=await checkCandidate(created.id);assert.equal(candidate.published_at,null);
  const status=await checkPublic(candidate.links.permalink);
  assertPreserved(await captureCurrent(protectedGet,BASELINE),baseline);
  const actual=await captureCurrent(get,BASELINE);
  report={...report,verified:true,candidateUrl:candidate.links.permalink,status,
   functions:43,schedules:5,staticFiles:Object.keys(baseline.files).length,
   functionRecordsSha256:fingerprint(baseline.functions),schedulesSha256:fingerprint(baseline.schedules),
   staticInventorySha256:fingerprint(baseline.files),runtimeSha256:fingerprint(baseline.runtime),
   environment:actual.environment,onlyEnvironmentChange:FLAG+'=true (functions/production)',
   noUploads:true,noMigrations:true,productionPublished:false};
 }else{
  report=JSON.parse(readFileSync(reportPath));assert.equal(report.verified,true);assert.equal(report.baseline,BASELINE);
  await checkCandidate(report.id);
  assertPreserved(await captureCurrent(protectedGet,report.id),{...baseline,deployId:report.id});
  const actual=await captureCurrent(get,report.id);same(actual.environment,report.environment,'Environment since candidate');
  report={...report,mode,status:await checkPublic('https://tree-token.xyz'),productionPublished:true,locked:true,verifiedAt:new Date().toISOString()};
 }
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,environment:undefined}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
