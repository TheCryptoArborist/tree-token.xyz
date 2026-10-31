// Actual React checkout with a controlled wallet and server; no browser wallet,
// chain writes, NFTree bypass in the application, or real payment.
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from './treeforce89-ui/node_modules/jsdom/lib/api.js';
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {build} from 'esbuild';import {Module} from 'node:module';import {resolve} from 'node:path';
import {TREE_COIN_TYPE,TREE_RECIPIENT} from '../treeforce89/paid/contract.mjs';
const sdk=resolve('netlify/preview-lib/treeforce89-source/node_modules/@mysten/sui/dist');
const built=await build({entryPoints:['treeforce89/frontend/ContinuationReview.tsx'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',
 external:['react','react/jsx-runtime'],alias:{'@mysten/sui/transactions':sdk+'/transactions/index.mjs','@mysten/sui/graphql':sdk+'/graphql/index.mjs'},
 plugins:[{name:'test-wallet',setup(b){b.onResolve({filter:/^@mysten\/dapp-kit-react$/},()=>({path:'wallet',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useDAppKit=()=>globalThis.__checkoutTest.kit; export const useCurrentAccount=()=>globalThis.__checkoutTest.account;'}));}}]});
const path=resolve('tests/.checkout-interaction-compiled.cjs'),compiled=new Module(path);compiled.filename=path;
compiled.paths=Module._nodeModulePaths(resolve('tests'));compiled._compile(built.outputFiles[0].text,path);const Review=compiled.exports.default;
const wallet='0x'+'8'.repeat(64),runId='grove-'+'a'.repeat(32),offerId='b'.repeat(48),digest='C'.repeat(44);
const snapshot={runId,seed:42,score:12500,wave:4,kills:39,perfect:2,maxStage:3,shotsFired:100,shotsHit:60,start:Date.now()-60000,mode:'ARCADE'};
const session={wallet,runId,sessionToken:'d'.repeat(64),expiresAt:Date.now()+600000};
const grant={authorized:true,offerId,digest,runId,lives:3,wave:4,continuationNumber:1,snapshot,session};
const offer={enabled:true,recipientConfirmed:true,offerId,wallet,runId,network:'sui:mainnet',coinType:TREE_COIN_TYPE,
 recipient:TREE_RECIPIENT,price:'20000',lives:3,decimals:6,amountBaseUnits:'20000000000',expiresAt:session.expiresAt};
const originalFetch=globalThis.fetch;
async function setup({recovery=false,reject=false}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://checkout.test'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let approved,signed=0,resumed=0,lookups=0;const account={address:wallet};
 const receipt={$kind:'Transaction',Transaction:{digest,timestampMs:Date.now(),checkpoint:'123',status:{success:true},effects:{status:{success:true}},
  transaction:{sender:wallet},balanceChanges:[{address:TREE_RECIPIENT,coinType:TREE_COIN_TYPE,amount:'20000000000'}]}};
 globalThis.__checkoutTest={account,kit:{stores:{$connection:{get:()=>({account})},$currentClient:{get:()=>({network:'mainnet',core:{
  waitForTransaction:async()=>{},listTransactions:async()=>{lookups++;return {transactions:[receipt],hasNextPage:false};}}})}},
  signAndExecuteTransaction:async({transaction})=>{signed++;assert.equal(typeof transaction.getData,'function');
   if(reject)throw Object.assign(Error('User rejected'),{code:4001});return new Promise(r=>{approved=()=>r({$kind:'Transaction',Transaction:{digest}});});}}};
 globalThis.fetch=async(path,request)=>{assert(String(path).startsWith('/play/treeforce89/api/'));assert.equal(request.headers.Authorization,'Bearer '+session.sessionToken);
  return Response.json(path.endsWith('tree-continue-offer')?offer:grant);};
 if(recovery)window.sessionStorage.setItem('treeforce89-pending-continue:'+wallet,JSON.stringify({wallet,offerId,startedAt:Date.now()-1000}));
 const root=createRoot(document.getElementById('root'));
 function Harness(){const [done,setDone]=React.useState(false);return done?React.createElement('p',{role:'status'},'Gameplay reactivated'):
  React.createElement(Review,{session,run:snapshot,onClose(){},onContinue(value){assert.deepEqual(value,grant);resumed++;setDone(true);return true;}});}
 await act(async()=>{root.render(React.createElement(Harness));});
 const button=text=>[...document.querySelectorAll('button')].find(x=>x.textContent.includes(text));
 const click=async text=>{assert(button(text),'Missing button '+text);await act(async()=>{button(text).dispatchEvent(new window.MouseEvent('click',{bubbles:true}));});};
 return {button,click,approved:async()=>act(async()=>{assert(approved);approved();}),signed:()=>signed,resumed:()=>resumed,lookups:()=>lookups,
  cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;delete globalThis.__checkoutTest;delete globalThis.window;delete globalThis.document;}};
}
test('click pay → wallet waiting → confirmed Resume button → gameplay, without typing a transaction ID',async()=>{
 const h=await setup();try{
  assert.equal(document.querySelector('input'),null);await h.click('Pay 20,000 TREE');
  assert(h.button('Waiting for confirmation').disabled);assert.equal(document.querySelector('input'),null);assert.equal(h.resumed(),0);
  await h.approved();assert(h.button('Resume gameplay · 3 lives'));assert.equal(h.resumed(),0);assert.equal(h.signed(),1);
  await h.click('Resume gameplay');assert.equal(h.resumed(),1);assert.match(document.body.textContent,/Gameplay reactivated/);
  assert.equal(window.sessionStorage.length,0);
 }finally{await h.cleanup();}
});
test('a saved offer without a transaction ID is found and resumed by buttons only, without signing again',async()=>{
 const h=await setup({recovery:true});try{
  const details=document.querySelector('details');assert(details&&!details.open);assert(h.button('Check payment & continue'));
  await h.click('Check payment & continue');assert.equal(h.signed(),0);assert.equal(h.lookups(),1);assert(h.button('Resume gameplay'));
  await h.click('Resume gameplay');assert.equal(h.resumed(),1);assert.equal(window.sessionStorage.length,0);
 }finally{await h.cleanup();}
});
test('cancelling wallet approval returns to the pay button and never enables gameplay',async()=>{
 const h=await setup({reject:true});try{
  await h.click('Pay 20,000 TREE');assert(h.button('Pay 20,000 TREE'));assert(!h.button('Resume gameplay'));
  assert.equal(document.querySelector('input'),null);assert.equal(h.resumed(),0);assert.equal(window.sessionStorage.length,0);
 }finally{await h.cleanup();}
});
