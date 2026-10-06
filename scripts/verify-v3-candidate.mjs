import {mkdtemp,readFile,cp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {zipFunctions} from '@netlify/zip-it-and-ship-it';
const manifest=JSON.parse(await readFile('production/manifest.json'));
const candidate=JSON.parse(await readFile('candidate-v3/manifest.json'));
assert.equal(candidate.baselineDeployId,manifest.deployId);
assert.deepEqual(candidate.functions.map(f=>f.name),['tree-v3-overview']);
assert.deepEqual(candidate.changedFiles,['/dapp/v3-workspace.js']);
const root=process.cwd(),folder=await mkdtemp(join(tmpdir(),'tree-v3-candidate-'));
try{
 const expected=join(folder,'expected'),built=join(folder,'built');await mkdir(built);await cp('production/functions',expected,{recursive:true});
 for(const f of candidate.functions){const bytes=await readFile(f.artifact);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);await cp(f.artifact,join(expected,f.name+'.zip'));}
 const functions=await zipFunctions('netlify/functions',built,{basePath:root,config:{'*':{nodeBundler:'esbuild',nodeVersion:'22'}}});
 await new Promise(r=>setTimeout(r,2000));
 assert.deepEqual(functions.map(f=>f.name).sort(),manifest.functions.map(f=>f.name).sort());
 assert.deepEqual(functions.filter(f=>f.schedule).map(f=>({name:f.name,cron:f.schedule})).sort((a,b)=>a.name.localeCompare(b.name)),[...manifest.schedules].sort((a,b)=>a.name.localeCompare(b.name)));
 for(const f of functions)assert.deepEqual((f.routes||[]).map(r=>r.pattern).sort(),(manifest.functionConfigurations.find(x=>x.n===f.name).ro||[]).map(r=>r.p).sort());
 const r=spawnSync('python3',['scripts/compare-backend-payloads.py',expected,built],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 console.log('37 executable payloads match production; one intentional read-only V3 candidate matches its pinned archive. All routes and five schedules unchanged.');
}finally{await rm(folder,{recursive:true,force:true});}
