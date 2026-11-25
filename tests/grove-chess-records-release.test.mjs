import test from 'node:test';
import assert from 'node:assert/strict';
import {REPLACED_HASHES,ADDED_PATHS,DELIVERY_PATHS,assembleFiles,assertPreserved} from '../scripts/grove-chess-records-release-plan.mjs';
const fixture=()=>({original:{...REPLACED_HASHES,'/protected-wallet.js':'c'.repeat(40),'/play/index.html':'d'.repeat(40)},overlays:Object.fromEntries(DELIVERY_PATHS.map(p=>[p,'a'.repeat(40)]))});
test('reviewed Grove Chess release retains every unrelated byte',()=>{const {original,overlays}=fixture();const files=assembleFiles(original,overlays);assert.equal(Object.keys(files).length,Object.keys(original).length+ADDED_PATHS.length);assert.equal(files['/protected-wallet.js'],original['/protected-wallet.js']);assertPreserved(original,files,overlays);});
test('reject stale replacement baseline',()=>{const {original,overlays}=fixture();original['/play/grove-chess/app.js']='b'.repeat(40);assert.throws(()=>assembleFiles(original,overlays));});
test('reject missing media or unapproved payload',()=>{const {original,overlays}=fixture();delete overlays['/play/grove-chess/app.js'];assert.throws(()=>assembleFiles(original,overlays));overlays['/wallet.js']='b'.repeat(40);assert.throws(()=>assembleFiles(original,overlays));});
test('reject removed or modified unrelated content and unexpected extra content',()=>{for(const mutate of [f=>delete f['/play/index.html'],f=>f['/protected-wallet.js']='b'.repeat(40),f=>f['/extra.js']='b'.repeat(40)]){const {original,overlays}=fixture();const files=assembleFiles(original,overlays);mutate(files);assert.throws(()=>assertPreserved(original,files,overlays));}});

test('only chess controls and presentation change',()=>{assert.deepEqual(Object.keys(REPLACED_HASHES),["/play/grove-chess/index.html", "/play/grove-chess/app.js", "/play/grove-chess/online.js", "/play/grove-chess/style.css", "/play/grove-chess/finishes.css"]);assert.equal(ADDED_PATHS.length,12);});
