import assert from 'node:assert/strict';
export const REPLACED_HASHES = {'/scripts/arcade-organization.js':'f40f684f5193e5da1e6aeac59615a3529c241f2f'};
export const ADDED_PATHS = [
  "/play/grove-chess/app.js",
  "/play/grove-chess/assets/tree-crest-pawn.png",
  "/play/grove-chess/assets/tree-hero.webp",
  "/play/grove-chess/assets/tree-logo.webp",
  "/play/grove-chess/assets/woodland-court.png",
  "/play/grove-chess/index.html",
  "/play/grove-chess/style.css",
  "/play/grove-chess/vendor/LICENSE-chess.js",
  "/play/grove-chess/vendor/chess.js",
  "/scripts/arcade-grove-chess.js"
];
export const DELIVERY_PATHS = [...Object.keys(REPLACED_HASHES),...ADDED_PATHS];
export function assembleFiles(original, overlays) {
  assert.deepEqual(Object.keys(overlays).sort(), [...DELIVERY_PATHS].sort(), 'Exact Grove Chess allowlist required');
  for (const [path, hash] of Object.entries(REPLACED_HASHES)) assert.equal(original[path], hash, 'Reviewed replacement baseline changed: '+path);
  for (const path of ADDED_PATHS) assert(!Object.hasOwn(original, path), 'New Grove Chess path already exists: '+path);
  for (const [path, hash] of Object.entries(overlays)) {
    assert(/^[a-f0-9]{40}$/.test(hash), 'Invalid digest');
    assert.notEqual(original[path], hash, 'Required change missing: '+path);
  }
  return {...original, ...overlays};
}
export function assertPreserved(original, actual, overlays) {
  assert.deepEqual(actual, assembleFiles(original, overlays), 'Complete production inventory differs');
}
