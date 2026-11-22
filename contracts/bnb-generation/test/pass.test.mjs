import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider, Contract, ContractFactory, id, ZeroHash, solidityPacked, parseEther} from 'ethers';
import {artifact} from '../scripts/compile.mjs';
const EP='0x1a44076050125825900e736c501f859c50fE728c';
const USDT='0x55d398326f99059fF775485246999027B3197955';
const TREASURY='0xC440F06BBC7e58b0d055815f915447e4ae0E3720';
const NFT='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
const PEER=id('NEW_LOCAL_SUI_PACKAGE'), ROUTE=id('NEW_LOCAL_GENERATION_VAULT');
const RECIPIENT='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
const PRICE=parseEther('25');
const wire=(kind,gen=1,request=ZeroHash,to=ZeroHash,route=ROUTE,nft=NFT)=>solidityPacked(
  ['uint8','uint8','bytes32','bytes32','uint64','bytes32','bytes32'], [3,kind,route,nft,gen,request,to]);
async function rejected(fn) { await assert.rejects(async()=>{ const r=await fn(); if(r?.wait) await r.wait(); }); }
async function fixture(chainId=56) {
  const rpc=ganache.provider({chain:{chainId,hardfork:'shanghai'},wallet:{totalAccounts:5,defaultBalance:100},logging:{quiet:true}});
  const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1}); provider.pollingInterval=10;
  const signers=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
  const addresses=await Promise.all(signers.map(s=>s.getAddress()));
  const deploy=async(file,name,args=[])=>{const a=artifact(file,name); const c=await new ContractFactory(a.abi,'0x'+a.evm.bytecode.object,signers[0]).deploy(...args); await c.waitForDeployment(); return c;};
  for(const [address,name] of [[EP,'FixtureEndpoint'],[USDT,'FixtureUSDT']])
    await rpc.request({method:'evm_setAccountCode',params:[address,'0x'+artifact('test/Fixtures.sol',name).evm.deployedBytecode.object]});
  const close=()=>rpc.disconnect();
  if(chainId!==56) return {deploy,close};
  const token=new Contract(USDT,artifact('test/Fixtures.sol','FixtureUSDT').abi,signers[0]);
  const endpoint=new Contract(EP,artifact('test/Fixtures.sol','FixtureEndpoint').abi,signers[0]);
  const adapter=await deploy('src/TreePassAdapter.sol','TreePassAdapter',[PEER,ROUTE]);
  const pass=await deploy('src/TreeSuitePass.sol','TreeSuitePass',[adapter.target]);
  await(await adapter.bindPass(pass.target)).wait();
  const origin=(nonce=1,sender=PEER,srcEid=30378)=>({nonce,sender,srcEid});
  const deliver=(message,nonce=1,guid=id(message),sender=PEER,eid=30378,value=0)=>endpoint.deliver(adapter.target,origin(nonce,sender,eid),guid,message,{value});
  const reserve=async(gen=1)=>{await(await deliver(wire(1,gen))).wait();};
  const ready=async(gen=1)=>{await reserve(gen); await(await pass.setPurchasesPaused(false)).wait(); await(await token.mint(addresses[0],PRICE*2n)).wait(); await(await token.approve(pass.target,PRICE*2n)).wait();};
  const buy=async()=>{await ready(); await(await pass.buy()).wait();};
  const lock=async()=>{await buy(); await(await pass.requestRedemption(RECIPIENT)).wait();};
  const ack=async()=>wire(3,await pass.generation(),await pass.redemption(),await pass.recipient());
  return {rpc,provider,signers,addresses,deploy,token,endpoint,adapter,pass,origin,deliver,reserve,ready,buy,lock,ack,close};
}
async function scenario(fn) { const f=await fixture(); try {await fn(f);} finally {await f.close();} }

