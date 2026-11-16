import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto, createHash} from 'node:crypto';

const bundle=fs.readFileSync(new URL('../play/multichaintest/setup/app.js',import.meta.url),'utf8');
const source=bundle.slice(bundle.indexOf('var ws={modules:'));
const evidence=JSON.parse(fs.readFileSync(new URL('../docs/multichain-setup-evidence-20261116.json',import.meta.url)));
const wallet='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
function harness({account=wallet, pending=false, receipt=null, reject=false, sharedStorage=null, sharedLocks=null}={}) {
  const elements=new Map(), storage=sharedStorage??new Map(), commands=[];
  const lockState=sharedLocks??{held:false};
  const locks={request:async(key,options,fn)=>{if(lockState.held)return fn(null);lockState.held=true;try{return await fn({name:key});}finally{lockState.held=false;}}};
  let requests=0;
  const key='nftree-pilot-publication-'+evidence.publicationHashes.unsignedDraftSha256;
  if(pending) storage.set(key+'-pending','1');
  if(receipt) storage.set(key,JSON.stringify(receipt));
  const element=id=>{if(!elements.has(id))elements.set(id,{checked:false,hidden:false,textContent:'',children:[],replaceChildren(){this.children=[];},append(x){this.children.push(x);}});return elements.get(id);};
  const kit={stores:{$wallets:{get:()=>[],subscribe(f){f();}},$connection:{get:()=>({account:{address:account}}),subscribe(f){f();}},$currentNetwork:{get:()=>'mainnet'}},getClient:()=>({core:{waitForTransaction:async()=>{}}}),signAndExecuteTransaction:async()=>{requests++;if(reject)throw Object.assign(new Error('Declined'),{code:4001});return {Transaction:{digest:'test-digest'}};}};
  class Transaction {pure={address:x=>x};setSender(x){commands.push(['sender',x]);}publish(x){commands.push(['publish',x]);return ['upgrade-cap'];}transferObjects(x,y){commands.push(['transfer',x,y]);}}
  const context=vm.createContext({zf:()=>kit,Kc:class{},Zt:Transaction,crypto:webcrypto,atob,Uint8Array,URL,Blob,setTimeout,document:{getElementById:element,createElement:()=>({})},window:{addEventListener(){}},navigator:{locks,clipboard:{writeText:async()=>{}}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  vm.runInContext(source,context);
  return {context,element,storage,commands,requests:()=>requests,key};
}
test('publication contains the exact simulated modules and dependencies',async()=>{
  const h=harness();
  const tx=await h.context.Cm(wallet);
  assert(tx);
  assert.deepEqual(h.commands.map(c=>c[0]),['sender','publish','transfer']);
  const input=h.commands[1][1];
  assert.deepEqual(Array.from(input.modules,m=>createHash('sha256').update(Buffer.from(m)).digest('hex')),evidence.publicationHashes.moduleSha256);
  assert.deepEqual(Array.from(input.dependencies),evidence.publicationHashes.dependencies);
  assert.equal(h.commands[2][2],wallet);
});
test('wrong account, missing consent and altered module cannot request publication',async()=>{
  for(const account of ['0x123',wallet]){
    const h=harness({account});h.element('reviewed').checked=account!==wallet;
    await h.element('publish').onclick();assert.equal(h.requests(),0);
  }
  const h=harness();h.context.ws.modules[0]='AA==';
  await assert.rejects(h.context.Cm(wallet),/verification failed/);assert.equal(h.requests(),0);
});
test('connecting or loading alone never requests a transaction; explicit consent does',async()=>{
  const h=harness();assert.equal(h.requests(),0);assert.equal(h.element('publish').disabled,true);
  h.element('reviewed').checked=true;h.element('reviewed').onchange();assert.equal(h.element('publish').disabled,false);
  await h.element('publish').onclick();assert.equal(h.requests(),1);
  assert.equal(JSON.parse(h.storage.get(h.key)).digest,'test-digest');
  await h.element('publish').onclick();assert.equal(h.requests(),1);
});
test('pending or recorded publications prevent duplicate submission',async()=>{
  for(const options of [{pending:true},{receipt:{digest:'existing'}}]){
    const h=harness(options);h.element('reviewed').checked=true;
    await h.element('publish').onclick();assert.equal(h.requests(),0);assert.equal(h.element('publish').disabled,true);
  }
});
test('wallet rejection clears the pending marker without recording a publication',async()=>{
  const h=harness({reject:true});h.element('reviewed').checked=true;
  await h.element('publish').onclick();assert.equal(h.requests(),1);
  assert(!h.storage.has(h.key));assert(!h.storage.has(h.key+'-pending'));
});

test('two tabs sharing storage cannot submit a second publication',async()=>{
  const sharedStorage=new Map(),sharedLocks={held:false};
  const first=harness({sharedStorage,sharedLocks}),second=harness({sharedStorage,sharedLocks});
  first.element('reviewed').checked=true;second.element('reviewed').checked=true;
  await Promise.all([first.element('publish').onclick(),second.element('publish').onclick()]);
  assert.equal(first.requests()+second.requests(),1);
  await second.element('publish').onclick();
  assert.equal(first.requests()+second.requests(),1);
  assert.equal(JSON.parse(sharedStorage.get(first.key)).digest,'test-digest');
});

test('unavailable cross-tab coordination or unwritable storage never requests the wallet',async()=>{
  const noLocks=harness();noLocks.element('reviewed').checked=true;
  vm.runInContext('navigator.locks = undefined',noLocks.context);
  await noLocks.element('publish').onclick();assert.equal(noLocks.requests(),0);
  const noWrites=harness();noWrites.element('reviewed').checked=true;
  vm.runInContext('localStorage.setItem = () => { throw Error("storage full") }',noWrites.context);
  await noWrites.element('publish').onclick();assert.equal(noWrites.requests(),0);
});

test("previous trading wallet cannot publish the dev-wallet draft",async()=>{const h=harness();await assert.rejects(h.context.Cm("0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6"),/designated/);assert.equal(h.requests(),0);});

test('versioned unsigned draft binds dev sender and UpgradeCap recipient to the page identity',()=>{
  const bytes=fs.readFileSync(new URL('../docs/multichain-dev-publication-unsigned.json',import.meta.url));
  const draft=JSON.parse(bytes);
  assert.equal(draft.sender,wallet);
  assert.equal('0x'+Buffer.from(draft.kind.programmableTransaction.inputs[0].pure,'base64').toString('hex'),wallet);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.publicationHashes.unsignedDraftSha256);
  assert.equal(evidence.suiSimulation.data.simulateTransaction.effects.status,'SUCCESS');
});
