import fs from 'node:fs';import assert from 'node:assert/strict';import ganache from 'ganache';import {id} from 'ethers';
import {readOnlyRemote} from './deployment-review.mjs';import {createReadProvider} from '../browser/read-rpc.mjs';
import {Q,prepare,blankSession,inspect,verifySuiReceipt} from '../browser/configuration-core.mjs';
import deployed from '../../../docs/multichain/generation-milestone/bnb-deployed/user-receipt.json' with {type:'json'};
const out=process.argv[2];assert(out);fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n+'.json',JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x,2)+'\n',{flag:'wx'});
const live=createReadProvider({request:async()=>{throw Error('Use fixed read-only public RPC');}}),reads=[];
const recording={request:async r=>{const result=await live.request(r);reads.push({request:r,result});return result;}};
const sr=await fetch('https://tree-token.xyz/api/generation-configuration?digest='+Q.suiDigest);assert(sr.ok);const sui=await sr.json();verifySuiReceipt(sui);
const preflight=await prepare(recording,blankSession());save('preflight',{checkedAt:new Date().toISOString(),sui,review:preflight,reads});
const remote=readOnlyRemote(),blockNumber=Number(BigInt(await remote.request({method:'eth_blockNumber'}))),gasPrice=await remote.request({method:'eth_gasPrice'});
const fork=ganache.provider({fork:{provider:remote,disableCache:true,blockNumber},chain:{chainId:56,hardfork:'shanghai'},miner:{defaultGasPrice:gasPrice},wallet:{totalAccounts:1,unlockedAccounts:[Q.admin]},logging:{quiet:true}});
const provider={request:r=>['eth_getTransactionReceipt','eth_getTransactionByHash'].includes(r.method)&&deployed.transactionHashes.includes(r.params[0])?remote.request(r):r.method==='eth_gasPrice'?Promise.resolve(gasPrice):fork.request(r)};
try{await fork.request({method:'evm_setAccountBalance',params:[Q.admin,'0x8ac7230489e80000']});const session=blankSession(),transactions=[],checks=[],other=(await fork.request({method:'eth_accounts'}))[0];
 for(let i=0;i<4;i++){const q=await prepare(provider,session);assert.equal(q.index,i);await assert.rejects(fork.request({method:'eth_call',params:[{...q.transaction,from:other},'latest']}),e=>e.data===id('LZ_Unauthorized()').slice(0,10));const hash=await fork.request({method:'eth_sendTransaction',params:[q.transaction]});session.hashes.push(hash);session.requests.push(q.transaction);transactions.push(await fork.request({method:'eth_getTransactionByHash',params:[hash]}));const checked=await inspect(provider,session);assert.equal(checked.stage,i+1);checks.push(checked);}
 const final=await prepare(provider,session);assert(final.complete);assert(final.spent<=100000000000000n);save('fork',{mode:'LOCAL_FORK_ONLY',submittedToMainnet:false,blockNumber,session,transactions,checks,final,unauthorizedCallsRejected:4});console.log({nonce:Q.baseNonce,stage:final.stage,spent:String(final.spent),allFourStepsVerified:true});
}finally{await fork.disconnect();}
