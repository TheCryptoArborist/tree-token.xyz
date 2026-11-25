import assert from 'node:assert/strict';
import {C,ulnValue,metadataBase64} from './configuration-encoding.mjs';
import {entries} from './configuration-review.mjs';
import {peer,options} from './binding-review.mjs';
const json=o=>o.asMoveObject.contents.json;
export const POST_QUERY='query($tx:JSON!){simulateTransaction(transaction:$tx,checksEnabled:true,doGasSelection:false){effects{status objectChanges(first:50){pageInfo{hasNextPage} nodes{address outputState{asMoveObject{contents{type{repr} json}}}}}}}}';
export function verifyPostState(kind,post,state){
 assert(!post.errors);const effects=post.data.simulateTransaction.effects;assert.equal(effects.status,'SUCCESS');assert.equal(effects.objectChanges.pageInfo.hasNextPage,false);
 const nodes=effects.objectChanges.nodes,objects=Object.fromEntries(nodes.filter(n=>n.outputState?.asMoveObject).map(n=>[n.address,json(n.outputState)]));
 if(kind==='configuration'){
 const values={appLibraries:{send_lib:C.ulnPackage,receive_lib:C.ulnPackage,receive_lib_timeout:null},appExecutor:{max_message_size:'10000',executor:C.executor},appSend:ulnValue(5),appReceive:ulnValue(20)};
 for(const [n,e]of Object.entries(entries))assert.deepEqual(objects[e.id].value,values[n]);
 const registration=structuredClone(json(state.registration));registration.value.oapp_info=metadataBase64();assert.deepEqual(objects[C.registration],registration);
 }else{
 assert.equal(kind,'binding');const v=structuredClone(json(state.vault));v.bound=true;v.peer={bytes:Buffer.from(peer.slice(2),'hex').toString('base64')};assert.deepEqual(objects[C.vault],v);
 const o=structuredClone(json(state.oapp));o.peer.peers.size='1';o.enforced_options.options.size='2';assert.deepEqual(objects[C.oapp],o);
 const channel=structuredClone(json(state.channel));channel.channels.size='1';assert.deepEqual(objects[C.channel],channel);
 const fields=Object.values(objects).filter(x=>Object.hasOwn(x,'name'));assert.equal(fields.length,4);
 const p=fields.find(x=>x.name===30102);assert.deepEqual(p.value,v.peer);
 for(const msg_type of [1,3])assert.equal(fields.find(x=>x.name.eid===30102&&x.name.msg_type===msg_type).value,Buffer.from(options,'hex').toString('base64'));
 const ch=fields.find(x=>x.name.remote_eid===30102);assert.deepEqual(ch.name.remote_oapp,v.peer);assert.equal(ch.value.outbound_nonce,'0');assert.equal(ch.value.lazy_inbound_nonce,'0');assert.equal(ch.value.inbound_payload_hashes.size,'0');
 }
 return {postStateVerified:true};
}
