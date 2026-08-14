import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dapp/v3-transactions.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../dapp/v3-transaction-core.js', import.meta.url), 'utf8');
assert.match(source, /PREVIEW_HOST_PATTERN/);
assert.match(source, /Native V3 position execution is disabled on production/);
assert.match(source, /preliminarySimulation/);
assert.match(source, /finalSimulation/);
assert.ok(source.indexOf('finalSimulation') < source.indexOf('signAndExecute(finalTx)'));
assert.match(source, /window\.confirm/);
assert.match(source, /waitForFinality/);
assert.match(core, /::liquidity::open_position/);
assert.match(core, /::liquidity::add_liquidity/);
assert.match(core, /assertAllowedV3Transaction/);
assert.doesNotMatch(core, /::liquidity::remove_liquidity/);
assert.doesNotMatch(core, /::collect::/);
console.log('V3 transaction source safeguards passed.');
