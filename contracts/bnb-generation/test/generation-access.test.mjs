import test from 'node:test';import assert from 'node:assert/strict';import {Interface} from 'ethers';
import {assessGenerationBacking,validateSui,C,P} from '../scripts/generation-access.mjs';
import fixture from '../../../docs/multichain/generation-milestone/access-reader/live-denial.json' with {type:'json'};
const pi=new Interface(P.pass.abi),ai=new Interface(P.adapter.abi),zero='0x'+'0'.repeat(64),now=Date.parse(fixture.result.checkedAt);
const base=()=>structuredClone(fixture.states[0].data);
// Explicit synthetic positive fixture. It is NOT a live entitlement.
function active(){const s=base(),v=s.vault.asMoveObject.contents.json;Object.assign(v,{phase:1,generation:'2',paused:false,announced:true,ack_sent:false,nft:{id:C.nft,number:'2720'},request:{bytes:Buffer.alloc(32).toString('base64')},recipient:{bytes:Buffer.alloc(32).toString('base64')}});return s;}
function harness({positive=true,changeSui=()=>{},changeBnb=()=>{},fail=false}={}){
 const s=positive?active():base();changeSui(s);let heads=0;const calls=[];
 const provider={request:async q=>{calls.push(q);if(fail)throw Error('RPC unavailable');
  if(q.method==='eth_blockNumber'){heads++;return fixture.reads.find(x=>x.method===q.method).result;}
  if(q.method==='eth_call'){
   const isPass=q.params[0].to.toLowerCase()===P.addresses.pass.toLowerCase(),abi=isPass?pi:ai;let decoded;try{decoded=abi.parseTransaction({data:q.params[0].data});}catch{}
   if(decoded&&isPass){const values={state:2,generation:2n,canPlay:true,ownerOf:P.admin,redemption:zero,recipient:zero};let val=positive?values[decoded.name]:undefined;
    const changed=changeBnb(decoded.name,heads,val);if(changed!==undefined)val=changed;
    if(val!==undefined)return abi.encodeFunctionResult(decoded.name,[val]);}
  }
  const row=fixture.reads.find(r=>r.method===q.method&&JSON.stringify(r.params||[])===JSON.stringify(q.params||[]));assert(row,'Unrecorded read '+JSON.stringify(q));return structuredClone(row.result);
 }};
 return {calls,provider,sui:{query:async()=>({data:s})},wallet:P.admin,approvedGeneration:positive?'2':'1',clock:()=>now};
}
test('live recorded retired generation denies with successful reads',async()=>{const r=await assessGenerationBacking(harness({positive:false}));assert.equal(r.reason,'generation-not-active-backed');assert.equal(r.backingEligible,false);assert.equal(r.gameplayAuthorized,false);});
test('synthetic active backing never authorizes gameplay',async()=>{const h=harness(),r=await assessGenerationBacking(h);assert.equal(r.backingEligible,true);assert.equal(r.gameplayAuthorized,false);const blocks=h.calls.filter(q=>q.method==='eth_call'||q.method==='eth_getCode').map(q=>q.params[1]);assert(blocks.every(b=>b===r.bnb.block));});
for(const [name,change]of [
 ['wrong chain',s=>s.chainIdentifier='wrong'],['stale checkpoint',s=>s.checkpoint.timestamp='2000-01-01T00:00:00Z'],
 ['wrong registry slot',s=>s.registry.asMoveObject.contents.json.slot='0x1'],['wrong registry type',s=>s.registry.asMoveObject.contents.type.repr='0x1::Registry'],
 ['wrong collection',s=>s.vault.asMoveObject.contents.type.repr='0x1::Vault'],['changed upgrade package',s=>s.upgrade.asMoveObject.contents.json.package='0x1'],
 ['changed upgrade version',s=>s.upgrade.asMoveObject.contents.json.version='2'],['changed admin',s=>s.upgrade.owner.address.address='0x1'],
 ['wrong peer',s=>s.vault.asMoveObject.contents.json.peer.bytes=Buffer.alloc(32).toString('base64')],
 ['changed security',s=>s.appReceive.dynamicField.value.json.uln_config.confirmations='1'],
 ['empty custody',s=>s.vault.asMoveObject.contents.json.nft=null],['wrong held NFT',s=>s.vault.asMoveObject.contents.json.nft.id='0x1'],
 ['stale generation',s=>s.vault.asMoveObject.contents.json.generation='1'],['redemption phase',s=>s.vault.asMoveObject.contents.json.phase=2],
 ['paused vault',s=>s.vault.asMoveObject.contents.json.paused=true],['not announced',s=>s.vault.asMoveObject.contents.json.announced=false],
 ['ack sent',s=>s.vault.asMoveObject.contents.json.ack_sent=true],['nonzero recipient',s=>s.vault.asMoveObject.contents.json.recipient.bytes=Buffer.alloc(32,1).toString('base64')]
])test('deny '+name,async()=>{const r=await assessGenerationBacking(harness({changeSui:change}));assert.equal(r.backingEligible,false);assert.equal(r.gameplayAuthorized,false);});
for(const [name,value]of [['state',3],['generation',1n],['canPlay',false],['ownerOf','0x'+'1'.repeat(40)],['redemption','0x'+'1'.repeat(64)],['recipient','0x'+'1'.repeat(64)]])test('deny BNB '+name,async()=>assert.equal((await assessGenerationBacking(harness({changeBnb:n=>n===name?value:undefined}))).backingEligible,false));
test('transfer between BNB snapshots rejects',async()=>assert.equal((await assessGenerationBacking(harness({changeBnb:(n,i)=>n==='ownerOf'&&i===2?'0x'+'1'.repeat(40):undefined}))).reason,'backing-unavailable'));
test('RPC outage rejects',async()=>assert.equal((await assessGenerationBacking(harness({fail:true}))).reason,'backing-unavailable'));
test('partial GraphQL response rejects',async()=>{const h=harness();h.sui.query=async()=>({errors:[{message:'partial'}],data:active()});assert.equal((await assessGenerationBacking(h)).backingEligible,false);});
test('no implicitly approved current generation',async()=>{const h=harness();delete h.approvedGeneration;assert.equal((await assessGenerationBacking(h)).backingEligible,false);});
test('zero wallet rejected before reads',async()=>{const h=harness();h.wallet='0x'+'0'.repeat(40);assert.equal((await assessGenerationBacking(h)).reason,'invalid-wallet');assert.equal(h.calls.length,0);});
test('slow review rejects',async()=>{const h=harness();let n=0;h.clock=()=>now+(n++?31000:0);assert.equal((await assessGenerationBacking(h)).backingEligible,false);});
for(const [name,mutate]of [
 ['runtime hash',(q,r)=>q.method==='eth_getCode'?'0x00':r],
 ['reorg',(q,r)=>q.method==='eth_getBlockByNumber'?{...r,hash:'0x'+'a'.repeat(64)}:r],
 ['stale BNB block',(q,r)=>q.method==='eth_getBlockByNumber'?{...r,timestamp:'0x1'}:r]
])test('fail closed on '+name,async()=>{const h=harness(),read=h.provider.request;let headers=0;h.provider.request=async q=>{const r=await read(q);if(q.method==='eth_getBlockByNumber')headers++;return name==='reorg'&&headers===1?r:mutate(q,r);};assert.equal((await assessGenerationBacking(h)).backingEligible,false);});
test('paused purchases do not imply paused active entitlement',async()=>{const h=harness();assert.equal((await assessGenerationBacking(h)).backingEligible,true);assert(!h.calls.some(q=>q.method==='eth_call'&&q.params[0].data===pi.encodeFunctionData('purchasesPaused')));});
