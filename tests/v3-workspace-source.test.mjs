import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../dapp/v3-workspace.js', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../dapp/panel-router.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../netlify/functions/tree-v3.ts', import.meta.url), 'utf8');

for (const tab of ['pools', 'positions', 'swap']) {
  assert.match(source, new RegExp(`data-v3-tab=\\"${tab}\\"`));
  assert.match(source, new RegExp(`data-v3-panel=\\"${tab}\\"`));
}
assert.match(source, /Pools \| My Positions \| Swap|V3 workspace navigation/);
assert.match(source, /Position transaction builder under verification/);
assert.match(source, /Create, increase, remove, collect, claim, and close actions stay disabled/);
assert.match(source, /type=\"button\" disabled>Increase/);
assert.match(source, /type=\"button\" disabled>Remove/);
assert.match(source, /type=\"button\" disabled>Collect Fees/);
assert.match(source, /type=\"button\" disabled>Claim Rewards/);
assert.match(source, /type=\"button\" disabled>Close/);
assert.match(source, /location\.hash = '#swap'/);
assert.match(source, /TREE_V3_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf'/);
assert.match(router, /^import '\.\/v3-workspace\.js';/);
assert.match(api, /transactionMode: 'read-only'/);
assert.doesNotMatch(api, /signAndExecute|moveCall|executeTransaction/);
assert.doesNotMatch(source, /window\.signAndExecuteTransactionBlock/);

console.log('TREE V3 workspace source: PASS (single V3 subpanels, exact pool, native swap routing, read-only transaction boundary)');
