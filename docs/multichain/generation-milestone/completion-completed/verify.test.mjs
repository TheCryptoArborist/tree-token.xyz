import test from 'node:test';import assert from 'node:assert/strict';import {verifyDestination} from './verify.mjs';
import state from './sui-state.json' with {type:'json'};import tx from './sui-delivery.json' with {type:'json'};
const now=Date.parse(state.data.checkpoint.timestamp);
test('accept canonical completion and matching current NFT ownership',()=>assert(verifyDestination(state,tx,now).nftInDevWallet));
for(const [name,change]of [
 ['wrong owner',(s)=>s.data.nft.owner.address.address='0x1'],
 ['wrong original',(s)=>s.data.nft.address='0x1'],
 ['wrong collection',(s)=>s.data.nft.asMoveObject.contents.type.repr='0x1::fake::NFT'],
 ['stale checkpoint',(s)=>s.data.checkpoint.timestamp='2000-01-01T00:00:00Z'],
 ['still held',(s)=>s.data.vault.asMoveObject.contents.json.nft={id:'0x1'}],
 ['wrong generation',(s)=>s.data.vault.asMoveObject.contents.json.generation='2'],
 ['missing completion',(_,t)=>t.Transaction.events=t.Transaction.events.filter(e=>!e.eventType.endsWith('::Completed'))],
 ['wrong request',(_,t)=>t.Transaction.events.find(e=>e.eventType.endsWith('::Completed')).json.request.bytes=Buffer.alloc(32).toString('base64')],
 ['wrong delivery nonce',(_,t)=>t.Transaction.events.find(e=>e.eventType.endsWith('::PacketDeliveredEvent')).json.nonce='1'],
 ['wrong effect digest',(_,t)=>t.Transaction.effects.changedObjects.find(x=>x.objectId===state.data.vault.address).outputDigest='bad'],
 ['phase not completed',s=>s.data.vault.asMoveObject.contents.json.phase=2],
 ['ack not sent',s=>s.data.vault.asMoveObject.contents.json.ack_sent=false],
 ['wrong packet sender',(_,t)=>t.Transaction.events.find(e=>e.eventType.endsWith('::PacketDeliveredEvent')).json.sender.bytes=Buffer.alloc(32,1).toString('base64')],
 ['failed transaction',(_,t)=>t.Transaction.status.success=false],
 ['NFT moved by completion',(_,t)=>t.Transaction.effects.changedObjects.push({objectId:state.data.nft.address})],
 ['wrong delivery digest',s=>s.data.vault.previousTransaction.digest='wrong'],
 ['duplicate completion event',(_,t)=>t.Transaction.events.push(t.Transaction.events.find(e=>e.eventType.endsWith('::Completed')))]
])test('reject '+name,()=>{const s=structuredClone(state),t=structuredClone(tx);change(s,t);assert.throws(()=>verifyDestination(s,t,now));});
