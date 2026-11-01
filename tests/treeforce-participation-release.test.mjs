import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 buildFiles,configurationFor,configurationWithReplacement,expectedBaselineId,existingPaths,
 readFunctionPackage,siteId,sourceIsPinned,validateStaticInventory,verifyFunctionRecords,
 verifyFunctionUploadDemand,verifyPinnedReplacementRecord,verifyFunctionRegionOverrides,verifyPublishedBaseline,
} from '../scripts/release-treeforce-participation.mjs';

// Use the complete immutable published inventory, with in-memory review inputs.
// Importing the release module must not initialize a CLI or call any remote API.
const published=JSON.parse(readFileSync(new URL('../docs/arcade-growth-published.json',import.meta.url)));
const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const baseline={siteId,deploy:{id:expectedBaselineId,site_id:siteId,state:'ready',locked:true,
 available_functions:published.functionRecords,function_schedules:published.functionSchedules,functions_region:'cmh',
 functions_region_overrides:published.functionRecords.filter(fn=>fn.n!=='arcade-growth').map(fn=>({name:fn.n,region:'cmh'}))},
 files:Object.entries(published.filesBySha1).map(([path,sha])=>({path,sha}))};
const sourceCommit='a'.repeat(40),candidateId='b'.repeat(24);
const clone=value=>structuredClone(value);
const original=published.functionRecords.find(fn=>fn.n==='arcade-growth');
const requiredFrontendSources=[
 'vendor/treeforce-participation/baseline.json',
 'vendor/treeforce-participation/integration/provenance.json',
 'vendor/treeforce-participation/apply-participation.mjs',
 'scripts/build-treeforce-participation.mjs',
 'treeforce89/frontend/CanopyGame.tsx','treeforce89/frontend/NFTreeGateway.tsx',
 'treeforce89/frontend/participation-client.mjs','treeforce89/frontend/participation.css',
];
function fixture(){
 const inputs=new Map();
 const put=(path,content='review input: '+path)=>{const bytes=Buffer.from(content);inputs.set(path,bytes);return bytes;};
 const sources=requiredFrontendSources.map(path=>({path,sha256:hash('sha256',put(path))}));
 const nativeSources=['play/treeforce89/index.html','play/treeforce89/assets/arcade-AbCd1234.js',
  'play/treeforce89/assets/graphql-XyZ_9876.js','play/treeforce89/assets/index-MiXeD321.css',
  'play/treeforce89/assets/index-QwErTy98.js'];
 const publicFiles=nativeSources.map(source=>{
  const bytes=put(source);return {path:('/'+source).toLowerCase(),source,sha1:hash('sha1',bytes),size:bytes.length};
 });
 for(const path of existingPaths.filter(path=>path!=='/play/treeforce89/index.html'))put(path.slice(1));
 const manifest={version:1,baselineDeploy:expectedBaselineId,
  originalSource:{repository:'TheCryptoArborist/treeforce89',commit:'a38e08e37e1f71ea41b86add8e26a92b0789cf22'},
  integrationSource:{repository:'TheCryptoArborist/tree-token.xyz',commit:'4cd2119a3fefc3b6078befd01ad4f63fb74a695a'},
  baselineNativeFiles:baseline.files.filter(file=>file.path.startsWith('/play/treeforce89/')).slice(0,13)
   .map(file=>({path:file.path,sha1:file.sha,size:1})),
  sourceFiles:sources,publicFiles,
  build:{baselineExact:true,baselineFilesMatched:13,packageLockSha256:'c'.repeat(64),nodeVersion:'22.16.0',paymentModulesUnchanged:true}};
 const functionPaths=['netlify/functions/arcade-growth.ts','netlify/lib/arcade-growth-games.ts',
  'netlify/lib/arcade-treeforce-session.ts','package.json','package-lock.json',
  'vendor/arcade-growth-backend/package.json','vendor/arcade-growth-backend/package-lock.json'];
 const zipPath='.netlify/treeforce-participation-functions/arcade-growth.zip';
 const zip=put(zipPath,'PK\x03\x04unit test package identity');
 const functionManifest={version:1,packager:{name:'@netlify/zip-it-and-ship-it',version:'16.3.0'},
  name:'arcade-growth',path:zipPath,sha256:hash('sha256',zip),runtimeVersion:'nodejs22.x',invocationMode:'stream',
  buildData:clone(original.bd),routes:[{pattern:'/api/arcade-growth',literal:'/api/arcade-growth',methods:['GET','POST']}],
  trafficRules:{action:{type:'rate_limit',config:{aggregate:{keys:[{type:'domain'},{type:'ip'}]},
   rateLimitConfig:{algorithm:'sliding_window',windowSize:60,windowLimit:60}}}},
  sourceFiles:functionPaths.map(path=>({path,sha256:hash('sha256',put(path))}))};
 const readSource=path=>{
  if(path==='docs/treeforce-participation-frontend.json')return Buffer.from(JSON.stringify(manifest));
  assert(inputs.has(path),'Unexpected source read: '+path);return inputs.get(path);
 };
 const functionPackage=readFunctionPackage({manifest:functionManifest,readSource});
 return {manifest,inputs,readSource,functionManifest,functionPackage};
}
function candidateRecords(functionPackage){
 return published.functionRecords.map(fn=>fn.n==='arcade-growth'?{...clone(fn),d:functionPackage.sha256,
  bd:functionPackage.buildData,id:'replacement-provider-id',c:'2026-10-31T23:00:00Z',s:functionPackage.size,
  oid:'replacement-observability-id',oblv:fn.oblv+1}:clone(fn));
}
function currentPublication(locked=true,id=candidateId){return {id:siteId,published_deploy:{id,locked}};}

