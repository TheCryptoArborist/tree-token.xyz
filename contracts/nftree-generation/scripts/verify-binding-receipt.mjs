// Independent read-only reconciliation of the final approved binding.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {newClient} from './readiness.mjs';import {verifyBindingReceipt} from './binding-handoff.mjs';
const [input,out]=process.argv.slice(2);assert(input&&out,'Usage: receipt.json new-output-directory');
const supplied=JSON.parse(fs.readFileSync(input));assert(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(supplied.digest));
const client=newClient(),result=await verifyBindingReceipt(supplied.digest,client);
for(const k of ['digest','packageId','vaultId','gasMist','channel','peer','empty','generation','step','bound'])assert.deepEqual(result[k],supplied[k],k+' differs');
const transaction=await client.core.getTransaction({digest:result.digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true}});
fs.mkdirSync(out,{recursive:true});for(const [n,v]of Object.entries({verification:{checkedAt:new Date().toISOString(),submitted:false,...result},transaction}))fs.writeFileSync(out+'/'+n+'.json',JSON.stringify(v,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({digest:result.digest,gasMist:result.gasMist,empty:result.empty,bound:result.bound,bnbInactive:!result.bnb.canPlay,bnbConfigurationVerified:result.bnbConfiguration.complete,checkpoint:result.current.checkpoint}));
