import {bcs} from '@mysten/sui/bcs';
import {C} from './config-identities.mjs';
const Arg=bcs.enum('Argument',{ID:bcs.vector(bcs.u8()),Object:bcs.Address,Pure:bcs.vector(bcs.u8()),NestedResult:bcs.struct('NestedResult',{call_index:bcs.u16(),result_index:bcs.u16()})});
export const Calls=bcs.vector(bcs.struct('MoveCall',{function:bcs.struct('Function',{package:bcs.Address,module_name:bcs.string(),name:bcs.string()}),arguments:bcs.vector(Arg),type_arguments:bcs.vector(bcs.string()),is_builder_call:bcs.bool(),result_ids:bcs.vector(bcs.vector(bcs.u8()))}));
export const Info=bcs.struct('OAppInfoV1',{oapp_object:bcs.Address,next_nonce_info:bcs.vector(bcs.u8()),lz_receive_info:bcs.vector(bcs.u8()),extra_info:bcs.vector(bcs.u8())});
export const Uln=bcs.struct('OAppUlnConfig',{use_default_confirmations:bcs.bool(),use_default_required_dvns:bcs.bool(),use_default_optional_dvns:bcs.bool(),uln_config:bcs.struct('UlnConfig',{confirmations:bcs.u64(),required_dvns:bcs.vector(bcs.Address),optional_dvns:bcs.vector(bcs.Address),optional_dvn_threshold:bcs.u8()})});
export const Executor=bcs.struct('ExecutorConfig',{max_message_size:bcs.u64(),executor:bcs.Address});
export function ulnValue(confirmations){return {use_default_confirmations:false,use_default_required_dvns:false,use_default_optional_dvns:false,uln_config:{confirmations:String(confirmations),required_dvns:[...C.dvns],optional_dvns:[],optional_dvn_threshold:0}};}
export function metadata(){
 const calls=[{function:{package:C.package,module_name:'bridge',name:'lz_receive'},arguments:[{Object:C.bridge},{Object:C.oapp},{ID:Array.from(Uint8Array.from(C.receiveCallId.match(/../g),v=>parseInt(v,16)))}],type_arguments:[],is_builder_call:false,result_ids:[]}];
 const receiveInfo=[0,1,...Calls.serialize(calls).toBytes()];
 return Uint8Array.from([0,1,...Info.serialize({oapp_object:C.oapp,next_nonce_info:[],lz_receive_info:receiveInfo,extra_info:[]}).toBytes()]);
}
export function buildConfig(address,state,Transaction){
 if(address?.toLowerCase()!==C.sender)throw Error('Connect the designated Sui dev wallet.');
 const t=new Transaction();t.setSender(C.sender);
 const o=t.sharedObjectRef({objectId:C.oapp,initialSharedVersion:'1',mutable:false});
 const a=t.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest});
 const e=t.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:String(state.endpoint.owner.initialSharedVersion),mutable:true});
 const u=t.sharedObjectRef({objectId:C.uln,initialSharedVersion:String(state.uln.owner.initialSharedVersion),mutable:true});
 const call=(fn,args)=>t.moveCall({target:C.oappPackage+'::endpoint_calls::'+fn,arguments:[o,a,e,...args]});
 call('set_send_library',[t.pure.u32(C.remoteEid),t.pure.address(C.ulnPackage)]);
 call('set_receive_library',[t.pure.u32(C.remoteEid),t.pure.address(C.ulnPackage),t.pure.u64(0),t.object.clock()]);
 for(const [type,bytes] of [[1,Executor.serialize({max_message_size:'10000',executor:C.executor}).toBytes()],[2,Uln.serialize(ulnValue(5)).toBytes()],[3,Uln.serialize(ulnValue(20)).toBytes()]]){
  const result=call('set_config',[t.pure.address(C.ulnPackage),t.pure.u32(C.remoteEid),t.pure.u32(type),t.pure.vector('u8',Array.from(bytes))]);
  t.moveCall({target:C.ulnPackage+'::uln_302::set_config',arguments:[u,result]});
 }
 call('set_oapp_info',[t.pure.vector('u8',Array.from(metadata()))]);return t;
}
