import assert from 'node:assert/strict';
import fs from 'node:fs';

const markup = fs.readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../dapp/app.js', import.meta.url), 'utf8');
const snapshot = JSON.parse(fs.readFileSync(new URL('../data/tree-project-snapshot.json', import.meta.url), 'utf8'));

assert.equal(markup.includes('Time-Locked TREE'), true);
assert.equal(markup.includes("They will not affect a wallet's Canopy rank"), true);
assert.equal(markup.includes('excluded from personal ranks'), true);
assert.equal(markup.includes('data-snapshot="tree.nextUnlock2027"'), true);
assert.equal(markup.includes('data-snapshot="tree.nextUnlock2028"'), true);
assert.equal(markup.includes('January 1, 2027 Unlock'), true);
assert.equal(markup.includes('January 1, 2028 Unlock'), true);
assert.equal(client.includes('data-derived="lockedPercent"'), true);
assert.equal(Number.isFinite(snapshot.tree.moonbagsLocked), true);
assert.equal(snapshot.tree.nextUnlock2027 + snapshot.tree.nextUnlock2028, snapshot.tree.moonbagsLocked);
assert.equal(snapshot.tree.nextUnlock2027Date, '2027-01-01T06:00:00.000Z');
assert.equal(snapshot.tree.nextUnlock2028Date, '2028-01-01T06:00:00.000Z');

console.log('Time-lock UI: PASS (dated aggregate, unlock schedule, and fail-closed personal ranking)');
