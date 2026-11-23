// LOCAL FORK ONLY. Remote transport permits reads; no remote signer or submission.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import ganache from 'ganache';
import {BrowserProvider,Contract,ContractFactory,getCreateAddress,keccak256,ZeroAddress} from 'ethers';
import {artifact,input} from './compile.mjs';import {verifyWalletIntent} from './wallet-preflight.mjs';
import selected from '../../../docs/multichain/generation-milestone/selected-wallets.json' with {type:'json'};
import saved from '../../../docs/multichain/generation-milestone/slot-created/receipt.json' with {type:'json'};
import {verifySlotReceipt} from '../../nftree-generation/scripts/slot-handoff.mjs';
import {newClient,readCandidate} from '../../nftree-generation/scripts/readiness.mjs';
export const EP='0x1a44076050125825900e736c501f859c50fE728c',TOKEN='0x55d398326f99059fF775485246999027B3197955';
export const ADMIN=selected.bnb.deployer,PEER=saved.packageId,ROUTE=saved.vaultId;
export const MAX_TOTAL_FEE_WEI=1000000000000000n;
const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getBalance','eth_getStorageAt','eth_getTransactionCount','net_version','eth_getTransactionByHash','eth_getTransactionReceipt','eth_gasPrice']);
export function readOnlyRemote(fetcher=globalThis.fetch){let id=0;return {request:async({method,params=[]})=>{
 assert(allowed.has(method),'Remote method forbidden: '+method);
 const url=method==='eth_getBlockByNumber'&&['earliest','0x0'].includes(params[0])?'https://bsc-dataseed.bnbchain.org':'https://bsc-rpc.publicnode.com';
 const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(25000)});
 assert(response.ok,'Read-only BNB RPC HTTP '+response.status);const result=await response.json();assert(!result.error,JSON.stringify(result.error));return result.result;
 }};}
