import {Transaction} from '@mysten/sui/transactions';
import {bcs} from '@mysten/sui/bcs';
import {toHex} from '@mysten/sui/utils';
import {encodeFunctionData,decodeFunctionResult,parseAbi,concatHex,padHex} from 'viem';
import {C as P,newClient,STATE_QUERY,validateState as validatePeerState,verifySourceReceipts,verifyBinding,readBnb} from './original-peer-core.mjs';
import {createReadProvider} from './original-bnb-config-core.mjs';
import {canonical,json} from './original-peer-state.mjs';
import baseline from '../../docs/multichain/original-trial/fund-baseline.json' with {type:'json'};
import bindings from '../../docs/multichain/original-trial/peer-bindings.json' with {type:'json'};
import template from './original-fund-quote-template.json' with {type:'json'};
export {newClient,baseline};
export const C=Object.freeze({...P,key:'nftree-original-deposit-v1-046da2a9',maxGasMist:100000000n});
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m),digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const bytes=x=>x instanceof Uint8Array?x:Uint8Array.from(Object.values(x));
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
const expectedVault=()=>({...structuredClone(json(baseline.vault)),nft:structuredClone(json(baseline.nft)),phase:1});
export function validateFundState(s,stage=0){
 if(stage===0)return validatePeerState(s,1);
 check(stage===1,'Unknown deposit stage.');check(s.vault?.address===C.vault,'Wrong deposit vault.');eq(s.vault.owner,baseline.vault.owner,'Vault ownership changed.');eq(s.vault.asMoveObject?.contents?.type,baseline.vault.asMoveObject.contents.type,'Wrong vault type.');eq(json(s.vault),expectedVault(),'Only original #2720 may be held in the funded, unannounced vault.');
 check(s.nft===null,'Deposited NFT must be wrapped, not independently live.');const normalized=structuredClone(s);normalized.vault.asMoveObject.contents.json=structuredClone(json(baseline.vault));normalized.nft=structuredClone(baseline.nft);validatePeerState(normalized,1);return s;
}
export async function readFundState(client,stage=0){const r=await client.query({query:STATE_QUERY,signal:AbortSignal.timeout(30000)});check(!r.errors&&r.data,'Cannot read original NFT custody and route.');return validateFundState(r.data,stage);}
export function buildDeposit(address,state){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');validateFundState(state,0);const tx=new Transaction();tx.setSender(C.sender);
 tx.moveCall({target:C.package+'::vault::fund',typeArguments:[C.nftType],arguments:[tx.sharedObjectRef({objectId:C.vault,initialSharedVersion:'2',mutable:true}),tx.objectRef({objectId:C.vaultAdmin,version:String(state.vaultAdmin.version),digest:state.vaultAdmin.digest}),tx.objectRef({objectId:C.nft,version:String(state.nft.version),digest:state.nft.digest})]});return tx;
}
// Exact BCS layout from the published Vault<T>, original collection NFT and CallCap sources.
const Nft=bcs.struct('NFT',{id:bcs.Address,number:bcs.u64(),name:bcs.string(),description:bcs.string(),image_url:bcs.string(),rarity:bcs.string()});
const Cap=bcs.struct('CallCap',{id:bcs.Address,cap_type:bcs.enum('CapType',{Individual:null,Package:bcs.Address})});
const Vault=bcs.struct('Vault',{id:bcs.Address,version:bcs.u64(),registry:bcs.Address,cap:Cap,oapp:bcs.Address,nft:bcs.option(Nft),backing:bcs.vector(bcs.u8()),route:bcs.vector(bcs.u8()),peer:bcs.vector(bcs.u8()),bound:bcs.bool(),paused:bcs.bool(),phase:bcs.u8(),announced:bcs.bool(),ack_sent:bcs.bool(),request:bcs.vector(bcs.u8()),recipient:bcs.vector(bcs.u8())});
function expectedVaultBcs(){const v=expectedVault();v.cap.cap_type={Package:v.cap.cap_type.pos0};for(const n of ['backing','route','peer','request','recipient'])v[n]=Array.from(atob(v[n].bytes),x=>x.charCodeAt(0));return Vault.serialize(v).toBytes();}
function common(result,transaction,{quote=false}={}){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Deposit simulation or receipt failed.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');for(const n of ['inputs','commands'])eq(norm(t.transaction[n]),norm(transaction.getData()[n]),'Unexpected deposit '+n+'.');
 eq(t.events?.map(e=>[e.eventType,e.json]),[[C.package+'::vault::Funded',{vault:C.vault,nft:json(baseline.vault).backing}]],'Expected exactly one original-NFT deposit event.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing deposit effects.');const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]),seen=new Set();
 for(const x of changes){if(x.inputState==='Exists'){
  if(x.objectId===C.nft){check(x.outputState==='DoesNotExist'&&x.idOperation==='None'&&x.outputOwner===null&&x.inputOwner?.AddressOwner===C.sender&&String(x.inputVersion)===String(baseline.nft.version)&&x.inputDigest===baseline.nft.digest,'NFT must be wrapped intact, not deleted or transferred.');seen.add(C.nft);}
  else if(x.objectId===C.vault||x.objectId===C.vaultAdmin){check(x.outputState==='ObjectWrite'&&x.idOperation==='None','Unexpected vault/admin operation.');if(x.objectId===C.vault)check(String(x.inputOwner?.Shared?.initialSharedVersion)==='2'&&String(x.outputOwner?.Shared?.initialSharedVersion)==='2','Vault must stay shared.');else check(x.inputOwner?.AddressOwner===C.sender&&x.outputOwner?.AddressOwner===C.sender,'Vault AdminCap must stay in the dev wallet.');seen.add(x.objectId);}
  else check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender&&(!x.outputOwner||x.outputOwner?.AddressOwner===C.sender),'Unexpected existing-object mutation.');
 }else check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(quote&&x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected created object or additional effect.');}
 check(seen.size===3,'Missing NFT wrapping, vault or AdminCap effects.');const g=t.effects?.gasUsed;check(g,'Missing gas usage.');const gross=BigInt(g.computationCost)+BigInt(g.storageCost),gas=gross-BigInt(g.storageRebate);check(gross>0n&&gross<=C.maxGasMist&&BigInt(t.transaction.gasData.budget)>0n&&BigInt(t.transaction.gasData.budget)<=C.maxGasMist,'Gas exceeds the reviewed 0.1-SUI ceiling.');
 check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected asset payment or balance change.');
 return {gasMist:String(gas),grossGasMist:String(gross),vaultId:C.vault,nftId:C.nft};
}
export function verifyDeposit(result){
 const t=result?.Transaction,refs=t?.transaction?.inputs?.map(x=>x.Object?.ImmOrOwnedObject).filter(Boolean);check(refs?.length===2,'Exactly NFT and matching admin inputs required.');const s=structuredClone(baseline);const a=refs.find(x=>x.objectId===C.vaultAdmin),n=refs.find(x=>x.objectId===C.nft);check(a&&n,'Wrong deposit inputs.');Object.assign(s.vaultAdmin,{version:String(a.version),digest:a.digest});check(String(n.version)===String(baseline.nft.version)&&n.digest===baseline.nft.digest,'Original NFT reference changed.');const proof=common(result,buildDeposit(C.sender,s));
 if(result.commandResults){const refs=result.commandResults[0]?.mutatedReferences;check(refs?.length===1,'Expected one mutated vault reference.');check(toHex(bytes(refs[0].bcs))===toHex(expectedVaultBcs()),'Simulated vault must hold the full unchanged original NFT.');}return proof;
}
export function buildReserveQuote(state){validateFundState(state,0);const data=structuredClone(template);for(const input of data.inputs){const o=input.Object?.ImmOrOwnedObject;if(o?.objectId===C.vaultAdmin){o.version=String(state.vaultAdmin.version);o.digest=state.vaultAdmin.digest;}if(o?.objectId===C.nft){o.version=String(state.nft.version);o.digest=state.nft.digest;}}return Transaction.from(JSON.stringify(data));}
export function verifyReserveQuote(result,transaction){common(result,transaction,{quote:true});const r=result.commandResults,fee=i=>BigInt(bcs.u64().parse(bytes(r?.at(i)?.returnValues?.[0]?.bcs??{})));const native=fee(-2),zro=fee(-1);check(native>0n&&native<=500000000n&&zro===0n,'Unsupported reserve messaging fee.');check(toHex(bytes(r?.[0]?.mutatedReferences?.[0]?.bcs??{}))===toHex(expectedVaultBcs()),'Quote must simulate the intact NFT in the original vault.');return {reserveFeeMist:String(native)};}
const endpointAbi=parseAbi(['function quote((uint32 dstEid,bytes32 receiver,bytes message,bytes options,bool payInLzToken) params,address sender) view returns ((uint256 nativeFee,uint256 lzTokenFee) fee)']);
const optionAbi=parseAbi(['function redemptionOptions() view returns (bytes)']);
export async function quoteBnbRedemption({fetcher=fetch}={}){
 const wallet={request:async({method})=>{if(method==='eth_accounts')return ['0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae'];if(method==='eth_chainId')return '0x38';throw Error('Read-only BNB quote.');}};
 const provider=createReadProvider(wallet,{fetcher,endpoints:['https://bsc-rpc.publicnode.com','https://bsc-dataseed.bnbchain.org','https://bsc-dataseed-public.bnbchain.org']}),call=async(to,data)=>provider.request({method:'eth_call',params:[{to,data},'latest']}),options=decodeFunctionResult({abi:optionAbi,functionName:'redemptionOptions',data:await call(C.adapter,encodeFunctionData({abi:optionAbi,functionName:'redemptionOptions'}))});check(options==='0x00030100110100000000000000000000000001c9c380','Redemption gas policy changed.');
 const message=concatHex(['0x0202',C.vault,C.nft,padHex('0x01',{size:32}),C.sender]);const fee=decodeFunctionResult({abi:endpointAbi,functionName:'quote',data:await call('0x1a44076050125825900e736c501f859c50fe728c',encodeFunctionData({abi:endpointAbi,functionName:'quote',args:[{dstEid:30378,receiver:C.package,message,options,payInLzToken:false},C.adapter]}))});check(fee.nativeFee>0n&&fee.nativeFee<=10000000000000000n&&fee.lzTokenFee===0n,'Unsupported BNB redemption transport quote.');return {redemptionFeeWei:String(fee.nativeFee)};
}
export async function verifyReceipts(client){await verifySourceReceipts(client);const r=await client.core.getTransaction({digest:bindings.suiPeerBindingDigest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(r.Transaction?.digest===bindings.suiPeerBindingDigest,'Wrong peer receipt.');verifyBinding(r);}
const opts=()=>({doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,commandResults:true},signal:AbortSignal.timeout(45000)});
export async function preflight(address,{client=newClient(),bnb=readBnb,redemption=quoteBnbRedemption,now=Date.now}={}){
 const state=await readFundState(client,0);await verifyReceipts(client);const bnbProof=await bnb(state);check(bnbProof?.status==='verified'&&bnbProof.stage===4,'BNB route must remain fully verified, paused and unminted.');const redemptionProof=await redemption();
 const quote=buildReserveQuote(state),quoteResult=await client.core.simulateTransaction({...opts(),transaction:Transaction.from(await quote.toJSON())}),route=verifyReserveQuote(quoteResult,quote);const transaction=buildDeposit(address,state),result=await client.core.simulateTransaction({...opts(),transaction:Transaction.from(await transaction.toJSON())});return {transaction,...verifyDeposit(result),...route,...redemptionProof,quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Saved receipt is invalid. Check Slush activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save the deposit receipt. Copy the digest from Slush.');storage.removeItem(C.key+'-pending');}
export async function recoverReceipt(digest,{storage,client=newClient(),bnb=readBnb,now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the Sui NFT-deposit digest from Slush.');const old=readStoredState(storage).receipt;check(!old||old.digest===digest,'A different deposit receipt is recorded.');await verifyReceipts(client);
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(result.Transaction?.digest===digest,'Receipt identity differs.');const proof=verifyDeposit(result),state=await readFundState(client,1),bnbProof=await bnb(state);check(bnbProof?.status==='verified'&&bnbProof.stage===4,'BNB route must remain verified.');const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestDeposit({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for deposit coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling the NFT deposit.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'A deposit is pending or recorded. Check its receipt.');const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Select the Sui dev wallet ending 45c4 on mainnet.');check(reviewed()&&q&&now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulate and review a fresh quote first.');
 const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another deposit was recorded.');
 if(ready.gasMist!==q.gasMist||ready.grossGasMist!==q.grossGasMist){onQuote(ready);throw Error('Gas estimate changed. Review the refreshed quote.');}check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired before signing.');storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');let result;
 try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
 if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Deposit failed on chain.');}
 check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid digest returned. Check Slush activity before retrying.');const receipt={digest:result.Transaction.digest,network:'sui:mainnet',sender:C.sender,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
