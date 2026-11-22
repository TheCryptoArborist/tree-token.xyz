import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {C,publication,verifyBuild,verifyPublication,verifyNativeType,verifyCandidate,readOnlyFetch} from './readiness.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../../../docs/multichain/generation-milestone/readiness/'+name+'.json',import.meta.url)));
const fixture=load('publishResult');
const native=load('nativeResult');
const summary=load('summary');
const alter=fn=>{const copy=structuredClone(fixture);fn(copy.Transaction);return copy;};

test('reviewed publication reproduces pinned bytecode and creates only the six expected objects',async()=>{
 verifyBuild(); const tx=JSON.parse(await publication().toJSON());assert.equal(tx.commands.length,2);
 const proof=verifyPublication(fixture);assert.equal(proof.gasMist,'69723600');assert.equal(proof.objects.length,6);
 assert.equal(summary.published,false);assert.equal(summary.funded,false);assert.equal(summary.signingEnabled,false);
});
for(const [name,change] of [
 ['failed transaction',t=>{t.status.success=false;}],
 ['extra command',t=>{t.transaction.commands.push(t.transaction.commands[1]);}],
 ['changed bytecode',t=>{t.transaction.commands[0].Publish.modules[0]='AA==';}],
 ['changed dependency',t=>{t.transaction.commands[0].Publish.dependencies[0]=C.nft;}],
 ['extra NFT input',t=>{t.transaction.inputs.push({Object:{ImmOrOwnedObject:{objectId:C.nft}}});}],
 ['NFT effect',t=>{t.effects.changedObjects.push({objectId:C.nft});}],
 ['unexpected object mutation',t=>{t.effects.changedObjects.push({objectId:'0xbad',inputState:'Exists',inputOwner:{AddressOwner:C.sender}});}],
 ['capability sent elsewhere',t=>{t.effects.changedObjects.find(x=>t.objectTypes[x.objectId]?.endsWith('::vault::AdminCap')).outputOwner.AddressOwner='0xbad';}],
 ['wrong sender',t=>{t.transaction.sender='0xbad';}],
 ['wrong gas owner',t=>{t.transaction.gasData.owner='0xbad';}],
 ['non-SUI payment',t=>{t.balanceChanges[0].coinType='0x2::fake::COIN';}],
 ['excess gas',t=>{t.effects.gasUsed.computationCost='200000001';}],
 ['unknown created type',t=>{const id=Object.keys(t.objectTypes).find(id=>t.objectTypes[id].endsWith('::vault::Registry'));t.objectTypes[id]='0x1::fake::Registry';}],
]) test('publication rejects '+name,()=>assert.throws(()=>verifyPublication(alter(change))));

test('native type probe verifies exact canonical result and rejects substituted call or result',()=>{
 assert.equal(verifyNativeType(native),C.nftType.slice(2));
 const changed=structuredClone(native);changed.Transaction.transaction.commands[0].MoveCall.function='get';
 assert.throws(()=>verifyNativeType(changed));
 const wrong=structuredClone(native);wrong.commandResults[0].returnValues[0].bcs=[1,65];
 assert.throws(()=>verifyNativeType(wrong));
});
test('candidate checks reject stale observations, changed owner, type and identity',()=>{
 const data={chainIdentifier:C.chain,checkpoint:summary.endCheckpoint,nft:summary.candidate};
 const now=Date.parse(summary.observedAt);verifyCandidate(data,now);
 assert.throws(()=>verifyCandidate(data,now+180000));
 for(const change of [x=>x.nft.owner.address.address='0xbad',x=>x.nft.address='0xbad',x=>x.nft.asMoveObject.contents.type.repr='0x1::fake::NFT',x=>x.chainIdentifier='testnet']) {
  const wrong=structuredClone(data);change(wrong);assert.throws(()=>verifyCandidate(wrong,now));
 }
});
test('network wrapper permits simulation queries but rejects mutation or an unexpected endpoint before fetch',async()=>{
 let calls=0;const fetcher=readOnlyFetch(async()=>{calls++;return 'ok';});
 const options=query=>({method:'POST',body:JSON.stringify({query})});
 assert.equal(await fetcher(C.graphql,options('query { simulateTransaction { effects { status } } }')),'ok');
 for(const query of ['mutation { executeTransaction }','query { executeTransaction }','fragment X on Query { x }'])
  await assert.rejects(()=>fetcher(C.graphql,options(query)));
 await assert.rejects(()=>fetcher('https://example.com',options('query { checkpoint { timestamp } }')));
 assert.equal(calls,1);
});
