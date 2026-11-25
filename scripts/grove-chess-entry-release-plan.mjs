import assert from 'node:assert/strict';
export const REPLACED_HASHES = {"/play/grove-chess/app.js": "d68ebc3969c668bc8a461eced0659b1f45bf5854", "/play/grove-chess/finish-access.js": "63d7c47eaa171bc700343ae3723f8a7b8bdd8c4f", "/play/grove-chess/finishes.js": "8506cdfabd3cdde6f397b8131761a545c697e313", "/play/grove-chess/finishes.css": "b81834cdcc1f373d9fd11b1da01e48862fa4d6f0"};
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
