import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewRocketXDeposit, reviewRocketXStatus, prepareRocketXOrder, reviewRocketXOrderPair } from '../netlify/lib/gateway-rocketx-review.ts';
// Synthetic offline fixtures, not real orders or proof of provider execution.
const binding = { requestId: '11111111-1111-4111-8111-111111111111', chain: 'bsc' as const, amount: '0.1', sourceAddress: '0x' + '1'.repeat(40), destinationAddress: '0x' + '2'.repeat(64), exchangeId: 1, fromTokenId: 2, toTokenId: 3, platformFeePercent: 0.4 };
function fixture() { return {
  requestId: binding.requestId, destinationAddress: binding.destinationAddress,
  exchangeInfo: { id: 1, walletLess: true, exchange_type: 'CEX', memoRequired: false },
  fromTokenInfo: { id: 2, chainId: '0x38', token_decimals: 18, token_symbol: 'BNB', contract_address: '0x' + 'e'.repeat(40) },
  toTokenInfo: { id: 3, chainId: 'sui-mainnet', token_decimals: 9, token_symbol: 'SUI', contract_address: '0x2' },
  swap: { fromAmount: '0.1', partnerFee: 0.4, depositAddress: '0x' + '3'.repeat(40), tx: { from: binding.sourceAddress, to: '0x' + '3'.repeat(40), data: null, memo: null, value: '0x16345785d8a0000' } },
  status: 'pending', subState: 'pending', originTokenAmount: '0.1', destinationTransactionHash: 'A'.repeat(44),
}; }
test('offline deposit review checks fees, bindings and a plain exact native payment; never enables execution', () => {
  assert.equal(reviewRocketXDeposit(fixture(), binding).executionEnabled, false);
  for (const change of [
    q => q.swap.partnerFee = 0.6, q => q.swap.partnerFee = null,
    q => q.destinationAddress = '0x' + '4'.repeat(64), q => delete q.destinationAddress,
    q => q.requestId = 'wrong', q => q.exchangeInfo.id = 2,
    q => q.fromTokenInfo.chainId = '0x1237', q => q.toTokenInfo.contract_address = '0x3',
    q => q.swap.fromAmount = '0.2', q => q.swap.tx.value = '0x1',
    q => q.swap.tx.to = binding.sourceAddress, q => q.swap.tx.data = '0x1234',
    q => q.swap.tx.memo = 'required', q => q.exchangeInfo.walletLess = false,
  ]) { const q = fixture(); change(q); assert.throws(() => reviewRocketXDeposit(q, binding)); }
});
test('status mapping preserves progress without claiming delivery or refund', () => {
  for (const subState of ['transaction_pending', 'pending', 'approved', 'executed', 'withdrawal', 'withdraw_success']) {
    const q = fixture(); q.subState = subState;
    const result = reviewRocketXStatus(q, binding);
    assert.notEqual(result.phase, 'unknown'); assert.equal(result.deliveryVerified, false); assert.equal(result.refundVerified, false);
  }
  const q = fixture(); q.status = 'success'; q.subState = 'withdraw_success';
  assert.equal(reviewRocketXStatus(q, binding).phase, 'receipt-pending');
  q.destinationTransactionHash = ''; assert.equal(reviewRocketXStatus(q, binding).phase, 'unknown');
});
test('failed, timed-out, unknown and inconsistent statuses never invite another payment', () => {
  for (const [status, subState, expected] of [['failed', 'withdraw_success', 'needs-help'], ['pending', 'invalid', 'needs-help'], ['refunded', 'refunded', 'unknown'], ['success', 'approved', 'unknown'], ['pending', 'new-state', 'unknown']]) {
    const q = fixture(); q.status = status; q.subState = subState;
    const r = reviewRocketXStatus(q, binding); assert.equal(r.phase, expected); assert.equal(r.refundVerified, false); assert.equal(r.deliveryVerified, false);
  }
});
test('statuses for other orders, receivers, amounts or assets are rejected', () => {
  for (const change of [q => q.requestId = 'wrong', q => q.destinationAddress = binding.sourceAddress, q => q.originTokenAmount = '0.2', q => q.toTokenInfo.chainId = '0x38', q => q.exchangeInfo.id = 99]) {
    const q = fixture(); change(q); assert.throws(() => reviewRocketXStatus(q, binding));
  }
});

