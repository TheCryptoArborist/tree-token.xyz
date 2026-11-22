import test from 'node:test';import assert from 'node:assert/strict';
import {Transaction} from '@mysten/sui/transactions';
import {review,signReviewed,requireSigningLocation,SENDER} from './core.mjs';
import saved from '../../docs/multichain/generation-milestone/slot-review/simulation.json' with {type:'json'};
const now=Date.now(),account={address:SENDER,chains:['sui:mainnet']};
const fixture=()=>({...structuredClone(saved),schema:'tree-empty-slot-wallet-handoff-v1',preparedAt:now});
test('exact slot bytes accepted',async()=>assert(await review(fixture(),account,now)));
for(const [label,change] of [
 ['stale',p=>p.preparedAt-=120001],['future',p=>p.preparedAt+=1],['existing slot',p=>p.after.objects.data.o1.asMoveObject.contents.json.slot='0x1'],['changed owner',p=>p.after.candidate.nft.owner.address.address='0x1'],['changed simulation',p=>p.simulation.Transaction.bcs[0]^=1],['wrong schema',p=>p.schema='tree-empty-publication-wallet-handoff-v1']
])test('reject '+label,async()=>{const p=fixture();change(p);await assert.rejects(review(p,account,now));});
for(const [name,change] of [['extra command',tx=>tx.moveCall({target:'0x2::sui::dummy'})],['excess gas',tx=>tx.setGasBudget(100000000)],['wrong sender',tx=>tx.setSender('0x1')]])test('reject '+name,async()=>{const p=fixture(),tx=Transaction.from(p.transactionBase64);change(tx);p.transactionBase64=Buffer.from(await tx.build()).toString('base64');await assert.rejects(review(p,account,now));});
test('changed wallet bytes never verified or submitted',async()=>{let called=false;await assert.rejects(signReviewed({packet:fixture(),account,now:()=>now,sign:async()=>({bytes:'bad',signature:'bad'}),verifySignature:async()=>{called=true;}}));assert(!called);});
test('reject a review expiring during signature check',async()=>{let clock=now;const p=fixture();await assert.rejects(signReviewed({packet:p,account,now:()=>clock,sign:async()=>({bytes:p.transactionBase64,signature:'mock'}),verifySignature:async()=>{clock+=120001;}}));});
test('only canonical slot page can sign',()=>{requireSigningLocation({origin:'https://tree-token.xyz',pathname:'/play/generation-slot/'});for(const l of [{origin:'https://preview.netlify.app',pathname:'/play/generation-slot/'},{origin:'https://tree-token.xyz',pathname:'/play/generation-publication/'}])assert.throws(()=>requireSigningLocation(l));});
