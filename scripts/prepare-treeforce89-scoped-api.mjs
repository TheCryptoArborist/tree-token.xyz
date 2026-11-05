import {zipFunctions} from '@netlify/zip-it-and-ship-it';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const stage='.netlify/treeforce89-scoped-api';mkdirSync(stage,{recursive:true});
const built=await zipFunctions('netlify/canonical-development-functions',stage,{
 archiveFormat:'zip',config:{'*':{nodeBundler:'esbuild',nodeVersion:'22.x'}},basePath:process.cwd()});
assert.equal(built.length,1);const fn=built[0];assert.equal(fn.name,'treeforce89-dev');
assert.equal(fn.runtimeVersion,'nodejs22.x');assert.equal(fn.invocationMode,'stream');
const report={name:fn.name,path:stage+'/treeforce89-dev.zip',runtime:fn.runtimeVersion,invocationMode:fn.invocationMode,
 buildData:fn.buildData,routes:fn.routes,trafficRules:fn.trafficRules,
 sha256:createHash('sha256').update(readFileSync(fn.path)).digest('hex')};
writeFileSync(stage+'/function.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({name:report.name,sha256:report.sha256,publicFiles:0,migrations:0}));
