import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 buildFiles,configurationFor,expectedBaselineId,existingPaths,protectedSourcePaths,siteId,
 sourceBaseCommit,sourceBranch,sourceIsPinned,validateStaticInventory,verifyForwardPublication,
 verifyFunctionRecords,verifyFunctionUploadDemand,verifyNewCandidate,verifyPublishedBaseline,verifyRuntime,
} from '../scripts/release-daily-growth-compact.mjs';

// Use the full current published inventory. Importing the release guard does not
// initialize the CLI or call a provider. All proposed changes stay in memory.
const published=JSON.parse(readFileSync(new URL('../docs/daily-growth-polish-published.json',import.meta.url)));
const clone=value=>structuredClone(value);
const hash=(algorithm,value)=>createHash(algorithm).update(value).digest('hex');
const baseline={siteId,deploy:{id:expectedBaselineId,site_id:siteId,state:'ready',locked:true,
 branch:'main',context:'production',created_at:published.publishedAt,published_at:published.publishedAt,
 available_functions:published.functionRecords,function_schedules:published.functionSchedules,
 functions_region:published.functionRegion,functions_region_overrides:published.functionRegionOverrides,
 edge_functions_present:false,database_migrations:[]},
 files:Object.entries(published.filesBySha1).map(([path,sha])=>({path,sha}))};
const candidateId='b'.repeat(24),sourceCommit='c'.repeat(40);
const candidate=()=>({...clone(baseline.deploy),id:candidateId,created_at:new Date(Date.parse(published.publishedAt)+1000).toISOString(),
 published_at:null,locked:false});
const current=(locked=true,id=candidateId)=>({id:siteId,published_deploy:{id,locked}});
function fixture(){
 const sources=new Map([...existingPaths.map(path=>[path.slice(1),Buffer.from('reviewed compact layout: '+path)]),
  ...protectedSourcePaths.map(path=>[path,Buffer.from('unchanged protected input: '+path)])]);
 const readSource=path=>{assert(sources.has(path),path);return sources.get(path);};
 return {sources,readSource,readCommitted:(_,path)=>readSource(path),assertAncestor:()=>{}};
}
function proof(){
 return {id:candidateId,siteId,baseline:expectedBaselineId,sourceCommit,sourceBaseCommit,sourceBranch,
  baselineDigest:'d'.repeat(64),filesDigest:'e'.repeat(64),unpublished:true};
}

test('pins the compact release to the latest published baseline and separate source branch',()=>{
 assert.equal(expectedBaselineId,'6ae66f6c82e32369a34b6d1d');
 assert.equal(published.id,expectedBaselineId);
 assert.equal(sourceBaseCommit,'dbafaefb60ad53e764b65db128c360111fbd9e0c');
 assert.equal(sourceBranch,'feature/daily-growth-compact-20261031');
 assert.equal(published.sourceCommit,'5e2ecbf482dbe0dde9cc8eebf02fd479b6e62bb8');
 assert(protectedSourcePaths.includes('assets/arcade/arcade-growth-wallet.js'));
 assert(protectedSourcePaths.includes('assets/arcade/nftree-wallet-mint.js'));
});

test('retains all 241 paths, changing only the three reviewed frontend overlays',()=>{
 const built=buildFiles(baseline,fixture());
 assert.equal(Object.keys(built.files).length,241);
 assert.deepEqual(built.changedExistingPaths,existingPaths);
 assert.equal(Object.keys(built.original).length-built.changedExistingPaths.length,238);
 for(const [path,sha] of Object.entries(published.filesBySha1)){
  assert(Object.hasOwn(built.files,path),path);
  if(!existingPaths.includes(path))assert.equal(built.files[path],sha,path);
 }
 assert(Object.keys(built.files).filter(path=>path.startsWith('/play/treeforce89/')).length>13);
 for(const path of ['/play/treeforce89/index.html','/assets/arcade/arcade-growth-wallet.js','/assets/arcade/nftree-wallet-mint.js'])
  assert.equal(built.files[path],published.filesBySha1[path],path);
});

test('rejects added, deleted, unrelated changed, or invalid public paths',()=>{
 const built=buildFiles(baseline,fixture());
 const added={...built.files,'/scripts/unreviewed.js':'f'.repeat(40)};
 assert.throws(()=>validateStaticInventory(built.original,added),/no new public path/);
 const removed={...built.files};delete removed['/play/treeforce89/index.html'];
 assert.throws(()=>validateStaticInventory(built.original,removed),/All 241 existing public paths/);
 for(const path of ['/play/treeforce89/index.html','/assets/arcade/arcade-growth-wallet.js','/assets/arcade/tree-force-89-poster.webp','/index.html'])
  assert.throws(()=>validateStaticInventory(built.original,{...built.files,[path]:'f'.repeat(40)}),/outside the three approved/);
 assert.throws(()=>validateStaticInventory(built.original,{...built.files,[existingPaths[0]]:'bad'}),/SHA1 digest/);
});

