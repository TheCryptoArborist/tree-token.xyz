import assert from 'node:assert/strict';
// Prototype 0.7: free battlefield movement replaces only gameplay HTML.
export const REPLACED_HASHES = {
  '/play/tree-army/test/index.html': '45944529735c0ededba1fae1e8a46cd1531c1263',
};
export const ADDED_PATHS = [];
export const DELIVERY_PATHS = [...Object.keys(REPLACED_HASHES), ...ADDED_PATHS];
// Preview builds also need assets already present in production. Keep this
// catalog independent of the smaller, one-time publication allowlist.
export const PREVIEW_PATHS = [
  '/play/tree-army/test/index.html',
  '/play/tree-army/test/assets/grove-battlefield.webp',
  '/play/tree-army/test/assets/forest-army.webp',
  '/play/tree-army/test/assets/tree-hero.webp',
  '/play/tree-army/test/assets/forest-walk.webp',
  '/play/tree-army/preview-gameplay.mp4',
  '/play/tree-army/preview-gameplay.webm',
  '/play/tree-army/preview-gameplay.jpg',
  '/scripts/arcade-tree-army.js',
  '/styles/arcade-tree-army.css',
];
export function assembleFiles(original, overlays) {
  assert.deepEqual(Object.keys(overlays).sort(), [...DELIVERY_PATHS].sort(), 'Exact Tree Army allowlist required');
  for (const [path, hash] of Object.entries(REPLACED_HASHES)) assert.equal(original[path], hash, 'Reviewed replacement baseline changed: '+path);
  for (const path of ADDED_PATHS) assert(!Object.hasOwn(original, path), 'New Tree Army path already exists: '+path);
  for (const [path, hash] of Object.entries(overlays)) {
    assert(/^[a-f0-9]{40}$/.test(hash), 'Invalid digest');
    assert.notEqual(original[path], hash, 'Required change missing: '+path);
  }
  return {...original, ...overlays};
}
export function assertPreserved(original, actual, overlays) {
  assert.deepEqual(actual, assembleFiles(original, overlays), 'Complete production inventory differs');
}
