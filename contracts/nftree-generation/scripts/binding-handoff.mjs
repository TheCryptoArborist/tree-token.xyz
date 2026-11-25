// Fixed read/simulation-only handoff for approved step 6.
import assert from 'node:assert/strict';
import {newClient,readCandidate} from './readiness.mjs';
import {C,readConfigState,validateConfigState} from './configuration-review.mjs';
import {STATE_QUERY,fields,canonical} from './configuration-encoding.mjs';
import {readState} from './registration-review.mjs';
import {verifyConfigurationReceipt} from './configuration-handoff.mjs';
import {binding,verifyBinding} from './binding-review.mjs';
import {POST_QUERY,verifyPostState} from './configuration-post-state.mjs';
import {verifyConfiguredBnb} from './binding-bnb.mjs';
import {verifyInactiveBnb} from './registration-bnb.mjs';
import recorded from '../../../docs/multichain/generation-milestone/bnb-configuration-completed/binding-review/binding.json' with {type:'json'};
const digest='6sbCjzYbNLWYBY8QuZjLyKeGnGZjtLUWktmrZZb1fRU8';
export async function prepareBindingHandoff(client=newClient()){
 const prerequisite=await verifyConfigurationReceipt(digest,client),bnbConfiguration=await verifyConfiguredBnb();
 const before=await readConfigState(client,1);before.vaultAdmin=(await readState(client,{registered:true})).admin;
 const tx=binding(before),bytes=await tx.build({client});
 const simulation=await client.core.simulateTransaction({transaction:bytes,checksEnabled:true,doGasSelection:false,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});const proof=verifyBinding(simulation,before);assert.deepEqual(Uint8Array.from(Object.values(simulation.Transaction.bcs)),bytes);
 const post=await client.query({query:POST_QUERY,variables:{tx:{bcs:{value:Buffer.from(bytes).toString('base64')}}}});verifyPostState('binding',post,before);
 const after=await readConfigState(client,1);after.vaultAdmin=(await readState(client,{registered:true})).admin;for(const n of ['oapp','admin','vault','channel','vaultAdmin','registration','appLibraries','appSend','appReceive','appExecutor'])assert.equal(canonical(before[n]),canonical(after[n]),'State changed while simulating');
 return {schema:'tree-generation-binding-handoff-v1',preparedAt:Date.now(),transactionBase64:Buffer.from(bytes).toString('base64'),gasBudgetMist:'100000000',estimatedNetGasMist:proof.gasMist,before,after,candidate:prerequisite.candidate,bnb:prerequisite.bnb,bnbConfiguration,simulation,post};
}
export async function verifyBindingReceipt(digest,client=newClient()){
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});assert.equal(result.Transaction?.digest,digest);
 const before=structuredClone(recorded.state);for(const name of ['admin','vaultAdmin']){const ref=result.Transaction.transaction.inputs.flatMap(x=>x.Object?.ImmOrOwnedObject?[x.Object.ImmOrOwnedObject]:[]).find(x=>x.objectId===before[name].address);assert(ref);Object.assign(before[name],{version:String(ref.version),digest:ref.digest});}
 const proof=verifyBinding(result,before),r=await client.query({query:STATE_QUERY});assert(!r.errors&&r.data);const current=r.data;assert.equal(current.chainIdentifier,C.chain);assert(Date.now()-Date.parse(current.checkpoint.timestamp)<120000);
 // Validate unchanged security settings and ownership with pre-binding JSON normalized.
 const normalized=structuredClone(current);for(const n of ['vault','oapp','channel'])normalized[n].asMoveObject.contents.json=structuredClone(before[n].asMoveObject.contents.json);validateConfigState(normalized,1);
 const ids=result.Transaction.effects.changedObjects.filter(x=>x.outputState==='ObjectWrite').map(x=>x.objectId);
 const objects=await client.query({query:'query{'+ids.map((id,i)=>'o'+i+':object(address:"'+id+'"){'+fields+'}').join(' ')+'}'});assert(!objects.errors);
 const nodes=Object.values(objects.data).map(o=>({address:o.address,outputState:{asMoveObject:o.asMoveObject}}));verifyPostState('binding',{data:{simulateTransaction:{effects:{status:'SUCCESS',objectChanges:{pageInfo:{hasNextPage:false},nodes}}}}},before);
 for(const [name,id]of [['admin',C.admin],['vaultAdmin',C.vaultAdmin]])assert.equal(Object.values(objects.data).find(x=>x.address===id).owner.address.address,C.sender);
 const candidate=await readCandidate(client),bnb=await verifyInactiveBnb(),bnbConfiguration=await verifyConfiguredBnb();return {digest,packageId:C.package,vaultId:C.vault,...proof,step:6,empty:true,bound:true,current,candidate,bnb,bnbConfiguration};
}
