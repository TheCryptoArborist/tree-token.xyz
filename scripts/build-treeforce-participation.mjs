// Reproduce the exact published frontend before building a participation-only overlay.
// Usage: node scripts/build-treeforce-participation.mjs baseline|candidate ISOLATED_SOURCE EMPTY_OUTPUT
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {resolve,sep,join} from 'node:path';
import {applyPaidContinue} from '../vendor/treeforce-participation/integration/scripts/apply-treeforce89-paid-continue.mjs';
import {styleTreeForceGateway} from '../vendor/treeforce-participation/integration/scripts/style-treeforce89-gateway.mjs';
import {applyParticipation} from '../vendor/treeforce-participation/apply-participation.mjs';

const root=resolve(import.meta.dirname,'..');
const [mode,sourceArgument,outputArgument]=process.argv.slice(2);
assert(['baseline','candidate'].includes(mode)&&sourceArgument&&outputArgument,'Provide mode, isolated source checkout, and empty output directory.');
const source=resolve(sourceArgument),output=resolve(outputArgument);
const sourcePin='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
const vendor=resolve(root,'vendor/treeforce-participation');
const integration=JSON.parse(readFileSync(resolve(vendor,'integration/provenance.json'),'utf8'));
const baseline=JSON.parse(readFileSync(resolve(vendor,'baseline.json'),'utf8'));
assert(source!==root&&!source.startsWith(root+sep),'Use an isolated original-game checkout outside the TREE Token repository.');
assert(output!==source&&!output.startsWith(source+sep)&&!source.startsWith(output+sep),'Keep output separate from the original source checkout.');
assert(output!==root&&(!output.startsWith(root+sep)||output.startsWith(resolve(root,'.netlify')+sep)),'Generated staging output may use only an isolated directory or .netlify.');
assert(!existsSync(output)||readdirSync(output).length===0,'Output must be new or empty; never overwrite an earlier review build.');
const digest=(kind,bytes)=>createHash(kind).update(bytes).digest('hex');
const original=path=>execFileSync('git',['show',sourcePin+':'+path],{cwd:source,stdio:['ignore','pipe','pipe']});
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),sourcePin,'Original game source pin changed.');
assert.equal(integration.repository,'TheCryptoArborist/tree-token.xyz');
assert.equal(integration.commit,'4cd2119a3fefc3b6078befd01ad4f63fb74a695a');
assert.equal(baseline.recordedDeploy,'6ae65d956e30582ff6f5baa2');
assert.equal(baseline.rows.length,13);
for(const file of integration.files)
 assert.equal(digest('sha256',readFileSync(resolve(vendor,'integration',file.path))),file.sha256,'Recovered integration source changed: '+file.path);
for(const path of ['package.json','package-lock.json','app/dapp-kit.ts'])
 assert.deepEqual(readFileSync(resolve(source,path)),original(path),'Pinned wallet/dependency input changed: '+path);
assert(existsSync(resolve(source,'node_modules/vite/package.json')),'Install the exact original dependency lock in the isolated checkout first.');

function build(){
 rmSync(resolve(source,'dist'),{recursive:true,force:true});
 execFileSync('npm',['run','build','--','--base','/play/treeforce89/'],{cwd:source,stdio:'inherit'});
 styleTreeForceGateway(resolve(source,'dist'));
}
function inventory(directory){
 const files=[];
 function walk(dir,rel=''){
  for(const name of readdirSync(dir).sort()){
   const path=join(dir,name),suffix=join(rel,name);
   if(statSync(path).isDirectory())walk(path,suffix);
   else{
    const bytes=readFileSync(path),publicPath='/play/treeforce89/'+suffix.split(sep).join('/');
    files.push({path:publicPath.toLowerCase(),source:publicPath.slice(1),sha1:digest('sha1',bytes),size:bytes.length});
   }
  }
 }
 walk(directory);return files.sort((a,b)=>a.path.localeCompare(b.path));
}

// Each build starts from the exact same recovered integration. The game source
// helper resets the engine from its Git pin before applying the old overlays.
applyPaidContinue(source);
for(const name of ['gateway-client.mjs','continuation-review-client.mjs'])
 writeFileSync(resolve(source,'app/game',name),original('app/game/'+name).toString('utf8')
  .replaceAll('/.netlify/functions/tree-','/play/treeforce89/api/tree-'));
