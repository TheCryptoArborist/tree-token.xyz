import {readFileSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const snapshot=resolve(import.meta.dirname,'../../treeforce89/pinned-frontend');
export const provenance=JSON.parse(readFileSync(resolve(snapshot,'provenance.json')));
export function originalFrontendFile(path){
 assert(Object.hasOwn(provenance.files,path),'Unpinned source file');const bytes=readFileSync(resolve(snapshot,path));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.files[path],'Pinned frontend bytes changed: '+path);
 return bytes.toString('utf8');
}
export async function stagePinnedFrontend(source,{assetOrigin='https://tree-token.xyz'}={}){
 assert(['https://tree-token.xyz','https://6aec00c92d9060d410e986e0--tree-token.netlify.app'].includes(assetOrigin),'Unreviewed art origin');
 for(const path of Object.keys(provenance.files)){
  const text=originalFrontendFile(path),target=resolve(source,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,text);
 }
 for(const [path,hash] of Object.entries(provenance.assets)){
  const target=resolve(source,'public',path);let bytes;
  try{bytes=readFileSync(target);if(createHash('sha256').update(bytes).digest('hex')!==hash)bytes=undefined;}catch{}
  if(!bytes){const response=await fetch(assetOrigin+'/play/treeforce89/'+path,{signal:AbortSignal.timeout(45000)});assert.equal(response.status,200,'Public game art unavailable: '+path);bytes=Buffer.from(await response.arrayBuffer());}
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Published game art differs from pinned source: '+path);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
 }
}