test('serializes the exact 40 existing digests, routes, traffic rules, and regions',()=>{
 const result=configurationFor(published.functionRecords);
 assert.equal(Object.keys(result.functions).length,40);
 for(const fn of published.functionRecords){
  assert.equal(result.functions[fn.n],fn.d);
  assert.equal(result.functions_config[fn.n].region,fn.rg);
  assert.equal(result.functions_config[fn.n].memory,fn.m);
  assert.deepEqual(result.functions_config[fn.n].build_data,fn.bd);
  if(fn.tr)assert.deepEqual(result.functions_config[fn.n].traffic_rules,fn.tr);
 }
 const growth=published.functionRecords.find(fn=>fn.n==='arcade-growth');
 assert.equal(growth.d,'ac313c8da92e4c5cb2fde6014f1fc5dbd917ebe49c94fab05e5e70162f1bef57');
 assert.equal(growth.a,'564250524218');
 assert.deepEqual(result.functions_config['arcade-growth'].routes,[{
  pattern:'/api/arcade-growth',literal:'/api/arcade-growth',methods:['GET','POST'],prefer_static:false,
 }]);
});

test('rejects replacement of any of the 40 full function records, including current provider metadata',()=>{
 assert.doesNotThrow(()=>verifyFunctionRecords(clone(published.functionRecords),published.functionRecords));
 for(let index=0;index<40;index++){
  const changed=clone(published.functionRecords);changed[index].d='f'.repeat(64);
  assert.throws(()=>verifyFunctionRecords(changed,published.functionRecords),/records changed/,changed[index].n);
 }
 const growthIndex=published.functionRecords.findIndex(fn=>fn.n==='arcade-growth');
 for(const key of ['a','id','oid','c','r','rg','rgo','im','m','mo','ro','tr','bd']){
  const changed=clone(published.functionRecords);
  changed[growthIndex][key]=key==='a'?'000000000001':typeof changed[growthIndex][key]==='number'?2048:
   typeof changed[growthIndex][key]==='string'?changed[growthIndex][key]+'-changed':{};
  assert.throws(()=>verifyFunctionRecords(changed,published.functionRecords),/records changed/,key);
 }
 assert.throws(()=>verifyFunctionRecords(published.functionRecords.slice(1),published.functionRecords),/same 40 unique/);
 const duplicate=clone(published.functionRecords);duplicate[1]=clone(duplicate[0]);
 assert.throws(()=>verifyFunctionRecords(duplicate,published.functionRecords),/same 40 unique/);
});

test('refuses every function upload, even a current or previously reviewed digest',()=>{
 assert.doesNotThrow(()=>verifyFunctionUploadDemand([]));
 for(const fn of published.functionRecords)
  assert.throws(()=>verifyFunctionUploadDemand([fn.d]),/Refuse every function upload/,fn.n);
 for(const invalid of [undefined,null,{},['f'.repeat(64)]])
  assert.throws(()=>verifyFunctionUploadDemand(invalid),/Refuse every function upload/);
});

test('preserves all five schedules and exact runtime, region overrides, and contexts',()=>{
 assert.equal(baseline.deploy.functions_region_overrides.length,40);
 assert.doesNotThrow(()=>verifyRuntime(candidate(),baseline.deploy));
 for(let index=0;index<5;index++){
  const changed=candidate();changed.function_schedules[index].cron='* * * * *';
  assert.throws(()=>verifyRuntime(changed,baseline.deploy),/Scheduled jobs changed/);
 }
 for(const key of ['functions_region','branch','context']){
  const changed=candidate();changed[key]='unreviewed';
  assert.throws(()=>verifyRuntime(changed,baseline.deploy),/changed/);
 }
 const removed=candidate();removed.functions_region_overrides=removed.functions_region_overrides.filter(row=>row.name!=='arcade-growth');
 assert.throws(()=>verifyRuntime(removed,baseline.deploy),/region override records/);
 const reordered=candidate();reordered.functions_region_overrides.reverse();
 assert.throws(()=>verifyRuntime(reordered,baseline.deploy),/region override records/);
 const region=candidate();region.functions_region_overrides[39].region='iad';
 assert.throws(()=>verifyRuntime(region,baseline.deploy),/region override records/);
 for(const migration of [[{path:'new.sql'}],{files:[{path:'new.sql'}]},{}])
  assert.throws(()=>verifyRuntime({...candidate(),database_migrations:migration},baseline.deploy),/migration/i);
 assert.throws(()=>verifyRuntime({...candidate(),edge_functions_present:true},baseline.deploy),/Refuse edge functions/);
});

