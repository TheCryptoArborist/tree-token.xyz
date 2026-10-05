// Offline contract checks only. No order creation, network calls, signing or public status lookup.
// A future backend must supply its persisted order binding, never a browser-asserted binding.
import { amountToRaw } from '../../gateway/options.js';

export type Binding = {
  requestId: string; chain: 'bsc' | 'robinhood'; amount: string;
  destinationAddress: string; sourceAddress: string; exchangeId: number;
  fromTokenId: number; toTokenId: number; platformFeePercent: number;
};
function requireCheck(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
function evm(address: unknown) { return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0+$/.test(address); }
function sui(address: unknown) { return typeof address === 'string' && /^0x[0-9a-fA-F]{64}$/.test(address) && !/^0x0+$/.test(address); }
function validateBinding(b: Binding) {
  requireCheck(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.requestId), 'Invalid order identity.');
  validateRoute(b);
}
function validateRoute(b: Omit<Binding, 'requestId'>) {
  requireCheck(['bsc', 'robinhood'].includes(b.chain) && evm(b.sourceAddress) && sui(b.destinationAddress), 'Invalid route binding.');
  requireCheck([b.exchangeId, b.fromTokenId, b.toTokenId].every(n => Number.isSafeInteger(n) && n > 0), 'Missing provider identity.');
  requireCheck(Number.isFinite(b.platformFeePercent) && b.platformFeePercent >= 0 && b.platformFeePercent <= 3, 'Invalid quoted fee.');
  amountToRaw(b.amount, 18);
}
// RocketX's documented ROCKETX_POOL quote is CEX, while its config and the
// observed BNB creation/status responses say DEX. This is a response-only,
// route-specific compatibility rule, never permission to execute a DEX call.
function knownPoolResponse(body: any, b: Omit<Binding, 'requestId'>) {
  const e = body?.exchangeInfo;
  return b.chain === 'bsc' && b.exchangeId === 20 && b.fromTokenId === 179769 && b.toTokenId === 179810
    && e?.id === 20 && e.keyword === 'RocketX' && e.exchange_type === 'DEX'
    && e.walletLess === true && e.fixedRate === false && e.isRefundAddressRequired === true;
}
function validateAssets(body: any, b: Omit<Binding, 'requestId'>, response = true) {
  const input = body?.fromTokenInfo, output = body?.toTokenInfo;
  requireCheck(input?.chainId === (b.chain === 'bsc' ? '0x38' : '0x1237') && input?.id === b.fromTokenId && input?.token_decimals === 18 && input?.token_symbol === (b.chain === 'bsc' ? 'BNB' : 'ETH') && /^(0x0{40}|0xe{40})$/i.test(input?.contract_address || ''), 'Source asset changed.');
  requireCheck(output?.chainId === 'sui-mainnet' && output?.id === b.toTokenId && output?.token_decimals === 9 && output?.token_symbol === 'SUI' && /^0x0*2(?:::sui::SUI)?$/.test(output?.contract_address || ''), 'Destination asset changed.');
  requireCheck(body?.exchangeInfo?.id === b.exchangeId && body.exchangeInfo.walletLess === true
    && (body.exchangeInfo.exchange_type === 'CEX' || (response && knownPoolResponse(body, b))), 'Provider changed.');
}

