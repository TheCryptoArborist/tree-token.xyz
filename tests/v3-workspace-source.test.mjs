import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dapp/v3-workspace.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dapp/v3-workspace.css', import.meta.url), 'utf8');

for (const label of ['Pools', 'My Positions', 'Swap']) assert.ok(source.includes(`>${label}<`) || source.includes(`>${label}</button>`));
for (const action of ['Increase', 'Remove', 'Collect Fees', 'Claim Rewards', 'Close']) assert.ok(source.includes(`>${action}<`));
assert.ok(source.includes('data-v3-increase-position'));
assert.ok(source.includes('data-v3-remove-position'));
assert.ok(source.includes('V3_MANAGEMENT_ENABLED'));
assert.ok(source.includes('Simulate Increase'));
assert.ok(source.includes('Simulate Removal'));
assert.ok(source.includes('Removing') || source.includes('Liquidity to remove'));
assert.ok(source.includes('Position transaction builder in verification'));
assert.ok(source.includes("const V3_ENDPOINT = '/api/tree-v3-overview'"));
assert.ok(source.includes("pool?.poolId !== V3_POOL_ID"));
assert.ok(source.includes('Partial V3 position results are not displayed'));
assert.ok(source.includes('Rewards not verified'));
assert.ok(source.includes('24H Volume'));
assert.ok(source.includes('APR'));
assert.ok(!source.includes('target="_blank"'));
assert.ok(source.includes('window.playerAddress'));
assert.ok(source.includes("'tree:wallet-changed'"));
assert.ok(source.includes("value === null || value === undefined || value === ''"));
assert.ok(css.includes('.v3-tabs'));
assert.ok(css.includes('@media(max-width:390px)'));

console.log('Native TREE V3 workspace source safeguards passed.');
