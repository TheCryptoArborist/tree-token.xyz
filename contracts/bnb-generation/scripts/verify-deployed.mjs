// Read-only verification of the completed, user-signed deployment sequence.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {P,blankSession,inspect,verifySuiReceipt} from '../browser/core.mjs';
const dir='docs/multichain/generation-milestone/bnb-deployed';
const supplied=JSON.parse(fs.readFileSync(dir+'/user-receipt.json'));
const approved=JSON.parse(fs.readFileSync('docs/multichain/generation-milestone/bnb-handoff/fork.json'));
assert.equal(supplied.chainId,56);for(const [k,v] of Object.entries({admin:P.admin,adapterAddress:P.addresses.adapter,passAddress:P.addresses.pass,suiPeer:P.peer,route:P.route}))assert.equal(supplied[k],v);
assert.equal(supplied.transactionHashes.length,3);
const reads=[],allowed=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getTransactionByHash','eth_getTransactionReceipt','eth_call']);
async function rpc(method,params=[]){assert(allowed.has(method));const r=await fetch('https://bsc-rpc.publicnode.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(25000)});assert(r.ok);const j=await r.json();assert(!j.error,JSON.stringify(j.error));reads.push({method,params,result:j.result});return j.result;}
const blockNumber=await rpc('eth_blockNumber'),block=await rpc('eth_getBlockByNumber',[blockNumber,false]);
const provider={request:({method,params=[]})=>rpc(method,params.map(p=>p==='latest'?blockNumber:p))};
const session={...blankSession(),hashes:supplied.transactionHashes,requests:approved.session.requests};
const verified=await inspect(provider,session);assert(verified.complete);assert.equal(String(verified.spent),supplied.totalGasFeeWei);
for(let i=0;i<3;i++){const actual=verified.receipts[i],user=supplied.receipts[i];for(const k of ['transactionHash','blockHash','blockNumber','status','gasUsed','effectiveGasPrice','contractAddress'])assert.equal(actual[k],user[k]);assert.equal(actual.transactionHash.toLowerCase(),supplied.transactionHashes[i].toLowerCase());}
const sr=await fetch('https://tree-token.xyz/api/generation-slot?digest='+P.slotDigest,{signal:AbortSignal.timeout(45000)});assert(sr.ok);const sui=await sr.json();verifySuiReceipt(sui);
const result={verifiedAt:new Date().toISOString(),chainId:56,blockNumber:Number(BigInt(blockNumber)),blockHash:block.hash,adapterAddress:P.addresses.adapter,passAddress:P.addresses.pass,admin:P.admin,treasury:P.treasury,suiPeer:P.peer,route:P.route,transactionHashes:supplied.transactionHashes,totalGasFeeWei:String(verified.spent),totalGasFeeBNB:Number(verified.spent)/1e18,approvedTotalCapBNB:0.001,confirmations:verified.receipts.map(r=>Number(BigInt(blockNumber)-BigInt(r.blockNumber)+1n)),exactTransactionsAndRuntimeVerified:true,reciprocalBindingVerified:true,endpointDelegateVerified:true,purchasesPaused:true,state:'Unconfirmed',generation:0,canPlay:false,suiVaultEmpty:true,suiVaultBound:false,submittedByVerifier:false};
const out=process.argv[2];assert(out,'Provide a new output directory');fs.mkdirSync(out,{recursive:true});for(const [name,data]of Object.entries({verification:result,reads,sui}))fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(data,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
