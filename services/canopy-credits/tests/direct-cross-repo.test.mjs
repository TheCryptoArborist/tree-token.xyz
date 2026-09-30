import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFixedContinueTerms, publicContinueOrder, DIRECT_CONTINUE as P } from '../continue-product.mjs';
import { authorizeQuoteForReview } from '../reader/checkout/quote-authority.mjs';
const { createTreeContinueAttempt }=await import(pathToFileURL(resolve('game/app/game/tree-continue-attempt.mjs')));
const { paymentTransaction }=await import(pathToFileURL(resolve('game/app/game/tree-payments/wallet.mjs')));
const now=1800000000000;
function fixture(){
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const actor={authenticated:true,accountId:crypto.randomUUID(),wallet:{family:'sui',address:'0x'+'1'.repeat(64)}};
 const flight={accountId:actor.accountId,runId:crypto.randomUUID(),lives:0,continuesUsed:0,ruleset:'treeforce89.v1',checkpointHash:'a'.repeat(64)};
 const deployment={network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),initialSharedVersion:'1',keyEpoch:'1',quotePublicKey:publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex')};
 const terms=createFixedContinueTerms({actor,flight,deployment,metadata:{network:P.network,coinType:P.coinType,decimals:6},now});
 const envelope=authorizeQuoteForReview(terms,deployment,privateKey);
 return {actor,flight,deployment,terms,order:publicContinueOrder(terms,envelope,true)};
}
test('central fixed order and original BCS quote authority agree with actual game wallet builder',async()=>{
 const f=fixture(),tx=await paymentTransaction(f.order,f.deployment,now);const data=tx.getData();
 assert.equal(data.sender,f.actor.wallet.address);
 assert.ok(JSON.stringify(data,(_key,value)=>typeof value==='bigint'?value.toString():value).includes('20000000000'));
 assert.equal(data.commands.find(c=>c.$kind==='MoveCall').MoveCall.package,f.deployment.packageId);
 assert.equal(data.gasData.budget,null);
});
test('server-signed 20,000 TREE order reaches game continuation only after separate receipt authorization',async()=>{
 const f=fixture();let payments=0,applied=0,resumed=0,verified=false;
 const attempt=createTreeContinueAttempt({clientRunId:f.flight.runId,identity:()=>f.actor,prepare(){},boundary(){},apply(n){assert.equal(n,3);applied++},resume(){resumed++},
 wallet:{connect:async()=>{},prepare:o=>paymentTransaction(o,f.deployment,now),pay:async()=>{payments++;return{$kind:'Transaction',Transaction:{digest:'fixture'}}},wait:async()=>{}},
 api:async c=>c.action==='status'?{enabled:true}:c.action==='order'?{order:f.order}:c.action==='reconcile'?{status:verified?'verified':'pending',order:f.order,authorization:{orderId:f.order.orderId,runId:f.flight.runId,lives:3,receiptId:'fixture'}}:{status:'delivered',orderId:f.order.orderId,runId:f.flight.runId}});
 await assert.rejects(attempt.continue(),/payment-not-yet-verified/);assert.equal(applied,0);verified=true;await attempt.continue();assert.equal(payments,1);assert.equal(applied,1);assert.equal(resumed,1);
});
