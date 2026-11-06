import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
for(const dir of ['src','client','server','tools','netlify/functions'])for(const path of fs.readdirSync(dir,{recursive:true}).filter(p=>/\.(mjs|js)$/.test(p)))execFileSync(process.execPath,['--check',dir+'/'+path]);
console.log('All Canopy Breaker JavaScript syntax checks passed.');
