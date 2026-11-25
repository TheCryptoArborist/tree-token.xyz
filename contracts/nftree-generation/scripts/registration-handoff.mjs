import assert from 'node:assert/strict';import {Transaction} from '@mysten/sui/transactions';
import {C,readState,registration,verifyRegistration} from './registration-review.mjs';
import {newClient,readCandidate} from './readiness.mjs';import {verifySlotReceipt} from './slot-handoff.mjs';
import P from '../../bnb-generation/browser/pinned-build.json' with {type:'json'};
import {verifyInactiveBnb} from './registration-bnb.mjs';
export async function prepareRegistrationHandoff(client=newClient()){
 const [bnb,before]=await Promise.all([verifyInactiveBnb(),readState(client)]);await verifySlotReceipt(P.slotDigest,client);
 const tx=registration(before);tx.setGasPayment([]);const bytes=await tx.build({client});
 const simulation=await client.core.simulateTransaction({transaction:bytes,doGasSelection:false,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true},signal:AbortSignal.timeout(45000)});
 const proof=verifyRegistration(simulation,before);assert.deepEqual(Uint8Array.from(Object.values(simulation.Transaction.bcs)),bytes);
 const after=await readState(client);for(const k of ['vault','admin','registration'])assert.deepEqual(before[k],after[k],'State changed while simulating');
 const candidate=await readCandidate(client);
 return {schema:'tree-generation-registration-handoff-v1',preparedAt:Date.now(),transactionBase64:Buffer.from(bytes).toString('base64'),estimatedNetGasMist:proof.gasMist,gasBudgetMist:'20000000',before,after,candidate,bnb,simulation};
}
export async function verifyRegistrationReceipt(digest,client=newClient()){
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});assert.equal(result.Transaction?.digest,digest);
 // Historical owned-reference validity is established by successful execution and
 // exact capability ID/ownership effects. Current state is checked separately.
 const input=result.Transaction.transaction.inputs[1].Object.ImmOrOwnedObject;
 const proof=verifyRegistration(result,{vault:{owner:{initialSharedVersion:'2'}},admin:input});
 const current=await readState(client,{registered:true}),entry=current.registration.dynamicField?.value?.json;
 assert.deepEqual(entry,{messaging_channel:proof.channelId,oapp_info:'',delegate:'0x'+'0'.repeat(64)});
 const channel=await client.query({query:`query{object(address:"${proof.channelId}"){owner{__typename ...on Shared{initialSharedVersion}} asMoveObject{contents{type{repr} json}}}}`});assert(!channel.errors);const o=channel.data.object;assert.equal(o.owner.__typename,'Shared');assert.equal(o.asMoveObject.contents.type.repr,C.endpointPackage+'::messaging_channel::MessagingChannel');assert.equal(o.asMoveObject.contents.json.oapp,C.package);assert.equal(o.asMoveObject.contents.json.is_sending,false);assert.equal(o.asMoveObject.contents.json.channels.size,'0');
 const bnb=await verifyInactiveBnb();return {digest,packageId:C.package,vaultId:C.vault,...proof,empty:true,bound:false,current,channel,bnb};
}