test('replaces only the existing Daily Growth digest and preserves all 40 configurations',()=>{
 const {functionPackage}=fixture();
 const before=clone(published.functionRecords);
 const configured=configurationWithReplacement(published.functionRecords,functionPackage);
 const previous=configurationFor(published.functionRecords);
 assert.equal(Object.keys(configured.functions).length,40);
 assert.deepEqual(Object.keys(configured.functions).filter(name=>configured.functions[name]!==previous.functions[name]),['arcade-growth']);
 assert.deepEqual(configured.functions_config,previous.functions_config);
 assert.deepEqual(published.functionRecords,before,'Configuration must not mutate the baseline');
 const candidate=candidateRecords(functionPackage);
 assert.equal(verifyFunctionRecords(candidate,published.functionRecords,functionPackage),candidate.find(fn=>fn.n==='arcade-growth'));
});

test('rejects an altered full provider record for each of the other 39 functions',()=>{
 const {functionPackage}=fixture();
 for(const fn of published.functionRecords.filter(fn=>fn.n!=='arcade-growth')){
  const candidate=candidateRecords(functionPackage);
  candidate.find(value=>value.n===fn.n).id+='-unexpected-rebuild';
  assert.throws(()=>verifyFunctionRecords(candidate,published.functionRecords,functionPackage),/unrelated full function/,fn.n);
 }
});

test('rejects replacement runtime, routes, limits, memory, priority, and unexpected fields',()=>{
 const {functionPackage}=fixture();
 for(const mutate of [fn=>{fn.r='nodejs24.x';},fn=>{fn.im='buffer';},fn=>{fn.ro[0].p='/api/*';},
  fn=>{fn.tr.action.config.rate_limit_config.window_limit=600;},fn=>{fn.m=2048;},
  fn=>{fn.mo=2048;},fn=>{fn.rgo='us-west-2';},fn=>{fn.p=99;},fn=>{fn.unreviewedSetting=true;}]){
  const candidate=candidateRecords(functionPackage);mutate(candidate.find(fn=>fn.n==='arcade-growth'));
  assert.throws(()=>verifyFunctionRecords(candidate,published.functionRecords,functionPackage));
 }
});

