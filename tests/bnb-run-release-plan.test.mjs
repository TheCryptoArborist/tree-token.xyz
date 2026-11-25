import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assemble,assertDisabled,readOnly,SITE,BASE,ROUTES,TRAFFIC,validatePackage} from '../scripts/prepare-bnb-run-release.mjs';
import {functionsConfig,packageTrafficRules} from '../scripts/release-arcade-cutoff.mjs';
const backend=JSON.parse(fs.readFileSync('production/tree-army-drawn-walk-backend-20261124.json'));
const files=JSON.parse(fs.readFileSync('production/tree-army-drawn-walk-release-20261124.json')).files;
const deploy=()=>({...structuredClone(backend),id:BASE,site_id:SITE,context:'production',branch:'main',functions_region:'cmh'});
const pack=()=>({sha256:'a'.repeat(64),buildData:{bootstrapVersion:'2.24.0',runtimeAPIVersion:2},routes:ROUTES,trafficRules:TRAFFIC});
test('complete current static/backend inventory retained with only one added function',()=>{
 const d=deploy(),before=structuredClone(d),f=structuredClone(files),p=assemble(d,f,pack());
 assert.deepEqual(p.files,files);assert.deepEqual(d,before);assert.deepEqual(f,files);
 assert.equal(Object.keys(p.functions).length,61);
 for(const old of d.available_functions){assert.equal(p.functions[old.n],old.d);assert.deepEqual(p.functions_config[old.n],functionsConfig(d)[old.n]);}
 assert.deepEqual(p.function_schedules,d.function_schedules);
 assert.deepEqual(p.functions_config['arcade-bnb-run-review'],{build_data:pack().buildData,routes:ROUTES,traffic_rules:packageTrafficRules(TRAFFIC)});
});
test('wrong or changed production baseline is rejected',()=>{
 for(const mutate of [d=>d.id='a'.repeat(24),d=>d.locked=false,d=>d.available_functions.pop(),d=>delete d.available_functions[0].oid,d=>d.function_schedules.pop(),d=>d.available_functions[0].ro=[{p:ROUTES[0].pattern}]]){const d=deploy();mutate(d);assert.throws(()=>assemble(d,files,pack()));}
 const f={...files};delete f[Object.keys(f)[0]];assert.throws(()=>assemble(deploy(),f,pack()));assert.equal(deploy().id,BASE);
});
test('planning API rejects every mutation before reaching transport',async()=>{
 const calls=[];const api=readOnly(async p=>calls.push(p));await api('sites/'+SITE);
 for(const verb of ['POST','PUT','PATCH','DELETE'])assert.throws(()=>api('sites/'+SITE,verb,{}));assert.deepEqual(calls,['sites/'+SITE]);
});
test('disabled publication cannot hide an enabled or masked flag',()=>{
 assertDisabled([]);assertDisabled([{key:'BNB_RUN_REVIEW_ENABLED',values:[{value:'false'}]}]);
 for(const value of ['true',undefined])assert.throws(()=>assertDisabled([{key:'BNB_RUN_REVIEW_ENABLED',values:[{value}]}]));
 assert.throws(()=>assertDisabled([],{env:{BNB_RUN_REVIEW_ENABLED:'true'}}));
});
test('tampered artifact fails before any source or network operations',()=>{
 assert.throws(()=>validatePackage({...pack(),kind:'bnb-run-review-package',name:'arcade-bnb-run-review',filename:'arcade-bnb-run-review.zip'},Buffer.from('tampered'),{artifact:{functionZipSha256:'a'.repeat(64)}}));
});
