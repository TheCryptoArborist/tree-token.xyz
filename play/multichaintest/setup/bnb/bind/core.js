import {hashHex,quantity,walletRead,identity,loadState,saveState} from '../core.js?v=pass-receipt-1';
export {loadState,saveState};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const word=address=>'0x'+address.slice(2).toLowerCase().padStart(64,'0');
const read=(provider,to,data)=>walletRead(provider,{method:'eth_call',params:[{to,data},'latest']});
async function codes(provider,cfg){
  for(const [address,expected]of [[cfg.adapter,cfg.adapterCodeSha256],[cfg.pass,cfg.passCodeSha256]]){
    if(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[address,'latest']}))!==expected)throw Error('Adapter or pass code differs from the verified deployment.');
  }
}
async function nonce(provider,cfg){
  for(const tag of ['pending','latest'])if(quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[cfg.from,tag]}),'eth_getTransactionCount')!==BigInt(cfg.nonce))throw Error('Wallet nonce changed. Send this message back before binding.');
}
export async function preflight(provider,cfg){
  if(cfg.chainId!=='0x38'||cfg.value!=='0x0'||!Number.isSafeInteger(cfg.nonce)||cfg.nonce<0)throw Error('Invalid binding settings.');
  if(!same(cfg.data,'0x10265fa5'+word(cfg.pass).slice(2)))throw Error('Only the reviewed bindPass call is allowed.');
  if(await hashHex(cfg.data)!==cfg.dataSha256)throw Error('Binding calldata changed.');
  await identity(provider,cfg);await nonce(provider,cfg);await codes(provider,cfg);
  if(quantity(await read(provider,cfg.adapter,cfg.passGetter),'adapter.pass')!==0n)throw Error('The adapter is already bound. Check its receipt; do not bind again.');
  if(!same(await read(provider,cfg.adapter,cfg.binderGetter),word(cfg.from)))throw Error('Connected account is not this adapter’s binder.');
  if(!same(await read(provider,cfg.pass,cfg.passAdapterGetter),word(cfg.adapter)))throw Error('The pass points to a different adapter.');
  const call={from:cfg.from,to:cfg.adapter,data:cfg.data,value:'0x0'};
  if(await walletRead(provider,{method:'eth_call',params:[call,'latest']})!=='0x')throw Error('Unexpected binding simulation result.');
  const gas=quantity(await walletRead(provider,{method:'eth_estimateGas',params:[call,'latest']}),'eth_estimateGas');
  if(gas===0n||gas>300000n)throw Error('Unexpected binding gas estimate.');
  const gasLimit=(gas*120n+99n)/100n;
  const price=quantity(await walletRead(provider,{method:'eth_gasPrice'}),'eth_gasPrice');
  const balance=quantity(await walletRead(provider,{method:'eth_getBalance',params:[cfg.from,'latest']}),'eth_getBalance');
  if(balance<gasLimit*price)throw Error('The BNB wallet needs more BNB for the estimated gas.');
  await identity(provider,cfg);
  return {gas:gas.toString(),gasLimit:'0x'+gasLimit.toString(16),estimatedFeeWei:(gas*price).toString()};
}
export async function requestDeployment({provider,cfg,storage,locks,key,consent,isCurrent}){
  if(!consent)throw Error('Review and accept the binding details first.');
  if(!locks?.request)throw Error('Open this page in current Brave for safe cross-tab coordination.');
  return locks.request(key,{ifAvailable:true},async lock=>{
    if(!lock)throw Error('Another tab is handling this binding.');
    if(loadState(storage,key))throw Error('A binding request is already recorded. Check its receipt.');
    const checked=await preflight(provider,cfg);
    await identity(provider,cfg);await nonce(provider,cfg);
    if(!isCurrent())throw Error('Wallet, network or confirmation changed. Refresh the checks.');
    saveState(storage,key,{status:'wallet_request',requestedAt:new Date().toISOString()});
    let hash;
    try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:cfg.from,to:cfg.adapter,chainId:'0x38',nonce:'0x'+cfg.nonce.toString(16),value:'0x0',data:cfg.data,gas:checked.gasLimit}]});}
    catch(error){if(error?.code===4001)storage.removeItem(key);throw error;}
    if(!/^0x[0-9a-f]{64}$/i.test(hash??''))throw Error('Wallet returned no valid hash. Check wallet activity before another request.');
    const state={status:'submitted',hash,submittedAt:new Date().toISOString()};saveState(storage,key,state);return state;
  });
}
export async function verifyReceipt(provider,cfg,hash){
  if(!/^0x[0-9a-f]{64}$/i.test(hash??''))throw Error('Invalid transaction hash.');
  await identity(provider,cfg);
  const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});
  if(!receipt)return {status:'pending',hash};
  if(!same(receipt.transactionHash,hash)||quantity(receipt.status,'receipt.status')!==1n||!same(receipt.to,cfg.adapter)||receipt.contractAddress!==null)throw Error('Binding receipt failed or differs from the reviewed call.');
  const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});
  if(!tx||!same(tx.hash,hash)||!same(tx.from,cfg.from)||!same(tx.to,cfg.adapter)||quantity(tx.chainId,'transaction.chainId')!==56n||quantity(tx.nonce,'transaction.nonce')!==BigInt(cfg.nonce)||quantity(tx.value,'transaction.value')!==0n||!same(tx.input,cfg.data))throw Error('Binding transaction differs from the reviewed call.');
  const event=receipt.logs?.some(log=>same(log.address,cfg.adapter)&&log.removed!==true&&log.topics?.length===2&&same(log.topics[0],cfg.passBoundTopic)&&same(log.topics[1],word(cfg.pass))&&log.data==='0x');
  if(!event)throw Error('The expected PassBound event is missing.');
  await codes(provider,cfg);
  if(!same(await read(provider,cfg.adapter,cfg.passGetter),word(cfg.pass))||!same(await read(provider,cfg.pass,cfg.passAdapterGetter),word(cfg.adapter)))throw Error('The live adapter/pass relationship does not match the binding receipt.');
  return {status:'verified',hash,adapter:cfg.adapter,pass:cfg.pass,blockNumber:receipt.blockNumber,runtimeCheckedAt:'latest'};
}
