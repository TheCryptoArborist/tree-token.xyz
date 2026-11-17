// Offline, unsigned preparation only. This file never signs or submits a transaction.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {Transaction} from '@mysten/sui/transactions';import {bcs} from '@mysten/sui/bcs';import {encodePacked,keccak256,concatHex} from 'viem';
import {C,validateFundState} from './original-fund-core.mjs';import {entries,canonical,json,optionsBase64} from './original-peer-state.mjs';
const dir='docs/multichain/original-trial/',read=n=>JSON.parse(fs.readFileSync(dir+n+'.json'));
const before=read('fund-verified').currentSuiState;validateFundState(before,1);
const quote=read('reserve-quote-simulation'),send=read('reserve-send-simulation'),post=read('reserve-send-poststate-simulation');
const eq=(a,b,m)=>assert.equal(canonical(a),canonical(b),m),norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
const u64=x=>BigInt(bcs.u64().parse(Uint8Array.from(Object.values(x))));
const fee=u64(quote.commandResults.at(-2).returnValues[0].bcs);assert.ok(fee>0n&&fee<=500000000n);assert.equal(u64(quote.commandResults.at(-1).returnValues[0].bcs),0n);
for(const [name,result]of [['quote',quote],['send',send]]){
 const tx=Transaction.from(fs.readFileSync(dir+'reserve-'+name+'-unsigned.json','utf8')),d=tx.getData(),t=result.Transaction;
 assert.equal(result.$kind,'Transaction');assert.equal(t.status.success,true);assert.equal(t.transaction.sender,C.sender);assert.equal(t.transaction.gasData.owner,C.sender);
 for(const n of ['commands','inputs'])eq(norm(t.transaction[n]),norm(d[n]),'Exact unsigned '+name+' '+n);
 assert.equal(d.gasData.budget,null);assert.equal(d.gasData.payment,null);
 assert.ok(d.inputs.every(x=>!x.Object?.ImmOrOwnedObject));
 assert.equal(d.commands.filter(x=>x.MoveCall?.module==='dvn'&&x.MoveCall.function===(name==='quote'?'get_fee':'assign_job')).length,3);
 assert.ok(!d.commands.some(x=>/set_|fund|register|bind/.test(x.MoveCall?.function??'')||x.Publish||x.Upgrade));
 const original=d.commands.filter(x=>x.MoveCall?.module==='vault');assert.equal(original.length,2);for(const x of original){assert.equal(x.MoveCall.package,C.package);eq(x.MoveCall.typeArguments,[C.nftType]);}
 const gasIds=new Set([t.effects.gasObject?.objectId,...t.transaction.gasData.payment.map(x=>x.objectId)]),appIds=new Map([[C.vault,'2'],[C.oapp,'1'],[C.channel,C.channelVersion]]),writes=new Set();
 for(const c of t.effects.changedObjects){
  if(c.inputState==='Exists'){
   if(gasIds.has(c.objectId)){assert.equal(c.inputOwner.AddressOwner,C.sender);continue;}
   assert.equal(name,'send','Quote must not mutate custody or security');writes.add(c.objectId);
   if(appIds.has(c.objectId)){assert.equal(String(c.inputOwner.Shared.initialSharedVersion),appIds.get(c.objectId));eq(norm(c.inputOwner),norm(c.outputOwner));}
   else{assert.equal(c.objectId,entries.channelPath.id);assert.equal(c.inputOwner.ObjectOwner,entries.channelPath.parent);assert.equal(c.outputOwner.ObjectOwner,entries.channelPath.parent);}
   assert.equal(c.outputState,'ObjectWrite');assert.equal(c.idOperation,'None');
  }else if(c.outputState==='ObjectWrite'){
   assert.equal(name,'send');assert.equal(c.idOperation,'Created');assert.match(t.objectTypes[c.objectId],/^0x0*2::coin::Coin<0x0*2::sui::SUI>$/);
   assert.ok([C.sender,'0xf99b445ae678d3f28fe7acb91e5d7ee8ab538d7e231a837b12c593fb624ad630','0x9004e1e4c6dcc42d1b73269db48d510192665677fcad2079a3c7d1e9e971d34e'].includes(c.outputOwner.AddressOwner));
  }else assert.ok(c.inputState==='DoesNotExist'&&c.outputOwner===null&&((c.outputState==='AccumulatorWriteV1'&&c.idOperation==='None')||(c.outputState==='DoesNotExist'&&c.idOperation==='Created')));
 }
 if(name==='send')eq([...writes].sort(),[C.vault,C.oapp,C.channel,entries.channelPath.id].sort());
}
const zero='0x'+'0'.repeat(64),guid=keccak256(encodePacked(['uint64','uint32','bytes32','uint32','bytes32'],[1n,30378,C.package,30102,C.peer])),payload=concatHex(['0x0201',C.vault,C.nft,zero,zero]),packet=concatHex([encodePacked(['uint8','uint64','uint32','bytes32','uint32','bytes32'],[1,1n,30378,C.package,30102,C.peer]),guid,payload]),b64=h=>Buffer.from(h.slice(2),'hex').toString('base64');
const [executor,dvns,sent]=send.Transaction.events;assert.equal(send.Transaction.events.length,3);assert.equal(executor.eventType,C.ulnPackage+'::send_uln::ExecutorFeePaidEvent');assert.equal(dvns.eventType,C.ulnPackage+'::send_uln::DVNFeePaidEvent');assert.equal(executor.json.executor,C.executor);eq(executor.json.guid,{bytes:b64(guid)});eq(dvns.json.guid,executor.json.guid);eq(dvns.json.dvns,C.dvns);assert.equal(dvns.json.fees.length,3);
eq([sent.eventType,sent.json],[C.endpointPackage+'::messaging_channel::PacketSentEvent',{encoded_packet:b64(packet),options:optionsBase64,send_library:C.ulnPackage}]);
const amounts=[executor.json.fee,...dvns.json.fees];assert.equal(amounts.reduce((n,x)=>n+BigInt(x.fee),0n),fee);const t=send.Transaction,g=t.effects.gasUsed,gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);assert.ok(gas>0n&&gas<=100000000n);const expected=new Map([[C.sender,-fee-gas]]);for(const x of amounts)expected.set(x.recipient,(expected.get(x.recipient)??0n)+BigInt(x.fee));assert.equal(t.balanceChanges.length,expected.size);for(const x of t.balanceChanges){assert.match(x.coinType,/^0x0*2::sui::SUI$/);assert.equal(BigInt(x.amount),expected.get(x.address));expected.delete(x.address);}assert.equal(expected.size,0);
assert.equal(post.data.simulateTransaction.effects.status,'SUCCESS');const nodes=post.data.simulateTransaction.effects.objectChanges.nodes;const at=id=>nodes.find(x=>x.address===id)?.outputState;eq(json(at(C.vault)),{...json(before.vault),announced:true});eq(at(C.vault).owner,before.vault.owner);for(const n of ['oapp','channel']){eq(json(at(C[n])),json(before[n]));eq(at(C[n]).owner,before[n].owner);}
eq(json(at(entries.channelPath.id)).value,{...before.channelPath.dynamicField.value.json,outbound_nonce:'1'});
const proof={checkedAt:new Date().toISOString(),mode:'unsigned_simulation_only',result:'passed',depositDigest:'GLXLAmCD3DrbdK55NXmppr7uPEWDdrYYF9JBd3C5XBvE',guid,payload,packet,feeMist:String(fee),gasMist:String(gas),totalMist:String(fee+gas),originalNft:C.nft,vault:C.vault,receiver:C.peer,nonce:'1',sourceEid:30378,destinationEid:30102,requiredDvns:C.dvns,executor:C.executor,nftRemainsIntactInVault:true,simulatedAnnouncement:true,actualAnnouncementSent:false,assistantSubmittedTransactions:0,saleEnabled:false,note:'Preparation only. A fresh browser preflight, reviewed signing page and separate user signature are still required. No actual reserve packet or BNB delivery is claimed.',guidance:['accessing-data/SKILL.md','accessing-data/graphql.md','ptbs/SKILL.md','ptbs/building.md','ptbs/commands.md','move-security/SKILL.md','move-security/best-practices.md']};
fs.writeFileSync(dir+'reserve-preparation-verified.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
