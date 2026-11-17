import {Transaction} from '@mysten/sui/transactions';
import {C as S,newClient,readState as readSourceState,validateState} from './original-slot-core.mjs';
import {readSui} from './original-bnb-core.mjs';
import {C as B,verifyReceipt as verifyBinding,readContracts} from './original-bnb-bind-core.mjs';
import {verifyNetwork} from './original-publish-core.mjs';
export {newClient};
export const C=Object.freeze({...S,vault:B.route,adapter:B.adapter,pass:B.pass,bindingDigest:'0x64e4369cb2cf29d7a6f8cf7ee770ac27237227df9ecfab291699c1e3211b579c',endpoint:'0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91',endpointPackage:'0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac',endpointRegistry:'0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec',key:'nftree-original-register-v2-ac73072b'});
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(JSON.stringify(a)===JSON.stringify(b),m),json=o=>o?.asMoveObject?.contents?.json,digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/,idPattern=/^0x[0-9a-f]{64}$/;
const b64=s=>btoa(String.fromCharCode(...Uint8Array.from(s.slice(2).match(/../g),x=>parseInt(x,16))));
const fields='address version digest owner{__typename ... on Shared{initialSharedVersion} ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}';
export async function readEndpoint(client,{channel=null}={}){
 if(channel)check(idPattern.test(channel),'Invalid messaging channel.');
 const result=await client.query({query:`query {checkpoint{sequenceNumber timestamp} endpoint:object(address:"${C.endpoint}"){${fields}} registration:address(address:"${C.endpointRegistry}"){dynamicField(name:{type:"address",bcs:"${b64(C.package)}"}){value{... on MoveValue{json}}}} ${channel?`channel:object(address:"${channel}"){${fields}}`:''}}`,signal:AbortSignal.timeout(30000)});
 check(!result.errors&&result.data,'Unable to verify LayerZero registration state.');const x=result.data,e=x.endpoint,j=json(e);
 check(e?.address===C.endpoint&&e.owner?.__typename==='Shared'&&String(e.owner.initialSharedVersion)==='635685314'&&e.asMoveObject?.contents?.type?.repr===C.endpointPackage+'::endpoint_v2::EndpointV2'&&j.eid===30378&&j.oapp_registry.oapps.id===C.endpointRegistry,'LayerZero endpoint identity changed.');
 check(x.registration&&Object.hasOwn(x.registration,'dynamicField'),'Missing registration lookup.');
 const entry=x.registration.dynamicField;
 if(!channel)check(entry===null,'Application already registered. Recover its existing receipt.');
 else {eq(entry?.value?.json,{messaging_channel:channel,oapp_info:'',delegate:'0x'+'0'.repeat(64)},'Registration entry differs.');const ch=x.channel,c=json(ch);check(ch?.address===channel&&ch.owner?.__typename==='Shared'&&ch.asMoveObject?.contents?.type?.repr===C.endpointPackage+'::messaging_channel::MessagingChannel'&&c.oapp===C.package&&c.is_sending===false&&c.channels.size==='0','Unexpected current messaging channel.');}
 return x;
}
export function registration(address,state){
 check(address?.toLowerCase()===C.sender,'Select your Sui dev wallet ending 45c4.');validateState(state,{vaultId:C.vault});
 const tx=new Transaction();tx.setSender(C.sender);tx.moveCall({target:C.package+'::vault::register',typeArguments:[C.nftType],arguments:[tx.sharedObjectRef({objectId:C.vault,initialSharedVersion:'2',mutable:false}),tx.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest}),tx.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:true}),tx.pure.vector('u8',[])]});return tx;
}
export function verifyRegistration(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Registration failed or was already submitted. Check wallet activity.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');const commands=t.transaction.commands;check(commands?.length===1,'Only one registration command is allowed.');const call=commands[0].MoveCall;check(call?.package===C.package&&call.module==='vault'&&call.function==='register','Wrong registration function.');eq(call.typeArguments,[C.nftType],'Wrong original NFT type.');eq(call.arguments.map(x=>x.Input),[0,1,2,3],'Wrong registration arguments.');const inputs=t.transaction.inputs;check(inputs?.length===4,'Wrong input count.');const v=inputs[0]?.Object?.SharedObject,a=inputs[1]?.Object?.ImmOrOwnedObject,e=inputs[2]?.Object?.SharedObject;
 check(v?.objectId===C.vault&&String(v.initialSharedVersion)==='2'&&v.mutable===false&&a?.objectId===C.admin&&e?.objectId===C.endpoint&&String(e.initialSharedVersion)==='635685314'&&e.mutable===true&&inputs[3]?.Pure?.bytes==='AA==','Registration inputs changed.');
 check(t.events?.length===1,'Unexpected registration events.');const ev=t.events[0],channel=ev?.json?.messaging_channel;check(ev?.eventType===C.endpointPackage+'::oapp_registry::OAppRegisteredEvent'&&ev.json.oapp===C.package&&ev.json.oapp_info===''&&idPattern.test(channel),'Wrong registration event/application identity.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing effects.');check(!changes.some(x=>[C.vault,C.nft,C.registry,C.oapp,C.oappAdmin,C.upgrade,C.package].includes(x.objectId)),'Protected custody or configuration changed.');
 const created=changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');check(created.length===2,'Expected channel and registry field only.');const ch=created.find(x=>x.objectId===channel);check(ch?.idOperation==='Created'&&ch.outputOwner?.Shared&&t.objectTypes?.[channel]===C.endpointPackage+'::messaging_channel::MessagingChannel','Missing shared messaging channel.');
 const entry=created.find(x=>x!==ch);check(entry.idOperation==='Created'&&entry.outputOwner?.ObjectOwner===C.endpointRegistry&&t.objectTypes?.[entry.objectId]?.replace(/^0x0*2::/,'0x2::').replace(/\s/g,'')==='0x2::dynamic_field::Field<address,'+C.endpointPackage+'::oapp_registry::OAppRegistration>','Wrong registry field effect.');
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]);let endpointChanged=false;
 for(const x of changes){if(x.inputState==='Exists'){if(x.objectId===C.endpoint){endpointChanged=true;check(x.inputOwner?.Shared&&x.outputOwner?.Shared&&x.outputState==='ObjectWrite','Endpoint changed ownership.');}else if(x.objectId===C.admin)check(x.inputOwner?.AddressOwner===C.sender&&x.outputOwner?.AddressOwner===C.sender&&x.outputState==='ObjectWrite','Admin changed ownership.');else check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');}else if(!created.includes(x))check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected additional effects.');}check(endpointChanged,'Endpoint update missing.');
 const g=t.effects.gasUsed;check(g,'Missing gas effects.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=C.maxGasMist,'Gas exceeds the 0.1-SUI estimate ceiling.');check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected payment.');return {gasMist:String(gas),channelId:channel,registryEntryId:entry.objectId};
}
export async function readBnb(state,{fetcher=fetch}={}){
 const methods=new Set(['eth_chainId','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getCode','eth_call']);let id=0;
 const provider={request:async({method,params=[]})=>{if(method==='eth_accounts')return [B.from];check(methods.has(method),'Only public receipt/state reads allowed.');const r=await fetcher('https://bsc-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(30000)});check(r.ok,'BNB public state lookup failed.');const x=await r.json();check(!x.error,'BNB public state read failed.');return x.result;}};
 // This checks the historical public transaction sender, not a connected BNB wallet.
 const proof=await verifyBinding(provider,C.bindingDigest,{readState:(p,o)=>readContracts(p,{...o,source:async()=>state})});check(proof.status==='verified','The confirmed BNB binding receipt is unavailable or pending. Try the checks again later.');return proof;
}
export async function preflight(address,{client=newClient(),bnb=readBnb,source=readSui,now=Date.now}={}){
 const state=await source(client);await Promise.all([readEndpoint(client),bnb(state)]);const transaction=registration(address,state);
 const result=await client.core.simulateTransaction({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(45000)});
 return {transaction,...verifyRegistration(result),quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Saved receipt is invalid. Check wallet activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save receipt. Copy the digest from your wallet.');storage.removeItem(C.key+'-pending');}

export async function recoverReceipt(digest,{storage,client=newClient(),source=readSui,bnb=readBnb,now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the LayerZero registration digest from Slush.');const old=readStoredState(storage).receipt;check(!old||old.digest===digest,'A different registration receipt is recorded.');verifyNetwork(await client.core.getChainIdentifier());
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(result.Transaction?.digest===digest,'Receipt digest differs.');const proof=verifyRegistration(result),state=await source(client);await Promise.all([readEndpoint(client,{channel:proof.channelId}),bnb(state)]);
 const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestRegistration({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling registration.');const stored=readStoredState(storage);check(!stored.pending&&!stored.receipt,'A registration is pending or recorded. Check its receipt below before continuing.');
  const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Connect the Sui dev wallet on mainnet.');check(reviewed()&&q,'Simulate and review first.');check(now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulation expired. Refresh it first.');
  const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another registration was recorded.');
  if(ready.gasMist!==q.gasMist||now()-q.quotedAt>C.maxAge){onQuote(ready);throw Error('Gas estimate changed or expired. Review the refreshed estimate.');}
  storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');
  let result;try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Registration failed on chain.');}
  check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid registration digest returned. Check Slush activity before retrying.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
