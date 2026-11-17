import {Transaction} from '@mysten/sui/transactions';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {C} from './config-identities.mjs';
import {readState,validateState,canonical} from './config-state.mjs';
import {buildConfig,metadata,ulnValue} from './config-encoding.mjs';
export {C,buildConfig,metadata,readState,ulnValue,validateState};
export {Info,Calls} from './config-encoding.mjs';
export function buildConfiguration(address,state){validateState(state);return buildConfig(address,state,Transaction);}
export const metadataBase64=()=>btoa(String.fromCharCode(...metadata()));
const check=(v,m)=>{if(!v)throw Error(m);};
export function verifySimulation(r){
 check(r?.$kind==='Transaction'&&r.Transaction?.status?.success===true,'Sui configuration simulation failed. No wallet configuration was requested.');
 const t=r.Transaction;
 const expected=[
  [C.endpointPackage+'::message_lib_manager::SendLibrarySetEvent',{sender:C.package,dst_eid:C.remoteEid,new_lib:C.ulnPackage}],
  [C.endpointPackage+'::message_lib_manager::ReceiveLibrarySetEvent',{receiver:C.package,src_eid:C.remoteEid,new_lib:C.ulnPackage}],
  [C.endpointPackage+'::message_lib_manager::ReceiveLibraryTimeoutSetEvent',{receiver:C.package,src_eid:C.remoteEid,old_lib:'0x'+'0'.repeat(64),expiry:'0'}],
  [C.ulnPackage+'::send_uln::ExecutorConfigSetEvent',{sender:C.package,dst_eid:C.remoteEid,config:{max_message_size:'10000',executor:C.executor}}],
  [C.ulnPackage+'::send_uln::UlnConfigSetEvent',{sender:C.package,dst_eid:C.remoteEid,config:ulnValue(5)}],
  [C.ulnPackage+'::receive_uln::UlnConfigSetEvent',{receiver:C.package,src_eid:C.remoteEid,config:ulnValue(20)}],
  [C.endpointPackage+'::oapp_registry::OAppInfoSetEvent',{oapp:C.package,oapp_info:metadataBase64()}],
 ];
 check(canonical(t.events?.map(e=>[e.eventType,e.json]))===canonical(expected),'Simulation did not produce exactly the reviewed application settings.');
 check(t.transaction?.sender===C.sender&&t.transaction.commands.length===9,'Unexpected configuration transaction.');
 const commands=t.transaction.commands.map(c=>c.MoveCall&&[c.MoveCall.package,c.MoveCall.module,c.MoveCall.function].join('::'));
 const call=fn=>C.oappPackage+'::endpoint_calls::'+fn,uln=C.ulnPackage+'::uln_302::set_config';
 check(canonical(commands)===canonical([call('set_send_library'),call('set_receive_library'),call('set_config'),uln,call('set_config'),uln,call('set_config'),uln,call('set_oapp_info')]),'Unexpected configuration command.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing configuration effects.');
 check(!changes.some(x=>[C.bridge,C.oapp,C.nft,C.channel,C.bridgeAdmin].includes(x.objectId)),'Configuration must not change NFT custody, peer or channel state.');
 const admin=changes.find(x=>x.objectId===C.admin);check(admin?.outputOwner?.AddressOwner===C.sender,'Admin capability ownership changed.');
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData?.payment??[]).map(x=>x.objectId)]);
 const existing=[C.admin,C.endpoint,C.uln,'0xd9bf1f319f6bf7cb95bda0e82beb1ba31fd543f218ed3a246120231c7171e857'];
 check(changes.filter(x=>x.inputState==='Exists'&&!gasIds.has(x.objectId)).every(x=>existing.includes(x.objectId)),'Unexpected existing object mutation.');
 const parents=['0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920','0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181','0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60','0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09'];
 const created=changes.filter(x=>x.idOperation==='Created'&&x.outputOwner).map(x=>x.outputOwner.ObjectOwner);check(canonical(created.sort())===canonical([...parents].sort()),'Unexpected new configuration objects.');
 const g=t.effects.gasUsed,fee=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(fee>=0n&&fee<=100000000n,'Simulation exceeds the reviewed 0.1 SUI fee ceiling.');
 return {feeMist:String(fee)};
}
export async function preflight(address,{fetcher=fetch,simulate}={}){
 const state=await readState(fetcher),transaction=buildConfiguration(address,state);
 const client=simulate?null:new SuiGraphQLClient({network:'mainnet',url:C.graphql});
 const result=await (simulate??(o=>client.core.simulateTransaction(o)))({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true},signal:AbortSignal.timeout(45000)});
 return {transaction,state,result,...verifySimulation(result)};
}
export function readStoredState(storage){return {pending:storage.getItem(C.key+'-pending')==='1',receipt:JSON.parse(storage.getItem(C.key)||'null')};}
export async function requestConfiguration({storage,locks,identity,reviewed,prepare=preflight,sign,onReceipt=()=>{}}){
 check(locks?.request,'Use current Brave with Slush to coordinate this request safely.');
 return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling this configuration.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'Configuration is already recorded or pending. Check wallet activity.');
  const account=identity();check(account.network==='mainnet'&&account.address?.toLowerCase()===C.sender,'Connect the designated dev wallet on Sui mainnet.');check(reviewed(),'Review the configuration details first.');
  const ready=await prepare(account.address),current=identity();check(current.address===account.address&&current.network===account.network&&current.epoch===account.epoch&&reviewed(),'Wallet or review changed during checks. Recheck the selected account.');
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another configuration is recorded.');storage.setItem(C.key+'-pending','1');
  let result;try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Configuration failed on chain.');}
  check(result?.$kind==='Transaction'&&/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(result.Transaction?.digest),'Wallet returned no submission digest. Check wallet activity before continuing.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,action:'configure_sui_bnb_route',status:'wallet_reported_success',submittedAt:new Date().toISOString()};
  storage.setItem(C.key,JSON.stringify(receipt));storage.removeItem(C.key+'-pending');onReceipt(receipt);return receipt;
 });
}