test('accepts new provider account placement only for the reviewed replacement',()=>{
 const {functionPackage}=fixture();
 const candidate=candidateRecords(functionPackage);
 const replacement=candidate.find(fn=>fn.n==='arcade-growth');
 replacement.a='564250524218';
 replacement.mo=1024;replacement.rgo='us-east-2';
 assert.equal(verifyFunctionRecords(candidate,published.functionRecords,functionPackage),replacement);
 assert.equal(published.functionRecords.find(fn=>fn.n==='arcade-growth').a,'837451400009');
});

test('rejects invalid provider account metadata on the original and replacement function',()=>{
 const {functionPackage}=fixture();
 for(const invalid of [undefined,null,564250524218,'56425052421','5642505242180','56425052421x',' 564250524218']){
  const candidate=candidateRecords(functionPackage);candidate.find(fn=>fn.n==='arcade-growth').a=invalid;
  assert.throws(()=>verifyFunctionRecords(candidate,published.functionRecords,functionPackage),/replacement function provider account/);
  const badBaseline=clone(published.functionRecords);badBaseline.find(fn=>fn.n==='arcade-growth').a=invalid;
  assert.throws(()=>verifyFunctionRecords(candidateRecords(functionPackage),badBaseline,functionPackage),/original function provider account/);
 }
});

test('rejects valid provider-account changes to every unrelated full function record',()=>{
 const {functionPackage}=fixture();
 for(const fn of published.functionRecords.filter(fn=>fn.n!=='arcade-growth')){
  const candidate=candidateRecords(functionPackage);
  candidate.find(value=>value.n===fn.n).a=fn.a==='564250524218'?'837451400009':'564250524218';
  assert.throws(()=>verifyFunctionRecords(candidate,published.functionRecords,functionPackage),/unrelated full function/,fn.n);
 }
});

test('pins the complete verified replacement record including its provider account',()=>{
 const {functionPackage}=fixture();
 const candidate=candidateRecords(functionPackage);candidate.find(fn=>fn.n==='arcade-growth').a='564250524218';
 const verified=verifyFunctionRecords(candidate,published.functionRecords,functionPackage);
 const pinned=clone(verified);
 assert.doesNotThrow(()=>verifyPinnedReplacementRecord(verified,pinned));
 assert.doesNotThrow(()=>verifyPinnedReplacementRecord(verified,undefined),'First verification establishes the pin');
 for(const changed of [{...verified,a:'837451400009'},{...verified,id:'another-provider-revision'},
  {...verified,c:'2026-11-01T00:00:00Z'},{...verified,oid:'another-observability-id'}])
  assert.throws(()=>verifyPinnedReplacementRecord(changed,pinned),/previously verified replacement-function provider\/configuration record changed/);
});

test('allows only the replacement default-region entry and records both exact override arrays',()=>{
 const replacementRecord={...clone(original),rgo:'us-east-2'};
 const before=baseline.deploy.functions_region_overrides;
 for(const after of [clone(before),[{name:'arcade-growth',region:'cmh'},...clone(before)],
  [...clone(before),{name:'arcade-growth',region:'cmh'}]]){
  const candidate={functions_region:'cmh',functions_region_overrides:after};
  const evidence=verifyFunctionRegionOverrides(candidate,baseline.deploy,replacementRecord);
  assert.equal(evidence.functionRegion,'cmh');
  assert.deepEqual(evidence.baselineFunctionRegionOverrides,before);
  assert.deepEqual(evidence.functionRegionOverrides,after);
  assert.notEqual(evidence.functionRegionOverrides,after,'Evidence must not retain a mutable API array reference');
 }
});

