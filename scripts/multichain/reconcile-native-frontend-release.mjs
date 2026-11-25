// Focused read-only reconciliation; never normalizes or rewrites served assets.
import {auditNativeFrontend} from './check-native-frontend-release.mjs';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
export const emojiCommit='ade51f373946afa4a3c16811b54de15fec99e368';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function classify(record,{emojiSha,historicalEntrySha}){
 if(record.matchesRecordedRelease&&record.matchesCommittedPayload!==false)return 'recorded-static-match';
 if(record.path==='/scripts/treeforce-season-r18.mjs'&&record.sha256===emojiSha)return 'documented-emoji-release';
 if(record.path==='/play/treeforce89/index.html'&&record.sha256===historicalEntrySha)return 'matches-historical-served-html';
 return 'unexplained';
}
async function read(url){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('static-read-failed:'+r.status);return Buffer.from(await r.arrayBuffer());}
export async function reconcileNativeFrontend(){
 const audit=await auditNativeFrontend(),emoji=execFileSync('git',['show',`${emojiCommit}:production/treeforce-festive-emojis/scripts/treeforce-season-r18.mjs`]);
 const historicalUrl='https://6b06668752cda878be6a57e9--tree-token.netlify.app/play/treeforce89/index.html';
 const [historical,current]=await Promise.all([read(historicalUrl),read('https://tree-token.xyz/play/treeforce89/index.html')]);
 const evidence={emojiSha:sha(emoji),historicalEntrySha:sha(historical)};
 const records=audit.records.map(r=>({...r,classification:classify(r,evidence)}));
 const entryStable=audit.entryStable&&sha(current)===audit.records.find(r=>r.path==='/play/treeforce89/index.html').sha256;
 return {checkedAt:new Date().toISOString(),readOnly:true,recordedReleaseCommit:audit.releaseCommit,emojiCommit,historicalUrl,historicalServedSha256:evidence.historicalEntrySha,entryStable,focusedDifferencesExplained:entryStable&&records.every(r=>r.classification!=='unexplained'),records,fullInventoryChecked:false,currentDeployIdentityChecked:false,tsxRebuildParity:false,publicationAllowed:false,limitations:['Historical URL is served evidence, not proof of the cause of HTML transformation.','Literal static references are not a full runtime graph.','Explained asset differences do not reproduce r18 from the older TSX source.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=await reconcileNativeFrontend();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(r,null,2)+'\n');else console.log(JSON.stringify(r,null,2));if(!r.focusedDifferencesExplained)process.exitCode=1;
}
