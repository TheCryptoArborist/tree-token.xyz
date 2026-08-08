import assert from 'node:assert/strict';

const elements = new Map();
function element(id = '') {
  if (!elements.has(id)) elements.set(id, {
    id, textContent: '', className: '', innerHTML: '', hidden: false, dataset: {},
    append() {}, replaceChildren(...children) { this.children = children; }, addEventListener() {},
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
const refreshStatus = { state: 'running', pagesScanned: 25, objectsScanned: 1250, uniqueAddressOwners: 300, excludedAddresses: 5, reachedEnd: false };
const fixtureEntry = { rank: 1, wallet: window.playerAddress, directTree: '1234.567890123', supplyPercent: '0.000123456', tier: 'Ancient Grove' };

renderLeaderboard({ status: 'not-ready', provider: 'sui-graphql-snapshot', refreshState: 'idle', refreshStatus: null, entries: [fixtureEntry], displayedCount: 1, warnings: [] });
assert.equal(element('yourRank').textContent, 'A verified leaderboard snapshot is not available yet.');
assert.match(element('leaderboardRows').innerHTML, /complete verified/);

renderLeaderboard({ status: 'refreshing', provider: 'sui-graphql-snapshot', refreshState: 'running', refreshStatus, entries: [fixtureEntry], displayedCount: 0, warnings: [] });
assert.equal(element('yourRank').textContent, 'The first verified leaderboard snapshot is being built.');
assert.match(element('leaderboardRows').innerHTML, /No partial ranks/);
assert.equal(element('displayedWalletCount').textContent, '0');

const completePayload = {
  provider: 'sui-graphql-snapshot', generatedAt: null, snapshotGeneratedAt: '2026-08-05T00:00:00.000Z', snapshotAgeMs: 1000,
  refreshState: 'idle', refreshStatus: null, coverage: { pagesScanned: 100, objectsScanned: 5000, reachedEnd: true },
  reconciliation: { valid: true, addressOwnedTree: '1234.567890123' }, holderCount: 1, displayedCount: 1,
  excludedCount: 0, entries: [fixtureEntry], warnings: [], message: 'verified',
};
renderLeaderboard({ ...completePayload, status: 'stale' });
assert.equal(element('yourRank').textContent, '#1 · Ancient Grove · Last verified snapshot');
renderLeaderboard({ ...completePayload, status: 'ok' });
assert.equal(element('yourRank').textContent, '#1 · Ancient Grove');
window.playerAddress = `0x${'b'.repeat(64)}`;
renderLeaderboard({ ...completePayload, status: 'ok' });
assert.equal(element('yourRank').textContent, 'Wallet is outside the displayed Top 50.');
renderLeaderboard({ status: 'error', provider: 'sui-graphql-snapshot', refreshState: 'error', refreshStatus: null, entries: [], displayedCount: 0, warnings: [] });
assert.equal(element('yourRank').textContent, 'Your rank is temporarily unavailable.');
console.log('Leaderboard UI status behavior: PASS (progress never renders as rankings)');
