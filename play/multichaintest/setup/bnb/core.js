export async function hashHex(hex) {
  if (typeof hex !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(hex)) throw Error('Invalid bytecode.');
  const bytes=Uint8Array.from(hex.slice(2).match(/../g)??[],x=>parseInt(x,16));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
}
export function quantity(value,method='wallet RPC') {
  const valid=typeof value==='bigint'||(typeof value==='number'&&Number.isSafeInteger(value))||(typeof value==='string'&&(/^(0x[0-9a-f]+)$/i.test(value)||/^(0|[1-9][0-9]*)$/.test(value)));
  if(valid){const result=BigInt(value);if(result>=0n&&result<(1n<<256n))return result;}
  const type=value===null?'null':Array.isArray(value)?'array':typeof value;
  throw Error(method+' returned an invalid numeric response ('+type+'). Refresh the checks; if it persists, send this exact message back.');
}
export async function walletRead(provider,request) {
  let timer;
  try {
    let value=await Promise.race([
      provider.request({...request,params:request.params??[]}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(request.method+' did not respond within 30 seconds. Refresh the deployment checks.')),30000);})
    ]);
    // Standard EIP-1193 providers return the result directly. Accommodate only
    // an identifiable legacy JSON-RPC envelope, without coercing empty values.
    if(value&&typeof value==='object'&&value.jsonrpc==='2.0'&&Object.hasOwn(value,'id')) {
      if(value.error)throw Object.assign(Error(request.method+': '+String(value.error.message??'Wallet RPC error').slice(0,200)),{code:value.error.code});
      if(!Object.hasOwn(value,'result'))throw Error(request.method+' returned an incomplete JSON-RPC response.');
      value=value.result;
    }
    return value;
  }finally{clearTimeout(timer);}
}
async function readQuantity(provider,method,params=[]) {return quantity(await walletRead(provider,{method,params}),method);}