test('rejects duplicate, unrelated, reordered, or changed-region override entries',()=>{
 const replacementRecord={...clone(original),rgo:'us-east-2'};
 const accepted=[...clone(baseline.deploy.functions_region_overrides),{name:'arcade-growth',region:'cmh'}];
 const mutations=[
  rows=>rows.push({name:'arcade-growth',region:'cmh'}),
  rows=>{rows[0]=clone(rows[1]);},
  rows=>{rows[0]={name:'unreviewed-function',region:'cmh'};},
  rows=>rows.splice(0,1),
  rows=>{[rows[0],rows[1]]=[rows[1],rows[0]];},
  rows=>{rows[0].region='iad';},
  rows=>{rows.at(-1).region='iad';},
  rows=>{rows.at(-1).unreviewedSetting=true;},
 ];
 for(const mutate of mutations){
  const rows=clone(accepted);mutate(rows);
  assert.throws(()=>verifyFunctionRegionOverrides({functions_region:'cmh',functions_region_overrides:rows},baseline.deploy,replacementRecord));
 }
});

test('requires cmh on both deploys and consistent us-east-2 replacement metadata',()=>{
 const candidate={functions_region:'cmh',functions_region_overrides:[...clone(baseline.deploy.functions_region_overrides),{name:'arcade-growth',region:'cmh'}]};
 const record={...clone(original),rgo:'us-east-2'};
 assert.throws(()=>verifyFunctionRegionOverrides({...candidate,functions_region:'iad'},baseline.deploy,record),/must remain cmh/);
 assert.throws(()=>verifyFunctionRegionOverrides(candidate,{...baseline.deploy,functions_region:'iad'},record),/must remain cmh/);
 for(const different of [{...record,rg:'us-east-1'},{...record,rgo:'us-west-2'},{...record,n:'treeforce89-dev'}])
  assert.throws(()=>verifyFunctionRegionOverrides(candidate,baseline.deploy,different),/conflicts with the cmh default region/);
 const alteredBaseline=clone(baseline.deploy);alteredBaseline.functions_region_overrides[0].region='iad';
 assert.throws(()=>verifyFunctionRegionOverrides(candidate,alteredBaseline,record),/baseline function region override differs/);
});

test('pins the actual override array across later verification and publication',()=>{
 const after=[...clone(baseline.deploy.functions_region_overrides),{name:'arcade-growth',region:'cmh'}];
 const candidate={functions_region:'cmh',functions_region_overrides:after};
 const record={...clone(original),rgo:'us-east-2'};
 const pinned=verifyFunctionRegionOverrides(candidate,baseline.deploy,record).functionRegionOverrides;
 assert.doesNotThrow(()=>verifyFunctionRegionOverrides(candidate,baseline.deploy,record,pinned));
 // Both variants are semantically valid before pinning; neither may replace an
 // already reviewed array, including its exact explicit-entry position.
 for(const rows of [clone(baseline.deploy.functions_region_overrides),
  [{name:'arcade-growth',region:'cmh'},...clone(baseline.deploy.functions_region_overrides)]])
  assert.throws(()=>verifyFunctionRegionOverrides({functions_region:'cmh',functions_region_overrides:rows},baseline.deploy,record,pinned),/previously verified function region override array changed/);
});

test('rejects missing, duplicated, extra, or unchanged function packages',()=>{
 const {functionPackage}=fixture();
 const candidate=candidateRecords(functionPackage);
 assert.throws(()=>verifyFunctionRecords(candidate.slice(1),published.functionRecords,functionPackage),/same 40 functions/);
 assert.throws(()=>verifyFunctionRecords([...candidate,candidate[0]],published.functionRecords,functionPackage),/same 40 functions/);
 const duplicated=clone(candidate);duplicated[0]=clone(duplicated[1]);
 assert.throws(()=>verifyFunctionRecords(duplicated,published.functionRecords,functionPackage),/duplicated/);
 assert.throws(()=>configurationWithReplacement(published.functionRecords,{...functionPackage,sha256:original.d}),/new reviewed package digest/);
});

