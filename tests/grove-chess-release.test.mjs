import test from 'node:test';
import assert from 'node:assert/strict';
import {REPLACED_HASHES,ADDED_PATHS,DELIVERY_PATHS,assembleFiles,assertPreserved} from '../scripts/grove-chess-release-plan.mjs';
const fixture=()=>({original:{...REPLACED_HASHES,'/protected-wallet.js':'c'.repeat(40),'/play/index.html':'d'.repeat(40)},overlays:Object.fromEntries(DELIVERY_PATHS.map(p=>[p,'a'.repeat(40)]))});
test('reviewed Grove Chess release retains every unrelated byte',()=>{const {original,overlays}=fixture();const files=assembleFiles(original,overlays);assert.equal(Object.keys(files).length,Object.keys(original).length+ADDED_PATHS.length);assert.equal(files['/protected-wallet.js'],original['/protected-wallet.js']);assertPreserved(original,files,overlays);});
test('reject stale replacement baseline',()=>{const {original,overlays}=fixture();original['/scripts/arcade-organization.js']='b'.repeat(40);assert.throws(()=>assembleFiles(original,overlays));});
test('reject missing media or unapproved payload',()=>{const {original,overlays}=fixture();delete overlays['/scripts/arcade-organization.js'];assert.throws(()=>assembleFiles(original,overlays));overlays['/wallet.js']='b'.repeat(40);assert.throws(()=>assembleFiles(original,overlays));});
test('reject removed or modified unrelated content and unexpected extra content',()=>{for(const mutate of [f=>delete f['/play/index.html'],f=>f['/protected-wallet.js']='b'.repeat(40),f=>f['/extra.js']='b'.repeat(40)]){const {original,overlays}=fixture();const files=assembleFiles(original,overlays);mutate(files);assert.throws(()=>assertPreserved(original,files,overlays));}});

test('only the organization module is replaced',()=>{assert.deepEqual(Object.keys(REPLACED_HASHES),['/scripts/arcade-organization.js']);assert(ADDED_PATHS.includes('/play/grove-chess/index.html'));assert(ADDED_PATHS.includes('/scripts/arcade-grove-chess.js'));});
