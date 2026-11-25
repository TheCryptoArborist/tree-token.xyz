import assert from 'node:assert/strict';
export const REPLACED_HASHES = {"/play/grove-chess/index.html": "b49e7ba76bc41786d7715d59066e0988ee8f320f", "/play/grove-chess/app.js": "963ce8a4bd4e9015ffc1700bdb30999a8ab94c23", "/play/grove-chess/finishes.js": "0b61f1f3dd68ecd86cafc366b0a3e9315fc9455d", "/play/grove-chess/finish-access.js": "32790a070a3cc839f558cc91abc67f78cde1fef9", "/play/grove-chess/play-access.js": "7b97b8675c5b359bb577691c5f02b29c23d71ea8", "/play/grove-chess/finishes.css": "ee7a102b7a995f19910b6a7c428da8636cf7d505"};
export const ADDED_PATHS = ["/play/grove-chess/assets/finishes/common.svg", "/play/grove-chess/assets/finishes/rare.svg", "/play/grove-chess/assets/finishes/epic.svg", "/play/grove-chess/assets/finishes/legendary.svg", "/play/grove-chess/assets/finishes/mythic.svg", "/play/grove-chess/assets/finishes/one-of-one.svg"];
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
