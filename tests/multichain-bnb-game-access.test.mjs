import test from 'node:test';
import assert from 'node:assert/strict';
import { getAddress, keccak256, verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BNB_CHAIN_ID, BNB_ORIGIN, BNB_IDENTITY_SCOPE, BNB_LOGIN_URI, BNB_PILOT_PASS,
  BnbAccessError, issueBnbChallenge, verifyBnbChallenge, verifyBnbGameEntitlement,
} from '../scripts/multichain/bnb-game-access-core.mjs';

const NOW = Date.parse('2026-11-20T19:00:00.000Z');
const account = privateKeyToAccount('0x' + 'a5'.repeat(32));
const A = getAddress('0x' + '11'.repeat(20));
const B = getAddress('0x' + '22'.repeat(20));
const C = getAddress('0x' + '33'.repeat(20));
const NFT = '0x' + '44'.repeat(32);
const ROUTE = '0x' + '55'.repeat(32);
const PEER = '0x' + '66'.repeat(32);
const bytes = { [A.toLowerCase()]:'0x60016001', [B.toLowerCase()]:'0x60026002', [C.toLowerCase()]:'0x60036003' };
const policy = {
  kind:'reviewed-original-backed-production', chainId:56, tokenId:1n,
  pass:{ address:A, codeHash:keccak256(bytes[A.toLowerCase()]) },
  adapter:{ address:B, codeHash:keccak256(bytes[B.toLowerCase()]) },
  registry:{ address:C, codeHash:keccak256(bytes[C.toLowerCase()]) },
  nftId:NFT, route:ROUTE, suiPeer:PEER, generation:7,
};
const getRegistry = async () => ({
  status:'active-backed', sourceCustodyConfirmed:true, redemptionPending:false,
  chainId:56, generation:7, tokenId:'1', registryAddress:C,
  passAddress:A, nftId:NFT, route:ROUTE,
});
const SESSION = Object.freeze({ wallet:account.address.toLowerCase(), authenticated:true,
  chainId:56, origin:BNB_ORIGIN, scope:BNB_IDENTITY_SCOPE });

