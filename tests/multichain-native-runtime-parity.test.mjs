import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {verifyNativeArchive} from '../scripts/multichain/check-native-runtime-parity.mjs';
const observation=JSON.parse(fs.readFileSync('docs/multichain/generation-milestone/native-runtime-parity/live-observation.json'));
const bytes=fs.readFileSync('production/recovered-function-archives/treeforce89-dev.zip');
test('exact observed archive verifies but never grants runtime or database approval',()=>{
 const result=verifyNativeArchive({observation,bytes});assert.equal(result.matchesObservedNativePackage,true);
 assert.equal(result.currentRuntimeAuthorized,false);assert.equal(result.databaseParityVerified,false);assert.equal(result.deployable,false);
});
test('one altered archive byte is rejected',()=>{const bad=Buffer.from(bytes);bad[20]^=1;assert.throws(()=>verifyNativeArchive({observation,bytes:bad}));});
for(const [name,change] of [
 ['digest',o=>o.native.d='0'.repeat(64)],['size',o=>o.native.s++],
 ['runtime',o=>o.native.r='nodejs24.x'],['route',o=>o.native.ro[0].p='/api/other'],
 ['rate limit',o=>o.native.tr.action.config.rate_limit_config.window_limit=999],
 ['unlocked deploy',o=>o.locked=false],['wrong site',o=>o.siteId='other'],
])test(name+' mismatch is rejected',()=>{const o=structuredClone(observation);change(o);assert.throws(()=>verifyNativeArchive({observation:o,bytes}));});
