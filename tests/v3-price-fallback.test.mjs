import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
globalThis.window = {};
globalThis.document = { readyState: 'loading', addEventListener() {} };

const { rememberPositionPrices, restorePositionUsd } = await import('../dapp/v3-workspace.js');

rememberPositionPrices({
  market: { suiUsd: 1, treeUsd: 0.01, btcUsd: 50_000 },
  analytics: { rewards: [{ symbol: 'VICTORY', priceUsd: 0.1 }] },
});

const restored = restorePositionUsd({
  principalSui: '2', principalTree: '100', principalSuiUsd: null, principalTreeUsd: null, valueUsd: null,
  pendingFeeSui: '0.5', pendingFeeTree: '10', pendingFeesUsd: null,
  rewards: [
    { symbol: 'VICTORY', amount: '4', priceUsd: null, valueUsd: null },
    { symbol: 'TREE', amount: '20', priceUsd: null, valueUsd: null },
    { symbol: 'wBTC', amount: '0.001', priceUsd: null, valueUsd: null },
  ],
});

assert.equal(restored.principalSuiUsd, 2);
assert.equal(restored.principalTreeUsd, 1);
assert.equal(restored.valueUsd, 3);
assert.equal(restored.pendingFeesUsd, 0.6);
assert.equal(restored.rewards[0].valueUsd, 0.4);
assert.equal(restored.rewards[1].valueUsd, 0.2);
assert.equal(restored.rewards[2].valueUsd, 50);

const alreadyVerified = restorePositionUsd({
  principalSui: '2', principalTree: '100', principalSuiUsd: 9, principalTreeUsd: 8, valueUsd: 17,
  pendingFeeSui: '0.5', pendingFeeTree: '10', pendingFeesUsd: 7, rewards: [],
});
assert.equal(alreadyVerified.pendingFeesUsd, 7);

console.log('TREE V3 verified USD fallback cache passed.');
