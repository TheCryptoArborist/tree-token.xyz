import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../scripts/tree-knowledge-trial.js', import.meta.url), 'utf8');

test('Challenge claim UI displays the immutable recorded award instead of a hard-coded prize', () => {
  assert.match(script, /function awardPrizeLabel\(award\)/);
  assert.match(script, /Claim \$\{awardPrizeLabel\(award\)\}/);
  assert.match(script, /Claim your \$\{prizeLabel\} Knowledge Trial prize/);
  assert.match(script, /\$\{prizeLabel\} claimed successfully/);
  assert.doesNotMatch(script, /Claim 50,000 TREE/);
  assert.doesNotMatch(script, /Claim your 50,000 TREE Knowledge Trial prize/);
});

test('Challenge claim simulation passes the Transaction instance to the wallet flow', () => {
  assert.match(script, /simulateTransaction\(\{\s*transaction,/);
  assert.doesNotMatch(script, /transaction\.build\(\{ client \}\)/);
  assert.match(script, /signAndExecuteTransactionBlock\(transaction\)/);
});
