import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';
import {parseSiweMessage} from 'viem/siwe';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
import {makeEvmMessage, verifyWalletProof} from '../netlify/lib/tree-account-signatures.mjs';
const origin='https://accounts.example.test';
function proof(address){const p={wallet:{family:'evm',address,chainId:97},origin,nonce:'1'.repeat(64),issuedAt:Date.now(),expiresAt:Date.now()+300000};p.message=makeEvmMessage(p);return p;}
test('official Sui SDK verifies an actual signature and rejects another address',async()=>{
 const key=new Ed25519Keypair(),p={wallet:{family:'sui',address:key.toSuiAddress()},message:'TREE Arcade test message'};
 const signed=await key.signPersonalMessage(new TextEncoder().encode(p.message));
 assert.equal(await verifyWalletProof(p,signed.signature),'sui');
 assert.equal(await verifyWalletProof({...p,wallet:{family:'sui',address:new Ed25519Keypair().toSuiAddress()}},signed.signature),null);
});
test('official viem verifies an actual EOA SIWE signature',async()=>{
 const account=privateKeyToAccount(generatePrivateKey()),p=proof(account.address),signature=await account.signMessage({message:p.message});
 assert.equal(await verifyWalletProof(p,signature,()=>{throw Error('EOA should not need RPC')}),'eoa');
 const parsed=parseSiweMessage(p.message);assert.equal(parsed.domain,'accounts.example.test');assert.equal(parsed.chainId,97);assert.equal(parsed.nonce,p.nonce);
});
test('tampered EVM message does not verify as EOA',async()=>{
 const account=privateKeyToAccount(generatePrivateKey()),p=proof(account.address),signature=await account.signMessage({message:p.message});
 assert.equal(await verifyWalletProof({...p,message:p.message+'tampered'},signature,()=>({verifySiweMessage:async()=>false})),null);
});
test('contract-wallet fallback binds expected address domain and nonce',async()=>{
 const p=proof('0x'+'a'.repeat(40));let received;
 assert.equal(await verifyWalletProof(p,'0x1234',()=>({verifySiweMessage:async v=>{received=v;return true;}})),'contract');
 assert.equal(received.domain,'accounts.example.test');assert.equal(received.nonce,p.nonce);assert.equal(received.address.toLowerCase(),p.wallet.address);
});
test('contract RPC outage does not become a successful login',async()=>{
 const p=proof('0x'+'a'.repeat(40));await assert.rejects(verifyWalletProof(p,'0x1234',()=>({verifySiweMessage:async()=>{throw Error('RPC unavailable')}})));
});
