import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {simulateReadiness} from './readiness.mjs';
if(process.argv.length!==3) throw Error('Usage: node --use-env-proxy simulate-readiness.mjs NEW_OUTPUT_DIRECTORY');
const out=resolve(process.argv[2]);
// Refuse replacement of any saved evidence; simulations run without signing.
await mkdir(out);
const result=await simulateReadiness();
for(const [name,value] of Object.entries(result))
 await writeFile(resolve(out,name+'.json'),JSON.stringify(value,(_,v)=>v instanceof Uint8Array?[...v]:v,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result.summary,null,2));