function makeClient(overrides={}) {
  const trace = [];
  const passValues = {
    state:2n, ownerOf:account.address, canPlay:true, backingNFT:NFT,
    route:ROUTE, adapter:B,
  };
  const adapterValues = {pass:A, backingNFT:NFT, route:ROUTE, suiPeer:PEER};
  const client = {
    trace, ...overrides,
    getChainId: overrides.getChainId || (async () => 56),
    getBlockNumber: overrides.getBlockNumber || (async () => 100n),
    getBytecode: overrides.getBytecode || (async ({address,blockNumber}) => {
      trace.push(['code',address,blockNumber]);return bytes[address.toLowerCase()];
    }),
    readContract: overrides.readContract || (async ({address,functionName,args,blockNumber}) => {
      trace.push(['read',address,functionName,args,blockNumber]);
      const table = address.toLowerCase() === A.toLowerCase() ? passValues : adapterValues;
      return table[functionName];
    }),
  };
  return {client,passValues,adapterValues,trace};
}
function assertBlocked(e, code, status) {
  assert(e instanceof BnbAccessError); assert.equal(e.code, code);
  assert.equal(e.status, status); return true;
}
test('issues an exact short-lived chain-qualified human-readable BNB challenge', () => {
  const {record,message} = issueBnbChallenge({wallet:account.address,nonce:'A'.repeat(32),now:NOW});
  assert.equal(record.scope,BNB_IDENTITY_SCOPE);
  assert.equal(record.chainId,BNB_CHAIN_ID);
  assert.equal(record.origin,BNB_ORIGIN);
  assert.equal(record.uri,BNB_LOGIN_URI);
  assert.equal(Date.parse(record.expiresAt)-Date.parse(record.issuedAt),300000);
  assert(message.includes('Chain ID: 56'));
  assert(message.includes('No payment, token approval or Sui wallet'));
  assert(!message.includes('USDT approval'));
  assert.throws(() => issueBnbChallenge({wallet:account.address,nonce:'short',now:NOW}),/invalid-challenge/);
});
test('checks real EOA signature and consumes stored nonce exactly once', async () => {
  const {record,message}=issueBnbChallenge({wallet:account.address,nonce:'B'.repeat(32),now:NOW});
  const signature=await account.signMessage({message});
  const used=new Set();
  const consumeNonce=async ({nonce,messageHash,origin,scope,wallet}) => {
    assert.equal(messageHash,keccak256('0x'+Buffer.from(message).toString('hex')));
    assert.equal(origin,BNB_ORIGIN);assert.equal(scope,BNB_IDENTITY_SCOPE);
    assert.equal(wallet,account.address.toLowerCase());
    if(used.has(nonce))return false;used.add(nonce);return true;
  };
  const client={getChainId:async()=>56,verifyMessage};
  const result=await verifyBnbChallenge({record,message,signature,wallet:account.address,client,consumeNonce,now:NOW+1000});
  assert.deepEqual(result,SESSION);
  await assert.rejects(verifyBnbChallenge({record,message,signature,wallet:account.address,client,consumeNonce,now:NOW+1000}),
    e=>assertBlocked(e,'challenge-used',403));
});
test('rejects changed message, changed wallet, expiry and network before consumption', async () => {
  const {record,message}=issueBnbChallenge({wallet:account.address,nonce:'C'.repeat(32),now:NOW});
  const signature=await account.signMessage({message});
  let consumptions=0;
  const consumeNonce=async()=>{consumptions++;return true;};
  const common={record,message,signature,wallet:account.address,now:NOW+1000,consumeNonce,client:{getChainId:async()=>56,verifyMessage}};
  await assert.rejects(verifyBnbChallenge({...common,message:message.replace('Chain ID: 56','Chain ID: 1')}),
    e=>assertBlocked(e,'invalid-proof',403));
  await assert.rejects(verifyBnbChallenge({...common,wallet:getAddress('0x'+'77'.repeat(20))}),
    e=>assertBlocked(e,'invalid-proof',403));
  await assert.rejects(verifyBnbChallenge({...common,now:NOW+300000}),
    e=>assertBlocked(e,'expired-challenge',403));
  await assert.rejects(verifyBnbChallenge({...common,client:{getChainId:async()=>1,verifyMessage}}),
    e=>assertBlocked(e,'wrong-chain',403));
  const fakeSig=await privateKeyToAccount('0x'+'b6'.repeat(32)).signMessage({message});
  await assert.rejects(verifyBnbChallenge({...common,signature:fakeSig}),
    e=>assertBlocked(e,'signature-mismatch',403));
  assert.equal(consumptions,0);
});
test('missing atomic nonce store and signature provider fail closed', async () => {
  const {record,message}=issueBnbChallenge({wallet:account.address,nonce:'D'.repeat(32),now:NOW});
  const signature=await account.signMessage({message});
  const base={record,message,signature,wallet:account.address,now:NOW+1000};
  await assert.rejects(verifyBnbChallenge({...base,consumeNonce:async()=>true}),
    e=>assertBlocked(e,'invalid-proof',403));
  await assert.rejects(verifyBnbChallenge({...base,client:{getChainId:async()=>56,verifyMessage},consumeNonce:async()=>{throw Error('db offline');}}),
    e=>assertBlocked(e,'entitlement-unavailable',503));
});
test('retired disposable pilot contract is never admitted, even if mocked active',async()=>{
  const {client}=makeClient();
  await assert.rejects(verifyBnbGameEntitlement({session:SESSION,policy:{...policy,pass:{...policy.pass,address:BNB_PILOT_PASS}},client,readRegistryRecord:getRegistry}),
    e=>assertBlocked(e,'entitlement-unavailable',503));
});
test('requires an approved manifest and trusted backed-registry reader',async()=>{
  const {client}=makeClient();
  await assert.rejects(verifyBnbGameEntitlement({session:SESSION,client,readRegistryRecord:getRegistry}),
    e=>assertBlocked(e,'entitlement-unavailable',503));
  await assert.rejects(verifyBnbGameEntitlement({session:SESSION,policy,client}),
    e=>assertBlocked(e,'entitlement-unavailable',503));
  await assert.rejects(verifyBnbGameEntitlement({session:{...SESSION,scope:'sui:mainnet'},policy,client,readRegistryRecord:getRegistry}),
    e=>assertBlocked(e,'wrong-session-scope',403));
});
test('mocked fully backed active pass can qualify at one pinned block (not a live entitlement)',async()=>{
  const {client,trace}=makeClient();
  const result=await verifyBnbGameEntitlement({session:SESSION,policy,client,readRegistryRecord:async query=>{
    assert.equal(query.blockNumber,100n);assert.equal(query.registryAddress,C);return getRegistry();
  }});
  assert.equal(result.eligible,true);assert.equal(result.chainId,56);
  assert.equal(result.wallet,account.address.toLowerCase());
  assert.equal(result.generation,7);assert.equal(result.verifiedBlock,'100');
  assert(trace.length>=12);
  assert(trace.every(row=>row[row.length-1]===100n));
});
test('rechecks for every game action; lock, transfer and access revocation deny immediately',async()=>{
  const {client,passValues}=makeClient();
  const run=()=>verifyBnbGameEntitlement({session:SESSION,policy,client,readRegistryRecord:getRegistry});
  assert.equal((await run()).eligible,true);
  passValues.state=3n;
  await assert.rejects(run(),e=>assertBlocked(e,'pass-not-active',403));
  passValues.state=2n;passValues.ownerOf=getAddress('0x'+'77'.repeat(20));
  await assert.rejects(run(),e=>assertBlocked(e,'entitlement-mismatch',403));
  passValues.ownerOf=account.address;passValues.canPlay=false;
  await assert.rejects(run(),e=>assertBlocked(e,'entitlement-mismatch',403));
});
test('fails closed on missing backing, mismatched generation or redemption pending',async()=>{
  const {client}=makeClient();
  for(const change of [{status:'pending'},{generation:8},{redemptionPending:true},{sourceCustodyConfirmed:false},{passAddress:B}]){
    const readRegistryRecord=async()=>({...await getRegistry(),...change});
    await assert.rejects(verifyBnbGameEntitlement({session:SESSION,policy,client,readRegistryRecord}),
      e=>assertBlocked(e,'backing-unverified',403));
  }
});
test('wrong network, RPC outage and runtime drift cannot authorize',async()=>{
  await assert.rejects(verifyBnbGameEntitlement({session:SESSION,policy,client:makeClient({getChainId:async()=>1}).client,readRegistryRecord:getRegistry}),
    e=>assertBlocked(e,'wrong-chain',403));
  await assert.rejects(verifyBnbGameEntitlement({session:SESSION,policy,client:makeClient({getBytecode:async()=>{throw Error('network offline')}}).client,readRegistryRecord:getRegistry}),
    e=>assertBlocked(e,'entitlement-unavailable',503));
  await assert.rejects(verifyBnbGameEntitlement({session:SESSION,policy,client:makeClient({getBytecode:async()=> '0x6000'}).client,readRegistryRecord:getRegistry}),
    e=>assertBlocked(e,'entitlement-unavailable',503));
});
