// Read-only verification for the new generation configuration proposal.
import {deriveDynamicFieldID} from '@mysten/sui/utils';
import {C,STATE_QUERY,tables,canonical,buildExact,metadataBase64,ulnValue,metadata,Info,Calls} from './configuration-encoding.mjs';
import baseline from '../../../docs/multichain/generation-milestone/configuration-review/baseline.json' with {type:'json'};
export {C,metadata,metadataBase64,Info,Calls,ulnValue};
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
export async function readConfigState(client,stage=0){const r=await client.query({query:STATE_QUERY,signal:AbortSignal.timeout(30000)});check(!r.errors&&r.data,'Unable to verify current route configuration.');check(r.data.chainIdentifier===C.chain,'Wrong chain');const age=Date.now()-Date.parse(r.data.checkpoint.timestamp);check(age>=-30000&&age<=120000,'Stale state');return validateConfigState(r.data,stage);}
export function configuration(address,state){validateConfigState(state);return buildExact(address,state);}
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function verifyConfiguration(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Route configuration did not succeed.');const t=result.Transaction;check(BigInt(t.transaction.gasData.budget)<=100000000n,'Gas budget exceeds proposal');
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
