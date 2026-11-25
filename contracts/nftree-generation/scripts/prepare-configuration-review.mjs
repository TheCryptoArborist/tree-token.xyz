// Read-only GraphQL simulations. This file has no signing or submission API.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {newClient,readCandidate} from './readiness.mjs';
import {readState} from './registration-review.mjs';
import {verifyRegistrationReceipt} from './registration-handoff.mjs';
import {C,readConfigState,configuration,verifyConfiguration} from './configuration-review.mjs';
import {binding,verifyBinding} from './binding-review.mjs';
import {POST_QUERY,verifyPostState} from './configuration-post-state.mjs';
const dir=process.argv[2];assert(dir,'Supply a new output directory');fs.mkdirSync(dir,{recursive:true});const save=(name,v)=>fs.writeFileSync(dir+'/'+name+'.json',JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const client=newClient();save('registration-preflight',await verifyRegistrationReceipt(C.registrationDigest,client));save('candidate',await readCandidate(client));
for(const kind of ['configuration','binding']){
 const state=await readConfigState(client);state.vaultAdmin=(await readState(client,{registered:true})).admin;
 const tx=kind==='configuration'?configuration(C.sender,state):binding(state);tx.setGasBudget(100000000);tx.setGasPayment([]);const bytes=await tx.build({client});
 const result=await client.core.simulateTransaction({transaction:bytes,doGasSelection:false,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});
 assert.deepEqual(Buffer.from(Object.values(result.Transaction.bcs)),Buffer.from(bytes));
 const proof=kind==='configuration'?verifyConfiguration(result):verifyBinding(result,state);
 const post=await client.query({query:POST_QUERY,variables:{tx:{bcs:{value:Buffer.from(bytes).toString('base64')}}}});verifyPostState(kind,post,state);
 save(kind,{preparedAt:new Date().toISOString(),submitted:false,authorizedForSigning:false,state,transactionJSON:await tx.toJSON(),result,post,proof});console.log(kind,proof);
}
save('after',await verifyRegistrationReceipt(C.registrationDigest,client));
