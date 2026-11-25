import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {loadBaseline,fingerprint} from './capture-production-inventory.mjs';
import {digest,storedEntry} from './prepare-preserved-candidate.mjs';
import {replaceOnce} from './prepare-feedback.mjs';
const baseline=loadBaseline('docs/treeforce89-main-inventory/baseline.json');
const root='production/treeforce-main-r18';await fs.mkdir(root);
const files={...baseline.files},payload={},originals={};
async function put(name,body){const old=files[name];if(old)assert(['/play/index.html','/play/treeforce89/index.html'].includes(name));else assert(!Object.keys(files).some(p=>p.toLowerCase()===name.toLowerCase()));await fs.mkdir(path.dirname(root+name),{recursive:true});await fs.writeFile(root+name,body);files[name]=digest(body,'sha1');payload[name]={sha1:files[name],sha256:digest(body),bytes:Buffer.byteLength(body)};}
for(const name of ['/play/index.html','/play/treeforce89/index.html']){const r=await fetch(`https://${baseline.deployId}--tree-token.netlify.app`+name);assert.equal(r.status,200);originals[name]=storedEntry(Buffer.from(await r.arrayBuffer()),baseline.files[name]).toString();}
const assets='/play/treeforce89/assets/';const rename=s=>s.replace(/(index-review|arcade-review|graphql-review|sound-identity|holiday-mode)-r17\.js/g,'$1-r18.js');
for(const name of ['index-review','arcade-review','graphql-review','sound-identity','holiday-mode']){
 let body=await fs.readFile('production/treeforce-holiday-utc-r17'+assets+name+'-r17.js','utf8');assert.equal(digest(body,'sha1'),baseline.files[assets+name+'-r17.js']);
 if(name==='holiday-mode'){
 body=await fs.readFile('treeforce89/frontend/game/holiday-mode.mjs','utf8');const a=body.indexOf('  const localPreview ='),b=body.indexOf('  const policy =',a);assert(a>=0&&b>a);body=body.slice(0,a)+'  const now = () => Date.now();\n'+body.slice(b);body=replaceOnce(body,'./holiday-season.mjs','/scripts/treeforce-season-r18.mjs');
 }
 await put(assets+name+'-r18.js',rename(body));
}
await put('/scripts/treeforce-season-r18.mjs',await fs.readFile('treeforce89/frontend/game/holiday-season.mjs'));
await put('/scripts/treeforce-cabinet-holiday-r18.mjs',await fs.readFile('scripts/treeforce-cabinet-holiday-r18.mjs'));
const game=replaceOnce(replaceOnce(originals['/play/treeforce89/index.html'],'/assets/index-share-r4.js','/assets/index-review-r18.js'),'/mobile-r1.css','/mobile-review-r5.css');await put('/play/treeforce89/index.html',game);
const anchor='<p class="poster-description" id="force-description">Pilot the Arborwing. Blast through enemy waves and defend the canopy.</p>';
const box='<div id="treeforce-holiday-cabinet" hidden style="margin:12px 0;padding:10px;border:1px solid #a9c98d;border-radius:8px;background:#102d29;color:#fff7df;font-size:13px;line-height:1.5"><span data-holiday-message role="status"></span><br><span role="timer" aria-live="off" aria-label="Holiday countdown" style="font-variant-numeric:tabular-nums"></span><br><small data-holiday-date></small></div>';
const lobby=replaceOnce(replaceOnce(originals['/play/index.html'],anchor,anchor+'\n'+box),'</head>','<script type="module" src="/scripts/treeforce-cabinet-holiday-r18.mjs"></script>\n</head>');await put('/play/index.html',lobby);
const plan={baseline,files,payload,previousEntries:Object.fromEntries(Object.keys(originals).map(k=>[k,baseline.files[k]])),originals,sourceRevision:'r17',revision:'r18'};
await fs.writeFile(root+'/candidate.json',JSON.stringify(plan,null,2));await fs.writeFile(root+'/candidate.json.sha256',fingerprint(plan)+'\n');console.log({preserved:Object.keys(baseline.files).length-2,changed:2,added:7,total:Object.keys(files).length});
