import assert from 'node:assert/strict';
export const REPLACED_HASHES = {"/play/grove-chess/index.html": "7a477a627c8ac0f455c3ffa96d637541be083442", "/play/grove-chess/app.js": "e5a0974ccab34ac20e71ceeee9b08331320accd2", "/play/grove-chess/style.css": "939535f97ee4f9aa285d90c6a6208483af292a00"};
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
