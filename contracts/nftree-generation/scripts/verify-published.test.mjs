import test from 'node:test';import assert from 'node:assert/strict';import {readEvidence,verifyPublished} from './verify-published.mjs';
const saved=readEvidence();
test('actual publication and current empty state match approved build and ownership',()=>assert.equal(verifyPublished(saved).emptyRegistry,true));
for(const [label,change] of [
 ['substituted digest',e=>e.transaction.Transaction.digest='bad'],
 ['altered module',e=>{const m=e.package.data.object.asMovePackage.modules.nodes[0];const b=Buffer.from(m.bytes,'base64');b[b.length-1]^=1;m.bytes=b.toString('base64');}],
 ['additional module',e=>e.package.data.object.asMovePackage.modules.nodes.push(e.package.data.object.asMovePackage.modules.nodes[0])],
 ['moved capability',e=>e.objects.data.o2.owner.address.address='0x1'],
 ['allocated slot',e=>e.objects.data.o1.asMoveObject.contents.json.slot='0x1'],
 ['configured peer',e=>e.objects.data.o0.asMoveObject.contents.json.peer.peers.size='1'],
 ['wrong upgrade package',e=>e.objects.data.o4.asMoveObject.contents.json.package='0x1'],
 ['wrong original owner',e=>e.candidate.nft.owner.address.address='0x1'],
])test('reject '+label,()=>{const e=structuredClone(saved);change(e);assert.throws(()=>verifyPublished(e));});
