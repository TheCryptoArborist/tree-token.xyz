import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../../../netlify/preview-functions/generation-slot.mjs';
import {verifySlotReceipt} from './slot-handoff.mjs';
import {C} from './readiness.mjs';import {PACKAGE} from './verify-published.mjs';import {REGISTRY} from './slot-review.mjs';
import packet from '../../../docs/multichain/generation-milestone/slot-review/simulation.json' with {type:'json'};
const b64=id=>({bytes:Buffer.from(id.slice(2),'hex').toString('base64')});
function fixture(){const result=structuredClone(packet.simulation),id=packet.simulatedVaultId;result.Transaction.digest='mock';
 const vault={registry:REGISTRY,oapp:'0x0da3d845f4ab18a0a8d2f0669722a1d9161c2ea61ad714abc14d414721fd14e4',cap:{cap_type:{pos0:PACKAGE}},backing:b64(C.nft),route:b64(id),peer:b64('0x'+'00'.repeat(32)),request:b64('0x'+'00'.repeat(32)),recipient:b64('0x'+'00'.repeat(32)),nft:null,bound:false,phase:0,generation:'0',paused:false,announced:false,ack_sent:false};
 const state={data:{chainIdentifier:C.chain,registry:{asMoveObject:{contents:{json:{slot:id,cap:null}}}},admin:{owner:{address:{address:C.sender}},asMoveObject:{contents:{json:{registry:REGISTRY}}}},vault:{owner:{__typename:'Shared'},asMoveObject:{contents:{type:{repr:PACKAGE+'::vault::Vault<'+C.nftType+'>'},json:vault}}}}};return {result,state,client:{core:{getTransaction:async()=>result},query:async()=>state}};
}
test('receipt validates registry link and empty vault state',async()=>{const f=fixture();assert.equal((await verifySlotReceipt('mock',f.client)).empty,true);});
for(const [name,mutate] of [['wrong link',s=>s.data.registry.asMoveObject.contents.json.slot='0x1'],['funded',s=>s.data.vault.asMoveObject.contents.json.nft={}],['bound',s=>s.data.vault.asMoveObject.contents.json.bound=true],['moved admin',s=>s.data.admin.owner.address.address='0x1']])test('receipt rejects '+name,async()=>{const f=fixture();mutate(f.state);await assert.rejects(verifySlotReceipt('mock',f.client));});
test('endpoint rejects signatures and arbitrary query requests',async()=>{assert.equal((await handler(new Request('https://tree-token.xyz/api/generation-slot',{method:'POST',body:'signature'}))).status,405);for(const q of ['?transaction=anything','?digest=invalid','?digest=invalid&extra=x'])assert.equal((await handler(new Request('https://tree-token.xyz/api/generation-slot'+q))).status,502);});
