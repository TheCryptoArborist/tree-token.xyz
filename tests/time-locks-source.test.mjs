import assert from 'node:assert/strict';
import fs from 'node:fs';

const markup = fs.readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../dapp/app.js', import.meta.url), 'utf8');
const snapshot = JSON.parse(fs.readFileSync(new URL('../data/tree-project-snapshot.json', import.meta.url), 'utf8'));

assert.equal(markup.includes('Time-Locked TREE'), true);
assert.equal(markup.includes('Wallet-linked time locks: Not yet verified'), true);
assert.equal(markup.includes('excluded from personal ranks'), true);
assert.equal(markup.includes('data-snapshot="tree.nextUnlock2027"'), true);
assert.equal(markup.includes('data-snapshot="tree.nextUnlock2028"'), true);
assert.equal(client.includes('data-derived="lockedPercent"'), true);
assert.equal(Number.isFinite(snapshot.tree.moonbagsLocked), true);
assert.equal(snapshot.tree.nextUnlock2027 + snapshot.tree.nextUnlock2028, snapshot.tree.moonbagsLocked);

console.log('Time-lock UI: PASS (dated aggregate, unlock schedule, and fail-closed personal ranking)');
