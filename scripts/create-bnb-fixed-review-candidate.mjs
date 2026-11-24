// New inactive candidate only. No environment writes or publication endpoint.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {capture,inventory,runtime,SITE,ACCOUNT,ROUTES,TRAFFIC} from './prepare-bnb-run-release.mjs';
import {fingerprint,readToken} from './release-preserved-production.mjs';import {apiClient} from './release-sti-purchase.mjs';
import {functionsConfig,packageTrafficRules} from './release-arcade-cutoff.mjs';
import {sha256,sourceEvidence,toolingEvidence} from './package-bnb-run-review.mjs';
export const LIVE='6b053b8285e0ee251b84ad06',FN='arcade-bnb-run-review';
const eq=(a,b)=>assert.equal(fingerprint(a),fingerprint(b),'Preservation mismatch');
export function candidateRequest(b,m){
 assert.equal(b.deploy.id,LIVE);assert.equal(b.deploy.available_functions.length,61);assert.equal(Object.keys(b.files).length,691);assert.equal(b.deploy.function_schedules.length,5);
 assert(!b.deploy.available_functions.some(f=>f.n==='arcade-bnb-binding-audit'));
 eq(m.reviewPolicy,{mode:'review-only',approvedGeneration:'1',gameplayAuthorized:false});eq(m.routes,ROUTES);eq(m.trafficRules,TRAFFIC);
 assert.equal(m.runtimeVersion,'nodejs24.x');assert.equal(m.invocationMode,'stream');eq(m.buildData,{bootstrapVersion:'2.24.0',runtimeAPIVersion:2});assert.equal(m.extractedZipSmokePassed,true);
 assert.equal(m.name,FN);assert.equal(m.deployed,false);assert.equal(m.gameplayAuthorized,false);
 const cfg=functionsConfig(b.deploy);assert(cfg[FN]);cfg[FN]={...cfg[FN],build_data:m.buildData,routes:m.routes,traffic_rules:packageTrafficRules(m.trafficRules)};
 return {files:b.files,functions:{...Object.fromEntries(b.deploy.available_functions.map(f=>[f.n,f.d])),[FN]:m.sha256},functions_config:cfg,function_schedules:b.deploy.function_schedules,draft:false,async:false,branch:b.deploy.branch};
}
export function compare(d,b,m){
 assert.equal(d.site_id,SITE);assert.equal(d.state,'ready');assert(!d.published_at&&!d.locked);assert.equal(d.available_functions.length,61);
 for(const f of b.deploy.available_functions)if(f.n!==FN)eq(d.available_functions.find(x=>x.n===f.n),f);
 const added=d.available_functions.find(f=>f.n===FN),old=b.deploy.available_functions.find(f=>f.n===FN);assert(added);assert.equal(added.d,m.sha256);assert.equal(added.s,m.bytes);
 // Netlify normalizes absent prefer_static to false. Everything else in the
 // replacement provider record stays exact except package identity/time/size.
 const stable=f=>Object.fromEntries(Object.entries(f).filter(([k])=>!['d','id','c','s'].includes(k)));eq(stable(added),stable(old));
 eq(d.function_schedules,b.deploy.function_schedules);eq(runtime(d),runtime(b.deploy));return added;
}
export async function main(){
 const [directory,out]=process.argv.slice(2);assert(directory&&out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const m=JSON.parse(fs.readFileSync(directory+'/manifest.json')),bytes=fs.readFileSync(directory+'/'+FN+'.zip');assert.equal(sha256(bytes),m.sha256);assert.equal(bytes.length,m.bytes);eq(m.sourceFiles,sourceEvidence());eq(m.tooling,toolingEvidence());
 for(const f of m.tracedFiles)assert.equal(sha256(fs.readFileSync(f.path)),f.sha256);
 const token=readToken(),raw=apiClient(token);const api=async(p,method='GET',body)=>{
  assert(method==='GET'||method==='POST'&&p.startsWith(`sites/${SITE}/deploys?title=`),'Candidate-only API');
  const r=await raw(p,method,body);if(method==='GET'&&p.startsWith(`accounts/${ACCOUNT}/env`))for(const row of r)assert(!['BNB_RUN_REVIEW_ENABLED','BNB_RUN_REVIEW_GENERATION'].includes(row.key),'Legacy flag present');return r;
 };
 const baseline=await capture(api,LIVE),request=candidateRequest(baseline,m);eq(await capture(api,LIVE),baseline);
 const d=await api(`sites/${SITE}/deploys?title=Isolated%20generation%201%20review%20candidate`,'POST',request);assert(/^[a-f0-9]{24}$/.test(d.id)&&d.id!==LIVE);assert(!d.published_at&&!d.locked);
 fs.writeFileSync(out+'/candidate.json',JSON.stringify({id:d.id,baselineId:LIVE}));console.log('BNB_FIXED_CANDIDATE '+d.id);
 for(const k of ['required','required_edge_functions','required_server'])assert.equal(d[k].length,0);
 assert(d.required_functions.length<=1&&d.required_functions.every(h=>h===m.sha256),'Unrelated function upload requested');
 if(d.required_functions.length){const r=await fetch(`https://api.netlify.com/api/v1/deploys/${d.id}/functions/${FN}?runtime=nodejs24.x&invocation_mode=stream`,{method:'PUT',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(45000)});assert(r.ok,'Replacement upload failed');}
 let ready;for(let i=0;i<90;i++){ready=await api('deploys/'+d.id);if(ready.state==='ready')break;assert(!['error','canceled','rejected'].includes(ready.state));await new Promise(r=>setTimeout(r,1000));}
 const record=compare(ready,baseline,m);eq(await inventory(api,d.id),baseline.files);eq(await capture(api,LIVE),baseline);
 const check=await fetch(`https://${d.id}--tree-token.netlify.app/api/arcade-bnb-test/run-review`,{method:'POST',headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json'},body:'{"action":"issue"}',redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(check.status,403);eq(await check.json(),{error:'wrong-origin',gameplayAuthorized:false});assert(check.headers.get('cache-control')?.includes('no-store'));assert(!check.headers.has('set-cookie'));
 const live=await fetch('https://tree-token.xyz/api/arcade-bnb-test/run-review',{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(live.status,503);eq(await live.json(),{error:'review-disabled',gameplayAuthorized:false});
 const result={candidateId:d.id,baselineId:LIVE,checkedAt:new Date().toISOString(),published:false,productionUnchanged:true,environmentUnchanged:true,staticPaths:691,unchangedFunctions:60,totalFunctions:61,schedules:5,packageSha256:m.sha256,packageBytes:m.bytes,reviewPolicy:m.reviewPolicy,candidateStatus:403,liveStatus:503,functionProviderRecord:record};
 fs.writeFileSync(out+'/verified.json',JSON.stringify(result,null,2)+'\n');fs.writeFileSync(out+'/baseline.json',JSON.stringify(baseline,null,2)+'\n');console.log('BNB_FIXED_VERIFIED '+JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
