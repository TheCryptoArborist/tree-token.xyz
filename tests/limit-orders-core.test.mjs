import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMIT_AFTERMATH_PACKAGE, LIMIT_SUI_TYPE, LIMIT_TREE_TYPE, assertAllowedLimitTransaction,
  cancelLimitMessage, estimateLimitOutput, extractCreatedLimitOrder, isFavorableLimitTarget,
  limitDecimalToRaw, limitRawToDecimal, validateLimitBalanceChanges,
} from '../dapp/limit-orders-core.js';

const owner = `0x${'1'.repeat(64)}`;
const orderId = `0x${'2'.repeat(64)}`;
const plan = { walletAddress: owner, direction: 'buy-tree', allocateCoinAmount: '10000000000' };

function transaction(types = [LIMIT_SUI_TYPE, LIMIT_TREE_TYPE]) {
  return { getData: () => ({ commands: [
    { $kind: 'SplitCoins', SplitCoins: { coin: { $kind: 'GasCoin' }, amounts: [{}] } },
    { $kind: 'SplitCoins', SplitCoins: { coin: { $kind: 'GasCoin' }, amounts: [{}] } },
    { $kind: 'MoveCall', MoveCall: { package: LIMIT_AFTERMATH_PACKAGE, module: 'order', function: 'create_order_with_integrator_fee', typeArguments: types } },
  ] }) };
}

test('decimal conversion is exact and direction estimates are correct', () => {
  assert.equal(limitDecimalToRaw('10.25', 9), 10_250_000_000n);
  assert.equal(limitRawToDecimal(10_250_000_000n, 9), '10.25');
  assert.equal(estimateLimitOutput({ direction: 'buy-tree', amount: 10, targetPrice: 0.000025 }), 400000);
  assert.equal(estimateLimitOutput({ direction: 'sell-tree', amount: 400000, targetPrice: 0.000025 }), 10);
  assert.equal(isFavorableLimitTarget('buy-tree', 0.00002, 0.00003), true);
  assert.equal(isFavorableLimitTarget('sell-tree', 0.00002, 0.00003), false);
});

test('transaction allowlist accepts only the exact Aftermath SUI/TREE call', () => {
  assert.equal(assertAllowedLimitTransaction(transaction(), plan), true);
  assert.throws(() => assertAllowedLimitTransaction(transaction([LIMIT_TREE_TYPE, LIMIT_SUI_TYPE]), plan), /allowlisted/);
  const wrong = transaction(); wrong.getData().commands?.push?.({});
});

test('created event and owner balance debits must match the reviewed order', () => {
  const result = { Transaction: { effects: { status: { success: true } }, events: [{
    packageId: LIMIT_AFTERMATH_PACKAGE, sender: owner,
    eventType: `${LIMIT_AFTERMATH_PACKAGE}::events::Event<${LIMIT_AFTERMATH_PACKAGE}::events::CreatedOrderEventV1>`,
    json: { pos0: { order_id: orderId, user: owner, recipient: owner, input_amount: plan.allocateCoinAmount, gas_amount: '50000000', integrator_fee_bps: 0, integrator_fee_recipient: '0x0', input_type: btoa(LIMIT_SUI_TYPE), output_type: btoa(LIMIT_TREE_TYPE) } },
  }], balanceChanges: [{ address: owner, coinType: LIMIT_SUI_TYPE, amount: '-10053210680' }] } };
  assert.deepEqual(extractCreatedLimitOrder(result, plan), { orderId });
  assert.equal(validateLimitBalanceChanges(result, plan), true);
  result.Transaction.events[0].json.pos0.input_amount = '999';
  assert.equal(extractCreatedLimitOrder(result, plan), null);
});

test('cancellation message binds exactly one normalized order ID', () => {
  assert.deepEqual(cancelLimitMessage('0x2'), { action: 'CANCEL_LIMIT_ORDERS', order_object_ids: [`0x${'0'.repeat(63)}2`] });
});
