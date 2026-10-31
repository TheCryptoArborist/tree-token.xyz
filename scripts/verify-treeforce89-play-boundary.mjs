import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(readFileSync(resolve(root,'production/manifest.json'),'utf8'));
const protectedPaths=manifest.files.map(f=>f.source);
let checked=0;
for(const entry of manifest.files){
  const bytes=readFileSync(resolve(root,entry.source));
  const sha1=createHash('sha1').update(bytes).digest('hex');
  if(sha1!==entry.sha1)throw Error('Protected production file modified: '+entry.source);
  checked++;
}
for(const fn of manifest.functions.filter(fn=>fn.artifact)){
  const bytes=readFileSync(resolve(root,fn.artifact));
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==fn.sha256)throw Error('Protected production function modified: '+fn.name);
}
if(!protectedPaths.includes('play/index.html'))throw Error('Existing TREE Arcade missing from production manifest');
if(!existsSync(resolve(root,'docs/treeforce89-play-integration.md')))
  throw Error('Native route integration gate documentation missing');
const doc=readFileSync(resolve(root,'docs/treeforce89-play-integration.md'),'utf8');
for(const gate of ['play/treeforce89/','same-origin','database','Slush','disabled']){
  if(!doc.includes(gate))throw Error('Missing integration gate: '+gate);
}
console.log('TREE Arcade integration preflight passed: '+checked+' production files and '+
  manifest.functions.filter(fn=>fn.artifact).length+' archived function packages unchanged.');
console.log('No game artifacts deployed and no production website changed.');