export function verifyRuntime(a,code){
 const actual=Buffer.from(code.slice(2),'hex'),expected=Buffer.from(a.evm.deployedBytecode.object,'hex');assert.equal(actual.length,expected.length);
 for(const refs of Object.values(a.evm.deployedBytecode.immutableReferences))for(const {start,length} of refs){actual.fill(0,start,start+length);expected.fill(0,start,start+length);}
 assert(actual.equals(expected),'Runtime differs outside immutable references');return keccak256(code);
}
const wireJSON=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v));
export async function verifyDeploymentPacket(p,now=Date.now()){
 assert.equal(p.schema,'tree-bnb-generation-deployment-review-v1');assert.equal(p.authorized,false);assert.equal(p.submitted,false);
 const age=now-Date.parse(p.preparedAt);assert(Number.isFinite(age)&&age>=0&&age<=120000,'Refresh expired deployment review');
 verifyWalletIntent({address:p.admin,chainId:p.chainId,treasury:p.treasury});assert.equal(p.suiPeer,PEER);assert.equal(p.route,ROUTE);
 assert(Number.isSafeInteger(p.nonce)&&p.nonce>=0);assert.equal(p.steps.length,3);
 const adapterAddress=getCreateAddress({from:ADMIN,nonce:p.nonce}),passAddress=getCreateAddress({from:ADMIN,nonce:p.nonce+1});
 assert.deepEqual(p.predictedAddresses,{adapter:adapterAddress,pass:passAddress});
 const a=artifact('src/TreePassAdapter.sol','TreePassAdapter'),b=artifact('src/TreeSuitePass.sol','TreeSuitePass');
 const expected=[await new ContractFactory(a.abi,'0x'+a.evm.bytecode.object).getDeployTransaction(PEER,ROUTE),await new ContractFactory(b.abi,'0x'+b.evm.bytecode.object).getDeployTransaction(adapterAddress),{to:adapterAddress,data:new Contract(adapterAddress,a.abi).interface.encodeFunctionData('bindPass',[passAddress])}];
 const caps=[3000000n,3000000n,100000n];const price=BigInt(p.gasPriceWei);assert(price>0n);let cost=0n;
 for(let i=0;i<3;i++){const tx=p.steps[i].unsigned;assert.equal(tx.chainId,56);assert.equal(tx.from,ADMIN);assert.equal(tx.to,expected[i].to??null);assert.equal(tx.data,expected[i].data);assert.equal(tx.value,'0');assert.equal(tx.nonce,p.nonce+i);assert.equal(tx.gasPrice,p.gasPriceWei);const gas=BigInt(tx.gasLimit);assert(gas>0n&&gas<=caps[i]);assert.equal(p.steps[i].initOrCallDataKeccak256,keccak256(tx.data));cost+=gas*price;}
 assert(cost<=MAX_TOTAL_FEE_WEI,'Total fee exceeds proposed 0.001 BNB ceiling');assert.equal(p.maximumCostWeiAtQuotedGasPrice,String(cost));return {adapterAddress,passAddress,maximumCostWei:String(cost)};
}
export async function prepareDeployment(){
 verifyWalletIntent({address:ADMIN,chainId:56,treasury:selected.bnb.treasury});
 const suiClient=newClient(),sui=await verifySlotReceipt(saved.digest,suiClient),candidate=await readCandidate(suiClient);
 assert.equal(sui.vaultId,ROUTE);assert.equal(sui.state.data.vault.asMoveObject.contents.json.cap.cap_type.pos0,PEER);
 const remote=readOnlyRemote();assert.equal(BigInt(await remote.request({method:'eth_chainId'})),56n);
 const blockNumber=Number(BigInt(await remote.request({method:'eth_blockNumber'}))),tag='0x'+blockNumber.toString(16);
 const read=(method,params)=>remote.request({method,params});
 const block=await read('eth_getBlockByNumber',[tag,false]);
 const nonce=Number(BigInt(await read('eth_getTransactionCount',[ADMIN,tag]))),pendingNonce=Number(BigInt(await read('eth_getTransactionCount',[ADMIN,'pending'])));
 assert.equal(nonce,pendingNonce,'Pending admin transactions: wait and regenerate');
 assert.equal(await read('eth_getCode',[ADMIN,tag]),'0x','Admin must deploy directly from the selected EOA');
 const balance=BigInt(await read('eth_getBalance',[ADMIN,tag])),gasPrice=BigInt(await read('eth_gasPrice',[]));assert(gasPrice>0n);
 const endpointCode=await read('eth_getCode',[EP,tag]),tokenCode=await read('eth_getCode',[TOKEN,tag]);assert(endpointCode!=='0x'&&tokenCode!=='0x');
 const adapterAddress=getCreateAddress({from:ADMIN,nonce}),passAddress=getCreateAddress({from:ADMIN,nonce:nonce+1});
 for(const address of [adapterAddress,passAddress])assert.equal(await read('eth_getCode',[address,tag]),'0x');
 const rpc=ganache.provider({fork:{provider:remote,blockNumber,disableCache:true},chain:{chainId:56,hardfork:'shanghai'},wallet:{totalAccounts:1,unlockedAccounts:[ADMIN]},logging:{quiet:true}});
 try{
 const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 const signer=await provider.getSigner(ADMIN),other=await provider.getSigner(0);
 // Local-only balance override. Report real funding separately; no real wallet key is used.
 await rpc.request({method:'evm_setAccountBalance',params:[ADMIN,'0x8ac7230489e80000']});
 const endpoint=new Contract(EP,['function eid()view returns(uint32)','function delegates(address)view returns(address)'],provider);
 const token=new Contract(TOKEN,['function decimals()view returns(uint8)'],provider);
 assert.equal(await endpoint.eid(),30102n);assert.equal(await token.decimals(),18n);
 const adapterArtifact=artifact('src/TreePassAdapter.sol','TreePassAdapter'),passArtifact=artifact('src/TreeSuitePass.sol','TreeSuitePass');
 const steps=[];
 async function execute(label,tx,stepNonce){
  const estimate=await provider.estimateGas({...tx,from:ADMIN});const gasLimit=(estimate*125n+99n)/100n;
  const unsigned={chainId:56,from:ADMIN,to:tx.to??null,data:tx.data,value:'0',nonce:stepNonce,gasLimit:String(gasLimit),gasPrice:String(gasPrice)};
  const response=await signer.sendTransaction({...tx,nonce:stepNonce,gasLimit,gasPrice,value:0});const receipt=await response.wait();assert.equal(receipt.status,1);
  steps.push({label,unsigned,initOrCallDataKeccak256:keccak256(tx.data),estimatedGas:String(estimate),localGasUsed:String(receipt.gasUsed),localTransactionHash:receipt.hash});
 }
 await execute('Deploy new adapter',await new ContractFactory(adapterArtifact.abi,'0x'+adapterArtifact.evm.bytecode.object).getDeployTransaction(PEER,ROUTE),nonce);
 const adapter=new Contract(adapterAddress,adapterArtifact.abi,signer);
 assert.equal(await adapter.endpoint(),EP);assert.equal(await adapter.SUI_EID(),30378n);assert.equal(await adapter.backingNFT(),candidate.nft.address);
 assert.equal(await adapter.suiPeer(),PEER);assert.equal(await adapter.route(),ROUTE);assert.equal(await adapter.binder(),ADMIN);assert.equal(await endpoint.delegates(adapterAddress),ADMIN);assert.equal(await adapter.pass(),ZeroAddress);
 await execute('Deploy new pass',await new ContractFactory(passArtifact.abi,'0x'+passArtifact.evm.bytecode.object).getDeployTransaction(adapterAddress),nonce+1);
 const pass=new Contract(passAddress,passArtifact.abi,signer);
 await assert.rejects(adapter.connect(other).bindPass.estimateGas(passAddress));
 await execute('Bind new pass once',await adapter.bindPass.populateTransaction(passAddress),nonce+2);
 await assert.rejects(adapter.bindPass.estimateGas(passAddress));await assert.rejects(pass.connect(other).setPurchasesPaused.estimateGas(false));await assert.rejects(pass.buy.estimateGas());
 assert.equal(await adapter.pass(),passAddress);assert.equal(await pass.adapter(),adapterAddress);assert.equal(await pass.controller(),ADMIN);assert.equal(await pass.initialBuyer(),ADMIN);assert.equal(await pass.treasury(),selected.bnb.treasury);assert.equal(await pass.currency(),TOKEN);assert.equal(await pass.route(),ROUTE);assert.equal(await pass.currencyCodeHash(),keccak256(tokenCode));
 assert.equal(await pass.purchasesPaused(),true);assert.equal(await pass.generation(),0n);assert.equal(await pass.state(),0n);assert.equal(await pass.canPlay(ADMIN),false);assert.equal(await pass.balanceOf(ADMIN),0n);
 const runtimes={adapter:verifyRuntime(adapterArtifact,await provider.getCode(adapterAddress)),pass:verifyRuntime(passArtifact,await provider.getCode(passAddress))};
 const maximumCost=steps.reduce((sum,s)=>sum+BigInt(s.unsigned.gasLimit)*gasPrice,0n);
 const afterNonce=Number(BigInt(await read('eth_getTransactionCount',[ADMIN,'pending'])));assert.equal(afterNonce,nonce,'Admin nonce changed: discard predicted addresses');
 const afterSui=await verifySlotReceipt(saved.digest,suiClient);assert.deepEqual(afterSui.state.data.vault,sui.state.data.vault);
 return wireJSON({schema:'tree-bnb-generation-deployment-review-v1',preparedAt:new Date().toISOString(),authorized:false,submitted:false,basis:'LOCAL_BNB_MAINNET_FORK',chainId:56,admin:ADMIN,treasury:selected.bnb.treasury,suiPeer:PEER,route:ROUTE,sui,candidate,block:{number:blockNumber,hash:block.hash,timestamp:block.timestamp},nonce,predictedAddresses:{adapter:adapterAddress,pass:passAddress},remoteCodeHashes:{endpoint:keccak256(endpointCode),usdt:keccak256(tokenCode)},runtimeHashes:runtimes,gasPriceWei:String(gasPrice),maximumCostWeiAtQuotedGasPrice:String(maximumCost),realAdminBalanceWei:String(balance),fundingShortfallWei:String(maximumCost>balance?maximumCost-balance:0n),steps,sourceHashes:Object.fromEntries(Object.entries(input.sources).filter(([p])=>p.startsWith('src/')).map(([p,v])=>[p,createHash('sha256').update(v.content).digest('hex')])),postconditions:{passBound:true,generation:0,state:'Unconfirmed',purchasesPaused:true,canPlay:false,unauthorizedBindingRejected:true,duplicateBindingRejected:true,unauthorizedUnpauseRejected:true,purchaseRejected:true},limitations:['All deployments and balance funding occurred only in Ganache; no real signatures or remote writes.','Predicted addresses depend on the admin nonce and exact deployment order; refresh before signing.','Gas prices and state can change; this is not a durable executable wallet authorization.','No Sui peer binding, LayerZero security configuration, message delivery, deposit, sale or gameplay activation is included.']});
 }finally{await rpc.disconnect();}
}
if(process.argv[1]?.endsWith('/deployment-review.mjs')){const dest=process.argv[2];assert(dest&&!fs.existsSync(dest),'Supply a new output path');const report=await prepareDeployment();await verifyDeploymentPacket(report);fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({block:report.block,addresses:report.predictedAddresses,gas:report.steps.map(s=>({label:s.label,gas:s.localGasUsed})),gasPriceWei:report.gasPriceWei,maxCostWei:report.maximumCostWeiAtQuotedGasPrice,realBalanceWei:report.realAdminBalanceWei,shortfallWei:report.fundingShortfallWei,submitted:false}));}
