// Unsigned, simulation-only binding proposal for the registered generation.
import assert from 'node:assert/strict';
import {Transaction} from '@mysten/sui/transactions';
import {C,canonical} from './configuration-encoding.mjs';
import P from '../../bnb-generation/browser/pinned-build.json' with {type:'json'};
export const peer='0x'+P.addresses.adapter.slice(2).toLowerCase().padStart(64,'0');
export const options='00030100110100000000000000000000000000030d40';
const json=o=>o.asMoveObject.contents.json,base64=h=>Buffer.from(h.replace(/^0x/,''),'hex').toString('base64');
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function binding(state){
 const v=json(state.vault);assert.equal(state.vault.address,C.vault);assert.equal(v.nft,null);assert.equal(v.bound,false);assert.equal(v.phase,0);assert.equal(v.generation,'0');
 for(const [name,id]of [['vaultAdmin',C.vaultAdmin],['admin',C.admin]]){assert.equal(state[name].address,id);assert.equal(state[name].owner.address.address,C.sender);}
 assert.equal(state.channel.address,C.channel);assert.equal(json(state.channel).oapp,C.package);assert.equal(json(state.channel).channels.size,'0');assert.equal(String(state.channel.owner.initialSharedVersion),C.channelVersion);
 assert.equal(state.oapp.address,C.oapp);assert.equal(json(state.oapp).oapp_cap.cap_type.pos0,C.package);assert.equal(json(state.oapp).admin_cap,C.admin);
 const t=new Transaction();t.setSender(C.sender);t.setGasBudget(100000000);t.setGasPayment([]);
 const p=t.moveCall({target:'0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc::bytes32::from_address',arguments:[t.pure.address(peer)]});
 const shared=(name,mutable)=>t.sharedObjectRef({objectId:state[name].address,initialSharedVersion:String(state[name].owner.initialSharedVersion),mutable});
 const owned=name=>t.objectRef({objectId:state[name].address,version:String(state[name].version),digest:state[name].digest});
 t.moveCall({target:C.package+'::vault::bind',typeArguments:[C.nftType],arguments:[shared('vault',true),owned('vaultAdmin'),shared('oapp',true),owned('admin'),shared('endpoint',false),shared('channel',true),p]});return t;
}
export function verifyBinding(result,state){
 assert.equal(result.$kind,'Transaction');const t=result.Transaction;assert.equal(t.status.success,true);assert.equal(t.transaction.sender,C.sender);assert.equal(t.transaction.gasData.owner,C.sender);assert(BigInt(t.transaction.gasData.budget)<=100000000n);
 const expected=binding(state).getData();for(const k of ['inputs','commands'])assert.equal(canonical(norm(t.transaction[k])),canonical(norm(expected[k])),k);
 const events=[
 [C.endpointPackage+'::messaging_channel::ChannelInitializedEvent',{local_oapp:C.package,remote_eid:30102,remote_oapp:{bytes:base64(peer)}}],
 [C.oappPackage+'::oapp_peer::PeerSetEvent',{oapp:C.package,eid:30102,peer:{bytes:base64(peer)}}],
 ...[1,3].map(msg_type=>[C.oappPackage+'::enforced_options::EnforcedOptionSetEvent',{oapp:C.package,eid:30102,msg_type,options:base64(options)}]),
 [C.package+'::vault::Bound',{vault:C.vault,peer:{bytes:base64(peer)}}]];
 assert.deepEqual(t.events.map(e=>[e.eventType,e.json]),events);
 const changes=t.effects.changedObjects,ids=[C.vault,C.vaultAdmin,C.oapp,C.admin,C.channel],gasIds=new Set([t.effects.gasObject?.objectId,...t.transaction.gasData.payment.map(x=>x.objectId)]);
 for(const x of changes){if(x.inputState==='Exists'){assert(ids.includes(x.objectId)||gasIds.has(x.objectId),'Unexpected existing mutation');assert.equal(x.outputState,'ObjectWrite');assert.deepEqual(x.inputOwner,x.outputOwner);}}
 for(const [id,version]of [[C.vault,'2'],[C.oapp,'1'],[C.channel,C.channelVersion]])assert.equal(String(changes.find(x=>x.objectId===id)?.outputOwner?.Shared?.initialSharedVersion),version);
 for(const id of [C.admin,C.vaultAdmin])assert.equal(changes.find(x=>x.objectId===id)?.outputOwner?.AddressOwner,C.sender);
 const parents=[json(state.oapp).peer.peers.id,json(state.channel).channels.id,...Array(2).fill(json(state.oapp).enforced_options.options.id)].sort();
 const created=changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');assert.equal(created.length,4);assert.deepEqual(created.map(x=>x.outputOwner.ObjectOwner).sort(),parents);for(const x of created)assert.equal(x.idOperation,'Created');
 for(const x of changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState!=='ObjectWrite'))assert(x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')));
 const g=t.effects.gasUsed,fee=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);assert(fee>0n&&fee<=100000000n);assert.equal(t.balanceChanges.length,1);assert.equal(t.balanceChanges[0].address,C.sender);assert(/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType));assert.equal(BigInt(t.balanceChanges[0].amount),-fee);
 return {gasMist:String(fee),channel:C.channel,peer,empty:true,generation:0};
}
