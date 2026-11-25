// Live read-only adversarial simulations; never submit any transaction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {slotTransaction,REGISTRY,ADMIN,readState} from './slot-review.mjs';
import {C,newClient} from './readiness.mjs';
import {PACKAGE} from './verify-published.mjs';
import {Transaction} from '@mysten/sui/transactions';
export function verifyNegative(name,result){
 assert.equal(result.$kind,'FailedTransaction');const t=result.FailedTransaction;
 assert.equal(t.status.success,false);const error=t.status.error;
 assert.equal(error.$kind,'MoveAbort');assert.equal(error.command,name==='duplicate-slot'?1:0);
 assert.equal(error.MoveAbort.abortCode,name==='duplicate-slot'?'3':'2');
 assert.equal(error.MoveAbort.location.package,PACKAGE);assert.equal(error.MoveAbort.location.functionName,'create_slot');
 assert.equal(t.events.length,0);
 assert(!t.effects.changedObjects.some(x=>x.idOperation==='Created'&&x.outputState==='ObjectWrite'),'Failed request left a slot');
}
export async function negativeSimulations(client=newClient()){
 const before=await readState(client);const base=await slotTransaction().build({client});const cases=[];
 for(const [name,type,duplicate] of [['duplicate-slot',C.nftType,true],['wrong-type','0x2::coin::Coin<0x2::sui::SUI>',false]]){
  const tx=Transaction.from(base);
  if(duplicate)tx.moveCall({target:PACKAGE+'::vault::create_slot',typeArguments:[type],arguments:[tx.object(REGISTRY),tx.object(ADMIN)]});
  // The wrong-type case replaces the sole command through the SDK's serialized data.
  const data=tx.getData();if(!duplicate)data.commands[0].MoveCall.typeArguments=[type];
  const bytes=await Transaction.from(JSON.stringify(data)).build();
  const result=await client.core.simulateTransaction({transaction:bytes,doGasSelection:false,checksEnabled:true,include:{effects:true,events:true,transaction:true,objectTypes:true},signal:AbortSignal.timeout(45000)});
  verifyNegative(name,result);cases.push({name,result});
 }
 const after=await readState(client);assert.deepEqual(before.objects.data.o1,after.objects.data.o1);assert.deepEqual(before.candidate.nft,after.candidate.nft);
 return {submitted:false,cases,before,after};
}
if(process.argv[1]?.endsWith('/slot-negative.mjs')){const dest=process.argv[2];assert(dest&&!fs.existsSync(dest));const result=await negativeSimulations();fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.cases.map(x=>({name:x.name,status:x.result.$kind,error:x.result.FailedTransaction?.status}))));}
