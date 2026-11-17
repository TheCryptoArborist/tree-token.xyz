import {Transaction} from '@mysten/sui/transactions';
import {C as P,newClient,verifyNetwork,verifyPublication,verifyNft} from './original-publish-core.mjs';
import bindings from '../../docs/multichain/original-trial/bindings.json' with {type:'json'};
import baseline from '../../docs/multichain/original-trial/publication-verified.json' with {type:'json'};
export {newClient};
export const C=Object.freeze({...P,package:bindings.package,registry:bindings.registry,oapp:bindings.oapp,admin:bindings.vaultAdminCap,oappAdmin:bindings.oappAdminCap,upgrade:bindings.upgradeCap,publicationDigest:bindings.publicationDigest,key:'nftree-original-slot-v2-ac73072b',maxGasMist:100000000n});
const check=(value,message)=>{if(!value)throw Error(message);};
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
const equal=(a,b,message)=>check(canonical(a)===canonical(b),message);
const json=o=>o?.asMoveObject?.contents?.json;
const idPattern=/^0x[0-9a-f]{64}$/;
const digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const b64=id=>btoa(String.fromCharCode(...Uint8Array.from(id.slice(2).match(/../g),x=>parseInt(x,16))));
const zero='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
export function validateState(state,{vaultId=null}={}){
 const ids={registry:C.registry,admin:C.admin,oapp:C.oapp,oappAdmin:C.oappAdmin,upgrade:C.upgrade};
 for(const [name,id]of Object.entries(ids)){
  const object=state[name],old=baseline.currentObjects[id];check(object?.address===id,'Wrong '+name+' object.');
  check(object.asMoveObject?.contents?.type?.repr===old.asMoveObject.contents.type.repr,'Wrong '+name+' type.');
  if(['registry','oapp'].includes(name))check(object.owner?.__typename==='Shared'&&String(object.owner.initialSharedVersion)==='1','Shared ownership changed.');
  else check(object.owner?.__typename==='AddressOwner'&&object.owner.address?.address===C.sender,'The '+name+' must remain dev-owned.');
  if(name!=='registry')equal(json(object),json(old),'The '+name+' configuration changed.');
 }
 verifyNft(state);
 const expected=structuredClone(json(baseline.currentObjects[C.registry]));
 if(vaultId){check(idPattern.test(vaultId),'Invalid Vault ID.');expected.slot=vaultId;expected.cap=null;}
 equal(json(state.registry),expected,vaultId?'The Registry does not match this slot.':'The Registry changed or already has a slot. Do not create another.');
 if(vaultId){
  const object=state.vault;check(object?.address===vaultId&&object.owner?.__typename==='Shared','Missing shared Vault.');
  check(object.asMoveObject?.contents?.type?.repr===C.package+'::vault::Vault<'+C.nftType+'>','Wrong Vault type.');
  const cap=structuredClone(json(baseline.currentObjects[C.registry]).cap);
  equal(json(object),{id:vaultId,version:'1',registry:C.registry,cap,oapp:C.oapp,nft:null,backing:{bytes:b64(C.nft)},route:{bytes:b64(vaultId)},peer:{bytes:zero},bound:false,paused:false,phase:0,announced:false,ack_sent:false,request:{bytes:zero},recipient:{bytes:zero}},'Vault is not the expected empty, unbound slot.');
 }
 return state;
}
export async function readState(client,{vaultId=null}={}){
 if(vaultId)check(idPattern.test(vaultId),'Invalid Vault ID.');
 const ids={registry:C.registry,admin:C.admin,oapp:C.oapp,oappAdmin:C.oappAdmin,upgrade:C.upgrade,nft:C.nft,...(vaultId?{vault:vaultId}:{})};
 const objects=Object.entries(ids).map(([name,id])=>`${name}:object(address:"${id}"){address version digest owner{__typename ... on AddressOwner{address{address}} ... on Shared{initialSharedVersion}} asMoveObject{contents{type{repr} json}}}`).join(' ');
 const state=await client.query({query:`query {checkpoint{sequenceNumber timestamp} ${objects}}`,signal:AbortSignal.timeout(30000)});
 check(!state.errors&&state.data,'Unable to verify current Sui objects.');return validateState(state.data,{vaultId});
}
export function createSlot(address,state){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');validateState(state);
 const tx=new Transaction();tx.setSender(C.sender);
 tx.moveCall({target:C.package+'::vault::create_slot',typeArguments:[C.nftType],arguments:[tx.sharedObjectRef({objectId:C.registry,initialSharedVersion:'1',mutable:true}),tx.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest})]});return tx;
}
export function verifySlot(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Slot creation did not succeed.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');
 const commands=t.transaction.commands;check(commands?.length===1,'Only one slot creation call is allowed.');const call=commands[0].MoveCall;
 check(call?.package===C.package&&call.module==='vault'&&call.function==='create_slot','Wrong slot function.');equal(call.typeArguments,[C.nftType],'Wrong original NFT type.');
 equal(call.arguments.map(x=>x.Input),[0,1],'Slot arguments changed.');const inputs=t.transaction.inputs;check(inputs?.length===2,'Unexpected transaction inputs.');
 const shared=inputs[0]?.Object?.SharedObject,admin=inputs[1]?.Object?.ImmOrOwnedObject;
 check(shared?.objectId===C.registry&&String(shared.initialSharedVersion)==='1'&&shared.mutable===true&&admin?.objectId===C.admin,'Wrong Registry/AdminCap inputs.');
 const effects=t.effects?.changedObjects;check(Array.isArray(effects),'Missing effects.');
 const protectedIds=[C.nft,C.oapp,C.oappAdmin,C.upgrade,C.package];check(!effects.some(x=>protectedIds.includes(x.objectId)),'A protected NFT, capability or configuration was touched.');
 const created=effects.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');check(created.length===1,'Expected one created Vault.');const v=created[0];
 check(idPattern.test(v.objectId)&&v.outputOwner?.Shared&&v.idOperation==='Created'&&t.objectTypes?.[v.objectId]===C.package+'::vault::Vault<'+C.nftType+'>','Unexpected created object.');
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]);let registryChanged=false;
 for(const x of effects){
  if(x.inputState==='Exists'){
   if(x.objectId===C.registry){registryChanged=true;check(x.inputOwner?.Shared&&x.outputOwner?.Shared,'Registry ownership changed.');continue;}
   if(x.objectId===C.admin){check(x.inputOwner?.AddressOwner===C.sender&&x.outputOwner?.AddressOwner===C.sender&&x.outputState==='ObjectWrite'&&t.objectTypes[x.objectId]===C.package+'::vault::AdminCap','Admin capability changed owner or type.');continue;}
   check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');
  }else if(x.objectId!==v.objectId){check(x.inputState==='DoesNotExist'&&x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None'&&x.outputOwner===null,'Unexpected additional object effect.');}
 }
 check(registryChanged,'Registry update is missing.');check(t.events?.length===1,'Unexpected events.');const event=t.events[0];
 check(event.eventType===C.package+'::vault::SlotCreated','Wrong slot event.');equal(event.json,{registry:C.registry,vault:v.objectId,nft:{bytes:b64(C.nft)}},'Slot event/backing changed.');
 const g=t.effects.gasUsed;check(g,'Missing gas estimate.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=C.maxGasMist,'Gas exceeds the reviewed 0.1-SUI estimate ceiling.');
 check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected payment or recipient.');
 return {gasMist:String(gas),vaultId:v.objectId,packageId:C.package,registryId:C.registry};
}
export async function preflight(address,{client=newClient(),now=Date.now}={}){
 verifyNetwork(await client.core.getChainIdentifier({signal:AbortSignal.timeout(30000)}));
 const published=await client.core.getTransaction({digest:C.publicationDigest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});
 check(published.Transaction?.digest===C.publicationDigest,'Wrong publication receipt.');const proof=verifyPublication(published);check(proof.packageId===C.package&&proof.registryId===C.registry&&proof.oappId===C.oapp,'Publication bindings differ.');
 const state=await readState(client),transaction=createSlot(address,state);
 const sim=await client.core.simulateTransaction({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(45000)});
 return {transaction,...verifySlot(sim),quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Saved receipt is invalid. Check wallet activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save receipt. Copy the digest from your wallet.');storage.removeItem(C.key+'-pending');}
export async function recoverReceipt(digest,{storage,client=newClient(),now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the slot transaction digest from Slush.');verifyNetwork(await client.core.getChainIdentifier());
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(result.Transaction?.digest===digest,'Receipt digest differs.');
 const proof=verifySlot(result);await readState(client,{vaultId:proof.vaultId});
 const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestSlot({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling slot creation.');const stored=readStoredState(storage);check(!stored.pending&&!stored.receipt,'A slot creation is pending or recorded. Check its receipt below before continuing.');
  const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Connect the Sui dev wallet on mainnet.');check(reviewed()&&q,'Simulate and review first.');check(now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulation expired. Refresh it first.');
  const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another slot creation was recorded.');
  if(ready.gasMist!==q.gasMist||now()-q.quotedAt>C.maxAge){onQuote(ready);throw Error('Gas estimate changed or expired. Review the refreshed estimate.');}
  storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');
  let result;try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Slot creation failed on chain.');}
  check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid slot creation digest returned. Check Slush activity before retrying.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
