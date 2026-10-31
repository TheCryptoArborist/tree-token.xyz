// Bounded HTML/CSS forward release: mark TREE FORCE 89 live and highlight its
// arcade poster badge. The initialized official
// Netlify CLI owns authentication. Credentials and database URLs are never saved.
// Usage: node scripts/release-treeforce-live-badge.mjs capture|candidate|verify|publish|published CLI_DIRECTORY [CANDIDATE_ID]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync,createReadStream} from 'node:fs';

const root=resolve(import.meta.dirname,'..');
const [mode,cliDirectory,requestedId]=process.argv.slice(2);
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
const expectedBaselineId='6ae5879d07576659dfd6fd1a';
const expectedDatabaseBranch='feature/treeforce89-play-integration';
const expectedDatabaseIdentity='df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065';
const sourceBranch='feature/treeforce-live-badge-20261031';
const existingPaths=['/play/index.html','/styles/tree-arcade-suite.css'];
const newPaths=[];
const overlayPaths=[...existingPaths].sort();
const stateDirectory=resolve(root,'.netlify');
const baselinePath=resolve(stateDirectory,'treeforce-live-badge-baseline.json');
const candidatePath=resolve(stateDirectory,'treeforce-live-badge-candidate.json');
const verificationPath=resolve(stateDirectory,'treeforce-live-badge-verification.json');
const publishedPath=resolve(root,'docs/treeforce-live-badge-published.json');
let phase='initialization';
class ReleaseError extends Error {}
const check=(condition,message)=>{if(!condition)throw new ReleaseError(message);};
const equal=(actual,expected,message)=>check(isDeepStrictEqual(actual,expected),message);
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const hash=(algorithm,value)=>createHash(algorithm).update(value).digest('hex');
const fingerprint=value=>hash('sha256',JSON.stringify(value));
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
 // Never persist the full deploy: it can contain skew-protection tokens or env.
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
 check(evidence.previewDatabaseIdentity===expectedDatabaseIdentity&&previous.isolatedDatabaseIdentity===expectedDatabaseIdentity,'Database identity evidence differs from the existing game runtime or current release.');
 check(Array.isArray(evidence.productionDatabaseIdentities)&&!evidence.productionDatabaseIdentities.includes(evidence.previewDatabaseIdentity),'Database isolation evidence failed.');
 return {branch:evidence.branch,siteId,previewDatabaseIdentity:evidence.previewDatabaseIdentity,
  productionDatabaseIdentities:evidence.productionDatabaseIdentities,isolationVerified:true,paymentsEnabled:true};
}
function buildFiles(baseline){
 const original=Object.fromEntries(baseline.files.map(file=>[file.path,file.sha]));
 const files={...original};
 const overlay=overlayPaths.map(path=>{
  const source=resolve(root,path.slice(1));
  const bytes=readFileSync(source),sha=hash('sha1',bytes);
  files[path]=sha;return {path,source,sha,size:bytes.length};
 });
 equal(Object.keys(original).filter(path=>files[path]!==original[path]).sort(),existingPaths,'Only the existing arcade HTML and stylesheet may change.');
 equal(Object.keys(files).filter(path=>!Object.hasOwn(original,path)).sort(),newPaths,'No new public paths are allowed for the live-badge release.');
 check(Object.keys(original).length===231&&Object.keys(files).length===231,'Static inventory size differs from the reviewed scope.');
 return {original,files,overlay};
}
function sourceIsPinned(state,overlay){
 check(/^[a-f0-9]{40}$/.test(state.sourceCommit||''),'Candidate source commit is missing.');
 try{git('merge-base','--is-ancestor',state.sourceCommit,'HEAD');}
 catch{throw new ReleaseError('Candidate source commit is not an ancestor of the current checkout.');}
 for(const file of overlay){
  let committed;
  try{committed=execFileSync('git',['show',state.sourceCommit+':'+file.path.slice(1)],{cwd:root,stdio:['ignore','pipe','pipe']});}
  catch{throw new ReleaseError('A candidate static file is absent from its recorded source commit.');}
  check(hash('sha1',committed)===file.sha,'A static file changed after the candidate source commit.');
 }
}
function configurationFor(functions){
 const digests={},configurations={};
 const route=value=>Object.fromEntries(Object.entries({pattern:value.p,literal:value.l,expression:value.e,methods:value.m,prefer_static:value.ps}).filter(([,entry])=>entry!=null));
 for(const fn of functions){
  digests[fn.n]=fn.d;
  const config={},normalized={...fn,m:fn.m??fn.mo,rg:fn.rg??fn.rgo};
  for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))
   if(normalized[short]!=null)config[long]=normalized[short];
  if(fn.ro)config.routes=fn.ro.map(route);
  if(fn.er)config.excluded_routes=fn.er.map(route);
  configurations[fn.n]=config;
 }
 return {functions:digests,functions_config:configurations};
}

