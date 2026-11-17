import {STATE_QUERY as CONFIG_QUERY,content,canonical} from './config-state.mjs';
import {C as CONFIG_C} from './config-identities.mjs';
import {metadata,ulnValue} from './config-encoding.mjs';
export {content,canonical};
export const C=Object.freeze({...CONFIG_C,key:'nftree-sui-bind-v1-2f3671d4',utilsPackage:'0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc',adapter:'0xb4c471c1fb8e31ddcbb518277e97a4575fc74779',peer:'0x000000000000000000000000b4c471c1fb8e31ddcbb518277e97a4575fc74779'});
const fields='address version digest owner{__typename ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}';
export const STATE_QUERY=CONFIG_QUERY.slice(0,-1)+` bridgeAdmin:object(address:"${C.bridgeAdmin}"){${fields}} }`;
export const base64=hex=>btoa(String.fromCharCode(...Uint8Array.from(hex.slice(2).match(/../g),v=>parseInt(v,16))));
export const metadataBase64=()=>btoa(String.fromCharCode(...metadata()));
const check=(v,m)=>{if(!v)throw Error(m);};const eq=(a,b,m)=>check(canonical(a)===canonical(b),m);
export function validateState(s){
 for(const [name,id,type,initial] of [['endpoint',C.endpoint,C.endpointPackage+'::endpoint_v2::EndpointV2','635685314'],['uln',C.uln,C.ulnPackage+'::uln_302::Uln302','635685319'],['oapp',C.oapp,C.oappPackage+'::oapp::OApp','1'],['bridge',C.bridge,C.package+'::bridge::Bridge','1'],['channel',C.channel,C.endpointPackage+'::messaging_channel::MessagingChannel','1058683484']]){
  const o=s[name];check(o?.address===id&&o.owner?.__typename==='Shared'&&String(o.owner.initialSharedVersion)===initial&&o.asMoveObject?.contents?.type?.repr===type,'Wrong '+name+' identity or shared origin.');
 }
 for(const [name,id,type] of [['admin',C.admin,C.oappPackage+'::oapp::AdminCap'],['bridgeAdmin',C.bridgeAdmin,C.package+'::bridge::AdminCap']]){
  const o=s[name];check(o?.address===id&&o.owner?.__typename==='AddressOwner'&&o.owner.address.address===C.sender&&o.asMoveObject?.contents?.type?.repr===type,'The dev wallet must own the matching '+name+' capability.');
 }
 const b=content(s.bridge),o=content(s.oapp),ch=content(s.channel),reg=content(s.registration);
 check(content(s.bridgeAdmin).app===C.bridge&&o.admin_cap===C.admin,'Admin capability does not match its application.');
 check(b.bound===false&&b.released===false&&b.nft?.id===C.nft&&b.oapp===C.oapp&&b.cap?.cap_type?.['@variant']==='Package'&&b.cap.cap_type.pos0===C.package,'Pilot custody or binding state changed; check prior wallet activity.');
 eq(b.backing,{bytes:base64(C.nft)},'Wrong backing NFT.');eq(b.route,{bytes:base64(C.bridge)},'Wrong pilot route.');for(const name of ['peer','request','recipient'])eq(b[name],{bytes:base64('0x'+'0'.repeat(64))},'Pilot '+name+' is already set.');
 check(o.oapp_cap?.cap_type?.['@variant']==='Package'&&o.oapp_cap.cap_type.pos0===C.package&&o.sending_call===null&&o.peer?.peers?.size==='0'&&o.enforced_options?.options?.size==='0','OApp already has a peer, options or pending send.');
 check(ch.oapp===C.package&&ch.channels?.size==='0'&&ch.is_sending===false,'Messaging channel already initialized or sending.');
 check(reg?.name===C.package&&reg.value?.messaging_channel===C.channel&&reg.value.oapp_info===metadataBase64()&&reg.value.delegate==='0x'+'0'.repeat(64),'Registration or receiver instructions changed.');
 check(content(s.endpoint).eid===30378,'Wrong Sui endpoint network.');
 const v=n=>s[n]?.dynamicField?.value?.json;
 eq(v('appLibraries'),{send_lib:C.ulnPackage,receive_lib:C.ulnPackage,receive_lib_timeout:null},'Explicit Sui libraries changed.');
 for(const [n,count] of [['appSend',5],['appReceive',20]])eq(v(n),ulnValue(count),'Explicit Sui '+n+' security changed.');
 eq(v('appExecutor'),{max_message_size:'10000',executor:C.executor},'Explicit Sui executor changed.');
}
export async function readState(fetcher=fetch){const r=await fetcher(C.graphql,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:STATE_QUERY}),signal:AbortSignal.timeout(30000)});check(r.ok,'Sui state lookup failed. No signature requested.');const x=await r.json();check(!x.errors&&x.data,'Sui state could not be verified.');validateState(x.data);return x.data;}
