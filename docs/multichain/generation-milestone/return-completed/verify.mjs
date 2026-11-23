// Read-only evidence reconciliation. Never signs, submits, or retries a message.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {P,Q,inspect,blankSession} from '../../../../contracts/bnb-generation/browser/return-core.mjs';
import {C,newClient,verifyCandidate} from '../../../../contracts/nftree-generation/scripts/readiness.mjs';
import receipt from './user-receipt.json' with {type:'json'};
const dir=new URL('./',import.meta.url),write=(n,v)=>fs.writeFileSync(new URL(n,dir),JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n');
const hex=v=>'0x'+Buffer.from(v.bytes,'base64').toString('hex');
export function verifyDestination(state,result,now=Date.now()){
 assert(!state.errors);const d=state.data;verifyCandidate(d,now);
 const v=d.vault.asMoveObject.contents;assert.equal(d.vault.address,P.route);assert.equal(v.type.repr,`${P.peer}::vault::Vault<${C.nftType}>`);
 const j=v.json;assert.equal(j.nft,null);assert.equal(j.phase,2);assert.equal(j.generation,'1');assert.equal(j.ack_sent,false);assert.equal(hex(j.request),Q.redemption);assert.equal(hex(j.recipient),C.sender);assert.equal(hex(j.backing),C.nft);
 const t=result.Transaction;assert(t?.status.success);assert.equal(d.nft.previousTransaction.digest,t.digest);
 const events=t.events.filter(e=>e.eventType===`${P.peer}::vault::Released`);assert.equal(events.length,1);const e=events[0].json;assert.equal(e.vault,P.route);assert.equal(e.generation,'1');assert.equal(hex(e.request),Q.redemption);assert.equal(hex(e.recipient),C.sender);
 const packets=t.events.filter(e=>e.eventType==='0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::PacketDeliveredEvent');assert.equal(packets.length,1);const p=packets[0].json;assert.equal(p.src_eid,30102);assert.equal(p.nonce,'1');assert.equal(p.receiver,P.peer);assert.equal(hex(p.sender).slice(-40),P.addresses.adapter.slice(2).toLowerCase());
 const nft=t.effects.changedObjects.find(x=>x.objectId===C.nft);assert(nft);assert.equal(nft.outputOwner.AddressOwner,C.sender);assert.equal(nft.outputDigest,d.nft.digest);assert.equal(String(nft.outputVersion),String(d.nft.version));assert.equal(nft.outputState,'ObjectWrite');
 return {destinationVerified:true,nftReturned:true,recipient:C.sender,suiDigest:t.digest,phase:2,generation:1,ackSent:false,checkpoint:d.checkpoint};
}
export async function main(){
 const reads=[];let id=0;const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getCode','eth_call','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber']);
 const provider={request:async q=>{assert(allowed.has(q.method));const r=await fetch('https://bsc-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,...q}),signal:AbortSignal.timeout(20000)}),j=await r.json();assert(r.ok&&!j.error,JSON.stringify(j.error));reads.push({...q,result:j.result});write('rpc-reads.json',reads);return j.result;}};
 const session={...blankSession(),hashes:[receipt.transactionHash],requests:[receipt.request]};write('session.json',session);const source=await inspect(provider,session);assert(source.complete&&source.sourceVerified);for(const k of ['gasWei','messageFeeWei','totalWei','guid','payload'])assert.equal(source[k],receipt[k]);write('bnb-verification.json',source);
 const c=newClient();const state=await c.query({query:`query {chainIdentifier checkpoint {sequenceNumber timestamp} nft:object(address:"${C.nft}"){address version digest previousTransaction{digest} owner{__typename ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}} vault:object(address:"${P.route}"){address asMoveObject{contents{type{repr} json}}}}`});assert(!state.errors);write('sui-state.json',state);
 const result=await c.core.getTransaction({digest:state.data.nft.previousTransaction.digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true}});write('sui-delivery.json',result);const destination=verifyDestination(state,result);
 const proof={checkedAt:new Date().toISOString(),bnbHash:receipt.transactionHash,sourceVerified:true,totalWei:source.totalWei,messageFeeWei:source.messageFeeWei,gasWei:source.gasWei,guid:source.guid,...destination,bnbState:'Locked',purchasesPaused:true,canPlay:false};write('verification.json',proof);console.log(JSON.stringify(proof,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
