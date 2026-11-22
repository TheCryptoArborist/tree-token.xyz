import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Transaction} from '@mysten/sui/transactions';
import saved from '../../../docs/multichain/generation-milestone/publication-review/wallet-handoff.json' with {type:'json'};
import {verifyHandoff,verifyResolvedBytes} from './wallet-handoff.mjs';
import {C} from './readiness.mjs';
const context={address:C.sender,chain:'sui:mainnet',now:saved.preparedAt};
const bytes=()=>Uint8Array.from(Buffer.from(saved.transactionBase64,'base64'));
test('full unsigned bytes round trip and match exact checked simulation',async()=>{
 const tx=await verifyHandoff(saved,context);assert.deepEqual(await tx.build(),bytes());
});
for(const [label,change] of [
 ['different sender',tx=>tx.setSender('0x1')],
 ['sponsor substitution',tx=>tx.setGasOwner('0x1')],
 ['higher gas budget',tx=>tx.setGasBudget(200000000)],
 ['unbounded validity',tx=>tx.setExpiration({None:true})],
 ['wrong chain in validity',tx=>tx.setExpiration({ValidDuring:{...tx.getData().expiration.ValidDuring,chain:'11111111111111111111111111111111'}})],
 ['extra transfer',tx=>tx.transferObjects([tx.gas],tx.pure.address(C.sender))],
])test('resolved bytes reject '+label,async()=>{
 const tx=Transaction.from(bytes());change(tx);
 await assert.rejects(async()=>verifyResolvedBytes(await tx.build()));
});
for(const [label,change,ctx] of [
 ['wrong connected wallet',()=>{},{address:'0x1'}],
 ['wrong network',()=>{},{chain:'sui:testnet'}],
 ['expired handoff',()=>{},{now:saved.preparedAt+120001}],
 ['simulation substitution',p=>p.simulation.Transaction.bcs[0]=255],
 ['epoch mismatch',p=>p.simulation.Transaction.epoch='1'],
 ['different capability recipient',p=>{const x=p.simulation.Transaction.effects.changedObjects.find(x=>x.outputOwner?.AddressOwner===C.sender&&x.inputState!=='Exists');x.outputOwner.AddressOwner='0x1';}],
 ['authority approval injected',p=>p.authorized=true],
 ['hash mismatch',p=>p.transactionSha256='bad'],
])test('handoff rejects '+label,async()=>{
 const p=structuredClone(saved);change(p);await assert.rejects(verifyHandoff(p,{...context,...ctx}));
});
test('valid but different gas price bytes cannot reuse simulation',async()=>{
 const p=structuredClone(saved),tx=Transaction.from(bytes());tx.setGasPrice(101);
 const altered=await tx.build();p.transactionBase64=Buffer.from(altered).toString('base64');
 p.transactionSha256=createHash('sha256').update(altered).digest('hex');
 await assert.rejects(verifyHandoff(p,context),/Simulation bytes differ/);
});
