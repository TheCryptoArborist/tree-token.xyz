import {encodeFunctionData,keccak256,toHex} from 'viem';
import reviewed from '../../docs/multichain/bnb-one-slot/reviewed-artifacts.json' with {type:'json'};
import bindings from '../../docs/multichain/original-trial/pass-bindings.json' with {type:'json'};
import intent from '../../docs/multichain/original-trial/bnb-binding-unsigned.json' with {type:'json'};
import {C as P,verifyReceipt as verifyPassReceipt} from './original-bnb-pass-core.mjs';
import {expectedRuntime as adapterRuntime,readSui,newClient} from './original-bnb-core.mjs';
import {identity,quantity,walletRead,hashHex,saveState} from '../../play/multichaintest/setup/bnb/core.js';
import {createReadProvider} from '../../play/multichaintest/setup/bnb/configure/core.js';
export {createReadProvider,newClient,saveState};
export const C=Object.freeze({...P,pass:bindings.bnbPass,passDigest:bindings.bnbPassDigest,key:'nftree-original-bnb-binding-v2-1d3da001'});
export const DATA=encodeFunctionData({abi:reviewed.contracts.TreePassAdapter.abi,functionName:'bindPass',args:[C.pass]});
export const EVENT=Object.freeze({address:C.adapter,topics:Object.freeze([keccak256(toHex('PassBound(address)')),'0x'+C.pass.slice(2).toLowerCase().padStart(64,'0')]),data:'0x'});
const check=(v,m)=>{if(!v)throw Error(m);},same=(x,y)=>typeof x==='string'&&typeof y==='string'&&x.toLowerCase()===y.toLowerCase(),hashPattern=/^0x[0-9a-f]{64}$/i;
async function call(provider,to,name,inputs=[],args=[]){return walletRead(provider,{method:'eth_call',params:[{to,data:encodeFunctionData({abi:[{type:'function',name,inputs,outputs:[],stateMutability:'view'}],functionName:name,args})},'latest']});}
async function adapterState(provider,bound){
 await Promise.all([[C.adapter,adapterRuntime()],[C.endpoint,C.endpointSha256],[C.currency,C.currencySha256]].map(async([address,expected])=>{const code=await walletRead(provider,{method:'eth_getCode',params:[address,'latest']});check(address===C.adapter?same(code,expected):await hashHex(code)===expected,'Adapter, endpoint or USDT code changed.');}));
 const fields=[['binder',BigInt(C.from)],['suiPeer',BigInt(C.peer)],['route',BigInt(C.route)],['pass',bound?BigInt(C.pass):0n],['redemptionGas',30000000n],['redemptionSent',0n],['backingNFT',BigInt(C.nft)],['endpoint',BigInt(C.endpoint)]];
 // Small batches avoid overflowing public RPC limits while keeping read latency bounded.
 for(let i=0;i<fields.length;i+=3)await Promise.all(fields.slice(i,i+3).map(async([name,expected])=>{const actual=quantity(await call(provider,C.adapter,name));if(name==='pass'&&!bound&&actual===BigInt(C.pass))throw Error('The pass is already bound. Check its existing binding receipt.');check(actual===expected,'Adapter '+name+' changed.');}));
 const [eid,decimals,delegate]=await Promise.all([call(provider,C.endpoint,'eid'),call(provider,C.currency,'decimals'),call(provider,C.endpoint,'delegates',[{name:'sender',type:'address'}],[C.adapter])]);check(quantity(eid)===30102n&&quantity(decimals)===18n&&quantity(delegate)===BigInt(C.from),'Endpoint, currency or delegate changed.');
 return {bound};
}
export async function readContracts(provider,{bound=false,source=readSui}={}){
 const [sourceState,pass]=await Promise.all([source(),verifyPassReceipt(provider,C.passDigest,{readDeps:p=>adapterState(p,bound)})]);
 check(pass.status==='verified'&&same(pass.contractAddress,C.pass),'Confirmed pass receipt/address differs.');return {sourceState,pass,bound};
}
async function nonce(provider){const values=await Promise.all(['latest','pending'].map(async tag=>quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce')));check(values[0]===values[1],'The BNB wallet has a pending transaction. Check its activity first.');return values[0];}
export async function preflight(provider,{readState=readContracts,now=Date.now}={}){
 await identity(provider,C);await readState(provider,{bound:false});check(await hashHex(DATA)===intent.dataSha256,'Reviewed binding calldata changed.');const n=await nonce(provider),call={from:C.from,to:C.adapter,data:DATA,value:'0x0'};
 check(await walletRead(provider,{method:'eth_call',params:[call,'latest']})==='0x','Binding simulation returned an unexpected result.');const gas=quantity(await walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),'binding gas'),price=quantity(await walletRead(provider,{method:'eth_gasPrice'}),'gas price');check(gas>0n&&gas<=200000n&&price>0n,'Unexpected binding gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;check(fee<=10000000000000000n,'Estimated gas allowance exceeds 0.01 BNB.');check(quantity(await walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']}),'BNB balance')>=fee,'The BNB wallet needs more BNB for gas.');await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed. Refresh and review.');return {nonce:String(n),target:C.adapter,pass:C.pass,gas:String(gas),gasLimit:toHex(gasLimit),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return null;const s=JSON.parse(text);check(s&&['wallet_request','submitted','verified'].includes(s.status)&&/^(0|[1-9][0-9]*)$/.test(s.nonce)&&same(s.target,C.adapter),'Stored binding state needs review.');check(s.status==='wallet_request'||hashPattern.test(s.hash),'Stored binding hash is invalid.');return s;}
