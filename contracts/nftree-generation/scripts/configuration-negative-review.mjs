// Checks-enabled negative simulations; no execution or signing surface.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {newClient} from './readiness.mjs';import {readState} from './registration-review.mjs';
import {C,readConfigState,configuration} from './configuration-review.mjs';import {binding} from './binding-review.mjs';
const client=newClient(),state=await readConfigState(client);state.vaultAdmin=(await readState(client,{registered:true})).admin;const evidence=[];
for(const kind of ['duplicate-binding','unauthorized-configuration','unauthorized-binding']){
 const tx=kind==='unauthorized-configuration'?configuration(C.sender,state):binding(state);tx.setGasBudget(100000000);tx.setGasPayment([]);await tx.build({client});
 if(kind==='duplicate-binding')tx.add(tx.getData().commands[1]);else{tx.setSender('0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6');tx.setGasOwner(C.sender);}
 const bytes=await tx.build();let rejected;
 try{const r=await client.core.simulateTransaction({transaction:bytes,checksEnabled:true,doGasSelection:false,include:{effects:true,events:true,transaction:true}});assert.equal(r.$kind,'FailedTransaction');rejected=r.FailedTransaction.status.error;}
 catch(e){if(e.name==='AssertionError')throw e;rejected={message:e.message};}
 if(kind==='duplicate-binding')assert(/abort.*5|5.*abort/i.test(JSON.stringify(rejected)),JSON.stringify(rejected));else assert(/owner|owned|ownership/i.test(JSON.stringify(rejected)),JSON.stringify(rejected));
 evidence.push({kind,checksEnabled:true,submitted:false,rejection:rejected});
}
fs.writeFileSync(process.argv[2],JSON.stringify({checkedAt:new Date().toISOString(),evidence},null,2)+'\n',{flag:'wx'});console.log(evidence);
