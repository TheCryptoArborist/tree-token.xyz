import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,Contract,ContractFactory,id,ZeroHash,solidityPacked,parseEther,AbiCoder,keccak256} from 'ethers';
import {artifact} from '../scripts/compile.mjs';
const EP='0x1a44076050125825900e736c501f859c50fE728c';
const USDT='0x55d398326f99059fF775485246999027B3197955';
const TREASURY='0xC440F06BBC7e58b0d055815f915447e4ae0E3720';
const NFT='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
const PEER=id('LOCAL_FIXTURE_SUI_PACKAGE'),ROUTE=id('LOCAL_FIXTURE_VAULT'),RECIPIENT='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
const PRICE=parseEther('25');
const wire=(kind,request=ZeroHash,to=ZeroHash,route=ROUTE,nft=NFT)=>solidityPacked(['uint8','uint8','bytes32','bytes32','bytes32','bytes32'],[2,kind,route,nft,request,to]);
async function rejected(call){await assert.rejects(async()=>{const result=await call();if(result?.wait)await result.wait();});}
async function fixture(chainId=56){
 const rpc=ganache.provider({chain:{chainId,hardfork:'shanghai'},wallet:{totalAccounts:5,defaultBalance:100},logging:{quiet:true}});
 const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 const signers=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
 const deploy=async(file,name,args=[])=>{const a=artifact(file,name);const c=await new ContractFactory(a.abi,'0x'+a.evm.bytecode.object,signers[0]).deploy(...args);await c.waitForDeployment();return c;};
 for(const [address,name]of [[EP,'FixtureEndpoint'],[USDT,'FixtureUSDT']])await rpc.request({method:'evm_setAccountCode',params:[address,'0x'+artifact('test/Fixtures.sol',name).evm.deployedBytecode.object]});
 const token=new Contract(USDT,artifact('test/Fixtures.sol','FixtureUSDT').abi,signers[0]);
 const endpoint=new Contract(EP,artifact('test/Fixtures.sol','FixtureEndpoint').abi,signers[0]);
 const close=()=>rpc.disconnect();
 if(chainId!==56)return {deploy,close};
 const adapter=await deploy('src/TreePassAdapter.sol','TreePassAdapter',[PEER,ROUTE]);
 const pass=await deploy('src/TreeSuitePass.sol','TreeSuitePass',[adapter.target]);await (await adapter.bindPass(pass.target)).wait();
 const addresses=await Promise.all(signers.map(s=>s.getAddress()));
 const origin=(nonce=1,sender=PEER,srcEid=30378)=>({nonce,sender,srcEid});
 const deliver=async(message,nonce=1,guid=id(message),sender=PEER,eid=30378,value=0)=>endpoint.deliver(adapter.target,origin(nonce,sender,eid),guid,message,{value});
 const reserve=async()=>{const tx=await deliver(wire(1));return tx.wait();};
 const ready=async()=>{await reserve();await (await pass.setPurchasesPaused(false)).wait();await (await token.mint(addresses[0],PRICE*2n)).wait();await (await token.approve(pass.target,PRICE*2n)).wait();};
 const buy=async()=>{await ready();await(await pass.buy()).wait();};
 const lock=async()=>{await buy();await(await pass.requestRedemption(RECIPIENT)).wait();};
 return {rpc,provider,signers,addresses,deploy,token,endpoint,adapter,pass,origin,deliver,reserve,ready,buy,lock,close};
}
async function scenario(t,fn){const f=await fixture();try{await fn(f);}finally{await f.close();}}
test('deployment rejects another chain and rejects a six-decimal substitute',async()=>{
 const wrong=await fixture(1);try{await rejected(()=>wrong.deploy('src/TreePassAdapter.sol','TreePassAdapter',[PEER,ROUTE]));}finally{await wrong.close();}
 await scenario(null,async f=>{await f.rpc.request({method:'evm_setAccountCode',params:[USDT,'0x'+artifact('test/Fixtures.sol','SixDecimals').evm.deployedBytecode.object]});await rejected(()=>f.deploy('src/TreeSuitePass.sol','TreeSuitePass',[f.adapter.target]));});
});
test('binding, purchase pause, and reserve require their designated authority',async()=>scenario(null,async f=>{
 assert.equal(await f.pass.state(),0n);assert.equal(await f.pass.purchasesPaused(),true);
 await rejected(()=>f.adapter.bindPass(f.pass.target));await rejected(()=>f.pass.connect(f.signers[1]).setPurchasesPaused(false));
 await rejected(()=>f.pass.confirmReserve(ROUTE,NFT));await rejected(()=>f.pass.acknowledge(ROUTE,NFT,id('x'),RECIPIENT));
 await rejected(()=>f.pass.buy());await f.reserve();await rejected(()=>f.pass.buy());
 assert.equal(await f.adapter.allowInitializePath(f.origin()),true);assert.equal(await f.adapter.allowInitializePath(f.origin(1,id('wrong'))),false);
 assert.equal(await f.adapter.nextNonce(30378,PEER),0n);
}));
test('reserve rejects forged endpoint, origin, sequence, payload, and native value',async()=>scenario(null,async f=>{
 await rejected(()=>f.adapter.lzReceive(f.origin(),id('g'),wire(1),f.addresses[0],'0x'));
 for(const args of [[wire(1),2],[wire(1),1,id('g'),id('wrong')],[wire(1),1,id('g'),PEER,30101],[wire(1),1,ZeroHash],[wire(1),1,id('g'),PEER,30378,1],[wire(1,id('nonzero'))],[wire(1,ZeroHash,ZeroHash,id('wrong'))],[wire(1,ZeroHash,ZeroHash,ROUTE,id('wrong'))],[wire(2)],[wire(1)+'00'],['0x0101'+wire(1).slice(6)]])await rejected(()=>f.deliver(...args));
 assert.equal(await f.pass.state(),0n);const receipt=await f.reserve();assert.ok(receipt.gasUsed<200000n,'reserve must fit Sui enforced BNB gas');
 await(await f.deliver(wire(1))).wait();assert.equal(await f.pass.state(),1n);
 await rejected(()=>f.deliver(wire(1,id('conflict')),1,id(wire(1))));
}));
test('25 USDT initial sale pays only treasury; access follows unrestricted ERC721 transfers',async()=>scenario(null,async f=>{
 await f.ready();await rejected(()=>f.pass.connect(f.signers[1]).buy());const before=await f.token.balanceOf(TREASURY);
 await(await f.pass.buy()).wait();assert.equal(await f.token.balanceOf(TREASURY)-before,PRICE);assert.equal(await f.token.balanceOf(f.pass.target),0n);
 assert.equal(await f.pass.ownerOf(1),f.addresses[0]);assert.equal(await f.pass.canPlay(f.addresses[0]),true);await rejected(()=>f.pass.buy());
 const metadata=JSON.parse(Buffer.from((await f.pass.tokenURI(1)).split(',')[1],'base64'));assert.equal(metadata.backing_nft,NFT);assert.equal(metadata.route,ROUTE);assert.equal(metadata.external_url,'https://tree-token.xyz/play/');
 await(await f.pass.setPurchasesPaused(true)).wait();await(await f.pass.approve(f.addresses[2],1)).wait();
 await(await f.pass.connect(f.signers[2]).transferFrom(f.addresses[0],f.addresses[1],1)).wait();
 assert.equal(await f.pass.canPlay(f.addresses[0]),false);assert.equal(await f.pass.canPlay(f.addresses[1]),true);
 await rejected(()=>f.pass.requestRedemption(RECIPIENT));await(await f.pass.connect(f.signers[1]).approve(f.addresses[2],1)).wait();
 await rejected(()=>f.pass.connect(f.signers[2]).requestRedemption(RECIPIENT));await rejected(()=>f.pass.connect(f.signers[1]).requestRedemption(ZeroHash));
 await(await f.pass.connect(f.signers[1]).requestRedemption(RECIPIENT)).wait();assert.equal(await f.pass.state(),3n);assert.equal(await f.pass.canPlay(f.addresses[1]),false);
 await rejected(()=>f.pass.connect(f.signers[1]).transferFrom(f.addresses[1],f.addresses[0],1));
 const expected=keccak256(AbiCoder.defaultAbiCoder().encode(['uint8','uint256','address','bytes32','bytes32','uint256','address','bytes32'],[2,56,f.pass.target,ROUTE,NFT,1,f.addresses[1],RECIPIENT]));assert.equal(await f.pass.redemption(),expected);
}));
for(const [mode,label]of [[1,'false-return'],[2,'fee-on-transfer']])test(label+' payment rolls back mint, state, and treasury changes',async()=>scenario(null,async f=>{
 await f.ready();await(await f.token.setMode(mode)).wait();const before=await f.token.balanceOf(TREASURY);await rejected(()=>f.pass.buy());assert.equal(await f.pass.state(),1n);assert.equal(await f.token.balanceOf(TREASURY),before);await rejected(()=>f.pass.ownerOf(1));
 await(await f.token.setMode(0)).wait();await(await f.pass.buy()).wait();assert.equal(await f.pass.state(),2n);
}));
for(const [mode,label]of [[3,'no-return USDT'],[4,'reentrant token']])test(label+' cannot duplicate a purchase',async()=>scenario(null,async f=>{
 await f.ready();await(await f.token.setMode(mode)).wait();await(await f.pass.buy()).wait();assert.equal(await f.pass.state(),2n);assert.equal(await f.token.balanceOf(TREASURY),PRICE);assert.equal(await f.token.reentrySucceeded(),false);
}));
test('missing allowance rolls back, and rejected safe transfer retains ownership',async()=>scenario(null,async f=>{
 await f.ready();await(await f.token.approve(f.pass.target,0)).wait();await rejected(()=>f.pass.buy());assert.equal(await f.pass.state(),1n);
 await(await f.token.approve(f.pass.target,PRICE)).wait();await(await f.pass.buy()).wait();const receiver=await f.deploy('test/Fixtures.sol','FixtureReceiver');await(await receiver.setReject(true)).wait();
 await rejected(()=>f.pass['safeTransferFrom(address,address,uint256)'](f.addresses[0],receiver.target,1));assert.equal(await f.pass.ownerOf(1),f.addresses[0]);
 await(await receiver.setReject(false)).wait();await(await f.pass['safeTransferFrom(address,address,uint256)'](f.addresses[0],receiver.target,1)).wait();assert.equal(await f.pass.canPlay(receiver.target),true);
}));
test('redemption uses fixed v2 payload, minimum gas and exact fresh native fee; success is one-shot',async()=>scenario(null,async f=>{
 await rejected(()=>f.adapter.quoteRedemption());await f.lock();const payload=wire(2,await f.pass.redemption(),RECIPIENT);assert.equal(await f.adapter.redemptionPayload(),payload);
 await rejected(()=>f.adapter.connect(f.signers[1]).setRedemptionGas(31000000));await rejected(()=>f.adapter.setRedemptionGas(29999999));await(await f.adapter.setRedemptionGas(31000000)).wait();
 const expectedOptions=solidityPacked(['uint16','uint8','uint16','uint8','uint128'],[3,1,17,1,31000000]);assert.equal(await f.adapter.redemptionOptions(),expectedOptions);
 assert.equal((await f.adapter.quoteRedemption()).nativeFee,1n);await rejected(()=>f.adapter.sendRedemption());await rejected(()=>f.adapter.sendRedemption({value:2}));
 await(await f.adapter.connect(f.signers[2]).sendRedemption({value:1})).wait();assert.equal(await f.endpoint.lastMessage(),payload);assert.equal(await f.endpoint.lastOptions(),expectedOptions);assert.equal(await f.endpoint.lastPeer(),PEER);assert.equal(await f.endpoint.lastEid(),30378n);assert.equal(await f.endpoint.lastRefund(),f.addresses[2]);assert.equal(await f.adapter.redemptionSent(),true);
 await rejected(()=>f.adapter.sendRedemption({value:1}));await rejected(()=>f.adapter.quoteRedemption());await rejected(()=>f.adapter.setRedemptionGas(32000000));
}));
test('failed endpoint, unexpected token fee, and malformed receipt roll back send for retry',async()=>scenario(null,async f=>{
 await f.lock();for(const flags of [[true,false,false],[false,true,false],[false,false,true]]){await(await f.endpoint.configure(...flags)).wait();await rejected(()=>f.adapter.sendRedemption({value:1}));assert.equal(await f.adapter.redemptionSent(),false);assert.equal(await f.endpoint.nonce(),0n);}
 await(await f.endpoint.configure(false,false,false)).wait();await(await f.adapter.sendRedemption({value:1})).wait();assert.equal(await f.adapter.redemptionSent(),true);
}));
test('only exact authenticated release acknowledgement retires the pass, with harmless retries',async()=>scenario(null,async f=>{
 await f.lock();const request=await f.pass.redemption();await(await f.adapter.sendRedemption({value:1})).wait();
 for(const args of [[wire(3,request,RECIPIENT),1],[wire(3,id('wrong'),RECIPIENT),2],[wire(3,request,id('wrong')),2],[wire(3,ZeroHash,RECIPIENT),2]])await rejected(()=>f.deliver(...args));
 assert.equal(await f.pass.state(),3n);const message=wire(3,request,RECIPIENT);const receipt=await(await f.deliver(message,2)).wait();assert.ok(receipt.gasUsed<200000n,'ack must fit Sui enforced BNB gas');
 assert.equal(await f.pass.state(),4n);assert.equal(await f.pass.canPlay(f.addresses[0]),false);await rejected(()=>f.pass.ownerOf(1));await rejected(()=>f.pass.tokenURI(1));
 await(await f.deliver(message,2)).wait();await(await f.deliver(message,2,id('retry'))).wait();await(await f.deliver(wire(1))).wait();await(await f.deliver(wire(1),1,id('late-reserve'))).wait();assert.equal(await f.pass.state(),4n);await rejected(()=>f.pass.buy());
}));

