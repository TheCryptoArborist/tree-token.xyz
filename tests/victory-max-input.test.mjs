import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseAmount, VICTORY_DECIMALS } from '../dapp/earn-transactions-core.js';

// Exercise the actual UI listeners and rendering with a connected-wallet fixture.
// Network loading is stubbed; no transaction can be signed or submitted.
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    value: '', textContent: '', disabled: false, hidden: false, listeners: {},
    classList: { toggle() {} }, setAttribute() {}, getBoundingClientRect: () => ({ top: 0 }),
    addEventListener(event, handler) { this.listeners[event] = handler; },
  });
  return nodes.get(id);
}
const context = vm.createContext({
  parseAmount, VICTORY_DECIMALS, URLSearchParams,
  SuiGrpcClient: class {},
  location: { hostname: 'localhost', search: '' },
  window: { playerAddress: `0x${'1'.repeat(64)}`, addEventListener() {}, innerHeight: 900 },
  document: { readyState: 'loading', addEventListener() {}, getElementById: node, querySelectorAll: () => [] },
  queueMicrotask() {},
});
const source = readFileSync(new URL('../dapp/victory-center.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
  .replace(/^export \{ EXECUTION_ENABLED \};/m, '');
vm.runInContext(source + '\nload = async () => {}; scheduleReinvestQuote = () => {}; init();', context);
const run = (code) => vm.runInContext(code, context);
node('victoryLockTerm').value = '7';
node('victoryLockTerm').listeners.change();
assert.equal(run('state.lockDays'), 7);
for (const [raw, text] of [
  [312_508_861_869n, '312508.861869'],
  [616_934_117_238n, '616934.117238'],
  [1n, '0.000001'],
  [1_000_000_000n, '1000'],
  [9_007_199_254_740_993n, '9007199254.740993'],
]) {
  run(`state.victoryBalance = ${raw}n;`);
  node('victoryLockMax').listeners.click();
  assert.equal(node('victoryLockAmount').value, text);
  assert.equal(run('rawAmount()'), raw);
  assert.equal(node('victoryLockAction').disabled, false);
  assert.equal(node('victoryLockAction').textContent, 'Review VICTORY Lock');
  node('victoryReinvestMax').listeners.click();
  assert.equal(node('victoryReinvestAmount').value, text);
  assert.equal(run('reinvestRawAmount()'), raw);
}
run('state.victoryBalance = 0n;');
node('victoryLockMax').listeners.click();
assert.equal(node('victoryLockAction').disabled, true);
assert.equal(node('victoryLockAction').textContent, 'Enter an amount');
assert.throws(() => parseAmount('312,508.861869', 6, 'VICTORY'));
console.log('VICTORY MAX: exact lock/reinvest inputs and seven-day lock button state pass.');
