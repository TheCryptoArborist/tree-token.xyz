import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {staticReferences,compareStatic,auditNativeFrontend} from '../scripts/multichain/check-native-frontend-release.mjs';
test('references resolve canonical local modules and styles without visiting external origins',()=>{
 assert.deepEqual(staticReferences('<script src="/play/treeforce89/assets/main.js"></script><link href="/play/treeforce89/a.css"><img src="https://evil.test/x.js">','/play/treeforce89/index.html'),['/play/treeforce89/a.css','/play/treeforce89/assets/main.js']);
 assert.deepEqual(staticReferences('import x from "./chunk.js";import(`/scripts/season.mjs`);const x="https://evil.test/x.js"','/play/treeforce89/assets/main.js'),['/play/treeforce89/assets/chunk.js','/scripts/season.mjs']);
});
test('missing recorded hashes or altered bytes cannot pass comparison',()=>{const b=Buffer.from('reviewed');const expected=createHash('sha1').update(b).digest('hex');assert(compareStatic(b,expected).matchesRecordedRelease);assert(!compareStatic(Buffer.from('changed'),expected).matchesRecordedRelease);assert(!compareStatic(b,undefined).matchesRecordedRelease);});
test('drift and changing entry are reported without claiming source parity or permission',async()=>{
 let calls=0;const r=await auditNativeFrontend({read:async()=>Buffer.from(++calls===1?'first':'second')});assert.equal(calls,2);assert.equal(r.entryStable,false);assert.equal(r.focusedStaticMatch,false);assert.equal(r.nativeTsxReproducesLiveFrontend,false);assert.equal(r.candidatePublicationAllowed,false);assert.equal(r.fullLiveInventoryChecked,false);
});
test('network failure does not become a successful audit receipt',async()=>{await assert.rejects(auditNativeFrontend({read:async()=>{throw Error('unavailable');}}),/unavailable/);});
