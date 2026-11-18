import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bcs} from '@mysten/sui/bcs';
import {AMOUNT,TREE_TYPE,RECIPIENT,memoFor,recoverySeasonDeadline,verifyRecoveryPayment} from '../netlify/lib/arcade-monthly-core.ts';
import {createMonthlyHandler} from '../netlify/monthly-functions/arcade-monthly.ts';

const wallet='0x'+'a'.repeat(64),digest='1'.repeat(44),origin='https://tree-token.xyz';
const november={id:'11111111-1111-4111-8111-111111111111',wallet,dateKey:'2026-11-29',createdAt:'2026-11-30T23:55:00.000Z',expiresAt:'2026-12-01T00:10:00.000Z'};
const deadline=Date.parse('2026-12-01T00:00:00.000Z');
function transaction(intent:any,paidAt:number){return {$kind:'Transaction',Transaction:{digest,status:{success:true},timestampMs:paidAt,checkpoint:'123',transaction:{sender:wallet,inputs:[{Pure:{bytes:bcs.vector(bcs.u8()).serialize([...new TextEncoder().encode(memoFor(intent))]).toBase64()}}],commands:[{MoveCall:{package:'0x1',module:'string',function:'utf8',typeArguments:[],arguments:[{Input:0}]}}]},balanceChanges:[{coinType:TREE_TYPE,address:wallet,amount:(-AMOUNT).toString()},{coinType:TREE_TYPE,address:RECIPIENT,amount:AMOUNT.toString()}]}};}
const request=(action:string,body:any)=>new Request(origin+'/api/arcade-monthly?action='+action,{method:'POST',headers:{Authorization:'Bearer '+'d'.repeat(64),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
function handler(intent:any,paidAt:number,now:number,confirmed:any[]){return createMonthlyHandler({now:()=>now,ownership:async()=>({address:wallet,network:'sui-mainnet',nftreeCount:1}),metadata:async()=>({coinMetadata:{decimals:6}}),getTransaction:async()=>transaction(intent,paidAt),rpc:async(name:string,args:any)=>{
 if(name==='arcade_growth_read_session_v1')return {wallet,origin,revoked:false,expiresAt:new Date(now+3600000).toISOString()};
 if(name==='arcade_recovery_intent_v1')return intent;
 if(name==='arcade_recovery_confirm_v1'){confirmed.push(args);return {wallet};}
 throw Error('Unexpected RPC');
}});}

test('season deadlines use UTC, including year rollover and leap years',()=>{
 assert.equal(recoverySeasonDeadline(november),'2026-12-01T00:00:00.000Z');
 assert.equal(recoverySeasonDeadline({...november,dateKey:'2026-12-30',createdAt:'2026-12-31T23:55:00Z',expiresAt:'2027-01-01T00:10:00Z'}),'2027-01-01T00:00:00.000Z');
 assert.equal(recoverySeasonDeadline({...november,dateKey:'2028-02-28',createdAt:'2028-02-29T23:55:00Z',expiresAt:'2028-03-01T00:10:00Z'}),'2028-03-01T00:00:00.000Z');
});
for(const patch of [{createdAt:'invalid'},{expiresAt:'invalid'},{expiresAt:november.createdAt},{dateKey:'2026-11-31'},{dateKey:'2026-10-29'},{dateKey:'2026-11-30'}])test('malformed or inconsistent checkout timing fails closed: '+JSON.stringify(patch),()=>{
 assert.throws(()=>verifyRecoveryPayment(transaction(november,deadline-1),{...november,...patch},digest,deadline+86400000),{code:'invalid-intent'});
});
test('a payment one millisecond before month-end remains verifiable after month-end',()=>{
 assert.equal(verifyRecoveryPayment(transaction(november,deadline-1),november,digest,deadline+20*86400000),'2026-11-30T23:59:59.999Z');
});
for(const offset of [0,1,300000])test('month-end is exclusive even for an older 15-minute checkout: '+offset+'ms',()=>{
 assert.throws(()=>verifyRecoveryPayment(transaction(november,deadline+offset),november,digest,deadline+86400000),{code:'payment-after-season-end'});
});
test('the month-end policy does not extend an earlier checkout expiry',()=>{
 const intent={...november,expiresAt:'2026-11-30T23:58:00.000Z'};
 assert.throws(()=>verifyRecoveryPayment(transaction(intent,Date.parse(intent.expiresAt)+1),intent,digest,deadline),{code:'payment-not-verified'});
});
test('earlier seasons retain their original valid paid checkout window',()=>{
 const intent={...november,dateKey:'2026-10-30',createdAt:'2026-10-31T23:55:00.000Z',expiresAt:'2026-11-01T00:10:00.000Z'};
 const paidAt=Date.parse('2026-11-01T00:05:00.000Z');
 assert.equal(recoverySeasonDeadline(intent),null);
 assert.equal(verifyRecoveryPayment(transaction(intent,paidAt),intent,digest,deadline),new Date(paidAt).toISOString());
});
test('December payment confirmed on time remains verifiable in January',()=>{
 const intent={...november,dateKey:'2026-12-30',createdAt:'2026-12-31T23:55:00.000Z',expiresAt:'2027-01-01T00:00:00.000Z'};
 const paidAt=Date.parse('2026-12-31T23:59:59.999Z');
 assert.equal(verifyRecoveryPayment(transaction(intent,paidAt),intent,digest,Date.parse('2027-01-04T12:00:00Z')),new Date(paidAt).toISOString());
});
test('handler rejects post-cutoff payment before any attendance confirmation',async()=>{
 const confirmed:any[]=[];const response=await handler(november,deadline,deadline+86400000,confirmed)(request('verify',{intentId:november.id,digest}));
 assert.equal(response.status,400);assert.equal((await response.json()).error,'payment-after-season-end');assert.equal(confirmed.length,0);
});
test('handler sends actual on-time paid timestamp for late reconciliation',async()=>{
 const confirmed:any[]=[];const response=await handler(november,deadline-1,deadline+86400000,confirmed)(request('verify',{intentId:november.id,digest}));
 assert.equal(response.status,200);assert.equal(confirmed.length,1);assert.equal(confirmed[0].p_paid_at,'2026-11-30T23:59:59.999Z');assert.equal(confirmed[0].p_intent_id,november.id);
});
test('new checkout includes its authoritative month boundary and refuses an uncapped DB window',async()=>{
 const capped={...november,expiresAt:'2026-12-01T00:00:00.000Z'},now=Date.parse(november.createdAt);
 const response=await handler(capped,now,now,[])(request('intent',{dateKey:capped.dateKey}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.intent.expiresAt,capped.expiresAt);assert.equal(data.intent.seasonEndsAt,capped.expiresAt);assert.equal(data.intent.cutoffPolicy,'utc-month-end-v1');
 assert.equal((await handler(november,now,now,[])(request('intent',{dateKey:november.dateKey}))).status,400);
});
test('anonymous status advertises the effective policy without a session or database write',async()=>{
 const response=await createMonthlyHandler({rpc:()=>{throw Error('No anonymous DB access');}})(new Request(origin+'/api/arcade-monthly'));
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.authenticated,false);assert.equal(data.configuration.recovery.cutoffPolicy,'utc-month-end-v1');assert.equal(data.configuration.recovery.cutoffEffectiveMonth,'2026-11');assert.equal(data.configuration.recovery.lateVerification,true);
});
