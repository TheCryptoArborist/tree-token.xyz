import assert from 'node:assert/strict';
export const REPLACED_HASHES = {"/play/grove-chess/index.html": "5a2b070b044b7d34d8b4db77bba5bac5b1ca838e", "/play/grove-chess/app.js": "10ebfd036ad91ce310a7b2bad236c4f6ba71c7c7", "/play/grove-chess/online.js": "cd25c515df1154e80178fe5f298ad3af19d54f09", "/play/grove-chess/finishes.css": "07a6df3e1cd3c8f7ea63e4606b4edb4a571a9067"};
export const ADDED_PATHS = [];
export const DELIVERY_PATHS = [...Object.keys(REPLACED_HASHES),...ADDED_PATHS];
export function assembleFiles(original, overlays) {
  assert.deepEqual(Object.keys(overlays).sort(), [...DELIVERY_PATHS].sort(), 'Exact Grove Chess allowlist required');
  for (const [path, hash] of Object.entries(REPLACED_HASHES)) assert.equal(original[path], hash, 'Reviewed replacement baseline changed: '+path);
  for (const path of ADDED_PATHS) assert(!Object.hasOwn(original, path), 'New Grove Chess path already exists: '+path);
  for (const [path, hash] of Object.entries(overlays)) {
    assert.equal(path,path.toLowerCase(),'New delivery paths must use lowercase');
    assert(/^[a-f0-9]{40}$/.test(hash), 'Invalid digest');
    assert.notEqual(original[path], hash, 'Required change missing: '+path);
  }
  return {...original, ...overlays};
}
export function assertPreserved(original, actual, overlays) {
  assert.deepEqual(actual, assembleFiles(original, overlays), 'Complete production inventory differs');
}