test('order preparation preserves the exact reviewed fee and explicit recipient; does not create an order', () => {
  const quote = { ...fixture(), fromAmount: '0.1', toAmount: '60', isTxnAllowed: true, platformFeeInPercent: 0.4 };
  quote.exchangeInfo.isRefundAddressRequired = true;
  const input = { ...binding, fetchedAt: 1000, refundAddress: binding.sourceAddress };
  const prepared = prepareRocketXOrder(quote, input, 2000);
  assert.deepEqual(prepared, { fromTokenId: 2, toTokenId: 3, exchangeId: 1, amount: 0.1, fee: 0.4, userAddress: binding.sourceAddress, destinationAddress: binding.destinationAddress, refundAddress: binding.sourceAddress, refundMemo: '' });
  for (const change of [
    q => q.platformFeeInPercent = 0.6, q => q.fromAmount = '0.2', q => q.toAmount = null,
    q => q.exchangeInfo.id = 8, q => q.isTxnAllowed = false,
    q => q.exchangeInfo.fixedRate = true, q => q.exchangeInfo.memoRequired = true,
    q => delete q.exchangeInfo.isRefundAddressRequired,
    q => q.toTokenInfo.contract_address = '0x3',
  ]) { const q = structuredClone(quote); change(q); assert.throws(() => prepareRocketXOrder(q, input, 2000)); }
  for (const now of [999, 31000, NaN]) assert.throws(() => prepareRocketXOrder(quote, input, now));
  assert.throws(() => prepareRocketXOrder(quote, { ...input, refundAddress: '0x' + '5'.repeat(40) }, 2000));
  const exact = '0.100000000000000001';
  assert.throws(() => prepareRocketXOrder({ ...quote, fromAmount: exact }, { ...input, amount: exact }, 2000));
  quote.exchangeInfo.isRefundAddressRequired = false;
  assert.equal('refundAddress' in prepareRocketXOrder(quote, input, 2000), false);
});

test('a bound unfunded status can verify a missing creation recipient, never a conflicting recipient', () => {
  const order = fixture(); delete order.destinationAddress;
  const status = { ...fixture(), depositAddress: order.swap.depositAddress };
  assert.equal(reviewRocketXOrderPair(order, status, binding).executionEnabled, false);
  for (const change of [
    q => q.requestId = 'wrong', q => q.destinationAddress = '0x' + '4'.repeat(64),
    q => q.depositAddress = binding.sourceAddress, q => q.originTokenAmount = '0.2',
    q => q.subState = 'invalid', q => q.subState = 'approved',
  ]) { const q = structuredClone(status); change(q); assert.throws(() => reviewRocketXOrderPair(order, q, binding)); }
  order.destinationAddress = '0x' + '4'.repeat(64);
  assert.throws(() => reviewRocketXOrderPair(order, status, binding));
});
import { readFileSync } from 'node:fs';
test('observed pool response classification is accepted only for the reviewed BNB route and matching pair', () => {
  const load = () => JSON.parse(readFileSync(new URL('./fixtures/rocketx-unfunded-response-shape.json', import.meta.url), 'utf8'));
  const f = load();
  const result = reviewRocketXOrderPair(f.order, f.status, f.binding);
  assert.equal(result.checksPassed, true);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.providerClassification, 'rocketx-pool-response-alias');
  for (const mutate of [
    x => x.order.exchangeInfo.id = 21,
    x => x.order.exchangeInfo.keyword = 'Other',
    x => x.status.exchangeInfo.walletLess = false,
    x => x.status.exchangeInfo.fixedRate = true,
    x => delete x.status.exchangeInfo.isRefundAddressRequired,
    x => x.status.exchangeInfo.exchange_type = 'CEX',
    x => x.binding.chain = 'robinhood',
    x => x.binding.fromTokenId = 5,
    x => x.order.swap.tx.data = '0x1234',
    x => x.order.swap.tx.value = '0x1',
    x => x.order.swap.partnerFee = 0.6,
    x => x.status.destinationAddress = '0x' + '4'.repeat(64),
    x => x.status.depositAddress = '0x' + '5'.repeat(40),
    x => x.status.requestId = '22222222-2222-4222-8222-222222222222',
  ]) { const x = load(); mutate(x); assert.throws(() => reviewRocketXOrderPair(x.order, x.status, x.binding)); }
  const quote = { ...f.order, fromAmount: '0.1', toAmount: 60, isTxnAllowed: true, platformFeeInPercent: 0.4 };
  assert.throws(() => prepareRocketXOrder(quote, { ...f.binding, fetchedAt: 1000, refundAddress: f.binding.sourceAddress }, 2000), /Provider changed/);
});
