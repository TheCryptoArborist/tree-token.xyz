import {encodeFunctionData,encodeAbiParameters,encodePacked,keccak256,toHex,parseAbi} from 'viem';
import route from '../../docs/multichain/original-trial/bnb-route-unsigned.json' with {type:'json'};
import {C as B,readSource} from './original-enable-core.mjs';
import {verifyReceipt as verifyPurchaseReceipt} from './original-purchase-core.mjs';
import {expectedRuntime as passRuntime} from './original-bnb-pass-core.mjs';
import {expectedRuntime as adapterRuntime} from './original-bnb-core.mjs';
import {identity,quantity,walletRead,hashHex,saveState} from '../../play/multichaintest/setup/bnb/core.js';
import {createReadProvider} from '../../play/multichaintest/setup/bnb/configure/core.js';
export {createReadProvider};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
const recipient='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
const request=keccak256(encodeAbiParameters([{type:'uint8'},{type:'uint256'},{type:'address'},{type:'bytes32'},{type:'bytes32'},{type:'uint256'},{type:'address'},{type:'bytes32'}],[2,56n,B.pass,B.route,B.nft,1n,B.from,recipient]));
export const C=freeze({...B,key:'nftree-original-redemption-lock-v1-1d3da001',recipient,request,maxFeeWei:'6000000000000000',purchase:'0x2a98b797478a92ca5000038208b6e9ea2746889bfff87fc8e64243ccd77552c5'});
export const PAYLOAD=encodePacked(['uint8','uint8','bytes32','bytes32','bytes32','bytes32'],[2,2,C.route,C.nft,C.request,C.recipient]);
export const OPTIONS='0x00030100110100000000000000000000000001c9c380';
const check=(v,m)=>{if(!v)throw Error(m);},same=(x,y)=>typeof x==='string'&&typeof y==='string'&&x.toLowerCase()===y.toLowerCase(),validHash=h=>/^0x[0-9a-f]{64}$/i.test(h??''),action=a=>a==='lock';
export const STEPS=freeze({lock:{label:'Lock pass #1 for Sui wallet ending 45c4',to:C.pass,data:encodeFunctionData({abi:parseAbi(['function requestRedemption(bytes32 suiRecipient) returns (bytes32)']),functionName:'requestRedemption',args:[C.recipient]}),events:[{address:C.pass,topics:[keccak256(toHex('RedemptionRequested(bytes32,bytes32,bytes32)')),C.request,C.nft],data:C.recipient}]}});
export const QUOTE={to:C.endpoint,data:encodeFunctionData({abi:parseAbi(['function quote((uint32 dstEid,bytes32 receiver,bytes message,bytes options,bool payInLzToken) params,address sender) view returns ((uint256 nativeFee,uint256 lzTokenFee))']),functionName:'quote',args:[{dstEid:30378,receiver:C.peer,message:PAYLOAD,options:OPTIONS,payInLzToken:false},C.adapter]})};
async function call(provider,to,name,inputs=[],args=[],block='latest'){
 return walletRead(provider,{method:'eth_call',params:[{to,data:encodeFunctionData({abi:[{type:'function',name,inputs,outputs:[],stateMutability:'view'}],functionName:name,args})},block]});
}
export function resolveAction({passState,allowance,passBalance,canPlay,owner}){
 check(allowance==='0'&&passBalance==='1'&&same(owner,C.from),'Original pass ownership or zero remaining allowance changed.');
 if(passState==='2'){check(canPlay==='1','Active access check changed.');return 'lock'}
 check(passState==='3'&&canPlay==='0','Original pass is not locked for redemption.');return 'complete';
}
export async function readRedemption(provider,{source=readSource}={}){
 await identity(provider,C);await source();const block=await walletRead(provider,{method:'eth_blockNumber'});quantity(block,'BNB block');const passState=quantity(await call(provider,C.pass,'state',[],[],block));check(passState===2n||passState===3n,'The original pass is not Active or Locked.');
 for(const [address,expected] of [[C.adapter,adapterRuntime()],[C.pass,passRuntime()]])
  check(same(await walletRead(provider,{method:'eth_getCode',params:[address,block]}),expected),'Original contract runtime or immutable bindings changed.');
 for(const [to,sha]of Object.entries({...route.code,[C.currency]:C.currencySha256}))
  check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[to,block]}))===sha,'Protocol or currency runtime changed.');
 for(const r of route.reads){
  const actual=await walletRead(provider,{method:'eth_call',params:[{to:r.to,data:r.data},block]});
  check(same(actual,r.label==='Pass state'?toHex(passState,{size:32}):r.after),'LayerZero '+r.label+' differs from the verified Ready route.');
 }
 const fields=[['initialBuyer',BigInt(C.from)],['controller',BigInt(C.from)],['route',BigInt(C.route)],['currency',BigInt(C.currency)],['treasury',BigInt(C.treasury)],['PRICE',BigInt(C.price)],['TOKEN_ID',1n],['backingNFT',BigInt(C.nft)],['state',passState],['redemption',passState===3n?BigInt(C.request):0n],['recipient',passState===3n?BigInt(C.recipient):0n]];
 for(const [name,expected]of fields)check(quantity(await call(provider,C.pass,name,[],[],block))===expected,'Original pass '+name+' changed.');
 for(const [name,expected]of [['suiPeer',BigInt(C.peer)],['route',BigInt(C.route)],['backingNFT',BigInt(C.nft)],['binder',BigInt(C.from)],['redemptionGas',30000000n],['redemptionSent',0n]])
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
 let owner;if(passState===2n||passState===3n){const value=await call(provider,C.pass,'ownerOf',[{name:'tokenId',type:'uint256'}],[1n],block);check(/^0x0{24}[0-9a-f]{40}$/i.test(value),'Invalid pass owner.');owner='0x'+value.slice(-40);}
 const state={block,passState:String(passState),tokenBalance,allowance,passBalance,canPlay,owner};check(quantity(await call(provider,C.endpoint,'outboundNonce',[{name:'sender',type:'address'},{name:'dstEid',type:'uint32'},{name:'receiver',type:'bytes32'}],[C.adapter,30378,C.peer],block))===0n,'A redemption message already exists. Verify delivery before using this lock-only page.');return {...state,action:resolveAction(state)};
}
async function nonce(provider){const values=await Promise.all(['latest','pending'].map(async tag=>quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce')));check(values[0]===values[1],'A BNB wallet transaction is pending. Check its receipt first.');return String(values[0]);}
export async function quoteFee(provider,block='latest'){
 const raw=await walletRead(provider,{method:'eth_call',params:[QUOTE,block]});check(/^0x[0-9a-f]{128}$/i.test(raw),'Invalid prospective LayerZero fee quote.');
 const fee=BigInt('0x'+raw.slice(2,66));check(fee>0n&&fee<=BigInt(C.maxFeeWei)&&BigInt('0x'+raw.slice(66))===0n,'Prospective LayerZero fee exceeds 0.006 BNB or requires LZ tokens.');return String(fee);
}
export async function preflight(provider,{read=readRedemption,purchase=verifyPurchaseReceipt,now=Date.now}={}){
 await identity(provider,C);const state=await read(provider);
 // Historical purchase validation uses this stage's independently checked current state;
 // the old purchase validator intentionally rejects Locked, so it is not weakened.
 const proof=await purchase(provider,C.purchase,{read:async()=>({action:'complete'})});check(proof.status==='verified'&&proof.action==='buy','The actual original-backed purchase receipt is not verified.');
 if(state.action==='complete')return {...state,quotedAt:now()};
 const feeWei=await quoteFee(provider,state.block),n=await nonce(provider),step=STEPS.lock,call={from:C.from,to:step.to,data:step.data,value:'0x0'};
 check(same(await walletRead(provider,{method:'eth_call',params:[call,'latest']}),C.request),'Lock simulation returned a different request or recipient.');
 const [gas,price,balance]=await Promise.all([walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),walletRead(provider,{method:'eth_gasPrice'}),walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']})].map(async x=>quantity(await x)));
 check(gas>0n&&gas<=700000n&&price>0n,'Unexpected lock gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;
 check(fee<=10000000000000000n,'Buffered gas estimate exceeds 0.01 BNB.');
 const requiredBalanceWei=fee+BigInt(feeWei)+2000000n*price,funded=balance>=requiredBalanceWei;
 await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed. Refresh and review.');
 return {...state,action:funded?'lock':'fund',balanceWei:String(balance),requiredBalanceWei:String(requiredBalanceWei),shortfallWei:String(funded?0n:requiredBalanceWei-balance),nonce:n,target:step.to,feeWei,gas:String(gas),gasLimit:toHex(gasLimit),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
function validRecord(r){return r&&action(r.action)&&/^(0|[1-9][0-9]*)$/.test(r.nonce)&&same(r.target,STEPS[r.action].to)&&(!r.hash||validHash(r.hash))}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return {receipts:[]};const s=JSON.parse(text);check(s&&Array.isArray(s.receipts)&&s.receipts.every(r=>validRecord(r)&&r.status==='verified'&&validHash(r.hash))&&(!s.pending||validRecord(s.pending)),'Stored redemption state needs review. Check wallet activity before another request.');return s;}
export async function requestRedemption({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for redemption coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this redemption.');check(!loadState(storage).pending,'A wallet request is recorded. Recover its receipt first.');const quote=reviewedQuote();check(reviewed()&&quote&&action(quote.action)&&now()>=quote.quotedAt&&now()-quote.quotedAt<=C.maxAge,'Simulate and review a fresh redemption step first.');
 const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage).pending,'Another request was recorded.');
 if(['action','nonce','target','gas','gasLimitFeeWei','feeWei'].some(k=>ready[k]!==quote[k])||now()-quote.quotedAt>C.maxAge){onQuote(ready);throw Error('Redemption progress, nonce or gas changed. Review the refreshed step.');}
 check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired.');await identity(provider,C);check(await nonce(provider)===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');
 const prior=loadState(storage),pending={action:ready.action,nonce:ready.nonce,target:ready.target,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,{...prior,pending});let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,to:pending.target,chainId:C.chainId,nonce:toHex(BigInt(pending.nonce)),value:'0x0',data:STEPS[pending.action].data,gas:ready.gasLimit}]})}catch(e){if(e?.code===4001)saveState(storage,C.key,prior);throw e}
 check(validHash(hash),'No valid submission hash returned. Check wallet activity before retrying.');const submitted={...prior,pending:{...pending,hash}};saveState(storage,C.key,submitted);return submitted;
 });
}
export async function verifyReceipt(provider,hash,{read=readRedemption}={}){
 check(validHash(hash),'Enter a BNB redemption-step transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};
 check(same(receipt.transactionHash,hash)&&quantity(receipt.status)===1n&&same(receipt.from,C.from)&&receipt.contractAddress===null,'Wrong or failed redemption receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&quantity(tx.chainId)===56n&&quantity(tx.value)===0n,'Wrong redemption transaction identity.');
 const name=Object.keys(STEPS).find(a=>same(tx.to,STEPS[a].to)&&same(tx.input,STEPS[a].data));check(name&&same(receipt.to,STEPS[name].to),'Pass target, fixed recipient or lock calldata differs from review.');const step=STEPS[name];
 check(receipt.logs?.length===step.events.length&&step.events.every((e,i)=>{const l=receipt.logs[i];return same(l.address,e.address)&&same(l.data,e.data)&&l.removed!==true&&l.topics?.length===e.topics.length&&e.topics.every((v,j)=>same(v,l.topics[j]))}),'Exact redemption request, original NFT or fixed recipient event differs.');
 const state=await read(provider);check(state.action==='complete','Current pass or allowance does not reflect this receipt.');await identity(provider,C);
 return {status:'verified',hash,action:name,nonce:String(quantity(tx.nonce)),target:step.to,blockNumber:receipt.blockNumber,liveAction:state.action};
}
export async function recoverReceipt({provider,hash,storage,locks,isCurrent=()=>true,verify=verifyReceipt}){
 check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is checking this redemption.');const prior=loadState(storage);if(prior.pending?.hash)check(same(prior.pending.hash,hash),'A different transaction is recorded.');const r=await verify(provider,hash);
 check(isCurrent(),'Wallet changed during receipt verification.');check(JSON.stringify(loadState(storage))===JSON.stringify(prior),'Stored redemption state changed during verification.');if(r.status==='pending')return r;
 if(prior.pending)check(r.action===prior.pending.action&&r.nonce===prior.pending.nonce&&same(r.target,prior.pending.target),'Receipt does not match the recorded request.');
 saveState(storage,C.key,{receipts:[...prior.receipts.filter(x=>!same(x.hash,hash)),r]});return r;
 });
}