// This constructs data only. It does not send a request or create an order.
// fetchedAt must be recorded by the trusted caller when it received the quote.
export function prepareRocketXOrder(quote: any, b: Omit<Binding, 'requestId'> & { fetchedAt: number; refundAddress?: string }, now = Date.now()) {
  validateRoute(b); validateAssets(quote, b, false);
  requireCheck(Number.isFinite(now) && Number.isFinite(b.fetchedAt) && now >= b.fetchedAt && now - b.fetchedAt < 30_000, 'Refresh the quote before preparing an order.');
  requireCheck(!quote.err && !quote.error && (quote.isTxnAllowed === true || quote.isTxnAllowed === 1), 'Provider does not allow this quote.');
  requireCheck(quote.exchangeInfo.fixedRate !== true && !quote.rateId, 'Fixed-rate orders require separate review.');
  requireCheck(quote.exchangeInfo.memoRequired !== true, 'Memo route requires separate review.');
  requireCheck(amountToRaw(String(quote.fromAmount), 18) === amountToRaw(b.amount, 18), 'Quoted amount changed.');
  requireCheck(Number.isFinite(Number(quote.toAmount)) && Number(quote.toAmount) > 0, 'Missing destination estimate.');
  requireCheck(typeof quote.platformFeeInPercent === 'number' && Number.isFinite(quote.platformFeeInPercent) && Math.abs(quote.platformFeeInPercent - b.platformFeePercent) < 1e-10, 'Quoted fee changed.');
  const refundRequired = quote.exchangeInfo.isRefundAddressRequired;
  requireCheck(typeof refundRequired === 'boolean', 'Refund-address requirement is unknown.');
  if (refundRequired) requireCheck(evm(b.refundAddress) && b.refundAddress?.toLowerCase() === b.sourceAddress.toLowerCase(), 'Review the source wallet as the refund address.');
  // The API examples use a JSON number. Refuse any input it cannot represent exactly.
  const amount = Number(b.amount);
  requireCheck(amountToRaw(String(amount), 18) === amountToRaw(b.amount, 18), 'Amount cannot be represented exactly by the order API.');
  return {
    fromTokenId: b.fromTokenId, toTokenId: b.toTokenId, exchangeId: b.exchangeId,
    userAddress: b.sourceAddress, destinationAddress: b.destinationAddress,
    amount, fee: b.platformFeePercent,
    ...(refundRequired ? { refundAddress: b.refundAddress, refundMemo: '' } : {}),
  };
}

// Some creation responses omit the recipient. A matching status response may
// verify it; never accept an unrelated status or overwrite a conflicting echo.
export function reviewRocketXOrderPair(order: any, status: any, b: Binding) {
  if (knownPoolResponse(order, b) || knownPoolResponse(status, b)) {
    requireCheck(knownPoolResponse(order, b) && knownPoolResponse(status, b), 'Provider response classifications disagree.');
  }
  const progress = reviewRocketXStatus(status, b);
  requireCheck(['created', 'awaiting-deposit'].includes(progress.phase), 'Order is not awaiting its first payment.');
  requireCheck(evm(status.depositAddress) && status.depositAddress.toLowerCase() === order?.swap?.depositAddress?.toLowerCase(), 'Status deposit address differs from the order.');
  if (order.destinationAddress !== undefined) requireCheck(order.destinationAddress?.toLowerCase() === b.destinationAddress.toLowerCase(), 'Creation recipient conflicts with the reviewed recipient.');
  return { ...reviewRocketXDeposit({ ...order, destinationAddress: status.destinationAddress }, b),
    recovery: reviewRocketXRecovery(status, b),
    providerClassification: knownPoolResponse(order, b) ? 'rocketx-pool-response-alias' : 'CEX' };
}

// No documented response field currently proves the deposit deadline or refund
// address acceptance. expiresAt belongs to rateId, not the deposit. Neither a
// quote timer nor initiatedAt + the generic five-hour prose authorizes funding.
// This review is server/offline-only; it accepts a persisted binding, not input
// from the browser. It performs no lookup, refund request, or transaction.
export function reviewRocketXRecovery(status: any, b: Binding) {
  const progress = reviewRocketXStatus(status, b);
  const awaiting = ['created', 'awaiting-deposit'].includes(progress.phase);
  const needsHelp = progress.phase === 'needs-help';
  const unknown = progress.phase === 'unknown';
  return {
    phase: progress.phase,
    fundingReady: false, executionEnabled: false, refundVerified: false,
    depositDeadline: null, depositDeadlineVerified: false,
    refundAddressVerified: false, automaticRefundAvailable: false,
    canResend: false, canCreateReplacement: false,
    blockers: awaiting ? ['deposit-deadline-unverified', 'refund-handling-unverified'] : ['order-not-fundable'],
    action: needsHelp ? 'review-with-provider' : unknown ? 'reconcile-existing-order' : awaiting ? 'hold-payment' : 'track-existing-order',
    message: needsHelp
      ? 'Do not send or top up this order. Keep its order reference and any source transaction hash. Review recovery through RocketX Help; a refund is not confirmed.'
      : unknown ? 'Order status is uncertain. Reconcile the existing order before any new payment. Do not resend or create a replacement.'
      : awaiting ? 'Hold payment: the deposit deadline and refund handling are not verified. Quote expiry does not establish a deposit deadline. Do not reuse this deposit address.'
      : 'Track the existing transfer. Do not resend, top up or reuse the deposit address. Provider progress alone does not confirm delivery or a refund.',
    helpUrl: 'https://app.rocketx.exchange/',
  };
}

