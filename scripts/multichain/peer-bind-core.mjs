import {Transaction} from '@mysten/sui/transactions';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {C,readState,validateState,content,canonical,base64} from './peer-bind-state.mjs';
import bnb from '../../play/multichaintest/setup/bnb/configure/configuration.json' with {type:'json'};
import {createReadProvider,resolveStage} from '../../play/multichaintest/setup/bnb/configure/core.js';
import {hashHex} from '../../play/multichaintest/setup/bnb/core.js';
export {C,readState,validateState};export {STATE_QUERY} from './peer-bind-state.mjs';
const check=(v,m)=>{if(!v)throw Error(m);};
export function validateBnbConfiguration(s){for(const [address,expected] of Object.entries(bnb.code))check(s.codes?.[address]===expected,'BNB pilot or LayerZero code changed.');check(resolveStage(bnb.reads,s.values)===4,'Finish and verify all four BNB configuration steps first.');}
export async function readBnbConfiguration(fetcher=fetch){
 const reader=createReadProvider({request(){throw Error('This Sui step does not request an EVM wallet.');}},{fetcher});
 const block=await reader.request({method:'eth_blockNumber'}),codes={};
 for(const [address,expected] of Object.entries(bnb.code)){const hash=await hashHex(await reader.request({method:'eth_getCode',params:[address,'latest']}));check(hash===expected,'BNB pilot or LayerZero code changed.');codes[address]=hash;}
 const values=[];for(const r of bnb.reads)values.push(await reader.request({method:'eth_call',params:[{to:r.to,data:r.data},'latest']}));
 const state={block,codes,values};validateBnbConfiguration(state);return state;
}
export function buildPeerBinding(address,state){
 check(address?.toLowerCase()===C.sender,'Connect the designated Sui dev wallet.');validateState(state);
 const t=new Transaction();t.setSender(C.sender);
 const peer=t.moveCall({target:C.utilsPackage+'::bytes32::from_address',arguments:[t.pure.address(C.peer)]});
 t.moveCall({target:C.package+'::bridge::bind',arguments:[
  t.sharedObjectRef({objectId:C.bridge,initialSharedVersion:'1',mutable:true}),
  t.objectRef({objectId:C.bridgeAdmin,version:String(state.bridgeAdmin.version),digest:state.bridgeAdmin.digest}),
  t.sharedObjectRef({objectId:C.oapp,initialSharedVersion:'1',mutable:true}),
  t.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest}),
  t.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:false}),
  t.sharedObjectRef({objectId:C.channel,initialSharedVersion:'1058683484',mutable:true}),peer,
 ]});return t;
}
const normalized=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function verifySimulation(r,state){
 check(r?.$kind==='Transaction'&&r.Transaction?.status?.success===true,'Peer-binding simulation failed. No signature requested.');const t=r.Transaction;
 const expected=buildPeerBinding(C.sender,state).getData();check(t.transaction?.sender===C.sender,'Wrong simulation sender.');
 for(const name of ['commands','inputs'])check(canonical(normalized(t.transaction[name]))===canonical(normalized(expected[name])),'Unexpected peer-binding '+name+'.');
 const events=[
  [C.endpointPackage+'::messaging_channel::ChannelInitializedEvent',{local_oapp:C.package,remote_eid:30102,remote_oapp:{bytes:base64(C.peer)}}],
  [C.oappPackage+'::oapp_peer::PeerSetEvent',{oapp:C.package,eid:30102,peer:{bytes:base64(C.peer)}}],
  [C.package+'::bridge::Bound',{app:C.bridge,peer:{bytes:base64(C.peer)},route:{bytes:base64(C.bridge)},nft:{bytes:base64(C.nft)}}],
 ];
 check(canonical(t.events?.map(e=>[e.eventType,e.json]))===canonical(events),'Peer-binding events differ from the reviewed route.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing peer-binding effects.');
 const existing=[C.bridge,C.bridgeAdmin,C.oapp,C.admin,C.channel];const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData?.payment??[]).map(x=>x.objectId)]);
 check(changes.filter(x=>x.inputState==='Exists'&&!gasIds.has(x.objectId)).every(x=>existing.includes(x.objectId)),'Unexpected existing object mutation.');check(!changes.some(x=>[C.nft,C.endpoint,C.uln].includes(x.objectId)),'Binding must not move the NFT or change protocol configuration.');
 for(const [id,initial] of [[C.bridge,'1'],[C.oapp,'1'],[C.channel,'1058683484']])check(String(changes.find(x=>x.objectId===id)?.outputOwner?.Shared?.initialSharedVersion)===initial,'Shared pilot ownership changed.');
 for(const id of [C.admin,C.bridgeAdmin])check(changes.find(x=>x.objectId===id)?.outputOwner?.AddressOwner===C.sender,'Admin capability ownership changed.');
 const parents=[content(state.oapp).peer.peers.id,content(state.channel).channels.id].sort();const created=changes.filter(x=>x.idOperation==='Created'&&x.outputOwner).map(x=>x.outputOwner.ObjectOwner).sort();check(canonical(created)===canonical(parents),'Unexpected peer/channel objects created.');
 const g=t.effects.gasUsed,fee=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(fee>=0n&&fee<=100000000n,'Binding exceeds the reviewed 0.1 SUI fee ceiling.');return {feeMist:String(fee)};
}
export async function preflight(address,{fetcher=fetch,simulate,readBnb=readBnbConfiguration}={}){
 const bnbState=await readBnb(fetcher),state=await readState(fetcher),transaction=buildPeerBinding(address,state);
 const client=simulate?null:new SuiGraphQLClient({network:'mainnet',url:C.graphql});
 const result=await (simulate??(o=>client.core.simulateTransaction(o)))({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true},signal:AbortSignal.timeout(45000)});
 return {transaction,state,bnbState,result,...verifySimulation(result,state)};
}
export function readStoredState(storage){return {pending:storage.getItem(C.key+'-pending')==='1',receipt:JSON.parse(storage.getItem(C.key)||'null')};}
export async function requestBinding({storage,locks,identity,reviewed,prepare=preflight,sign,onReceipt=()=>{}}){
 check(locks?.request,'Use current Brave with Slush for safe cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling this binding.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'A peer binding is already recorded or pending. Check wallet activity.');
  const account=identity();check(account.network==='mainnet'&&account.address?.toLowerCase()===C.sender,'Connect the designated dev wallet on Sui mainnet.');check(reviewed(),'Review the one-time binding details first.');
  const ready=await prepare(account.address),current=identity();check(current.address===account.address&&current.network===account.network&&current.epoch===account.epoch&&reviewed(),'Wallet or review changed. Review the selected account again.');check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another binding is recorded.');
  storage.setItem(C.key+'-pending','1');check(storage.getItem(C.key+'-pending')==='1','Cannot persist pending binding state.');let result;
  try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Binding failed on chain.');}
  check(result?.$kind==='Transaction'&&/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(result.Transaction?.digest),'No valid submission digest returned. Check wallet activity before continuing.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,action:'bind_sui_bnb_peer',peer:C.peer,status:'wallet_reported_success',submittedAt:new Date().toISOString()};const text=JSON.stringify(receipt);storage.setItem(C.key,text);check(storage.getItem(C.key)===text,'Cannot persist the binding receipt. Check wallet activity.');storage.removeItem(C.key+'-pending');onReceipt(receipt);return receipt;
 });
}
