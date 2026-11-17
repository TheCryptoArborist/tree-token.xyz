import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {C,buildRegistration,validateObjects,verifySimulation,requestRegistration,readState,preflight} from '../play/multichaintest/setup/sui/register/core.js';
const state=JSON.parse(fs.readFileSync(new URL('../docs/multichain/sui-registration-state.json',import.meta.url)));
const simulation=JSON.parse(fs.readFileSync(new URL('../docs/multichain/sui-registration-simulation.json',import.meta.url))).result;
function harness(options={}){
 const map=new Map();let held=false,calls=0,id={address:C.sender,network:'mainnet',epoch:0};
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const locks={request:async(k,o,fn)=>{if(held)return fn(null);held=true;try{return await fn({});}finally{held=false;}}};
 const args={storage,locks,identity:()=>id,reviewed:()=>true,prepare:async()=>({transaction:buildRegistration(C.sender,state)}),sign:async()=>{calls++;if(options.error)throw options.error;return options.result??{$kind:'Transaction',Transaction:{digest:'3PqsBcdj4CVTuQrpdWVCUqAGa5Nw7oLQp4PafcbmY1t4'}};}};
 return {args,map,calls:()=>calls,setId:x=>id=x};
}
test('only exact register call; read-only custody; empty metadata; wallet owns gas',()=>{
 const t=buildRegistration(C.sender,state).getData();assert.equal(t.sender,C.sender);assert.equal(t.commands.length,1);
 assert.equal(t.commands[0].MoveCall.package,C.package);assert.equal(t.commands[0].MoveCall.function,'register');assert.equal(t.commands[0].MoveCall.module,'bridge');
 assert.equal(t.inputs[0].Object.SharedObject.mutable,false);assert.equal(t.inputs[1].Object.ImmOrOwnedObject.objectId,C.admin);assert.equal(t.inputs[2].Object.SharedObject.mutable,true);assert.equal(t.inputs[3].Pure.bytes,'AA==');
 assert.equal(t.gasData.budget,null);assert.equal(t.gasData.price,null);assert.equal(t.gasData.payment,null);assert.throws(()=>buildRegistration(C.bridge,state),/designated/);
});
test('rejects changed ownership, pilot state or endpoint',()=>{
 for(const mutate of [x=>x.o0.asMoveObject.contents.json.bound=true,x=>x.o0.asMoveObject.contents.json.released=true,x=>x.o0.asMoveObject.contents.json.nft.id=C.bridge,x=>x.o1.owner.address.address=C.bridge,x=>x.o2.asMoveObject.contents.json.eid=1,x=>x.o0.asMoveObject.contents.json.cap.cap_type.pos0=C.bridge]){const x=structuredClone(state);mutate(x);assert.throws(()=>validateObjects(x));}
});
test('simulation creates channel without moving NFT',()=>{assert.equal(verifySimulation(simulation).feeMist,'4668124');});
test('rejects failed, misidentified, custody-changing or expensive simulation',()=>{
 for(const mutate of [r=>r.$kind='FailedTransaction',r=>r.Transaction.events[0].json.oapp=C.bridge,r=>r.Transaction.effects.changedObjects.push({objectId:C.nft}),r=>r.Transaction.effects.gasUsed.computationCost='999999999']){const r=structuredClone(simulation);mutate(r);assert.throws(()=>verifySimulation(r));}
});
test('preflight always checks and selects real gas',async()=>{let seen;const r=await preflight(C.sender,{fetcher:async()=>({ok:true,json:async()=>({data:state})}),simulate:async o=>{seen=o;return simulation;}});assert.equal(seen.doGasSelection,true);assert.equal(seen.checksEnabled,true);assert.equal(r.feeMist,'4668124');});
test('successful receipt blocks repeat submission',async()=>{const h=harness();await requestRegistration(h.args);assert.equal(h.calls(),1);assert(readState(h.args.storage).receipt);assert(!readState(h.args.storage).pending);await assert.rejects(requestRegistration(h.args),/recorded/);assert.equal(h.calls(),1);});
test('pending, wrong account/network, absent consent/locks/storage block requests',async()=>{
 for(const setup of [h=>h.map.set(C.key+'-pending','1'),h=>h.setId({address:C.bridge,network:'mainnet'}),h=>h.setId({address:C.sender,network:'testnet'}),h=>h.args.reviewed=()=>false,h=>h.args.locks=null,h=>h.args.storage.setItem=()=>{throw Error('storage unavailable');}]){const h=harness();setup(h);await assert.rejects(requestRegistration(h.args));assert.equal(h.calls(),0);}
});
test('account change during simulation blocks signing',async()=>{const h=harness();h.args.prepare=async()=>{h.setId({address:C.sender,network:'mainnet',epoch:1});return {};};await assert.rejects(requestRegistration(h.args),/changed/);assert.equal(h.calls(),0);});
test('ambiguity retains pending; explicit rejection and known onchain failure clear pending',async()=>{
 for(const o of [{error:Error('transport lost')},{result:{}}]){const h=harness(o);await assert.rejects(requestRegistration(h.args));assert(readState(h.args.storage).pending);}
 for(const o of [{error:Object.assign(Error('rejected'),{code:4001})},{result:{$kind:'FailedTransaction',FailedTransaction:{status:{error:{message:'abort'}}}}}]){const h=harness(o);await assert.rejects(requestRegistration(h.args));assert(!readState(h.args.storage).pending);}
});
test('simultaneous tabs cannot open duplicate requests',async()=>{const h=harness();let resume;h.args.prepare=()=>new Promise(r=>resume=()=>r({}));const one=requestRegistration(h.args);await assert.rejects(requestRegistration(h.args),/Another tab/);resume();await one;assert.equal(h.calls(),1);});
test('page imports actual local wallet exports and requires explicit interaction',async()=>{
 const app=fs.readFileSync(new URL('../play/multichaintest/setup/sui/register/app.js',import.meta.url),'utf8');const html=fs.readFileSync(new URL('../play/multichaintest/setup/sui/register/index.html',import.meta.url),'utf8');
 assert(app.includes("from '../../../wallet-vendor.js'"));assert(app.includes('autoConnect:false'));assert(app.includes('slushWalletConfig:null'));assert(html.includes('id="register" disabled'));assert(html.includes('empty execution metadata'));
 const vendor=await import('../play/multichaintest/wallet-vendor.js');assert.equal(typeof vendor.createDAppKit,'function');assert.equal(typeof vendor.SuiGrpcClient,'function');
});

