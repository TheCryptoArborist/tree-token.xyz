import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySlotSimulation} from './slot-review.mjs';
import {verifyNegative} from './slot-negative.mjs';
import packet from '../../../docs/multichain/generation-milestone/slot-review/simulation.json' with {type:'json'};
import negative from '../../../docs/multichain/generation-milestone/slot-review/negative-simulations.json' with {type:'json'};
test('mainnet unsigned slot simulation has only reviewed effects',()=>assert.equal(verifySlotSimulation(packet.simulation).estimatedNetGasMist,'3892851'));
for(const [name,mutate] of [
 ['extra command',t=>t.transaction.commands.push(t.transaction.commands[0])],
 ['wrong type',t=>t.transaction.commands[0].MoveCall.typeArguments=['0x2::sui::SUI']],
 ['wrong admin',t=>t.transaction.inputs[1].Object.ImmOrOwnedObject.objectId='0x1'],
 ['wrong sender',t=>t.transaction.sender='0x1'],
 ['excess budget',t=>t.transaction.gasData.budget='100000000'],
 ['capability transfer',t=>t.effects.changedObjects[1].outputOwner.AddressOwner='0x1'],
 ['extra created vault',t=>t.effects.changedObjects.push(t.effects.changedObjects[2])],
 ['wrong event backing',t=>t.events[0].json.nft.bytes=''],
 ['wrong chain',t=>t.transaction.expiration.ValidDuring.chain='other'],
 ['asset transfer',t=>t.balanceChanges.push(t.balanceChanges[0])],
])test('reject '+name,()=>{const r=structuredClone(packet.simulation);mutate(r.Transaction);assert.throws(()=>verifySlotSimulation(r));});
for(const c of negative.cases)test('live failure proves '+c.name+' atomic rejection',()=>verifyNegative(c.name,c.result));
