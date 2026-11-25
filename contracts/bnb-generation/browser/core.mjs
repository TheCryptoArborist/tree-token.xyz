import {ContractFactory,Interface,getCreateAddress,getAddress,keccak256,ZeroAddress} from 'ethers';
import P from './pinned-build.json' with {type:'json'};
export {P};export const MAX=BigInt(P.maxTotalFeeWei),KEY='tree-bnb-generation-deployment-v1';
export const check=(ok,message)=>{if(!ok)throw Error(message);};
export const hex=n=>'0x'+BigInt(n).toString(16);
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export const LABELS=['Deploy BNB adapter','Deploy BNB pass','Bind the new pass'];
const ai=new Interface(P.adapter.abi),pi=new Interface(P.pass.abi);
export function locationGuard(location){check(location.origin==='https://tree-token.xyz'&&location.pathname==='/play/bnb-generation/','Signing is available only at tree-token.xyz/play/bnb-generation/.');}
export function blankSession(){return {schema:1,baseNonce:P.baseNonce,hashes:[],requests:[],attempt:null};}
export function validateSession(s){check(s?.schema===1&&s.baseNonce===P.baseNonce,'Unrecognized saved sequence. Return to Codex.');check(Array.isArray(s.hashes)&&s.hashes.length<=3&&Array.isArray(s.requests),'Invalid saved receipt state.');for(const h of s.hashes)check(/^0x[0-9a-f]{64}$/i.test(h),'Invalid transaction hash.');check(s.requests.length===s.hashes.length,'Missing saved fee review.');if(s.attempt)check(s.attempt.index===s.hashes.length&&s.attempt.request,'Invalid pending attempt.');}
export async function expectedTx(i){
 check(i>=0&&i<3,'Invalid step');
 if(i===0)return new ContractFactory(P.adapter.abi,'0x'+P.adapter.evm.bytecode.object).getDeployTransaction(P.peer,P.route);
 if(i===1)return new ContractFactory(P.pass.abi,'0x'+P.pass.evm.bytecode.object).getDeployTransaction(P.addresses.adapter);
 return {to:P.addresses.adapter,data:ai.encodeFunctionData('bindPass',[P.addresses.pass])};
}
export async function verifyRequest(tx,i){
 const expected=await expectedTx(i);check(same(tx.from,P.admin),'Wrong deployment account.');check(BigInt(tx.chainId)===56n,'BNB mainnet required.');check(BigInt(tx.nonce)===BigInt(P.baseNonce+i),'Nonce changed. Return to Codex to refresh the sequence.');check(BigInt(tx.value??0)===0n,'Unexpected value transfer.');check(same(tx.to??'',expected.to??''),'Unexpected destination.');check(tx.data===expected.data,'Deployment bytes changed.');check(BigInt(tx.gas)===BigInt(P.gasLimits[i]),'Gas limit changed.');check(BigInt(tx.gasPrice)>0n&&BigInt(tx.gas)*BigInt(tx.gasPrice)<=MAX,'Fee limit exceeded.');
}
export function verifyRuntime(artifact,code){
 const actual=code.slice(2).toLowerCase().split(''),expected=artifact.evm.deployedBytecode.object.toLowerCase().split('');check(actual.length===expected.length,'Deployed code size differs.');
 for(const refs of Object.values(artifact.evm.deployedBytecode.immutableReferences))for(const {start,length} of refs)for(let i=start*2;i<(start+length)*2;i++){actual[i]='0';expected[i]='0';}
 check(actual.join('')===expected.join(''),'Deployed runtime differs from the reviewed build.');return keccak256(code);
}
export async function verifyReceipt(tx,r,i,request){
 await verifyRequest(request,i);check(tx&&r,'Transaction not yet indexed. Check receipts again; do not resend.');
 check(BigInt(r.status)===1n,'Transaction failed on-chain. Stop and return its receipt to Codex.');check(same(tx.hash,r.transactionHash),'Receipt hash mismatch.');
 check(same(tx.from,P.admin)&&BigInt(tx.nonce)===BigInt(P.baseNonce+i),'Unexpected sender or nonce.');const chain=tx.chainId!=null?BigInt(tx.chainId):(BigInt(tx.v??0)>=35n?(BigInt(tx.v)-35n)/2n:0n);check(chain===56n,'Receipt is not BNB mainnet.');check(same(tx.to??'',request.to??'')&&(tx.input??tx.data)===request.data&&BigInt(tx.value)===0n,'Wallet submitted changed transaction content.');
 check(BigInt(tx.gas)<=BigInt(request.gas),'Wallet increased the reviewed gas limit. Stop and return to Codex.');
 const feeCap=BigInt(tx.maxFeePerGas??tx.gasPrice);check(feeCap<=BigInt(request.gasPrice),'Wallet increased the reviewed fee price. Stop and return to Codex.');
 if(i<2)check(same(r.contractAddress,i===0?P.addresses.adapter:P.addresses.pass),'Deployment address differs.');else check(!r.contractAddress,'Unexpected contract creation.');
 const price=BigInt(r.effectiveGasPrice??tx.gasPrice),used=BigInt(r.gasUsed);check(used<=BigInt(tx.gas)&&price<=feeCap,'Invalid receipt fee.');return used*price;
}
export function verifySuiReceipt(r){
 check(r.digest===P.slotDigest&&r.packageId===P.peer&&r.registryId===P.registry&&r.vaultId===P.route&&r.empty===true&&r.bound===false,'Sui custody state changed. Return to Codex.');
 const d=r.state?.data,v=d?.vault?.asMoveObject?.contents?.json;
 check(d?.chainIdentifier==='4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S'&&v?.nft===null&&v.bound===false&&v.generation==='0'&&v.phase===0&&d.registry.asMoveObject.contents.json.slot===P.route,'Sui vault is no longer the reviewed empty slot.');
}
const allowed=new Set(['eth_chainId','eth_getTransactionCount','eth_getCode','eth_getBalance','eth_gasPrice','eth_getTransactionByHash','eth_getTransactionReceipt','eth_blockNumber','eth_getBlockByNumber','eth_estimateGas','eth_call']);
export function reader(provider){return async(method,params=[])=>{check(allowed.has(method),'Read operation not allowed.');return provider.request({method,params});};}
export async function inspect(provider,s){
 validateSession(s);const rpc=reader(provider);check(BigInt(await rpc('eth_chainId'))===56n,'Switch MetaMask to BNB Smart Chain mainnet.');
 check(await rpc('eth_getCode',[P.admin,'latest'])==='0x','Selected admin is not the reviewed direct-deployment account.');
 const EP='0x1a44076050125825900e736c501f859c50fE728c',USDT='0x55d398326f99059fF775485246999027B3197955';
 for(const [address,key] of [[EP,'endpoint'],[USDT,'usdt']])check(keccak256(await rpc('eth_getCode',[address,'latest']))===P.remoteCodeHashes[key],'Endpoint or currency code changed.');
 let spent=0n;const receipts=[];
 for(let i=0;i<s.hashes.length;i++){const hash=s.hashes[i];const tx=await rpc('eth_getTransactionByHash',[hash]),r=await rpc('eth_getTransactionReceipt',[hash]);spent+=await verifyReceipt(tx,r,i,s.requests[i]);receipts.push(r);}
 check(spent<=MAX,'Actual fees exceeded approval. Stop.');
 const codes=await Promise.all([P.addresses.adapter,P.addresses.pass].map(a=>rpc('eth_getCode',[a,'latest'])));
 const call=async(address,abi,name,args=[])=>abi.decodeFunctionResult(name,await rpc('eth_call',[{to:address,data:abi.encodeFunctionData(name,args)},'latest']))[0];
 for(let i=0;i<2;i++)if(s.hashes.length>i)verifyRuntime(i===0?P.adapter:P.pass,codes[i]);else check(codes[i]==='0x','A predicted contract already exists. Import its receipt; do not deploy again.');
 if(s.hashes.length){
  for(const [name,value] of [['suiPeer',P.peer],['route',P.route],['binder',P.admin],['endpoint',EP],['backingNFT','0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba']])check(same(await call(P.addresses.adapter,ai,name),value),'Adapter '+name+' differs.');
  check(same(await call(P.addresses.adapter,ai,'pass'),s.hashes.length===3?P.addresses.pass:ZeroAddress),'Adapter binding differs.');
  const ei=new Interface(['function delegates(address)view returns(address)']);check(same(await call(EP,ei,'delegates',[P.addresses.adapter]),P.admin),'Endpoint delegate differs.');
 }
 if(s.hashes.length>1){
  for(const [name,value] of [['adapter',P.addresses.adapter],['controller',P.admin],['initialBuyer',P.admin],['treasury',P.treasury],['currency',USDT],['route',P.route],['currencyCodeHash',P.remoteCodeHashes.usdt]])check(same(await call(P.addresses.pass,pi,name),value),'Pass '+name+' differs.');
  check(await call(P.addresses.pass,pi,'purchasesPaused')===true&&await call(P.addresses.pass,pi,'state')===0n&&await call(P.addresses.pass,pi,'generation')===0n&&await call(P.addresses.pass,pi,'canPlay',[P.admin])===false,'Pass must remain paused, unconfirmed and non-playable.');
 }
 return {spent,receipts,complete:s.hashes.length===3};
}
export async function prepare(provider,s){
 check(!s.attempt,'A wallet request is unresolved. Recover its hash or return to Codex; do not resend.');const status=await inspect(provider,s);if(status.complete)return {...status,transaction:null};
 const rpc=reader(provider),i=s.hashes.length,nonce=BigInt(P.baseNonce+i);
 for(const tag of ['latest','pending'])check(BigInt(await rpc('eth_getTransactionCount',[P.admin,tag]))===nonce,'Admin nonce changed or a transaction is pending. Stop and return to Codex.');
 const gasPrice=BigInt(await rpc('eth_gasPrice')),remaining=P.gasLimits.slice(i).reduce((a,b)=>a+BigInt(b),0n)*gasPrice;check(gasPrice>0n&&status.spent+remaining<=MAX,'Current fees exceed the 0.001 BNB total cap.');
 check(BigInt(await rpc('eth_getBalance',[P.admin,'latest']))>=remaining,'Insufficient BNB for the remaining reviewed limits.');
 const expected=await expectedTx(i),transaction={from:P.admin,chainId:'0x38',nonce:hex(nonce),value:'0x0',data:expected.data,gas:hex(P.gasLimits[i]),gasPrice:hex(gasPrice),...(expected.to?{to:expected.to}:{})};
 await verifyRequest(transaction,i);check(BigInt(await rpc('eth_estimateGas',[transaction]))<=BigInt(transaction.gas),'Gas estimate exceeds the reviewed limit. Return to Codex.');
 return {...status,transaction,index:i,remainingMaximumFee:remaining};
}
export function verifyPins(){check(getCreateAddress({from:P.admin,nonce:P.baseNonce})===P.addresses.adapter&&getCreateAddress({from:P.admin,nonce:P.baseNonce+1})===P.addresses.pass,'Invalid pinned addresses.');getAddress(P.admin);}
verifyPins();
