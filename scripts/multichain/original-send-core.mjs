import {encodeFunctionData,encodeAbiParameters,encodePacked,keccak256,toHex,parseAbi,padHex,concatHex} from 'viem';
import route from '../../docs/multichain/original-trial/bnb-route-unsigned.json' with {type:'json'};
import {C as B,PAYLOAD,OPTIONS,QUOTE,verifyReceipt as verifyLockReceipt} from './original-redemption-core.mjs';
import {readSource} from './original-enable-core.mjs';
import {expectedRuntime as passRuntime} from './original-bnb-pass-core.mjs';
import {expectedRuntime as adapterRuntime} from './original-bnb-core.mjs';
import {identity,quantity,walletRead,hashHex,saveState} from '../../play/multichaintest/setup/bnb/core.js';
import {createReadProvider} from '../../play/multichaintest/setup/bnb/configure/core.js';
export {createReadProvider,PAYLOAD,OPTIONS};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
export const C=freeze({...B,key:'nftree-original-redemption-send-v1-90b5292a',lockReceipt:'0xb3913d8880bc662a2f40434f84691c87374a7cd9d8f0401ee77b6eec6e91b6a9'});
export const GUID=keccak256(encodePacked(['uint64','uint32','bytes32','uint32','bytes32'],[1n,30102,padHex(C.adapter,{size:32}),30378,C.peer]));
export const PACKET=concatHex([encodePacked(['uint8','uint64','uint32','bytes32','uint32','bytes32'],[1,1n,30102,padHex(C.adapter,{size:32}),30378,C.peer]),GUID,PAYLOAD]);
export const STEPS=freeze({send:{label:'Send redemption request to Sui',to:C.adapter,data:encodeFunctionData({abi:parseAbi(['function sendRedemption()']),functionName:'sendRedemption'}),events:[
 {address:C.endpoint,topics:[keccak256(toHex('PacketSent(bytes,bytes,address)'))],data:encodeAbiParameters([{type:'bytes'},{type:'bytes'},{type:'address'}],[PACKET,OPTIONS,route.sendLibrary])},
 {address:C.adapter,topics:[keccak256(toHex('RedemptionSent(bytes32,bytes32)')),GUID,C.request],data:'0x'}
]}});
const check=(v,m)=>{if(!v)throw Error(m);},same=(x,y)=>typeof x==='string'&&typeof y==='string'&&x.toLowerCase()===y.toLowerCase(),validHash=h=>/^0x[0-9a-f]{64}$/i.test(h??''),action=a=>a==='send';
async function call(provider,to,name,inputs=[],args=[],block='latest'){
 return walletRead(provider,{method:'eth_call',params:[{to,data:encodeFunctionData({abi:[{type:'function',name,inputs,outputs:[],stateMutability:'view'}],functionName:name,args})},block]});
}
export function resolveAction(s){
 check(s.allowance==='0'&&s.canPlay==='0','Allowance or BNB access changed.');
 if(s.passState==='3')check(s.passBalance==='1'&&same(s.owner,C.from),'Locked original pass ownership changed.');
 else check(s.passState==='4'&&s.passBalance==='0','Original pass is not Locked or Retired.');
 check(['0','1'].includes(s.sent)&&s.outboundNonce===s.sent,'One-shot send flag and outbound nonce differ.');
 if(s.sent==='0'){check(s.passState==='3','An unsent request cannot be retired.');return 'send'}return 'complete';
}
export async function readSend(provider,{source=readSource}={}){
 await identity(provider,C);const hint=quantity(await call(provider,C.adapter,'redemptionSent'));check(hint===0n||hint===1n,'Invalid redemption send flag.');if(hint===0n)await source();const block=await walletRead(provider,{method:'eth_blockNumber'});quantity(block,'BNB block');const passState=quantity(await call(provider,C.pass,'state',[],[],block));check(passState===3n||passState===4n,'Original pass must be Locked or Retired.');const sent=quantity(await call(provider,C.adapter,'redemptionSent',[],[],block));check(sent===0n||sent===1n,'Invalid send flag.');check(hint===0n||sent===1n,'One-shot send state regressed.');
 for(const [address,expected] of [[C.adapter,adapterRuntime()],[C.pass,passRuntime()]])
  check(same(await walletRead(provider,{method:'eth_getCode',params:[address,block]}),expected),'Original contract runtime or immutable bindings changed.');
 for(const [to,sha]of Object.entries({...route.code,[C.currency]:C.currencySha256}))
  check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[to,block]}))===sha,'Protocol or currency runtime changed.');
 for(const r of route.reads){
  const actual=await walletRead(provider,{method:'eth_call',params:[{to:r.to,data:r.data},block]});
  check(same(actual,r.label==='Pass state'?toHex(passState,{size:32}):r.after),'LayerZero '+r.label+' differs from the verified Ready route.');
 }
 const fields=[['initialBuyer',BigInt(C.from)],['controller',BigInt(C.from)],['route',BigInt(C.route)],['currency',BigInt(C.currency)],['treasury',BigInt(C.treasury)],['PRICE',BigInt(C.price)],['TOKEN_ID',1n],['backingNFT',BigInt(C.nft)],['state',passState],['redemption',BigInt(C.request)],['recipient',BigInt(C.recipient)]];
 for(const [name,expected]of fields)check(quantity(await call(provider,C.pass,name,[],[],block))===expected,'Original pass '+name+' changed.');
 for(const [name,expected]of [['suiPeer',BigInt(C.peer)],['route',BigInt(C.route)],['backingNFT',BigInt(C.nft)],['binder',BigInt(C.from)],['redemptionGas',30000000n],['redemptionSent',sent],['redemptionGuid',sent===1n?BigInt(GUID):0n],['pass',BigInt(C.pass)]])
  check(quantity(await call(provider,C.adapter,name,[],[],block))===expected,'Original adapter '+name+' changed.');
 check(quantity(await call(provider,C.currency,'decimals',[],[],block))===18n,'BNB USDT decimals changed.');
 check(quantity(await call(provider,C.endpoint,'eid',[],[],block))===30102n,'Wrong BNB endpoint.');
 const amount=async(to,name,inputs=[],args=[])=>quantity(await call(provider,to,name,inputs,args,block));
 const addr=[{name:'owner',type:'address'}],buyer=[C.from];
 const tokenBalance=String(await amount(C.currency,'balanceOf',addr,buyer));
 const allowance=String(await amount(C.currency,'allowance',[{name:'owner',type:'address'},{name:'spender',type:'address'}],[C.from,C.pass]));
 const passBalance=String(await amount(C.pass,'balanceOf',addr,buyer));
 const canPlay=String(await amount(C.pass,'canPlay',addr,buyer));
 const paused=await amount(C.pass,'purchasesPaused');check(paused===0n,'The original purchase is paused.');
 let owner;if(passState===3n){const value=await call(provider,C.pass,'ownerOf',[{name:'tokenId',type:'uint256'}],[1n],block);check(/^0x0{24}[0-9a-f]{40}$/i.test(value),'Invalid pass owner.');owner='0x'+value.slice(-40);}
 const outboundNonce=String(quantity(await call(provider,C.endpoint,'outboundNonce',[{name:'sender',type:'address'},{name:'dstEid',type:'uint32'},{name:'receiver',type:'bytes32'}],[C.adapter,30378,C.peer],block)));
 if(passState===3n)check(same(await call(provider,C.adapter,'redemptionPayload',[],[],block),encodeAbiParameters([{type:'bytes'}],[PAYLOAD])),'On-chain redemption payload differs from the fixed original request.');
 check(same(await call(provider,C.adapter,'redemptionOptions',[],[],block),encodeAbiParameters([{type:'bytes'}],[OPTIONS])),'Destination gas or delivery options changed.');
 const state={block,passState:String(passState),tokenBalance,allowance,passBalance,canPlay,owner,sent:String(sent),outboundNonce};return {...state,action:resolveAction(state),destinationStatus:'not_verified'};
}
async function nonce(provider){const values=await Promise.all(['latest','pending'].map(async tag=>quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce')));check(values[0]===values[1],'A BNB wallet transaction is pending. Check its receipt first.');return String(values[0]);}
export async function quoteFee(provider,block='latest'){
 const raw=await call(provider,C.adapter,'quoteRedemption',[],[],block),direct=await walletRead(provider,{method:'eth_call',params:[QUOTE,block]});
 check(/^0x[0-9a-f]{128}$/i.test(raw)&&same(raw,direct),'Adapter and fixed endpoint quotes differ.');
 const fee=BigInt('0x'+raw.slice(2,66));check(fee>0n&&fee<=BigInt(C.maxFeeWei)&&BigInt('0x'+raw.slice(66))===0n,'LayerZero native fee exceeds 0.006 BNB or requires LZ tokens.');return String(fee);
}
export function verifySimulation(raw,valueWei){
 check(/^0x[0-9a-f]{256}$/i.test(raw)&&same('0x'+raw.slice(2,66),GUID)&&BigInt('0x'+raw.slice(66,130))===1n&&BigInt('0x'+raw.slice(130,194))>0n&&BigInt('0x'+raw.slice(130,194))<=BigInt(valueWei)&&BigInt('0x'+raw.slice(194))===0n,'Send simulation returned a different GUID, nonce or fee.');
}
export async function preflight(provider,{read=readSend,lock=verifyLockReceipt,now=Date.now}={}){
 await identity(provider,C);const state=await read(provider);
 // Independently verified current send-phase state replaces only the historical
 // lock helper's poststate callback. Its exact lock transaction/events are retained.
 const proof=await lock(provider,C.lockReceipt,{read:async()=>({action:'complete'})});check(proof.status==='verified'&&proof.action==='lock','The actual original-backed lock receipt is not verified.');
 if(state.action==='complete')return {...state,quotedAt:now()};
 const feeWei=await quoteFee(provider,state.block),n=await nonce(provider),step=STEPS.send,call={from:C.from,to:step.to,data:step.data,value:toHex(BigInt(feeWei))};
 verifySimulation(await walletRead(provider,{method:'eth_call',params:[call,'latest']}),feeWei);
 const [gas,price,balance]=await Promise.all([walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),walletRead(provider,{method:'eth_gasPrice'}),walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']})].map(async x=>quantity(await x)));
 check(gas>0n&&gas<=1500000n&&price>0n,'Unexpected send gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;
 check(fee<=10000000000000000n,'Buffered network gas exceeds 0.01 BNB.');
 const requiredBalanceWei=fee+BigInt(feeWei),funded=balance>=requiredBalanceWei;
 await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed. Refresh and review.');
 return {...state,action:funded?'send':'fund',balanceWei:String(balance),requiredBalanceWei:String(requiredBalanceWei),shortfallWei:String(funded?0n:requiredBalanceWei-balance),nonce:n,target:step.to,feeWei,gas:String(gas),gasLimit:toHex(gasLimit),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
function validRecord(r){return r&&action(r.action)&&/^(0|[1-9][0-9]*)$/.test(r.nonce)&&same(r.target,STEPS[r.action].to)&&/^[1-9][0-9]*$/.test(r.valueWei)&&BigInt(r.valueWei)<=BigInt(C.maxFeeWei)&&(!r.hash||validHash(r.hash))}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return {receipts:[]};const s=JSON.parse(text);check(s&&Array.isArray(s.receipts)&&s.receipts.every(r=>validRecord(r)&&r.status==='verified'&&validHash(r.hash))&&(!s.pending||validRecord(s.pending)),'Stored redemption state needs review. Check wallet activity before another request.');return s;}
export async function requestSend({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for redemption coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this redemption.');check(!loadState(storage).pending,'A wallet request is recorded. Recover its receipt first.');const quote=reviewedQuote();check(reviewed()&&quote&&action(quote.action)&&now()>=quote.quotedAt&&now()-quote.quotedAt<=C.maxAge,'Simulate and review a fresh redemption step first.');
 const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage).pending,'Another request was recorded.');
 if(['action','nonce','target','gas','gasLimitFeeWei','feeWei'].some(k=>ready[k]!==quote[k])||now()-quote.quotedAt>C.maxAge){onQuote(ready);throw Error('Redemption progress, nonce or gas changed. Review the refreshed step.');}
 check(/^[1-9][0-9]*$/.test(ready.feeWei)&&BigInt(ready.feeWei)<=BigInt(C.maxFeeWei)&&same(ready.target,STEPS.send.to),'Native fee or adapter target exceeds the fixed send plan.');check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired.');await identity(provider,C);check(await nonce(provider)===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');
 const prior=loadState(storage),pending={action:ready.action,nonce:ready.nonce,target:ready.target,valueWei:ready.feeWei,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,{...prior,pending});let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,to:pending.target,chainId:C.chainId,nonce:toHex(BigInt(pending.nonce)),value:toHex(BigInt(pending.valueWei)),data:STEPS[pending.action].data,gas:ready.gasLimit}]})}catch(e){if(e?.code===4001)saveState(storage,C.key,prior);throw e}
 check(validHash(hash),'No valid submission hash returned. Check wallet activity before retrying.');const submitted={...prior,pending:{...pending,hash}};saveState(storage,C.key,submitted);return submitted;
 });
}
export async function verifyReceipt(provider,hash,{read=readSend}={}){
 check(validHash(hash),'Enter a BNB redemption-step transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};
 check(same(receipt.transactionHash,hash)&&quantity(receipt.status)===1n&&same(receipt.from,C.from)&&receipt.contractAddress===null,'Wrong or failed redemption receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&quantity(tx.chainId)===56n&&quantity(tx.value)>0n&&quantity(tx.value)<=BigInt(C.maxFeeWei),'Wrong redemption transaction identity.');
 const name=Object.keys(STEPS).find(a=>same(tx.to,STEPS[a].to)&&same(tx.input,STEPS[a].data));check(name&&same(receipt.to,STEPS[name].to),'Adapter target or fixed send calldata differs from review.');const step=STEPS[name];
 const matches=(e,l)=>same(l.address,e.address)&&same(l.data,e.data)&&l.removed!==true&&l.topics?.length===e.topics.length&&e.topics.every((v,j)=>same(v,l.topics[j]));
 check(Array.isArray(receipt.logs)&&step.events.every(e=>receipt.logs.filter(l=>same(l.address,e.address)&&same(l.topics?.[0],e.topics[0])).length===1&&receipt.logs.filter(l=>matches(e,l)).length===1),'Exact LayerZero packet/options/library or adapter GUID/request event differs.');
 const state=await read(provider);check(state.action==='complete','The one-shot send state does not reflect this receipt.');await identity(provider,C);
 return {status:'verified',hash,action:name,nonce:String(quantity(tx.nonce)),target:step.to,valueWei:String(quantity(tx.value)),guid:GUID,destinationStatus:'not_verified',blockNumber:receipt.blockNumber,liveAction:state.action};
}
export async function recoverReceipt({provider,hash,storage,locks,isCurrent=()=>true,verify=verifyReceipt}){
 check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is checking this redemption.');const prior=loadState(storage);if(prior.pending?.hash)check(same(prior.pending.hash,hash),'A different transaction is recorded.');const r=await verify(provider,hash);
 check(isCurrent(),'Wallet changed during receipt verification.');check(JSON.stringify(loadState(storage))===JSON.stringify(prior),'Stored redemption state changed during verification.');if(r.status==='pending')return r;
 if(prior.pending)check(r.action===prior.pending.action&&r.nonce===prior.pending.nonce&&same(r.target,prior.pending.target)&&r.valueWei===prior.pending.valueWei,'Receipt does not match the recorded request.');
 saveState(storage,C.key,{receipts:[...prior.receipts.filter(x=>!same(x.hash,hash)),r]});return r;
 });
}
