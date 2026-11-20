import {encodeFunctionData,keccak256,toHex} from 'viem';
import reviewed from '../../docs/multichain/bnb-one-slot/reviewed-artifacts.json' with {type:'json'};
import route from '../../docs/multichain/original-trial/bnb-route-unsigned.json' with {type:'json'};
import {C as B} from './original-bnb-bind-core.mjs';
import {expectedRuntime as passRuntime} from './original-bnb-pass-core.mjs';
import {expectedRuntime as adapterRuntime} from './original-bnb-core.mjs';
import {recoverReceipt as verifyAnnouncement,newClient} from './original-reserve-core.mjs';
import {identity,quantity,walletRead,hashHex,saveState} from '../../play/multichaintest/setup/bnb/core.js';
import {createReadProvider} from '../../play/multichaintest/setup/bnb/configure/core.js';
export {createReadProvider};
export const C=Object.freeze({...B,key:'nftree-original-enable-v1-1d3da001',announcement:'97udy89UfnUqZpTynesymkgSLrt3b61o5qZoMTgPUweK'});
export const DATA=encodeFunctionData({abi:reviewed.contracts.TreeSuitePass.abi,functionName:'setPurchasesPaused',args:[false]});
export const EVENT=Object.freeze({address:C.pass,topics:Object.freeze([keccak256(toHex('PurchasePauseChanged(bool)'))]),data:toHex(0n,{size:32})});
const check=(v,m)=>{if(!v)throw Error(m);},same=(x,y)=>typeof x==='string'&&typeof y==='string'&&x.toLowerCase()===y.toLowerCase(),hashPattern=/^0x[0-9a-f]{64}$/i;
async function call(provider,to,name,inputs=[],args=[],block='latest'){
 return walletRead(provider,{method:'eth_call',params:[{to,data:encodeFunctionData({abi:[{type:'function',name,inputs,outputs:[],stateMutability:'view'}],functionName:name,args})},block]});
}
export async function readSource(client=newClient()){
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const proof=await verifyAnnouncement(C.announcement,{client,storage});
 check(proof.status==='chain_verified'&&same(proof.vaultId,C.route)&&same(proof.nftId,C.nft),'Original backing announcement is not verified.');
 return proof;
}
export async function readContracts(provider,{paused,source=readSource}={}){
 await identity(provider,C);await source();const block=await walletRead(provider,{method:'eth_blockNumber'});quantity(block,'BNB block');
 for(const [address,expected] of [[C.adapter,adapterRuntime()],[C.pass,passRuntime()]])
  check(same(await walletRead(provider,{method:'eth_getCode',params:[address,block]}),expected),'Original contract runtime or immutable bindings changed.');
 for(const [to,sha]of Object.entries({...route.code,[C.currency]:C.currencySha256}))
  check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[to,block]}))===sha,'Protocol or currency runtime changed.');
 for(const r of route.reads){
  const actual=await walletRead(provider,{method:'eth_call',params:[{to:r.to,data:r.data},block]});
  check(same(actual,r.label==='Pass state'?toHex(1n,{size:32}):r.after),'LayerZero '+r.label+' differs from the verified Ready route.');
 }
 const fields=[['initialBuyer',BigInt(C.from)],['controller',BigInt(C.from)],['route',BigInt(C.route)],['currency',BigInt(C.currency)],['treasury',BigInt(C.treasury)],['PRICE',BigInt(C.price)],['TOKEN_ID',1n],['backingNFT',BigInt(C.nft)],['state',1n],['redemption',0n],['recipient',0n]];
 for(const [name,expected]of fields)check(quantity(await call(provider,C.pass,name,[],[],block))===expected,'Original pass '+name+' changed.');
 for(const [name,expected]of [['suiPeer',BigInt(C.peer)],['route',BigInt(C.route)],['backingNFT',BigInt(C.nft)],['binder',BigInt(C.from)],['redemptionGas',30000000n],['redemptionSent',0n]])
  check(quantity(await call(provider,C.adapter,name,[],[],block))===expected,'Original adapter '+name+' changed.');
 check(quantity(await call(provider,C.currency,'decimals',[],[],block))===18n,'BNB USDT decimals changed.');
 check(quantity(await call(provider,C.endpoint,'eid',[],[],block))===30102n,'Wrong BNB endpoint.');
 check(quantity(await call(provider,C.pass,'balanceOf',[{name:'owner',type:'address'}],[C.from],block))===0n,'Pass was already minted.');
 const pause=quantity(await call(provider,C.pass,'purchasesPaused',[],[],block));check(pause===0n||pause===1n,'Invalid pause flag.');
 if(paused!==undefined)check(pause===(paused?1n:0n),paused?'Purchases already enabled. Check the existing receipt.':'Purchases are still paused.');
 return {paused:pause===1n,block};
}
async function nonce(provider){const values=await Promise.all(['latest','pending'].map(async tag=>quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce')));check(values[0]===values[1],'The BNB wallet has a pending transaction. Check its activity first.');return values[0];}
export async function preflight(provider,{readState=readContracts,now=Date.now}={}){
 await identity(provider,C);await readState(provider,{paused:true});const n=await nonce(provider),call={from:C.from,to:C.pass,data:DATA,value:'0x0'};
 check(await walletRead(provider,{method:'eth_call',params:[call,'latest']})==='0x','Enablement simulation returned an unexpected result.');const gas=quantity(await walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),'purchase enablement gas'),price=quantity(await walletRead(provider,{method:'eth_gasPrice'}),'gas price');check(gas>0n&&gas<=100000n&&price>0n,'Unexpected purchase enablement gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;check(fee<=10000000000000000n,'Estimated gas allowance exceeds 0.01 BNB.');check(quantity(await walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']}),'BNB balance')>=fee,'The BNB wallet needs more BNB for gas.');await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed. Refresh and review.');return {nonce:String(n),target:C.pass,pass:C.pass,gas:String(gas),gasLimit:toHex(gasLimit),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return null;const s=JSON.parse(text);check(s&&['wallet_request','submitted','verified'].includes(s.status)&&/^(0|[1-9][0-9]*)$/.test(s.nonce)&&same(s.target,C.pass),'Stored purchase enablement state needs review.');check(s.status==='wallet_request'||hashPattern.test(s.hash),'Stored purchase enablement hash is invalid.');return s;}
