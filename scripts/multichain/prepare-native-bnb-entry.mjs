// Offline candidate generator. Never edits a checkout or publishes files.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
export const nativeEntry={commit:'4cd2119a3fefc3b6078befd01ad4f63fb74a695a',path:'treeforce89/frontend/ContinuationReview.tsx',sha256:'15cd42e329a8c09490c6732b474a37d7d8b863d781e1703e813915256a395177'};
const adapter=`
// Explicit opt-in for source review. Existing callers use NativeContinuationReview.
export default function ContinuationReview(props:any) {
 const {bnbReview,...nativeProps}=props;
 return bnbReview ? <BnbContinuationReview options={bnbReview} onClose={props.onClose} /> : <NativeContinuationReview {...nativeProps} />;
}
function BnbContinuationReview({options,onClose}:{options:any;onClose:()=>void}) {
 const root=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  if(!root.current)return;
  const mounted=mountNativeBnbReview({...options,root:root.current});
  return()=>mounted.destroy();
 },[options]);
 return <section aria-label="BNB continue review"><h2>Review a BNB-paid continue</h2><p>1 USDT per continue. Payments are disabled during this review.</p><div ref={root}/><button type="button" onClick={onClose}>Close review</button></section>;
}
`;
export function patchNativeEntry(source){
 if(createHash('sha256').update(source).digest('hex')!==nativeEntry.sha256)throw Error('native-entry-changed-rebase-required');
 return source.replace('export default function ContinuationReview(', 'function NativeContinuationReview(').replace('"use client";', '"use client";\nimport {mountNativeBnbReview} from \'./bnb-review/native-bnb-review-mount.mjs\';')+adapter;
}
export function prepareNativeBnbEntry(output){
 const source=execFileSync('git',['show',`${nativeEntry.commit}:${nativeEntry.path}`],{encoding:'utf8'}),patched=patchNativeEntry(source);
 // A fresh directory is mandatory: no overwrite of local/native/production work.
 fs.mkdirSync(output);const target=path.join(output,'treeforce89/frontend');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'ContinuationReview.tsx'),patched);
 const browserDir=fileURLToPath(new URL('./browser/',import.meta.url)),dest=path.join(target,'bnb-review');fs.mkdirSync(dest);
 const modules=['native-bnb-review-mount.mjs','native-continue-transport.mjs','bnb-review-wallets.mjs','bnb-connected-review.mjs','bnb-checkout-review.mjs'];for(const name of modules)fs.copyFileSync(path.join(browserDir,name),path.join(dest,name));
 const receipt={sourceOnly:true,deployable:false,source:nativeEntry,legacyDefault:true,modules,entrySha256:createHash('sha256').update(patched).digest('hex')};fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error('usage: node prepare-native-bnb-entry.mjs NEW_OUTPUT_DIRECTORY');
 console.log(JSON.stringify(prepareNativeBnbEntry(path.resolve(process.argv[2])),null,2));
}
