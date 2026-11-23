import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {fingerprint,readToken,environmentFor} from './release-preserved-production.mjs';
import {apiClient} from './release-sti-purchase.mjs';
import {functionsConfig,waitForAllBuilds,validateBackend} from './release-arcade-cutoff.mjs';
import {review} from '../tools/generation-registration/core.mjs';
import {zipFunction} from '@netlify/zip-it-and-ship-it';
import {C} from '../contracts/nftree-generation/scripts/readiness.mjs';
export const SITE='aa62f324-b880-47d6-85b8-4ba0700ff5bf',ACCOUNT='69800888d1a3d0483003ae9e',BASE='6b03b405294864b8628c3244',FN='generation-registration';
export const SOURCES={'/play/generation-registration/index.html':'tools/generation-registration/index.html','/play/generation-registration/app.js':'tools/generation-registration/app.js'};
const DIR='.netlify/generation-registration-release';
const hash=b=>createHash('sha1').update(b).digest('hex');
const eq=(a,b,label)=>assert(fingerprint(a)===fingerprint(b),label+' differs');
const read=p=>JSON.parse(fs.readFileSync(p));const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sort=(a,k)=>[...a].sort((x,y)=>x[k].localeCompare(y[k]));
const runtime=d=>Object.fromEntries(['branch','context','functions_region','functions_region_overrides','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations'].map(k=>[k,d[k]??null]));
export function assemble(files){const next={...files};for(const [p,s]of Object.entries(SOURCES)){assert(!Object.hasOwn(next,p),'New path already exists');next[p]=hash(fs.readFileSync(s));}return next;}
export function preserve(candidate,baseline,added){
 validateBackend(candidate);validateBackend(baseline);
 eq(sort(candidate.available_functions.filter(f=>f.n!==FN),'n'),sort(baseline.available_functions,'n'),'Existing complete backend records');
 assert.equal(candidate.available_functions.length,baseline.available_functions.length+1);
 const f=candidate.available_functions.find(f=>f.n===FN);assert(f);eq(f,added,'Pinned added provider record');
 eq(sort(candidate.function_schedules,'name'),sort(baseline.function_schedules,'name'),'Schedules');eq(runtime(candidate),runtime(baseline),'Runtime');
}
async function inventory(api,id){const files={};for(let page=1;page<=100;page++){const rows=await api(`deploys/${id}/files?per_page=100&page=${page}`);assert(Array.isArray(rows));for(const r of rows){assert(!Object.hasOwn(files,r.path));assert(/^[a-f0-9]{40}$/.test(r.sha));files[r.path]=r.sha;}if(rows.length<100)return files;}throw Error('Incomplete inventory');}
async function protectedState(api,site){
 const base=`accounts/${ACCOUNT}/env`,q=`?site_id=${SITE}`;
 const data=await Promise.all([api(base+q),api(base+q+'&scope=functions'),api(base),api(base+'?scope=functions'),api(`sites/${SITE}/snippets`)]);
 const settings={...site.build_settings};delete settings.updated_at;
 return {...environmentFor({site:data[0],siteFunctions:data[1],shared:data[2],sharedFunctions:data[3],buildSettings:settings}),snippets:fingerprint(data[4]),domain:site.custom_domain};
}
async function baselineCheck(api,b){const site=await api(`sites/${SITE}`);assert.equal(site.account_id,ACCOUNT);assert.equal(site.published_deploy?.id,BASE);assert.equal(site.published_deploy.locked,true);const d=await api(`deploys/${BASE}`);assert.equal(d.state,'ready');assert.equal(d.locked,true);eq(await inventory(api,BASE),b.files,'Baseline files');eq(d.available_functions,b.deploy.available_functions,'Baseline backend');eq(d.function_schedules,b.deploy.function_schedules,'Baseline schedules');eq(runtime(d),runtime(b.deploy),'Baseline runtime');eq(await protectedState(api,site),b.protected,'Protected configuration');return site;}
async function served(origin,b){
 for(const [p,s]of Object.entries(SOURCES)){const r=await fetch(origin+p,{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok);const bytes=Buffer.from(await r.arrayBuffer());if(p.endsWith('.js'))assert.equal(hash(bytes),b.files[p]);else{const html=bytes.toString();assert(html.includes('Register the new Sui application')&&html.includes('0.02 SUI')&&html.includes('./app.js'));}}
 const r=await fetch(origin+'/api/generation-registration',{redirect:'error',signal:AbortSignal.timeout(45000)});assert(r.ok,'Simulation endpoint failed');const p=await r.json();await review(p,{address:C.sender,chains:['sui:mainnet']});
 return {origin,checkedAt:new Date().toISOString(),estimatedNetGasMist:p.estimatedNetGasMist,exactSimulationVerified:true};
}
async function candidateCheck(api,b,s){
 assert(/^[a-f0-9]{24}$/.test(s.id)&&s.id!==BASE);assert.equal(s.baselineId,BASE);assert.equal(s.planHash,fingerprint(b));
 const d=await api('deploys/'+s.id);assert.equal(d.site_id,SITE);assert.equal(d.created_at,s.createdAt);assert.equal(d.title,b.title);assert(Date.parse(d.created_at)>=Date.parse(s.requestStartedAt)-10000);assert.equal(d.state,'ready');
 assert(s.added,'New provider record was not verified');assert.equal(s.added.d,b.added.d);preserve(d,b.deploy,s.added);eq(await inventory(api,s.id),b.files,'Candidate files');return d;
}
export async function main(mode){
 assert(['prepare','publish','audit'].includes(mode));const token=readToken(),raw=apiClient(token);let cancellable=null;
 const api=(p,m='GET',body)=>{assert((mode==='prepare'&&m==='POST'&&p===`deploys/${cancellable}/cancel`)||m==='GET'||(mode==='prepare'&&m==='POST'&&p.startsWith(`sites/${SITE}/deploys?title=`))||(mode==='publish'&&m==='POST'&&/^deploys\/[a-f0-9]{24}\/lock$/.test(p)),'Forbidden operation');return raw(p,m,body);};
 fs.mkdirSync(DIR,{recursive:true});let b,s;
 if(mode==='prepare'){
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const site=await api('sites/'+SITE),d=await api('deploys/'+BASE);assert.equal(site.published_deploy?.id,BASE);assert.equal(d.locked,true);validateBackend(d);
  const files=await inventory(api,BASE);assert(Object.keys(files).length>=669);assert.equal(d.available_functions.length,54);assert.equal(d.function_schedules.length,5);assert(!d.available_functions.some(f=>f.n===FN));
  // Get routing/provider metadata from the exact-source preview; build/upload only the new service.
  let preview;
  for(let i=0;i<60;i++){const rows=await api(`sites/${SITE}/deploys?per_page=100`);preview=rows.find(x=>x.commit_ref===commit&&x.context==='deploy-preview'&&x.state==='ready');if(preview)break;await delay(5000);}assert(preview,'Exact source preview not ready');
  preview=await api('deploys/'+preview.id);const added=preview.available_functions.find(f=>f.n===FN);assert(added);assert.equal(added.r,'nodejs24.x');assert.equal(added.im,'stream');assert.equal(added.ro.length,1);assert.equal(added.ro[0].p,'/api/generation-registration');
  const built=await zipFunction('netlify/preview-functions/generation-registration.mjs',DIR,{basePath:process.cwd(),repositoryRoot:process.cwd(),config:{'*':{nodeBundler:'esbuild',nodeVersion:'24.x'}}});
  assert.equal(built.name,FN);assert.equal(built.invocationMode,'stream');assert.equal(built.runtimeVersion,'nodejs24.x');assert(!built.schedule);eq(JSON.parse(JSON.stringify(built.routes)),[{pattern:'/api/generation-registration',literal:'/api/generation-registration',methods:[]}],'New function route');
  const zip=fs.readFileSync(built.path);added.d=createHash('sha256').update(zip).digest('hex');added.s=zip.length;added.bd=built.buildData;
  const preserved={id:d.id,site_id:d.site_id,available_functions:d.available_functions,function_schedules:d.function_schedules,...runtime(d)};
  b={baselineId:BASE,sourceCommit:commit,title:'Approved generation registration handoff '+commit,deploy:preserved,baselineFiles:files,files:assemble(files),added,previewId:preview.id,protected:await protectedState(api,site),createdAt:new Date().toISOString()};
  await baselineCheck(api,{...b,files:b.baselineFiles});write(DIR+'/plan.json',b);
  const combined={...d,available_functions:[...d.available_functions,added]};const start=new Date().toISOString();
  const out=await api(`sites/${SITE}/deploys?title=${encodeURIComponent(b.title)}`,'POST',{files:b.files,functions:Object.fromEntries(combined.available_functions.map(f=>[f.n,f.d])),functions_config:functionsConfig(combined),function_schedules:d.function_schedules,draft:false,async:false,branch:d.branch});
  s={id:out.id,baselineId:BASE,planHash:fingerprint(b),createdAt:out.created_at,requestStartedAt:start,sourceCommit:commit};write(DIR+'/candidate.json',s);
  assert.notEqual(s.id,BASE);assert(!out.published_at&&!out.locked);for(const k of ['required_edge_functions','required_server'])assert(!out[k]?.length,'Unexpected backend upload');
  for(const digest of out.required_functions||[]){assert.equal(digest,added.d,'Only the new service may be uploaded');const r=await fetch(`https://api.netlify.com/api/v1/deploys/${s.id}/functions/${FN}?runtime=nodejs24.x&invocation_mode=stream`,{method:'PUT',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:zip,signal:AbortSignal.timeout(30000)});assert(r.ok,'New service upload failed');}
  for(const digest of out.required||[]){const p=Object.keys(SOURCES).find(p=>b.files[p]===digest);assert(p,'Unexpected static upload');const bytes=fs.readFileSync(SOURCES[p]);assert.equal(hash(bytes),digest);const r=await fetch(`https://api.netlify.com/api/v1/deploys/${s.id}/files${p}`,{method:'PUT',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(30000)});assert(r.ok,'Static upload failed');}
  for(let i=0;i<90;i++){const x=await api('deploys/'+s.id);if(x.state==='ready')break;assert(!['error','canceled','rejected'].includes(x.state));await delay(1000);}
  const provisioned=(await api('deploys/'+s.id)).available_functions.find(f=>f.n===FN);assert(provisioned);for(const key of ['d','s','r','im','bd','ro'])eq(provisioned[key],added[key],'New service '+key);s.added=provisioned;fs.writeFileSync(DIR+'/candidate.json',JSON.stringify(s,null,2)+'\n');
  await candidateCheck(api,b,s);const check=await served(`https://${s.id}--tree-token.netlify.app`,b);await baselineCheck(api,{...b,files:b.baselineFiles});write(DIR+'/verified.json',{candidate:s.id,planHash:fingerprint(b),...check});
 }else{
  b=read(DIR+'/plan.json');s=read(DIR+'/candidate.json');const v=read(DIR+'/verified.json');assert.equal(v.candidate,s.id);assert.equal(v.planHash,fingerprint(b));
  for(const [p,f]of Object.entries(SOURCES))assert.equal(hash(fs.readFileSync(f)),b.files[p],'Reviewed source changed');
  await candidateCheck(api,b,s);
  if(mode==='publish'){
   const control=read('production/generation-registration-publish.json');assert.equal(control.candidateId,s.id);assert.equal(control.planHash,fingerprint(b));assert.equal(control.sourceCommit,b.sourceCommit);
   await baselineCheck(api,{...b,files:b.baselineFiles});await served(`https://${s.id}--tree-token.netlify.app`,b);await waitForAllBuilds(api,s.id);await baselineCheck(api,{...b,files:b.baselineFiles});
   const d=await candidateCheck(api,b,s);assert(!d.published_at&&!d.locked,'Already published; audit, do not republish');await api(`deploys/${s.id}/lock`,'POST');
  }
  const live=await api('sites/'+SITE);assert.equal(live.published_deploy.id,s.id);assert.equal(live.published_deploy.locked,true);await candidateCheck(api,b,s);eq(await protectedState(api,live),b.protected,'Protected configuration');const check=await served('https://tree-token.xyz',b);write(DIR+'/published.json',{candidate:s.id,baselineId:BASE,sourceCommit:b.sourceCommit,staticPaths:Object.keys(b.files).length,preservedStaticPaths:Object.keys(b.files).length-2,functions:55,preservedFunctions:54,schedules:5,...check});
 }
 console.log(JSON.stringify({mode,candidate:s.id,planHash:fingerprint(b),sourceCommit:b.sourceCommit,staticPaths:Object.keys(b.files).length,preservedStaticPaths:Object.keys(b.files).length-2,functions:55,schedules:5}));
}
if(process.argv[1]?.endsWith('/release-generation-registration.mjs'))main(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
