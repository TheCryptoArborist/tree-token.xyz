// Read/simulate only. No signer and no submission API.
import assert from 'node:assert/strict';
import {Transaction} from '@mysten/sui/transactions';
import {C as BASE,newClient} from './readiness.mjs';
import P from '../../bnb-generation/browser/pinned-build.json' with {type:'json'};
import {verifySlotReceipt} from './slot-handoff.mjs';
export const C=Object.freeze({...BASE,package:P.peer,vault:P.route,registry:P.registry,
 admin:'0x4e7fde0fa22d78a2916f7ea8d2e7d4688d04ee4c60152d8a09d4a334e89f6aac',
 oapp:'0x0da3d845f4ab18a0a8d2f0669722a1d9161c2ea61ad714abc14d414721fd14e4',
 oappAdmin:'0x97be99b8e5c3b8953323c0a481b848c990b9d32814950d803b754b4e140fe25d',
 upgrade:'0xb70e2cdc18d562247bc34bf47efee620a05ec1f059cff5e812a8d433a722999d',
 endpoint:'0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91',
 endpointPackage:'0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac',
 endpointRegistry:'0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec',maxGasMist:20000000n});
const check=(v,m)=>assert(v,m),eq=(a,b,m)=>assert.deepEqual(a,b,m),idPattern=/^0x[0-9a-f]{64}$/;
const fields='address version digest owner{__typename ...on Shared{initialSharedVersion} ...on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}';
export function validateState(s){
 assert.equal(s.chainIdentifier,C.chain);assert(s.checkpoint?.timestamp);const age=Date.now()-Date.parse(s.checkpoint.timestamp);assert(age>=-30000&&age<=120000,'Stale state');
 for(const [name,id]of [['vault',C.vault],['admin',C.admin],['endpoint',C.endpoint]])assert.equal(s[name]?.address,id);
 assert.equal(s.admin.owner.address.address,C.sender);assert.equal(s.admin.asMoveObject.contents.type.repr,C.package+'::vault::AdminCap');assert.equal(s.admin.asMoveObject.contents.json.registry,C.registry);
 assert.equal(s.vault.owner.__typename,'Shared');assert.equal(s.vault.asMoveObject.contents.type.repr,C.package+'::vault::Vault<'+C.nftType+'>');
 const v=s.vault.asMoveObject.contents.json;assert.equal(v.registry,C.registry);assert.equal(v.oapp,C.oapp);assert.equal(v.cap.cap_type.pos0,C.package);assert.equal(v.nft,null);assert.equal(v.bound,false);assert.equal(v.phase,0);assert.equal(v.generation,'0');
 assert.equal(s.endpoint.owner.__typename,'Shared');assert.equal(String(s.endpoint.owner.initialSharedVersion),'635685314');assert.equal(s.endpoint.asMoveObject.contents.type.repr,C.endpointPackage+'::endpoint_v2::EndpointV2');assert.equal(s.endpoint.asMoveObject.contents.json.eid,30378);assert.equal(s.endpoint.asMoveObject.contents.json.oapp_registry.oapps.id,C.endpointRegistry);
 assert(s.registration&&Object.hasOwn(s.registration,'dynamicField'));assert.equal(s.registration.dynamicField,null,'Already registered: recover the existing channel; do not register again');
}
export async function readState(client=newClient()){
 const key=Buffer.from(C.package.slice(2),'hex').toString('base64');
 const r=await client.query({query:`query {chainIdentifier checkpoint{sequenceNumber timestamp} vault:object(address:"${C.vault}"){${fields}} admin:object(address:"${C.admin}"){${fields}} endpoint:object(address:"${C.endpoint}"){${fields}} registration:address(address:"${C.endpointRegistry}"){dynamicField(name:{type:"address",bcs:"${key}"}){value{...on MoveValue{json}}}}}`,signal:AbortSignal.timeout(30000)});assert(!r.errors,JSON.stringify(r.errors));validateState(r.data);return r.data;
}
export function registration(state){validateState(state);const tx=new Transaction();tx.setSender(C.sender);tx.setGasBudget(C.maxGasMist);tx.moveCall({target:C.package+'::vault::register',typeArguments:[C.nftType],arguments:[tx.sharedObjectRef({objectId:C.vault,initialSharedVersion:String(state.vault.owner.initialSharedVersion),mutable:false}),tx.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest}),tx.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:true}),tx.pure.vector('u8',[])]});return tx;}
export function verifyRegistration(result,state){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Registration failed or was already submitted. Check wallet activity.');const t=result.Transaction;check(BigInt(t.transaction.gasData.budget)<=C.maxGasMist,'Gas budget exceeds proposal');
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');const commands=t.transaction.commands;check(commands?.length===1,'Only one registration command is allowed.');const call=commands[0].MoveCall;check(call?.package===C.package&&call.module==='vault'&&call.function==='register','Wrong registration function.');eq(call.typeArguments,[C.nftType],'Wrong original NFT type.');eq(call.arguments.map(x=>x.Input),[0,1,2,3],'Wrong registration arguments.');const inputs=t.transaction.inputs;check(inputs?.length===4,'Wrong input count.');const v=inputs[0]?.Object?.SharedObject,a=inputs[1]?.Object?.ImmOrOwnedObject,e=inputs[2]?.Object?.SharedObject;
 check(v?.objectId===C.vault&&String(v.initialSharedVersion)===String(state.vault.owner.initialSharedVersion)&&v.mutable===false&&a?.objectId===C.admin&&String(a.version)===String(state.admin.version)&&a.digest===state.admin.digest&&e?.objectId===C.endpoint&&String(e.initialSharedVersion)==='635685314'&&e.mutable===true&&inputs[3]?.Pure?.bytes==='AA==','Registration inputs changed.');
 check(t.events?.length===1,'Unexpected registration events.');const ev=t.events[0],channel=ev?.json?.messaging_channel;check(ev?.eventType===C.endpointPackage+'::oapp_registry::OAppRegisteredEvent'&&ev.json.oapp===C.package&&ev.json.oapp_info===''&&idPattern.test(channel),'Wrong registration event/application identity.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing effects.');check(!changes.some(x=>[C.vault,C.nft,C.registry,C.oapp,C.oappAdmin,C.upgrade,C.package].includes(x.objectId)),'Protected custody or configuration changed.');
 const created=changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');check(created.length===2,'Expected channel and registry field only.');const ch=created.find(x=>x.objectId===channel);check(ch?.idOperation==='Created'&&ch.outputOwner?.Shared&&t.objectTypes?.[channel]===C.endpointPackage+'::messaging_channel::MessagingChannel','Missing shared messaging channel.');
 const entry=created.find(x=>x!==ch);check(entry.idOperation==='Created'&&entry.outputOwner?.ObjectOwner===C.endpointRegistry&&t.objectTypes?.[entry.objectId]?.replace(/^0x0*2::/,'0x2::').replace(/\s/g,'')==='0x2::dynamic_field::Field<address,'+C.endpointPackage+'::oapp_registry::OAppRegistration>','Wrong registry field effect.');
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]);let endpointChanged=false;
 for(const x of changes){if(x.inputState==='Exists'){if(x.objectId===C.endpoint){endpointChanged=true;check(x.inputOwner?.Shared&&x.outputOwner?.Shared&&x.outputState==='ObjectWrite','Endpoint changed ownership.');}else if(x.objectId===C.admin)check(x.inputOwner?.AddressOwner===C.sender&&x.outputOwner?.AddressOwner===C.sender&&x.outputState==='ObjectWrite','Admin changed ownership.');else check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');}else if(!created.includes(x))check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected additional effects.');}check(endpointChanged,'Endpoint update missing.');
 const g=t.effects.gasUsed;check(g,'Missing gas effects.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=C.maxGasMist,'Gas exceeds the 0.02-SUI estimate ceiling.');check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected payment.');return {gasMist:String(gas),channelId:channel,registryEntryId:entry.objectId};
}

export async function prepareRegistration(client=newClient()){
 await verifySlotReceipt(P.slotDigest,client);const state=await readState(client),tx=registration(state);
 const result=await client.core.simulateTransaction({transaction:Transaction.from(await tx.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true},signal:AbortSignal.timeout(45000)});
 const proof=verifyRegistration(result,state);return {preparedAt:new Date().toISOString(),submitted:false,authorizedForSigning:false,state,transactionJSON:await tx.toJSON(),result,proof};
}
