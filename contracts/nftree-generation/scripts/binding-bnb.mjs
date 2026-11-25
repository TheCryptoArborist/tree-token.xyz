// Reconcile exact completed receipts and fresh read-only configuration/runtime state.
import assert from 'node:assert/strict';
import saved from '../../../docs/multichain/generation-milestone/bnb-configuration-completed/verified/rpc-reads.json' with {type:'json'};
import receipt from '../../../docs/multichain/generation-milestone/bnb-configuration-completed/user-receipt.json' with {type:'json'};
export async function verifyConfiguredBnb(fetcher=fetch){
 let id=0;const rpc=async(method,params=[])=>{assert(['eth_chainId','eth_blockNumber','eth_getCode','eth_call','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber'].includes(method));const n=++id,r=await fetcher('https://bsc-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(15000)});assert(r.ok);const j=await r.json();assert(!j.error&&j.id===n);return j.result;};
 assert.equal(await rpc('eth_chainId'),'0x38');const block=await rpc('eth_blockNumber');
 const rows=[...new Map(saved.filter(x=>!['eth_chainId','eth_blockNumber'].includes(x.method)).map(x=>[JSON.stringify([x.method,x.params]),x])).values()];
 for(let i=0;i<rows.length;i+=8)await Promise.all(rows.slice(i,i+8).map(async x=>{const params=structuredClone(x.params);if(['eth_getCode','eth_call'].includes(x.method))params[1]=block;const actual=await rpc(x.method,params);if(x.method==='eth_getBlockByNumber')assert.equal(actual.hash,x.result.hash,'Receipt block changed');else assert.deepEqual(actual,x.result,'BNB receipt/runtime/configuration changed: '+x.method);}));
 return {complete:true,stage:4,block,hashes:receipt.transactionHashes,totalGasFeeWei:receipt.totalGasFeeWei};
}
