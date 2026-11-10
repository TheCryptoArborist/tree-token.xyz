import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleFiles,compareBackend,functionsConfig,assertNewCandidate,ROOTCASTER_PATHS,SITE_ID,BASELINE_ID,AUDITED_STALE_DEPLOYS,isAuditedInactiveDeploy} from '../scripts/release-rootcaster.mjs';
const overlays=()=>ROOTCASTER_PATHS.map((path,i)=>({path,source:path.slice(1),sha1:String(i+1).repeat(40)}));
function backend(){return {id:BASELINE_ID,site_id:SITE_ID,context:'production',functions_region:'cmh',available_functions:Array.from({length:46},(_,i)=>({n:'test-'+i,d:'a'.repeat(64),id:'id-'+i,oid:'oid-'+i,a:'account',c:'created',r:'nodejs22.x',rg:'us-east-2',m:1024,im:'stream',s:100,bd:{bootstrapVersion:'2.24.0'},ro:[],tr:{action:'keep'}})),function_schedules:Array.from({length:5},(_,i)=>({name:'test-'+i,cron:'0 0 * * *'}))};}
test('only three gallery additions, all existing paths and bytes retained',()=>{const baseline={'/index.html':'a'.repeat(40),'/play/index.html':'b'.repeat(40),'/_headers':'c'.repeat(40)};const result=assembleFiles(baseline,overlays());for(const [p,h]of Object.entries(baseline))assert.equal(result.files[p],h);assert.deepEqual(result.changedOriginals,[]);assert.deepEqual(result.addedPaths,[...ROOTCASTER_PATHS].sort());});
test('refuses unrelated uploads, existing gallery paths and missing overlays',()=>{const b={'/index.html':'a'.repeat(40)};assert.throws(()=>assembleFiles(b,[...overlays(),{path:'/other.html',source:'other.html',sha1:'d'.repeat(40)}]));assert.throws(()=>assembleFiles({...b,'/rootcaster/index.html':'f'.repeat(40)},overlays()));assert.throws(()=>assembleFiles(b,overlays().slice(1)));});
test('complete function records, runtime, package hashes and schedules protected',()=>{const expected=backend();compareBackend(structuredClone(expected),expected);for(const field of ['d','id','oid','r','rg','m','s','im','bd','tr','ro']){const actual=structuredClone(expected);actual.available_functions[0][field]='changed';assert.throws(()=>compareBackend(actual,expected));}const schedule=structuredClone(expected);schedule.function_schedules[0].cron='changed';assert.throws(()=>compareBackend(schedule,expected));const removed=backend();removed.available_functions.pop();assert.throws(()=>compareBackend(removed,expected));});
test('function configuration retains traffic controls without adding runtime fields',()=>{const c=functionsConfig(backend());assert.equal(Object.keys(c).length,46);assert.deepEqual(c['test-0'].traffic_rules,{action:'keep'});assert(!('runtime' in c['test-0']));});
test('an existing baseline cannot be published as the new candidate',()=>{assert.throws(()=>assertNewCandidate({schemaVersion:1,siteId:SITE_ID,id:BASELINE_ID},{},{}));});

import {assertServedContent,ARBORETUM_SNIPPET} from '../scripts/rootcaster-served-content.mjs';
test('served page accepts original bytes and only the exact existing body-end snippet',()=>{const original=Buffer.from('<html><body>Gallery</body></html>');assertServedContent('index.html',original,original);assertServedContent('index.html',Buffer.from('<html><body>Gallery'+ARBORETUM_SNIPPET+'</body></html>'),original);});
test('served page rejects changed copy, modified scripts, extra scripts and unexpected assets',()=>{const original=Buffer.from('<html><body>Gallery</body></html>');for(const actual of ['<html><body>Changed'+ARBORETUM_SNIPPET+'</body></html>','<html><body>Gallery'+ARBORETUM_SNIPPET.replace('treegrow.xyz','other.invalid')+'</body></html>','<html><body>Gallery<script>unexpected()</script>'+ARBORETUM_SNIPPET+'</body></html>'])assert.throws(()=>assertServedContent('index.html',Buffer.from(actual),original));assert.throws(()=>assertServedContent('rootcaster.css',Buffer.from('different'),Buffer.from('original')));});

test('only the ten exact historical orphan records bypass the queue guard',()=>{
  assert.equal(AUDITED_STALE_DEPLOYS.size,10);
  for(const [id,[state,created_at,updated_at,context,commit_ref]] of AUDITED_STALE_DEPLOYS){
    const record={id,site_id:SITE_ID,state,created_at,updated_at,context,commit_ref,
      build_id:null,published_at:null,locked:null};
    assert(isAuditedInactiveDeploy(record),id+' should match its exact reviewed state');
    for(const mutation of [{state:'building'},{updated_at:'2026-11-10T12:00:00.000Z'},
      {build_id:'live-build'},{published_at:'2026-11-10T12:00:00.000Z'},
      {locked:true},{site_id:'other-site'},{commit_ref:'unexpected'}]){
      assert(!isAuditedInactiveDeploy({...record,...mutation}),id+' must reject changed record');
    }
    assert(!isAuditedInactiveDeploy({...record,id:'6af2a1f00000000000000000'}));
  }
});
