// Read-only focused static audit. Not a full production inventory or deploy permission.
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
export const releaseCommit='b052f377494d238679525c91c47276c0c588fa33';
const hash=(b,algorithm='sha256')=>createHash(algorithm).update(b).digest('hex');
export function staticReferences(text,base){
 const refs=new Set();
 const add=value=>{const u=new URL(value,'https://tree-token.xyz'+base);if(u.origin==='https://tree-token.xyz'&&!u.search&&!u.hash&&(/\.(?:m?js|css)$/.test(u.pathname))&&(u.pathname.startsWith('/play/treeforce89/')||u.pathname.startsWith('/scripts/')))refs.add(u.pathname);};
 if(base.endsWith('.html'))for(const m of text.matchAll(/(?:src|href)=["']([^"']+)["']/g))add(m[1]);
 else for(const m of text.matchAll(/["'`]((?:\.\.?\/|\/)[^"'`\s\\$]+\.m?js)["'`]/g))add(m[1]);
 return [...refs].sort();
}
export function compareStatic(bytes,expected){return {sha1:hash(bytes,'sha1'),sha256:hash(bytes),bytes:bytes.length,matchesRecordedRelease:typeof expected==='string'&&hash(bytes,'sha1')===expected};}
export async function auditNativeFrontend({read=async p=>{const response=await fetch('https://tree-token.xyz'+p,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`static-read-failed:${p}:${response.status}`);return Buffer.from(await response.arrayBuffer());}}={}){
 const plan=JSON.parse(execFileSync('git',['show',`${releaseCommit}:production/treeforce-main-r18/candidate.json`],{encoding:'utf8'}));
 const entry='/play/treeforce89/index.html',first=await read(entry),queue=[entry],seen=new Set(),records=[];
 while(queue.length){const p=queue.shift();if(seen.has(p))continue;if(seen.size>=100)throw Error('static-reference-limit');seen.add(p);
  const bytes=p===entry?first:await read(p),record={path:p,...compareStatic(bytes,plan.files[p])};
  if(plan.payload[p]){const committed=execFileSync('git',['show',`${releaseCommit}:production/treeforce-main-r18${p}`],{maxBuffer:16*1024*1024});record.matchesCommittedPayload=hash(committed)===record.sha256;}
  records.push(record);queue.push(...staticReferences(bytes.toString('utf8'),p));
 }
 const stableEntry=hash(await read(entry))===hash(first),matches=stableEntry&&records.every(r=>r.matchesRecordedRelease&&r.matchesCommittedPayload!==false);
 return {checkedAt:new Date().toISOString(),readOnly:true,releaseCommit,recordedReleaseDeploy:'6b06668752cda878be6a57e9',entryStable:stableEntry,focusedStaticMatch:matches,records,referenceScope:'HTML and literal local module references; not a complete runtime asset graph',fullLiveInventoryChecked:false,currentDeployIdentityChecked:false,nativeTsxSourceCommit:'4cd2119a3fefc3b6078befd01ad4f63fb74a695a',nativeTsxReproducesLiveFrontend:false,candidatePublicationAllowed:false,reason:'r18 uses a captured-bundle transformation lineage; pinned TSX rebuild parity is not established'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await auditNativeFrontend();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');else console.log(JSON.stringify(result,null,2));if(!result.focusedStaticMatch)process.exitCode=1;
}
