import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {zipFunctions} from '@netlify/zip-it-and-ship-it';
import {styleTreeForceGateway} from './style-treeforce89-gateway.mjs';

const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'.netlify/treeforce89-pinned');
const stage=resolve(root,'.netlify/treeforce89-canonical-development');
const pin='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),pin);
rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
// Preserve the signing, session and payment logic. Only relocate HTTP endpoints
// to a game-specific namespace so existing TREE Token APIs remain untouched.
for(const name of ['gateway-client.mjs','continuation-review-client.mjs']) {
  const path=resolve(source,'app/game',name);
  const original=execFileSync('git',['show',pin+':app/game/'+name],{cwd:source,encoding:'utf8'});
  const count=(original.match(/\/\.netlify\/functions\/tree-/g)||[]).length;
  assert.equal(count,name==='gateway-client.mjs'?4:1);
  writeFileSync(path,original.replaceAll('/.netlify/functions/tree-','/play/treeforce89/api/tree-'));
}
rmSync(resolve(source,'dist'),{recursive:true,force:true});
run('npm',['run','build','--','--base','/play/treeforce89/'],source);
run('node',['scripts/verify-treeforce89-staged-assets.mjs',resolve(source,'dist')]);
cpSync(resolve(source,'dist'),resolve(stage,'play/treeforce89'),{recursive:true});
styleTreeForceGateway(resolve(stage,'play/treeforce89'));
const baseline=JSON.parse(readFileSync(resolve(root,'.netlify/live-release-baseline.json')));
const originalPlay=readFileSync(resolve(root,'play/index.html'),'utf8');
assert.equal(createHash('sha1').update(originalPlay).digest('hex'),
  baseline.files.find(f=>f.path==='/play/index.html').sha,'Live Play page differs; stop');
const marker='<span class="game-action disabled" aria-disabled="true">COMING SOON</span>';
assert.equal(originalPlay.split(marker).length,2);
const play=originalPlay.replace(marker,'<a class="game-action play-action" href="/play/treeforce89/">TEST TREE FORCE ’89 <span aria-hidden="true">→</span></a>')
  .replace('<span class="status soon">COMING SOON</span>','<span class="status testing">IN TESTING</span>')
  .replace('A retro arcade formation shooter being designed for the TREE ecosystem. The canopy is assembling.',
    'Test the NFTree Gateway and retro formation shooter. Development testing only; paid continues are disabled.');
writeFileSync(resolve(stage,'play/index.html'),play);
const built=await zipFunctions(resolve(root,'netlify/canonical-development-functions'),resolve(stage,'private-functions'),{
  archiveFormat:'zip',config:{'*':{nodeBundler:'esbuild',nodeVersion:'22.x'}},basePath:root,
});
assert.equal(built.length,1);assert.equal(built[0].name,'treeforce89-dev');
const fn=built[0];
const files=[];
function walk(dir,relative='') {for(const name of readdirSync(dir)){
  const path=join(dir,name),rel=join(relative,name);
  if(statSync(path).isDirectory())walk(path,rel);
  else files.push({path:'/play/'+rel,source:path,sha:createHash('sha1').update(readFileSync(path)).digest('hex')});
}}
walk(resolve(stage,'play'));
const gameJs=files.filter(f=>f.path.endsWith('.js')).map(f=>readFileSync(f.source,'utf8')).join('\n');
assert(!gameJs.includes('/.netlify/functions/tree-'));
assert(gameJs.includes('/play/treeforce89/api/tree-challenge'));
for(const f of files)assert(!/postgres(?:ql)?:\/\//.test(readFileSync(f.source).toString('utf8')));
const report={sourcePin:pin,baseline:baseline.deploy.id,files,function:{name:fn.name,path:fn.path,
  sha256:createHash('sha256').update(readFileSync(fn.path)).digest('hex'),runtime:fn.runtimeVersion,
  invocationMode:fn.invocationMode,buildData:fn.buildData||{bootstrapVersion:fn.bootstrapVersion,runtimeAPIVersion:fn.runtimeAPIVersion},routes:fn.routes,trafficRules:fn.trafficRules},
  paymentsEnabled:false};
writeFileSync(resolve(stage,'release-input.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({files:files.length,function:fn.name,routes:fn.routes,paymentsEnabled:false}));
