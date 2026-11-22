import test from 'node:test';
import assert from 'node:assert/strict';
import saved from '../../../docs/multichain/generation-milestone/publication-review/packet.json' with {type:'json'};
import {verifyPacket,MAX_AGE} from './publication-packet.mjs';
import {C} from './readiness.mjs';
const context={address:C.sender,chain:'sui:mainnet',now:saved.preparedAt};
test('verified review reconstructs only the pinned empty publication',async()=>{
 const tx=await verifyPacket(saved,context);assert.deepEqual(JSON.parse(await tx.toJSON()),saved.transaction);
});
for(const [label,change,ctx] of [
 ['wrong wallet',()=>{},{address:'0x1'}],
 ['wrong chain',()=>{},{chain:'sui:testnet'}],
 ['expired review',()=>{},{now:saved.preparedAt+MAX_AGE+1}],
 ['future review',()=>{},{now:saved.preparedAt-1}],
 ['changed cap policy',p=>p.upgradePolicy='immutable'],
 ['changed gas budget',p=>p.transaction.gasData.budget='999999999'],
 ['extra command',p=>p.transaction.commands.push(p.transaction.commands[1])],
 ['changed transaction bytes',p=>p.transactionKindBase64+='AA'],
 ['changed byte hash',p=>p.transactionKindSha256='0'.repeat(64)],
 ['signing enabled',p=>p.signingEnabled=true],
 ['deposit included',p=>p.depositIncluded=true],
 ['failed simulation',p=>p.simulation.Transaction.status.success=false],
 ['different owner',p=>p.candidateObservation.nft.owner.address.address='0x1'],
 ['unbounded simulation',p=>p.simulation.Transaction.transaction.gasData.budget='200000000'],
])test('reject '+label,async()=>{const p=structuredClone(saved);change(p);await assert.rejects(verifyPacket(p,{...context,...ctx}));});
