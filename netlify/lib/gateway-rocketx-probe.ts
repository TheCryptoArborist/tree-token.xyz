import { verify } from 'node:crypto';
import { prepareRocketXOrder, reviewRocketXOrderPair } from './gateway-rocketx-review.ts';
import { isEvmAddress, suiReviewAddress } from '../../gateway/review-core.js';

export function authorizeProbe(data: string, signature: string, publicKey: string, deploy: any, now = Date.now()) {
  if (deploy?.context !== 'deploy-preview' || deploy.published !== false) throw Error('Preview only.');
  if (typeof data !== 'string' || data.length > 2000 || typeof signature !== 'string' || signature.length > 100 || !verify(null, Buffer.from(data), publicKey, Buffer.from(signature, 'base64'))) throw Error('Not authorized.');
  const input = JSON.parse(data);
  if (input.deployId !== deploy.id || input.chain !== 'bsc' || input.amount !== '0.1' || !isEvmAddress(input.sourceAddress) || !suiReviewAddress({ connected: true, address: input.destinationAddress }) || !Number.isFinite(input.expiresAt) || input.expiresAt <= now || input.expiresAt > now + 3600_000) throw Error('Invalid or expired review.');
  return input;
}

// One atomic attempt per deploy. Never retries creation, including after timeouts.
// Store must be private, strongly consistent and deploy-scoped.
export async function runUnfundedProbe(input: any, store: any, apiKey: string, fetcher = fetch) {
  const claim = await store.setJSON('attempt', { phase: 'preparing' }, { onlyIfNew: true });
  if (claim.modified !== true) return await store.get('report', { type: 'json' }) || { phase: 'pending-or-unknown', executionEnabled: false, message: 'An attempt already exists. No duplicate order will be created.' };
  const headers = { 'x-api-key': apiKey, Accept: 'application/json' };
  let phase = 'quote';
  const saveReport = async report => { await store.setJSON('report', report); return report; };
  try {
    const query = new URLSearchParams({ fromToken: 'null', fromNetwork: 'binance', toToken: 'null', toNetwork: 'Sui Mainnet', amount: input.amount, slippage: '1', disableRoutesWithMemo: 'true' });
    const response = await fetcher('https://api.rocketx.exchange/v1/quotation?' + query, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    const quotes = await response.json();
    if (!response.ok || quotes.err || quotes.error) throw Error('Quote unavailable.');
    const fetchedAt = Date.now();
    const candidates = (Array.isArray(quotes.quotes) ? quotes.quotes : []).map(q => {
      try {
        const binding = { chain: 'bsc' as const, amount: input.amount, sourceAddress: input.sourceAddress, destinationAddress: input.destinationAddress, refundAddress: input.sourceAddress, fetchedAt, exchangeId: q.exchangeInfo.id, fromTokenId: q.fromTokenInfo.id, toTokenId: q.toTokenInfo.id, platformFeePercent: q.platformFeeInPercent };
        return { quote: q, binding, request: prepareRocketXOrder(q, binding) };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => Number(b.quote.toAmount) - Number(a.quote.toAmount));
    const selected = candidates[0];
    if (!selected) return await saveReport({ phase: 'no-reviewable-quote', executionEnabled: false, orderCreated: false });
    // Persist the exact intent before the single creation call. Never save credentials.
    await store.setJSON('intent', { binding: selected.binding, request: selected.request });
    await store.setJSON('attempt', { phase: 'creation-started', at: new Date().toISOString() });
    phase = 'creation';
    const created = await fetcher('https://api.rocketx.exchange/v1/swap', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(selected.request), redirect: 'error', signal: AbortSignal.timeout(15_000) });
    const order = await created.json();
    await store.setJSON('creation-response', { httpStatus: created.status, body: order });
    if (!created.ok || order.err || order.error || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order.requestId)) {
      return await saveReport({ phase: 'creation-not-confirmed', executionEnabled: false, orderCreated: null, quotedFeePercent: selected.binding.platformFeePercent, httpStatus: created.status, providerCode: typeof order.code === 'number' ? order.code : null, message: 'Creation was rejected or unconfirmed. No retry or payment was attempted.' });
    }
    phase = 'status';
    const statusResponse = await fetcher('https://api.rocketx.exchange/v1/status?' + new URLSearchParams({ requestId: order.requestId }), { headers, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    const status = await statusResponse.json();
    await store.setJSON('status-response', { httpStatus: statusResponse.status, body: status });
    let review;
    try {
      if (!statusResponse.ok) throw Error('Order status unavailable.');
      review = reviewRocketXOrderPair(order, status, { ...selected.binding, requestId: order.requestId });
    } catch (error) { review = { checksPassed: false, message: error.message }; }
    return await saveReport({ phase: 'reviewed', executionEnabled: false, orderCreated: true, requestId: order.requestId, quotedFeePercent: selected.binding.platformFeePercent, orderFeePercent: typeof order.swap?.partnerFee === 'number' ? order.swap.partnerFee : null, recipientEchoPresent: typeof order.destinationAddress === 'string', statusRecipientMatches: status.destinationAddress?.toLowerCase() === input.destinationAddress.toLowerCase(), ...review, message: review.message + ' No payment or signature was made.' });
  } catch {
    return await saveReport({ phase: phase === 'quote' ? 'quote-unavailable' : 'needs-reconciliation', executionEnabled: false, orderCreated: phase === 'quote' ? false : null, message: 'The check could not finish. Creation will not be retried. No payment was attempted.' });
  }
}
