import {toHex} from 'viem';
import cfg from '../../docs/multichain/original-trial/bnb-route-unsigned.json' with {type:'json'};
import bindings from '../../docs/multichain/original-trial/route-config-bindings.json' with {type:'json'};
import {C as B,readContracts,verifyReceipt as verifyBinding,createReadProvider,newClient} from './original-bnb-bind-core.mjs';
import {readSui} from './original-bnb-core.mjs';
import {C as S,readConfigState,verifyConfiguration} from './original-config-core.mjs';
import {verifyRegistration} from './original-register-core.mjs';
import {resolveStage} from '../../play/multichaintest/setup/bnb/configure/core.js';
import {identity,quantity,walletRead,hashHex,saveState} from '../../play/multichaintest/setup/bnb/core.js';
export {cfg,createReadProvider,newClient};
export const C=Object.freeze({...B,key:'nftree-original-bnb-config-v1-90b5292a',maxAge:120000});
const check=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase(),hashPattern=/^0x[0-9a-f]{64}$/i;
export async function readSource(client=newClient()){
 const include={effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true};
 const [state,route,registration,configuration]=await Promise.all([readSui(client),readConfigState(client,1),client.core.getTransaction({digest:S.registrationDigest,include,signal:AbortSignal.timeout(30000)}),client.core.getTransaction({digest:bindings.suiConfigurationDigest,include,signal:AbortSignal.timeout(30000)})]);
 check(registration.Transaction?.digest===S.registrationDigest&&configuration.Transaction?.digest===bindings.suiConfigurationDigest,'Sui route receipt identity differs.');
 const r=verifyRegistration(registration),c=verifyConfiguration(configuration);check(r.channelId===S.channel&&c.channelId===S.channel,'Wrong registered messaging channel.');return {state,route};
}
export async function readReviewedRoute(provider,configuration=cfg){
 await identity(provider,C);const block=await walletRead(provider,{method:'eth_blockNumber'});quantity(block,'block number');
 const jobs=[...Object.entries(configuration.code).map(([to,sha])=>async()=>check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[to,block]}))===sha,'LayerZero contract code changed.')),...configuration.reads.map(r=>async()=>walletRead(provider,{method:'eth_call',params:[{to:r.to,data:r.data},block]}))];
 const results=[];for(let i=0;i<jobs.length;i+=3)results.push(...await Promise.all(jobs.slice(i,i+3).map(f=>f())));return {stage:resolveStage(configuration.reads,results.slice(Object.keys(configuration.code).length)),block};
}
export async function readState(provider,{source=readSource,contracts=readContracts,binding=verifyBinding,route=readReviewedRoute}={}){
 await identity(provider,C);const [proof,live]=await Promise.all([source(),route(provider,cfg)]);
 const result=await binding(provider,bindings.bnbBindingDigest,{readState:p=>contracts(p,{bound:true,source:async()=>proof.state})});check(result.status==='verified','The BNB binding receipt is not verified.');await identity(provider,C);return {...live,sourceVerified:true,bindingVerified:true};
}
async function nonce(provider){const n=await Promise.all(['latest','pending'].map(async tag=>quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce')));check(n[0]===n[1],'A BNB wallet transaction is pending. Check its receipt first.');return n[0];}
export async function preflight(provider,{read=readState,now=Date.now}={}){
 const live=await read(provider);if(live.stage===4)return {...live,quotedAt:now()};
 const step=cfg.steps[live.stage];check(step&&await hashHex(step.data)===step.dataSha256,'Reviewed configuration calldata changed.');
 const n=await nonce(provider),call={from:C.from,to:C.endpoint,data:step.data,value:'0x0'};check(await walletRead(provider,{method:'eth_call',params:[call,'latest']})==='0x','Configuration simulation returned an unexpected result.');
 const [gas,price,balance]=await Promise.all([walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),walletRead(provider,{method:'eth_gasPrice'}),walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']})].map(async x=>quantity(await x)));
 check(gas>0n&&gas<=700000n&&price>0n,'Unexpected configuration gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;check(fee<=10000000000000000n,'Gas allowance exceeds 0.01 BNB.');check(balance>=fee,'More BNB is needed for network gas.');await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed. Refresh and review.');return {...live,nonce:String(n),gas:String(gas),gasLimit:toHex(gasLimit),gasPrice:toHex(price),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
function validPending(p){return p&&Number.isInteger(p.stage)&&p.stage>=0&&p.stage<4&&/^(0|[1-9][0-9]*)$/.test(p.nonce)&&same(p.target,C.endpoint)&&p.dataSha256===cfg.steps[p.stage].dataSha256&&(!p.hash||hashPattern.test(p.hash));}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return {receipts:[]};const s=JSON.parse(text);check(s&&Array.isArray(s.receipts)&&s.receipts.every(r=>validPending(r)&&r.status==='verified'&&hashPattern.test(r.hash))&&(!s.pending||validPending(s.pending)),'Stored configuration state needs review.');return s;}
export async function requestConfiguration({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for configuration coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling configuration.');check(!loadState(storage).pending,'A wallet request is recorded. Check its receipt before continuing.');const q=reviewedQuote();check(reviewed()&&q&&q.stage<4&&now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulate and review a fresh step first.');
 const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage).pending,'Another request was recorded.');
 if(['stage','nonce','gas','gasLimitFeeWei'].some(k=>ready[k]!==q[k])){onQuote(ready);throw Error('Stage, nonce or gas changed. Review the refreshed step.');}
 check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired before signing.');await identity(provider,C);check(String(await nonce(provider))===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');const prior=loadState(storage),pending={stage:ready.stage,nonce:ready.nonce,target:C.endpoint,dataSha256:cfg.steps[ready.stage].dataSha256,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,{...prior,pending});let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,to:C.endpoint,chainId:C.chainId,nonce:toHex(BigInt(ready.nonce)),value:'0x0',data:cfg.steps[ready.stage].data,gas:ready.gasLimit,gasPrice:ready.gasPrice}]});}catch(e){if(e?.code===4001)saveState(storage,C.key,prior);throw e;}
 check(hashPattern.test(hash),'No valid hash returned. Check wallet activity before retrying.');const state={...prior,pending:{...pending,hash}};saveState(storage,C.key,state);return state;
 });
}
export async function verifyReceipt(provider,hash,{read=readState}={}){
 check(hashPattern.test(hash),'Enter the BNB configuration transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};
 check(same(receipt.transactionHash,hash)&&same(receipt.from,C.from)&&same(receipt.to,C.endpoint)&&receipt.contractAddress===null&&quantity(receipt.status)===1n,'Wrong or failed configuration receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&same(tx.to,C.endpoint)&&quantity(tx.chainId)===56n&&quantity(tx.value)===0n,'Wrong configuration transaction identity.');const stage=cfg.steps.findIndex(s=>same(s.data,tx.input));check(stage>=0,'Calldata differs from all four reviewed steps.');const step=cfg.steps[stage];
 check(receipt.logs?.length===step.events.length&&step.events.every((e,i)=>{const l=receipt.logs[i];return same(l.address,e.address)&&l.removed!==true&&same(l.data,e.data)&&l.topics?.length===e.topics.length&&e.topics.every((t,j)=>same(t,l.topics[j]));}),'Exact configuration events differ.');
 const live=await read(provider);check(live.stage>=stage+1,'Current settings do not reflect the receipt. Wait, then check again.');await identity(provider,C);return {status:'verified',hash,stage,nonce:String(quantity(tx.nonce)),target:C.endpoint,dataSha256:step.dataSha256,blockNumber:receipt.blockNumber,liveStage:live.stage};
}
export async function recoverReceipt({provider,hash,storage,locks,isCurrent=()=>true,verify=verifyReceipt}){
 check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling configuration.');const old=loadState(storage);check(!old.pending?.hash||same(old.pending.hash,hash),'A different request is pending. Check that receipt first.');const r=await verify(provider,hash);check(isCurrent(),'Wallet changed during verification.');check(JSON.stringify(loadState(storage))===JSON.stringify(old),'Stored state changed during verification.');if(r.status==='pending')return r;
 if(old.pending)check(r.stage===old.pending.stage&&r.nonce===old.pending.nonce&&same(r.target,old.pending.target)&&r.dataSha256===old.pending.dataSha256,'Receipt differs from the recorded request.');
 const prior=old.receipts.find(x=>x.stage===r.stage);check(!prior||same(prior.hash,r.hash),'A different receipt exists for this step.');saveState(storage,C.key,{receipts:[...old.receipts.filter(x=>x.stage!==r.stage),r].sort((a,b)=>a.stage-b.stage)});return r;
 });
}
