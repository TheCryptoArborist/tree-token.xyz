// Read-only failover. Wallet access, network switching and signing never enter here.
const READS=new Set(['eth_chainId','eth_getTransactionCount','eth_getCode','eth_getBalance','eth_gasPrice','eth_getTransactionByHash','eth_getTransactionReceipt','eth_blockNumber','eth_getBlockByNumber','eth_estimateGas','eth_call']);
export const READ_RPC='https://bsc-rpc.publicnode.com';
export function createReadProvider(wallet,fetcher=globalThis.fetch){
 let backup=false,id=0,chainCheck;
 async function remote(method,params=[]){
  const requestId=++id,r=await fetcher(READ_RPC,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Backup RPC HTTP '+r.status);
  const j=await r.json();if(j.jsonrpc!=='2.0'||j.id!==requestId)throw Error('Invalid backup RPC response');if(j.error)throw Error(j.error.message||'Backup RPC rejected read');if(!Object.hasOwn(j,'result'))throw Error('Missing backup RPC result');return j.result;
 }
 return {request:async({method,params=[]})=>{
  if(!READS.has(method))throw Error('Read fallback cannot request '+method);
  try{
   if(!backup){try{return await wallet.request({method,params});}catch(e){if(e.code===4001)throw e;backup=true;}}
   chainCheck??=remote('eth_chainId').then(chain=>{if(BigInt(chain)!==56n)throw Error('Backup RPC is not BNB mainnet');});await chainCheck;
   return method==='eth_chainId'?'0x38':await remote(method,params);
  }catch(e){chainCheck=undefined;throw Error('BNB read '+method+' failed: '+(e.message||String(e))+'. Nothing further was submitted. Try Check receipts again.');}
 }};
}