test('deployment rejects wrong chain, missing currency, six decimals, and wrong adapter binding',async()=>{
  const wrong=await fixture(1); try {await rejected(()=>wrong.deploy('src/TreePassAdapter.sol','TreePassAdapter',[PEER,ROUTE]));} finally {await wrong.close();}
  await scenario(async f=>{
    await rejected(()=>f.pass.connect(f.signers[1]).setPurchasesPaused(false));
    await rejected(()=>f.adapter.connect(f.signers[1]).bindPass(f.pass.target));
    await rejected(()=>f.adapter.bindPass(f.pass.target));
    await rejected(()=>f.deploy('src/TreeSuitePass.sol','TreeSuitePass',[f.addresses[1]]));
    await f.rpc.request({method:'evm_setAccountCode',params:[USDT,'0x'+artifact('test/Fixtures.sol','SixDecimals').evm.deployedBytecode.object]});
    await rejected(()=>f.deploy('src/TreeSuitePass.sol','TreeSuitePass',[f.adapter.target]));
    await f.rpc.request({method:'evm_setAccountCode',params:[USDT,'0x']});
    await rejected(()=>f.deploy('src/TreeSuitePass.sol','TreeSuitePass',[f.adapter.target]));
  });
});
test('endpoint, peer, chain, GUID, wire and route authenticate every incoming reserve',async()=>scenario(async f=>{
  await rejected(()=>f.adapter.lzReceive(f.origin(),id('g'),wire(1),f.addresses[0],'0x'));
  for(const args of [[wire(1),0],[wire(1),1,id('g'),id('wrong')],[wire(1),1,id('g'),PEER,30101],
    [wire(1),1,ZeroHash],[wire(1),1,id('g'),PEER,30378,1],[wire(1,0)],[wire(1,2)],
    [wire(1,1,id('nonzero'))],[wire(1,1,ZeroHash,id('nonzero'))],
    [wire(1,1,ZeroHash,ZeroHash,id('wrong'))],[wire(1,1,ZeroHash,ZeroHash,ROUTE,id('wrong'))],
    [wire(2)],[wire(4)],[wire(1)+'00'],['0x0201'+wire(1).slice(6)],['0x0301']]) await rejected(()=>f.deliver(...args));
  assert.equal(await f.pass.generation(),0n); assert.equal(await f.pass.state(),0n);
  const receipt=await(await f.deliver(wire(1))).wait(); assert.ok(receipt.gasUsed<200000n);
  assert.equal(await f.adapter.allowInitializePath(f.origin()),true);
  assert.equal(await f.adapter.allowInitializePath(f.origin(1,id('bad'))),false);
  assert.equal(await f.adapter.nextNonce(30378,PEER),0n);
}));
test('private 25 USDT sale; transfer invalidates old owner; only current owner can lock; no resale after lock',async()=>scenario(async f=>{
  await rejected(()=>f.pass.buy()); await f.reserve(); await rejected(()=>f.pass.buy());
  await f.ready(); await rejected(()=>f.pass.connect(f.signers[1]).buy());
  await(await f.pass.buy()).wait(); assert.equal(await f.token.balanceOf(TREASURY),PRICE);
  assert.equal(await f.pass.canPlay(f.addresses[0]),true); await rejected(()=>f.pass.buy());
  await(await f.pass.approve(f.addresses[2],1)).wait();
  await(await f.pass.connect(f.signers[2]).transferFrom(f.addresses[0],f.addresses[1],1)).wait();
  assert.equal(await f.pass.canPlay(f.addresses[0]),false); assert.equal(await f.pass.canPlay(f.addresses[1]),true);
  await rejected(()=>f.pass.requestRedemption(RECIPIENT));
  await(await f.pass.connect(f.signers[1]).approve(f.addresses[2],1)).wait();
  await rejected(()=>f.pass.connect(f.signers[2]).requestRedemption(RECIPIENT));
  await rejected(()=>f.pass.connect(f.signers[1]).requestRedemption(ZeroHash));
  await(await f.pass.connect(f.signers[1]).requestRedemption(RECIPIENT)).wait();
  assert.equal(await f.pass.canPlay(f.addresses[1]),false);
  await rejected(()=>f.pass.connect(f.signers[1]).transferFrom(f.addresses[1],f.addresses[0],1));
  await rejected(()=>f.pass.connect(f.signers[2]).transferFrom(f.addresses[1],f.addresses[0],1));
  await rejected(()=>f.pass.connect(f.signers[1]).requestRedemption(id('changed')));
}));
for(const [mode,label] of [[1,'false-return'],[2,'short transfer']]) test(label+' rolls back payment and mint',async()=>scenario(async f=>{
  await f.ready(); await(await f.token.setMode(mode)).wait(); await rejected(()=>f.pass.buy());
  assert.equal(await f.pass.state(),1n); assert.equal(await f.token.balanceOf(TREASURY),0n);
  assert.equal(await f.pass.canPlay(f.addresses[0]),false); await rejected(()=>f.pass.ownerOf(1));
}));
for(const [mode,label] of [[3,'no return data'],[4,'reentrant token']]) test(label+' cannot duplicate purchase',async()=>scenario(async f=>{
  await f.ready(); await(await f.token.setMode(mode)).wait(); await(await f.pass.buy()).wait();
  assert.equal(await f.pass.state(),2n); assert.equal(await f.token.balanceOf(TREASURY),PRICE);
  assert.equal(await f.token.reentrySucceeded(),false);
}));
test('currency runtime changes after reserve fail closed',async()=>scenario(async f=>{
  await f.ready(); await f.rpc.request({method:'evm_setAccountCode',params:[USDT,'0x'+artifact('test/Fixtures.sol','SixDecimals').evm.deployedBytecode.object]});
  await rejected(()=>f.pass.buy()); assert.equal(await f.pass.state(),1n);
}));
test('identical reserves never unlock or remint; later generation forbidden while ready, active or locked',async()=>scenario(async f=>{
  await f.ready(); await f.reserve(); await rejected(()=>f.reserve(2));
  await(await f.pass.buy()).wait(); await f.reserve(); assert.equal(await f.pass.state(),2n); await rejected(()=>f.reserve(2));
  await(await f.pass.requestRedemption(RECIPIENT)).wait(); await f.reserve();
  assert.equal(await f.pass.state(),3n); assert.equal(await f.pass.canPlay(f.addresses[0]),false); await rejected(()=>f.reserve(2));
  await(await f.deliver(await f.ack())).wait(); await f.reserve();
  assert.equal(await f.pass.state(),4n); await rejected(()=>f.pass.ownerOf(1)); await rejected(()=>f.pass.buy());
}));
test('acknowledgement requires exact locked generation, request and recipient; duplicates are safe',async()=>scenario(async f=>{
  await rejected(()=>f.pass.confirmReserve(1)); await rejected(()=>f.pass.acknowledge(1,id('q'),RECIPIENT));
  await f.buy(); await rejected(()=>f.deliver(wire(3,1,id('q'),RECIPIENT)));
  await(await f.pass.requestRedemption(RECIPIENT)).wait(); const req=await f.pass.redemption();
  for(const m of [wire(3,2,req,RECIPIENT),wire(3,1,id('wrong'),RECIPIENT),wire(3,1,req,id('wrong'))]) await rejected(()=>f.deliver(m));
  await(await f.pass.setPurchasesPaused(true)).wait();
  const receipt=await(await f.deliver(await f.ack())).wait(); assert.ok(receipt.gasUsed<200000n);
  await(await f.deliver(await f.ack(),99,id('retry'))).wait(); assert.equal(await f.pass.state(),4n);
  await rejected(()=>f.pass.ownerOf(1)); assert.equal(await f.pass.canPlay(f.addresses[0]),false);
}));
test('permissionless fixed-payload retry and retirement confirmation; pause cannot block exit',async()=>scenario(async f=>{
  await rejected(()=>f.adapter.outboundPayload(2)); await rejected(()=>f.adapter.outboundPayload(4));
  await f.lock(); await(await f.pass.setPurchasesPaused(true)).wait();
  const req=await f.pass.redemption(); assert.equal(await f.adapter.outboundPayload(2),wire(2,1,req,RECIPIENT));
  await rejected(()=>f.adapter.send(2,{value:0})); await rejected(()=>f.adapter.send(2,{value:2}));
  await rejected(()=>f.adapter.connect(f.signers[1]).setReceiveGas(40_000_000));
  await rejected(()=>f.adapter.setReceiveGas(1)); await(await f.adapter.setReceiveGas(40_000_000)).wait();
  for(let i=0;i<2;i++) await(await f.adapter.connect(f.signers[1]).send(2,{value:1})).wait();
  assert.equal(await f.endpoint.lastMessage(),wire(2,1,req,RECIPIENT));
  assert.equal(await f.endpoint.lastPeer(),PEER); assert.equal(await f.endpoint.lastEid(),30378n);
  assert.equal(await f.endpoint.lastRefund(),f.addresses[1]);
  await rejected(()=>f.adapter.send(4,{value:1}));
  await(await f.deliver(await f.ack())).wait(); await rejected(()=>f.adapter.send(2,{value:1}));
  for(let i=0;i<2;i++) await(await f.adapter.send(4,{value:1})).wait();
  assert.equal(await f.endpoint.lastMessage(),wire(4,1,req,RECIPIENT));
}));
test('endpoint failure, token fees and malformed receipt leave pass locked and retryable',async()=>scenario(async f=>{
  await f.lock();
  for(const flags of [[true,false,false],[false,true,false],[false,false,true]]) {
    await(await f.endpoint.configure(...flags)).wait(); await rejected(()=>f.adapter.send(2,{value:1}));
    assert.equal(await f.pass.state(),3n); assert.equal(await f.pass.canPlay(f.addresses[0]),false);
  }
  await(await f.endpoint.configure(false,false,false)).wait(); await(await f.adapter.send(2,{value:1})).wait();
}));
test('two complete generations: burned IDs stay burned; every stale message is rejected',async()=>scenario(async f=>{
  await f.lock(); const oldAck=await f.ack(); await(await f.deliver(oldAck)).wait();
  await(await f.adapter.send(4,{value:1})).wait();
  // Authenticated reserve 2 represents the Sui completion gate, tested in Move.
  await f.reserve(2); assert.equal(await f.pass.purchasesPaused(),true);
  await rejected(()=>f.pass.buy()); await rejected(()=>f.pass.ownerOf(1));
  await rejected(()=>f.reserve(1)); await rejected(()=>f.deliver(oldAck));
  await rejected(()=>f.reserve(3)); await rejected(()=>f.adapter.send(4,{value:1}));
  await f.ready(2); await(await f.pass.buy()).wait(); assert.equal(await f.pass.ownerOf(2),f.addresses[0]);
  await rejected(()=>f.deliver(oldAck)); assert.equal(await f.pass.state(),2n);
  await(await f.pass.requestRedemption(RECIPIENT)).wait(); await(await f.deliver(await f.ack())).wait();
  await(await f.adapter.send(4,{value:1})).wait(); await rejected(()=>f.pass.ownerOf(2));
  assert.equal(await f.pass.canPlay(f.addresses[0]),false);
}));
test('reusing GUID with a changed payload cannot apply a later reserve',async()=>scenario(async f=>{
  await f.lock(); await(await f.deliver(await f.ack())).wait();
  await rejected(()=>f.deliver(wire(1,2),2,id(wire(1)))); assert.equal(await f.pass.generation(),1n);
}));
test('ERC721 receiver rejection rolls back treasury; callback cannot redeem during mint',async()=>scenario(async f=>{
  const buyer=await f.deploy('test/Fixtures.sol','FixtureBuyer');
  const route=id('OTHER_ISOLATED_TEST_ROUTE'); await(await buyer.setup(PEER,route)).wait();
  const a=await buyer.adapter(); const p=new Contract(await buyer.pass(),artifact('src/TreeSuitePass.sol','TreeSuitePass').abi,f.signers[0]);
  await(await f.endpoint.deliver(a,f.origin(),id('buyer-reserve'),wire(1,1,ZeroHash,ZeroHash,route))).wait();
  await(await f.token.mint(buyer.target,PRICE)).wait(); await rejected(()=>buyer.buy(true));
  assert.equal(await f.token.balanceOf(TREASURY),0n); assert.equal(await p.state(),1n);
  await(await buyer.buy(false)).wait(); assert.equal(await buyer.reentrySucceeded(),false);
  assert.equal(await p.canPlay(buyer.target),true);
}));

test('wire v3 matches Move golden vectors, including multi-byte generation endian order',async()=>{
  const {readFile}=await import('node:fs/promises');
  const vectors=JSON.parse(await readFile(new URL('../fixtures/wire-v3.json',import.meta.url)));
  for(const v of vectors) assert.equal(wire(v.kind,BigInt(v.generation),v.request,v.recipient,v.route,v.nft),v.payload);
});
