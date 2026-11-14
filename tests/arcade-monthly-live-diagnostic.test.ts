import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {bcs} from '@mysten/sui/bcs';
import {verifyRecoveryPayment, memoFor} from '../netlify/lib/arcade-monthly-core.ts';

// Read-only diagnostic branch: no wallet, signing, credentials, database writes,
// or deployment. Do not merge this network-dependent diagnostic into main.
// Identifiers below come from the public transaction, not private account data.
const digest='2nWn8j4Jrp32EZGJSBAbjoS94NGiNpsFBHF1UW8chjtW';
test('reproduce pinned-SDK metadata omission and verify a ledger-backed repair', {timeout:45000}, async () => {
 const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
 const result=await client.core.getTransaction({digest,include:{transaction:true,balanceChanges:true},signal:AbortSignal.timeout(20000)});
 assert.equal(result.$kind,'Transaction');
 if(result.$kind!=='Transaction') throw Error('Not a successful transaction');
 const tx=result.Transaction as any;
 console.log('RECOVERY_FIELD_TYPES '+JSON.stringify({timestampType:typeof tx.timestampMs,checkpointType:typeof tx.checkpoint,status:tx.status}));
 assert.equal(tx.timestampMs,undefined,'2.26.1 Core API omits timestampMs');
 assert.equal(tx.checkpoint,undefined,'2.26.1 Core API omits checkpoint');
 const {response}=await client.ledgerService.getTransaction({digest,readMask:{paths:['digest','timestamp','checkpoint','effects.status']}},{abort:AbortSignal.timeout(20000)});
 const ledger=response.transaction;
 assert.equal(ledger?.digest,digest,'Metadata must belong to the same transaction');
 assert.equal(ledger.effects?.status?.success,true);
 assert.ok(ledger.timestamp);
 assert.notEqual(ledger.checkpoint,undefined);
 const timestampMs=Number(ledger.timestamp.seconds)*1000+Math.floor(ledger.timestamp.nanos/1000000);
 const checkpoint=String(ledger.checkpoint);
 console.log('RECOVERY_LEDGER_METADATA '+JSON.stringify({digest:ledger.digest,timestampMs,checkpoint}));
 assert.equal(timestampMs,1794633423677);
 assert.equal(checkpoint,'345032364');
 // Synthetic window around the public chain timestamp. Real intent timing was
 // separately checked through authorized private database access, not published.
 const intent={id:'d5be9869-bd35-4079-bf86-29ea7ebb0e79',wallet:tx.transaction.sender,dateKey:'2026-11-06',createdAt:new Date(timestampMs-10000).toISOString(),expiresAt:new Date(timestampMs+900000).toISOString()};
 assert.throws(()=>verifyRecoveryPayment(result,intent,digest,Date.now()),/could not be verified/);
 console.log('RECOVERY_ORIGINAL_VERIFIER rejects the successful payment because confirmation metadata is absent');
 const memos=tx.transaction.commands.filter(c=>c.MoveCall?.module==='string'&&c.MoveCall?.function==='utf8').map(c=>new TextDecoder().decode(Uint8Array.from(bcs.vector(bcs.u8()).fromBase64(tx.transaction.inputs[c.MoveCall.arguments[0].Input].Pure.bytes))));
 assert.ok(memos.includes(memoFor(intent)));
 const enriched={...result,Transaction:{...tx,timestampMs,checkpoint}};
 const paidAt=verifyRecoveryPayment(enriched,intent,digest,Date.now());
 assert.equal(paidAt,new Date(timestampMs).toISOString());
 console.log('RECOVERY_REPAIRED_VERIFIER '+JSON.stringify({verified:true,paidAt,memoMatched:true,checkpoint}));
});
