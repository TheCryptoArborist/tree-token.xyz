// GET-only release planning. This program cannot create, publish or mutate a deploy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fingerprint,environmentFor,readToken} from './release-preserved-production.mjs';
import {apiClient} from './release-sti-purchase.mjs';
import {validateBackend,functionsConfig,packageTrafficRules} from './release-arcade-cutoff.mjs';
import {FUNCTION_NAME,ROOT,sha256,sourceEvidence,toolingEvidence} from './package-bnb-run-review.mjs';
export const SITE='aa62f324-b880-47d6-85b8-4ba0700ff5bf',ACCOUNT='69800888d1a3d0483003ae9e';
export const BASE='6b053183229603fcba59509e';
export const MIGRATION='supabase/migrations/20261124060157_arcade_bnb_run_review.sql';
export const ROUTES=[{pattern:'/api/arcade-bnb-test/run-review',literal:'/api/arcade-bnb-test/run-review',methods:[]}];
export const TRAFFIC={action:{type:'rate_limit',config:{rateLimitConfig:{windowLimit:20,windowSize:60,algorithm:'sliding_window'},aggregate:{keys:[{type:'domain'},{type:'ip'}]}}}};
const read=p=>JSON.parse(fs.readFileSync(p));
const equal=(a,b,label)=>assert(fingerprint(a)===fingerprint(b),label+' changed; stop');
const runtime=d=>Object.fromEntries(['branch','context','functions_region','functions_region_overrides','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations'].map(k=>[k,d[k]??null]));
export function readOnly(api){return (p,method='GET',body)=>{assert.equal(method,'GET','Planning is GET-only');assert.equal(body,undefined);return api(p);};}
export function validatePackage(m,bytes,proof){
 assert.equal(m.kind,'bnb-run-review-package');assert.equal(m.name,FUNCTION_NAME);assert.equal(m.filename,FUNCTION_NAME+'.zip');
 assert.equal(m.sha256,sha256(bytes));assert.equal(m.sha256,proof.artifact.functionZipSha256);assert.equal(bytes.length,proof.artifact.functionZipBytes);assert.equal(m.bytes,bytes.length);
 for(const flag of ['deployed','gameplayAuthorized','productionApproved','paymentsEnabled'])assert.equal(m[flag],false);
 assert.equal(m.extractedZipSmokePassed,true);assert.equal(m.runtimeVersion,'nodejs24.x');assert.equal(m.invocationMode,'stream');
 equal(m.buildData,{bootstrapVersion:'2.24.0',runtimeAPIVersion:2},'Bootstrap');equal(m.routes,ROUTES,'Routes');equal(m.trafficRules,TRAFFIC,'Admission');
 equal(m.sourceFiles,sourceEvidence(),'Source');equal(m.tooling,toolingEvidence(),'Dependency locks');
 assert(Array.isArray(m.tracedFiles)&&m.tracedFiles.length>0);
 for(const f of m.tracedFiles){assert(typeof f.path==='string'&&!path.isAbsolute(f.path)&&!f.path.split('/').includes('..'));assert.equal(sha256(fs.readFileSync(path.join(ROOT,f.path))),f.sha256,'Traced dependency/source changed: '+f.path);}
}
export function assemble(d,files,m){
 validateBackend(d);assert.equal(d.id,BASE);assert.equal(d.locked,true);assert.equal(d.state,'ready');
 assert.equal(Object.keys(files).length,691);assert.equal(d.available_functions.length,60);assert.equal(d.function_schedules.length,5);
 assert(!d.available_functions.some(f=>f.n===FUNCTION_NAME),'Review endpoint already exists');
 assert(!d.available_functions.some(f=>(f.ro||[]).some(r=>r.p===ROUTES[0].pattern)),'Route already exists');
 const cfg=functionsConfig(d);cfg[FUNCTION_NAME]={build_data:m.buildData,routes:m.routes,traffic_rules:packageTrafficRules(m.trafficRules)};
 return {files:{...files},functions:{...Object.fromEntries(d.available_functions.map(f=>[f.n,f.d])),[FUNCTION_NAME]:m.sha256},functions_config:cfg,function_schedules:structuredClone(d.function_schedules),draft:false,async:false,branch:d.branch};
}
export function assertDisabled(rows,buildSettings={}){
 for(const row of rows)if(row.key==='BNB_RUN_REVIEW_ENABLED')for(const v of row.values||[])assert(v.value!==undefined&&v.value!=='true','Enabled or masked review toggle; disabled publication not proven');
 assert(buildSettings.env?.BNB_RUN_REVIEW_ENABLED!=='true','Build toggle already enabled');
}
async function inventory(api){const files={};for(let page=1;page<=100;page++){
 const rows=await api(`deploys/${BASE}/files?per_page=100&page=${page}`);assert(Array.isArray(rows));
 for(const r of rows){assert(typeof r.path==='string'&&r.path.startsWith('/')&&!Object.hasOwn(files,r.path));assert(/^[a-f0-9]{40}$/.test(r.sha));files[r.path]=r.sha;}
 if(rows.length<100)return files;
 }throw Error('Incomplete inventory');}
