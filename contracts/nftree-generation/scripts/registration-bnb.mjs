// Read-only proof, using the existing root-pinned viem dependency.
import assert from 'node:assert/strict';import {keccak256,encodeFunctionData,decodeFunctionResult,parseAbi} from 'viem';
import P from '../../bnb-generation/browser/pinned-build.json' with {type:'json'};
import hashes from '../../../docs/multichain/generation-milestone/registration-handoff/bnb-code-hashes.json' with {type:'json'};
import receipt from '../../../docs/multichain/generation-milestone/bnb-deployed/user-receipt.json' with {type:'json'};
const EP='0x1a44076050125825900e736c501f859c50fE728c';
export async function verifyInactiveBnb(fetcher=fetch){
 const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getCode','eth_call','eth_getTransactionReceipt']);let id=0;
 async function rpc(method,params=[]){assert(allowed.has(method));const r=await fetcher('https://bsc-rpc.publicnode.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(15000)});assert(r.ok,'BNB read HTTP '+r.status);const j=await r.json();assert(!j.error,JSON.stringify(j.error));return j.result;}
 assert.equal(BigInt(await rpc('eth_chainId')),56n);const block=await rpc('eth_blockNumber');
 for(const [address,hash]of Object.entries(hashes))assert.equal(keccak256(await rpc('eth_getCode',[address,block])),hash,'BNB code changed');
 for(let i=0;i<3;i++){const r=await rpc('eth_getTransactionReceipt',[receipt.transactionHashes[i]]);assert(r&&r.status==='0x1','BNB receipt unavailable');for(const k of ['transactionHash','blockHash','contractAddress','from','to'])assert.equal(r[k]?.toLowerCase()??null,receipt.receipts[i][k]?.toLowerCase()??null,'BNB receipt changed');}
 const call=async(address,abi,functionName,args=[])=>decodeFunctionResult({abi,functionName,data:await rpc('eth_call',[{to:address,data:encodeFunctionData({abi,functionName,args})},block])});
 assert.equal((await call(P.addresses.adapter,P.adapter.abi,'pass')).toLowerCase(),P.addresses.pass.toLowerCase());
 assert.equal((await call(P.addresses.pass,P.pass.abi,'adapter')).toLowerCase(),P.addresses.adapter.toLowerCase());
 assert.equal((await call(EP,parseAbi(['function delegates(address) view returns(address)']),'delegates',[P.addresses.adapter])).toLowerCase(),P.admin.toLowerCase());
 assert.equal(await call(P.addresses.pass,P.pass.abi,'purchasesPaused'),true);assert.equal(await call(P.addresses.pass,P.pass.abi,'state'),0);assert.equal(await call(P.addresses.pass,P.pass.abi,'generation'),0n);assert.equal(await call(P.addresses.pass,P.pass.abi,'canPlay',[P.admin]),false);
 return {chainId:56,block,adapter:P.addresses.adapter,pass:P.addresses.pass,purchasesPaused:true,state:'Unconfirmed',generation:0,canPlay:false};
}
