// Bounded TREE FORCE participation release: replace only arcade-growth.
// Every baseline static path, the other 39 full function records, all five
// schedules, and the existing runtime environment remain preserved. New static
// paths are restricted to reviewed hashed native assets. Credentials stay in memory.
// Usage: node scripts/release-treeforce-participation.mjs capture|candidate|verify|publish|published CLI_DIRECTORY [CANDIDATE_ID]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync,createReadStream} from 'node:fs';

const root=resolve(import.meta.dirname,'..');
const [mode,cliDirectory,requestedId]=process.argv.slice(2);
export const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
export const expectedBaselineId='6ae65d956e30582ff6f5baa2';
const expectedDatabaseBranch='feature/treeforce89-play-integration';
const expectedDatabaseIdentity='df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065';
const sourceBranch='feature/treeforce-participation-20261031';
export const existingPaths=['/play/index.html','/play/treeforce89/index.html','/scripts/arcade-daily-growth.js','/styles/tree-arcade-suite.css'];
const lobbyPaths=existingPaths.filter(path=>path!=='/play/treeforce89/index.html');
const frontendManifestRelative='docs/treeforce-participation-frontend.json';
const expectedBaselineFiles=237;
const stateDirectory=resolve(root,'.netlify');
const baselinePath=resolve(stateDirectory,'treeforce-participation-baseline.json');
const candidatePath=resolve(stateDirectory,'treeforce-participation-candidate.json');
const verificationPath=resolve(stateDirectory,'treeforce-participation-verification.json');
const publishedPath=resolve(root,'docs/treeforce-participation-published.json');
const functionManifestPath=resolve(stateDirectory,'treeforce-participation-functions/manifest.json');
const replacementFunctionName='arcade-growth';
const replacementFunctionRoute='/api/arcade-growth';
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
 const result=Object.fromEntries([
  'id','site_id','state','locked','branch','context','created_at','published_at',
  'available_functions','function_schedules','functions_region',
  'functions_region_overrides','edge_functions_present','database_migrations',
 ].filter(key=>deploy[key]!==undefined).map(key=>[key,deploy[key]]));
 return result;
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
const readSource=path=>readFileSync(resolve(root,path));
const nativeAssetPattern=/^\/play\/treeforce89\/assets\/(?:index|arcade|graphql)-[a-z0-9_-]+\.(?:js|css)$/;
function safeSourcePath(path){
 return typeof path==='string'&&/^[a-zA-Z0-9._/-]+$/.test(path)&&
  !path.startsWith('/')&&path.split('/').every(segment=>segment&&segment!=='.'&&segment!=='..');
}
function originalInventory(baseline){
 check(Array.isArray(baseline.files)&&baseline.files.length===expectedBaselineFiles,'Captured static inventory must contain all 237 baseline paths.');
 check(new Set(baseline.files.map(file=>file.path)).size===expectedBaselineFiles,'Captured static paths are duplicated.');
 for(const file of baseline.files)
  check(typeof file.path==='string'&&file.path.startsWith('/')&&file.path===file.path.toLowerCase()&&/^[a-f0-9]{40}$/.test(file.sha||''),'Captured static path or digest is invalid.');
 return Object.fromEntries(baseline.files.map(file=>[file.path,file.sha]));
}
export function validateStaticInventory(original,files,newPaths){
 check(Object.keys(original).length===expectedBaselineFiles,'The static baseline must contain 237 paths.');
 check(Array.isArray(newPaths)&&new Set(newPaths).size===newPaths.length&&newPaths.length>0&&
  newPaths.every(path=>nativeAssetPattern.test(path)&&!Object.hasOwn(original,path)),'New paths must be unique reviewed native hashed assets.');
 check(Object.keys(original).every(path=>Object.hasOwn(files,path)),'Every existing public path must remain present.');
 const changedExistingPaths=Object.keys(original).filter(path=>files[path]!==original[path]).sort();
 check(changedExistingPaths.every(path=>existingPaths.includes(path)),'An existing public file outside the approved arcade scope changed.');
 equal(Object.keys(files).filter(path=>!Object.hasOwn(original,path)).sort(),[...newPaths].sort(),'Only reviewed native hashed assets may be added as public paths.');
 check(Object.keys(files).length===expectedBaselineFiles+newPaths.length,'Candidate static inventory size differs from the reviewed scope.');
 for(const [path,digest] of Object.entries(files))
  check(path===path.toLowerCase()&&/^[a-f0-9]{40}$/.test(digest||''),'Candidate public path or SHA1 digest is invalid.');
 return changedExistingPaths;
}
export function buildFiles(baseline,{readSource:readInput=readSource}={}){
 const original=originalInventory(baseline);
 const manifestBytes=readInput(frontendManifestRelative);
 const manifest=JSON.parse(manifestBytes.toString('utf8'));
 equal(Object.keys(manifest).sort(),['version','baselineDeploy','originalSource','integrationSource','baselineNativeFiles','sourceFiles','publicFiles','build'].sort(),'Unexpected frontend manifest fields.');
 check(manifest.version===1&&manifest.baselineDeploy===expectedBaselineId,'Native frontend evidence does not match the current baseline.');
 equal(manifest.originalSource,{repository:'TheCryptoArborist/treeforce89',commit:'a38e08e37e1f71ea41b86add8e26a92b0789cf22'},'Native game source differs from its reviewed original pin.');
 equal(manifest.integrationSource,{repository:'TheCryptoArborist/tree-token.xyz',commit:'4cd2119a3fefc3b6078befd01ad4f63fb74a695a'},'Native integration differs from its reviewed original pin.');
 check(manifest.build?.baselineExact===true&&manifest.build?.baselineFilesMatched===13&&manifest.build?.paymentModulesUnchanged===true&&
  /^[a-f0-9]{64}$/.test(manifest.build.packageLockSha256||'')&&/^\d+\.\d+\.\d+$/.test(manifest.build.nodeVersion||''),'Exact native reproduction and unchanged payment-input evidence are required.');
 check(Array.isArray(manifest.baselineNativeFiles)&&manifest.baselineNativeFiles.length===13&&
  new Set(manifest.baselineNativeFiles.map(file=>file.path)).size===13,'Native baseline evidence must contain 13 unique paths.');
 for(const file of manifest.baselineNativeFiles)
  check(file.path?.startsWith('/play/treeforce89/')&&file.path===file.path.toLowerCase()&&original[file.path]===file.sha1&&
   Number.isSafeInteger(file.size)&&file.size>0,'Native reproduction does not match the published baseline.');
 check(Array.isArray(manifest.sourceFiles)&&manifest.sourceFiles.length>0,'Native frontend source evidence is missing.');
 const sources=new Set();
 for(const file of manifest.sourceFiles){
  check(safeSourcePath(file.path)&&/^(?:vendor\/treeforce-participation\/|treeforce89\/frontend\/|scripts\/build-treeforce-participation\.mjs$)/.test(file.path),
   'Native source evidence is outside the reviewed integration.');
  check(!sources.has(file.path)&&/^[a-f0-9]{64}$/.test(file.sha256||''),'Native source identities are duplicated or invalid.');
  sources.add(file.path);
  check(hash('sha256',readInput(file.path))===file.sha256,'A native frontend input changed after the reviewed build.');
 }
 for(const path of ['vendor/treeforce-participation/baseline.json','vendor/treeforce-participation/integration/provenance.json',
  'vendor/treeforce-participation/apply-participation.mjs','scripts/build-treeforce-participation.mjs',
  'treeforce89/frontend/CanopyGame.tsx','treeforce89/frontend/NFTreeGateway.tsx','treeforce89/frontend/participation-client.mjs','treeforce89/frontend/participation.css'])
  check(sources.has(path),'A required native frontend or build input is missing from source evidence.');
 check(Array.isArray(manifest.publicFiles)&&manifest.publicFiles.length>1,'The reviewed native entry and new hashed assets are missing.');
 const nativePaths=new Set();
 const nativeOverlay=manifest.publicFiles.map(file=>{
  check(file.path==='/play/treeforce89/index.html'||nativeAssetPattern.test(file.path),'Native public output is outside the reviewed game entry and hashed assets.');
  check(safeSourcePath(file.source)&&('/'+file.source).toLowerCase()===file.path,'A native output has an unsafe or mismatched source path.');
  check(!nativePaths.has(file.path)&&/^[a-f0-9]{40}$/.test(file.sha1||'')&&Number.isSafeInteger(file.size)&&file.size>0,'Native public output identities are duplicated or invalid.');
  nativePaths.add(file.path);
  check(file.path==='/play/treeforce89/index.html'||!Object.hasOwn(original,file.path),'Previously published native hashes must remain unchanged.');
  const bytes=readInput(file.source);
  check(hash('sha1',bytes)===file.sha1&&bytes.length===file.size,'A native frontend artifact changed after its reviewed build.');
  check(original[file.path]!==file.sha1,'The native overlay must contain only changed or new artifacts.');
  return {path:file.path,source:file.source,sha:file.sha1,size:file.size};
 });
 check(nativePaths.has('/play/treeforce89/index.html'),'The reviewed native entry HTML is missing.');
 const overlay=[...lobbyPaths.map(path=>{
  const source=path.slice(1),bytes=readInput(source);
  return {path,source,sha:hash('sha1',bytes),size:bytes.length};
 }),...nativeOverlay].sort((a,b)=>a.path.localeCompare(b.path));
 const files={...original};
 for(const file of overlay)files[file.path]=file.sha;
 const newPaths=nativeOverlay.filter(file=>!Object.hasOwn(original,file.path)).map(file=>file.path).sort();
 const changedExistingPaths=validateStaticInventory(original,files,newPaths);
 const frontendPackage={...manifest,manifestDigest:hash('sha256',manifestBytes)};
 return {original,files,overlay,newPaths,changedExistingPaths,frontendPackage};
}
export function sourceIsPinned(state,overlay,functionPackage,frontendPackage,{readCommitted,assertAncestor}={}){
 check(/^[a-f0-9]{40}$/.test(state.sourceCommit||''),'Candidate source commit is missing.');
 try{if(assertAncestor)assertAncestor(state.sourceCommit);else git('merge-base','--is-ancestor',state.sourceCommit,'HEAD');}
 catch{throw new ReleaseError('Candidate source commit is not an ancestor of the current checkout.');}
 // The pinned native arcade bundle is larger than Node's default 1 MiB pipe.
 const committedFile=path=>readCommitted?readCommitted(state.sourceCommit,path):
  execFileSync('git',['show',state.sourceCommit+':'+path],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
 for(const file of overlay){
  check(safeSourcePath(file.source)&&('/'+file.source).toLowerCase()===file.path,'Candidate static source path is invalid.');
  let committed;
  // Netlify lowercases public paths; Git and the source filesystem do not.
  try{committed=committedFile(file.source);}
  catch{throw new ReleaseError('A candidate static file is absent from its recorded source commit.');}
  check(hash('sha1',committed)===file.sha,'A static file changed after the candidate source commit.');
 }
 const inputs=[...functionPackage.sourceFiles,...frontendPackage.sourceFiles,
  {path:frontendManifestRelative,sha256:frontendPackage.manifestDigest}];
 for(const file of inputs){
  check(safeSourcePath(file.path),'Candidate source-input path is invalid.');
  let committed;
  try{committed=committedFile(file.path);}
  catch{throw new ReleaseError('A reviewed build input is absent from its recorded source commit.');}
  check(hash('sha256',committed)===file.sha256,'A reviewed build input differs from the candidate source commit.');
 }
}
export function configurationFor(functions){
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

export function readFunctionPackage({manifest=read(functionManifestPath),readSource:readInput=readSource}={}){
 const keys=['version','packager','name','path','sha256','runtimeVersion','invocationMode','buildData','routes','trafficRules','sourceFiles'];
 equal(Object.keys(manifest).sort(),[...keys].sort(),'Unexpected fields in the replacement-function manifest.');
 check(manifest.version===1&&manifest.name===replacementFunctionName,'Unexpected replacement-function package identity.');
 equal(manifest.packager,{name:'@netlify/zip-it-and-ship-it',version:'16.3.0'},'Use only the reviewed pinned function packager.');
 check(manifest.path==='.netlify/treeforce-participation-functions/arcade-growth.zip','The replacement-function ZIP must stay in its isolated package directory.');
 check(/^[a-f0-9]{64}$/.test(manifest.sha256||''),'The replacement-function package digest is missing.');
 const bytes=readInput(manifest.path);
 check(bytes.length>4&&bytes[0]===0x50&&bytes[1]===0x4b&&hash('sha256',bytes)===manifest.sha256,'The replacement-function ZIP differs from its recorded digest.');
 check(manifest.runtimeVersion==='nodejs22.x'&&manifest.invocationMode==='stream','The replacement function must use the reviewed Node 22 streaming runtime.');
 check(manifest.buildData?.runtimeAPIVersion===2&&/^\d+\.\d+\.\d+$/.test(manifest.buildData.bootstrapVersion||''),'Replacement-function build metadata is incomplete.');
 equal(Object.keys(manifest.buildData).sort(),['bootstrapVersion','runtimeAPIVersion'],'Unexpected replacement-function build metadata.');
 equal(manifest.routes,[{pattern:replacementFunctionRoute,literal:replacementFunctionRoute,methods:['GET','POST']}],'The replacement function may route only GET/POST /api/arcade-growth.');
 // zip-it-and-ship-it emits camelCase rate-limit data. The deployment API and
 // its full function records use snake_case; convert only this known shape.
 equal(manifest.trafficRules,{action:{type:'rate_limit',config:{
  aggregate:{keys:[{type:'domain'},{type:'ip'}]},
  rateLimitConfig:{algorithm:'sliding_window',windowSize:60,windowLimit:60},
 }}},'The replacement function rate limiter differs from its reviewed scope.');
 const trafficRules={action:{type:'rate_limit',config:{
  aggregate:{keys:[{type:'domain'},{type:'ip'}]},
  rate_limit_config:{algorithm:'sliding_window',window_size:60,window_limit:60},
 }}};
 check(Array.isArray(manifest.sourceFiles)&&manifest.sourceFiles.length>0,'Function source-input evidence is missing.');
 const paths=new Set();
 for(const file of manifest.sourceFiles){
  check(file&&safeSourcePath(file.path)&&
   /^(?:netlify\/(?:functions|lib)\/[a-zA-Z0-9._/-]+|(?:vendor\/arcade-growth-backend\/)?package(?:-lock)?\.json)$/.test(file.path),
   'Function source input is outside the reviewed repository source.');
  check(!paths.has(file.path)&&/^[a-f0-9]{64}$/.test(file.sha256||''),'Function input identities are duplicated or invalid.');
  paths.add(file.path);
  check(hash('sha256',readInput(file.path))===file.sha256,'A function source input changed after packaging.');
 }
 check(paths.has('netlify/functions/arcade-growth.ts')&&paths.has('netlify/lib/arcade-growth-games.ts')&&
  paths.has('netlify/lib/arcade-treeforce-session.ts')&&paths.has('package.json')&&paths.has('package-lock.json')&&
  paths.has('vendor/arcade-growth-backend/package.json')&&paths.has('vendor/arcade-growth-backend/package-lock.json'),
  'The function entry, game adapters, or pinned root and isolated dependency inputs are missing.');
 return {...manifest,bytes,size:bytes.length,trafficRulesForApi:trafficRules,
  configuration:{build_data:manifest.buildData,routes:manifest.routes,traffic_rules:trafficRules},
  packageDigest:fingerprint(manifest)};
}

function baselineFunction(functions){
 check(Array.isArray(functions)&&functions.length===40&&new Set(functions.map(fn=>fn.n)).size===40,'The function baseline must contain 40 unique full records.');
 const fn=functions.find(value=>value.n===replacementFunctionName);
 check(Boolean(fn),'The existing Daily Growth function is missing from the baseline.');
 check(typeof fn.a==='string'&&/^\d{12}$/.test(fn.a),'The original function provider account must be a 12-digit AWS account string.');
 return fn;
}
export function configurationWithReplacement(functions,functionPackage){
 const original=baselineFunction(functions);
 check(original.d!==functionPackage.sha256&&!functions.some(fn=>fn.d===functionPackage.sha256),'The replacement must have a new reviewed package digest.');
 check(original.r===functionPackage.runtimeVersion&&original.im===functionPackage.invocationMode,'The replacement may not change the existing function runtime or invocation mode.');
 equal(original.tr,functionPackage.trafficRulesForApi,'The replacement may not change existing rate limiting.');
 const routes=(original.ro||[]).map(route=>({pattern:route.p,literal:route.l,methods:route.m||[],
  ...(route.e!=null?{expression:route.e}:{}),...(route.ps?{prefer_static:true}:{})}));
 equal(routes,functionPackage.routes,'The replacement may not change existing public routes or methods.');
 const configuration=configurationFor(functions);
 configuration.functions[replacementFunctionName]=functionPackage.sha256;
 configuration.functions_config[replacementFunctionName]={...configuration.functions_config[replacementFunctionName],build_data:functionPackage.buildData};
 return configuration;
}

export function verifyFunctionRecords(candidateFunctions,baselineFunctions,functionPackage){
 const original=baselineFunction(baselineFunctions);
 configurationWithReplacement(baselineFunctions,functionPackage);
 check(Array.isArray(candidateFunctions)&&candidateFunctions.length===40,'Candidate must contain the same 40 functions, with only Daily Growth replaced.');
 check(new Set(candidateFunctions.map(fn=>fn.n)).size===40,'Candidate function names are duplicated.');
 equal(candidateFunctions.filter(fn=>fn.n!==replacementFunctionName),baselineFunctions.filter(fn=>fn.n!==replacementFunctionName),
  'An unrelated full function package/provider/runtime/configuration record changed.');
 const fn=candidateFunctions.find(value=>value.n===replacementFunctionName);
 check(fn?.d===functionPackage.sha256&&fn.r==='nodejs22.x'&&fn.im==='stream','The replacement-function digest, runtime, or invocation mode differs from its reviewed package.');
 check(typeof fn.a==='string'&&/^\d{12}$/.test(fn.a),'The replacement function provider account must be a 12-digit AWS account string.');
 equal(fn.bd,functionPackage.buildData,'The replacement-function bootstrap/runtime API metadata changed.');
 const routes=(fn.ro||[]).map(route=>({pattern:route.p,literal:route.l,methods:route.m||[],
  ...(route.e!=null?{expression:route.e}:{}),...(route.ps?{prefer_static:true}:{})}));
 equal(routes,functionPackage.routes,'The replacement-function public route or methods changed.');
 equal(fn.tr,functionPackage.trafficRulesForApi,'The replacement-function rate limiting changed.');
 check((fn.m??fn.mo)===1024&&(fn.rg??fn.rgo)==='us-east-2'&&
  (fn.mo==null||fn.mo===1024)&&(fn.rgo==null||fn.rgo==='us-east-2'),
  'The replacement function unexpectedly changes the default memory, region, or their overrides.');
 check(!fn.g&&!fn.dn&&!(fn.er?.length)&&!(fn.es?.length),'The replacement function unexpectedly adds generator, excluded routes, or event subscriptions.');
 const stableRecord=record=>{
  const stable={...record,m:record.m??record.mo,rg:record.rg??record.rgo};
  // CLI 27.16.1 uses fn.a as the function-log account_id. Netlify selects this
  // provider placement; the upload API does not accept an account selection.
  // Only this replaced function may receive new provider identity/placement.
  // Its complete record (including a) is pinned after the first verification.
  for(const key of ['d','id','a','c','s','bd','oid','oblv','mo','rgo'])delete stable[key];
  return stable;
 };
 equal(stableRecord(fn),stableRecord(original),'The replaced function changed an unapproved provider, runtime, route, or configuration field.');
 return fn;
}

export function verifyPinnedReplacementRecord(record,pinnedRecord){
 if(pinnedRecord)equal(record,pinnedRecord,'The previously verified replacement-function provider/configuration record changed.');
}

export function verifyFunctionRegionOverrides(candidate,baselineDeploy,replacementRecord,pinnedOverrides){
 check(baselineDeploy.functions_region==='cmh'&&candidate.functions_region==='cmh',
  'The baseline and candidate function regions must remain cmh.');
 const before=baselineDeploy.functions_region_overrides;
 const after=candidate.functions_region_overrides;
 check(Array.isArray(before)&&before.length===39&&before.every(entry=>entry&&typeof entry.name==='string')&&
  new Set(before.map(entry=>entry.name)).size===39,'The baseline must contain the 39 unique preserved region overrides.');
 equal(before.map(entry=>entry.name).sort(),baselineDeploy.available_functions.filter(fn=>fn.n!==replacementFunctionName).map(fn=>fn.n).sort(),
  'The baseline region overrides must belong to the 39 preserved functions.');
 for(const entry of before)equal(entry,{name:entry.name,region:'cmh'},'A baseline function region override differs from cmh.');
 check(Array.isArray(after)&&after.length>=39&&after.length<=40&&after.every(entry=>entry&&typeof entry.name==='string')&&
  new Set(after.map(entry=>entry.name)).size===after.length,'Candidate region overrides are duplicated or outside the replacement scope.');
 equal(after.filter(entry=>entry.name!==replacementFunctionName),before,
  'An unrelated function region override, or its ordering, changed.');
 const replacement=after.find(entry=>entry.name===replacementFunctionName);
 if(replacement)equal(replacement,{name:replacementFunctionName,region:'cmh'},
  'The replacement may add only its equivalent cmh default-region override.');
 // Netlify's cmh and AWS us-east-2 both identify US East (Ohio). The explicit
 // replacement override is allowed only when its verified record agrees.
 check(replacementRecord?.n===replacementFunctionName&&replacementRecord.rg==='us-east-2'&&
  (replacementRecord.rgo==null||replacementRecord.rgo==='us-east-2'),
  'The replacement function record conflicts with the cmh default region.');
 if(pinnedOverrides!==undefined)equal(after,pinnedOverrides,'The previously verified function region override array changed.');
 return {functionRegion:'cmh',baselineFunctionRegionOverrides:structuredClone(before),functionRegionOverrides:structuredClone(after)};
}

export function verifyFunctionUploadDemand(requiredFunctions,functionPackage){
 check(Array.isArray(requiredFunctions)&&requiredFunctions.length<=1&&requiredFunctions.every(digest=>digest===functionPackage.sha256),
  'Refuse any unrelated function upload or replacement.');
}

export function verifyPublishedBaseline(previous,baseline,previousFiles,current,candidateId){
 check(candidateId!==expectedBaselineId&&/^[a-f0-9]{24}$/.test(candidateId||''),'Published verification requires a new candidate identity.');
 check(previous.id===expectedBaselineId&&previous.site_id===siteId&&previous.state==='ready','Previous deployment identity or ready state changed after publication.');
 equal(previous.available_functions,baseline.deploy.available_functions,'Previous deployment full function records changed after publication.');
 equal(previous.function_schedules,baseline.deploy.function_schedules,'Previous deployment schedules changed after publication.');
 equal(previous.functions_region,baseline.deploy.functions_region,'Previous deployment function region changed after publication.');
 equal(previous.functions_region_overrides,baseline.deploy.functions_region_overrides,'Previous deployment function region overrides changed after publication.');
 equal(previousFiles,originalInventory(baseline),'Previous deployment static inventory changed after publication.');
 check(previous.locked===true||previous.locked===false||previous.locked==null,'Unexpected previous-deployment lock metadata.');
 // A lock applies to the current publication. Never relock the previous deploy.
 check(current.id===siteId&&current.published_deploy?.id===candidateId&&current.published_deploy.locked===true,
  'The new candidate must be the current locked publication.');
 return previous.locked??null;
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
 const currentIs=async(id,{requireLocked=false}={})=>{
  const site=await api.getSite({siteId});
  check(site.id===siteId&&site.published_deploy?.id===id,'Production changed concurrently; stop.');
  if(requireLocked)check(site.published_deploy.locked===true,'The current published deployment is not locked in site metadata.');
 };
 if(mode==='capture'){
  phase='read-only baseline capture';
  const previous=read(resolve(root,'docs/arcade-growth-published.json'));
  const databaseEvidence=evidenceFrom(previous,read(resolve(root,'docs/arcade-suite-database-evidence.json')));
  check(previous.id===expectedBaselineId&&previous.files===expectedBaselineFiles,'Historical release evidence does not match the expected live baseline.');
  await currentIs(expectedBaselineId);
  const live=await api.getDeploy({deployId:expectedBaselineId});
  check(live.id===expectedBaselineId&&live.site_id===siteId&&live.state==='ready'&&live.locked===true,'The expected live baseline is not ready and locked.');
  check(live.available_functions?.length===40&&live.function_schedules?.length===5,'Live backend inventory differs from 40 functions and five schedules.');
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
   console.log(JSON.stringify({mode,id:live.id,files:expectedBaselineFiles,functions:40,schedules:5,locked:true,existingCapturePreserved:true}));
   return;
  }
  save(baselinePath,baseline);
  console.log(JSON.stringify({mode,id:live.id,files:expectedBaselineFiles,functions:40,schedules:5,locked:true,baselineSaved:true}));
  return;
 }

 phase='baseline preflight';
 const baseline=read(baselinePath);
 check(baseline.siteId===siteId&&baseline.deploy.id===expectedBaselineId,'Unexpected captured baseline.');
 check(baseline.deploy.available_functions?.length===40&&baseline.deploy.function_schedules?.length===5,'Captured backend inventory is incomplete.');
 const {original,files,overlay,newPaths,changedExistingPaths,frontendPackage}=buildFiles(baseline);
 const functionPackage=readFunctionPackage();
 const originalDeploy=await api.getDeploy({deployId:expectedBaselineId});
 check(originalDeploy.id===expectedBaselineId&&originalDeploy.site_id===siteId&&originalDeploy.state==='ready','The captured baseline deployment identity or ready state changed.');
 equal(originalDeploy.available_functions,baseline.deploy.available_functions,'Baseline backend records changed.');
 equal(originalDeploy.function_schedules,baseline.deploy.function_schedules,'Baseline schedules changed.');
 equal(originalDeploy.functions_region,baseline.deploy.functions_region,'Baseline function region changed.');
 equal(originalDeploy.functions_region_overrides,baseline.deploy.functions_region_overrides,'Baseline function region overrides changed.');
 equal(await inventory(expectedBaselineId),original,'Baseline static inventory changed.');
 const proof={baselineDigest:fingerprint(baseline),filesDigest:fingerprint(files),functionPackageDigest:functionPackage.packageDigest,
  frontendManifestDigest:frontendPackage.manifestDigest,sourceBranch};
 let state;
 if(mode==='candidate'){
  check(!requestedId,'Candidate creation does not accept an existing deploy ID. Use verify for a recorded candidate.');
  check(!existsSync(candidatePath),'A candidate already exists; use verify/publish with its recorded ID.');
  check(git('status','--porcelain')==='','Commit the reviewed source before candidate creation.');
  check(git('branch','--show-current')===sourceBranch,'Create the candidate from the reviewed arcade feature branch.');
  check(originalDeploy.locked===true,'The existing production deployment must remain locked.');
  await currentIs(expectedBaselineId,{requireLocked:true});
  phase='existing isolated database binding';
  const evidence=baseline.databaseEvidence;
  check(evidence.siteId===siteId&&evidence.isolationVerified===true&&evidence.paymentsEnabled===true&&
   evidence.branch===expectedDatabaseBranch&&evidence.previewDatabaseIdentity===expectedDatabaseIdentity&&
   Array.isArray(evidence.productionDatabaseIdentities),'Captured runtime evidence is incomplete.');
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
  sourceIsPinned({sourceCommit},overlay,functionPackage,frontendPackage);
  phase='create unpublished candidate';
  await currentIs(expectedBaselineId);
  const stillLocked=await api.getDeploy({deployId:expectedBaselineId});
  check(stillLocked.locked===true,'Production publication lock changed; stop.');
  let created;
  try{
   created=await api.createSiteDeploy({siteId,title:'TREE Arcade: authenticated TREE FORCE first-wave participation',body:{
    files,...configurationWithReplacement(originalDeploy.available_functions,functionPackage),function_schedules:originalDeploy.function_schedules,
    draft:false,async:false,branch:originalDeploy.branch,commit_ref:sourceCommit,environment,
   }});
  }finally{environment[0].value='';connectionString='';connection=null;}
  check(/^[a-f0-9]{24}$/.test(created.id||''),'Candidate creation did not return a deploy ID.');
  state={id:created.id,siteId,baseline:expectedBaselineId,sourceCommit,sourceBranch,
   createdAt:created.created_at||new Date().toISOString(),...proof,overlay:overlay.map(({path,source,sha,size})=>({path,source,sha,size}))};
  // Save the ID before inspecting uploads so a failed attempt remains inspectable.
  save(candidatePath,state);
  console.log(JSON.stringify({candidateId:state.id,sourceCommit,baseline:expectedBaselineId,candidateRecorded:true}));
  check(created.id!==expectedBaselineId&&!created.published_at,'Candidate was unexpectedly published; stop and inspect its lock.');
  verifyFunctionUploadDemand(created.required_functions||[],functionPackage);
  check((created.required_edge_functions?.length||0)===0,'Refuse any edge-function upload.');
  await currentIs(expectedBaselineId);
  phase='upload the one reviewed Daily Growth function';
  for(const digest of created.required_functions||[]){
   check(digest===functionPackage.sha256,'Only the reviewed replacement-function digest may be uploaded.');
   const response=await fetch(api.basePath+'/deploys/'+state.id+'/functions/'+replacementFunctionName+
    '?runtime='+functionPackage.runtimeVersion+'&invocation_mode='+functionPackage.invocationMode,{
     method:'PUT',headers:{...api.defaultHeaders,'Content-Type':'application/octet-stream'},
     agent:api.agent,body:functionPackage.bytes,
    });
   check(response.ok,'Could not upload the reviewed replacement function (HTTP '+response.status+').');
  }
  phase='upload explicit arcade static files';
  for(const digest of created.required||[]){
   const file=overlay.find(value=>value.sha===digest);
   check(Boolean(file),'Refuse an unrelated static-file upload.');
   await api.uploadDeployFile({deployId:state.id,path:encodeURI(file.path.slice(1)),body:()=>createReadStream(resolve(root,file.source))});
  }
 }else{
  state=read(candidatePath);
  check(requestedId===state.id,'Pass the exact recorded candidate deploy ID.');
 }
 check(state.id!==expectedBaselineId&&state.siteId===siteId&&state.baseline===expectedBaselineId,'Unexpected candidate identity.');
 check(/^[a-f0-9]{24}$/.test(state.id||''),'Invalid recorded candidate ID.');
 equal({baselineDigest:state.baselineDigest,filesDigest:state.filesDigest,functionPackageDigest:state.functionPackageDigest,
  frontendManifestDigest:state.frontendManifestDigest,sourceBranch:state.sourceBranch},proof,
  'Candidate baseline, public files, native build, function package, or branch changed.');
 equal(state.overlay,overlay.map(({path,source,sha,size})=>({path,source,sha,size})),'Candidate overlay differs from the reviewed files.');
 sourceIsPinned(state,overlay,functionPackage,frontendPackage);

 let regionEvidence;
 const verifyCandidate=async()=>{
  let candidate;
  for(let attempt=0;attempt<45;attempt++){
   candidate=await api.getDeploy({deployId:state.id});
   if(candidate.state==='ready')break;
   check(!['error','canceled'].includes(candidate.state),'Candidate deployment failed; inspect its Netlify log.');
   await new Promise(done=>setTimeout(done,1000));
  }
  check(candidate.id===state.id&&candidate.state==='ready'&&candidate.site_id===siteId,'Candidate is not ready on the expected site.');
  equal(await inventory(state.id),files,'Candidate static inventory differs from the exact arcade overlay.');
  const replacementFunctionRecord=verifyFunctionRecords(candidate.available_functions,baseline.deploy.available_functions,functionPackage);
  verifyPinnedReplacementRecord(replacementFunctionRecord,state.replacementFunctionRecord);
  equal(candidate.function_schedules,baseline.deploy.function_schedules,'Candidate scheduled jobs changed.');
  regionEvidence=verifyFunctionRegionOverrides(candidate,baseline.deploy,replacementFunctionRecord,state.functionRegionOverrides);
  check(Boolean(candidate.edge_functions_present)===Boolean(baseline.deploy.edge_functions_present),'Candidate edge-function presence changed.');
  check(migrationCount(candidate)===0,'Refuse a candidate with database migrations.');
  check(candidate.branch===baseline.deploy.branch,'Candidate runtime branch context changed.');
  equal(candidate.context,baseline.deploy.context,'Candidate deployment context changed.');
  return candidate;
 };
 phase='candidate verification';
 let candidate=await verifyCandidate();
 if(!state.replacementFunctionRecord||state.functionRegionOverrides===undefined){
  if(!state.replacementFunctionRecord)state.replacementFunctionRecord=candidate.available_functions.find(fn=>fn.n===replacementFunctionName);
  if(state.functionRegionOverrides===undefined)state.functionRegionOverrides=regionEvidence.functionRegionOverrides;
  save(candidatePath,state);
 }
 const verification={id:state.id,siteId,baseline:expectedBaselineId,sourceCommit:state.sourceCommit,...proof,
  verifiedAt:new Date().toISOString(),files:Object.keys(files).length,functions:40,functionsPreserved:39,functionsReplaced:[replacementFunctionName],
  replacementFunctionRecord:state.replacementFunctionRecord,...regionEvidence,schedulesPreserved:5,unpublished:!candidate.published_at};
 let previousDeployLocked;
 const verifyPreviousAfterPublication=async()=>{
  const previous=await api.getDeploy({deployId:expectedBaselineId});
  const previousFiles=await inventory(expectedBaselineId);
  const current=await api.getSite({siteId});
  previousDeployLocked=verifyPublishedBaseline(previous,baseline,previousFiles,current,state.id);
 };
 if(mode==='publish'){
  phase='verified forward-publication preflight';
  const priorVerification=read(verificationPath);
  for(const key of ['id','siteId','baseline','sourceCommit','baselineDigest','filesDigest','functionPackageDigest','frontendManifestDigest','sourceBranch',
   'replacementFunctionRecord','functionRegion','baselineFunctionRegionOverrides','functionRegionOverrides'])
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
  await currentIs(state.id,{requireLocked:true});
  candidate=await verifyCandidate();
  check(candidate.locked===true,'Published candidate is not locked.');
  await verifyPreviousAfterPublication();
 }else if(mode==='published'){
  phase='published release verification';
  await currentIs(state.id,{requireLocked:true});
  check(candidate.locked===true,'Published candidate must be locked before recording success.');
  await verifyPreviousAfterPublication();
 }else{
  await currentIs(expectedBaselineId);
  check((await api.getDeploy({deployId:expectedBaselineId})).locked===true,'Existing production lock changed during verification.');
  check(!candidate.published_at,'Expected an unpublished review candidate.');
 }

 save(verificationPath,{...verification,verifiedAt:new Date().toISOString(),unpublished:!candidate.published_at});
 const summary={id:state.id,baseline:expectedBaselineId,mode,sourceCommit:state.sourceCommit,
  sourceBranch:state.sourceBranch,files:Object.keys(files).length,preservedStaticFiles:Object.keys(original).length-changedExistingPaths.length,
  changedExistingPaths,newPaths,frontendManifestDigest:frontendPackage.manifestDigest,
  functions:40,functionsPreserved:39,functionsReplaced:[replacementFunctionName],replacementFunctionSha256:functionPackage.sha256,
  ...regionEvidence,schedulesPreserved:5,unrelatedBackendUnchanged:true,noNetlifyMigrations:true,paymentsEnabled:true,
  isolatedDatabaseIdentity:baseline.databaseEvidence.previewDatabaseIdentity,
  ...(mode==='publish'||mode==='published'?{previousDeployLocked,publicationLockScope:'current-published-deploy',
   previousDeployLockNote:'Netlify pins auto publishing to the current published deploy. Locking a previous deploy would publish it again; its observed lock value is recorded rather than restored.'}:{}),
  publishedAt:candidate.published_at||null,url:'https://tree-token.xyz/play/',
  candidateUrl:'https://'+state.id+'--tree-token.netlify.app/play/',locked:mode==='publish'||mode==='published'?candidate.locked:false};
 if(mode==='publish'||mode==='published'){
  check(Boolean(candidate.published_at),'Publication timestamp is missing; do not record production success.');
  await currentIs(state.id,{requireLocked:true});
  save(publishedPath,{...summary,filesBySha1:files,functionRecords:candidate.available_functions,functionSchedules:candidate.function_schedules});
 }
 console.log(JSON.stringify(summary,null,2));
}

async function main(){
let program;
try{
 check(['capture','candidate','verify','publish','published'].includes(mode)&&Boolean(cliDirectory),'Usage: release-treeforce-participation.mjs capture|candidate|verify|publish|published CLI_DIRECTORY [CANDIDATE_ID]');
 check(!process.env.DEBUG,'Run this credential-bearing release with DEBUG unset.');
 const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
 const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
 const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
 program=createMainCommand();
 program.command('treeforce-participation-release').action(async(options,command)=>{
  try{await runRelease(command.netlify.api,fetch);}
  catch(error){
   const status=Number.isInteger(error?.status)?' (HTTP '+error.status+')':'';
   console.error('TREE FORCE participation release stopped during '+phase+': '+(error instanceof ReleaseError?error.message:'Request or local operation failed'+status+'. Raw error details were withheld to protect credentials.'));
   process.exitCode=1;
  }
 });
 await runProgram(program,['node','netlify','treeforce-participation-release']);
}catch(error){
 console.error('TREE FORCE participation release stopped during '+phase+': '+(error instanceof ReleaseError?error.message:'CLI initialization failed. Raw error details were withheld.'));
 process.exitCode=1;
}finally{if(program)await program.onEnd();}

}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
