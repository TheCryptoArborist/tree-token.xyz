import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const endpoint = readFileSync(new URL('../netlify/functions/tree-v3-overview.ts', import.meta.url), 'utf8');
const core = readFileSync(new URL('../netlify/lib/tree-v3-overview.ts', import.meta.url), 'utf8');

assert.ok(endpoint.includes('address(address: $owner)'));
assert.ok(endpoint.includes('address(address: $address)'));
assert.ok(endpoint.includes('dynamicFields(first: 50)'));
assert.ok(endpoint.includes('valueTreeV3Position'));
assert.ok(endpoint.includes('positionResult.coverage.scanComplete ? positionValues : []'));
assert.ok(core.includes('amountsForLiquidityQ64'));
assert.ok(core.includes('growthInsideQ64'));
assert.ok(core.includes('pendingFeesUsd'));
assert.ok(core.includes('rewardGrowthGlobalRaw'));
assert.ok(core.includes("accountingStatus: 'unavailable'"));
assert.ok(core.includes("accountingStatus: 'verified'"));

console.log('TREE V3 position valuation source safeguards passed.');
