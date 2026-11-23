import test from 'node:test';import assert from 'node:assert/strict';import {verifyBurnReceipt} from './verify-acknowledgement-bnb.mjs';import saved from '../../../docs/multichain/generation-milestone/acknowledgement-completed/bnb-verification.json' with {type:'json'};
test('canonical packet delivery and exact first pass burn',()=>assert(verifyBurnReceipt(saved.receipt).burnVerified));
for(const [name,change]of [
 ['failed receipt',r=>r.status='0x0'],['removed event',r=>r.logs[0].removed=true],['missing burn',r=>r.logs.shift()],
 ['nonzero burn recipient',r=>r.logs[0].topics[2]=r.logs[0].topics[1]],['wrong token',r=>r.logs[0].topics[3]='0x'+'0'.repeat(63)+'2'],
 ['wrong request',r=>r.logs[1].topics[2]='0x'+'0'.repeat(64)],['wrong GUID',r=>r.logs[2].topics[1]='0x'+'0'.repeat(64)],
 ['wrong kind',r=>r.logs[2].data='0x'+'0'.repeat(63)+'4'+r.logs[2].data.slice(66)],['missing endpoint event',r=>r.logs.pop()]
])test('reject '+name,()=>{const r=structuredClone(saved.receipt);change(r);assert.throws(()=>verifyBurnReceipt(r));});
