// Read-only preparation. No wallet, signer or submission API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Transaction} from '@mysten/sui/transactions';
import {C,newClient,readCandidate,verifyCandidate} from './readiness.mjs';
import {PACKAGE,readEvidence,verifyPublished} from './verify-published.mjs';
const saved=readEvidence();
export const REGISTRY=saved.objects.data.o1.address;
export const ADMIN=saved.objects.data.o2.address;
export const GAS_BUDGET=20000000;
export function slotTransaction(){
 const tx=new Transaction();tx.setSender(C.sender);tx.setGasBudget(GAS_BUDGET);tx.setGasPayment([]);
 tx.moveCall({target:PACKAGE+'::vault::create_slot',typeArguments:[C.nftType],arguments:[tx.object(REGISTRY),tx.object(ADMIN)]});
 return tx;
}
export async function readState(client){
 const fields=saved.objects.data;
 const selections=Object.entries(fields).filter(([,v])=>v?.address).map(([alias,v])=>`${alias}:object(address:"${v.address}"){address version digest owner{__typename ...on AddressOwner{address{address}} ...on Shared{initialSharedVersion}} asMoveObject{contents{type{repr} json}}}`);
 const objects=await client.query({query:`query {chainIdentifier checkpoint{sequenceNumber timestamp} ${selections.join(' ')}}`,signal:AbortSignal.timeout(20000)});
 const candidate=await readCandidate(client);
 verifyPublished({...saved,objects,candidate});
 assert(Math.abs(Date.now()-Date.parse(objects.data.checkpoint.timestamp))<120000,'Stale registry read');
 return {objects,candidate};
}
export function verifySlotSimulation(result){
 assert.equal(result.$kind,'Transaction');const t=result.Transaction;
 assert.equal(t.status.success,true);assert.equal(t.transaction.sender,C.sender);
 const tx=t.transaction;assert.equal(tx.commands.length,1);const call=tx.commands[0].MoveCall;
 assert.equal(call.package,PACKAGE);assert.equal(call.module,'vault');assert.equal(call.function,'create_slot');
 assert.deepEqual(call.typeArguments,[C.nftType]);assert.deepEqual(call.arguments.map(x=>x.Input),[0,1]);
 assert.equal(tx.inputs.length,2);
 assert.equal(tx.inputs[0].Object.SharedObject.objectId,REGISTRY);
 assert.equal(tx.inputs[0].Object.SharedObject.mutable,true);
 assert.equal(tx.inputs[0].Object.SharedObject.initialSharedVersion,'1');
 assert.equal(tx.inputs[1].Object.ImmOrOwnedObject.objectId,ADMIN);
 assert.equal(tx.inputs[1].Object.ImmOrOwnedObject.version,'1');
 assert.equal(tx.inputs[1].Object.ImmOrOwnedObject.digest,saved.objects.data.o2.digest);
 assert.equal(tx.gasData.owner,C.sender);assert.equal(tx.gasData.budget,String(GAS_BUDGET));assert.deepEqual(tx.gasData.payment,[]);
 const changes=t.effects.changedObjects;
 assert(!changes.some(x=>x.objectId===C.nft),'NFT unexpectedly touched');
 const created=changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');assert.equal(created.length,1);
 const vault=created[0];assert.equal(t.objectTypes[vault.objectId],PACKAGE+'::vault::Vault<'+C.nftType+'>');assert(vault.outputOwner?.Shared);assert.equal(vault.idOperation,'Created');
 for(const x of changes){
  if(x===vault)continue;
  if(x.inputState==='Exists'){
   assert([REGISTRY,ADMIN].includes(x.objectId),'Unexpected mutation');assert.equal(x.outputState,'ObjectWrite');assert.equal(x.idOperation,'None');
   if(x.objectId===ADMIN)assert.equal(x.outputOwner?.AddressOwner,C.sender);else assert(x.outputOwner?.Shared);
  }else assert(x.inputState==='DoesNotExist'&&x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None'&&x.outputOwner===null,'Unexpected effect');
 }
 assert(changes.some(x=>x.objectId===REGISTRY&&x.inputState==='Exists'));
 assert.equal(t.events.length,1);const event=t.events[0];
 assert.equal(event.eventType,PACKAGE+'::vault::SlotCreated');
 assert.equal(event.packageId,PACKAGE);assert.equal(event.sender,C.sender);assert.equal(event.module,'vault');
 assert.equal(event.json.registry,REGISTRY);assert.equal(event.json.vault,vault.objectId);
 assert.equal(Buffer.from(event.json.nft.bytes,'base64').toString('hex'),C.nft.slice(2));
 const validity=tx.expiration?.ValidDuring;assert(validity);assert.equal(validity.chain,C.chain);
 assert.equal(BigInt(validity.maxEpoch)-BigInt(validity.minEpoch),1n);
 const epoch=BigInt(t.epoch);assert(epoch>=BigInt(validity.minEpoch)&&epoch<=BigInt(validity.maxEpoch));
 const gas=t.effects.gasUsed;const net=BigInt(gas.computationCost)+BigInt(gas.storageCost)-BigInt(gas.storageRebate);
 assert(net>0n&&net<BigInt(GAS_BUDGET));assert.equal(t.balanceChanges.length,1);const balance=t.balanceChanges[0];assert.equal(balance.address,C.sender);assert(/^0x0*2::sui::SUI$/.test(balance.coinType));assert.equal(BigInt(balance.amount),-net);
 return {estimatedNetGasMist:String(net),simulatedVaultId:vault.objectId};
}
export async function prepareSlot(client=newClient()){
 const before=await readState(client);const tx=slotTransaction();const bytes=await tx.build({client});
 const simulation=await client.core.simulateTransaction({transaction:bytes,doGasSelection:false,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true},signal:AbortSignal.timeout(45000)});
 const after=await readState(client);assert.deepEqual(before.objects.data.o1,after.objects.data.o1);assert.deepEqual(before.candidate.nft,after.candidate.nft);
 assert.deepEqual(Uint8Array.from(Object.values(simulation.Transaction.bcs)),bytes);
 const proof=verifySlotSimulation(simulation);
 return {schema:'tree-empty-slot-review-v1',preparedAt:new Date().toISOString(),authorized:false,submitted:false,...proof,gasBudgetMist:String(GAS_BUDGET),transactionBase64:Buffer.from(bytes).toString('base64'),transactionSha256:createHash('sha256').update(bytes).digest('hex'),before,after,simulation,warning:'Unsigned simulation only. Simulated Vault ID is not deployed. Refresh state and transaction before any separately approved signature. No NFT deposit or peer configuration.'};
}
if(process.argv[1]?.endsWith('/slot-review.mjs')){
 const dest=process.argv[2];assert(dest,'Provide a new output filename');assert(!fs.existsSync(dest),'Do not overwrite prior evidence');
 const packet=await prepareSlot();fs.writeFileSync(dest,JSON.stringify(packet,null,2)+'\n');console.log(JSON.stringify({output:dest,gas:packet.estimatedNetGasMist,submitted:false}));
}
