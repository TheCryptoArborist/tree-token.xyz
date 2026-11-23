import test from 'node:test';
import assert from 'node:assert/strict';
import {REPLACED_HASHES,ADDED_PATHS,DELIVERY_PATHS,assembleFiles,assertPreserved} from '../scripts/tree-army-release-plan.mjs';
const fixture=()=>({original:{...REPLACED_HASHES,'/protected-wallet.js':'c'.repeat(40),'/play/index.html':'d'.repeat(40)},overlays:Object.fromEntries(DELIVERY_PATHS.map(p=>[p,'a'.repeat(40)]))});
test('reviewed replacement and atlas addition retain every unrelated byte',()=>{const {original,overlays}=fixture();const files=assembleFiles(original,overlays);assert.equal(Object.keys(files).length,Object.keys(original).length+ADDED_PATHS.length);assert.equal(files['/protected-wallet.js'],original['/protected-wallet.js']);assertPreserved(original,files,overlays);});
test('reject stale replacement baseline',()=>{const {original,overlays}=fixture();original['/play/tree-army/test/index.html']='b'.repeat(40);assert.throws(()=>assembleFiles(original,overlays));});
test('reject missing media or unapproved payload',()=>{const {original,overlays}=fixture();delete overlays['/play/tree-army/test/index.html'];assert.throws(()=>assembleFiles(original,overlays));overlays['/wallet.js']='b'.repeat(40);assert.throws(()=>assembleFiles(original,overlays));});
test('reject removed or modified unrelated content and unexpected extra content',()=>{for(const mutate of [f=>delete f['/play/index.html'],f=>f['/protected-wallet.js']='b'.repeat(40),f=>f['/extra.js']='b'.repeat(40)]){const {original,overlays}=fixture();const files=assembleFiles(original,overlays);mutate(files);assert.throws(()=>assertPreserved(original,files,overlays));}});

test('combat release adds only its original parts atlas',()=>assert.deepEqual(ADDED_PATHS,['/play/tree-army/test/assets/combat-parts.webp']));
