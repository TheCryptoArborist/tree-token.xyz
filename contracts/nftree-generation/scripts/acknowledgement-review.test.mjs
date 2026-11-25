import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {verifyAcknowledgement} from './acknowledgement-review.mjs';import {acknowledgementTransaction} from './acknowledgement-transaction.mjs';import {C} from './configuration-encoding.mjs';
const dir=new URL('../../../docs/multichain/generation-milestone/acknowledgement-review/',import.meta.url);const read=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',dir)));const fixture=()=>({result:read('simulation'),unsigned:read('unsigned'),before:read('before'),post:read('post'),fee:BigInt(read('review').messageFeeMist)});const verify=p=>verifyAcknowledgement(p.result,p.unsigned,p.before,p.post,p.fee);
test('checked acknowledgement exact fees, packet, unchanged NFT and ack flag',()=>assert(verify(fixture()).acknowledgementOnly));
for(const [name,change]of [
 ['wrong signer',p=>p.result.Transaction.transaction.sender='0x1'],
 ['wrong kind in both supplied shapes',p=>{p.unsigned.inputs[5].Pure.bytes='AQ==';p.result.Transaction.transaction.inputs[5].Pure.bytes='AQ==';}],
 ['fee cap',p=>p.fee=150000001n],
 ['fee mismatch',p=>p.result.Transaction.events[0].json.fee.fee='1'],
 ['altered fee recipient',p=>p.result.Transaction.events[0].json.fee.recipient='0x1'],
 ['wrong packet',p=>p.result.Transaction.events[2].json.encoded_packet='AA=='],
 ['extra event',p=>p.result.Transaction.events.push(p.result.Transaction.events[0])],
 ['original touched',p=>p.result.Transaction.effects.changedObjects.push({objectId:C.nft})],
 ['admin mutation',p=>p.result.Transaction.effects.changedObjects.push({objectId:C.admin,inputState:'Exists',idOperation:'None',outputState:'ObjectWrite'})],
 ['ack flag absent',p=>p.post.data.simulateTransaction.effects.objectChanges.nodes.find(n=>n.address===C.vault).outputState.asMoveObject.contents.json.ack_sent=false],
 ['wrong phase',p=>p.post.data.simulateTransaction.effects.objectChanges.nodes.find(n=>n.address===C.vault).outputState.asMoveObject.contents.json.phase=3],
 ['unaccounted payment',p=>p.result.Transaction.balanceChanges.push(p.result.Transaction.balanceChanges[0])]
])test('reject '+name,()=>{const p=fixture();change(p);assert.throws(()=>verify(p));});
test('builder rejects unsupported action and excessive fee',()=>{assert.throws(()=>acknowledgementTransaction('fund'));assert.throws(()=>acknowledgementTransaction('send',150000001n));});
