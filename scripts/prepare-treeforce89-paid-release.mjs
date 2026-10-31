import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {zipFunctions} from '@netlify/zip-it-and-ship-it';
import {applyPaidContinue} from './apply-treeforce89-paid-continue.mjs';
import {styleTreeForceGateway} from './style-treeforce89-gateway.mjs';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'.netlify/treeforce89-pinned');
const stage=resolve(root,'.netlify/treeforce89-paid-release');
const pin='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),pin);
applyPaidContinue(source);
const gatewayPath=resolve(source,'app/game/gateway-client.mjs');
writeFileSync(gatewayPath,execFileSync('git',['show',pin+':app/game/gateway-client.mjs'],{cwd:source,encoding:'utf8'})
 .replaceAll('/.netlify/functions/tree-','/play/treeforce89/api/tree-'));
rmSync(resolve(source,'dist'),{recursive:true,force:true});
execFileSync('npm',['run','build','--','--base','/play/treeforce89/'],{cwd:source,stdio:'inherit'});
const compiledPaths=new Set();
function compiled(dir,rel=''){for(const name of readdirSync(dir)){
 const path=join(dir,name),relative=join(rel,name);
 if(statSync(path).isDirectory())compiled(path,relative);else compiledPaths.add(relative);
}}
compiled(resolve(source,'dist'));
rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
cpSync(resolve(source,'dist'),resolve(stage,'play/treeforce89'),{recursive:true});
styleTreeForceGateway(resolve(stage,'play/treeforce89'));
const play=readFileSync(resolve(root,'.netlify/treeforce89-canonical-development/play/index.html'),'utf8');
const oldDescription='Test the NFTree Gateway and retro formation shooter. Development testing only; paid continues are disabled.';
assert.equal(play.split(oldDescription).length,2);
writeFileSync(resolve(stage,'play/index.html'),play.replace(oldDescription,
 'Pilot the Arborwing and defend the canopy. Your NFTree unlocks access; continue the same flight for 20,000 TREE after losing all three lives.'));
const built=await zipFunctions(resolve(root,'netlify/canonical-development-functions'),resolve(stage,'private-functions'),{
 archiveFormat:'zip',config:{'*':{nodeBundler:'esbuild',nodeVersion:'22.x'}},basePath:root});
assert.equal(built.length,1);const fn=built[0];assert.equal(fn.name,'treeforce89-dev');
const files=[];function walk(dir,rel=''){for(const name of readdirSync(dir)){
 const path=join(dir,name),relative=join(rel,name);if(statSync(path).isDirectory())walk(path,relative);
 else if(relative==='index.html'||relative==='treeforce89/gateway.css'||
  (relative.startsWith('treeforce89/')&&compiledPaths.has(relative.slice('treeforce89/'.length))))
  files.push({path:'/play/'+relative,source:path,sha:createHash('sha1').update(readFileSync(path)).digest('hex')});
}}walk(resolve(stage,'play'));
const report={files,function:{name:fn.name,path:fn.path,sha256:createHash('sha256').update(readFileSync(fn.path)).digest('hex'),
 runtime:fn.runtimeVersion,invocationMode:fn.invocationMode,buildData:fn.buildData||{bootstrapVersion:fn.bootstrapVersion,runtimeAPIVersion:fn.runtimeAPIVersion},routes:fn.routes,trafficRules:fn.trafficRules}};
writeFileSync(resolve(stage,'release-input.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({publicFiles:files.length,function:fn.name,sourcePin:pin,dependenciesUnchanged:true}));
