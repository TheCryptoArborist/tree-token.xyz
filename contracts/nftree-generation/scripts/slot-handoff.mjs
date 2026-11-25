import assert from 'node:assert/strict';
import {prepareSlot,verifySlotSimulation,REGISTRY,ADMIN} from './slot-review.mjs';
import {newClient,C} from './readiness.mjs';
import {PACKAGE} from './verify-published.mjs';
import {review} from '../../../tools/generation-slot/core.mjs';
export async function prepareSlotHandoff(client=newClient()){
 const packet=await prepareSlot(client);packet.schema='tree-empty-slot-wallet-handoff-v1';packet.preparedAt=Date.now();
 await review(packet,{address:C.sender,chains:['sui:mainnet']});return packet;
}
export async function verifySlotReceipt(digest,client=newClient()){
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});
 const proof=verifySlotSimulation(result);assert.equal(result.Transaction.digest,digest);
 const vaultId=proof.simulatedVaultId;
 const state=await client.query({query:`query {chainIdentifier checkpoint{sequenceNumber timestamp}
 registry:object(address:"${REGISTRY}"){asMoveObject{contents{json}}}
 admin:object(address:"${ADMIN}"){owner{__typename ...on AddressOwner{address{address}}} asMoveObject{contents{json}}}
 vault:object(address:"${vaultId}"){owner{__typename} asMoveObject{contents{type{repr} json}}}}`});
 assert(!state.errors);assert.equal(state.data.chainIdentifier,C.chain);
 const registry=state.data.registry.asMoveObject.contents.json,vault=state.data.vault.asMoveObject.contents.json;
 assert.equal(registry.slot,vaultId);assert.equal(registry.cap,null);assert.equal(vault.registry,REGISTRY);
 assert.equal(state.data.vault.owner.__typename,'Shared');assert.equal(state.data.vault.asMoveObject.contents.type.repr,PACKAGE+'::vault::Vault<'+C.nftType+'>');
 assert.equal(state.data.admin.owner.address.address,C.sender);assert.equal(state.data.admin.asMoveObject.contents.json.registry,REGISTRY);
 assert.equal(vault.oapp,'0x0da3d845f4ab18a0a8d2f0669722a1d9161c2ea61ad714abc14d414721fd14e4');
 assert.equal(vault.cap.cap_type.pos0,PACKAGE);
 assert.equal(Buffer.from(vault.backing.bytes,'base64').toString('hex'),C.nft.slice(2));
 assert.equal(Buffer.from(vault.route.bytes,'base64').toString('hex'),vaultId.slice(2));
 for(const key of ['peer','request','recipient'])assert(Buffer.from(vault[key].bytes,'base64').equals(Buffer.alloc(32)));
 for(const key of ['paused','announced','ack_sent'])assert.equal(vault[key],false);
 assert.equal(vault.nft,null);assert.equal(vault.bound,false);assert.equal(vault.phase,0);assert.equal(vault.generation,'0');
 return {digest,gasMist:proof.estimatedNetGasMist,packageId:PACKAGE,registryId:REGISTRY,vaultId,empty:true,bound:false,state};
}
