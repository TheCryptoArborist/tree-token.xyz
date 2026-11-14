import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {readRecoveryTransaction,verifyRecoveryPayment} from '../netlify/lib/arcade-monthly-core.ts';

// Explicit opt-in public-chain replay; no signatures, database writes or secrets.
// Normal CI uses deterministic ledger fixtures. Release validation opts in.
const digest='2nWn8j4Jrp32EZGJSBAbjoS94NGiNpsFBHF1UW8chjtW';
test('reported payment passes the production ledger adapter and unchanged verifier', {skip:process.env.RUN_RECOVERY_LIVE!=='1',timeout:45000}, async()=>{
 const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
 const original:any=await client.core.getTransaction({digest,include:{transaction:true,balanceChanges:true},signal:AbortSignal.timeout(15000)});
 assert.equal(original.Transaction.timestampMs,undefined,'Reproduce pinned 2.26.1 metadata omission');
 assert.equal(original.Transaction.checkpoint,undefined);
 const result=await readRecoveryTransaction(client,digest),tx=result.Transaction;
 assert.equal(tx.timestampMs,1794633423677);assert.equal(tx.checkpoint,'345032364');
 // Synthetic timing window only; the private checkout window is independently
 // validated during authorized receipt reconciliation and is not published.
 const intent={id:'d5be9869-bd35-4079-bf86-29ea7ebb0e79',wallet:'0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6',dateKey:'2026-11-06',createdAt:new Date(tx.timestampMs-10000).toISOString(),expiresAt:new Date(tx.timestampMs+900000).toISOString()};
 assert.throws(()=>verifyRecoveryPayment(original,intent,digest,Date.now()));
 const paidAt=verifyRecoveryPayment(result,intent,digest,Date.now());assert.equal(paidAt,'2026-11-14T05:17:03.677Z');
 console.log('RECOVERY_LIVE_VERIFIED '+JSON.stringify({digest,paidAt,checkpoint:tx.checkpoint,checks:'sender/token/recipient/amount/memo/time',databaseWrites:false}));
});
