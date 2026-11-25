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
test('manifest paths resolve case-only spelling without accepting ambiguous collisions',async()=>{
 const {recordedHash}=await import('../scripts/multichain/check-native-frontend-release.mjs');
 assert.equal(recordedHash({'/assets/file.css':'digest'},'/assets/FILE.css'),'digest');
 assert.throws(()=>recordedHash({'/a.css':'one','/A.css':'two'},'/a.css'),/ambiguous/);assert.throws(()=>recordedHash({},'/missing.css'),/missing/);
});
test('reconciliation explanations require exact observed hashes and expected paths',async()=>{
 const {classify}=await import('../scripts/multichain/reconcile-native-frontend-release.mjs');const proofs={emojiSha:'emoji',historicalEntrySha:'html'};
 assert.equal(classify({matchesRecordedRelease:true},proofs),'recorded-static-match');
 assert.equal(classify({path:'/scripts/treeforce-season-r18.mjs',sha256:'emoji'},proofs),'documented-emoji-release');
 assert.equal(classify({path:'/play/treeforce89/index.html',sha256:'html'},proofs),'matches-historical-served-html');
 assert.equal(classify({path:'/play/treeforce89/index.html',sha256:'changed'},proofs),'unexplained');
 assert.equal(classify({path:'/other.js',sha256:'emoji'},proofs),'unexplained');
});
