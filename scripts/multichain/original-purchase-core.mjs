import {encodeFunctionData,toHex,parseAbi} from 'viem';
import plan from '../../docs/multichain/original-trial/purchase-plan.json' with {type:'json'};
import route from '../../docs/multichain/original-trial/bnb-route-unsigned.json' with {type:'json'};
import {C as B,readSource,verifyReceipt as verifyEnablement} from './original-enable-core.mjs';
import {expectedRuntime as passRuntime} from './original-bnb-pass-core.mjs';
import {expectedRuntime as adapterRuntime} from './original-bnb-core.mjs';
import {identity,quantity,walletRead,hashHex,saveState} from '../../play/multichaintest/setup/bnb/core.js';
import {createReadProvider} from '../../play/multichaintest/setup/bnb/configure/core.js';
export {createReadProvider};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
export const C=freeze({...B,key:'nftree-original-purchase-v1-1d3da001',enablement:'0xbed02845217412a516a77167a9cf1d2edec25965c6d9568d2c096b8ca1c26830'}),STEPS=freeze(plan.steps);
const check=(v,m)=>{if(!v)throw Error(m);},same=(x,y)=>typeof x==='string'&&typeof y==='string'&&x.toLowerCase()===y.toLowerCase(),validHash=h=>/^0x[0-9a-f]{64}$/i.test(h??''),action=a=>['reset','approve','buy'].includes(a);
check(same(plan.pass,C.pass)&&same(plan.from,C.from)&&same(plan.currency,C.currency)&&same(plan.treasury,C.treasury)&&plan.price===C.price&&plan.chainId===C.chainId&&same(plan.nft,C.nft)&&same(plan.route,C.route),'Purchase plan identity changed.');
const fixedAbi=parseAbi(['function approve(address spender,uint256 amount)','function buy()']);
for(const [name,to,functionName,args]of [['reset',C.currency,'approve',[C.pass,0n]],['approve',C.currency,'approve',[C.pass,BigInt(C.price)]],['buy',C.pass,'buy',[]]])
 check(same(STEPS[name].to,to)&&same(STEPS[name].data,encodeFunctionData({abi:fixedAbi,functionName,args})),'Purchase target, spender or amount changed.');
