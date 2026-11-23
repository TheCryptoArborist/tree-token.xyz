// Read/simulation only. Never submits a transaction.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {newClient} from './readiness.mjs';
import {C,readConfigState} from './configuration-review.mjs';
import {readState} from './registration-review.mjs';
import {binding,verifyBinding} from './binding-review.mjs';
import {POST_QUERY,verifyPostState} from './configuration-post-state.mjs';
import {verifyConfigurationReceipt} from './configuration-handoff.mjs';
const dir=process.argv[2];assert(dir,'Supply new output directory');fs.mkdirSync(dir,{recursive:true});const save=(n,v)=>fs.writeFileSync(dir+'/'+n+'.json',JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const client=newClient(),digest='6sbCjzYbNLWYBY8QuZjLyKeGnGZjtLUWktmrZZb1fRU8';save('sui-prerequisite',await verifyConfigurationReceipt(digest,client));
const state=await readConfigState(client,1);state.vaultAdmin=(await readState(client,{registered:true})).admin;
const tx=binding(state),bytes=await tx.build({client});const result=await client.core.simulateTransaction({transaction:bytes,doGasSelection:false,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});
assert.deepEqual(Buffer.from(Object.values(result.Transaction.bcs)),Buffer.from(bytes));const proof=verifyBinding(result,state);
const post=await client.query({query:POST_QUERY,variables:{tx:{bcs:{value:Buffer.from(bytes).toString('base64')}}}});verifyPostState('binding',post,state);
save('binding',{preparedAt:new Date().toISOString(),submitted:false,approvedGasBudgetMist:'100000000',state,transactionJSON:await tx.toJSON(),result,post,proof});save('after',await verifyConfigurationReceipt(digest,client));console.log(proof);
