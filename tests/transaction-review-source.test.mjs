import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = [
  '../dapp/victory-center.js', '../dapp/earn-transactions.js', '../dapp/earn-v3-zap.js', '../dapp/limit-orders.js', '../dapp/v3-transactions.js',
  '../scripts/canopy-draw.js', '../scripts/tree-knowledge-trial.js',
];
for (const path of paths) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /confirmTransaction/); assert.doesNotMatch(source, /window\.confirm/);
}
const component = await readFile(new URL('../dapp/transaction-review.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../dapp/transaction-review.css', import.meta.url), 'utf8');
const markup = await readFile(new URL('../dapp/index.html', import.meta.url), 'utf8');
assert.match(component, /role.*dialog/); assert.match(component, /aria-modal/); assert.match(component, /Escape/); assert.match(component, /Continue to Wallet/);
assert.match(component, /transaction-review-preview/); assert.match(component, /Preview only/);
assert.match(component, /tree-command-logo-v2-512\.png/); assert.doesNotMatch(component, /tree-review-emblem', '🌳/);
assert.match(styles, /tree-review-overlay/); assert.match(styles, /linear-gradient/); assert.match(styles, /@media\(max-width:540px\)/);
assert.match(markup, /transaction-review\.css/);
console.log('TREE transaction review: PASS (branded, accessible, mobile, and native-confirm free)');
