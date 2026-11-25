// Read-only pinned public assets + local digest candidate; never deploys.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadBaseline,fingerprint} from './capture-production-inventory.mjs';
import {storedEntry} from './prepare-preserved-candidate.mjs';
const baseline=loadBaseline('docs/treeforce89-holiday-inventory/baseline.json');
const root=path.resolve('release/treeforce-holiday-r16');
const plan=JSON.parse(await fs.readFile(root+'/overlay-plan.json','utf8'));
const out=path.resolve(process.argv[2]||'release/treeforce-holiday-preserved');
await fs.mkdir(out);
const sha=(b,a='sha256')=>createHash(a).update(b).digest('hex');
const origin=`https://${baseline.deployId}--tree-token.netlify.app`;
async function read(name){const r=await fetch(origin+name,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,name);return Buffer.from(await r.arrayBuffer());}
const sourceFiles=Object.values(plan.sourceBaseline.files);
await Promise.all(sourceFiles.map(async record=>{
 const bytes=await read(record.path);assert.equal(sha(bytes),record.sha256,'Original game drift: '+record.path);
 const key=Object.hasOwn(baseline.files,record.path)?record.path:record.path.toLowerCase();
 const stored=record.path.endsWith('/index.html')?storedEntry(bytes,baseline.files[key]):bytes;
 assert.equal(sha(stored,'sha1'),baseline.files[key],'Stored source drift: '+record.path);
}));
const files={...baseline.files},payload={};const reused=[];
for(const f of plan.files){
 if(f.path.endsWith('/index.html'))continue;
 const bytes=await fs.readFile(root+'/overlay'+f.path);assert.equal(sha(bytes),f.sha256);
 const existing=Object.keys(files).find(k=>k.toLowerCase()===f.path.toLowerCase());
 if(existing){assert.equal(files[existing],sha(bytes,'sha1'),'Existing path collision: '+f.path);reused.push(existing);continue;}
 files[f.path]=sha(bytes,'sha1');payload[f.path]={sha1:sha(bytes,'sha1'),sha256:sha(bytes),bytes:bytes.length};
 await fs.mkdir(path.dirname(out+'/payload'+f.path),{recursive:true});await fs.writeFile(out+'/payload'+f.path,bytes);
}
const oldReview='/play/treeforce89/review/index.html',route='/play/treeforce89/review/holiday/index.html';
assert(!Object.keys(files).some(k=>k.toLowerCase()===route),'Review route collision');
let html=storedEntry(await read(oldReview),baseline.files[oldReview]).toString();
assert.equal(html.split('/assets/index-review-r15.js').length,2,'Unknown review entry');
html=html.replace('/assets/index-review-r15.js','/assets/index-review-r16.js').replace('TREE FORCE \'89 — Review','TREE FORCE \'89 — Holiday Review');
files[route]=sha(html,'sha1');payload[route]={sha1:sha(html,'sha1'),sha256:sha(html),bytes:Buffer.byteLength(html)};
await fs.mkdir(path.dirname(out+'/payload'+route),{recursive:true});await fs.writeFile(out+'/payload'+route,html);
for(const [name,hash]of Object.entries(baseline.files))assert.equal(files[name],hash);
const candidate={baseline,baselineFingerprint:fingerprint(baseline),files,payload,reused,reviewPath:route,originalGameAssetsVerified:sourceFiles.length,productionChanged:false,backendChanged:false};
await fs.writeFile(out+'/candidate.json',JSON.stringify(candidate,null,2));
await fs.writeFile(out+'/candidate.json.sha256',fingerprint(candidate)+'\n');
console.log(JSON.stringify({preserved:Object.keys(baseline.files).length,added:Object.keys(payload).length,total:Object.keys(files).length,reused:reused.length,originalGameAssetsVerified:sourceFiles.length,functions:baseline.functions.length,schedules:baseline.schedules.length}));
