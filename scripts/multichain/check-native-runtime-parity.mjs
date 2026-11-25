// Offline evidence verification only. Never approves a runtime or deploys code.
import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyNativeArchive({observation,bytes}) {
 assert.equal(observation.siteId,'aa62f324-b880-47d6-85b8-4ba0700ff5bf');
 assert.equal(observation.state,'ready');assert.equal(observation.locked,true);
 const f=observation.native;assert.equal(f.n,'treeforce89-dev');
 assert.equal(f.d,sha(bytes));assert.equal(f.s,bytes.length);
 assert.equal(f.r,'nodejs22.x');assert.equal(f.im,'stream');
 assert.equal(f.bd.bootstrapVersion,'2.24.0');assert.equal(f.bd.runtimeAPIVersion,2);
 assert.equal(f.ro.length,1);assert.equal(f.ro[0].p,'/play/treeforce89/api/*');
 assert.equal(f.tr.action.type,'rate_limit');
 assert.deepEqual(f.tr.action.config.aggregate.keys,[{type:'ip'}]);
 assert.deepEqual(f.tr.action.config.rate_limit_config,{algorithm:'sliding_window',window_size:60,window_limit:60});
 return {observedDeployId:observation.deployId,observedAt:observation.observedAt,archiveSha256:sha(bytes),bytes:bytes.length,
  matchesObservedNativePackage:true,currentRuntimeAuthorized:false,databaseParityVerified:false,deployable:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root='docs/multichain/generation-milestone/native-runtime-parity/';
 const report=verifyNativeArchive({observation:JSON.parse(fs.readFileSync(root+'live-observation.json')),bytes:fs.readFileSync('production/recovered-function-archives/treeforce89-dev.zip')});
 const comparison=JSON.parse(fs.readFileSync(root+'source-comparison.json'));
 for(const f of comparison.files)assert.equal(sha(fs.readFileSync(f.snapshot)),f.releaseSourceSha256);
 console.log(JSON.stringify({...report,pinnedFilesVerified:comparison.files.length},null,2));
}
