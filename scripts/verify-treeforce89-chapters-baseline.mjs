import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {canonical} from './lib/treeforce89-production-inventory.mjs';
const previous=JSON.parse(readFileSync('production/treeforce89-scoped-api-manifest.json'));
const current=JSON.parse(readFileSync('.netlify/treeforce89-chapters-baseline.json'));
for(const key of ['functions','schedules','runtime','environment'])assert.equal(canonical(current[key]),canonical(previous[key]),'Review newer '+key+' before proceeding');
for(const [path,sha]of Object.entries(previous.files))if(path.startsWith('/play/treeforce89/'))assert.equal(current.files[path],sha,'Newer TREE FORCE frontend needs reconciliation: '+path);
const changed=Object.keys(previous.files).filter(p=>current.files[p]!==previous.files[p]),added=Object.keys(current.files).filter(p=>!Object.hasOwn(previous.files,p));
const report={previous:previous.deployId,current:current.deployId,all43FunctionsIdentical:true,fiveSchedulesIdentical:true,runtimeIdentical:true,environmentIdentical:true,treeForceFrontendIdentical:true,newerChangedPaths:changed,newerAddedPaths:added,preserveAllNewerFiles:true};
writeFileSync('.netlify/treeforce89-chapters-baseline-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
