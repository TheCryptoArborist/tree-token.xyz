import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {BASELINE,planFiles,reuseFunctions,verifyServedHTML} from '../scripts/release-treeforce89-bonus-intro.mjs';
import {validateFunctions} from '../scripts/lib/treeforce89-production-inventory.mjs';

test('HTML permits only the exact hosting snippet already on production',()=>{
 const expected='<html><body><div id="root"></div></body></html>';
 const snippet='<script id="tree-arcade-arboretum-link">known();</script>';
 const actual=expected.replace('</body>',snippet+'</body>');
 verifyServedHTML(expected,actual,actual);
 assert.throws(()=>verifyServedHTML(expected,actual.replace('known();','unknown();'),actual));
 assert.throws(()=>verifyServedHTML(expected,actual.replace('</body>','<script>other();</script></body>'),actual));
});

test('frontend overlay preserves unrelated and protected static paths and rejects changed reviewed bytes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'treeforce-release-'));
 try{
  const files=Array.from({length:13},(_,i)=>{
   const source=join(dir,String(i)),bytes=Buffer.from('reviewed '+i);writeFileSync(source,bytes);
   return {path:'/play/treeforce89/'+i+'-ASSET.js',source,sha:createHash('sha1').update(bytes).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  });
  const baseline={deployId:BASELINE,files:{'/play/treeforce89/0-asset.js':'old','/netlify.toml':'protected','/play/index.html':'arcade','/dapp/index.html':'wallet'}};
  const input={expectedProduction:BASELINE,siteId:'aa62f324-b880-47d6-85b8-4ba0700ff5bf',requiredFunctions:43,requiredSchedules:5,backendBuilt:false,environmentChanges:false,migrationsIncluded:false,files};
  const approved={files:files.map(({source,...f})=>f)};
  const plan=planFiles(baseline,input,approved);assert.equal(plan.files['/netlify.toml'],'protected');assert.equal(plan.files['/dapp/index.html'],'wallet');assert.equal(plan.files['/play/index.html'],'arcade');assert.deepEqual(plan.changed,['/play/treeforce89/0-asset.js']);
  assert.throws(()=>planFiles(baseline,{...input,requiredFunctions:41},approved));
  assert.throws(()=>planFiles(baseline,{...input,environmentChanges:true},approved));
  assert.throws(()=>planFiles(baseline,{...input,expectedProduction:'stale'},approved));
  writeFileSync(files[1].source,'unreviewed');assert.throws(()=>planFiles(baseline,input,approved));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('all 43 packages are reused with routes, memory, region and traffic rules intact',()=>{
 const f=Array.from({length:43},(_,i)=>({n:'fn-'+i,d:'a'.repeat(64),id:'id',oid:'oid',a:'provider',c:'created',r:'nodejs22.x',rg:'us-east-2',m:1024,mo:1024,rgo:'us-east-2',im:'stream',s:42,bd:{bootstrapVersion:'2.24.0'},tr:{action:{type:'rate_limit'}},ro:[{p:'/api/'+i,l:'/api/'+i,m:['POST'],ps:false}]}));
 validateFunctions(f);assert.throws(()=>validateFunctions(f.slice(0,41)));
 const r=reuseFunctions(f);assert.equal(Object.keys(r.functions).length,43);assert.equal(r.functions['fn-42'],f[42].d);
 assert.deepEqual(r.functions_config['fn-42'],{build_data:f[42].bd,memory:1024,region:'us-east-2',traffic_rules:f[42].tr,routes:[{pattern:'/api/42',literal:'/api/42',methods:['POST'],prefer_static:false}]});
 delete f[42].mo;delete f[42].rgo;const inherited=reuseFunctions(f).functions_config['fn-42'];assert(!Object.hasOwn(inherited,'memory'));assert(!Object.hasOwn(inherited,'region'));
 assert.throws(()=>reuseFunctions(f.slice(0,41)));
});
