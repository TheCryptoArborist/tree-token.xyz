import fs from 'node:fs';
import crypto from 'node:crypto';
import {zipFunction} from '../.netlify/release-tooling/node_modules/@netlify/zip-it-and-ship-it/dist/main.js';
const packages=[];
for(const name of ['tree-volume','tree-liquidity']){
 const result=await zipFunction('netlify/functions/'+name+'.ts','production/metrics-functions',{basePath:process.cwd(),config:{'*':{nodeBundler:'esbuild',nodeVersion:'22.x'}}});
 const bytes=fs.readFileSync(result.path);packages.push({...result,path:'production/metrics-functions/'+name+'.zip',sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync('production/metrics-packages.json',JSON.stringify(packages,null,2)+'\n');
console.log(JSON.stringify(packages,null,2));
