import assert from 'node:assert/strict';
export const REPLACED_HASHES = {"/play/grove-chess/index.html": "1ddd2a69e42a66cca5e0d447a2a5058664e0a91b", "/play/grove-chess/app.js": "12b8515a78dae538f9ee3f15466b10eeefc0d9f7", "/scripts/arcade-grove-chess.js": "d79f929b96999cf84086a7bd6ed157ad6aa8bf98"};
export const ADDED_PATHS = ["/play/grove-chess/finish-access.js", "/play/grove-chess/finishes.js", "/play/grove-chess/finishes.css", "/play/grove-chess/play-access.js", "/play/grove-chess/holder-session.js"];
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
