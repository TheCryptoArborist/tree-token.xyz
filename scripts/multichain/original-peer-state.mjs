import {bcs} from '@mysten/sui/bcs';
import {deriveDynamicFieldID} from '@mysten/sui/utils';
import {C as P,STATE_QUERY as ROUTE_QUERY,fields,canonical} from './original-config-encoding.mjs';
import {validateConfigState} from './original-config-core.mjs';
import baseline from '../../docs/multichain/original-trial/peer-bind-baseline.json' with {type:'json'};
import bindings from '../../docs/multichain/original-trial/bnb-route-bindings.json' with {type:'json'};
export {canonical,baseline};
export const C=Object.freeze({...P,utilsPackage:'0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc',adapter:bindings.bnbAdapter,pass:bindings.bnbPass,peer:'0x'+bindings.bnbAdapter.slice(2).toLowerCase().padStart(64,'0'),key:'nftree-original-sui-peer-v1-90b5292a',maxGasMist:100000000n});
const check=(v,m)=>{if(!v)throw Error(m);};export const json=o=>o?.asMoveObject?.contents?.json;export const b64=bytes=>btoa(String.fromCharCode(...bytes));const hexBytes=x=>Uint8Array.from(x.replace(/^0x/,'').match(/../g),v=>parseInt(v,16));
export const peerJson={bytes:b64(hexBytes(C.peer))},OPTIONS='00030100110100000000000000000000000000030d40',optionsBase64=b64(hexBytes(OPTIONS));
const app=json(baseline.oapp),channel=json(baseline.channel),eid=bcs.u32().serialize(30102).toBytes();
const definitions={peerEntry:[app.peer.peers.id,'u32',eid],reserveOptions:[app.enforced_options.options.id,C.oappPackage+'::enforced_options::EnforcedOptionsKey',Uint8Array.from([...eid,1,0])],ackOptions:[app.enforced_options.options.id,C.oappPackage+'::enforced_options::EnforcedOptionsKey',Uint8Array.from([...eid,3,0])],channelPath:[channel.channels.id,C.endpointPackage+'::messaging_channel::ChannelKey',Uint8Array.from([...eid,32,...hexBytes(C.peer)])]};
const typeTag=type=>{if(type==='u32')return {u32:null};const [address,module,name]=type.split('::');return {struct:{address,module,name,typeParams:[]}};};
export const entries=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([n,[parent,type,key]])=>[n,{parent,type,bcs:b64(key),id:deriveDynamicFieldID(parent,typeTag(type),key)}])));
const expandedQuery=ROUTE_QUERY.slice(0,-1)+' '+Object.entries({registry:C.registry,vaultAdmin:C.vaultAdmin,upgrade:C.upgrade,nft:C.nft}).map(([n,id])=>n+':object(address:"'+id+'"){'+fields+'}').join(' ')+' '+Object.entries(entries).map(([n,e])=>n+':address(address:"'+e.parent+'"){dynamicField(name:{type:"'+e.type+'",bcs:"'+e.bcs+'"}){value{... on MoveValue{json}}}}').join(' ')+'}';
export const STATE_QUERY=expandedQuery.replaceAll(fields,'...PeerObject')+' fragment PeerObject on Object {'+fields+'}';
const eq=(a,b,m)=>check(canonical(a)===canonical(b),m);
export function validateState(s,stage=0){
 check(stage===0||stage===1,'Unknown peer binding stage.');
 for(const n of ['oapp','vault','channel','registry','vaultAdmin','upgrade','nft']){const a=s[n],b=baseline[n];check(a?.address===b.address,'Wrong '+n+' object.');eq(a.owner,b.owner,n+' ownership changed.');eq(a.asMoveObject?.contents?.type,b.asMoveObject.contents.type,n+' type changed.');}
 for(const n of ['registry','vaultAdmin','upgrade','nft'])eq(json(s[n]),json(baseline[n]),'Protected '+n+' contents changed.');
 for(const n of ['registry','upgrade','nft']){check(String(s[n].version)===String(baseline[n].version)&&s[n].digest===baseline[n].digest,'Protected '+n+' version/digest changed.');}
 for(const n of ['oapp','vault','channel']){
  const expected=structuredClone(json(baseline[n]));if(stage===1){if(n==='oapp'){expected.peer.peers.size='1';expected.enforced_options.options.size='2';}else if(n==='vault'){expected.bound=true;expected.peer=peerJson;}else expected.channels.size='1';}eq(json(s[n]),expected,'Unexpected '+n+' peer state.');
 }
 const normalized=structuredClone(s);for(const n of ['oapp','vault','channel'])normalized[n].asMoveObject.contents.json=structuredClone(json(baseline[n]));validateConfigState(normalized,1);
 for(const n of Object.keys(entries))check(s[n]&&Object.hasOwn(s[n],'dynamicField'),'Missing '+n+' lookup.');
 if(stage===0){for(const n of Object.keys(entries))check(s[n].dynamicField===null,'Peer or enforced options already set. Check the binding receipt.');}
 else {const get=n=>s[n].dynamicField?.value?.json;eq(get('peerEntry'),peerJson,'Wrong explicit BNB peer.');for(const n of ['reserveOptions','ackOptions'])eq(get(n),optionsBase64,'Wrong '+n+' execution policy.');const path=get('channelPath');check(path?.outbound_nonce==='0'&&path?.lazy_inbound_nonce==='0'&&path?.inbound_payload_hashes?.size==='0'&&/^0x[0-9a-f]{64}$/.test(path?.inbound_payload_hashes?.id??'')&&!/^0x0+$/.test(path.inbound_payload_hashes.id),'Channel already used or incorrect.');eq(Object.keys(path).sort(),['inbound_payload_hashes','lazy_inbound_nonce','outbound_nonce'],'Unexpected channel fields.');eq(Object.keys(path.inbound_payload_hashes).sort(),['id','size'],'Unexpected inbound table fields.');}
 return s;
}
export async function readState(client,stage=0){const r=await client.query({query:STATE_QUERY,signal:AbortSignal.timeout(30000)});check(!r.errors&&r.data,'Unable to verify current source/peer state.');return validateState(r.data,stage);}
export function sourceState(s){return {registry:s.registry,admin:s.vaultAdmin,oapp:s.oapp,oappAdmin:s.admin,upgrade:s.upgrade,nft:s.nft,vault:s.vault};}
