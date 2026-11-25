import assert from 'node:assert/strict';
export const REPLACED_HASHES = {"/play/grove-chess/index.html": "5218ffcc1de01b36a24575885a857ba23e87d8ad", "/play/grove-chess/app.js": "d8650721e1d38156a30fa2179648ac7de873e809", "/play/grove-chess/online.js": "23470c85e7e7d67f8dacd55102aa6af7ba8f58de", "/play/grove-chess/style.css": "f7017de72815c0e0d9b4477ac0d7a9733ed3d726", "/play/grove-chess/finishes.css": "70437ee0be4f4d5647b808739dde3313215b3989"};
export const ADDED_PATHS = ["/play/grove-chess/records.js", "/play/grove-chess/badges.js", "/play/grove-chess/assets/badges/ancient-oak.svg", "/play/grove-chess/assets/badges/crown-keeper.svg", "/play/grove-chess/assets/badges/first-roots.svg", "/play/grove-chess/assets/badges/grove-guardian.svg", "/play/grove-chess/assets/badges/hidden-root.svg", "/play/grove-chess/assets/badges/new-growth.svg", "/play/grove-chess/assets/badges/rare-bloom.svg", "/play/grove-chess/assets/badges/root-fortress.svg", "/play/grove-chess/assets/badges/sapling-victor.svg", "/play/grove-chess/assets/badges/twin-canopies.svg"];
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
