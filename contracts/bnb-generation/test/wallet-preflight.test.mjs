import test from 'node:test';import assert from 'node:assert/strict';
import {verifyWalletIntent} from '../scripts/wallet-preflight.mjs';
const intent={address:'0xF2Ab1eEBbEcb4E315FE95D8b532D1aB00F1A8789',treasury:'0xC440F06BBC7e58b0d055815f915447e4ae0E3720',chainId:56};
test('selected roles agree with source but do not imply deployment readiness',()=>assert.equal(verifyWalletIntent(intent).deploymentReady,false));
for(const [label,change] of [['hot deployer',{address:'0x0000000000000000000000000000000000000001'}],['testnet',{chainId:97}],['redirected fees',{treasury:intent.address}]])test('reject '+label,()=>assert.throws(()=>verifyWalletIntent({...intent,...change})));
