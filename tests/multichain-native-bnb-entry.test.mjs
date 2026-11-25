import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {patchNativeEntry,prepareNativeBnbEntry,nativeEntry} from '../scripts/multichain/prepare-native-bnb-entry.mjs';
import {transform} from '../vendor/continue-browser-test/node_modules/esbuild/lib/main.js';
const source=execFileSync('git',['show',`${nativeEntry.commit}:${nativeEntry.path}`],{encoding:'utf8'});
test('native payment implementation is preserved byte-for-byte inside the opt-in wrapper',()=>{
 const patched=patchNativeEntry(source),legacy=patched.slice(0,patched.indexOf('// Explicit opt-in')).trimEnd()+'\n';
 assert.equal(legacy.replace("import {mountNativeBnbReview} from './bnb-review/native-bnb-review-mount.mjs';\n",'').replace('function NativeContinuationReview(', 'export default function ContinuationReview('),source);
});
test('any upstream entry change requires review rather than overwriting concurrent work',()=>{assert.throws(()=>patchNativeEntry(source+'\n'),/rebase-required/);});
test('actual patched TSX compiles; default and opt-in branches remain separate',async()=>{
 const patched=patchNativeEntry(source);const result=await transform(patched,{loader:'tsx',format:'esm'});assert(result.code.includes('NativeContinuationReview'));assert(result.code.includes('BnbContinuationReview'));assert(result.code.includes('mounted.destroy()'));
});
test('candidate writes only into a fresh directory and includes all mount dependencies',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'bnb-entry-')),out=path.join(parent,'candidate');
 try{const receipt=prepareNativeBnbEntry(out);assert.equal(receipt.deployable,false);assert.equal(receipt.legacyDefault,true);for(const name of receipt.modules)assert(fs.existsSync(path.join(out,'treeforce89/frontend/bnb-review',name)));assert.throws(()=>prepareNativeBnbEntry(out),/EEXIST/);assert.equal(fs.readFileSync(path.join(out,'treeforce89/frontend/ContinuationReview.tsx'),'utf8'),patchNativeEntry(source));}finally{fs.rmSync(parent,{recursive:true,force:true});}
});
test('compiled entry defaults to native checkout; explicit review mounts and cleans up independently',async()=>{
 const wrapper='// Explicit opt-in'+patchNativeEntry(source).split('// Explicit opt-in')[1];
 const {code}=await transform(wrapper,{loader:'tsx',format:'iife',globalName:'Entry',jsxFactory:'h'});
 let mounts=0,destroys=0,cleanup;const root={};const h=(type,props,...children)=>({type,props,children});const Native=()=>{};
 const Entry=new Function('h','NativeContinuationReview','useRef','useEffect','mountNativeBnbReview',code+';return Entry.default;')(h,Native,()=>({current:root}),fn=>{cleanup=fn();},options=>{assert.equal(options.root,root);mounts++;return {destroy(){destroys++;}};});
 const session={wallet:'native'},onContinue=()=>{},onClose=()=>{};
 const ordinary=Entry({session,onContinue,onClose});assert.equal(ordinary.type,Native);assert.equal(ordinary.props.session,session);assert.equal(ordinary.props.onContinue,onContinue);assert.equal(mounts,0);
 const review=Entry({session,onContinue,onClose,bnbReview:{origin:'https://tree-token.xyz'}});assert.notEqual(review.type,Native);const tree=review.type(review.props);assert.equal(mounts,1);assert.equal(tree.children.at(-1).props.onClick,onClose);cleanup();assert.equal(destroys,1);
});
test('real native gateway candidate compiles and preserves default and pending-payment selection',async()=>{
 const {patchNativeGateway,nativeGateway}=await import('../scripts/multichain/prepare-native-bnb-entry.mjs');
 const original=execFileSync('git',['show',`${nativeEntry.commit}:${nativeGateway.path}`],{encoding:'utf8'}),patched=patchNativeGateway(original);
 await transform(patched,{loader:'tsx',format:'esm'});assert.throws(()=>patchNativeGateway(original+'\n'),/rebase-required/);
 assert(patched.includes('bnbOptions&&!loadPendingContinuation(session.wallet)?bnbOptions:undefined'));
 const expression=patched.match(/bnbReview=\{([^}]+)\}/)[1],choose=new Function('loadPendingContinuation','session','bnbOptions','return '+expression),options={};
 assert.equal(choose(()=>true,{wallet:'sui'},options),undefined);assert.equal(choose(()=>null,{wallet:'sui'},options),options);assert.equal(choose(()=>assert.fail('disabled path must not read pending storage'),{wallet:'sui'},undefined),undefined);
 const restored=patched.replace("import {createNativeBnbReviewOptions} from './bnb-review/bnb-native-host-options.mjs';\n",'').replace('useEffect,useMemo,useRef,useState','useEffect,useRef,useState').replace('export default function NFTreeGateway({bnbReviewProvider}:{bnbReviewProvider?:any}={}) {','export default function NFTreeGateway() {').replace(/^  const bnbOptions=.*\n/m,'').replace(' bnbReview={bnbOptions&&!loadPendingContinuation(session.wallet)?bnbOptions:undefined}','');assert.equal(restored,original);
});
