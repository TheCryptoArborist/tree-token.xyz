import {hashHex,quantity,walletRead,identity,saveState} from '../core.js';
export {saveState};
export function loadState(storage,key){
  const text=storage.getItem(key);if(text===null)return null;const s=JSON.parse(text);
  if(!s||!Array.isArray(s.receipts)||s.receipts.some(r=>r.status!=='verified'||!/^0x[0-9a-f]{64}$/i.test(r.hash??'')||!Number.isInteger(r.stage)||r.stage<0||r.stage>3)||s.pending&&(!Number.isInteger(s.pending.stage)||s.pending.stage<0||s.pending.stage>3||s.pending.hash!==undefined&&!/^0x[0-9a-f]{64}$/i.test(s.pending.hash)))throw Error('Stored configuration state needs review.');return s;
}
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const check=(yes,message)=>{if(!yes)throw Error(message);};
export function resolveStage(reads,values){
  const stages=Array.from({length:5},(_,i)=>i).filter(stage=>reads.every((r,i)=>same(values[i],r.changesAt&&stage>=r.changesAt?r.after:r.before)));
  check(stages.length===1,'The live route differs from the reviewed sequence. Send this message back before signing.');return stages[0];
}
export async function readRoute(provider,cfg){
  await identity(provider,cfg);
  const block=await walletRead(provider,{method:'eth_blockNumber'});quantity(block,'block number');
  for(const [address,expected] of Object.entries(cfg.code))check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[address,'latest']}))===expected,'Pilot or LayerZero contract code changed. Review before continuing.');
  const values=await Promise.all(cfg.reads.map(r=>walletRead(provider,{method:'eth_call',params:[{to:r.to,data:r.data},'latest']})));
  return {stage:resolveStage(cfg.reads,values),block};
}
async function nonce(provider,cfg,stage){for(const tag of ['latest','pending'])check(quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[cfg.from,tag]}),'wallet nonce')===BigInt(cfg.startNonce+stage),'Wallet nonce changed or a transaction is pending. Check wallet activity and send this message back.');}
export async function preflight(provider,cfg){
  check(cfg.chainId==='0x38'&&cfg.steps.length===4&&Number.isSafeInteger(cfg.startNonce),'Invalid configuration.');
  const route=await readRoute(provider,cfg);if(route.stage===4)return route;
  await nonce(provider,cfg,route.stage);const step=cfg.steps[route.stage];check(await hashHex(step.data)===step.dataSha256,'Configuration calldata changed.');
  const call={from:cfg.from,to:cfg.endpoint,data:step.data,value:'0x0'};
  check(await walletRead(provider,{method:'eth_call',params:[call,'latest']})==='0x','Configuration simulation returned an unexpected result.');
  const gas=quantity(await walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),'gas estimate');check(gas>0n&&gas<=700000n,'Unexpected configuration gas estimate.');
  const gasLimit=(gas*120n+99n)/100n,price=quantity(await walletRead(provider,{method:'eth_gasPrice'}),'gas price');check(quantity(await walletRead(provider,{method:'eth_getBalance',params:[cfg.from,'latest']}),'BNB balance')>=gasLimit*price,'More BNB is needed for network gas.');
  await identity(provider,cfg);return {...route,gas:String(gas),gasLimit:'0x'+gasLimit.toString(16),estimatedFeeWei:String(gas*price)};
}
export async function requestConfiguration({provider,cfg,storage,locks,key,reviewed,isCurrent,expectedStage}){
  check(reviewed&&locks?.request,'Review this step and use current Brave for wallet coordination.');
  return locks.request(key,{ifAvailable:true},async lock=>{
    check(lock,'Another tab is handling this configuration.');check(!loadState(storage,key)?.pending,'A wallet request is pending. Verify its receipt before continuing.');
    const ready=await preflight(provider,cfg);check(ready.stage<4&&ready.stage===expectedStage,'Configuration stage changed. Refresh and review it.');await nonce(provider,cfg,ready.stage);check(isCurrent(),'Wallet or review changed. Review this step again.');
    const previous=loadState(storage,key)??{receipts:[]};saveState(storage,key,{...previous,pending:{stage:ready.stage,requestedAt:new Date().toISOString()}});
    let hash;try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:cfg.from,to:cfg.endpoint,chainId:'0x38',nonce:'0x'+(cfg.startNonce+ready.stage).toString(16),value:'0x0',data:cfg.steps[ready.stage].data,gas:ready.gasLimit}]});}catch(e){if(e?.code===4001)saveState(storage,key,previous);throw e;}
    check(/^0x[0-9a-f]{64}$/i.test(hash??''),'No valid submission hash returned. Check wallet activity before continuing.');
    const state={...previous,pending:{stage:ready.stage,hash,submittedAt:new Date().toISOString()}};saveState(storage,key,state);return state;
  });
}
export async function verifyReceipt(provider,cfg,hash,stage){
  check(/^0x[0-9a-f]{64}$/i.test(hash??'')&&Number.isInteger(stage)&&stage>=0&&stage<4,'Invalid receipt.');await identity(provider,cfg);
  const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash,stage};
  check(same(receipt.transactionHash,hash)&&quantity(receipt.status,'receipt status')===1n&&same(receipt.to,cfg.endpoint)&&same(receipt.from,cfg.from)&&receipt.contractAddress===null,'Receipt failed or does not match this configuration.');
  const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]}),step=cfg.steps[stage];
  check(tx&&same(tx.hash,hash)&&same(tx.from,cfg.from)&&same(tx.to,cfg.endpoint)&&quantity(tx.chainId)===56n&&quantity(tx.nonce)===BigInt(cfg.startNonce+stage)&&quantity(tx.value)===0n&&same(tx.input,step.data),'Transaction differs from the reviewed configuration.');
  check(receipt.logs?.length===step.events.length&&step.events.every((e,i)=>{const l=receipt.logs[i];return same(l.address,e.address)&&l.removed!==true&&same(l.data,e.data)&&l.topics?.length===e.topics.length&&e.topics.every((t,j)=>same(t,l.topics[j]));}),'Expected configuration events do not match.');
  const route=await readRoute(provider,cfg);check(route.stage>=stage+1,'Live settings do not reflect this receipt. Wait for confirmation, then check again.');
  return {status:'verified',hash,stage,blockNumber:receipt.blockNumber,liveStage:route.stage};
}

export async function confirmPending({provider,cfg,storage,locks,key,recoveryHash,isCurrent}){
  check(locks?.request,'Use current Brave for receipt coordination.');
  return locks.request(key,{ifAvailable:true},async lock=>{
    check(lock,'Another tab is handling this configuration.');const s=loadState(storage,key);check(s?.pending,'No pending configuration receipt.');
    const r=await verifyReceipt(provider,cfg,s.pending.hash??recoveryHash,s.pending.stage);check(isCurrent(),'Wallet changed during receipt verification.');
    check(JSON.stringify(loadState(storage,key))===JSON.stringify(s),'Stored configuration changed during receipt verification.');
    if(r.status==='verified')saveState(storage,key,{receipts:[...s.receipts,r]});return r;
  });
}
