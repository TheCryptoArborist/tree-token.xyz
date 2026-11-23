// New generation only. Constructs unsigned review transactions; no submission.
import {Transaction} from '@mysten/sui/transactions';
import {bcs} from '@mysten/sui/bcs';
import {C as R} from './registration-review.mjs';
import receipt from '../../../docs/multichain/generation-milestone/registration-completed/user-receipt.json' with {type:'json'};
export const C=Object.freeze({...R,admin:R.oappAdmin,vaultAdmin:R.admin,
 uln:'0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f',
 ulnPackage:'0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0',
 executor:'0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989',
 receiveCallId:'64202616f75a5614acfa264418258521299eb6a892eeeea392feef8948c7eb53',
 dvns:['0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb','0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685','0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91'],
 channel:receipt.channelId,channelVersion:'1089269258',registration:receipt.registryEntryId,registrationDigest:receipt.digest,remoteEid:30102});
const Arg=bcs.enum('Argument',{ID:bcs.vector(bcs.u8()),Object:bcs.Address,Pure:bcs.vector(bcs.u8()),NestedResult:bcs.struct('NestedResult',{call_index:bcs.u16(),result_index:bcs.u16()})});
export const Calls=bcs.vector(bcs.struct('MoveCall',{function:bcs.struct('Function',{package:bcs.Address,module_name:bcs.string(),name:bcs.string()}),arguments:bcs.vector(Arg),type_arguments:bcs.vector(bcs.string()),is_builder_call:bcs.bool(),result_ids:bcs.vector(bcs.vector(bcs.u8()))}));
export const Info=bcs.struct('OAppInfoV1',{oapp_object:bcs.Address,next_nonce_info:bcs.vector(bcs.u8()),lz_receive_info:bcs.vector(bcs.u8()),extra_info:bcs.vector(bcs.u8())});
export const Uln=bcs.struct('OAppUlnConfig',{use_default_confirmations:bcs.bool(),use_default_required_dvns:bcs.bool(),use_default_optional_dvns:bcs.bool(),uln_config:bcs.struct('UlnConfig',{confirmations:bcs.u64(),required_dvns:bcs.vector(bcs.Address),optional_dvns:bcs.vector(bcs.Address),optional_dvn_threshold:bcs.u8()})});
export const Executor=bcs.struct('ExecutorConfig',{max_message_size:bcs.u64(),executor:bcs.Address});
export const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const ulnValue=confirmations=>({use_default_confirmations:false,use_default_required_dvns:false,use_default_optional_dvns:false,uln_config:{confirmations:String(confirmations),required_dvns:[...C.dvns],optional_dvns:[],optional_dvn_threshold:0}});
export function metadata(){
 const calls=[{function:{package:C.package,module_name:'vault',name:'lz_receive'},arguments:[{Object:C.vault},{Object:C.oapp},{ID:Array.from(Uint8Array.from(C.receiveCallId.match(/../g),v=>parseInt(v,16)))}],type_arguments:[C.nftType],is_builder_call:false,result_ids:[]}];
 return Uint8Array.from([0,1,...Info.serialize({oapp_object:C.oapp,next_nonce_info:[],lz_receive_info:[0,1,...Calls.serialize(calls).toBytes()],extra_info:[]}).toBytes()]);
}
export const metadataBase64=()=>btoa(String.fromCharCode(...metadata()));
export function buildExact(address,state){
 if(address?.toLowerCase()!==C.sender)throw Error('Select your Sui dev wallet ending 45c4.');
 const t=new Transaction();t.setSender(C.sender);
 const o=t.sharedObjectRef({objectId:C.oapp,initialSharedVersion:'1',mutable:false}),a=t.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest}),e=t.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:true}),u=t.sharedObjectRef({objectId:C.uln,initialSharedVersion:'635685319',mutable:true});
 const call=(fn,args)=>t.moveCall({target:C.oappPackage+'::endpoint_calls::'+fn,arguments:[o,a,e,...args]});
 call('set_send_library',[t.pure.u32(C.remoteEid),t.pure.address(C.ulnPackage)]);
 call('set_receive_library',[t.pure.u32(C.remoteEid),t.pure.address(C.ulnPackage),t.pure.u64(0),t.object.clock()]);
 for(const [type,bytes]of [[1,Executor.serialize({max_message_size:'10000',executor:C.executor}).toBytes()],[2,Uln.serialize(ulnValue(5)).toBytes()],[3,Uln.serialize(ulnValue(20)).toBytes()]]){
 const result=call('set_config',[t.pure.address(C.ulnPackage),t.pure.u32(C.remoteEid),t.pure.u32(type),t.pure.vector('u8',Array.from(bytes))]);t.moveCall({target:C.ulnPackage+'::uln_302::set_config',arguments:[u,result]});
 }
 call('set_oapp_info',[t.pure.vector('u8',Array.from(metadata()))]);return t;
}
export const fields='address version digest owner{__typename ... on Shared{initialSharedVersion} ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}';
const key=btoa(String.fromCharCode(...Uint8Array.from((C.package.slice(2)+'96750000').match(/../g),v=>parseInt(v,16))));
export const tables=Object.freeze({libraries:['0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01','u32','lnUAAA=='],send:['0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5','u32','lnUAAA=='],receive:['0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835','u32','lnUAAA=='],executor:['0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4','u32','lnUAAA=='],appLibraries:['0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920',C.endpointPackage+'::message_lib_manager::OAppConfigKey',key],appSend:['0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60',C.ulnPackage+'::send_uln::OAppConfigKey',key],appReceive:['0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09',C.ulnPackage+'::receive_uln::OAppConfigKey',key],appExecutor:['0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181',C.ulnPackage+'::send_uln::OAppConfigKey',key]});
export const STATE_QUERY='query { chainIdentifier checkpoint{sequenceNumber timestamp} '+Object.entries({endpoint:C.endpoint,uln:C.uln,oapp:C.oapp,admin:C.admin,vault:C.vault,channel:C.channel,registration:C.registration}).map(([n,id])=>n+':object(address:"'+id+'"){'+fields+'}').join(' ')+' '+Object.entries(tables).map(([n,[id,type,key]])=>n+':address(address:"'+id+'"){dynamicField(name:{type:"'+type+'",bcs:"'+key+'"}){value{... on MoveValue{json}}}}').join(' ')+'}';
