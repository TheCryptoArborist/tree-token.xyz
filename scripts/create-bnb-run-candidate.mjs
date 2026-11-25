// Creates and verifies one inactive candidate. No publication, lock or env writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {fingerprint,readToken} from './release-preserved-production.mjs';
import {apiClient} from './release-sti-purchase.mjs';
import {validateBackend,packageTrafficRules} from './release-arcade-cutoff.mjs';
import {SITE,BASE,ROUTES,TRAFFIC,capture,inventory,runtime,assemble,validatePackage} from './prepare-bnb-run-release.mjs';
import {FUNCTION_NAME,sha256} from './package-bnb-run-review.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const eq=(a,b,label)=>assert.equal(fingerprint(a),fingerprint(b),label+' changed');
export function candidateAPI(raw){return (p,m='GET',b)=>{assert(m==='GET'||(m==='POST'&&p.startsWith(`sites/${SITE}/deploys?title=`)),'Candidate mode cannot publish or change settings');return raw(p,m,b);};}
export function uploads(d,hash){for(const k of ['required','required_functions','required_edge_functions','required_server'])assert(Array.isArray(d[k]));for(const k of ['required','required_edge_functions','required_server'])assert.equal(d[k].length,0,'Unexpected upload');assert(d.required_functions.length<=1&&d.required_functions.every(x=>x===hash),'Only reviewed function upload permitted');}
export function compare(d,b,hash){
 validateBackend(d);assert.equal(d.available_functions.length,61);assert(!d.locked&&!d.published_at,'Candidate must remain inactive');
 for(const old of b.deploy.available_functions){const next=d.available_functions.find(f=>f.n===old.n);eq(next,old,'Complete existing provider record '+old.n);}
 eq(d.function_schedules,b.deploy.function_schedules,'Schedules');eq(runtime(d),runtime(b.deploy),'Runtime');
 const f=d.available_functions.find(f=>f.n===FUNCTION_NAME);assert(f);assert.equal(f.d,hash);assert.equal(f.r,'nodejs24.x');assert.equal(f.im,'stream');
 eq(f.bd,{bootstrapVersion:'2.24.0',runtimeAPIVersion:2},'Bootstrap');
 eq(f.ro?.map(r=>({...r,m:r.m??[]})),ROUTES.map(r=>({p:r.pattern,l:r.literal,e:null,m:r.methods,ps:false})),'Route');
 eq(packageTrafficRules(f.tr),packageTrafficRules(TRAFFIC),'Admission');return f;
}
export async function checkEndpoint(origin,fetcher=fetch){
 const checks=[];
 for(const method of ['GET','POST']){
  const r=await fetcher(origin+ROUTES[0].pattern,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json'},...(method==='POST'?{body:'{"action":"issue"}'}:{})});
  assert.equal(r.status,503);eq(await r.json(),{error:'review-disabled',gameplayAuthorized:false},'Disabled response');
  assert.equal(r.headers.get('cache-control'),'no-store');assert(!r.headers.has('set-cookie'));assert(!r.headers.has('access-control-allow-origin'));checks.push({method,status:r.status});
 }
 const r=await fetcher(origin+'/api/arcade-bnb-test',{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json'},body:'{"action":"status"}'});
 const status=origin==='https://tree-token.xyz'?401:403,error=status===401?'invalid-session':'origin-denied';
 assert.equal(r.status,status);const b=await r.json();assert.equal(b.error,error);assert.equal(b.gameplayAuthorized,false);assert(!r.headers.has('set-cookie'));
 return {disabled:checks,existingAuth:{status,error},walletUsed:false};
}
export async function main(){
 const [pkg,out]=process.argv.slice(2);assert(pkg&&out);assert(!fs.existsSync(out),'Candidate output exists; audit it rather than recreate');
 const plan=read('docs/multichain/generation-milestone/run-release/plan.json');const proof=read('docs/multichain/generation-milestone/run-release/validation.json');assert.equal(fingerprint(plan),proof.planHash);
 const m=read(path.join(pkg,'manifest.json')),bytes=fs.readFileSync(path.join(pkg,FUNCTION_NAME+'.zip'));
 validatePackage(m,bytes,read('docs/multichain/generation-milestone/run-endpoint/validation.json'));assert.equal(m.sha256,plan.package.sha256);
 eq(assemble(plan.baseline.deploy,plan.baseline.files,m),plan.request,'Proposed request');
 const token=readToken(),api=candidateAPI(apiClient(token));eq(await capture(api),plan.baseline,'Current live baseline');
 fs.mkdirSync(out,{recursive:true});const write=(name,v)=>fs.writeFileSync(path.join(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const title='Disabled BNB run review '+proof.planHash.slice(0,16),start=new Date().toISOString();
 const created=await api(`sites/${SITE}/deploys?title=${encodeURIComponent(title)}`,'POST',plan.request);
 const state={id:created.id,baselineId:BASE,planHash:proof.planHash,createdAt:created.created_at,requestStartedAt:start};write('candidate.json',state);
 assert(/^[a-f0-9]{24}$/.test(state.id)&&state.id!==BASE);assert.equal(created.site_id,SITE);assert(!created.locked&&!created.published_at);uploads(created,m.sha256);
 if(created.required_functions.length){
  assert.equal(sha256(bytes),m.sha256);
  const r=await fetch(`https://api.netlify.com/api/v1/deploys/${state.id}/functions/${FUNCTION_NAME}?runtime=nodejs24.x&invocation_mode=stream`,{method:'PUT',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(45000)});assert(r.ok,'Function upload failed; inspect existing candidate, do not recreate');
 }
 let d;for(let i=0;i<120;i++){d=await api('deploys/'+state.id);if(d.state==='ready')break;assert(!['error','canceled','rejected'].includes(d.state));await new Promise(r=>setTimeout(r,1000));}
 assert.equal(d.state,'ready');assert.equal(d.title,title);assert.equal(d.created_at,state.createdAt);assert(Date.parse(d.created_at)>=Date.parse(start)-10000);
 const record=compare(d,plan.baseline,m.sha256);eq(await inventory(api,state.id),plan.baseline.files,'All static paths');
 const endpoint=await checkEndpoint(`https://${state.id}--tree-token.netlify.app`);
 eq(await capture(api),plan.baseline,'Live baseline after candidate checks');
 const verified={...state,checkedAt:new Date().toISOString(),state:'ready',published:false,locked:false,preservedStaticPaths:691,preservedFunctions:60,totalFunctions:61,schedules:5,packageSha256:m.sha256,functionProviderRecord:record,endpoint,productionUnchanged:true,migrationApplied:false,gameplayAuthorized:false};
 write('verified.json',verified);console.log('BNB_CANDIDATE_VERIFIED '+JSON.stringify(verified));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
