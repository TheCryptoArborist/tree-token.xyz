// Incremental copy update; leaves every published r16 artifact unchanged.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {replaceOnce} from './prepare-feedback.mjs';
const source=path.resolve('release/treeforce-holiday-r16/candidate');
const out=path.resolve(process.argv[2]||'release/treeforce-holiday-utc-r17');
await fs.mkdir(out);await fs.cp(source,out+'/candidate',{recursive:true});
const assets='/play/treeforce89/assets/',files=[];
const rename=s=>s.replace(/(index-review|arcade-review|graphql-review|sound-identity|holiday-mode)-r16\.js/g,'$1-r17.js');
for(const name of ['index-review','arcade-review','graphql-review','sound-identity','holiday-mode']){
 let body=await fs.readFile(source+assets+name+'-r16.js','utf8');
 if(name==='holiday-mode'){
  body=await fs.readFile('treeforce89/frontend/game/holiday-mode.mjs','utf8');
  const start=body.indexOf('  const localPreview ='),end=body.indexOf('  const policy =',start);
  if(start<0||end<start)throw Error('Clock anchor missing');
  body=body.slice(0,start)+'  const now = () => Date.now();\n'+body.slice(end);
 }
 body=rename(body);const file=assets+name+'-r17.js';
 await fs.mkdir(path.dirname(out+'/payload'+file),{recursive:true});
 await fs.writeFile(out+'/payload'+file,body);await fs.writeFile(out+'/candidate'+file,body);
 files.push({path:file,sha256:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)});
}
const entry='/play/treeforce89/review/holiday/index.html';
const html=replaceOnce(await fs.readFile(source+entry,'utf8'),'index-review-r16.js','index-review-r17.js');
await fs.mkdir(path.dirname(out+'/payload'+entry),{recursive:true});await fs.writeFile(out+'/payload'+entry,html);await fs.writeFile(out+'/candidate'+entry,html);
files.push({path:entry,sha256:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html)});
await fs.writeFile(out+'/plan.json',JSON.stringify({revision:'r17',published:false,scope:'UTC labels only; exact same opening/closing timestamps',files,requiresFreshInventory:true},null,2));
console.log(out);
