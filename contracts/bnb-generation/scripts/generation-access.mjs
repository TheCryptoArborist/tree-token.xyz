// Server-side, read-only backing assessment. Never a session or gameplay grant.
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {P} from '../browser/core.mjs';
import Q from '../browser/purchase-pinned.json' with {type:'json'};
import {protocolState} from '../browser/configuration-core.mjs';
import {C,STATE_QUERY,fields,canonical} from '../../nftree-generation/scripts/configuration-encoding.mjs';
import {validateConfigState} from '../../nftree-generation/scripts/configuration-review.mjs';
import unbound from '../../../docs/multichain/generation-milestone/configuration-review/baseline.json' with {type:'json'};
import bound from '../../../docs/multichain/generation-milestone/binding-completed/user-receipt.json' with {type:'json'};
export {C,P};
export const QUERY=STATE_QUERY.slice(0,-1)+['registry','upgrade'].map(n=>`${n}:object(address:"${C[n]}"){${fields}}`).join(' ')+'}';
const zero='0x'+'0'.repeat(64),peer='0x'+'0'.repeat(24)+P.addresses.adapter.slice(2).toLowerCase();
const json=o=>o?.asMoveObject?.contents?.json;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
function bytes(v){assert(typeof v?.bytes==='string');const b=Buffer.from(v.bytes,'base64');assert.equal(b.length,32);assert.equal(b.toString('base64'),v.bytes);return '0x'+b.toString('hex');}
function fresh(timestamp,now){const age=now-timestamp;assert(Number.isFinite(age)&&age>=-30000&&age<=60000,'Stale chain state');}
function generation(n){assert(typeof n==='string'&&/^[1-9][0-9]*$/.test(n)&&BigInt(n)<=0xffffffffffffffffn,'Explicit reviewed generation required');return n;}
export function validateSui(s,gen,now){
 generation(gen);assert.equal(s.chainIdentifier,C.chain);fresh(Date.parse(s.checkpoint.timestamp),now);assert(/^\d+$/.test(String(s.checkpoint.sequenceNumber)));
 const r=json(s.registry),v=json(s.vault),u=json(s.upgrade);
 assert.equal(s.registry.address,C.registry);assert.equal(s.registry.owner.__typename,'Shared');assert.equal(s.registry.asMoveObject.contents.type.repr,`${C.package}::vault::Registry`);
 assert.equal(r.id,C.registry);assert.equal(r.version,'1');assert.equal(r.cap,null);assert.equal(r.slot,C.vault);assert.equal(r.backing,C.nft);assert.equal(r.oapp,C.oapp);assert.equal(Buffer.from(r.nft_type,'base64').toString(),C.nftType.slice(2));
 assert.equal(s.vault.address,C.vault);assert.equal(s.vault.owner.__typename,'Shared');assert.equal(s.vault.asMoveObject.contents.type.repr,`${C.package}::vault::Vault<${C.nftType}>`);
 assert.equal(v.id,C.vault);assert.equal(v.version,'1');assert.equal(v.registry,C.registry);assert.equal(v.oapp,C.oapp);assert.equal(bytes(v.backing),C.nft);assert.equal(bytes(v.route),C.vault);assert.equal(bytes(v.peer),peer);assert.equal(v.bound,true);
 assert.equal(s.upgrade.address,C.upgrade);assert(/^0x0*2::package::UpgradeCap$/.test(s.upgrade.asMoveObject.contents.type.repr));assert.equal(s.upgrade.owner.__typename,'AddressOwner');assert.equal(s.upgrade.owner.address.address,C.sender);assert.equal(u.package,C.package);assert.equal(u.version,'1');assert.equal(u.policy,0);assert.equal(u.id,C.upgrade);
 // Validate security independently; normalize only the lifecycle-varying vault
 // after checking its identity and immutable capability against reviewed data.
 assert.equal(canonical(v.cap),canonical(json(unbound.vault).cap));
 for(const n of ['oapp','channel'])assert.equal(canonical(json(s[n])),canonical(json(bound.current[n])));
 const normalized=structuredClone(s);for(const n of ['vault','oapp','channel'])normalized[n].asMoveObject.contents.json=structuredClone(json(unbound[n]));validateConfigState(normalized,1);
 const eligible=v.generation===gen&&v.phase===1&&v.paused===false&&v.announced===true&&v.ack_sent===false&&bytes(v.request)===zero&&bytes(v.recipient)===zero&&v.nft?.id===C.nft&&v.nft?.number==='2720';
 return {eligible,phase:v.phase,generation:v.generation,checkpoint:s.checkpoint};
}
export async function readBnb(provider,wallet,now){
 const rpc=(method,params=[])=>provider.request({method,params});assert.equal(BigInt(await rpc('eth_chainId')),56n);
 const block=await rpc('eth_blockNumber'),header=await rpc('eth_getBlockByNumber',[block,false]);assert.equal(BigInt(header.number),BigInt(block));assert(/^0x[0-9a-f]{64}$/i.test(header.hash));fresh(Number(BigInt(header.timestamp))*1000,now);
 const pinned={request:q=>q.method==='eth_blockNumber'?Promise.resolve(block):provider.request(q)};assert.equal((await protocolState(pinned)).stage,4);
 for(const [a,h]of Object.entries(Q.codeHashes))assert.equal(keccak256(await rpc('eth_getCode',[a,block])),h);
 const pi=new Interface(P.pass.abi),ai=new Interface(P.adapter.abi),call=async(to,abi,n,args=[])=>abi.decodeFunctionResult(n,await rpc('eth_call',[{to,data:abi.encodeFunctionData(n,args)},block]))[0];
 for(const [n,value]of [['controller',P.admin],['initialBuyer',P.admin],['treasury',P.treasury],['adapter',P.addresses.adapter],['route',C.vault],['backingNFT',C.nft],['currency',Q.currency]])assert(same(await call(P.addresses.pass,pi,n),value));
 for(const [n,value]of [['pass',P.addresses.pass],['suiPeer',C.package],['route',C.vault],['backingNFT',C.nft]])assert(same(await call(P.addresses.adapter,ai,n),value));
 const state=Number(await call(P.addresses.pass,pi,'state')),gen=String(await call(P.addresses.pass,pi,'generation')),redemption=await call(P.addresses.pass,pi,'redemption'),recipient=await call(P.addresses.pass,pi,'recipient');
 const owner=state===2?await call(P.addresses.pass,pi,'ownerOf',[BigInt(gen)]):null,canPlay=await call(P.addresses.pass,pi,'canPlay',[wallet]);
 assert.equal((await rpc('eth_getBlockByNumber',[block,false])).hash,header.hash,'BNB block changed');
 return {block,hash:header.hash,timestamp:header.timestamp,state,generation:gen,owner,canPlay,redemption,recipient};
}
export async function assessGenerationBacking({wallet,approvedGeneration,provider,sui,clock=Date.now}){
 const denied=reason=>({backingEligible:false,gameplayAuthorized:false,reason});
 if(!/^0x[0-9a-f]{40}$/i.test(wallet||'')||/^0x0{40}$/i.test(wallet))return denied('invalid-wallet');
 try{
  generation(approvedGeneration);const start=clock();
  const first=await readBnb(provider,wallet,start);
  const raw=await sui.query({query:QUERY,signal:AbortSignal.timeout(20000)});assert(!raw.errors&&raw.data);const source=validateSui(raw.data,approvedGeneration,clock());
  const last=await readBnb(provider,wallet,clock());assert(clock()-start<=30000,'Review exceeded freshness window');assert(BigInt(last.block)>=BigInt(first.block));
  // No atomic cross-chain snapshot is claimed. Compare lifecycle and owner around
  // the Sui read; the caller must reread at every later run/action boundary.
  for(const n of ['state','generation','owner','canPlay','redemption','recipient'])assert.equal(last[n],first[n],'Entitlement changed during read');
  fresh(Date.parse(source.checkpoint.timestamp),clock());fresh(Number(BigInt(last.timestamp))*1000,clock());
  const active=last.state===2&&last.generation===approvedGeneration&&same(last.owner,wallet)&&last.canPlay===true&&last.redemption===zero&&last.recipient===zero;
  return {backingEligible:active&&source.eligible,gameplayAuthorized:false,reason:active&&source.eligible?'backing-verified-only':'generation-not-active-backed',wallet:wallet.toLowerCase(),approvedGeneration,bnb:last,sui:source,checkedAt:new Date(clock()).toISOString()};
 }catch{return denied('backing-unavailable');}
}
