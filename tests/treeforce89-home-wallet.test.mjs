import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from './treeforce89-ui/node_modules/jsdom/lib/api.js';
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {build} from 'esbuild';import {Module} from 'node:module';import {resolve} from 'node:path';
import {missingWalletOptions,WALLET_OPTIONS} from '../treeforce89/paid/wallet-options.mjs';
const result=await build({entryPoints:['treeforce89/frontend/WalletPicker.tsx','treeforce89/frontend/NFTreeGateway.tsx'],bundle:true,write:false,outdir:'memory',platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'controlled-wallet-and-auth',setup(b){
 b.onResolve({filter:/^@mysten\/dapp-kit-react$/},()=>({path:'wallet',namespace:'controlled'}));
 b.onResolve({filter:/^\.\/game\/authorized-continue-resume\.mjs$/},()=>({path:resolve('treeforce89/paid/authorized-continue-resume.mjs')}));
 b.onResolve({filter:/^\.\/CanopyGame$/},()=>({path:'game',namespace:'controlled'}));
 b.onResolve({filter:/^\.\/game\/gateway-client\.mjs$/},()=>({path:'auth',namespace:'controlled'}));
 b.onResolve({filter:/^\.\/ContinuationReview$/},()=>({path:'checkout',namespace:'controlled'}));
 b.onLoad({filter:/.*/,namespace:'controlled'},args=>({contents:args.path==='wallet'?`export const useDAppKit=()=>globalThis.__homeWallet.kit;export const useWallets=()=>globalThis.__homeWallet.wallets;export const useCurrentAccount=()=>globalThis.__homeWallet.account;export const useWalletConnection=()=>({status:'disconnected'});`:
  args.path==='game'?`import React from 'react';export default function Game(p){globalThis.__homeWallet.gameProps=p;return React.createElement('div',{'data-testid':p.homeOnly?'public-home':'playable-game'},p.homeOnly?'Public game title':'Verified gameplay');}`:
  args.path==='checkout'?`export default function Checkout(){return null;}`:
  `export const isGatewaySessionCurrent=()=>true;export const authenticateGateway=()=>globalThis.__homeWallet.authenticate();export const revokeGatewaySession=async()=>{};export const restartGatewayRun=async()=>{};` }));
}}]});
const compile=name=>{const p=resolve('tests/.'+name+'.cjs'),m=new Module(p);m.filename=p;m.paths=Module._nodeModulePaths(resolve('tests'));
 m._compile(result.outputFiles.find(f=>f.path.endsWith('/'+name+'.js')).text,p);return m.exports.default;};
