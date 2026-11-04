// Build only the native frontend. Published function packages are reused separately.
import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {applyPaidContinue} from './apply-treeforce89-paid-continue.mjs';
import {styleTreeForceGateway} from './style-treeforce89-gateway.mjs';
import {originalFrontendFile,provenance} from './lib/treeforce89-pinned-frontend.mjs';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'.netlify/treeforce89-flight-source');
const stage=resolve(root,'.netlify/treeforce89-flight-lab');
const pin='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
assert.equal(provenance.commit,pin);
applyPaidContinue(source);
writeFileSync(resolve(source,'app/game/gateway-client.mjs'),originalFrontendFile('app/game/gateway-client.mjs')
 .replaceAll('/.netlify/functions/tree-','/play/treeforce89/api/tree-'));
rmSync(resolve(source,'dist'),{recursive:true,force:true});
execFileSync('npm',['run','build','--','--base','/play/treeforce89/flight-lab/'],{cwd:source,stdio:'inherit'});
execFileSync('node',[resolve(root,'scripts/verify-treeforce89-staged-assets.mjs'),resolve(source,'dist'),'/play/treeforce89/flight-lab/'],{cwd:root,stdio:'inherit'});
rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
cpSync(resolve(source,'dist'),resolve(stage,'play/treeforce89'),{recursive:true});
styleTreeForceGateway(resolve(stage,'play/treeforce89'),{base:'/play/treeforce89/flight-lab/'});
const files=[];
function walk(dir,rel=''){for(const name of readdirSync(dir)){
 const path=join(dir,name),relative=join(rel,name);if(statSync(path).isDirectory())walk(path,relative);
 else files.push({path:'/play/treeforce89/flight-lab/'+relative,source:path,sha:createHash('sha1').update(readFileSync(path)).digest('hex')});
}}
walk(resolve(stage,'play/treeforce89'));
writeFileSync(resolve(stage,'release-input.json'),JSON.stringify({files},null,2));
console.log(JSON.stringify({publicFiles:files.length,sourcePin:pin,dependenciesUnchanged:true,backendNotBuilt:true}));