test('allows upload demand only for the reviewed replacement package',()=>{
 const {functionPackage}=fixture();
 assert.doesNotThrow(()=>verifyFunctionUploadDemand([functionPackage.sha256],functionPackage));
 assert.doesNotThrow(()=>verifyFunctionUploadDemand([],functionPackage),'An already stored reviewed digest needs no upload');
 for(const demand of [[original.d],[functionPackage.sha256,published.functionRecords[0].d],{},[functionPackage.sha256,functionPackage.sha256]])
  assert.throws(()=>verifyFunctionUploadDemand(demand,functionPackage),/unrelated function upload/);
});

test('requires both pinned root and isolated backend dependency inputs',()=>{
 const {functionManifest,readSource}=fixture();
 assert.equal(readFunctionPackage({manifest:functionManifest,readSource}).sourceFiles.length,7);
 for(const path of ['package-lock.json','vendor/arcade-growth-backend/package.json','vendor/arcade-growth-backend/package-lock.json']){
  const manifest=clone(functionManifest);manifest.sourceFiles=manifest.sourceFiles.filter(file=>file.path!==path);
  assert.throws(()=>readFunctionPackage({manifest,readSource}),/pinned root and isolated dependency inputs/);
 }
 const wrongRuntime={...functionManifest,runtimeVersion:'nodejs24.x'};
 assert.throws(()=>readFunctionPackage({manifest:wrongRuntime,readSource}),/reviewed Node 22/);
});

test('retains every baseline path and all old native hashes while adding only four reviewed assets',()=>{
 const data=fixture(),built=buildFiles(baseline,data);
 assert.equal(Object.keys(built.files).length,241);
 assert.equal(built.newPaths.length,4);
 assert.deepEqual(built.changedExistingPaths,existingPaths);
 for(const [path,digest] of Object.entries(published.filesBySha1)){
  assert(Object.hasOwn(built.files,path),path);
  if(!existingPaths.includes(path))assert.equal(built.files[path],digest,path);
 }
 assert.deepEqual(built.overlay.find(file=>file.path.endsWith('index-mixed321.css')),
  {path:'/play/treeforce89/assets/index-mixed321.css',source:'play/treeforce89/assets/index-MiXeD321.css',
   sha:data.manifest.publicFiles[3].sha1,size:data.manifest.publicFiles[3].size});
});

test('blocks unrelated static edits, deleted old assets, and extra unreviewed hashed assets',()=>{
 const built=buildFiles(baseline,fixture());
 const changed={...built.files,'/index.html':'d'.repeat(40)};
 assert.throws(()=>validateStaticInventory(built.original,changed,built.newPaths),/outside the approved arcade scope/);
 const removed={...built.files};delete removed[Object.keys(built.original).find(path=>path.startsWith('/play/treeforce89/assets/'))];
 assert.throws(()=>validateStaticInventory(built.original,removed,built.newPaths),/Every existing public path/);
 const added={...built.files,'/play/treeforce89/assets/index-unreviewed.js':'e'.repeat(40)};
 assert.throws(()=>validateStaticInventory(built.original,added,built.newPaths),/Only reviewed native hashed assets/);
});

test('rejects manifests that replace old hashed files or escape the native asset scope',()=>{
 const previousAsset=Object.keys(published.filesBySha1).find(path=>/^\/play\/treeforce89\/assets\/index-.*\.js$/.test(path));
 for(const path of [previousAsset,'/scripts/unreviewed.js','/play/treeforce89/assets/unhashed.js']){
  const data=fixture();data.manifest.publicFiles[1].path=path;data.manifest.publicFiles[1].source=path.slice(1);
  assert.throws(()=>buildFiles(baseline,data),/Previously published native hashes|outside the reviewed game entry/);
 }
 const data=fixture();data.manifest.publicFiles[1].source='../private.js';
 assert.throws(()=>buildFiles(baseline,data),/unsafe or mismatched source path/);
});

