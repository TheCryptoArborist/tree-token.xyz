import assert from 'node:assert/strict';

const elements = new Map();
function element(id = '') {
  if (!elements.has(id)) elements.set(id, {
    id,
    textContent: '',
    className: '',
    innerHTML: '',
    hidden: false,
    dataset: {},
    append() {},
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
  });
  return elements.get(id);
}
const { renderLeaderboard } = await import('../dapp/app.js');
globalThis.document = {
  getElementById: (id) => element(id),
  createElement: () => element(`created-${Math.random()}`),
  querySelectorAll: () => [],
};
globalThis.window = { playerAddress: `0x${'a'.repeat(64)}` };
const coverage = {
  scanComplete: false,
  pagesScanned: 1,
  objectsScanned: 50,
  addressOwnedCoinObjects: 50,
  objectOwnedObjectsSkipped: 0,
  sharedObjectsSkipped: 0,
  immutableObjectsSkipped: 0,
  consensusOwnedObjectsSkipped: 0,
  unknownOwnerObjectsSkipped: 0,
};
const fixtureEntry = {
  rank: 1,
  wallet: window.playerAddress,
  directTree: '1234.567890123',
  supplyPercent: '0.000123456',
  tier: 'Ancient Grove',
};

renderLeaderboard({
  status: 'verification-incomplete', provider: 'sui-graphql', generatedAt: null, snapshotGeneratedAt: null,
  coverage, refreshCoverage: coverage, reconciliation: { valid: true, addressOwnedTree: '1' },
  holderCount: null, displayedCount: 1, excludedCount: 0, entries: [fixtureEntry], warnings: [],
});
assert.equal(element('yourRank').textContent, 'Sui-native holder verification is incomplete.');
assert.match(element('leaderboardRows').innerHTML, /Partial ranks are not published/);

renderLeaderboard({
  status: 'stale', provider: 'sui-graphql-cached', generatedAt: null, snapshotGeneratedAt: '2026-08-05T00:00:00.000Z',
  coverage: { ...coverage, scanComplete: true, reachedEnd: true }, refreshCoverage: coverage,
  reconciliation: { valid: true, addressOwnedTree: '1234.567890123' }, holderCount: 1,
  displayedCount: 1, excludedCount: 0, entries: [fixtureEntry], warnings: ['Last complete snapshot'],
});
assert.equal(element('yourRank').textContent, '#1 · Ancient Grove · Last complete snapshot');

renderLeaderboard({
  status: 'ok', provider: 'sui-graphql', generatedAt: null, snapshotGeneratedAt: null,
  coverage: { ...coverage, scanComplete: true, reachedEnd: true }, refreshCoverage: null,
  reconciliation: { valid: true, addressOwnedTree: '1234.567890123' }, holderCount: 1,
  displayedCount: 1, excludedCount: 0, entries: [fixtureEntry], warnings: [],
});
assert.equal(element('yourRank').textContent, '#1 · Ancient Grove');
window.playerAddress = `0x${'b'.repeat(64)}`;
renderLeaderboard({
  status: 'ok', provider: 'sui-graphql', generatedAt: null, snapshotGeneratedAt: null,
  coverage: { ...coverage, scanComplete: true, reachedEnd: true }, refreshCoverage: null,
  reconciliation: { valid: true, addressOwnedTree: '1234.567890123' }, holderCount: 1,
  displayedCount: 1, excludedCount: 0, entries: [fixtureEntry], warnings: [],
});
assert.equal(element('yourRank').textContent, 'Wallet is outside the displayed Top 50.');

renderLeaderboard({
  status: 'error', provider: 'sui-graphql', generatedAt: null, snapshotGeneratedAt: null,
  coverage, refreshCoverage: coverage, reconciliation: { valid: true, addressOwnedTree: '1' },
  holderCount: null, displayedCount: 0, excludedCount: 0, entries: [], warnings: [],
});
assert.equal(element('yourRank').textContent, 'Your rank is temporarily unavailable.');
console.log('Leaderboard UI status behavior: PASS (partial ranks suppressed)');
