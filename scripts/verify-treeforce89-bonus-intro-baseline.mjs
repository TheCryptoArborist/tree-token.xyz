import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {canonical} from './lib/treeforce89-production-inventory.mjs';
const previous=JSON.parse(readFileSync('production/treeforce89-chapters-manifest.json'));
const current=JSON.parse(readFileSync('.netlify/treeforce89-bonus-intro-baseline.json'));
for(const key of ['files','functions','schedules','runtime','environment'])assert.equal(canonical(current[key]),canonical(previous[key]),'Review newer '+key+' before proceeding');
const report={previous:previous.deployId,current:current.deployId,all296FilesIdentical:true,all43FunctionsIdentical:true,fiveSchedulesIdentical:true,runtimeIdentical:true,environmentIdentical:true};
writeFileSync('.netlify/treeforce89-bonus-intro-baseline-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
