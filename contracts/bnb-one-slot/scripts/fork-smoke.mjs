// LOCAL FORK ONLY. Remote RPC is read-only; no transaction, key, or signature reaches BNB.
import fs from 'node:fs';import assert from 'node:assert/strict';import ganache from 'ganache';
import {BrowserProvider,Contract,ContractFactory,id,ZeroHash,solidityPacked,parseEther} from 'ethers';
import {artifact} from './compile.mjs';
const EP='0x1a44076050125825900e736c501f859c50fE728c',TOKEN='0x55d398326f99059fF775485246999027B3197955',TREASURY='0xC440F06BBC7e58b0d055815f915447e4ae0E3720';
const BUYER='0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae',RECIPIENT='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
const NFT='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
// These are deliberately synthetic. A real deployment needs the published Sui package-based CallCap identity (NOT OApp object ID) and shared Vault ID.
const PEER=id('LOCAL_FIXTURE_SUI_PACKAGE'),ROUTE=id('LOCAL_FIXTURE_VAULT');
const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getBalance','eth_getStorageAt','eth_getTransactionCount','net_version','eth_getTransactionByHash','eth_getTransactionReceipt']);
let remoteWrites=0,rpcId=0;
const remote={request:async({method,params=[]})=>{
 if(process.env.FORK_DEBUG)console.error('RPC',method,JSON.stringify(params).slice(0,160));
 if(!allowed.has(method)){remoteWrites++;throw Error('Remote write blocked: '+method);}
 const url=method==='eth_getBlockByNumber'&&['earliest','0x0'].includes(params[0])?'https://bsc-dataseed.bnbchain.org':'https://bsc-rpc.publicnode.com';
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('Read-only RPC HTTP '+response.status);const result=await response.json();if(result.error)throw Error(JSON.stringify(result.error));return result.result;
}};
const rpc=ganache.provider({fork:{provider:remote,disableCache:true},chain:{chainId:56,hardfork:'shanghai'},wallet:{totalAccounts:1,unlockedAccounts:[BUYER,EP]},logging:{quiet:true}});
try {
 const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 const block=await provider.getBlock('latest');console.error('Fork snapshot',block.number);
 const buyer=await provider.getSigner(BUYER),endpoint=await provider.getSigner(EP),second=await provider.getSigner(0),secondAddress=await second.getAddress();
 const usdt=new Contract(TOKEN,['function balanceOf(address)view returns(uint256)','function decimals()view returns(uint8)','function approve(address,uint256)returns(bool)'],buyer);
 assert.equal(await usdt.decimals(),18n);assert.ok(await usdt.balanceOf(BUYER)>=parseEther('25'),'Buyer needs at least 25 USDT in fork snapshot');
 // Local gas funding only, preserves real USDT contract and balance state.
 for(const address of [BUYER,EP])await rpc.request({method:'evm_setAccountBalance',params:[address,'0x8ac7230489e80000']});
 const deploy=async(file,name,args=[])=>{const a=artifact(file,name);const c=await new ContractFactory(a.abi,'0x'+a.evm.bytecode.object,buyer).deploy(...args);await c.waitForDeployment();return c;};
 console.error('Real USDT balance verified');
 const adapter=await deploy('src/TreePassAdapter.sol','TreePassAdapter',[PEER,ROUTE]);
 console.error('Local adapter deployed',adapter.target);
 const pass=await deploy('src/TreeSuitePass.sol','TreeSuitePass',[adapter.target]);await(await adapter.bindPass(pass.target)).wait();
 const wire=(kind,req=ZeroHash,to=ZeroHash)=>solidityPacked(['uint8','uint8','bytes32','bytes32','bytes32','bytes32'],[2,kind,ROUTE,NFT,req,to]);
 const deliver=async(kind,req=ZeroHash,to=ZeroHash)=>{const message=wire(kind,req,to);return(await adapter.connect(endpoint).lzReceive({srcEid:30378,sender:PEER,nonce:kind===1?1:2},id(message),message,secondAddress,'0x',{gasLimit:200000})).wait();};
 console.error('Local pass bound');
 const reserve=await deliver(1);await(await pass.setPurchasesPaused(false)).wait();await(await usdt.approve(pass.target,parseEther('25'))).wait();
 const before=await usdt.balanceOf(TREASURY);const purchase=await(await pass.buy()).wait();assert.equal(await usdt.balanceOf(TREASURY)-before,parseEther('25'));
 await(await pass.transferFrom(BUYER,secondAddress,1)).wait();assert.equal(await pass.canPlay(BUYER),false);assert.equal(await pass.canPlay(secondAddress),true);
 await(await pass.connect(second).requestRedemption(RECIPIENT)).wait();assert.equal(await pass.canPlay(secondAddress),false);
 // Callback is locally impersonated; no real message send, DVN verification, or Sui release occurs.
 const ack=await deliver(3,await pass.redemption(),RECIPIENT);assert.equal(await pass.state(),4n);assert.equal(await pass.balanceOf(secondAddress),0n);assert.equal(remoteWrites,0);
 const proof={basis:'LOCAL_BNB_MAINNET_FORK_ONLY',checkedAt:new Date().toISOString(),blockNumber:block.number,remoteWrites,realUsdtContract:true,realUsdtDecimals:18,treasuryDelta:'25000000000000000000',transferAccessFollowsOwner:true,redemptionLocksAccess:true,finalState:'Retired',gas:{reserveCallback:String(reserve.gasUsed),purchase:String(purchase.gasUsed),ackCallback:String(ack.gasUsed)},limitations:['Synthetic Sui package peer and vault IDs','Endpoint impersonated locally','Gas-funded locally, real USDT snapshot retained','No LayerZero send, DVN verification, Sui release, mainnet transaction or signature','Contract canPlay tested; live arcade integration is not implemented']};
 const dest=process.argv[2];if(dest)fs.writeFileSync(dest,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
}finally{await rpc.disconnect();}
