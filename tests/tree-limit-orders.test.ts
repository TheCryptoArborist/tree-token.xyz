import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE_LIMIT_AFTERMATH_PACKAGE, TREE_LIMIT_SUI_TYPE, TREE_LIMIT_TREE_TYPE,
  assertAllowedTreeLimitTransaction, assertTreeLimitAccountProof, assertTreeLimitCancelProof,
  isTreeLimitOrder, validateTreeLimitCreate,
} from '../netlify/lib/tree-limit-orders.ts';

const owner = `0x${'1'.repeat(64)}`;
const orderId = `0x${'2'.repeat(64)}`;
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

test('server create validation derives exact TREE/SUI types and exchange rate', () => {
  const buy = validateTreeLimitCreate({ walletAddress: owner, direction: 'buy-tree', allocateCoinAmount: '10000000000', targetPriceSuiPerTree: '0.000025', expiryDurationMs: 86_400_000 });
  assert.equal(buy.allocateCoinType, TREE_LIMIT_SUI_TYPE);
  assert.equal(buy.buyCoinType, TREE_LIMIT_TREE_TYPE);
  assert.equal(buy.outputToInputExchangeRate, 0.000025);
  assert.throws(() => validateTreeLimitCreate({ walletAddress: owner, direction: 'buy-tree', allocateCoinAmount: '10000000000', targetPriceSuiPerTree: '0.000025', expiryDurationMs: 123 }), /expiration/);
});

test('server allowlist rejects extra commands and non-TREE calls', () => {
  const expected = validateTreeLimitCreate({ walletAddress: owner, direction: 'sell-tree', allocateCoinAmount: '1000000', targetPriceSuiPerTree: '0.00004', expiryDurationMs: 3_600_000 });
  const commands = [
    { $kind: 'SplitCoins', SplitCoins: { coin: { $kind: 'GasCoin' }, amounts: [{}] } },
    { $kind: 'SplitCoins', SplitCoins: { coin: { $kind: 'GasCoin' }, amounts: [{}] } },
    { $kind: 'MoveCall', MoveCall: { package: TREE_LIMIT_AFTERMATH_PACKAGE, module: 'order', function: 'create_order_with_integrator_fee', typeArguments: [TREE_LIMIT_TREE_TYPE, TREE_LIMIT_SUI_TYPE] } },
  ];
  assert.equal(assertAllowedTreeLimitTransaction({ getData: () => ({ commands }) }, expected), true);
  assert.throws(() => assertAllowedTreeLimitTransaction({ getData: () => ({ commands: [...commands, {}] }) }, expected), /count/);
});

test('wallet proofs are exact and cancellation is bound to its order', () => {
  assert.equal(assertTreeLimitAccountProof(bytes({ action: 'CREATE_USER_ACCOUNT' })), true);
  assert.throws(() => assertTreeLimitAccountProof(bytes({ action: 'CREATE_USER_ACCOUNT', extra: true })), /invalid/);
  assert.equal(assertTreeLimitCancelProof(bytes({ action: 'CANCEL_LIMIT_ORDERS', order_object_ids: [orderId] }), orderId), true);
  assert.throws(() => assertTreeLimitCancelProof(bytes({ action: 'CANCEL_LIMIT_ORDERS', order_object_ids: ['0x3'] }), orderId), /does not match/);
});

test('only SUI/TREE orders pass response filtering', () => {
  assert.equal(isTreeLimitOrder({ allocatedCoin: { coin: TREE_LIMIT_SUI_TYPE }, buyCoin: { coin: TREE_LIMIT_TREE_TYPE } }), true);
  assert.equal(isTreeLimitOrder({ allocatedCoin: { coin: TREE_LIMIT_SUI_TYPE }, buyCoin: { coin: '0x2::coin::OTHER' } }), false);
});
