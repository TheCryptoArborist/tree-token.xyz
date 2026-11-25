import test from 'node:test';import assert from 'node:assert/strict';
import {verifyReserveReceipt} from '../../contracts/nftree-generation/scripts/reserve-handoff.mjs';
import {STATE_QUERY,C} from '../../contracts/nftree-generation/scripts/configuration-encoding.mjs';
import fixture from '../../docs/multichain/generation-milestone/reserve-handoff/simulation.json' with {type:'json'};
function setup(change){const p=structuredClone(fixture),digest='GNDWXqgPJnZyeQaVFqnZ1HuXSnSiHUAKV1vL4Ke49yMX';p.simulation.Transaction.digest=digest;
 const nodes=p.post.data.simulateTransaction.effects.objectChanges.nodes.filter(n=>n.outputState?.asMoveObject),objects=Object.fromEntries(nodes.map((n,i)=>['o'+i,{address:n.address,asMoveObject:n.outputState.asMoveObject}]));objects.checkpoint={sequenceNumber:1,timestamp:new Date().toISOString()};
 const state=structuredClone(p.after.current);state.checkpoint.timestamp=new Date().toISOString();for(const name of ['vault','oapp','channel'])state[name].asMoveObject=nodes.find(n=>n.address===state[name].address).outputState.asMoveObject;
 change?.({p,state,objects});return {digest,client:{core:{getTransaction:async()=>p.simulation},query:async({query})=>({data:query===STATE_QUERY?state:objects})}};
}
const pending=async()=>({destinationVerified:false,state:'Unconfirmed',generation:0,purchasesPaused:true,canPlay:false});
test('source receipt confirms custody but does not claim pending BNB delivery',async()=>{const {client,digest}=setup();const r=await verifyReserveReceipt(digest,client,pending);assert(r.sourceVerified&&r.nftHeld&&r.submitted);assert.equal(r.destinationVerified,false);});
for(const [name,change]of [['changed digest',({p})=>p.simulation.Transaction.digest='other'],['missing NFT',({objects})=>Object.values(objects).find(o=>o.address===C.vault).asMoveObject.contents.json.nft=null],['changed security',({state})=>state.appSend.dynamicField.value.json.uln_config.confirmations='6'],['stale checkpoint',({objects})=>objects.checkpoint.timestamp='2020-01-01'],['excess withdrawal',({p})=>p.simulation.Transaction.transaction.inputs[4].FundsWithdrawal.reservation.MaxAmountU64='250000001']])test('receipt rejects '+name,async()=>{const {client,digest}=setup(change);await assert.rejects(verifyReserveReceipt(digest,client,pending));});
