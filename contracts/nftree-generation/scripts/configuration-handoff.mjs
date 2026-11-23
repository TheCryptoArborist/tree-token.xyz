// Query/simulation-only service for approved step 1 of 6.
import assert from 'node:assert/strict';
import {newClient,readCandidate} from './readiness.mjs';
import {C,readConfigState,configuration,verifyConfiguration} from './configuration-review.mjs';
import {verifyRegistrationReceipt} from './registration-handoff.mjs';
import {verifyInactiveBnb} from './registration-bnb.mjs';
import {POST_QUERY,verifyPostState} from './configuration-post-state.mjs';
export async function prepareConfigurationHandoff(client=newClient()){
 await verifyRegistrationReceipt(C.registrationDigest,client);const before=await readConfigState(client),tx=configuration(C.sender,before);tx.setGasBudget(100000000);tx.setGasPayment([]);const bytes=await tx.build({client});
 const simulation=await client.core.simulateTransaction({transaction:bytes,checksEnabled:true,doGasSelection:false,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});const proof=verifyConfiguration(simulation);assert.deepEqual(Uint8Array.from(Object.values(simulation.Transaction.bcs)),bytes);
 const post=await client.query({query:POST_QUERY,variables:{tx:{bcs:{value:Buffer.from(bytes).toString('base64')}}}});verifyPostState('configuration',post,before);
 const after=await readConfigState(client);for(const name of ['oapp','admin','vault','channel','registration','appLibraries','appSend','appReceive','appExecutor'])assert.deepEqual(before[name],after[name],'State changed while simulating');
 const candidate=await readCandidate(client),bnb=await verifyInactiveBnb();return {schema:'tree-generation-configuration-handoff-v1',preparedAt:Date.now(),transactionBase64:Buffer.from(bytes).toString('base64'),gasBudgetMist:'100000000',estimatedNetGasMist:proof.gasMist,before,after,candidate,bnb,simulation,post};
}
export async function verifyConfigurationReceipt(digest,client=newClient()){
 const result=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});assert.equal(result.Transaction?.digest,digest);const proof=verifyConfiguration(result),current=await readConfigState(client,1),candidate=await readCandidate(client),bnb=await verifyInactiveBnb();return {digest,packageId:C.package,vaultId:C.vault,...proof,step:1,empty:true,bound:false,current,candidate,bnb};
}