export async function requestEnablement({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for purchase enablement coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this purchase enablement.');check(!loadState(storage),'A purchase enablement is pending or recorded. Check its receipt.');const quote=reviewedQuote();check(reviewed()&&quote&&now()>=quote.quotedAt&&now()-quote.quotedAt<=C.maxAge,'Simulate and review a fresh quote first.');const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage),'Another purchase enablement was recorded.');
 if(['nonce','target','gasLimitFeeWei','gas'].some(k=>ready[k]!==quote[k])||now()-quote.quotedAt>C.maxAge){onQuote(ready);throw Error('Nonce or gas estimate changed. Review the refreshed quote.');}
 await identity(provider,C);check(String(await nonce(provider))===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');const pending={status:'wallet_request',nonce:ready.nonce,target:C.pass,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,pending);let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,to:C.pass,chainId:C.chainId,value:'0x0',nonce:toHex(BigInt(ready.nonce)),data:DATA,gas:ready.gasLimit}]});}catch(e){if(e?.code===4001)storage.removeItem(C.key);throw e;}
 check(hashPattern.test(hash),'No valid hash returned. Check wallet activity before retrying.');const submitted={...pending,status:'submitted',hash};saveState(storage,C.key,submitted);return submitted;
 });
}
export async function verifyReceipt(provider,hash,{readState=readContracts}={}){
 check(hashPattern.test(hash),'Enter the BNB purchase enablement transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};check(same(receipt.transactionHash,hash)&&same(receipt.from,C.from)&&same(receipt.to,C.pass)&&receipt.contractAddress===null&&quantity(receipt.status)===1n,'Wrong or failed purchase enablement receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&same(tx.to,C.pass)&&quantity(tx.chainId)===56n&&quantity(tx.value)===0n&&same(tx.input,DATA),'Transaction differs from the reviewed purchase enablement.');
 const logs=receipt.logs;check(logs?.length===1&&same(logs[0].address,EVENT.address)&&logs[0].removed!==true&&same(logs[0].data,EVENT.data)&&logs[0].topics?.length===1&&EVENT.topics.every((t,i)=>same(t,logs[0].topics[i])),'The exact PurchasePauseChanged(false) event is missing or changed.');await readState(provider,{paused:false});return {status:'verified',hash,nonce:String(quantity(tx.nonce)),target:C.pass,pass:C.pass,blockNumber:receipt.blockNumber};
}
export async function recoverReceipt({provider,hash,storage,locks,verify=verifyReceipt,isCurrent=()=>true}){check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{check(lock,'Another tab is handling this purchase enablement.');const old=loadState(storage);check(!old?.hash||same(old.hash,hash),'A different receipt is already recorded.');const result=await verify(provider,hash);check(isCurrent(),'Wallet changed during receipt verification.');check(JSON.stringify(loadState(storage))===JSON.stringify(old),'Stored enablement changed during verification.');if(result.status==='pending')return result;if(old)check(old.nonce===result.nonce&&same(old.target,result.target),'Receipt does not match the recorded request.');saveState(storage,C.key,result);return result;});}