const Picker=compile('WalletPicker'),Gateway=compile('NFTreeGateway');
const wallet='0x'+'8'.repeat(64),session={wallet,runId:'grove-'+'a'.repeat(32),sessionToken:'d'.repeat(64),expiresAt:Date.now()+600000};
const fakeWallet=name=>({id:name.toLowerCase(),name,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'});
async function setup({wallets=[],connected=false,connect,authenticate=async()=>session,component=Picker}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://home.test'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
 let calls=[];const account=connected?{address:wallet}:null;
 globalThis.__homeWallet={wallets,account,authenticate,kit:{connectWallet:async({wallet:w})=>{calls.push(w);return connect?connect(w):{accounts:[]};},disconnectWallet:async()=>{},
  stores:{$connection:{get:()=>({account})}},signPersonalMessage:()=>{throw Error('Unit auth never signs');},signAndExecuteTransaction:()=>{throw Error('Connection must not pay');}}};
 const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(component)));
 const button=text=>[...document.querySelectorAll('button')].find(e=>e.textContent.includes(text));
 const click=async text=>{assert(button(text),'Missing button '+text);await act(async()=>button(text).dispatchEvent(new window.MouseEvent('click',{bubbles:true})));};
 return {click,calls,cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();delete globalThis.__homeWallet;delete globalThis.window;delete globalThis.document;}};
}
test('wallet choices have official install destinations and do not duplicate detected names',()=>{
 assert.deepEqual(WALLET_OPTIONS.map(x=>x.name),['Slush','Suiet','Nightly','Backpack']);
 assert.equal(missingWalletOptions([fakeWallet('Slush'),fakeWallet('Suiet')]).length,2);
 assert(!missingWalletOptions([fakeWallet('Sui Wallet')]).some(x=>x.name==='Slush'));
 for(const w of WALLET_OPTIONS)assert.equal(new URL(w.href).protocol,'https:');
});
test('zero installed wallets still offers four clearly named installation choices',async()=>{
 const h=await setup();try{await h.click('Connect Sui wallet');assert(document.querySelector('dialog').open);
  assert.equal(document.querySelectorAll('.home-wallet-row').length,4);assert.equal(document.querySelectorAll('a.home-wallet-row').length,4);
  assert.match(document.querySelector('dialog').textContent,/Slush.*Suiet.*Nightly.*Backpack/s);
  assert.equal(h.calls.length,0);
 }finally{await h.cleanup();}
});
test('multiple detected wallets connect through the existing dApp Kit action',async()=>{
 const slush=fakeWallet('Slush'),suiet=fakeWallet('Suiet'),other=fakeWallet('Other Sui wallet');const h=await setup({wallets:[slush,suiet,other]});
 try{await h.click('Connect Sui wallet');assert.equal(document.querySelectorAll('button.home-wallet-row').length,3);
  assert.equal(document.querySelectorAll('a.home-wallet-row').length,2);await h.click('Suiet');assert.deepEqual(h.calls,[suiet]);assert(!document.querySelector('dialog').open);
 }finally{await h.cleanup();}
});
test('connection rejection stays in the picker with retry choices and never starts payment',async()=>{
 const h=await setup({wallets:[fakeWallet('Slush')],connect:()=>{throw Error('User rejected request');}});
 try{await h.click('Connect Sui wallet');await h.click('Slush');assert(document.querySelector('dialog').open);assert.match(document.querySelector('[role=alert]').textContent,/cancelled/);
  assert(!document.querySelector('button.home-wallet-row').disabled);
 }finally{await h.cleanup();}
});
test('rapid clicks submit only one connection request',async()=>{
 let done;const h=await setup({wallets:[fakeWallet('Slush')],connect:()=>new Promise(r=>{done=()=>r({accounts:[]});})});
 try{await h.click('Connect Sui wallet');await h.click('Slush');await h.click('Slush');assert.equal(h.calls.length,1);await act(async()=>done());}
 finally{await h.cleanup();}
});
test('unconnected home renders the game title and wallet controls without playable access',async()=>{
 const h=await setup({component:Gateway});try{
  assert(document.querySelector('[data-testid=public-home]'));assert(!document.querySelector('[data-testid=playable-game]'));
  assert(document.querySelector('.nftree-home-access'));assert.equal(globalThis.__homeWallet.gameProps.homeOnly,true);
  assert.equal(globalThis.__homeWallet.gameProps.serverRunId,undefined);assert(!document.body.textContent.includes('NFTree Gateway'));
 }finally{await h.cleanup();}
});
test('connected non-holder remains on the home screen after denied verification',async()=>{
 const h=await setup({component:Gateway,connected:true,authenticate:()=>{throw Error('A directly held NFTree is required.');}});
 try{await h.click('Verify NFTree & Play');assert(document.querySelector('[data-testid=public-home]'));assert(!document.querySelector('[data-testid=playable-game]'));
  assert.match(document.querySelector('[role=alert]').textContent,/NFTree is required/);
 }finally{await h.cleanup();}
});
test('only a verified session mounts playable gameplay from the home screen',async()=>{
 const h=await setup({component:Gateway,connected:true});try{await h.click('Verify NFTree & Play');
  assert(document.querySelector('[data-testid=playable-game]'));assert(!document.querySelector('[data-testid=public-home]'));
  assert.equal(globalThis.__homeWallet.gameProps.serverRunId,session.runId);assert.equal(globalThis.__homeWallet.gameProps.initialScene,'game');
 }finally{await h.cleanup();}
});
