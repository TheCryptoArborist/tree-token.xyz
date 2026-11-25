// Versioned frontend review overlay. No site/backend build or publication.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {replaceOnce} from './prepare-feedback.mjs';
const baseline=path.resolve(process.argv[2]||'release/treeforce-impact-effects');
const output=path.resolve(process.argv[3]||'release/treeforce-holiday-r16');
if(output===baseline||output.startsWith(baseline+path.sep))throw Error('Separate output required');
await fs.mkdir(output);
const scratch=output+'/experiment';
execFileSync(process.execPath,['scripts/treeforce-local/prepare-christmas.mjs',baseline,scratch]);
const review=JSON.parse(await fs.readFile(baseline+'/review.json','utf8'));
const assets='/play/treeforce89/assets/';const overlay=output+'/overlay';const files=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function put(name,bytes){await fs.mkdir(path.dirname(overlay+name),{recursive:true});await fs.writeFile(overlay+name,bytes);files.push({path:name,sha256:hash(bytes),bytes:Buffer.byteLength(bytes)});}
// Reuse existing reviewed modules byte-for-byte. New code gets new names.
for(const name of Object.keys(review.changed))await put(name,await fs.readFile(baseline+name));
const rename=s=>s.replaceAll('christmas-look-local.js','christmas-look-r16.js').replaceAll('christmas-audio-local.js','christmas-audio-r16.js').replaceAll('holiday-mode-local.js','holiday-mode-r16.js').replaceAll('sound-identity-r10.js','sound-identity-r16.js').replace(/(index|arcade|graphql)-review-r15\.js/g,'$1-review-r16.js');
for(const name of ['index-review-r15.js','arcade-review-r15.js','graphql-review-r15.js','sound-identity-r10.js','christmas-look-local.js','christmas-audio-local.js','holiday-mode-local.js']){
 let body=await fs.readFile(scratch+assets+name,'utf8');
 if(name==='holiday-mode-local.js'){
  const start=body.indexOf('  const localPreview ='),end=body.indexOf('  const policy =',start);
  if(start<0||end<start)throw Error('Preview clock anchor missing');
  body=body.slice(0,start)+'  const now = () => Date.now();\n'+body.slice(end);
 }
 await put(assets+rename(name),rename(body));
}
let html=await fs.readFile(baseline+'/play/treeforce89/index.html','utf8');
html=replaceOnce(html,'/assets/index-review-r15.js','/assets/index-review-r16.js');
await put('/play/treeforce89/index.html',html);
const plan={revision:'r16',productionRelease:false,completeSiteInventory:false,sourceBaseline:review.source,files,season:{start:'2026-11-27T00:00:00-06:00',end:'2027-01-01T00:00:00-06:00'},backendChanges:0,previewClockRemoved:true,requires:['Fresh production inventory and path-collision verification','Current multichain integration review','Canonical-domain owner phone review','Separate publication authorization']};
await fs.writeFile(output+'/overlay-plan.json',JSON.stringify(plan,null,2));
console.log(JSON.stringify({output,files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0)}));