export function reviewRocketXDeposit(order: any, b: Binding) {
  validateBinding(b); validateAssets(order, b);
  requireCheck(order.requestId === b.requestId, 'Order identity changed.');
  // Require a recipient echo before trusting a deposit response. Documentation's sample
  // omits it; live/sandbox verification may need a bound status response before funding.
  requireCheck(order.destinationAddress?.toLowerCase() === b.destinationAddress.toLowerCase(), 'Receiving address is not verified.');
  const swap = order.swap;
  requireCheck(amountToRaw(String(swap?.fromAmount), 18) === amountToRaw(b.amount, 18), 'Deposit amount changed.');
  requireCheck(typeof swap?.partnerFee === 'number' && Number.isFinite(swap.partnerFee) && Math.abs(swap.partnerFee - b.platformFeePercent) < 1e-10, 'Order fee differs from the reviewed quote.');
  requireCheck(evm(swap.depositAddress) && swap.depositAddress.toLowerCase() !== b.sourceAddress.toLowerCase(), 'Invalid deposit address.');
  requireCheck(order.exchangeInfo.memoRequired !== true && (swap.tx?.memo === null || swap.tx?.memo === ''), 'Memo route requires separate review.');
  requireCheck(swap.tx?.from?.toLowerCase() === b.sourceAddress.toLowerCase() && swap.tx?.to?.toLowerCase() === swap.depositAddress.toLowerCase(), 'Deposit transaction address mismatch.');
  requireCheck(swap.tx?.data === null || swap.tx?.data === '0x' || swap.tx?.data === '', 'Unexpected contract call.');
  requireCheck(typeof swap.tx?.value === 'string' && /^0x[0-9a-f]+$/i.test(swap.tx.value) && BigInt(swap.tx.value) === BigInt(amountToRaw(b.amount, 18)), 'Deposit transaction amount mismatch.');
  return { checksPassed: true, executionEnabled: false, message: 'Response checks passed; deposit expiry, refund terms, persistence and source gas still require validation.' };
}

export function reviewRocketXStatus(body: any, b: Binding) {
  validateBinding(b); validateAssets(body, b);
  requireCheck(body?.requestId === b.requestId, 'Wrong order status.');
  requireCheck(body?.destinationAddress?.toLowerCase() === b.destinationAddress.toLowerCase(), 'Wrong receiving address.');
  requireCheck(amountToRaw(String(body.originTokenAmount), 18) === amountToRaw(b.amount, 18), 'Wrong source amount.');
  const base = { deliveryVerified: false, refundVerified: false, executionEnabled: false };
  if (body.status === 'failed' || body.subState === 'invalid') return { ...base, phase: 'needs-help', label: 'Needs attention', message: 'Do not send again. Check the source transaction and request help through RocketX. A refund is not confirmed.' };
  if (!['pending', 'success'].includes(body.status)) return { ...base, phase: 'unknown', label: 'Status unavailable', message: 'Keep the order reference. Do not resend while the status is unknown.' };
  const phases = {
    transaction_pending: ['created', 'Order created'], pending: ['awaiting-deposit', 'Waiting for deposit'],
    approved: ['deposit-received', 'Deposit received by provider'], executed: ['exchanged', 'Exchange completed'],
    withdrawal: ['sending', 'Provider sending SUI'], withdraw_success: ['receipt-pending', 'Provider reports sent · Sui receipt unverified'],
  };
  const phase = phases[body.subState];
  if (!phase || (body.status === 'success' && body.subState !== 'withdraw_success')) return { ...base, phase: 'unknown', label: 'Status needs verification', message: 'Provider fields are incomplete or inconsistent. Do not resend.' };
  if (body.subState === 'withdraw_success' && !/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(body.destinationTransactionHash || '')) return { ...base, phase: 'unknown', label: 'Sui transaction reference missing', message: 'Provider success alone does not confirm delivery.' };
  return { ...base, phase: phase[0], label: phase[1], message: 'Provider status only. Confirm the Sui transaction, recipient and credited native SUI before reporting arrival.' };
}
