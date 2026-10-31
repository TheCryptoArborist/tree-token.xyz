import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {createRequire,Module} from 'node:module';
import {resolve} from 'node:path';
const result=await build({entryPoints:['treeforce89/frontend/ContinuationDialog.tsx'],bundle:true,write:false,
 platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const path=resolve('tests/.continue-dialog-compiled.cjs'),compiled=new Module(path);
compiled.filename=path;compiled.paths=Module._nodeModulePaths(resolve('tests'));compiled._compile(result.outputFiles[0].text,path);
const Dialog=compiled.exports.default;
const noop=()=>{},base={offer:null,pending:null,grant:null,error:'',stage:'',busy:false,manualDigest:'',
 onManualDigest:noop,onClose:noop,onPay:noop,onCheck:noop,onManualCheck:noop,onResume:noop,onRetryCheckout:noop,onUnsubmitted:noop};
const render=props=>renderToStaticMarkup(createElement(Dialog,{...base,...props}));
test('normal checkout exposes the payment action without transaction entry',()=>{
 const html=render({offer:{offerId:'a'}});assert.match(html,/Pay 20,000 TREE &amp; restore lives/);
 assert.doesNotMatch(html,/<input|Resume gameplay|Advanced payment recovery/);
});
test('pending wallet approval never renders receipt recovery fields',()=>{
 const html=render({busy:true,pending:{offerId:'a'},stage:'Approve in your wallet'});
 assert.match(html,/Approve in your wallet/);assert.match(html,/disabled=""[^>]*>Waiting for confirmation/);
 assert.doesNotMatch(html,/<input|Check payment &amp; continue|Resume gameplay/);
});
test('verified payment displays the explicit three-life resume button',()=>{
 const html=render({grant:{authorized:true},pending:{offerId:'a',digest:'C'.repeat(44)}});
 assert.match(html,/PAYMENT CONFIRMED/);assert.match(html,/Resume gameplay · 3 lives/);
 assert.doesNotMatch(html,/<input|Pay 20,000 TREE &amp; restore lives|Check payment &amp; continue/);
});
test('lost wallet response prioritizes automatic checking; manual recovery starts collapsed',()=>{
 const html=render({pending:{offerId:'a'}});assert.match(html,/Check payment &amp; continue/);
 assert.match(html,/<details class="continuation-details"><summary>Advanced payment recovery/);
 assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
});
test('saved receipts can only be checked, with no second pay action',()=>{
 const html=render({pending:{offerId:'a',digest:'C'.repeat(44)}});
 assert.match(html,/Check payment &amp; continue/);assert.doesNotMatch(html,/<input|Pay 20,000 TREE &amp; restore lives|I haven’t paid/);
});
