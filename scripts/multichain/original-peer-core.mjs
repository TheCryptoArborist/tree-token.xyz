import {Transaction} from '@mysten/sui/transactions';
import {C,STATE_QUERY,entries,canonical,baseline,json,peerJson,optionsBase64,validateState,readState,sourceState} from './original-peer-state.mjs';
import {newClient,verifyNetwork,verifyPublication} from './original-publish-core.mjs';
import {verifySlot} from './original-slot-core.mjs';
import {verifyRegistration} from './original-register-core.mjs';
import {verifyConfiguration} from './original-config-core.mjs';
import {C as B,createReadProvider,readState as readBnbState,verifyReceipt as verifyBnbReceipt} from './original-bnb-config-core.mjs';
import bindings from '../../docs/multichain/original-trial/bnb-route-bindings.json' with {type:'json'};
export {C,newClient,STATE_QUERY,entries,validateState,readState};
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m),digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
export function buildBinding(address,state){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');validateState(state,0);const t=new Transaction();t.setSender(C.sender);
 const peer=t.moveCall({target:C.utilsPackage+'::bytes32::from_address',arguments:[t.pure.address(C.peer)]});
 t.moveCall({target:C.package+'::vault::bind',typeArguments:[C.nftType],arguments:[t.sharedObjectRef({objectId:C.vault,initialSharedVersion:'2',mutable:true}),t.objectRef({objectId:C.vaultAdmin,version:String(state.vaultAdmin.version),digest:state.vaultAdmin.digest}),t.sharedObjectRef({objectId:C.oapp,initialSharedVersion:'1',mutable:true}),t.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest}),t.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:false}),t.sharedObjectRef({objectId:C.channel,initialSharedVersion:C.channelVersion,mutable:true}),peer]});return t;
}
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function verifyBinding(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Peer binding did not succeed.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');const refs=t.transaction.inputs?.flatMap(x=>x.Object?.ImmOrOwnedObject?[x.Object.ImmOrOwnedObject]:[]);
 check(refs?.length===2&&refs.every(x=>[C.vaultAdmin,C.admin].includes(x.objectId)&&/^[1-9][0-9]*$/.test(String(x.version))&&digestPattern.test(x.digest))&&new Set(refs.map(x=>x.objectId)).size===2,'Wrong admin object references.');
 const state=structuredClone(baseline);for(const x of refs)Object.assign(state[x.objectId===C.vaultAdmin?'vaultAdmin':'admin'],{version:String(x.version),digest:x.digest});for(const n of Object.keys(entries))state[n]={dynamicField:null};const expected=buildBinding(C.sender,state).getData();for(const n of ['commands','inputs'])eq(norm(t.transaction[n]),norm(expected[n]),'Only the exact original peer-binding '+n+' are allowed.');
 const events=[
 [C.endpointPackage+'::messaging_channel::ChannelInitializedEvent',{local_oapp:C.package,remote_eid:30102,remote_oapp:peerJson}],
 [C.oappPackage+'::oapp_peer::PeerSetEvent',{oapp:C.package,eid:30102,peer:peerJson}],
 ...[1,3].map(msg_type=>[C.oappPackage+'::enforced_options::EnforcedOptionSetEvent',{oapp:C.package,eid:30102,msg_type,options:optionsBase64}]),
 [C.package+'::vault::Bound',{vault:C.vault,peer:peerJson}]];
 eq(t.events?.map(e=>[e.eventType,e.json]),events,'Peer, channel or enforced-options events differ.');const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing binding effects.');
 const shared=new Map([[C.vault,'2'],[C.oapp,'1'],[C.channel,C.channelVersion]]),admins=new Set([C.vaultAdmin,C.admin]),allowed=new Set([...shared.keys(),...admins]),gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]),writes=new Set();
 check(!changes.some(x=>[C.nft,C.registry,C.upgrade,C.endpoint,C.uln,C.registration].includes(x.objectId)),'Protected NFT, Registry, upgrade authority or protocol settings changed.');
 for(const x of changes){if(x.inputState==='Exists'){
 if(allowed.has(x.objectId)){writes.add(x.objectId);check(x.outputState==='ObjectWrite'&&x.idOperation==='None','Unexpected existing object operation.');if(admins.has(x.objectId))check(x.inputOwner?.AddressOwner===C.sender&&x.outputOwner?.AddressOwner===C.sender,'Admin capability moved.');else check(String(x.inputOwner?.Shared?.initialSharedVersion)===shared.get(x.objectId)&&String(x.outputOwner?.Shared?.initialSharedVersion)===shared.get(x.objectId),'Shared ownership changed.');}
 else check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');
 }else if(x.outputState==='ObjectWrite'){const entry=Object.values(entries).find(e=>e.id===x.objectId);check(entry&&x.idOperation==='Created'&&x.outputOwner?.ObjectOwner===entry.parent,'Unexpected new binding entry.');}
 else check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected additional object effect.');}
 check(writes.size===allowed.size,'Missing binding writes.');const created=changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');check(created.length===4&&Object.values(entries).every(e=>created.some(x=>x.objectId===e.id)),'Expected exactly four derived binding entries.');check(changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='DoesNotExist'&&x.idOperation==='Created').length<=3,'Unexpected transient object count.');
 const g=t.effects?.gasUsed;check(g,'Missing gas effects.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=C.maxGasMist,'Gas exceeds the reviewed 0.1-SUI estimate ceiling.');check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected balance change.');return {gasMist:String(gas),channelId:C.channel,vaultId:C.vault,peer:C.peer,bindingEntries:Object.fromEntries(Object.entries(entries).map(([n,e])=>[n,e.id]))};
}
export async function verifySourceReceipts(client){
 verifyNetwork(await client.core.getChainIdentifier({signal:AbortSignal.timeout(30000)}));
 const list=[[bindings.publicationDigest,verifyPublication],[bindings.slotDigest,verifySlot],[bindings.registrationDigest,verifyRegistration],[bindings.suiConfigurationDigest,verifyConfiguration]];
 const r=await Promise.all(list.map(async([digest,verify])=>{const x=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(x.Transaction?.digest===digest,'Wrong source receipt.');return verify(x);}));
 check(r[0].packageId===C.package&&r[1].vaultId===C.vault&&r[2].channelId===C.channel&&r[3].channelId===C.channel,'Confirmed source bindings differ.');return {status:'verified'};
}
export async function readBnb(state,{fetcher=fetch}={}){
 // Intended public receipt account, not an actual EVM wallet connection. No signing methods allowed.
 const wallet={request:async({method})=>{if(method==='eth_accounts')return [B.from];if(method==='eth_chainId')return '0x38';throw Error('This Sui step requests no BNB wallet or signing.');}};
 const provider=createReadProvider(wallet,{fetcher,endpoints:['https://bsc-rpc.publicnode.com','https://bsc-dataseed.bnbchain.org','https://bsc-dataseed-public.bnbchain.org']});
 const live=await readBnbState(provider,{source:async()=>({state:sourceState(state),route:state})});check(live.stage===4&&live.bindingVerified===true,'All four BNB settings and pass binding must be verified.');
 const receipts=[];for(const [i,hash]of bindings.bnbConfigurationDigests.entries()){const r=await verifyBnbReceipt(provider,hash,{read:async()=>live});check(r.status==='verified'&&r.stage===i,'Actual BNB configuration receipt is not verified.');receipts.push(r);}return {status:'verified',...live,receipts};
}
export async function preflight(address,{client=newClient(),bnb=readBnb,now=Date.now}={}){
 const [state,sourceProof]=await Promise.all([readState(client,0),verifySourceReceipts(client)]);check(sourceProof.status==='verified','Source receipts are not verified.');const bnbProof=await bnb(state);check(bnbProof?.status==='verified'&&bnbProof.stage===4,'Confirmed BNB route must be verified before binding.');
 const transaction=buildBinding(address,state),result=await client.core.simulateTransaction({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(45000)});return {transaction,...verifyBinding(result),quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Saved receipt is invalid. Check Slush activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save the binding receipt. Copy the digest from Slush.');storage.removeItem(C.key+'-pending');}
export async function recoverReceipt(digest,{storage,client=newClient(),bnb=readBnb,now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the Sui peer-binding digest from Slush.');const old=readStoredState(storage).receipt;check(!old||old.digest===digest,'A different binding receipt is recorded.');await verifySourceReceipts(client);
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(result.Transaction?.digest===digest,'Receipt identity differs.');const proof=verifyBinding(result),state=await readState(client,1),bnbProof=await bnb(state);check(bnbProof?.status==='verified'&&bnbProof.stage===4,'BNB route must remain verified.');const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestBinding({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for binding coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling peer binding.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'A binding is pending or recorded. Check its receipt.');const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Select the Sui dev wallet ending 45c4 on mainnet.');check(reviewed()&&q&&now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulate and review a fresh quote first.');
 const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another binding was recorded.');
 if(ready.gasMist!==q.gasMist){onQuote(ready);throw Error('Gas estimate changed. Review the refreshed quote.');}check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired before signing.');storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');let result;
 try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
 if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Binding failed on chain.');}
 check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid digest returned. Check Slush activity before retrying.');const receipt={digest:result.Transaction.digest,network:'sui:mainnet',sender:C.sender,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
