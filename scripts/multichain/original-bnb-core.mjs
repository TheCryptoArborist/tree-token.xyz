import {encodeDeployData,encodeFunctionData,getContractAddress,keccak256,toHex} from 'viem';
import reviewed from '../../docs/multichain/bnb-one-slot/reviewed-artifacts.json' with {type:'json'};
import bindings from '../../docs/multichain/original-trial/slot-bindings.json' with {type:'json'};
import unsigned from '../../docs/multichain/original-trial/bnb-adapter-unsigned.json' with {type:'json'};
import {newClient,readState,verifySlot} from './original-slot-core.mjs';
import {verifyNetwork,verifyPublication} from './original-publish-core.mjs';
import {hashHex,quantity,walletRead,identity,saveState} from '../../play/multichaintest/setup/bnb/core.js';
import {createReadProvider} from '../../play/multichaintest/setup/bnb/configure/core.js';
export {saveState,newClient,createReadProvider};
const a=reviewed.contracts.TreePassAdapter;
export const C=Object.freeze({from:unsigned.from,chainId:'0x38',endpoint:unsigned.endpoint,endpointSha256:'c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039',peer:bindings.packagePeerIdentity,route:bindings.vault,nft:bindings.nft,slotDigest:bindings.slotDigest,publicationDigest:bindings.publicationDigest,key:'nftree-original-bnb-adapter-v2-45bf0849',maxAge:120000});
export const DATA=encodeDeployData({abi:a.abi,bytecode:a.creationBytecode,args:[C.peer,C.route]});
const check=(v,m)=>{if(!v)throw Error(m);},same=(x,y)=>typeof x==='string'&&typeof y==='string'&&x.toLowerCase()===y.toLowerCase(),hashPattern=/^0x[0-9a-f]{64}$/i;
export function expectedRuntime(){let hex=a.runtimeTemplate.slice(2);const values={'61':C.peer,'63':C.route,'65':C.from};check(Object.keys(a.immutableReferences).length===3,'Reviewed immutable layout changed.');for(const [id,refs]of Object.entries(a.immutableReferences)){check(values[id],'Unknown immutable.');const word=values[id].slice(2).toLowerCase().padStart(64,'0');for(const ref of refs){check(ref.length===32,'Wrong immutable width.');const start=ref.start*2;check(hex.slice(start,start+64)==='0'.repeat(64),'Runtime template is not unbound.');hex=hex.slice(0,start)+word+hex.slice(start+64);}}return '0x'+hex;}
export async function readSui(client=newClient()){
 verifyNetwork(await client.core.getChainIdentifier({signal:AbortSignal.timeout(30000)}));
 const pub=await client.core.getTransaction({digest:C.publicationDigest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(pub.Transaction?.digest===C.publicationDigest,'Wrong publication receipt.');const p=verifyPublication(pub);check(p.packageId===C.peer&&p.registryId===bindings.registry&&p.oappId===bindings.oapp,'Published source bindings changed.');
 const receipt=await client.core.getTransaction({digest:C.slotDigest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(receipt.Transaction?.digest===C.slotDigest,'Wrong slot receipt.');const proof=verifySlot(receipt);check(proof.vaultId===C.route,'Actual Vault differs from the reviewed route.');
 return readState(client,{vaultId:C.route});
}
const abi=(name,inputs=[],outputs=[])=>[{type:'function',name,inputs,outputs,stateMutability:'view'}];
async function call(provider,to,name,inputs=[],args=[]){return walletRead(provider,{method:'eth_call',params:[{to,data:encodeFunctionData({abi:abi(name,inputs),functionName:name,args})},'latest']});}
async function nonce(provider){const values=[];for(const tag of ['latest','pending'])values.push(quantity(await walletRead(provider,{method:'eth_getTransactionCount',params:[C.from,tag]}),'wallet nonce'));check(values[0]===values[1],'The BNB wallet has a pending transaction. Check wallet activity first.');return values[0];}
export async function preflight(provider,{readSource=readSui,now=Date.now}={}){
 await identity(provider,C);await readSource();check(await hashHex(DATA)===unsigned.dataSha256,'Reviewed creation code changed.');
 const n=await nonce(provider),predictedAddress=getContractAddress({from:C.from,nonce:n});check(await walletRead(provider,{method:'eth_getCode',params:[predictedAddress,'latest']})==='0x','Predicted address already has code. Check the deployment receipt.');
 check(await hashHex(await walletRead(provider,{method:'eth_getCode',params:[C.endpoint,'latest']}))===C.endpointSha256,'LayerZero endpoint code changed.');check(quantity(await call(provider,C.endpoint,'eid'),'LayerZero endpoint ID')===30102n,'Wrong LayerZero endpoint ID.');
 const intent={from:C.from,data:DATA,value:'0x0'};check(same(await walletRead(provider,{method:'eth_call',params:[intent,'latest']}),expectedRuntime()),'Adapter simulation runtime or immutable bindings differ.');
 const gas=quantity(await walletRead(provider,{method:'eth_estimateGas',params:[intent,'latest']}),'deployment gas'),price=quantity(await walletRead(provider,{method:'eth_gasPrice'}),'gas price');check(gas>0n&&gas<=3000000n&&price>0n,'Unexpected deployment gas estimate.');const gasLimit=(gas*120n+99n)/100n,fee=gasLimit*price;check(fee<=10000000000000000n,'Estimated gas allowance exceeds 0.01 BNB.');check(quantity(await walletRead(provider,{method:'eth_getBalance',params:[C.from,'latest']}),'BNB balance')>=fee,'The designated wallet needs more BNB for deployment gas.');
 await identity(provider,C);check(await nonce(provider)===n,'Wallet nonce changed during checks. Refresh and review.');return {nonce:String(n),predictedAddress,gas:String(gas),gasLimit:toHex(gasLimit),estimatedFeeWei:String(gas*price),gasLimitFeeWei:String(fee),quotedAt:now()};
}
export function loadState(storage){const text=storage.getItem(C.key);if(text===null)return null;const s=JSON.parse(text);check(s&&['wallet_request','submitted','verified'].includes(s.status)&&/^(0|[1-9][0-9]*)$/.test(s.nonce)&&/^0x[0-9a-f]{40}$/i.test(s.predictedAddress),'Stored deployment state needs review.');check(s.status==='wallet_request'||hashPattern.test(s.hash),'Stored transaction hash is invalid.');return s;}
export async function requestDeployment({provider,storage,locks,reviewed,reviewedQuote,isCurrent,prepare=preflight,onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave for deployment coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this adapter.');check(!loadState(storage),'A deployment is pending or recorded. Check its receipt first.');const quote=reviewedQuote();check(reviewed()&&quote&&now()>=quote.quotedAt&&now()-quote.quotedAt<=C.maxAge,'Simulate and review a fresh quote first.');const ready=await prepare(provider);check(isCurrent()&&reviewed(),'Wallet or review changed.');check(!loadState(storage),'Another deployment was recorded.');
 if(['nonce','predictedAddress','gasLimitFeeWei','gas'].some(k=>ready[k]!==quote[k])||now()-quote.quotedAt>C.maxAge){onQuote(ready);throw Error('Nonce or gas estimate changed. Review the refreshed quote.');}
 await identity(provider,C);check(String(await nonce(provider))===ready.nonce,'Wallet nonce changed before signing.');check(isCurrent()&&reviewed(),'Wallet or review changed.');
 const pending={status:'wallet_request',nonce:ready.nonce,predictedAddress:ready.predictedAddress,requestedAt:new Date(now()).toISOString()};saveState(storage,C.key,pending);let hash;
 try{hash=await provider.request({method:'eth_sendTransaction',params:[{from:C.from,chainId:C.chainId,value:'0x0',nonce:toHex(BigInt(ready.nonce)),data:DATA,gas:ready.gasLimit}]});}catch(e){if(e?.code===4001)storage.removeItem(C.key);throw e;}
 check(hashPattern.test(hash),'No valid hash returned. Check wallet activity before retrying.');const submitted={...pending,status:'submitted',hash};saveState(storage,C.key,submitted);return submitted;
 });
}
export async function verifyReceipt(provider,hash){
 check(hashPattern.test(hash),'Enter the BNB adapter transaction hash.');await identity(provider,C);const receipt=await walletRead(provider,{method:'eth_getTransactionReceipt',params:[hash]});if(!receipt)return {status:'pending',hash};
 check(same(receipt.transactionHash,hash)&&same(receipt.from,C.from)&&receipt.to===null&&quantity(receipt.status)===1n,'Wrong or failed creation receipt.');
 const tx=await walletRead(provider,{method:'eth_getTransactionByHash',params:[hash]});check(tx&&same(tx.hash,hash)&&same(tx.from,C.from)&&tx.to===null&&quantity(tx.chainId)===56n&&quantity(tx.value)===0n&&same(tx.input,DATA),'Transaction differs from the reviewed adapter creation.');const n=quantity(tx.nonce),predictedAddress=getContractAddress({from:C.from,nonce:n});check(same(receipt.contractAddress,predictedAddress),'Wrong created address.');
 const words='0x'+predictedAddress.slice(2).toLowerCase().padStart(64,'0')+C.from.slice(2).padStart(64,'0');check(receipt.logs?.length===1&&same(receipt.logs[0].address,C.endpoint)&&receipt.logs[0].removed!==true&&receipt.logs[0].topics?.length===1&&same(receipt.logs[0].topics[0],keccak256(toHex('DelegateSet(address,address)')))&&same(receipt.logs[0].data,words),'Unexpected deployment events.');
 check(same(await walletRead(provider,{method:'eth_getCode',params:[predictedAddress,'latest']}),expectedRuntime()),'Deployed runtime or bindings differ.');
 for(const [name,expected]of [['binder',BigInt(C.from)],['suiPeer',BigInt(C.peer)],['route',BigInt(C.route)],['pass',0n],['redemptionGas',30000000n],['redemptionSent',0n]])check(quantity(await call(provider,predictedAddress,name))===expected,'Adapter '+name+' differs.');
 check(quantity(await call(provider,C.endpoint,'delegates',[{name:'sender',type:'address'}],[predictedAddress]))===BigInt(C.from),'Endpoint delegate differs.');
 return {status:'verified',hash,nonce:String(n),predictedAddress,contractAddress:predictedAddress,blockNumber:receipt.blockNumber};
}
export async function recoverReceipt({provider,hash,storage,locks,verify=verifyReceipt}){check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{check(lock,'Another tab is handling this adapter.');const old=loadState(storage);check(!old?.hash||same(old.hash,hash),'A different receipt is already recorded.');const result=await verify(provider,hash);if(result.status==='pending')return result;if(old)check(old.nonce===result.nonce&&same(old.predictedAddress,result.predictedAddress),'Receipt does not match the recorded request.');saveState(storage,C.key,result);return result;});}