test('rejects drift in native baseline evidence, build inputs, and artifact bytes',()=>{
 const sourceDrift=fixture();sourceDrift.inputs.set(requiredFrontendSources[0],Buffer.from('changed after build'));
 assert.throws(()=>buildFiles(baseline,sourceDrift),/input changed after the reviewed build/);
 const outputDrift=fixture();outputDrift.inputs.set(outputDrift.manifest.publicFiles[1].source,Buffer.from('changed output'));
 assert.throws(()=>buildFiles(baseline,outputDrift),/artifact changed after its reviewed build/);
 const wrongBaseline=fixture();wrongBaseline.manifest.baselineNativeFiles[0].sha1='0'.repeat(40);
 assert.throws(()=>buildFiles(baseline,wrongBaseline),/does not match the published baseline/);
 const missingInput=fixture();missingInput.manifest.sourceFiles.shift();
 assert.throws(()=>buildFiles(baseline,missingInput),/required native frontend or build input/);
});

test('pins native artifacts using exact source casing, and pins manifest plus all build inputs',()=>{
 const data=fixture(),built=buildFiles(baseline,data),reads=[];
 sourceIsPinned({sourceCommit},built.overlay,data.functionPackage,built.frontendPackage,{
  assertAncestor:commit=>assert.equal(commit,sourceCommit),readCommitted:(commit,path)=>{
   assert.equal(commit,sourceCommit);reads.push(path);return data.readSource(path);
  },
 });
 assert(reads.includes('play/treeforce89/assets/arcade-AbCd1234.js'));
 assert(!reads.includes('play/treeforce89/assets/arcade-abcd1234.js'));
 for(const file of [...data.functionPackage.sourceFiles,...built.frontendPackage.sourceFiles])assert(reads.includes(file.path),file.path);
 assert(reads.includes('docs/treeforce-participation-frontend.json'));
});

test('rejects a source commit with modified inputs, modified artifacts, or no ancestry',()=>{
 const data=fixture(),built=buildFiles(baseline,data);
 for(const changed of ['vendor/arcade-growth-backend/package-lock.json','treeforce89/frontend/participation-client.mjs',
  'docs/treeforce-participation-frontend.json','play/treeforce89/assets/arcade-AbCd1234.js'])
  assert.throws(()=>sourceIsPinned({sourceCommit},built.overlay,data.functionPackage,built.frontendPackage,{
   assertAncestor:()=>{},readCommitted:(_,path)=>path===changed?Buffer.from('unreviewed'):data.readSource(path),
  }),/differs from the candidate source commit|changed after the candidate source commit/);
 assert.throws(()=>sourceIsPinned({sourceCommit},built.overlay,data.functionPackage,built.frontendPackage,{
  assertAncestor:()=>{throw new Error('not an ancestor');},
 }),/not an ancestor/);
});

test('allows the former deploy lock to be false only while the new current publication is locked',()=>{
 const previous={...clone(baseline.deploy),locked:false};
 assert.equal(verifyPublishedBaseline(previous,baseline,published.filesBySha1,currentPublication(),candidateId),false);
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,currentPublication(false),candidateId),/current locked publication/);
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,currentPublication(true,expectedBaselineId),candidateId),/current locked publication/);
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,currentPublication(),expectedBaselineId),/new candidate identity/);
});

test('post-publication verification still rejects changes to any old schedule, function record, or static path',()=>{
 for(const index of [0,1,2,3,4]){
  const previous=clone(baseline.deploy);previous.function_schedules[index].cron='* * * * *';
  assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,currentPublication(),candidateId),/schedules changed/);
 }
 const previous=clone(baseline.deploy);previous.available_functions[0].id+='-modified';
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,currentPublication(),candidateId),/full function records changed/);
 const changedOverrides=clone(baseline.deploy);changedOverrides.functions_region_overrides[0].region='iad';
 assert.throws(()=>verifyPublishedBaseline(changedOverrides,baseline,published.filesBySha1,currentPublication(),candidateId),/function region overrides changed/);
 const files={...published.filesBySha1,'/index.html':'a'.repeat(40)};
 assert.throws(()=>verifyPublishedBaseline(baseline.deploy,baseline,files,currentPublication(),candidateId),/static inventory changed/);
});
