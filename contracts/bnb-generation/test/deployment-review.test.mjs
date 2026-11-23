import test from 'node:test';import assert from 'node:assert/strict';
import {readOnlyRemote,verifyDeploymentPacket,verifyRuntime} from '../scripts/deployment-review.mjs';
import {artifact} from '../scripts/compile.mjs';
import saved from '../../../docs/multichain/generation-milestone/bnb-deployment-review/review.json' with {type:'json'};
const now=Date.parse(saved.preparedAt);
test('exact saved three-step deployment review matches current compiled initcode',async()=>assert(await verifyDeploymentPacket(saved,now)));
for(const [name,change] of [['sender',p=>p.steps[0].unsigned.from='0x1'],['route',p=>p.route='0x'+'00'.repeat(32)],['treasury',p=>p.treasury='0x'+'00'.repeat(20)],['nonce',p=>p.steps[1].unsigned.nonce++],['call data',p=>p.steps[2].unsigned.data+='00'],['extra step',p=>p.steps.push(p.steps[2])],['value transfer',p=>p.steps[0].unsigned.value='1'],['gas limit',p=>p.steps[0].unsigned.gasLimit='99999999'],['wrong chain',p=>p.steps[1].unsigned.chainId=1],['expired',p=>p.preparedAt=new Date(now-120001).toISOString()]])test('reject changed '+name,async()=>{const p=structuredClone(saved);change(p);await assert.rejects(verifyDeploymentPacket(p,now));});
test('remote submission and signing methods rejected before fetch',async()=>{let calls=0;const remote=readOnlyRemote(async()=>{calls++;throw Error('unexpected fetch')});for(const method of ['eth_sendTransaction','eth_sendRawTransaction','eth_sign','personal_sign','evm_setAccountBalance'])await assert.rejects(remote.request({method}),/forbidden/);assert.equal(calls,0);});
test('runtime rejects modified executable bytes',()=>{const a=artifact('src/TreePassAdapter.sol','TreePassAdapter');const b=Buffer.from(a.evm.deployedBytecode.object,'hex');b[0]^=1;assert.throws(()=>verifyRuntime(a,'0x'+b.toString('hex')));});

test('reject fees exceeding the proposed aggregate cap',async()=>{const p=structuredClone(saved);p.gasPriceWei='1000000000';for(const s of p.steps)s.unsigned.gasPrice=p.gasPriceWei;p.maximumCostWeiAtQuotedGasPrice=String(p.steps.reduce((sum,s)=>sum+BigInt(s.unsigned.gasLimit)*BigInt(p.gasPriceWei),0n));await assert.rejects(verifyDeploymentPacket(p,now),/Total fee exceeds/);});
test('reject OApp object substituted for package peer',async()=>{const p=structuredClone(saved);p.suiPeer=p.sui.state.data.vault.asMoveObject.contents.json.oapp;await assert.rejects(verifyDeploymentPacket(p,now));});
