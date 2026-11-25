// Read-only reconciliation. No private key, wallet request or transaction submission.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {P,Q,inspect,blankSession,verifySuiReceipt} from '../../../../contracts/bnb-generation/browser/purchase-core.mjs';
import handler from '../../../../netlify/preview-functions/generation-purchase-custody.mjs';
import receipt from './user-receipt.json' with {type:'json'};
import preflight from '../private-purchase-handoff/preflight-live.json' with {type:'json'};
const dir=new URL('./',import.meta.url),write=(name,v)=>fs.writeFileSync(new URL(name,dir),JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x,2)+'\n');
const reads=[];let id=0;const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getCode','eth_call','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber']);
const provider={request:async q=>{assert(allowed.has(q.method));const r=await fetch('https://bsc-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,...q}),signal:AbortSignal.timeout(20000)}),j=await r.json();assert(r.ok&&!j.error,JSON.stringify(j.error));reads.push({...q,result:j.result});write('rpc-reads.json',reads);return j.result;}};
// Reconstruct fixed reviewed requests using the saved live preflight gas-price ceiling.
// These are not claimed to be the user's exported browser requests.
const session={...blankSession(),hashes:receipt.transactionHashes,requests:Q.steps.map((s,i)=>({...preflight.transaction,to:s.to,data:s.data,nonce:'0x'+(Q.baseNonce+i).toString(16),gas:'0x'+BigInt(Q.gasLimits[i]).toString(16)}))};write('reconstructed-session.json',session);
const result=await inspect(provider,session);assert(result.complete&&result.state===3&&result.purchasesPaused&&!result.canPlay&&result.allowance==='0');assert.equal(String(result.spent),receipt.totalGasFeeWei);assert.equal(receipt.redemption,Q.redemption);assert.equal(receipt.recipient,Q.recipient);assert.equal(receipt.usdtPaid,Q.price);
const response=await handler(new Request('https://tree-token.xyz/api/generation-purchase-custody'));assert(response.ok);const sui=await response.json();verifySuiReceipt(sui);write('sui-custody.json',sui);
write('verification.json',{checkedAt:new Date().toISOString(),chainId:56,admin:P.admin,treasury:P.treasury,priceUnits:Q.price,redemption:Q.redemption,recipient:Q.recipient,hashes:session.hashes,...result,suiCustodyVerified:true,nftReturned:false});console.log({complete:result.complete,gasWei:String(result.spent),state:'Locked',allowance:result.allowance,canPlay:result.canPlay,nftHeld:sui.nftHeld});