const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export async function identity(provider,cfg) {
  if(await readQuantity(provider,'eth_chainId')!==56n)throw Error('Select BNB Smart Chain mainnet in your wallet.');
  const accounts=await walletRead(provider,{method:'eth_accounts'});
  if(!Array.isArray(accounts)||!same(accounts[0],cfg.from))throw Error('Select the designated BNB wallet: '+cfg.from);
}
export async function preflight(provider,cfg) {
  if(cfg.chainId!=='0x38'||cfg.value!=='0x0'||!Number.isSafeInteger(cfg.nonce)||cfg.nonce<0)throw Error('Invalid deployment settings.');
  if(await hashHex(cfg.data)!==cfg.dataSha256)throw Error('Deployment bytecode changed.');
  await identity(provider,cfg);
  for(const tag of ['pending','latest']) {
    const nonce=await readQuantity(provider,'eth_getTransactionCount',[cfg.from,tag]);
    if(nonce!==BigInt(cfg.nonce))throw Error('Wallet nonce changed. Send the new nonce back to the conversation; do not deploy this draft.');
  }
  const existing=await walletRead(provider,{method:'eth_getCode',params:[cfg.predictedAdapter,'latest']});
  if(existing!=='0x')throw Error('The predicted adapter already has code. Check its receipt before continuing.');
  const endpoint=await walletRead(provider,{method:'eth_getCode',params:[cfg.endpoint,'latest']});
  if(await hashHex(endpoint)!==cfg.endpointCodeSha256)throw Error('LayerZero endpoint code differs from the reviewed deployment.');
  const call={from:cfg.from,data:cfg.data,value:'0x0'};
  const runtime=await walletRead(provider,{method:'eth_call',params:[call,'latest']});
  if(await hashHex(runtime)!==cfg.runtimeSha256)throw Error('Adapter simulation runtime differs from the reviewed contract.');
  const gas=await readQuantity(provider,'eth_estimateGas',[call,'latest']);
  if(gas===0n||gas>3000000n)throw Error('Unexpected deployment gas estimate.');
  const gasLimit=(gas*120n+99n)/100n;
  const price=await readQuantity(provider,'eth_gasPrice');
  const balance=await readQuantity(provider,'eth_getBalance',[cfg.from,'latest']);
  if(balance<gasLimit*price)throw Error('The BNB wallet needs more BNB for the estimated deployment gas.');
  await identity(provider,cfg);
  return {gas:gas.toString(),gasLimit:'0x'+gasLimit.toString(16),estimatedFeeWei:(gas*price).toString(),gasLimitFeeWei:(gasLimit*price).toString()};
}
export async function verifyReceipt(provider,cfg,hash) {
  if(!/^0x[0-9a-f]{64}$/i.test(hash??''))throw Error('Invalid transaction hash.');
  await identity(provider,cfg);
  const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});
  if(!receipt)return {status:'pending',hash};
  if(!same(receipt.transactionHash,hash))throw Error('Receipt hash mismatch.');
  if(quantity(receipt.status,'eth_getTransactionReceipt.status')!==1n)throw Error('Deployment failed on chain. Send the transaction hash back before another attempt.');
  if(!same(receipt.contractAddress,cfg.predictedAdapter))throw Error('Unexpected deployed contract address.');
  const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});
  if(!tx||!same(tx.hash,hash)||!same(tx.from,cfg.from)||tx.to!==null||quantity(tx.nonce,'transaction nonce')!==BigInt(cfg.nonce)||quantity(tx.value,'transaction value')!==0n||quantity(tx.chainId,'transaction chain ID')!==56n||!same(tx.input,cfg.data))throw Error('Deployed transaction does not match the reviewed draft.');
  const runtime=await walletRead(provider,{method:'eth_getCode',params:[cfg.predictedAdapter,receipt.blockNumber]});
  if(await hashHex(runtime)!==cfg.runtimeSha256)throw Error('Deployed adapter runtime does not match the reviewed simulation.');
  return {status:'verified',hash,contractAddress:receipt.contractAddress,blockNumber:receipt.blockNumber};
}
export function loadState(storage,key) {
  const text=storage.getItem(key);
  if(text===null)return null;
  const state=JSON.parse(text);
  if(!state||!['wallet_request','submitted','verified'].includes(state.status))throw Error('Publication state needs review before another request.');
  if(state.status!=='wallet_request'&&!/^0x[0-9a-f]{64}$/i.test(state.hash??''))throw Error('Stored receipt hash is invalid.');
  return state;
}
export function saveState(storage,key,state) {
  const text=JSON.stringify(state);storage.setItem(key,text);
  if(storage.getItem(key)!==text)throw Error('Cannot persist deployment state.');
}
export async function requestDeployment({provider,cfg,storage,locks,key,consent,isCurrent}) {
  if(!consent)throw Error('Review and accept the deployment details first.');
  if(!locks?.request)throw Error('Open this page in current Brave so deployment can be coordinated safely across tabs.');
  return locks.request(key,{ifAvailable:true},async lock=>{
    if(!lock)throw Error('Another tab is handling this deployment.');
    if(loadState(storage,key))throw Error('A deployment request is already recorded. Check wallet activity and its receipt.');
    const checked=await preflight(provider,cfg);
    await identity(provider,cfg);
    if(await readQuantity(provider,'eth_getTransactionCount',[cfg.from,'pending'])!==BigInt(cfg.nonce))throw Error('Wallet nonce changed before signing.');
    if(!isCurrent())throw Error('Wallet, account or network changed. Review the checks again.');
    saveState(storage,key,{status:'wallet_request',requestedAt:new Date().toISOString()});
    let hash;
    try {
      hash=await provider.request({method:'eth_sendTransaction',params:[{from:cfg.from,chainId:'0x38',nonce:'0x'+cfg.nonce.toString(16),value:'0x0',data:cfg.data,gas:checked.gasLimit}]});
    } catch(error) {
      if(error?.code===4001)storage.removeItem(key);
      throw error;
    }
    if(!/^0x[0-9a-f]{64}$/i.test(hash??''))throw Error('Wallet returned no valid hash. Check wallet activity before continuing.');
    const state={status:'submitted',hash,submittedAt:new Date().toISOString()};
    saveState(storage,key,state);
    return state;
  });
}
