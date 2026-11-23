// Executes ONLY against an in-process mainnet fork. Remote requests are read-only.
import fs from 'node:fs';import assert from 'node:assert/strict';import ganache from 'ganache';
import {readOnlyRemote} from './deployment-review.mjs';
import {P,blankSession,prepare,inspect,verifySuiReceipt} from '../browser/core.mjs';
import {verifySlotReceipt} from '../../nftree-generation/scripts/slot-handoff.mjs';
const remote=readOnlyRemote();const blockNumber=Number(BigInt(await remote.request({method:'eth_blockNumber'})));
const gasPrice=await remote.request({method:'eth_gasPrice'});
const rpc=ganache.provider({miner:{defaultGasPrice:gasPrice},fork:{provider:remote,blockNumber,disableCache:true},chain:{chainId:56,hardfork:'shanghai'},wallet:{totalAccounts:0,unlockedAccounts:[P.admin]},logging:{quiet:true}});
try{
 await rpc.request({method:'evm_setAccountBalance',params:[P.admin,'0x8ac7230489e80000']});
 const session=blankSession(),records=[];verifySuiReceipt(await verifySlotReceipt(P.slotDigest));
 for(let i=0;i<3;i++){
  const review=await prepare(rpc,session);assert.equal(review.index,i);session.attempt={index:i,request:review.transaction};
  const hash=await rpc.request({method:'eth_sendTransaction',params:[review.transaction]});
  session.hashes.push(hash);session.requests.push(review.transaction);session.attempt=null;
  const result=await inspect(rpc,session);records.push({transaction:await rpc.request({method:'eth_getTransactionByHash',params:[hash]}),receipt:result.receipts[i]});
 }
 const result=await prepare(rpc,session);assert(result.complete);const code={adapter:await rpc.request({method:'eth_getCode',params:[P.addresses.adapter,'latest']}),pass:await rpc.request({method:'eth_getCode',params:[P.addresses.pass,'latest']})};
 const out={basis:'LOCAL_FORK_ONLY',blockNumber,session,records,code,totalGasFeeWei:String(result.spent),complete:true,submittedToMainnet:false};fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({blockNumber,complete:true,totalGasFeeWei:out.totalGasFeeWei,submittedToMainnet:false}));
}finally{await rpc.disconnect();}
