// Prepare a frontend overlay only. Never deploy this directory as a whole site.
import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {stagePinnedFrontend,originalFrontendFile,provenance} from './lib/treeforce89-pinned-frontend.mjs';
import {applyPaidContinue} from './apply-treeforce89-paid-continue.mjs';
import {styleTreeForceGateway} from './style-treeforce89-gateway.mjs';

const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'.netlify/treeforce89-chapters-release-source');
const stage=resolve(root,'.netlify/treeforce89-chapters-release');
const base='/play/treeforce89/';
const expectedProduction='6aeca3a49e359f82ebf586db';
const approvedGameplayCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const run=(command,args,cwd=root)=>execFileSync(command,args,{cwd,stdio:'inherit'});
const sha=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
assert.equal(provenance.commit,'a38e08e37e1f71ea41b86add8e26a92b0789cf22');
await stagePinnedFrontend(source,{assetOrigin:'https://6aec00c92d9060d410e986e0--tree-token.netlify.app'});
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
applyPaidContinue(source);
// Release labels only; preserve the approved wallet/session/payment components.
const main=resolve(source,'src/main.tsx'),mainText=readFileSync(main,'utf8');
assert(mainText.includes('FLIGHT TEST · 0.6')&&mainText.includes('v0.6.0 · gameplay preview'));
writeFileSync(main,mainText.replace('FLIGHT TEST · 0.6','CANOPY COMMAND').replace('v0.6.0 · gameplay preview','v0.7.0'));
writeFileSync(resolve(source,'app/game/gateway-client.mjs'),originalFrontendFile('app/game/gateway-client.mjs')
 .replaceAll('/.netlify/functions/tree-','/play/treeforce89/api/tree-'));
assert.equal(readFileSync(resolve(source,'app/dapp-kit.ts'),'utf8'),originalFrontendFile('app/dapp-kit.ts'));
assert.equal(readFileSync(resolve(source,'package-lock.json'),'utf8'),originalFrontendFile('package-lock.json'));
rmSync(resolve(source,'dist'),{recursive:true,force:true});
run('npm',['run','build','--','--base',base],source);
run('node',[resolve(root,'scripts/verify-treeforce89-staged-assets.mjs'),resolve(source,'dist'),base]);
rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
const output=resolve(stage,'play/treeforce89');cpSync(resolve(source,'dist'),output,{recursive:true});
styleTreeForceGateway(output,{base});
const files=[];
function walk(dir,rel=''){
 for(const name of readdirSync(dir)){
  const path=join(dir,name),relative=join(rel,name);
  if(statSync(path).isDirectory()){walk(path,relative);continue;}
  assert(!/(?:review(?:-engine)?\.|flight-lab|node_modules|\.netlify|functions|migrations)/i.test(relative),'Test/server files must not enter the overlay');
  const bytes=readFileSync(path);
  if(/\.(?:html|css|js)$/.test(relative)){
   assert(!/\/play\/treeforce89\/flight-lab\//.test(bytes.toString()),'Preview asset base in canonical output');
   assert(!/FLIGHT TEST · 0\.6|v0\.6\.0 · gameplay preview/.test(bytes.toString()),'Preview label in canonical output');
  }
  files.push({path:base+relative,source:path,sha:sha('sha1',bytes),sha256:sha('sha256',bytes),bytes:bytes.length});
 }
}
walk(output);files.sort((a,b)=>a.path.localeCompare(b.path));
for(const [path,hash] of Object.entries(provenance.assets))assert.equal(files.find(f=>f.path===base+path)?.sha256,hash,'Original art changed');
const manifest={kind:'frontend-overlay',notDeployableStandalone:true,requiresCurrentLiveInventory:true,
 siteId:'aa62f324-b880-47d6-85b8-4ba0700ff5bf',expectedProduction,approvedGameplayCommit,
 approvedPreview:null,base,requiredFunctions:43,requiredSchedules:5,
 backendBuilt:false,environmentChanges:false,migrationsIncluded:false,
 walletConfigurationUnchanged:true,dependencyLockUnchanged:true,files};
writeFileSync(resolve(stage,'release-input.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({prepared:true,publicFiles:files.length,base,expectedProduction,
 backendBuilt:false,protectedInventoryStillRequired:true,productionChanged:false}));
