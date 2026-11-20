import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {encodeFunctionData,toHex} from 'viem';
import {C,DATA,EVENT,readContracts,preflight,requestEnablement,loadState,recoverReceipt,verifyReceipt} from '../scripts/multichain/original-enable-core.mjs';
const hash='0x'+'a'.repeat(64),word=n=>toHex(BigInt(n),{size:32});
const config=JSON.parse(fs.readFileSync('docs/multichain/original-trial/bnb-route-unsigned.json'));
const select=name=>encodeFunctionData({abi:[{name,type:'function',inputs:[],outputs:[],stateMutability:'view'}],functionName:name});
function fixture(){
 const map=new Map(),calls=[],storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let held=false;const locks={request:async(k,o,f)=>{if(held)return f(null);held=true;try{return await f({})}finally{held=false}}};
 const tx={hash,from:C.from,to:C.pass,nonce:'0x160',chainId:'0x38',value:'0x0',input:DATA};
 const receipt={transactionHash:hash,from:C.from,to:C.pass,status:'0x1',contractAddress:null,blockNumber:'0x100',logs:[{address:C.pass,topics:[...EVENT.topics],data:EVENT.data}]};
 const provider={request:async q=>{calls.push(q);switch(q.method){case 'eth_chainId':return '0x38';case 'eth_accounts':return [C.from];case 'eth_getTransactionCount':return '0x160';case 'eth_call':return '0x';case 'eth_estimateGas':return '0x7000';case 'eth_gasPrice':return '0x2faf080';case 'eth_getBalance':return '0xde0b6b3a7640000';case 'eth_sendTransaction':return hash;case 'eth_getTransactionReceipt':return receipt;case 'eth_getTransactionByHash':return tx;default:throw Error(q.method)}}};
 const readState=async()=>({paused:true}),prepare=p=>preflight(p,{readState,now:()=>1000});
 return {map,calls,storage,locks,tx,receipt,provider,readState,prepare};
}
async function setup(){const f=fixture(),quote=await f.prepare(f.provider);return {...f,quote,args:{provider:f.provider,storage:f.storage,locks:f.locks,reviewed:()=>true,reviewedQuote:()=>quote,isCurrent:()=>true,prepare:f.prepare,now:()=>1000}}}
const withOverride=(p,method,fn)=>{const orig=p.request;p.request=q=>q.method===method?fn(q):orig(q)};
test('one fixed no-value enable call targets original pass, never disposable pass or mint',()=>{
 assert.equal(C.pass.toLowerCase(),'0x1d3da001e586a7defd397b77fadb29ed6f039c13');assert.equal(DATA.length,74);assert.equal(DATA.slice(-64),'0'.repeat(64));assert.equal(EVENT.topics.length,1);assert.equal(EVENT.data,word(0));
 assert.notEqual(C.key,'nftree-bnb-purchase-v1-e98fa205');
});
test('fresh simulation requests no signature and pins current nonce, target and zero value',async()=>{const f=await setup();assert.equal(f.quote.nonce,'352');assert.equal(f.quote.target,C.pass);assert(!f.calls.some(q=>q.method==='eth_sendTransaction'));assert.equal(f.calls.find(q=>q.method==='eth_call').params[0].value,'0x0')});
test('wrong wallet/chain, pending nonce, excessive gas/fee, insufficient balance and failed simulation stop signing',async()=>{
 for(const [method,fn]of [['eth_chainId',()=> '0x1'],['eth_accounts',()=>[C.endpoint]],['eth_getTransactionCount',q=>q.params[1]==='pending'?'0x161':'0x160'],['eth_estimateGas',()=> '0xffffff'],['eth_gasPrice',()=> '0x0'],['eth_getBalance',()=> '0x0'],['eth_call',()=> '0x01']]){
  const f=fixture();withOverride(f.provider,method,fn);await assert.rejects(()=>f.prepare(f.provider));assert(!f.calls.some(q=>q.method==='eth_sendTransaction'));
 }
});
test('source/state failure blocks all simulation and sending',async()=>{const f=fixture();await assert.rejects(()=>preflight(f.provider,{readState:async()=>{throw Error('Backing changed')}}),/Backing changed/);assert(!f.calls.some(q=>q.method==='eth_call'))});
test('request persists recovery identity before exactly one wallet handoff and blocks repeats',async()=>{const f=await setup();await requestEnablement(f.args);const sent=f.calls.filter(q=>q.method==='eth_sendTransaction');assert.equal(sent.length,1);assert.deepEqual(sent[0].params[0],{from:C.from,to:C.pass,chainId:'0x38',value:'0x0',nonce:'0x160',data:DATA,gas:f.quote.gasLimit});assert.equal(loadState(f.storage).hash,hash);await assert.rejects(()=>requestEnablement(f.args),/pending or recorded/)});
test('review expiry, revoked consent, account epoch and refreshed nonce/fee changes require review again',async()=>{
 for(const mutate of [f=>f.args.reviewed=()=>false,f=>f.args.now=()=>121001,f=>f.args.now=()=>0,f=>f.args.isCurrent=()=>false,f=>f.args.prepare=async()=>({...f.quote,nonce:'353'}),f=>f.args.prepare=async()=>({...f.quote,gasLimitFeeWei:'1'})]){const f=await setup();mutate(f);await assert.rejects(()=>requestEnablement(f.args));assert(!f.calls.some(q=>q.method==='eth_sendTransaction'));assert.equal(loadState(f.storage),null)}
});
test('rejected requests clear pending; ambiguous failure or missing hash preserve it',async()=>{for(const code of [4001,-32000,null]){const f=await setup();withOverride(f.provider,'eth_sendTransaction',()=>{if(code)throw Object.assign(Error('wallet'),{code});return null});await assert.rejects(()=>requestEnablement(f.args));assert.equal(!!loadState(f.storage),code!==4001)}});
test('storage failure before submission and cross-tab races cannot submit twice',async()=>{const f=await setup();f.storage.setItem=()=>{throw Error('storage')};await assert.rejects(()=>requestEnablement(f.args));assert(!f.calls.some(q=>q.method==='eth_sendTransaction'));const g=await setup();let finish;g.args.prepare=()=>new Promise(r=>finish=()=>r(g.quote));const first=requestEnablement(g.args);await assert.rejects(()=>requestEnablement(g.args),/Another tab/);finish();await first;assert.equal(g.calls.filter(q=>q.method==='eth_sendTransaction').length,1)});
test('receipt requires exact sender, chain, value, calldata, target and single unpause event',async()=>{
 const f=fixture();assert.equal((await verifyReceipt(f.provider,hash,{readState:f.readState})).status,'verified');
 for(const mutate of [f=>f.tx.to=C.adapter,f=>f.tx.input='0x',f=>f.tx.from=C.endpoint,f=>f.tx.value='0x1',f=>f.tx.chainId='0x1',f=>f.receipt.status='0x0',f=>f.receipt.logs[0].data=word(1),f=>f.receipt.logs[0].topics.push(word(0)),f=>f.receipt.logs.push({}),f=>f.receipt.logs[0].removed=true]){const f=fixture();mutate(f);await assert.rejects(()=>verifyReceipt(f.provider,hash,{readState:f.readState}))}
});
test('manual receipt recovery cannot clear another nonce or changed account/storage',async()=>{for(const mode of ['nonce','account','storage']){const f=fixture();f.map.set(C.key,JSON.stringify({status:'wallet_request',nonce:mode==='nonce'?'351':'352',target:C.pass}));const verify=async(p,h)=>{if(mode==='storage')f.map.delete(C.key);return verifyReceipt(p,h,{readState:f.readState})};await assert.rejects(()=>recoverReceipt({provider:f.provider,hash,storage:f.storage,locks:f.locks,verify,isCurrent:()=>mode!=='account'}));if(mode!=='storage')assert.equal(loadState(f.storage).status,'wallet_request')}});
test('published bundle exports source intent and exact wallet integration without any wallet request on load',async()=>{
 const b=await import('../play/multichaintest/original/bnb/enable/core.js');assert.equal(b.DATA,DATA);assert.deepEqual(b.C,C);
 const app=fs.readFileSync('play/multichaintest/original/bnb/enable/app.js','utf8'),html=fs.readFileSync('play/multichaintest/original/bnb/enable/index.html','utf8');for(const m of app.matchAll(/el\(['"]([^'"]+)['"]\)/g))assert(html.includes('id="'+m[1]+'"'),m[1]);
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{children:[],append(x){this.children.push(x)},checked:false,value:''});return nodes.get(id)};let requests=0;
 const context=vm.createContext({...b,Map,Date,Number,BigInt,Event:class{},window:{ethereum:{request:async()=>{requests++}},addEventListener(){},dispatchEvent(){},setInterval(){}},document:{getElementById:get,createElement:()=>({})},localStorage:{getItem:()=>null},navigator:{}});await vm.runInContext(app.replace(/^import .*?;\n/,''),context);assert.equal(requests,0);assert.equal(get('deploy').disabled,true);assert.equal(get('receipt-check').disabled,true);assert(html.includes('charges no USDT'));assert(!html.includes('disposable'));
});

