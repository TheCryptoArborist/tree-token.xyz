// Bounded frontend-only Daily Growth polish. Reuse all 241 existing public
// paths and all 40 complete function records; change only the three overlays.
// The initialized official Netlify CLI owns authentication. Secrets stay in memory.
// Usage: node scripts/release-daily-growth-polish.mjs capture|candidate|verify|publish|published CLI_DIRECTORY [CANDIDATE_ID]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync,createReadStream} from 'node:fs';

const root=resolve(import.meta.dirname,'..');
const [mode,cliDirectory,requestedId]=process.argv.slice(2);
export const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
export const expectedBaselineId='6ae666a66f1d3899025a76af';
export const sourceBaseCommit='625dac2962041b7f36a5881d31a9e62b532f3cf4';
export const sourceBranch='feature/daily-growth-arcade-polish-20261031';
export const existingPaths=['/play/index.html','/scripts/arcade-daily-growth.js','/styles/tree-arcade-suite.css'];
export const protectedSourcePaths=['package.json','package-lock.json'];
const expectedBaselineFiles=241;
const expectedDatabaseBranch='feature/treeforce89-play-integration';
const expectedDatabaseIdentity='df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065';
const stateDirectory=resolve(root,'.netlify');
const baselinePath=resolve(stateDirectory,'daily-growth-polish-baseline.json');
const candidatePath=resolve(stateDirectory,'daily-growth-polish-candidate.json');
const verificationPath=resolve(stateDirectory,'daily-growth-polish-verification.json');
const publishedPath=resolve(root,'docs/daily-growth-polish-published.json');
let phase='initialization';
class ReleaseError extends Error {}
const check=(condition,message)=>{if(!condition)throw new ReleaseError(message);};
const equal=(actual,expected,message)=>check(isDeepStrictEqual(actual,expected),message);
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const hash=(algorithm,value)=>createHash(algorithm).update(value).digest('hex');
const fingerprint=value=>hash('sha256',JSON.stringify(value));
const readSource=path=>readFileSync(resolve(root,path));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function save(file,value){
 mkdirSync(resolve(file,'..'),{recursive:true});
 const temporary=file+'.tmp';
 writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});
 renameSync(temporary,file);
}
function migrationCount(deploy){
 const value=deploy.database_migrations;
 if(value==null)return 0;
 if(Array.isArray(value))return value.length;
 check(Array.isArray(value.files),'Unrecognized database migration metadata; stop.');
 return value.files.length;
}
function sanitizedDeploy(deploy){
 // The full provider response can contain environment or skew-protection tokens.
 return Object.fromEntries([
  'id','site_id','state','locked','branch','context','created_at','published_at',
  'available_functions','function_schedules','functions_region',
  'functions_region_overrides','edge_functions_present','database_migrations',
 ].filter(key=>deploy[key]!==undefined).map(key=>[key,deploy[key]]));
}
function evidenceFrom(previous,evidence){
 check(evidence.siteId===siteId&&evidence.isolationVerified===true,'Database evidence does not match this site.');
 check(evidence.branch===expectedDatabaseBranch,'Database branch evidence differs from the existing game runtime.');
 check(previous.paymentsEnabled===true,'Expected the existing enabled paid-continue setting.');
 check(evidence.previewDatabaseIdentity===expectedDatabaseIdentity&&previous.isolatedDatabaseIdentity===expectedDatabaseIdentity,
  'Database identity evidence differs from the existing game runtime or current release.');
 check(Array.isArray(evidence.productionDatabaseIdentities)&&!evidence.productionDatabaseIdentities.includes(evidence.previewDatabaseIdentity),
  'Database isolation evidence failed.');
 return {branch:evidence.branch,siteId,previewDatabaseIdentity:evidence.previewDatabaseIdentity,
  productionDatabaseIdentities:evidence.productionDatabaseIdentities,isolationVerified:true,paymentsEnabled:true};
}
function originalInventory(baseline){
 check(Array.isArray(baseline.files)&&baseline.files.length===expectedBaselineFiles&&
  new Set(baseline.files.map(file=>file.path)).size===expectedBaselineFiles,'Captured static inventory must contain 241 unique paths.');
 for(const file of baseline.files)
  check(typeof file.path==='string'&&file.path.startsWith('/')&&file.path===file.path.toLowerCase()&&/^[a-f0-9]{40}$/.test(file.sha||''),
   'Captured static path or digest is invalid.');
 return Object.fromEntries(baseline.files.map(file=>[file.path,file.sha]));
}
export function validateStaticInventory(original,files){
 check(Object.keys(original).length===expectedBaselineFiles,'The static baseline must contain 241 paths.');
 equal(Object.keys(files).sort(),Object.keys(original).sort(),'All 241 existing public paths must remain; no new public path is allowed.');
 const changed=Object.keys(original).filter(path=>files[path]!==original[path]).sort();
 check(changed.every(path=>existingPaths.includes(path)),'A public file outside the three approved Daily Growth overlays changed.');
 check(changed.length>0,'The Daily Growth polish must contain at least one reviewed frontend change.');
 for(const [path,digest] of Object.entries(files))
  check(path===path.toLowerCase()&&/^[a-f0-9]{40}$/.test(digest||''),'Candidate public path or SHA1 digest is invalid.');
 return changed;
}
export function buildFiles(baseline,{readSource:readInput=readSource}={}){
 const original=originalInventory(baseline),files={...original};
 const overlay=existingPaths.map(path=>{
  check(Object.hasOwn(original,path),'An approved overlay is absent from the current static baseline.');
  const source=path.slice(1),bytes=readInput(source),sha=hash('sha1',bytes);
  files[path]=sha;
  return {path,source,sha,size:bytes.length};
 });
 const changedExistingPaths=validateStaticInventory(original,files);
 return {original,files,overlay,changedExistingPaths};
}
export function sourceIsPinned(state,overlay,{readCommitted,assertAncestor,readSource:readInput=readSource}={}){
 check(/^[a-f0-9]{40}$/.test(state.sourceCommit||''),'Candidate source commit is missing.');
 const ancestry=assertAncestor||((older,newer)=>git('merge-base','--is-ancestor',older,newer));
 try{ancestry(sourceBaseCommit,state.sourceCommit);ancestry(state.sourceCommit,'HEAD');}
 catch{throw new ReleaseError('The candidate must descend from the reviewed starting commit and remain an ancestor of HEAD.');}
 const committedFile=(commit,path)=>readCommitted?readCommitted(commit,path):
  execFileSync('git',['show',commit+':'+path],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
 equal(overlay.map(file=>file.path).sort(),existingPaths,'Source pinning requires exactly the three approved overlays.');
 for(const file of overlay){
  check(file.source===file.path.slice(1),'Candidate static source path is invalid.');
  let committed;
  try{committed=committedFile(state.sourceCommit,file.source);}
  catch{throw new ReleaseError('A candidate static file is absent from its recorded source commit.');}
  check(hash('sha1',committed)===file.sha,'A static file changed after the candidate source commit.');
 }
 for(const path of protectedSourcePaths){
  let before,committed;
  try{before=committedFile(sourceBaseCommit,path);committed=committedFile(state.sourceCommit,path);}
  catch{throw new ReleaseError('A protected root dependency file is missing from source history.');}
  check(hash('sha256',committed)===hash('sha256',before)&&hash('sha256',readInput(path))===hash('sha256',before),
   'Root package metadata or dependency lock changed during frontend-only polish.');
 }
}
function completeFunctionRecords(functions){
 check(Array.isArray(functions)&&functions.length===40&&new Set(functions.map(fn=>fn.n)).size===40,
  'The complete backend must contain the same 40 unique function records.');
 for(const fn of functions)
  check(typeof fn.n==='string'&&/^[a-f0-9]{64}$/.test(fn.d||'')&&typeof fn.id==='string'&&
   /^\d{12}$/.test(fn.a||'')&&typeof fn.r==='string'&&typeof fn.rg==='string'&&typeof fn.im==='string',
   'A full function package/provider/runtime record is incomplete.');
}
export function configurationFor(functions){
 completeFunctionRecords(functions);
 const digests={},configurations={};
 const route=value=>Object.fromEntries(Object.entries({pattern:value.p,literal:value.l,expression:value.e,methods:value.m,prefer_static:value.ps})
  .filter(([,entry])=>entry!=null));
 for(const fn of functions){
  digests[fn.n]=fn.d;
  const config={},normalized={...fn,m:fn.m??fn.mo,rg:fn.rg??fn.rgo};
  for(const [short,long] of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))
   if(normalized[short]!=null)config[long]=normalized[short];
  if(fn.ro)config.routes=fn.ro.map(route);
  if(fn.er)config.excluded_routes=fn.er.map(route);
  configurations[fn.n]=config;
 }
 return {functions:digests,functions_config:configurations};
}
export function verifyFunctionRecords(actual,expected){
 completeFunctionRecords(expected);completeFunctionRecords(actual);
 equal(actual,expected,'Full backend package/provider/runtime/configuration records changed.');
}
export function verifyFunctionUploadDemand(requiredFunctions){
 check(Array.isArray(requiredFunctions)&&requiredFunctions.length===0,'Refuse every function upload or replacement for this frontend-only release.');
}
export function verifyRuntime(candidate,baseline){
 verifyFunctionRecords(candidate.available_functions,baseline.available_functions);
 check(Array.isArray(baseline.function_schedules)&&baseline.function_schedules.length===5,'The baseline must contain all five schedules.');
 equal(candidate.function_schedules,baseline.function_schedules,'Scheduled jobs changed.');
 equal(candidate.functions_region,baseline.functions_region,'Function region changed.');
 equal(candidate.functions_region_overrides,baseline.functions_region_overrides,'Function region override records or ordering changed.');
 equal(candidate.branch,baseline.branch,'Runtime branch context changed.');
 equal(candidate.context,baseline.context,'Deployment context changed.');
 check(!candidate.edge_functions_present&&!baseline.edge_functions_present,'Refuse edge functions in this frontend-only release.');
 check(migrationCount(candidate)===0&&migrationCount(baseline)===0,'Refuse Netlify database migrations in this frontend-only release.');
}
export function verifyNewCandidate(candidate,baseline,candidateId){
 check(candidateId!==expectedBaselineId&&/^[a-f0-9]{24}$/.test(candidateId||'')&&
  candidate.id===candidateId&&candidate.site_id===siteId&&candidate.state==='ready','The new candidate must be ready on the expected site.');
 const created=Date.parse(candidate.created_at),previousCreated=Date.parse(baseline.created_at);
 check(Number.isFinite(created)&&Number.isFinite(previousCreated)&&created>previousCreated,'Refuse publication of an older deployment.');
 verifyRuntime(candidate,baseline);
}
export function verifyForwardPublication(candidate,verification,priorVerification){
 check(candidate.id===verification.id&&candidate.id!==expectedBaselineId&&verification.baseline===expectedBaselineId,
  'Forward publication requires the exact new recorded candidate.');
 for(const key of ['id','siteId','baseline','sourceCommit','baselineDigest','filesDigest','sourceBranch','sourceBaseCommit'])
  equal(priorVerification[key],verification[key],'The exact candidate and source require successful prior verification.');
 check(priorVerification.unpublished===true&&!candidate.published_at,
  'Forward publication requires this new, never-published candidate.');
}
export function verifyPublishedBaseline(previous,baseline,previousFiles,current,candidateId){
 check(candidateId!==expectedBaselineId&&/^[a-f0-9]{24}$/.test(candidateId||''),'Published verification requires a new candidate identity.');
 check(previous.id===expectedBaselineId&&previous.site_id===siteId&&previous.state==='ready','Previous deployment identity or ready state changed.');
 verifyRuntime(previous,baseline.deploy);
 equal(previousFiles,originalInventory(baseline),'Previous deployment static inventory changed after publication.');
 check(previous.locked===true||previous.locked===false||previous.locked==null,'Unexpected previous-deployment lock metadata.');
 // Only the current publication is pinned. Relocking the old deploy would publish it.
 check(current.id===siteId&&current.published_deploy?.id===candidateId&&current.published_deploy.locked===true,
  'The new candidate must be the current locked publication.');
 return previous.locked??null;
}