async function call(provider,to,name,inputs=[],args=[],block='latest'){
 return walletRead(provider,{method:'eth_call',params:[{to,data:encodeFunctionData({abi:[{type:'function',name,inputs,outputs:[],stateMutability:'view'}],functionName:name,args})},block]});
}
export function resolveAction({passState,allowance,passBalance,canPlay,owner}){
 if(passState==='2'){check(passBalance==='1'&&canPlay==='1'&&same(owner,C.from)&&allowance==='0','Active pass ownership, access check or remaining allowance changed.');return 'complete'}
 check(passState==='1'&&passBalance==='0'&&canPlay==='0','Original reserve is not Ready for this buyer.');
 return allowance===C.price?'buy':allowance==='0'?'approve':'reset';
}
export async function readPurchase(provider,{source=readSource}={}){
 await identity(provider,C);await source();const block=await walletRead(provider,{method:'eth_blockNumber'});quantity(block,'BNB block');const passState=quantity(await call(provider,C.pass,'state',[],[],block));check(passState===1n||passState===2n,'The original pass is not Ready or Active.');
 for(const [address,expected] of [[C.adapter,adapterRuntime()],[C.pass,passRuntime()]])
  check(same(await walletRead(provider,{method:'eth_getCode',params:[address,block]}),expected),'Original contract runtime or immutable bindings changed.');
 for(const [to,sha]of Object.entries({...route.code,[C.currency]:C.currencySha256}))
  check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[to,block]}))===sha,'Protocol or currency runtime changed.');
 for(const r of route.reads){
  const actual=await walletRead(provider,{method:'eth_call',params:[{to:r.to,data:r.data},block]});
  check(same(actual,r.label==='Pass state'?toHex(passState,{size:32}):r.after),'LayerZero '+r.label+' differs from the verified Ready route.');
 }
 const fields=[['initialBuyer',BigInt(C.from)],['controller',BigInt(C.from)],['route',BigInt(C.route)],['currency',BigInt(C.currency)],['treasury',BigInt(C.treasury)],['PRICE',BigInt(C.price)],['TOKEN_ID',1n],['backingNFT',BigInt(C.nft)],['state',passState],['redemption',0n],['recipient',0n]];
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
 let owner;if(passState===2n){const value=await call(provider,C.pass,'ownerOf',[{name:'tokenId',type:'uint256'}],[1n],block);check(/^0x0{24}[0-9a-f]{40}$/i.test(value),'Invalid pass owner.');owner='0x'+value.slice(-40);}
 const state={block,passState:String(passState),tokenBalance,allowance,passBalance,canPlay,owner};return {...state,action:resolveAction(state)};
}
async function nonce(provider){const values=await Promise.all(['latest','pending'].map(async tag=>quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce')));check(values[0]===values[1],'A BNB wallet transaction is pending. Check its receipt first.');return String(values[0]);}
export async function preflight(provider,{read=readPurchase,enable=verifyEnablement,now=Date.now}={}){
 await identity(provider,C);
 const enabled=await enable(provider,C.enablement,{readState:async()=>({})});check(enabled.status==='verified','The actual enablement receipt is not verified.');
 const state=await read(provider);if(state.action==='complete')return {...state,quotedAt:now()};
 check(BigInt(state.tokenBalance)>=BigInt(C.price),'This wallet needs at least 25 USDT on BNB Smart Chain.');
 const n=await nonce(provider),step=STEPS[state.action],call={from:C.from,to:step.to,data:step.data,value:'0x0'};
 const simulation=await walletRead(provider,{method:'eth_call',params:[call,'latest']});check(state.action==='buy'?simulation==='0x':simulation===toHex(1n,{size:32}),'Purchase-step simulation did not return the expected success result.');
 const [gas,price,balance]=await Promise.all([walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),walletRead(provider,{method:'eth_gasPrice'}),walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']})].map(async x=>quantity(await x)));
 check(gas>0n&&gas<=700000n&&price>0n,'Unexpected purchase gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;check(fee<=10000000000000000n,'Buffered gas estimate exceeds 0.01 BNB.');check(balance>=fee,'More BNB is needed for network gas.');await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed. Refresh and review.');
 return {...state,nonce:n,target:step.to,gas:String(gas),gasLimit:toHex(gasLimit),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
function validRecord(r){return r&&action(r.action)&&/^(0|[1-9][0-9]*)$/.test(r.nonce)&&same(r.target,STEPS[r.action].to)&&(!r.hash||validHash(r.hash))}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return {receipts:[]};const s=JSON.parse(text);check(s&&Array.isArray(s.receipts)&&s.receipts.every(r=>validRecord(r)&&r.status==='verified'&&validHash(r.hash))&&(!s.pending||validRecord(s.pending)),'Stored purchase state needs review. Check wallet activity before another request.');return s;}
export async function requestPurchase({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for purchase coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this purchase.');check(!loadState(storage).pending,'A wallet request is recorded. Recover its receipt first.');const quote=reviewedQuote();check(reviewed()&&quote&&action(quote.action)&&now()>=quote.quotedAt&&now()-quote.quotedAt<=C.maxAge,'Simulate and review a fresh purchase step first.');
 const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage).pending,'Another request was recorded.');
 if(['action','nonce','target','gas','gasLimitFeeWei'].some(k=>ready[k]!==quote[k])||now()-quote.quotedAt>C.maxAge){onQuote(ready);throw Error('Purchase progress, nonce or gas changed. Review the refreshed step.');}
 check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired.');await identity(provider,C);check(await nonce(provider)===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');
 const prior=loadState(storage),pending={action:ready.action,nonce:ready.nonce,target:ready.target,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,{...prior,pending});let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,to:pending.target,chainId:C.chainId,nonce:toHex(BigInt(pending.nonce)),value:'0x0',data:STEPS[pending.action].data,gas:ready.gasLimit}]})}catch(e){if(e?.code===4001)saveState(storage,C.key,prior);throw e}
 check(validHash(hash),'No valid submission hash returned. Check wallet activity before retrying.');const submitted={...prior,pending:{...pending,hash}};saveState(storage,C.key,submitted);return submitted;
 });
}
export async function verifyReceipt(provider,hash,{read=readPurchase}={}){
 check(validHash(hash),'Enter a BNB purchase-step transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};
 check(same(receipt.transactionHash,hash)&&quantity(receipt.status)===1n&&same(receipt.from,C.from)&&receipt.contractAddress===null,'Wrong or failed purchase receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&quantity(tx.chainId)===56n&&quantity(tx.value)===0n,'Wrong purchase transaction identity.');
 const name=Object.keys(STEPS).find(a=>same(tx.to,STEPS[a].to)&&same(tx.input,STEPS[a].data));check(name&&same(receipt.to,STEPS[name].to),'Payment amount, spender or calldata differs from this purchase.');const step=STEPS[name];
 check(receipt.logs?.length===step.events.length&&step.events.every((e,i)=>{const l=receipt.logs[i];return same(l.address,e.address)&&same(l.data,e.data)&&l.removed!==true&&l.topics?.length===e.topics.length&&e.topics.every((v,j)=>same(v,l.topics[j]))}),'Exact USDT approval/payment and pass mint events differ.');
 const state=await read(provider);check(name==='buy'?state.action==='complete':name==='approve'?['buy','complete'].includes(state.action):['approve','buy','complete'].includes(state.action),'Current pass or allowance does not reflect this receipt.');await identity(provider,C);
 return {status:'verified',hash,action:name,nonce:String(quantity(tx.nonce)),target:step.to,blockNumber:receipt.blockNumber,liveAction:state.action};
}
export async function recoverReceipt({provider,hash,storage,locks,isCurrent=()=>true,verify=verifyReceipt}){
 check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is checking this purchase.');const prior=loadState(storage);if(prior.pending?.hash)check(same(prior.pending.hash,hash),'A different transaction is recorded.');const r=await verify(provider,hash);
 check(isCurrent(),'Wallet changed during receipt verification.');check(JSON.stringify(loadState(storage))===JSON.stringify(prior),'Stored purchase state changed during verification.');if(r.status==='pending')return r;
 if(prior.pending)check(r.action===prior.pending.action&&r.nonce===prior.pending.nonce&&same(r.target,prior.pending.target),'Receipt does not match the recorded request.');
 saveState(storage,C.key,{receipts:[...prior.receipts.filter(x=>!same(x.hash,hash)),r]});return r;
 });
}
