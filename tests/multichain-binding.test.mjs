import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {hashHex} from '../play/multichaintest/setup/bnb/core.js';
import {preflight,requestDeployment,verifyReceipt,loadState,saveState} from '../play/multichaintest/setup/bnb/bind/core.js';
const config=JSON.parse(fs.readFileSync(new URL('../play/multichaintest/setup/bnb/bind/binding.json',import.meta.url)));
const hash='0x'+'a'.repeat(64),word=x=>'0x'+x.slice(2).padStart(64,'0');
async function fixture(overrides={}){
  const cfg={...config,adapterCodeSha256:await hashHex('0x6001'),passCodeSha256:await hashHex('0x6002')},calls=[];let bound=false;
  const receipt=()=>({transactionHash:hash,status:'0x1',to:cfg.adapter,contractAddress:null,blockNumber:'0x100',logs:[{address:cfg.adapter,removed:false,topics:[cfg.passBoundTopic,word(cfg.pass)],data:'0x'}]});
  const provider={request:async request=>{const {method,params}=request;calls.push(request);if(overrides[method])return overrides[method](params);
    switch(method){
      case 'eth_chainId':return '0x38';case 'eth_accounts':return [cfg.from];case 'eth_getTransactionCount':return '0x143';
      case 'eth_getCode':return params[0]===cfg.adapter?'0x6001':'0x6002';
      case 'eth_call':if(params[0].data===cfg.passGetter)return word(bound?cfg.pass:'0x0');if(params[0].data===cfg.binderGetter)return word(cfg.from);if(params[0].data===cfg.passAdapterGetter)return word(cfg.adapter);if(params[0].data===cfg.data)return '0x';throw Error('Unexpected call');
      case 'eth_estimateGas':return '0xc493';case 'eth_gasPrice':return '0x2faf080';case 'eth_getBalance':return '0x2132cc25851291';
      case 'eth_sendTransaction':bound=true;return hash;
      case 'eth_getTransactionReceipt':bound=true;return receipt();
      case 'eth_getTransactionByHash':return {hash,from:cfg.from,to:cfg.adapter,chainId:'0x38',nonce:'0x143',value:'0x0',input:cfg.data};
      default:throw Error('Unexpected RPC '+method);
    }
  }};
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};let held=false;
  const locks={request:async(k,o,fn)=>{if(held)return fn(null);held=true;try{return await fn({name:k});}finally{held=false;}}};
  return {cfg,provider,calls,storage,data,receipt,options:{cfg,provider,storage,locks,key:'binding',consent:true,isCurrent:()=>true}};
}
test('binding preflight checks existing contracts and relationship without signing',async()=>{
  const f=await fixture();assert.equal((await preflight(f.provider,f.cfg)).gas,'50323');assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
});
test('only the exact bindPass call to the reviewed adapter can be submitted',async()=>{
  const f=await fixture();await assert.rejects(requestDeployment({...f.options,consent:false}));await requestDeployment(f.options);
  const tx=f.calls.find(x=>x.method==='eth_sendTransaction').params[0];assert.equal(tx.to,f.cfg.adapter);assert.equal(tx.data,f.cfg.data);assert.equal(tx.value,'0x0');assert.equal(tx.nonce,'0x143');assert.equal(tx.chainId,'0x38');
  const bad={...f.cfg,data:'0xdeadbeef'+f.cfg.data.slice(10)};bad.dataSha256=await hashHex(bad.data);await assert.rejects(preflight(f.provider,bad),/Only the reviewed bindPass/);
});
test('wrong identity, nonce, dependency code or simulation never requests the wallet',async()=>{
  for(const bad of [{eth_chainId:()=>1},{eth_accounts:()=>['0x123']},{eth_getTransactionCount:()=>324},{eth_getCode:()=> '0x60ff'},{eth_call:()=> '0x'+ '0'.repeat(63)+'1'}]){
    const f=await fixture(bad);await assert.rejects(requestDeployment(f.options));assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
  }
});
test('an already-bound adapter and an incorrect pass relationship fail closed',async()=>{
  for(const target of ['passGetter','binderGetter','passAdapterGetter']){
    const f=await fixture();const request=f.provider.request;f.provider.request=async r=>r.method==='eth_call'&&r.params[0].data===f.cfg[target]?word('0x1'):request(r);
    await assert.rejects(preflight(f.provider,f.cfg));assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
  }
});
test('cross-tab locks and durable state block repeated binding requests',async()=>{
  const f=await fixture();const results=await Promise.allSettled([requestDeployment(f.options),requestDeployment(f.options)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(requestDeployment(f.options));assert.equal(f.calls.filter(x=>x.method==='eth_sendTransaction').length,1);
});
test('missing coordination, failed storage and changed wallet state stop before signing',async()=>{
  for(const overrides of [{locks:null},{isCurrent:()=>false},{storage:{getItem:()=>null,setItem:()=>{throw Error('full');}}}]){
    const f=await fixture();await assert.rejects(requestDeployment({...f.options,...overrides}));assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
  }
});
test('wallet rejection clears state while an ambiguous submission keeps the marker',async()=>{
  for(const code of [4001,-32000]){const f=await fixture({eth_sendTransaction:()=>{throw Object.assign(Error('wallet error'),{code});}});await assert.rejects(requestDeployment(f.options));assert.equal(f.data.has('binding'),code!==4001);}
});
test('binding receipt needs the exact transaction, PassBound event and live relationship',async()=>{
  const f=await fixture();assert.equal((await verifyReceipt(f.provider,f.cfg,hash)).status,'verified');
  const pending=await fixture({eth_getTransactionReceipt:()=>null});assert.equal((await verifyReceipt(pending.provider,pending.cfg,hash)).status,'pending');
  const noEvent=await fixture();const original=noEvent.provider.request;noEvent.provider.request=async r=>r.method==='eth_getTransactionReceipt'?{...noEvent.receipt(),logs:[]}:original(r);await assert.rejects(verifyReceipt(noEvent.provider,noEvent.cfg,hash),/PassBound/);
  const wrongTx=await fixture({eth_getTransactionByHash:()=>({hash,from:config.from,to:config.pass,chainId:'0x38',nonce:'0x143',value:'0x0',input:config.data})});await assert.rejects(verifyReceipt(wrongTx.provider,wrongTx.cfg,hash),/differs/);
});
test('binding config is pinned to both verified deployments and the original unsigned call',()=>{
  const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));const adapter=read('docs/multichain/bnb-adapter-verified.json'),pass=read('docs/multichain/bnb-pass-verified.json'),unsigned=read('docs/multichain/bnb-evm-unsigned.json');
  assert.equal(config.adapter,adapter.contractAddress);assert.equal(config.pass,pass.contractAddress);assert.equal(config.adapterCodeSha256,adapter.runtimeSha256);assert.equal(config.passCodeSha256,pass.runtimeSha256);assert.equal(config.nonce,pass.pendingNonce);assert.equal(config.data,unsigned.transactions[2].data);assert.equal(config.value,'0x0');
  const bytes=fs.readFileSync(new URL('play/multichaintest/setup/bnb/bind/binding.json',root));assert(fs.readFileSync(new URL('play/multichaintest/setup/bnb/bind/app.js',root),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));
});
test('loading the binding page never requests account access or a transaction',async()=>{
  const root=new URL('../play/multichaintest/setup/bnb/bind/',import.meta.url),source=fs.readFileSync(new URL('app.js',root),'utf8'),bytes=fs.readFileSync(new URL('binding.json',root));
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{children:[],textContent:'',checked:false,append(x){this.children.push(x);}});return elements.get(id);};let requested=0;
  const context=vm.createContext({preflight,requestDeployment,verifyReceipt,loadState,saveState,crypto,TextDecoder,Uint8Array,Event:class{},window:{ethereum:{request:async()=>{requested++;}},addEventListener(){},dispatchEvent(){}},document:{getElementById:get,createElement:()=>({})},localStorage:{getItem:()=>null},navigator:{},fetch:async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})});
  await vm.runInContext('(async()=>{'+source.replace(/^import[^\n]+\n/,'')+'})()',context);assert.equal(requested,0);assert.equal(get('deploy').disabled,true);assert.equal(get('predicted').textContent,config.adapter);
});
