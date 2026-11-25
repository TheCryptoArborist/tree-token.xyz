// Offline, isolated preservation candidate; never uploads or edits existing files.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const entry='/play/treeforce89/assets/index-review-r19.js';
export const reviewPrefix='/play/treeforce89/review/bnb-preserved';
export function patchPreservedEntry(bytes,expected){
 if(sha(bytes)!==expected)throw Error('entry-drift');const source=bytes.toString('utf8'),anchor='function Ih({session:e,run:t,onClose:n,onContinue:r})';
 if(source.split(anchor).length!==2||source.includes('__BnbNativeIh'))throw Error('checkout-anchor-drift');
 const wrapper='function Ih(p){return (0,S.jsx)(__BnbPreservedCheckout,{React:x,Native:__BnbNativeIh,props:p,kit:ee(),pending:()=>Mh(p.session.wallet),enabled:false})}';
 return Buffer.from('import {PreservedBnbCheckout as __BnbPreservedCheckout} from "./bnb-review/preserved-bnb-checkout.mjs";\n'+source.replace(anchor,wrapper+'function __BnbNativeIh({session:e,run:t,onClose:n,onContinue:r})'));
}
export async function preparePreservedBnbReview(output,{read=async p=>{const r=await fetch('https://tree-token.xyz'+p,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('static-read-failed');return Buffer.from(await r.arrayBuffer());}}={}){
 if(fs.existsSync(output))throw Error('fresh-output-required');
 const report=JSON.parse(fs.readFileSync(new URL('../../docs/multichain/generation-milestone/netlify-gateway/preserved-review-baseline.json',import.meta.url)));
 if(!report.readOnly||!report.entryStable||!Array.isArray(report.records)||!report.records.length)throw Error('stable-baseline-required');
 const files=new Map();for(const record of report.records){const b=await read(record.path);if(sha(b)!==record.sha256)throw Error('baseline-drift:'+record.path);files.set(record.path,b);}
 // Recheck all captured bytes to reject a mixed release, not just the HTML entry.
 for(const [p,b] of files)if(sha(await read(p))!==sha(b))throw Error('concurrent-release:'+p);
 const patch=patchPreservedEntry(files.get(entry),report.records.find(r=>r.path===entry).sha256);
 const htmlPath='/play/treeforce89/index.html',html=files.get(htmlPath).toString('utf8');if(html.split(entry).length!==2)throw Error('html-entry-drift');
 fs.mkdirSync(output);const write=(p,b)=>{const full=path.join(output,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,b);};
 const originals=[];for(const [p,b] of files){write('captured'+p,b);originals.push({path:p,sha256:sha(b),bytes:b.length});if(p.startsWith('/play/treeforce89/assets/'))write('candidate'+reviewPrefix+'/assets/'+path.basename(p),p===entry?patch:b);}
 write('candidate'+reviewPrefix+'/index.html',html.replace(entry,reviewPrefix+'/assets/index-review-r19.js'));
 const modules=['preserved-bnb-checkout.mjs','bnb-native-host-options.mjs','native-bnb-review-mount.mjs','native-continue-transport.mjs','bnb-review-wallets.mjs','bnb-connected-review.mjs','bnb-checkout-review.mjs','bnb-provider-picker.mjs'];
 for(const name of modules)write('candidate'+reviewPrefix+'/assets/bnb-review/'+name,fs.readFileSync(new URL('./browser/'+name,import.meta.url)));
 const result={sourceOnly:true,deployable:false,paymentsEnabled:false,reviewEnabled:false,prefix:reviewPrefix,captured:originals,entryOriginalSha256:sha(files.get(entry)),entryCandidateSha256:sha(patch),fullProductionInventory:false,backendChanged:false,limitations:['Literal reference snapshot is not full runtime asset inventory.','Canonical review depends on preserved existing CSS, shared scripts and other assets.','Actual extension and full game regression testing remain required.']};write('provenance.json',JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.length!==3)throw Error('new-output-directory-required');console.log(JSON.stringify(await preparePreservedBnbReview(path.resolve(process.argv[2])),null,2));}
