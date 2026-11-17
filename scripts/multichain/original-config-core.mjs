import {Transaction} from '@mysten/sui/transactions';
import {deriveDynamicFieldID} from '@mysten/sui/utils';
import {C,STATE_QUERY,tables,canonical,buildExact,metadataBase64,ulnValue,metadata,Info,Calls} from './original-config-encoding.mjs';
import {newClient,verifyNetwork} from './original-publish-core.mjs';
import {readSui} from './original-bnb-core.mjs';
import {verifyRegistration,readBnb} from './original-register-core.mjs';
import baseline from '../../docs/multichain/original-trial/route-config-baseline.json' with {type:'json'};
export {C,newClient,metadata,metadataBase64,Info,Calls,ulnValue};
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m),json=o=>o?.asMoveObject?.contents?.json,digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const appNames=['appLibraries','appExecutor','appSend','appReceive'];
export const entries=Object.freeze(Object.fromEntries(appNames.map(n=>{const [parent,type,key]=tables[n],[address,module,name]=type.split('::');return [n,{id:deriveDynamicFieldID(parent,{struct:{address,module,name,typeParams:[]}},Uint8Array.from(atob(key),x=>x.charCodeAt(0))),parent}];})));
export function validateConfigState(s,stage=0){
 check(stage===0||stage===1,'Unknown route configuration stage.');
 for(const name of ['endpoint','uln','oapp','admin','vault','channel','registration']){
 const a=s[name],b=baseline[name];check(a?.address===b.address,'Wrong '+name+' object.');eq(a.owner,b.owner,name+' ownership changed.');eq(a.asMoveObject?.contents?.type,b.asMoveObject.contents.type,name+' type changed.');
 }
 for(const name of ['oapp','admin','vault','channel'])eq(json(s[name]),json(baseline[name]),'Original '+name+' changed. Verify wallet activity.');
 const endpoint=json(s.endpoint),uln=json(s.uln);check(endpoint.eid===30378,'Wrong endpoint ID.');eq(endpoint.call_cap,json(baseline.endpoint).call_cap,'Endpoint capability changed.');eq(uln.call_cap,json(baseline.uln).call_cap,'ULN capability changed.');
 for(const [actual,expected]of [[endpoint.message_lib_manager.default_configs.id,tables.libraries[0]],[endpoint.message_lib_manager.oapp_configs.id,tables.appLibraries[0]],[uln.send_uln.oapp_executor_configs.id,tables.appExecutor[0]],[uln.send_uln.oapp_uln_configs.id,tables.appSend[0]],[uln.receive_uln.oapp_uln_configs.id,tables.appReceive[0]]])check(actual===expected,'Protocol configuration table changed.');
 for(const n of ['libraries','executor','send','receive'])eq(s[n],baseline[n],'Protocol default '+n+' changed. Review before continuing.');
 const reg=structuredClone(json(baseline.registration));if(stage===1)reg.value.oapp_info=metadataBase64();eq(json(s.registration),reg,'Registration channel, metadata or delegate changed.');
 for(const n of appNames)check(s[n]&&Object.hasOwn(s[n],'dynamicField'),'Missing '+n+' lookup.');
 if(stage===0){for(const n of appNames)check(s[n].dynamicField===null,'Application settings already exist. Check the configuration receipt.');}
 else {const get=n=>s[n].dynamicField?.value?.json;eq(get('appLibraries'),{send_lib:C.ulnPackage,receive_lib:C.ulnPackage,receive_lib_timeout:null},'Application libraries differ.');eq(get('appExecutor'),{max_message_size:'10000',executor:C.executor},'Application executor differs.');eq(get('appSend'),ulnValue(5),'Application send security differs.');eq(get('appReceive'),ulnValue(20),'Application receive security differs.');}
 return s;
}
export async function readConfigState(client,stage=0){const r=await client.query({query:STATE_QUERY,signal:AbortSignal.timeout(30000)});check(!r.errors&&r.data,'Unable to verify current route configuration.');return validateConfigState(r.data,stage);}
export function configuration(address,state){validateConfigState(state);return buildExact(address,state);}
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function verifyConfiguration(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Route configuration did not succeed.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');
 const ref=t.transaction.inputs?.flatMap(x=>x.Object?.ImmOrOwnedObject?[x.Object.ImmOrOwnedObject]:[]);check(ref?.length===1&&ref[0].objectId===C.admin&&/^[1-9][0-9]*$/.test(String(ref[0].version))&&digestPattern.test(ref[0].digest),'Wrong OApp admin reference.');
 const expected=buildExact(C.sender,{admin:ref[0]}).getData();for(const n of ['commands','inputs'])eq(norm(t.transaction[n]),norm(expected[n]),'Only the exact reviewed route configuration '+n+' are allowed.');
 const events=[
 [C.endpointPackage+'::message_lib_manager::SendLibrarySetEvent',{sender:C.package,dst_eid:30102,new_lib:C.ulnPackage}],
 [C.endpointPackage+'::message_lib_manager::ReceiveLibrarySetEvent',{receiver:C.package,src_eid:30102,new_lib:C.ulnPackage}],
 [C.endpointPackage+'::message_lib_manager::ReceiveLibraryTimeoutSetEvent',{receiver:C.package,src_eid:30102,old_lib:'0x'+'0'.repeat(64),expiry:'0'}],
 [C.ulnPackage+'::send_uln::ExecutorConfigSetEvent',{sender:C.package,dst_eid:30102,config:{max_message_size:'10000',executor:C.executor}}],
 [C.ulnPackage+'::send_uln::UlnConfigSetEvent',{sender:C.package,dst_eid:30102,config:ulnValue(5)}],
 [C.ulnPackage+'::receive_uln::UlnConfigSetEvent',{receiver:C.package,src_eid:30102,config:ulnValue(20)}],
 [C.endpointPackage+'::oapp_registry::OAppInfoSetEvent',{oapp:C.package,oapp_info:metadataBase64()}]];
 eq(t.events?.map(e=>[e.eventType,e.json]),events,'Configuration events differ from the reviewed settings.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing effects.');check(!changes.some(x=>[C.vault,C.nft,C.oapp,C.vaultAdmin,C.registry,C.channel,C.upgrade].filter(Boolean).includes(x.objectId)),'Protected NFT, Vault, OApp or channel changed.');
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]),allowed=new Set([C.admin,C.endpoint,C.uln,C.registration]);let writes=new Set();
 for(const x of changes){if(x.inputState==='Exists'){
 if(allowed.has(x.objectId)){writes.add(x.objectId);check(x.outputState==='ObjectWrite'&&x.idOperation==='None','Unexpected existing object operation.');if(x.objectId===C.admin)check(x.inputOwner?.AddressOwner===C.sender&&x.outputOwner?.AddressOwner===C.sender,'Admin authority moved.');else if(x.objectId===C.registration)check(x.inputOwner?.ObjectOwner===C.endpointRegistry&&x.outputOwner?.ObjectOwner===C.endpointRegistry,'Registration ownership changed.');else check(String(x.inputOwner?.Shared?.initialSharedVersion)===(x.objectId===C.endpoint?'635685314':'635685319')&&String(x.outputOwner?.Shared?.initialSharedVersion)===(x.objectId===C.endpoint?'635685314':'635685319'),'Protocol ownership changed.');}
 else check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');
 }else if(x.outputState==='ObjectWrite'){const entry=Object.values(entries).find(e=>e.id===x.objectId);check(entry&&x.idOperation==='Created'&&x.outputOwner?.ObjectOwner===entry.parent,'Unexpected new configuration object.');}else check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected additional object effect.');}
 check(changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='DoesNotExist'&&x.idOperation==='Created').length<=3,'Unexpected ephemeral object count.');check(writes.size===allowed.size,'Missing reviewed configuration writes.');const created=changes.filter(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');check(created.length===4&&Object.values(entries).every(e=>created.some(x=>x.objectId===e.id)),'Expected exactly four application configuration entries.');
 const g=t.effects.gasUsed;check(g,'Missing gas effects.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=100000000n,'Gas exceeds the 0.1-SUI estimate ceiling.');check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected balance change.');return {gasMist:String(gas),channelId:C.channel,configuredEntries:Object.fromEntries(Object.entries(entries).map(([n,e])=>[n,e.id]))};
}
async function verifySource(client,source){const state=await source(client),r=await client.core.getTransaction({digest:C.registrationDigest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(r.Transaction?.digest===C.registrationDigest,'Wrong registration receipt.');const p=verifyRegistration(r);check(p.channelId===C.channel&&p.registryEntryId===C.registration,'Actual registration bindings differ.');return state;}
export async function preflight(address,{client=newClient(),source=readSui,bnb=readBnb,now=Date.now}={}){
 const sourceState=await verifySource(client,source);const [state,bnbProof]=await Promise.all([readConfigState(client),bnb(sourceState)]);check(bnbProof?.status==='verified','BNB binding must be verified before configuration.');
 const transaction=configuration(address,state),result=await client.core.simulateTransaction({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(45000)});
 return {transaction,...verifyConfiguration(result),quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Saved receipt is invalid. Check wallet activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save receipt. Copy the digest from your wallet.');storage.removeItem(C.key+'-pending');}


export async function recoverReceipt(digest,{storage,client=newClient(),source=readSui,bnb=readBnb,now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the route configuration digest from Slush.');const old=readStoredState(storage).receipt;check(!old||old.digest===digest,'A different configuration receipt is recorded.');verifyNetwork(await client.core.getChainIdentifier());
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(result.Transaction?.digest===digest,'Receipt digest differs.');const proof=verifyConfiguration(result),state=await verifySource(client,source);
 const [current,bnbProof]=await Promise.all([readConfigState(client,1),bnb(state)]);check(bnbProof?.status==='verified','BNB binding must be verified before completing configuration.');const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestConfiguration({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling configuration.');const stored=readStoredState(storage);check(!stored.pending&&!stored.receipt,'A configuration is pending or recorded. Check its receipt below before continuing.');
  const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Connect the Sui dev wallet on mainnet.');check(reviewed()&&q,'Simulate and review first.');check(now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulation expired. Refresh it first.');
  const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another configuration was recorded.');
  if(ready.gasMist!==q.gasMist||now()-q.quotedAt>C.maxAge){onQuote(ready);throw Error('Gas estimate changed or expired. Review the refreshed estimate.');}
  storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');
  let result;try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Registration failed on chain.');}
  check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid configuration digest returned. Check Slush activity before retrying.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
