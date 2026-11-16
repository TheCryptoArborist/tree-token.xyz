import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {hashHex,preflight,requestDeployment,verifyReceipt,saveState} from '../play/multichaintest/setup/bnb/core.js';

const address='0x90f9c1c0c675A0ce9D539c540DB7F4A1f7e583AE';
const hash='0x'+'a'.repeat(64);
async function fixture(changes={}) {
  const cfg={chainId:'0x38',from:address,nonce:321,value:'0x0',data:'0x6000',predictedAdapter:'0x'+'b'.repeat(40),endpoint:'0x'+'c'.repeat(40),endpointCodeSha256:await hashHex('0x6001'),runtimeSha256:await hashHex('0x60ff'),dataSha256:await hashHex('0x6000')};
  const calls=[];let nonceCalls=0;
  const provider={request:async({method,params})=>{
    calls.push({method,params});
    if(changes[method])return changes[method](params,++nonceCalls);
    switch(method){
      case 'eth_chainId':return '0x38';
      case 'eth_accounts':return [address];
      case 'eth_getTransactionCount':return '0x141';
      case 'eth_getCode':return params[0]===cfg.endpoint?'0x6001':params[1]==='latest'?'0x':'0x60ff';
      case 'eth_call':return '0x60ff';
      case 'eth_estimateGas':return '0x135c38';
      case 'eth_gasPrice':return '0x2faf080';
      case 'eth_getBalance':return '0x2132cc25851291';
      case 'eth_sendTransaction':return hash;
      case 'eth_getTransactionReceipt':return {status:'0x1',transactionHash:hash,contractAddress:cfg.predictedAdapter,blockNumber:'0x100'};
      case 'eth_getTransactionByHash':return {hash,from:address,to:null,nonce:'0x141',value:'0x0',chainId:'0x38',input:cfg.data};
      default:throw Error('Unexpected RPC '+method);
    }
  }};
  const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  let held=false;const locks={request:async(k,o,f)=>{if(held)return f(null);held=true;try{return await f({name:k});}finally{held=false;}}};
  const options={provider,cfg,storage,locks,key:'test-adapter',consent:true,isCurrent:()=>true};
  return {cfg,provider,calls,storage,data,locks,options};
}
test('preflight verifies identity, nonce, endpoint and simulated runtime without signing',async()=>{
  const f=await fixture();const q=await preflight(f.provider,f.cfg);
  assert.equal(q.gas,'1268792');assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
  assert(f.calls.some(x=>x.method==='eth_call'&&x.params[0].value==='0x0'&&!('to' in x.params[0])));
});
test('wrong network, account, nonce, endpoint, runtime or balance stops deployment',async()=>{
  for(const changes of [{eth_chainId:()=> '0x1'},{eth_accounts:()=>['0x123']},{eth_getTransactionCount:()=> '0x142'},{eth_getCode:()=> '0x'},{eth_call:()=> '0x60aa'},{eth_getBalance:()=> '0x0'}]){
    const f=await fixture(changes);await assert.rejects(requestDeployment(f.options));assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
  }
});
test('only explicit consent can send exactly the reviewed zero-value creation transaction',async()=>{
  const f=await fixture();await assert.rejects(requestDeployment({...f.options,consent:false}));
  await requestDeployment(f.options);const requests=f.calls.filter(x=>x.method==='eth_sendTransaction');
  assert.equal(requests.length,1);assert.deepEqual(requests[0].params[0],{from:address,chainId:'0x38',nonce:'0x141',value:'0x0',data:'0x6000',gas:'0x173b77'});
  assert.equal(JSON.parse(f.data.get('test-adapter')).hash,hash);
});
test('shared cross-tab lock and recorded state prevent a duplicate request',async()=>{
  const f=await fixture();const results=await Promise.allSettled([requestDeployment(f.options),requestDeployment(f.options)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(requestDeployment(f.options));
  assert.equal(f.calls.filter(x=>x.method==='eth_sendTransaction').length,1);
});
test('no Web Locks, failed persistence, account changes or a last-moment nonce change fail closed',async()=>{
  for(const change of [{locks:null},{storage:{getItem:()=>null,setItem:()=>{throw Error('full');}}},{isCurrent:()=>false}]){
    const f=await fixture();await assert.rejects(requestDeployment({...f.options,...change}));assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
  }
  const f=await fixture({eth_getTransactionCount:(_p,n)=>n>=3?'0x142':'0x141'});
  await assert.rejects(requestDeployment(f.options));assert(!f.calls.some(x=>x.method==='eth_sendTransaction'));
});
test('rejection clears the marker; ambiguous errors and missing hash preserve it',async()=>{
  for(const [code,expectPending]of [[4001,false],[-32000,true]]){
    const f=await fixture({eth_sendTransaction:()=>{throw Object.assign(Error('wallet error'),{code});}});
    await assert.rejects(requestDeployment(f.options));assert.equal(f.data.has('test-adapter'),expectPending);
  }
  const f=await fixture({eth_sendTransaction:()=>null});await assert.rejects(requestDeployment(f.options));assert(f.data.has('test-adapter'));
});
test('receipt verification binds hash, creation address, transaction data and deployed runtime',async()=>{
  const f=await fixture();assert.equal((await verifyReceipt(f.provider,f.cfg,hash)).status,'verified');
  const pending=await fixture({eth_getTransactionReceipt:()=>null});assert.equal((await verifyReceipt(pending.provider,pending.cfg,hash)).status,'pending');
  for(const changes of [{eth_getTransactionReceipt:()=>({status:'0x0',transactionHash:hash})},{eth_getTransactionReceipt:()=>({status:'0x1',transactionHash:hash,contractAddress:'0x123'})},{eth_getTransactionByHash:()=>({hash,from:address,to:null,nonce:'0x141',value:'0x0',chainId:'0x38',input:'0x60aa'})}]){
    const bad=await fixture(changes);await assert.rejects(verifyReceipt(bad.provider,bad.cfg,hash));
  }
});
test('published settings pin the actual verified Sui IDs and previously simulated adapter bytes',()=>{
  const root=new URL('../',import.meta.url);const bytes=fs.readFileSync(new URL('play/multichaintest/setup/bnb/deployment.json',root));const cfg=JSON.parse(bytes);
  const app=fs.readFileSync(new URL('play/multichaintest/setup/bnb/app.js',root),'utf8');
  assert(app.includes(createHash('sha256').update(bytes).digest('hex')));
  const unsigned=JSON.parse(fs.readFileSync(new URL('docs/multichain/bnb-evm-unsigned.json',root)));
  const verified=JSON.parse(fs.readFileSync(new URL('docs/multichain/sui-publication-verified.json',root)));
  assert.equal(cfg.data,unsigned.transactions[0].data);assert.equal(cfg.predictedAdapter,unsigned.predicted.adapter);
  for(const k of ['suiPackage','bridge','backingNFT'])assert.equal(cfg[k],verified[k]);
  const args=[cfg.endpoint.slice(2).padStart(64,'0'),cfg.suiPackage.slice(2),cfg.bridge.slice(2),cfg.backingNFT.slice(2),cfg.from.slice(2).padStart(64,'0')].join('').toLowerCase();
  assert(cfg.data.toLowerCase().endsWith(args));
});
test('loading and discovering wallets never request accounts or a transaction',async()=>{
  const root=new URL('../play/multichaintest/setup/bnb/',import.meta.url);const source=fs.readFileSync(new URL('app.js',root),'utf8');const bytes=fs.readFileSync(new URL('deployment.json',root));
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{children:[],textContent:'',checked:false,append(x){this.children.push(x);}});return elements.get(id);};
  let requested=0;const context=vm.createContext({preflight,requestDeployment,verifyReceipt,loadState:()=>null,saveState,crypto,TextDecoder,Uint8Array,Event:class{},window:{ethereum:{request:async()=>{requested++;}},addEventListener(){},dispatchEvent(){}},document:{getElementById:get,createElement:()=>({})},localStorage:{getItem:()=>null},navigator:{},fetch:async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})});
  await vm.runInContext('(async()=>{'+source.replace(/^import[^\n]+\n/,'')+'})()',context);
  assert.equal(requested,0);assert.equal(get('deploy').disabled,true);assert.equal(get('wallet-list').children.length,1);
});
