import test from 'node:test';import assert from 'node:assert/strict';
import packet from '../../docs/multichain/generation-milestone/publication-review/wallet-handoff.json' with {type:'json'};
import {review,signReviewed,SENDER,CHAIN,requireSigningLocation} from './core.mjs';
const account={address:SENDER,chains:[CHAIN]};
const now=()=>packet.preparedAt;
test('review accepts the independently simulated full-byte fixture',async()=>assert(await review(packet,account,now())));
for(const [label,a,p] of [
 ['wrong account',{...account,address:'0x1'},packet],['wrong network',{...account,chains:['sui:testnet']},packet],
 ['changed policy',account,{...packet,upgradePolicy:'immutable'}],['stale review',account,{...packet,preparedAt:packet.preparedAt-120001}],
])test('reject '+label,async()=>assert.rejects(review(p,a,now())));
test('signing passes exact account/chain and verifies signature before returning',async()=>{
 let verified=false;const result=await signReviewed({packet,account,now,sign:async input=>{assert.equal(input.account,account);assert.equal(input.chain,CHAIN);return {bytes:packet.transactionBase64,signature:'test'};},verifySignature:async()=>{verified=true;}});
 assert(verified);assert(result.digest);
});
test('wallet byte substitution never reaches signature verification',async()=>{
 let verified=false;await assert.rejects(signReviewed({packet,account,now,sign:async()=>({bytes:'AA==',signature:'test'}),verifySignature:async()=>{verified=true;}}),/changed/);assert.equal(verified,false);
});
test('wallet rejection propagates without preparing submission',async()=>{
 await assert.rejects(signReviewed({packet,account,now,sign:async()=>{throw Error('User rejected');},verifySignature:async()=>{throw Error('Should not verify');}}),/User rejected/);
});
test('expired wallet prompt requires fresh review and signature',async()=>{
 let calls=0;await assert.rejects(signReviewed({packet,account,now:()=>packet.preparedAt+(calls++?120001:0),sign:async()=>({bytes:packet.transactionBase64,signature:'test'}),verifySignature:async()=>{throw Error('Should not verify');}}),/expired/);
});
test('invalid signature cannot return a submission',async()=>{
 await assert.rejects(signReviewed({packet,account,now,sign:async()=>({bytes:packet.transactionBase64,signature:'test'}),verifySignature:async()=>{throw Error('Bad signature');}}),/Bad signature/);
});

test('only exact approved canonical signing URL is accepted',()=>{
 assert.doesNotThrow(()=>requireSigningLocation(new URL('https://tree-token.xyz/play/generation-publication/')));
 for(const url of ['https://deploy-preview-280--tree-token.netlify.app/generation-publication/','https://www.tree-token.xyz/play/generation-publication/','http://www.tree-token.xyz/play/generation-publication/','https://www.tree-token.xyz/generation-publication/','https://www.tree-token.xyz.attacker.example/play/generation-publication/'])assert.throws(()=>requireSigningLocation(new URL(url)));
});
