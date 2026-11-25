import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {loadBaseline,fingerprint} from './capture-production-inventory.mjs';import {digest,storedEntry} from './prepare-preserved-candidate.mjs';
const baseline=loadBaseline('docs/treeforce89-pilot-cabinet/inventory/baseline.json');
const root='production/treeforce-pilot-r19',overlay='release/treeforce-pilot-cabinet',entry='/play/treeforce89/index.html';
const manifest=JSON.parse(await fs.readFile(overlay+'/overlay-manifest.json','utf8'));
for(const name of ['index-review','arcade-review','graphql-review','holiday-mode','sound-identity']){
 const p='/play/treeforce89/assets/'+name+'-r18.js';assert.equal(digest(await fs.readFile('production/treeforce-main-r18'+p),'sha1'),baseline.files[p],`Deployed source changed: ${p}`);
}
const response=await fetch(`https://${baseline.deployId}--tree-token.netlify.app${entry}`,{redirect:'error'});assert.equal(response.status,200);
const original=storedEntry(Buffer.from(await response.arrayBuffer()),baseline.files[entry]).toString();
assert.equal(original.split('/assets/index-review-r18.js').length,2);assert.equal(original.split('</head>').length,2);
const html=original.replace('/assets/index-review-r18.js','/assets/index-review-r19.js').replace('</head>','  <link rel="stylesheet" href="/play/treeforce89/pilot-cabinet-r19.css">\n  <link rel="stylesheet" href="/play/treeforce89/desktop-r19.css">\n  </head>');
const payload={},files={...baseline.files};
for(const p of Object.keys(manifest.files)){
 const bytes=p===entry?Buffer.from(html):await fs.readFile(overlay+p);
 if(p!==entry){assert(!Object.hasOwn(files,p),`Existing path: ${p}`);assert.equal(digest(bytes),manifest.files[p].sha256);}
 payload[p]={sha1:digest(bytes,'sha1'),sha256:digest(bytes),bytes:bytes.length};files[p]=payload[p].sha1;await fs.mkdir(path.dirname(root+p),{recursive:true});await fs.writeFile(root+p,bytes);
}
const plan={baseline,files,payload,previousEntries:{[entry]:baseline.files[entry]},originals:{[entry]:original}};
await fs.writeFile(root+'/candidate.json',JSON.stringify(plan,null,2));await fs.writeFile(root+'/candidate.json.sha256',fingerprint(plan)+'\n');
console.log({payload:Object.keys(payload).length,total:Object.keys(files).length,changed:1,added:Object.keys(payload).length-1});
