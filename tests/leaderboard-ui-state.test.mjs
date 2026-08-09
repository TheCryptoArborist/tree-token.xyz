import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const elements = new Map();
function element(id = '') {
  if (!elements.has(id)) elements.set(id, {
    id, textContent: '', className: '', innerHTML: '', hidden: false, dataset: {},
    append() {}, replaceChildren(...children) { this.children = children; }, addEventListener() {},
  });
  return elements.get(id);
}
const { TIER_DEFINITIONS, badgeDefinition, displayNameForEntry, entryIsExposure, formatSupplyPercentFromRaw, normalizeLeaderboardEntry, renderLeaderboard, tierForEntry } = await import('../dapp/app.js');
globalThis.document = {
  getElementById: (id) => element(id),
  createElement: () => element(`created-${Math.random()}`),
  querySelectorAll: () => [],
};
globalThis.window = { playerAddress: `0x${'a'.repeat(64)}` };
const refreshStatus = { state: 'running', pagesScanned: 25, objectsScanned: 1250, uniqueAddressOwners: 300, excludedCoinObjects: 5, excludedUniqueOwners: 2, excludedAddresses: 5, reachedEnd: false };
const fixtureEntry = { rank: 1, wallet: window.playerAddress, directTree: '1234.56789', supplyPercent: '0.000123456', tier: 'Ancient Grove' };

assert.equal(TIER_DEFINITIONS.length, 13);
assert.equal(tierForEntry({ rank: 1, directTree: '1' }).name, 'Champion Tree');
assert.equal(displayNameForEntry({ wallet: `0x${'c'.repeat(64)}`, suinsName: 'cryptoarborist.sui' }), 'cryptoarborist.sui');
assert.match(displayNameForEntry({ wallet: `0x${'c'.repeat(64)}`, suinsName: null }), /^0x/);
const exposureEntry = normalizeLeaderboardEntry({
  rank: 6, wallet: `0x${'d'.repeat(64)}`, suinsName: 'treeholder.sui',
  liquidTreeRaw: '4000000000000', liquidTree: '4000000', lpTreeRaw: '6000000000000', lpTree: '6000000',
  totalExposureRaw: '10000000000000', totalExposure: '10000000', supplyPercent: '1',
  liquidCoinObjectCount: 3, lpPositionCount: 2,
  lpBreakdown: { suiDexV2Raw: '1000000000000', suiDexV2: '1000000', suiDexV3Raw: '4500000000000', suiDexV3: '4500000', turbosRaw: '500000000000', turbos: '500000' },
  badges: ['lp-provider', 'lp-maxi'],
});
assert.equal(entryIsExposure(exposureEntry), true);
assert.equal(exposureEntry.directTree, '10000000');
assert.equal(exposureEntry.directTreeRaw, '10000000000000');
assert.equal(tierForEntry(exposureEntry).name, 'Giant Sequoia');
assert.equal(badgeDefinition('lp-provider').label, 'LP Provider');
assert.equal(badgeDefinition('lp-maxi').label, 'LP Maxi');
assert.equal(badgeDefinition('burned').label, 'Burned');
const tierCases = [
  ['50000000', 'Ancient Grove'], ['25000000', 'Redwood Royalty'], ['10000000', 'Giant Sequoia'],
  ['5000000', 'Forest Titan'], ['2500000', 'Canopy Guardian'], ['1000000', 'Heritage Oak'],
  ['500000', 'Forest Keeper'], ['250000', 'TREE-mendous'], ['100000', 'Branch Manager'],
  ['50000', 'Deep Roots'], ['10000', 'Sapling'], ['0', 'Seedling'],
];
tierCases.forEach(([directTree, expected]) => assert.equal(tierForEntry({ rank: 6, directTree }).name, expected));
assert.equal(formatSupplyPercentFromRaw(50_000_000n * 1_000_000n), '5%');
assert.equal(formatSupplyPercentFromRaw(25_000_000n * 1_000_000n), '2.5%');
assert.equal(formatSupplyPercentFromRaw(2_500_000n * 1_000_000n), '0.25%');
assert.equal(formatSupplyPercentFromRaw(250_000n * 1_000_000n), '0.025%');
assert.equal(formatSupplyPercentFromRaw(10_000n * 1_000_000n), '0.001%');

renderLeaderboard({ status: 'not-ready', provider: 'sui-graphql-snapshot', refreshState: 'idle', refreshStatus: null, entries: [fixtureEntry], displayedCount: 1, warnings: [] });
assert.equal(element('yourRank').textContent, 'A verified leaderboard snapshot is not available yet.');
assert.match(element('leaderboardRows').innerHTML, /complete verified/);

renderLeaderboard({ status: 'refreshing', provider: 'sui-graphql-snapshot', refreshState: 'running', refreshStatus, entries: [fixtureEntry], displayedCount: 0, warnings: [] });
assert.equal(element('yourRank').textContent, 'The first verified leaderboard snapshot is being built.');
assert.match(element('leaderboardRows').innerHTML, /No partial ranks/);
assert.equal(element('displayedWalletCount').textContent, '0');

const completePayload = {
  provider: 'sui-graphql-snapshot', generatedAt: null, snapshotGeneratedAt: '2026-08-05T00:00:00.000Z', snapshotAgeMs: 1000,
  refreshState: 'idle', refreshStatus: null, coinDecimals: 6,
  coverage: { coinMetadataVerified: true, coinDecimals: 6, pagesScanned: 100, objectsScanned: 5000, reachedEnd: true },
  reconciliation: { valid: true, addressOwnedTree: '1234.56789' }, verifiedAddressOwners: 2, eligibleRankedOwners: 1, holderCount: 2, displayedCount: 1,
  excludedCoinObjects: 4, excludedUniqueOwners: 1, excludedCount: 4, entries: [fixtureEntry], warnings: [], message: 'verified',
};
renderLeaderboard({ ...completePayload, status: 'stale' });
assert.equal(element('yourRank').textContent, '#1 · Champion Tree · Last verified snapshot');
renderLeaderboard({ ...completePayload, status: 'ok' });
assert.equal(element('verifiedAddressOwnerCount').textContent, '2');
assert.equal(element('eligibleRankedOwnerCount').textContent, '1');
assert.equal(element('excludedCoinObjectCount').textContent, '4');
assert.equal(element('excludedUniqueOwnerCount').textContent, '1');
assert.equal(element('yourRank').textContent, '#1 · Champion Tree');
window.playerAddress = `0x${'b'.repeat(64)}`;
renderLeaderboard({ ...completePayload, status: 'ok' });
assert.equal(element('yourRank').textContent, 'Wallet is outside the displayed Top 50.');
renderLeaderboard({ status: 'error', provider: 'sui-graphql-snapshot', refreshState: 'error', refreshStatus: null, entries: [], displayedCount: 0, warnings: [] });
assert.equal(element('yourRank').textContent, 'Your rank is temporarily unavailable.');
const dappMarkup = await readFile('dapp/index.html', 'utf8');
assert.equal(dappMarkup.includes('>Holders<'), false);
assert.equal(dappMarkup.includes('Verified address owners'), true);
assert.equal(dappMarkup.includes('Eligible exposure owners'), true);
assert.equal(dappMarkup.includes('LP Provider badges'), true);
assert.equal(dappMarkup.includes('LP Maxi badges'), true);
assert.equal(dappMarkup.includes('fixed 1,000,000,000-token supply'), true);
assert.equal(dappMarkup.includes('Liquid TREE plus current principal TREE'), true);
console.log('Leaderboard UI status behavior: PASS (progress never renders as rankings)');
