import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewRocketXDeposit, reviewRocketXStatus } from '../netlify/lib/gateway-rocketx-review.ts';
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