test('pins all three overlay bytes and unchanged dependencies and wallet adapters before candidate creation',()=>{
 const data=fixture(),built=buildFiles(baseline,data),calls=[];
 sourceIsPinned({sourceCommit},built.overlay,{...data,assertAncestor:(...args)=>calls.push(args)});
 assert.deepEqual(calls,[[sourceBaseCommit,sourceCommit],[sourceCommit,'HEAD']]);
 for(const file of built.overlay)assert.equal(hash('sha1',data.readSource(file.source)),file.sha);
 for(const path of existingPaths){
  assert.throws(()=>sourceIsPinned({sourceCommit},built.overlay,{...data,
   readCommitted:(commit,input)=>input===path.slice(1)?Buffer.from('unreviewed'):data.readCommitted(commit,input),
  }),/static file changed/);
 }
 assert.throws(()=>sourceIsPinned({sourceCommit},built.overlay,{...data,assertAncestor:()=>{throw new Error('unrelated history');}}),/reviewed starting commit/);
});

test('rejects committed or working-tree changes to dependencies and wallet adapters',()=>{
 for(const path of protectedSourcePaths){
  const data=fixture(),built=buildFiles(baseline,data);
  assert.throws(()=>sourceIsPinned({sourceCommit},built.overlay,{...data,
   readCommitted:(commit,input)=>commit===sourceCommit&&input===path?Buffer.from('dependency edit'):data.readCommitted(commit,input),
  }),/Protected dependency or wallet adapter changed/);
  assert.throws(()=>sourceIsPinned({sourceCommit},built.overlay,{...data,
   readSource:input=>input===path?Buffer.from('uncommitted dependency edit'):data.readSource(input),
  }),/Protected dependency or wallet adapter changed/);
 }
});

test('requires a new ready candidate created after the pinned baseline',()=>{
 assert.doesNotThrow(()=>verifyNewCandidate(candidate(),baseline.deploy,candidateId));
 assert.throws(()=>verifyNewCandidate({...candidate(),id:expectedBaselineId},baseline.deploy,expectedBaselineId),/new candidate/);
 for(const created_at of ['not-a-date',baseline.deploy.created_at,'2026-01-01T00:00:00.000Z'])
  assert.throws(()=>verifyNewCandidate({...candidate(),created_at},baseline.deploy,candidateId),/older deployment/);
 for(const change of [{state:'uploading'},{site_id:'wrong-site'},{id:'d'.repeat(24)}])
  assert.throws(()=>verifyNewCandidate({...candidate(),...change},baseline.deploy,candidateId),/ready on the expected site/);
});

test('publishes only the exact prior-verified, never-published candidate',()=>{
 assert.doesNotThrow(()=>verifyForwardPublication(candidate(),proof(),proof()));
 for(const key of ['id','sourceCommit','baselineDigest','filesDigest','sourceBranch','sourceBaseCommit'])
  assert.throws(()=>verifyForwardPublication(candidate(),proof(),{...proof(),[key]:'unreviewed'}),/successful prior verification/);
 assert.throws(()=>verifyForwardPublication({...candidate(),published_at:published.publishedAt},proof(),proof()),/never-published/);
 assert.throws(()=>verifyForwardPublication(candidate(),proof(),{...proof(),unpublished:false}),/never-published/);
 assert.throws(()=>verifyForwardPublication({...candidate(),id:expectedBaselineId},proof(),proof()),/exact new recorded candidate/);
});

test('accepts the former lock clearing only when the new current publication is locked',()=>{
 const previous={...clone(baseline.deploy),locked:false};
 assert.equal(verifyPublishedBaseline(previous,baseline,published.filesBySha1,current(),candidateId),false);
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,current(false),candidateId),/current locked publication/);
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,current(true,expectedBaselineId),candidateId),/current locked publication/);
 assert.throws(()=>verifyPublishedBaseline(previous,baseline,published.filesBySha1,current(),expectedBaselineId),/new candidate identity/);
});

test('post-publication audit still preserves previous static files and full backend configuration',()=>{
 const files={...published.filesBySha1,'/play/treeforce89/index.html':'f'.repeat(40)};
 assert.throws(()=>verifyPublishedBaseline(baseline.deploy,baseline,files,current(),candidateId),/Previous deployment static inventory/);
 const changed=clone(baseline.deploy);changed.available_functions[39].a='000000000001';
 assert.throws(()=>verifyPublishedBaseline(changed,baseline,published.filesBySha1,current(),candidateId),/records changed/);
 const context={...clone(baseline.deploy),context:'deploy-preview'};
 assert.throws(()=>verifyPublishedBaseline(context,baseline,published.filesBySha1,current(),candidateId),/context changed/);
});
