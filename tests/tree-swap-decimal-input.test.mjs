import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('dapp/swap-router.js', 'utf8');
const start = source.indexOf('function parseBaseUnits(value, decimals) {');
const end = source.indexOf('\n\nfunction formatBaseUnits', start);
assert.notEqual(start, -1, 'parseBaseUnits was not found');
assert.notEqual(end, -1, 'parseBaseUnits boundary was not found');
const implementation = source.slice(start, end);
const sandbox = {
  outputs: null,
  stateTokenIn: () => '0x2::sui::SUI',
  symbolFor: () => 'SUI',
};
vm.runInNewContext(`${implementation}
outputs = [
  parseBaseUnits('.1', 9),
  parseBaseUnits('0.1', 9),
  parseBaseUnits('.000001', 6),
  parseBaseUnits('1', 9),
];`, sandbox);
assert.equal(sandbox.outputs[0], 100_000_000n);
assert.equal(sandbox.outputs[1], 100_000_000n);
assert.equal(sandbox.outputs[2], 1n);
assert.equal(sandbox.outputs[3], 1_000_000_000n);
console.log('TREE leading-decimal swap input: PASS (.1 equals 0.1)');