async function runRelease(api,fetch){
 const inventory=async id=>{
  const rows=[];
  for(let page=1;;page++){
   const response=await fetch(api.basePath+'/deploys/'+id+'/files?per_page=100&page='+page,{headers:api.defaultHeaders,agent:api.agent});
   check(response.ok,'Could not read the deployed static inventory (HTTP '+response.status+').');
   const batch=await response.json();check(Array.isArray(batch),'Unexpected deployed inventory response.');
   rows.push(...batch);if(batch.length<100)break;
  }
  check(new Set(rows.map(file=>file.path)).size===rows.length,'Duplicate deployed static paths.');
  return Object.fromEntries(rows.map(file=>[file.path,file.sha]));
 };
 const currentIs=async id=>{
  const site=await api.getSite({siteId});
  check(site.id===siteId&&site.published_deploy?.id===id,'Production changed concurrently; stop.');
 };
 if(mode==='capture'){
  phase='read-only baseline capture';
  const previous=read(resolve(root,'docs/arcade-polish-published.json'));
  const databaseEvidence=evidenceFrom(previous,read(resolve(root,'docs/arcade-suite-database-evidence.json')));
  check(previous.id===expectedBaselineId&&previous.files===231,'Historical release evidence does not match the expected live baseline.');
  await currentIs(expectedBaselineId);
  const live=await api.getDeploy({deployId:expectedBaselineId});
  check(live.id===expectedBaselineId&&live.site_id===siteId&&live.state==='ready'&&live.locked===true,'The expected live baseline is not ready and locked.');
  check(live.available_functions?.length===39&&live.function_schedules?.length===5,'Live backend inventory differs from 39 functions and five schedules.');
  equal(live.available_functions,previous.functionRecords,'Live full backend records differ from the previous release.');
  equal(live.function_schedules,previous.functionSchedules,'Live schedules differ from the previous release.');
  check(!live.edge_functions_present&&migrationCount(live)===0,'Unexpected edge functions or database migrations.');
  const files=await inventory(live.id);
  equal(files,previous.filesBySha1,'Live static inventory differs from the previous release.');
  await currentIs(expectedBaselineId);
  const baseline={siteId,capturedAt:new Date().toISOString(),previousSourceCommit:previous.sourceCommit,
   deploy:sanitizedDeploy(live),files:Object.entries(files).map(([path,sha])=>({path,sha})),databaseEvidence};
  if(existsSync(candidatePath)){
   check(existsSync(baselinePath),'Candidate state exists without its baseline; stop.');
   const old=read(baselinePath);
   equal(old.deploy,baseline.deploy,'Do not overwrite a candidate baseline with changed deployment metadata.');
   equal(old.files,baseline.files,'Do not overwrite a candidate baseline with changed static paths.');
   console.log(JSON.stringify({mode,id:live.id,files:231,functions:39,schedules:5,locked:true,existingCapturePreserved:true}));
   return;
  }
  save(baselinePath,baseline);
  console.log(JSON.stringify({mode,id:live.id,files:231,functions:39,schedules:5,locked:true,baselineSaved:true}));
  return;
 }

 phase='baseline preflight';
 const baseline=read(baselinePath);
 check(baseline.siteId===siteId&&baseline.deploy.id===expectedBaselineId,'Unexpected captured baseline.');
 check(baseline.deploy.available_functions?.length===39&&baseline.deploy.function_schedules?.length===5,'Captured backend inventory is incomplete.');
 const {original,files,overlay}=buildFiles(baseline);
 const originalDeploy=await api.getDeploy({deployId:expectedBaselineId});
 equal(originalDeploy.available_functions,baseline.deploy.available_functions,'Baseline backend records changed.');
 equal(originalDeploy.function_schedules,baseline.deploy.function_schedules,'Baseline schedules changed.');
 equal(await inventory(expectedBaselineId),original,'Baseline static inventory changed.');
 const proof={baselineDigest:fingerprint(baseline),filesDigest:fingerprint(files),sourceBranch};
 let state;
 if(mode==='candidate'){
  check(!requestedId,'Candidate creation does not accept an existing deploy ID. Use verify for a recorded candidate.');
  check(!existsSync(candidatePath),'A candidate already exists; use verify/publish with its recorded ID.');
  check(git('status','--porcelain')==='','Commit the reviewed source before candidate creation.');
  check(git('branch','--show-current')===sourceBranch,'Create the candidate from the reviewed arcade feature branch.');
  check(originalDeploy.locked===true,'The existing production deployment must remain locked.');
  await currentIs(expectedBaselineId);
  phase='existing isolated database binding';
  const evidence=baseline.databaseEvidence;
  check(evidence.siteId===siteId&&evidence.isolationVerified===true&&evidence.paymentsEnabled===true,'Captured runtime evidence is incomplete.');
  const {branches}=await api.listSiteDatabaseBranches({siteId});
  const branch=branches.find(value=>value.name===evidence.branch);
  check(Boolean(branch?.branch_id),'The existing isolated game database branch was not found.');
  const database=await api.getSiteDatabaseBranch({siteId,branchId:branch.branch_id,role:'netlifydb_owner'});
  let connectionString=database.connection_string||database.connectionString;
  let connection;
  try{connection=new URL(connectionString);}
  catch{throw new ReleaseError('The existing database binding is not a valid connection URL.');}
  check(connection.username==='netlifydb_owner'&&['postgres:','postgresql:'].includes(connection.protocol),'Unexpected existing database binding type.');
  const identity=hash('sha256',connection.hostname.replace(/-pooler(?=\.)/,'')+'|'+connection.pathname);
  check(identity===evidence.previewDatabaseIdentity&&!evidence.productionDatabaseIdentities.includes(identity),'The game database identity or isolation changed.');
  // The URL exists only in this call's memory. Never include it in state or logs.
  const environment=[
   {key:'TREEFORCE89_DEV_DATABASE_URL',value:connectionString,is_secret:true,scopes:['functions']},
   {key:'TREEFORCE89_PAID_CONTINUES_ENABLED',value:'true',is_secret:false,scopes:['functions']},
  ];
  const sourceCommit=git('rev-parse','HEAD');
  phase='create unpublished candidate';
  await currentIs(expectedBaselineId);
  const stillLocked=await api.getDeploy({deployId:expectedBaselineId});
  check(stillLocked.locked===true,'Production publication lock changed; stop.');
  let created;
  try{
   created=await api.createSiteDeploy({siteId,title:'TREE FORCE 89: LIVE arcade badge and play link',body:{
    files,...configurationFor(originalDeploy.available_functions),function_schedules:originalDeploy.function_schedules,
    draft:false,async:false,branch:originalDeploy.branch,commit_ref:sourceCommit,environment,
   }});
  }finally{environment[0].value='';connectionString='';connection=null;}
  check(/^[a-f0-9]{24}$/.test(created.id||''),'Candidate creation did not return a deploy ID.');
  state={id:created.id,siteId,baseline:expectedBaselineId,sourceCommit,sourceBranch,
   createdAt:created.created_at||new Date().toISOString(),...proof,overlay:overlay.map(({path,sha,size})=>({path,sha,size}))};
  // Save the ID before inspecting uploads so a failed attempt remains inspectable.
  save(candidatePath,state);
  console.log(JSON.stringify({candidateId:state.id,sourceCommit,baseline:expectedBaselineId,candidateRecorded:true}));
  check(created.id!==expectedBaselineId&&!created.published_at,'Candidate was unexpectedly published; stop and inspect its lock.');
  check((created.required_functions?.length||0)===0,'Refuse any function upload or replacement.');
  check((created.required_edge_functions?.length||0)===0,'Refuse any edge-function upload.');
  await currentIs(expectedBaselineId);
  phase='upload explicit arcade static files';
  for(const digest of created.required||[]){
   const file=overlay.find(value=>value.sha===digest);
   check(Boolean(file),'Refuse an unrelated static-file upload.');
   await api.uploadDeployFile({deployId:state.id,path:encodeURI(file.path.slice(1)),body:()=>createReadStream(file.source)});
  }
 }else{
  state=read(candidatePath);
  check(requestedId===state.id,'Pass the exact recorded candidate deploy ID.');
 }
 check(state.id!==expectedBaselineId&&state.siteId===siteId&&state.baseline===expectedBaselineId,'Unexpected candidate identity.');
 check(/^[a-f0-9]{24}$/.test(state.id||''),'Invalid recorded candidate ID.');
 equal({baselineDigest:state.baselineDigest,filesDigest:state.filesDigest,sourceBranch:state.sourceBranch},proof,'Candidate baseline, file inventory, or branch changed.');
 equal(state.overlay,overlay.map(({path,sha,size})=>({path,sha,size})),'Candidate overlay differs from the reviewed files.');
 sourceIsPinned(state,overlay);

 const verifyCandidate=async()=>{
  let candidate;
  for(let attempt=0;attempt<45;attempt++){
   candidate=await api.getDeploy({deployId:state.id});
   if(candidate.state==='ready')break;
   check(!['error','canceled'].includes(candidate.state),'Candidate deployment failed; inspect its Netlify log.');
   await new Promise(done=>setTimeout(done,1000));
  }
  check(candidate.state==='ready'&&candidate.site_id===siteId,'Candidate is not ready on the expected site.');
  equal(await inventory(state.id),files,'Candidate static inventory differs from the exact arcade overlay.');
  equal(candidate.available_functions,baseline.deploy.available_functions,'Candidate backend package/provider/runtime/configuration records changed.');
  equal(candidate.function_schedules,baseline.deploy.function_schedules,'Candidate scheduled jobs changed.');
  equal(candidate.functions_region,baseline.deploy.functions_region,'Candidate function region changed.');
  equal(candidate.functions_region_overrides,baseline.deploy.functions_region_overrides,'Candidate function region overrides changed.');
  check(Boolean(candidate.edge_functions_present)===Boolean(baseline.deploy.edge_functions_present),'Candidate edge-function presence changed.');
  check(migrationCount(candidate)===0,'Refuse a candidate with database migrations.');
  check(candidate.branch===baseline.deploy.branch,'Candidate runtime branch context changed.');
  equal(candidate.context,baseline.deploy.context,'Candidate deployment context changed.');
  return candidate;
 };
 phase='candidate verification';
 let candidate=await verifyCandidate();
 const verification={id:state.id,siteId,baseline:expectedBaselineId,sourceCommit:state.sourceCommit,...proof,
  verifiedAt:new Date().toISOString(),files:231,functionsPreserved:39,schedulesPreserved:5,unpublished:!candidate.published_at};
 if(mode==='publish'){
  phase='verified forward-publication preflight';
  const priorVerification=read(verificationPath);
  for(const key of ['id','siteId','baseline','sourceCommit','baselineDigest','filesDigest','sourceBranch'])
   equal(priorVerification[key],verification[key],'The exact candidate and source require a successful prior verification.');
  check(priorVerification.unpublished===true&&!candidate.published_at,'Forward publication requires this new, never-published candidate.');
  await currentIs(expectedBaselineId);
  check((await api.getDeploy({deployId:expectedBaselineId})).locked===true,'Production publication lock changed; stop.');
  phase='forward publication and immediate lock';
  // Despite the API's historical name, the only accepted target is the newly
  // created, never-published and fully verified candidate recorded above.
  try{await api.restoreSiteDeploy({siteId,deployId:state.id});}
  catch{
   // A lost response can follow successful publication. Do not publish again;
   // inspect the current identity and finish locking only our exact candidate.
   const current=await api.getSite({siteId});
   check(current.published_deploy?.id===state.id,'Forward publication failed or its result is uncertain; inspect the recorded candidate.');
  }
  await api.lockDeploy({deployId:state.id});
  await currentIs(state.id);
  candidate=await verifyCandidate();
  check(candidate.locked===true,'Published candidate is not locked.');
 }else if(mode==='published'){
  phase='published release verification';
  await currentIs(state.id);
  check(candidate.locked===true,'Published candidate must be locked before recording success.');
 }else{
  await currentIs(expectedBaselineId);
  check((await api.getDeploy({deployId:expectedBaselineId})).locked===true,'Existing production lock changed during verification.');
  check(!candidate.published_at,'Expected an unpublished review candidate.');
 }

 save(verificationPath,{...verification,verifiedAt:new Date().toISOString(),unpublished:!candidate.published_at});
 const summary={id:state.id,baseline:expectedBaselineId,mode,sourceCommit:state.sourceCommit,
  sourceBranch:state.sourceBranch,files:231,preservedStaticFiles:229,changedExistingPaths:existingPaths,newPaths,
  functionsPreserved:39,schedulesPreserved:5,backendUnchanged:true,noMigrations:true,paymentsEnabled:true,
  isolatedDatabaseIdentity:baseline.databaseEvidence.previewDatabaseIdentity,
  publishedAt:candidate.published_at||null,url:'https://tree-token.xyz/play/',
  candidateUrl:'https://'+state.id+'--tree-token.netlify.app/play/',locked:mode==='publish'||mode==='published'?candidate.locked:false};
 if(mode==='publish'||mode==='published'){
  check(Boolean(candidate.published_at),'Publication timestamp is missing; do not record production success.');
  await currentIs(state.id);
  save(publishedPath,{...summary,filesBySha1:files,functionRecords:candidate.available_functions,functionSchedules:candidate.function_schedules});
 }
 console.log(JSON.stringify(summary,null,2));
}

let program;
try{
 check(['capture','candidate','verify','publish','published'].includes(mode)&&Boolean(cliDirectory),'Usage: release-treeforce-live-badge.mjs capture|candidate|verify|publish|published CLI_DIRECTORY [CANDIDATE_ID]');
 check(!process.env.DEBUG,'Run this credential-bearing release with DEBUG unset.');
 const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
 const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
 const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
 program=createMainCommand();
 program.command('treeforce-live-badge-release').action(async(options,command)=>{
  try{await runRelease(command.netlify.api,fetch);}
  catch(error){
   const status=Number.isInteger(error?.status)?' (HTTP '+error.status+')':'';
   console.error('Arcade release stopped during '+phase+': '+(error instanceof ReleaseError?error.message:'Request or local operation failed'+status+'. Raw error details were withheld to protect credentials.'));
   process.exitCode=1;
  }
 });
 await runProgram(program,['node','netlify','treeforce-live-badge-release']);
}catch(error){
 console.error('Arcade release stopped during '+phase+': '+(error instanceof ReleaseError?error.message:'CLI initialization failed. Raw error details were withheld.'));
 process.exitCode=1;
}finally{if(program)await program.onEnd();}