build();
const reproduced=inventory(resolve(source,'dist'));
assert.equal(reproduced.length,13,'Unexpected native baseline inventory.');
for(const file of reproduced){
 const expected=baseline.rows.find(row=>row.path.toLowerCase()===file.path);
 assert(expected&&file.sha1===expected.sha1&&file.size===expected.bytes,'Native baseline does not reproduce: '+file.path);
}

const protectedPaths=['app/dapp-kit.ts','package.json','package-lock.json','app/ContinuationDialog.tsx','app/ContinuationReview.tsx','app/WalletPicker.tsx',
 'app/game/gateway-client.mjs','app/game/continuation-review-client.mjs','app/game/authorized-continue-resume.mjs',
 'paid/client.mjs','paid/contract.mjs','paid/receipt-discovery.mjs','paid/wallet-options.mjs'];
const protectedHashes=new Map(protectedPaths.map(path=>[path,digest('sha256',readFileSync(resolve(source,path)))]));
const originalGateway=readFileSync(resolve(source,'app/NFTreeGateway.tsx'),'utf8');
if(mode==='candidate'){
 applyParticipation(source,root);
 const nextGateway=readFileSync(resolve(source,'app/NFTreeGateway.tsx'),'utf8');
 for(const [from,to] of [['  const verify=','  const disconnect='],['  const disconnect=','  const restart='],
  ['  const restart=','  const continuePaid='],['  const continuePaid=','  if(session &&']]){
  const section=text=>{assert(text.includes(from)&&text.includes(to));return text.slice(text.indexOf(from),text.indexOf(to));};
  assert.equal(section(nextGateway),section(originalGateway),'Existing wallet/payment action changed: '+from);
 }
 build();
}
for(const [path,sha256] of protectedHashes)
 assert.equal(digest('sha256',readFileSync(resolve(source,path))),sha256,'Existing wallet/payment module changed: '+path);

mkdirSync(output,{recursive:true});
cpSync(resolve(source,'dist'),resolve(output,'public'),{recursive:true});
const files=inventory(resolve(output,'public'));
const publicFiles=files.filter(file=>baseline.rows.find(row=>row.path.toLowerCase()===file.path)?.sha1!==file.sha1);
if(mode==='candidate'){
 assert(publicFiles.some(file=>file.path==='/play/treeforce89/index.html'),'Candidate must update its entry HTML.');
 for(const file of publicFiles)
  assert(file.path==='/play/treeforce89/index.html'||(!baseline.rows.some(row=>row.path.toLowerCase()===file.path)&&
   /^\/play\/treeforce89\/assets\/(?:index|arcade|graphql)-[a-z0-9_-]+\.(?:js|css)$/.test(file.path)),
   'Unexpected new or changed native public file: '+file.path);
}
const sourcePaths=[...integration.files.map(file=>'vendor/treeforce-participation/integration/'+file.path),
 'vendor/treeforce-participation/integration/provenance.json','vendor/treeforce-participation/baseline.json',
 'vendor/treeforce-participation/apply-participation.mjs','scripts/build-treeforce-participation.mjs',
 ...['CanopyGame.tsx','NFTreeGateway.tsx','participation-client.mjs','participation.css'].map(name=>'treeforce89/frontend/'+name)].sort();
const report={version:1,baselineDeploy:baseline.recordedDeploy,
 originalSource:{repository:'TheCryptoArborist/treeforce89',commit:sourcePin},
 integrationSource:{repository:integration.repository,commit:integration.commit},
 baselineNativeFiles:baseline.rows.map(file=>({path:file.path.toLowerCase(),sha1:file.sha1,size:file.bytes})).sort((a,b)=>a.path.localeCompare(b.path)),
 sourceFiles:sourcePaths.map(path=>({path,sha256:digest('sha256',readFileSync(resolve(root,path)))})),publicFiles,
 build:{baselineExact:true,baselineFilesMatched:13,packageLockSha256:digest('sha256',original('package-lock.json')),
  nodeVersion:process.versions.node,paymentModulesUnchanged:true}};
writeFileSync(resolve(output,'frontend-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode,baselineExact:true,baselineFilesMatched:13,publicFiles:publicFiles.map(({path,sha1,size})=>({path,sha1,size})),
 output,manifest:resolve(output,'frontend-manifest.json'),existingWalletAndPaymentInputsUnchanged:true}));
