import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {loadBaseline,fingerprint} from './capture-production-inventory.mjs';import {digest,storedEntry} from './prepare-preserved-candidate.mjs';
const baseline=loadBaseline('docs/treeforce89-hosted-wing-fix/inventory/baseline.json');
const root='production/treeforce-wing-r22',base='/play/treeforce89/assets/',review='/play/treeforce89/review/arborwing/index.html';const files={...baseline.files},payload={};
async function put(p,bytes){bytes=Buffer.from(bytes);if(p!==review)assert(!Object.hasOwn(files,p));payload[p]={sha1:digest(bytes,'sha1'),sha256:digest(bytes),bytes:bytes.length};files[p]=payload[p].sha1;await fs.mkdir(path.dirname(root+p),{recursive:true});await fs.writeFile(root+p,bytes)}
const names=['index-review','arcade-review','graphql-review'];
for(const name of names){const p=base+name+'-r21.js';let s=await fs.readFile('production/treeforce-arborwing-r21'+p,'utf8');assert.equal(digest(Buffer.from(s),'sha1'),baseline.files[p],'Source drift '+p);for(const n of names)s=s.replaceAll(n+'-r21.js',n+'-r22.js');if(name==='arcade-review'){
 const once=(a,b)=>{assert.equal(s.split(a).length,2);s=s.replace(a,b)};
 s='import {arborwingMount} from "./arborwing-mounts-r22.mjs";\n'+s;
 once('branchMount(){return[','branchMount(){const mount=arborwingMount(this);if(mount)return mount;return[');
 once('i.setActive(!0).setVisible(!0).setDepth(3).setTexture(t.projectile)','i.setActive(!0).setVisible(!0).setDepth(arborwingMount(this)?5:3).setTexture(t.projectile)');
 }await put(base+name+'-r22.js',s)}
await put(base+'arborwing-mounts-r22.mjs',await fs.readFile('treeforce89/frontend/game/arborwing-mounts.mjs'));
const response=await fetch(`https://${baseline.deployId}--tree-token.netlify.app${review}`,{redirect:'error'});assert.equal(response.status,200);const html=storedEntry(Buffer.from(await response.arrayBuffer()),baseline.files[review]).toString();assert.equal(html.split('index-review-r21.js').length,2);await put(review,html.replace('index-review-r21.js','index-review-r22.js'));
const plan={baseline,files,payload,previousEntries:{[review]:baseline.files[review]},sourceCommit:'a7c1dca'};await fs.writeFile(root+'/candidate.json',JSON.stringify(plan,null,2));await fs.writeFile(root+'/candidate.json.sha256',fingerprint(plan)+'\n');console.log({changed:1,added:4,total:Object.keys(files).length});
