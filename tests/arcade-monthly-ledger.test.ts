import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bcs} from '@mysten/sui/bcs';
import {AMOUNT,TREE_TYPE,RECIPIENT,memoFor,readRecoveryTransaction,verifyRecoveryPayment} from '../netlify/lib/arcade-monthly-core.ts';
import {createMonthlyHandler} from '../netlify/monthly-functions/arcade-monthly.ts';
const digest='1'.repeat(44),wallet='0x'+'a'.repeat(64),now=1794633423677;
const intent={id:'11111111-1111-4111-8111-111111111111',wallet,dateKey:'2026-11-06',createdAt:new Date(now-4000).toISOString(),expiresAt:new Date(now+900000).toISOString()};
function fixture(){
 const result:any={$kind:'Transaction',Transaction:{digest,status:{success:true,error:null},transaction:{sender:wallet,inputs:[{Pure:{bytes:bcs.vector(bcs.u8()).serialize([...new TextEncoder().encode(memoFor(intent))]).toBase64()}}],commands:[{MoveCall:{package:'0x1',module:'string',function:'utf8',typeArguments:[],arguments:[{Input:0}]}}]},balanceChanges:[{coinType:TREE_TYPE,address:wallet,amount:(-AMOUNT).toString()},{coinType:TREE_TYPE,address:RECIPIENT,amount:AMOUNT.toString()}]}};
 const ledger:any={digest,timestamp:{seconds:1794633423n,nanos:677000000},checkpoint:345032364n,effects:{status:{success:true}}};
 const calls:any[]=[];
 const client={core:{getTransaction:async(o:any)=>{calls.push({core:o});return result;}},ledgerService:{getTransaction:async(o:any,options:any)=>{calls.push({ledger:o,options});return {response:{transaction:ledger}};}}};
 return {result,ledger,client,calls};
}
test('pinned SDK result has no confirmation metadata; adapter restores it from matching ledger only',async()=>{
 const f=fixture(),before=structuredClone(f.result),signal=new AbortController().signal;
 assert.throws(()=>verifyRecoveryPayment(f.result,intent,digest,now));
 const enriched=await readRecoveryTransaction(f.client,digest,signal);
 assert.equal(verifyRecoveryPayment(enriched,intent,digest,now),new Date(now).toISOString());
 assert.equal(enriched.Transaction.checkpoint,'345032364');
 assert.deepEqual(f.result,before,'Do not mutate the SDK response');
 assert.equal(f.calls[0].core.signal,signal);assert.equal(f.calls[1].options.abort,signal);
 assert.deepEqual(f.calls[1].ledger,{digest,readMask:{paths:['digest','timestamp','checkpoint','effects.status']}});
});
for(const [name,mutate] of Object.entries({
 wrongCoreDigest:(f:any)=>f.result.Transaction.digest='2'.repeat(44),
 failedCore:(f:any)=>f.result.Transaction.status.success=false,
 failedDiscriminant:(f:any)=>f.result.$kind='FailedTransaction',
 wrongLedgerDigest:(f:any)=>f.ledger.digest='2'.repeat(44),
 failedLedger:(f:any)=>f.ledger.effects.status.success=false,
 missingLedgerStatus:(f:any)=>delete f.ledger.effects,
 absentTimestamp:(f:any)=>delete f.ledger.timestamp,
 absentCheckpoint:(f:any)=>delete f.ledger.checkpoint,
 missingSeconds:(f:any)=>delete f.ledger.timestamp.seconds,
 negativeSeconds:(f:any)=>f.ledger.timestamp.seconds=-1n,
 booleanSeconds:(f:any)=>f.ledger.timestamp.seconds=true,
 overflowSeconds:(f:any)=>f.ledger.timestamp.seconds='9999999999999999999',
 missingNanos:(f:any)=>delete f.ledger.timestamp.nanos,
 negativeNanos:(f:any)=>f.ledger.timestamp.nanos=-1,
 excessiveNanos:(f:any)=>f.ledger.timestamp.nanos=1000000000,
 fractionalNanos:(f:any)=>f.ledger.timestamp.nanos=0.1,
 stringNanos:(f:any)=>f.ledger.timestamp.nanos='677000000',
 zeroCheckpoint:(f:any)=>f.ledger.checkpoint=0n,
 negativeCheckpoint:(f:any)=>f.ledger.checkpoint=-1n,
 booleanCheckpoint:(f:any)=>f.ledger.checkpoint=true,
 conflictingTimestamp:(f:any)=>f.result.Transaction.timestampMs=now+1,
 conflictingCheckpoint:(f:any)=>f.result.Transaction.checkpoint='7'
}))test('ledger adapter rejects '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(readRecoveryTransaction(f.client,digest));});
test('matching optional metadata is accepted, including zero nanoseconds',async()=>{const f=fixture();f.ledger.timestamp.nanos=0;f.result.Transaction.timestampMs=1794633423000;f.result.Transaction.checkpoint='345032364';assert.equal((await readRecoveryTransaction(f.client,digest)).Transaction.timestampMs,1794633423000);});
const request=()=>new Request('https://tree-token.xyz/api/arcade-monthly?action=verify',{method:'POST',headers:{Authorization:'Bearer '+'d'.repeat(64),Origin:'https://tree-token.xyz','Content-Type':'application/json'},body:JSON.stringify({intentId:intent.id,digest})});
function handler(f:any,confirmed:any[]){return createMonthlyHandler({client:f.client,now:()=>now,rpc:async(name:string,args:any)=>{if(name==='arcade_growth_read_session_v1')return {wallet,origin:'https://tree-token.xyz',revoked:false,expiresAt:new Date(now+3600000).toISOString()};if(name==='arcade_recovery_intent_v1')return intent;if(name==='arcade_recovery_confirm_v1'){confirmed.push(args);return {wallet};}throw Error('Unexpected RPC');}});}
test('production handler uses the adapter and confirms the existing intent once',async()=>{const f=fixture(),confirmed:any[]=[];const r=await handler(f,confirmed)(request());assert.equal(r.status,200);assert.equal(confirmed.length,1);assert.equal(confirmed[0].p_digest,digest);assert.equal(confirmed[0].p_paid_at,new Date(now).toISOString());assert.equal(confirmed[0].p_intent_id,intent.id);});
test('uncheckpointed payment returns retry-without-payment and never writes attendance',async()=>{const f=fixture(),confirmed:any[]=[];delete f.ledger.checkpoint;const r=await handler(f,confirmed)(request());assert.equal(r.status,409);assert.equal((await r.json()).error,'payment-pending');assert.equal(confirmed.length,0);});
test('ledger transport failure never writes attendance',async()=>{const f=fixture(),confirmed:any[]=[];f.client.ledgerService.getTransaction=async()=>{throw Error('network');};const r=await handler(f,confirmed)(request());assert.equal(r.status,503);assert.equal(confirmed.length,0);});
test('enrichment does not bypass original amount and memo checks',async()=>{for(const mutate of [(f:any)=>f.result.Transaction.balanceChanges[1].amount='1',(f:any)=>f.result.Transaction.transaction.commands=[]]){const f=fixture(),confirmed:any[]=[];mutate(f);assert.equal((await handler(f,confirmed)(request())).status,400);assert.equal(confirmed.length,0);}});