async function capture(api){
 const site=await api('sites/'+SITE);assert.equal(site.account_id,ACCOUNT);assert.equal(site.published_deploy?.id,BASE);assert.equal(site.published_deploy.locked,true);
 const d=await api('deploys/'+BASE);validateBackend(d);assert.equal(d.state,'ready');assert.equal(d.locked,true);
 const q=`?site_id=${SITE}`,base=`accounts/${ACCOUNT}/env`;
 const env=await Promise.all([api(base+q),api(base+q+'&scope=functions'),api(base),api(base+'?scope=functions')]);
 assertDisabled([...env[0],...env[2]],site.build_settings);
 const protectedState={...environmentFor({site:env[0],siteFunctions:env[1],shared:env[2],sharedFunctions:env[3],buildSettings:site.build_settings}),snippets:fingerprint(await api('sites/'+SITE+'/snippets')),domain:site.custom_domain};
 return {deploy:{id:d.id,site_id:d.site_id,state:d.state,locked:d.locked,available_functions:d.available_functions,function_schedules:d.function_schedules,...runtime(d)},files:await inventory(api),protected:protectedState};
}
export async function main(){
 const directory=process.argv[2],out=process.argv[3];assert(directory&&out,'Usage: prepare-bnb-run-release.mjs PACKAGE_DIR OUTPUT_DIR');assert(!fs.existsSync(out),'Use a fresh output directory');
 const m=read(path.join(directory,'manifest.json')),bytes=fs.readFileSync(path.join(directory,FUNCTION_NAME+'.zip'));
 const proof=read('docs/multichain/generation-milestone/run-endpoint/validation.json');validatePackage(m,bytes,proof);
 const migration=read('docs/multichain/generation-milestone/run-endpoint/package-review.json').migration;
 assert.equal(sha256(fs.readFileSync(MIGRATION)),migration.sha256,'Migration changed');
 const api=readOnly(apiClient(readToken())),baseline=await capture(api),payload=assemble(baseline.deploy,baseline.files,m);
 const again=await capture(api);equal(again,baseline,'Live baseline/config during capture');
 const plan={schemaVersion:1,preparedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineId:BASE,baseline,request:payload,package:{sha256:m.sha256,bytes:m.bytes,runtimeVersion:m.runtimeVersion,invocationMode:m.invocationMode,artifact:proof.artifact,ci:proof.ci},migration:{path:MIGRATION,sha256:migration.sha256,includedInPublication:false},scope:{staticChanges:0,existingFunctionsPreserved:60,addedFunctions:1,schedulesPreserved:5,enabled:false,migrationApplied:false,gameplayAuthorized:false,remoteWrites:0}};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 const summary={baselineId:BASE,planHash:fingerprint(plan),sourceCommit:plan.sourceCommit,staticPaths:Object.keys(baseline.files).length,...plan.scope,packageSha256:m.sha256};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
