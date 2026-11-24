// Offline verification only; never rebuilds or deploys a function.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const directory='docs/multichain/generation-milestone/package-recovery/';
const plan=JSON.parse(fs.readFileSync('docs/multichain/generation-milestone/run-enablement/plan.json'));
const recovered=JSON.parse(fs.readFileSync(directory+'recovered.json'));
const wanted=new Map(plan.baseline.deploy.available_functions.map(f=>[f.d,f.n]));
const matches=new Map();
for(const path of execFileSync('git',['ls-files','-z','--','*.zip'],{encoding:'utf8'}).split('\0').filter(Boolean)){
 const bytes=fs.readFileSync(path),hash=createHash('sha256').update(bytes).digest('hex');if(wanted.has(hash)&&!matches.has(hash))matches.set(hash,{name:wanted.get(hash),sha256:hash,bytes:bytes.length,path});
}
for(const row of recovered.recovered){assert.equal(wanted.get(row.sha256),row.name);const bytes=fs.readFileSync(row.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.length,row.bytes);assert(matches.has(row.sha256));}
const report={baselineId:plan.baselineId,expected:61,available:[...matches.values()],missing:[...wanted].filter(([h])=>!matches.has(h)).map(([sha256,name])=>({name,sha256})),recoveredThisMilestone:recovered.recovered.length,productionChanged:false};
assert.equal(report.available.length+report.missing.length,61);
fs.writeFileSync(directory+'coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({expected:61,available:matches.size,recoveredThisMilestone:report.recoveredThisMilestone,missing:report.missing.map(x=>x.name)}));