test('full contract validator propagates a source-custody failure before BNB contract reads',async()=>{const f=fixture();await assert.rejects(()=>readContracts(f.provider,{source:async()=>{throw Error('NFT custody changed')}}),/NFT custody/);assert(!f.calls.some(q=>q.method==='eth_getCode'))});
test('full contract validator rejects changed deployed runtime before enabling',async()=>{const f=fixture();withOverride(f.provider,'eth_blockNumber',()=> '0x100');withOverride(f.provider,'eth_getCode',()=> '0x');await assert.rejects(()=>readContracts(f.provider,{source:async()=>({})}),/runtime/)});

const recorded=JSON.parse(fs.readFileSync('docs/multichain/original-trial/enable-preflight.json'));
function replay(mutate=()=>{}){
 const data=structuredClone(recorded.responses);mutate(data);
 return {request:async q=>{const row=data.find(x=>JSON.stringify(x.request)===JSON.stringify(q));assert(row,'Unexpected read '+JSON.stringify(q));return row.result}};
}
test('full Ready-state validator replays actual unsigned mainnet observations',async()=>{const p=replay();const r=await readContracts(p,{paused:true,source:async()=>({})});assert.equal(r.paused,true)});
test('full validator fails closed on authority, currency, price, reserve, pause, protocol or runtime drift',async()=>{
 const selectors=['controller','treasury','backingNFT','PRICE','purchasesPaused','redemption','recipient'];
 for(const name of selectors){const p=replay(rows=>{const row=rows.find(x=>x.request.method==='eth_call'&&x.request.params[0].to.toLowerCase()===C.pass.toLowerCase()&&x.request.params[0].data===select(name));assert(row);row.result=word(name==='purchasesPaused'?0:9)});await assert.rejects(()=>readContracts(p,{paused:true,source:async()=>({})}),undefined,name)}
 for(const label of ['Pass state','Explicit receive security','Effective send security','Receive timeout','Delegate']){const query=config.reads.find(r=>r.label===label);const p=replay(rows=>{const row=rows.find(x=>x.request.method==='eth_call'&&x.request.params[0].to.toLowerCase()===query.to.toLowerCase()&&x.request.params[0].data===query.data);assert(row);row.result=word(99)});await assert.rejects(()=>readContracts(p,{source:async()=>({})}),undefined,label)}
});
