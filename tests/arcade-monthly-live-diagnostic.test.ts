import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {bcs} from '@mysten/sui/bcs';
import {verifyRecoveryPayment, memoFor} from '../netlify/lib/arcade-monthly-core.ts';

// Isolated, read-only diagnostic. No wallet, signing, database, credentials,
// attendance writes, or deployment. All identifiers below are public on-chain.
const digest='2nWn8j4Jrp32EZGJSBAbjoS94NGiNpsFBHF1UW8chjtW';
test('read-only replay of reported check-in payment with the pinned SDK', {timeout:45000}, async () => {
 const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
 const result=await client.core.getTransaction({digest,include:{transaction:true,balanceChanges:true},signal:AbortSignal.timeout(20000)});
 console.log('RECOVERY_CHAIN_DIAGNOSTIC '+JSON.stringify(result,(_key,value)=>typeof value==='bigint'?value.toString():value));
 assert.equal(result.$kind,'Transaction');
 if(result.$kind!=='Transaction') throw Error('Not a successful transaction');
 const tx=result.Transaction;
 console.log('RECOVERY_FIELD_TYPES '+JSON.stringify({timestampType:typeof tx.timestampMs,checkpointType:typeof tx.checkpoint,transactionKeys:Object.keys(tx.transaction||{}),balanceChanges:tx.balanceChanges}));
 assert.ok(typeof tx.timestampMs==='number'&&Number.isFinite(tx.timestampMs));
 // Synthetic window intentionally covers the public transaction timestamp.
 // The real checkout's timing is checked independently, not published here.
 const intent={id:'d5be9869-bd35-4079-bf86-29ea7ebb0e79',wallet:tx.transaction.sender,dateKey:'2026-11-06',createdAt:new Date(tx.timestampMs-10000).toISOString(),expiresAt:new Date(tx.timestampMs+900000).toISOString()};
 const memos=[];
 for(const command of tx.transaction.commands){
  const m=(command as any).MoveCall;
  if(!m||m.module!=='string'||m.function!=='utf8')continue;
  const input=(tx.transaction.inputs as any[])[m.arguments?.[0]?.Input];
  try{memos.push(new TextDecoder().decode(Uint8Array.from(bcs.vector(bcs.u8()).fromBase64(input.Pure.bytes))));}
  catch(error){memos.push({decodeError:String(error),input,arguments:m.arguments});}
 }
 console.log('RECOVERY_MEMO_DIAGNOSTIC '+JSON.stringify({expected:memoFor(intent),decoded:memos}));
 try{
  const paidAt=verifyRecoveryPayment(result,intent,digest,Date.now());
  console.log('RECOVERY_VERIFIER_RESULT '+JSON.stringify({verified:true,paidAt}));
  assert.equal(paidAt,new Date(tx.timestampMs).toISOString());
 }catch(error){
  console.log('RECOVERY_VERIFIER_RESULT '+JSON.stringify({verified:false,message:String(error)}));
  throw error;
 }
});
