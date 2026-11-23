// Read-only reconciliation. No wallet, signing or submission API.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {Q,P,blankSession,inspect,verifySuiReceipt} from '../browser/configuration-core.mjs';
import {createReadProvider} from '../browser/read-rpc.mjs';
import quoted from '../../../docs/multichain/generation-milestone/bnb-configuration-handoff/review/preflight.json' with {type:'json'};
const [input,out]=process.argv.slice(2);assert(input&&out,'Usage: receipt.json new-output-directory');
const user=JSON.parse(fs.readFileSync(input));assert.equal(user.chainId,56);assert.equal(user.admin,P.admin);assert.equal(user.adapterAddress,P.addresses.adapter);assert.equal(user.passAddress,P.addresses.pass);assert.equal(user.suiConfigurationDigest,Q.suiDigest);assert.equal(user.transactionHashes.length,4);
const reads=[],remote=createReadProvider({request:async()=>{throw Error('Use read-only public RPC');}}),provider={request:async q=>{const result=await remote.request(q);reads.push({...q,result});return result;}};
// Compare against the reviewed fixed gas limits and quote, never limits supplied by the receipt.
const session={...blankSession(),hashes:user.transactionHashes,requests:Q.steps.map((s,i)=>({...quoted.review.transaction,data:s.data,nonce:'0x'+(Q.baseNonce+i).toString(16),gas:'0x'+Q.gasLimits[i].toString(16)}))};
const result=await inspect(provider,session);assert(result.complete);assert.equal(String(result.spent),user.totalGasFeeWei);assert.deepEqual(result.state,user.configurationSettings);
const response=await fetch('https://tree-token.xyz/api/generation-configuration?digest='+Q.suiDigest,{signal:AbortSignal.timeout(45000)});assert(response.ok);const sui=await response.json();verifySuiReceipt(sui);
fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n+'.json',JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n',{flag:'wx'});
save('verification',{checkedAt:new Date().toISOString(),submitted:false,session,...result});save('rpc-reads',reads);save('sui-prerequisite',sui);console.log(JSON.stringify({complete:result.complete,block:result.block,totalGasFeeWei:String(result.spent),empty:true,bound:false}));