export async function requestBinding({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for binding coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this binding.');check(!loadState(storage),'A binding is pending or recorded. Check its receipt.');const quote=reviewedQuote();check(reviewed()&&quote&&now()>=quote.quotedAt&&now()-quote.quotedAt<=C.maxAge,'Simulate and review a fresh quote first.');const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage),'Another binding was recorded.');
 if(['nonce','target','gasLimitFeeWei','gas'].some(k=>ready[k]!==quote[k])||now()-quote.quotedAt>C.maxAge){onQuote(ready);throw Error('Nonce or gas estimate changed. Review the refreshed quote.');}
 await identity(provider,C);check(String(await nonce(provider))===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');const pending={status:'wallet_request',nonce:ready.nonce,target:C.adapter,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,pending);let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,to:C.adapter,chainId:C.chainId,value:'0x0',nonce:toHex(BigInt(ready.nonce)),data:DATA,gas:ready.gasLimit}]});}catch(e){if(e?.code===4001)storage.removeItem(C.key);throw e;}
 check(hashPattern.test(hash),'No valid hash returned. Check wallet activity before retrying.');const submitted={...pending,status:'submitted',hash};saveState(storage,C.key,submitted);return submitted;
 });
}
export async function verifyReceipt(provider,hash,{readState=readContracts}={}){
 check(hashPattern.test(hash),'Enter the BNB binding transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};check(same(receipt.transactionHash,hash)&&same(receipt.from,C.from)&&same(receipt.to,C.adapter)&&receipt.contractAddress===null&&quantity(receipt.status)===1n,'Wrong or failed binding receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&same(tx.to,C.adapter)&&quantity(tx.chainId)===56n&&quantity(tx.value)===0n&&same(tx.input,DATA),'Transaction differs from the reviewed binding.');
 const logs=receipt.logs;check(logs?.length===1&&same(logs[0].address,EVENT.address)&&logs[0].removed!==true&&same(logs[0].data,EVENT.data)&&logs[0].topics?.length===2&&EVENT.topics.every((t,i)=>same(t,logs[0].topics[i])),'The exact PassBound event is missing or changed.');await readState(provider,{bound:true});return {status:'verified',hash,nonce:String(quantity(tx.nonce)),target:C.adapter,pass:C.pass,blockNumber:receipt.blockNumber};
}
export async function recoverReceipt({provider,hash,storage,locks,verify=verifyReceipt}){check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{check(lock,'Another tab is handling this binding.');const old=loadState(storage);check(!old?.hash||same(old.hash,hash),'A different receipt is already recorded.');const result=await verify(provider,hash);if(result.status==='pending')return result;if(old)check(old.nonce===result.nonce&&same(old.target,result.target),'Receipt does not match the recorded request.');saveState(storage,C.key,result);return result;});}