import vm from 'node:vm';
function pageHarness(initial=[]){
 const elements=new Map(),storage=new Map();let connectCalls=0,signCalls=0,reloads=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:id==='wallet-help',disabled:false,checked:false,textContent:'',children:[],replaceChildren(){this.children=[];},append(b){this.children.push(b);}});return elements.get(id);};
 function store(value){const subs=[];return {get:()=>value,subscribe:fn=>{subs.push(fn);fn(value);},set:v=>{value=v;subs.forEach(fn=>fn(value));}};}
 const kit={stores:{$wallets:store(initial),$connection:store({}),$currentNetwork:store('mainnet')},connectWallet:async({wallet})=>{connectCalls++;kit.stores.$connection.set({account:{address:C.sender},wallet});},disconnectWallet:async()=>kit.stores.$connection.set({}),signAndExecuteTransaction:async()=>{signCalls++;}};
 const app=fs.readFileSync(new URL('../play/multichaintest/setup/sui/register/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(app,{C,readState,requestRegistration,createDAppKit:()=>kit,SuiGrpcClient:class{},document:{getElementById:el,createElement:()=>({})},window:{addEventListener(){},location:{reload(){reloads++;}}},localStorage:{getItem:k=>storage.get(k)??null},navigator:{},Date,console});
 return {el,kit,connectCalls:()=>connectCalls,signCalls:()=>signCalls,reloads:()=>reloads};
}
test('Connect wallet remains usable with no extension and gives actionable help',async()=>{const h=pageHarness();assert.equal(h.el('connect-wallet').disabled,false);assert.equal(h.el('connect-wallet').textContent,'Connect wallet');await h.el('connect-wallet').onclick();assert.equal(h.el('wallet-help').hidden,false);assert.match(h.el('status').textContent,/not been detected/);assert.equal(h.connectCalls(),0);assert.equal(h.signCalls(),0);assert.equal(h.el('register').disabled,true);h.el('reload-wallets').onclick();assert.equal(h.reloads(),1);});
test('late Slush discovery offers connection; explicit click connects without signing',async()=>{const h=pageHarness();assert.equal(h.connectCalls(),0);h.kit.stores.$wallets.set([{name:'Slush'}]);assert.equal(h.el('wallet-list').children[0].textContent,'Connect Slush');await h.el('connect-wallet').onclick();assert.equal(h.connectCalls(),1);assert.equal(h.signCalls(),0);assert.match(h.el('wallet-status').textContent,/Connected:/);assert.equal(h.el('register').disabled,true);});
test('multiple wallets require explicit choice and do not auto-connect',async()=>{const h=pageHarness([{name:'Slush'},{name:'Other wallet'}]);await h.el('connect-wallet').onclick();assert.equal(h.connectCalls(),0);assert.equal(h.el('wallet-list').children.length,2);await h.el('wallet-list').children[0].onclick();assert.equal(h.connectCalls(),1);assert.equal(h.signCalls(),0);});
