import {Transaction} from '@mysten/sui/transactions';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {fromBase58,toHex} from '@mysten/sui/utils';
import build from '../../docs/multichain/one-slot-vault/publication-bytecode.json' with {type:'json'};
export const C=Object.freeze({sender:'0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',nft:'0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba',nftType:'0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT',oappPackage:'0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24',graphql:'https://graphql.mainnet.sui.io/graphql',chain:'35834a8a',key:'nftree-original-publish-v2-a09c67e6',maxGasMist:200000000n,maxAge:120000,moduleHashes:Object.freeze(['a9a4f4f7afb74b2e4fdf3b5914caa566730e843766f6ca17829484136a78d442','a09c67e6c1fa6c4ecf0aaa64483f498cae2eb43380537b6697051e152087d939'])});
const check=(v,m)=>{if(!v)throw Error(m);};
const equal=(a,b,m)=>check(JSON.stringify(a)===JSON.stringify(b),m);
const digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
export const newClient=fetcher=>new SuiGraphQLClient({network:'mainnet',url:C.graphql,...(fetcher?{fetch:fetcher}:{})});
export function publication(address){check(address?.toLowerCase()===C.sender,'Select your Sui dev wallet ending 45c4.');const tx=new Transaction();tx.setSender(C.sender);const [cap]=tx.publish({modules:build.modules,dependencies:build.dependencies});tx.transferObjects([cap],tx.pure.address(C.sender));return tx;}
export async function verifyBuild(){check(build.modules.length===2,'Unexpected module count.');for(let i=0;i<2;i++){const bytes=Uint8Array.from(atob(build.modules[i]),x=>x.charCodeAt(0));const hash=toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));check(hash===C.moduleHashes[i],'Publication bytecode differs from the reviewed build.');}}
export function verifyNetwork(value){const id=value?.chainIdentifier;check(typeof id==='string','Missing chain identifier.');check((/^[a-f0-9]{8}$/.test(id)?id:toHex(fromBase58(id)).slice(0,8))===C.chain,'This is not Sui mainnet.');}
export function verifyNft(state){check(state?.nft?.address===C.nft&&state.nft.owner?.address?.address===C.sender&&state.nft.asMoveObject?.contents?.type?.repr===C.nftType,'NFTree #2720 must remain directly owned by the Sui dev wallet.');}
export function verifyPublication(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Publication did not succeed. No NFT deposit is permitted.');
 const t=result.Transaction;check(t.transaction?.sender===C.sender,'Wrong publication sender.');
 const commands=t.transaction.commands;check(commands?.length===2&&commands[0].Publish&&commands[1].TransferObjects,'Unexpected publication command.');
 equal(commands[0].Publish.modules,build.modules,'Wrong published modules.');equal(commands[0].Publish.dependencies,build.dependencies,'Wrong dependencies.');
 equal(commands[1].TransferObjects.objects.map(x=>x.NestedResult),[[0,0]],'Upgrade authority transfer changed.');
 const inputs=t.transaction.inputs;check(inputs?.length===1,'Unexpected publication inputs.');
 const target=inputs[commands[1].TransferObjects.address.Input]?.Pure?.bytes;
 check(target===btoa(String.fromCharCode(...Uint8Array.from(C.sender.slice(2).match(/../g),x=>parseInt(x,16)))),'Upgrade authority recipient changed.');
 check(t.transaction.gasData?.owner===C.sender,'Gas must be paid by the dev wallet.');
 const gasIds=new Set([t.effects?.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]);
 const changes=t.effects?.changedObjects;check(Array.isArray(changes)&&!changes.some(x=>x.objectId===C.nft),'Original NFT was unexpectedly touched.');
 const created=[];for(const x of changes){if(x.inputState==='Exists'){check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');}else if(['ObjectWrite','PackageWrite'].includes(x.outputState)){created.push(x);}else {const transient=x.inputState==='DoesNotExist'&&x.outputState==='DoesNotExist'&&x.idOperation==='Created';const addressGas=x.inputState==='DoesNotExist'&&x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None'&&x.outputOwner===null;check(transient||addressGas,'Unexpected object effect.');}}
 check(created.length===6,'Unexpected number of created objects.');
 const typed=created.map(x=>({id:x.objectId,type:t.objectTypes?.[x.objectId],owner:x.outputOwner}));
 const packages=typed.filter(x=>x.type==='package');check(packages.length===1,'Missing new package.');const packageId=packages[0].id;
 const expected=[packageId+'::vault::Registry',packageId+'::vault::AdminCap',C.oappPackage+'::oapp::OApp',C.oappPackage+'::oapp::AdminCap','0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap'];
 for(const type of expected){const found=typed.filter(x=>x.type===type);check(found.length===1,'Created object type differs: '+type);if(type.endsWith('Cap'))check(found[0].owner?.AddressOwner===C.sender,'A capability left the dev wallet.');else check(found[0].owner?.Shared||found[0].owner?.$kind==='Shared','Expected a shared empty registry/OApp.');}
 check((t.events??[]).length===0,'Unexpected publication events.');const g=t.effects.gasUsed;check(g,'Missing gas summary.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=C.maxGasMist,'Estimated gas exceeds the reviewed 0.2-SUI limit.');
 check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected asset payment.');
 return {gasMist:String(gas),packageId,registryId:typed.find(x=>x.type===expected[0]).id,oappId:typed.find(x=>x.type===expected[2]).id,objects:typed};
}
export async function preflight(address,{client=newClient(),now=Date.now}={}){
 await verifyBuild();const transaction=publication(address);verifyNetwork(await client.core.getChainIdentifier({signal:AbortSignal.timeout(30000)}));
 const state=await client.query({query:`query { checkpoint { sequenceNumber timestamp } nft:object(address:"${C.nft}"){address version digest owner{... on AddressOwner{address{address}}} asMoveObject{contents{type{repr}}}}}`,signal:AbortSignal.timeout(30000)});check(!state.errors&&state.data,'Unable to verify NFT ownership.');verifyNft(state.data);
 const sim=await client.core.simulateTransaction({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(45000)});
 return {transaction,...verifyPublication(sim),quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Saved receipt is invalid. Check wallet activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save receipt. Copy the digest from your wallet.');storage.removeItem(C.key+'-pending');}
export async function recoverReceipt(digest,{storage,client=newClient(),now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the Sui transaction digest from Slush.');verifyNetwork(await client.core.getChainIdentifier());const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(result.Transaction?.digest===digest,'Receipt digest differs.');
 const proof=verifyPublication(result);const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestPublication({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling publication.');const stored=readStoredState(storage);check(!stored.pending&&!stored.receipt,'A publication is pending or recorded. Check its receipt below before continuing.');
  const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Connect the Sui dev wallet on mainnet.');check(reviewed()&&q,'Simulate and review first.');check(now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulation expired. Refresh it first.');
  const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another publication was recorded.');
  if(ready.gasMist!==q.gasMist||now()-q.quotedAt>C.maxAge){onQuote(ready);throw Error('Gas estimate changed or expired. Review the refreshed estimate.');}
  storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');
  let result;try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Publication failed on chain.');}
  check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid publication digest returned. Check Slush activity before retrying.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