async function runRelease(api,fetch){
 const inventory=async id=>{
  const rows=[];
  for(let page=1;page<=4;page++){
   const response=await fetch(api.basePath+'/deploys/'+id+'/files?per_page=100&page='+page,{headers:api.defaultHeaders,agent:api.agent});
   check(response.ok,'Could not read the deployed static inventory (HTTP '+response.status+').');
   const batch=await response.json();check(Array.isArray(batch),'Unexpected deployed inventory response.');
   rows.push(...batch);
   if(batch.length<100)break;
   check(page<4,'Deployed static inventory exceeds this bounded release scope.');
  }
  check(new Set(rows.map(file=>file.path)).size===rows.length,'Duplicate deployed static paths.');
  return Object.fromEntries(rows.map(file=>[file.path,file.sha]));
 };
 const currentIs=async(id,{requireLocked=true}={})=>{
  const site=await api.getSite({siteId});
  check(site.id===siteId&&site.published_deploy?.id===id,'Production changed concurrently; stop.');
  if(requireLocked)check(site.published_deploy.locked===true,'The current published deployment is not locked in site metadata.');
 };
 if(mode==='capture'){
  phase='read-only baseline capture';
  const previous=read(resolve(root,'docs/treeforce-participation-published.json'));
  const databaseEvidence=evidenceFrom(previous,read(resolve(root,'docs/arcade-suite-database-evidence.json')));
  check(previous.id===expectedBaselineId&&previous.files===expectedBaselineFiles,'Previous release evidence differs from the expected live baseline.');
  await currentIs(expectedBaselineId);
  const live=await api.getDeploy({deployId:expectedBaselineId});
  check(live.id===expectedBaselineId&&live.site_id===siteId&&live.state==='ready'&&live.locked===true,
   'The expected live baseline is not ready and locked.');
  verifyFunctionRecords(live.available_functions,previous.functionRecords);
  equal(live.function_schedules,previous.functionSchedules,'Live schedules differ from the previous release.');
  check(live.function_schedules?.length===5&&live.branch==='main'&&live.context==='production','Live schedule or runtime context differs from the reviewed baseline.');
  equal(live.functions_region,previous.functionRegion,'Live function region differs from the previous release.');
  equal(live.functions_region_overrides,previous.functionRegionOverrides,'Live region overrides differ from the previous release.');
  check(!live.edge_functions_present&&migrationCount(live)===0,'Unexpected edge functions or Netlify migrations.');
  const files=await inventory(live.id);
  equal(files,previous.filesBySha1,'Live static inventory differs from the previous release.');
  check(Object.keys(files).length===expectedBaselineFiles,'Live static inventory must contain 241 paths.');
  await currentIs(expectedBaselineId);
  const baseline={siteId,capturedAt:new Date().toISOString(),previousSourceCommit:previous.sourceCommit,
   deploy:sanitizedDeploy(live),files:Object.entries(files).map(([path,sha])=>({path,sha})),databaseEvidence};
  if(existsSync(candidatePath)){
   check(existsSync(baselinePath),'Candidate state exists without its baseline; stop.');
   const old=read(baselinePath);
   equal(old.deploy,baseline.deploy,'Do not overwrite a candidate baseline with changed deployment metadata.');
   equal(old.files,baseline.files,'Do not overwrite a candidate baseline with changed static paths.');
   console.log(JSON.stringify({mode,id:live.id,files:241,functions:40,schedules:5,locked:true,existingCapturePreserved:true}));
   return;
  }
  save(baselinePath,baseline);
  console.log(JSON.stringify({mode,id:live.id,files:241,functions:40,schedules:5,locked:true,baselineSaved:true}));
  return;
 }

 phase='baseline preflight';
 const baseline=read(baselinePath);
 check(baseline.siteId===siteId&&baseline.deploy.id===expectedBaselineId,'Unexpected captured baseline.');
 const {original,files,overlay,changedExistingPaths}=buildFiles(baseline);
 const originalDeploy=await api.getDeploy({deployId:expectedBaselineId});
 check(originalDeploy.id===expectedBaselineId&&originalDeploy.site_id===siteId&&originalDeploy.state==='ready','Captured baseline identity or ready state changed.');
 verifyRuntime(originalDeploy,baseline.deploy);
 equal(await inventory(expectedBaselineId),original,'Baseline static inventory changed.');
 const proof={baselineDigest:fingerprint(baseline),filesDigest:fingerprint(files),sourceBranch,sourceBaseCommit};
 let state;
 if(mode==='candidate'){
  check(!requestedId,'Candidate creation does not accept an existing deployment ID.');
  check(!existsSync(candidatePath),'A candidate already exists; use verify/publish with its recorded ID.');
  check(git('status','--porcelain')==='','Commit the reviewed source before candidate creation.');
  check(git('branch','--show-current')===sourceBranch,'Create the candidate from the reviewed Daily Growth polish feature branch.');
  const sourceCommit=git('rev-parse','HEAD');
  // Verify all three committed overlays and protected dependencies before any mutation.
  sourceIsPinned({sourceCommit},overlay);
  check(originalDeploy.locked===true,'The existing production deployment must remain locked.');
  await currentIs(expectedBaselineId);
  phase='existing isolated database binding';
  const evidence=baseline.databaseEvidence;
  check(evidence.siteId===siteId&&evidence.isolationVerified===true&&evidence.paymentsEnabled===true&&
   evidence.branch===expectedDatabaseBranch&&evidence.previewDatabaseIdentity===expectedDatabaseIdentity&&Array.isArray(evidence.productionDatabaseIdentities),
   'Captured runtime evidence is incomplete.');
  const {branches}=await api.listSiteDatabaseBranches({siteId});
  const branch=branches.find(value=>value.name===evidence.branch);
  check(Boolean(branch?.branch_id),'The existing isolated game database branch was not found.');
  const database=await api.getSiteDatabaseBranch({siteId,branchId:branch.branch_id,role:'netlifydb_owner'});
  let connectionString=database.connection_string||database.connectionString,connection;
  try{connection=new URL(connectionString);}
  catch{throw new ReleaseError('The existing database binding is not a valid connection URL.');}
  check(connection.username==='netlifydb_owner'&&['postgres:','postgresql:'].includes(connection.protocol),'Unexpected existing database binding type.');
  const identity=hash('sha256',connection.hostname.replace(/-pooler(?=\.)/,'')+'|'+connection.pathname);
  check(identity===evidence.previewDatabaseIdentity&&!evidence.productionDatabaseIdentities.includes(identity),'Game database identity or isolation changed.');
  // Exactly the two existing per-deploy overrides. No site environment is written.
  const environment=[
   {key:'TREEFORCE89_DEV_DATABASE_URL',value:connectionString,is_secret:true,scopes:['functions']},
   {key:'TREEFORCE89_PAID_CONTINUES_ENABLED',value:'true',is_secret:false,scopes:['functions']},
  ];
  phase='create unpublished candidate';
  await currentIs(expectedBaselineId);
  check((await api.getDeploy({deployId:expectedBaselineId})).locked===true,'Production publication lock changed; stop.');
  let created;
  try{
   created=await api.createSiteDeploy({siteId,title:'TREE Arcade: Daily Growth visual polish and wallet picker',body:{
    files,...configurationFor(originalDeploy.available_functions),function_schedules:originalDeploy.function_schedules,
    draft:false,async:false,branch:originalDeploy.branch,commit_ref:sourceCommit,environment,
   }});
  }finally{environment[0].value='';connectionString='';connection=null;}
  check(/^[a-f0-9]{24}$/.test(created.id||''),'Candidate creation did not return a deployment ID.');
  state={id:created.id,siteId,baseline:expectedBaselineId,sourceCommit,
   createdAt:created.created_at||new Date().toISOString(),...proof,overlay};
  // Preserve the exact ID even if the provider unexpectedly demands other uploads.
  save(candidatePath,state);
  console.log(JSON.stringify({candidateId:state.id,sourceCommit,baseline:expectedBaselineId,candidateRecorded:true}));
  check(created.id!==expectedBaselineId&&!created.published_at,'Candidate was unexpectedly published; stop and inspect its lock.');
  verifyFunctionUploadDemand(created.required_functions??[]);
  check(Array.isArray(created.required_edge_functions??[])&&(created.required_edge_functions??[]).length===0,'Refuse every edge-function upload.');
  const required=created.required??[];
  check(Array.isArray(required)&&required.every(digest=>overlay.some(file=>file.sha===digest)),'Refuse an unrelated static-file upload.');
  await currentIs(expectedBaselineId);
  phase='upload the reviewed frontend overlays';
  for(const digest of required){
   const file=overlay.find(value=>value.sha===digest);
   await api.uploadDeployFile({deployId:state.id,path:encodeURI(file.path.slice(1)),body:()=>createReadStream(resolve(root,file.source))});
  }
 }else{
  state=read(candidatePath);
  check(requestedId===state.id,'Pass the exact recorded candidate deployment ID.');
 }
 check(state.id!==expectedBaselineId&&state.siteId===siteId&&state.baseline===expectedBaselineId,'Unexpected candidate identity.');
 check(/^[a-f0-9]{24}$/.test(state.id||''),'Invalid recorded candidate ID.');
 equal({baselineDigest:state.baselineDigest,filesDigest:state.filesDigest,sourceBranch:state.sourceBranch,sourceBaseCommit:state.sourceBaseCommit},proof,
  'Candidate baseline, static inventory, or source branch changed.');
 equal(state.overlay,overlay,'Candidate overlay differs from the reviewed files.');
 sourceIsPinned(state,overlay);
 const verifyCandidate=async()=>{
  let candidate;
  for(let attempt=0;attempt<45;attempt++){
   candidate=await api.getDeploy({deployId:state.id});
   if(candidate.state==='ready')break;
   check(!['error','canceled'].includes(candidate.state),'Candidate deployment failed; inspect its Netlify log.');
   await new Promise(done=>setTimeout(done,1000));
  }
  verifyNewCandidate(candidate,baseline.deploy,state.id);
  equal(await inventory(state.id),files,'Candidate static inventory differs from the exact three-file overlay.');
  return candidate;
 };
 phase='candidate verification';
 let candidate=await verifyCandidate();
 const verification={id:state.id,siteId,baseline:expectedBaselineId,sourceCommit:state.sourceCommit,...proof,
  verifiedAt:new Date().toISOString(),files:241,functions:40,functionsPreserved:40,schedulesPreserved:5,unpublished:!candidate.published_at};
 let previousDeployLocked;
 const verifyPreviousAfterPublication=async()=>{
  previousDeployLocked=verifyPublishedBaseline(await api.getDeploy({deployId:expectedBaselineId}),baseline,
   await inventory(expectedBaselineId),await api.getSite({siteId}),state.id);
 };
 if(mode==='publish'){
  phase='verified forward-publication preflight';
  const priorVerification=read(verificationPath);
  verifyForwardPublication(candidate,verification,priorVerification);
  await currentIs(expectedBaselineId);
  check((await api.getDeploy({deployId:expectedBaselineId})).locked===true,'Production publication lock changed; stop.');
  phase='forward publication and immediate lock';
  // This historically named API accepts ONLY the new, recorded, verified candidate.
  try{await api.restoreSiteDeploy({siteId,deployId:state.id});}
  catch{
   const current=await api.getSite({siteId});
   check(current.id===siteId&&current.published_deploy?.id===state.id,'Forward publication failed or is uncertain; inspect the recorded candidate.');
  }
  await api.lockDeploy({deployId:state.id});
  await currentIs(state.id);
  candidate=await verifyCandidate();
  check(candidate.locked===true,'Published candidate is not locked.');
  await verifyPreviousAfterPublication();
 }else if(mode==='published'){
  phase='read-only published release verification';
  await currentIs(state.id);
  check(candidate.locked===true,'Published candidate must be locked before recording success.');
  await verifyPreviousAfterPublication();
 }else{
  await currentIs(expectedBaselineId);
  check((await api.getDeploy({deployId:expectedBaselineId})).locked===true,'Existing production lock changed during verification.');
  check(!candidate.published_at,'Expected an unpublished review candidate.');
 }
 save(verificationPath,{...verification,verifiedAt:new Date().toISOString(),unpublished:!candidate.published_at});
 const summary={id:state.id,baseline:expectedBaselineId,mode,sourceCommit:state.sourceCommit,sourceBranch,sourceBaseCommit,
  files:241,preservedStaticFiles:241-changedExistingPaths.length,changedExistingPaths,newPaths:[],
  functions:40,functionsPreserved:40,functionsReplaced:[],schedulesPreserved:5,backendUnchanged:true,noNetlifyMigrations:true,
  functionRegion:candidate.functions_region,functionRegionOverrides:candidate.functions_region_overrides,
  runtimeBranch:candidate.branch,runtimeContext:candidate.context,rootDependenciesUnchanged:true,
  paymentsEnabled:true,isolatedDatabaseIdentity:baseline.databaseEvidence.previewDatabaseIdentity,
  ...(mode==='publish'||mode==='published'?{previousDeployLocked,publicationLockScope:'current-published-deploy',
   previousDeployLockNote:'Netlify pins auto publishing to the current published deploy. Locking a previous deploy would publish it again; its observed lock value is recorded rather than restored.'}:{}),
  publishedAt:candidate.published_at||null,url:'https://tree-token.xyz/play/',
  candidateUrl:'https://'+state.id+'--tree-token.netlify.app/play/',locked:mode==='publish'||mode==='published'?candidate.locked:false};
 if(mode==='publish'||mode==='published'){
  check(Boolean(candidate.published_at),'Publication timestamp is missing; do not record production success.');
  await currentIs(state.id);
  save(publishedPath,{...summary,filesBySha1:files,functionRecords:candidate.available_functions,functionSchedules:candidate.function_schedules});
 }
 console.log(JSON.stringify(summary,null,2));
}

async function main(){
 let program;
 try{
  check(['capture','candidate','verify','publish','published'].includes(mode)&&Boolean(cliDirectory),
   'Usage: release-daily-growth-polish.mjs capture|candidate|verify|publish|published CLI_DIRECTORY [CANDIDATE_ID]');
  check(!process.env.DEBUG,'Run this credential-bearing release with DEBUG unset.');
  const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
  const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
  const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
  program=createMainCommand();
  program.command('daily-growth-polish-release').action(async(options,command)=>{
   try{await runRelease(command.netlify.api,fetch);}
   catch(error){
    const status=Number.isInteger(error?.status)?' (HTTP '+error.status+')':'';
    console.error('Daily Growth polish release stopped during '+phase+': '+(error instanceof ReleaseError?error.message:
     'Request or local operation failed'+status+'. Raw error details were withheld to protect credentials.'));
    process.exitCode=1;
   }
  });
  await runProgram(program,['node','netlify','daily-growth-polish-release']);
 }catch(error){
  console.error('Daily Growth polish release stopped during '+phase+': '+(error instanceof ReleaseError?error.message:'CLI initialization failed. Raw error details were withheld.'));
  process.exitCode=1;
 }finally{if(program)await program.onEnd();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