test('EVM wire messages match the shared Move golden fixtures byte for byte',async()=>{
 const fs=await import('node:fs');const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/message-v2.json',import.meta.url)));
 for(const kind of [1,2,3])assert.equal(wire(kind,kind===1?ZeroHash:fixture.request,kind===1?ZeroHash:fixture.recipient,fixture.route,fixture.backingNFT),fixture.messages[kind]);
});

test('safe-mint rejection rolls back payment and contract-buyer reentrancy cannot lock during purchase',async()=>scenario(null,async f=>{
 const buyer=await f.deploy('test/Fixtures.sol','FixtureBuyer');await(await buyer.setup(PEER,ROUTE)).wait();
 const pass=new Contract(await buyer.pass(),artifact('src/TreeSuitePass.sol','TreeSuitePass').abi,f.signers[0]);
 await(await f.endpoint.deliver(await buyer.adapter(),f.origin(),id('buyer-reserve'),wire(1))).wait();await(await f.token.mint(buyer.target,PRICE)).wait();
 const before=await f.token.balanceOf(TREASURY);await rejected(()=>buyer.buy(true));assert.equal(await f.token.balanceOf(TREASURY),before);assert.equal(await f.token.balanceOf(buyer.target),PRICE);assert.equal(await pass.state(),1n);
 await(await buyer.buy(false)).wait();assert.equal(await buyer.reentrySucceeded(),false);assert.equal(await pass.state(),2n);assert.equal(await pass.canPlay(buyer.target),true);assert.equal(await f.token.balanceOf(TREASURY)-before,PRICE);
}));
