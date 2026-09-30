// Server-side read-only adapter. Bind inputs to privately persisted order data.
// No public endpoint, browser-provided RPC URL, signing or transaction submission.
import { amountToRaw } from '../../gateway/options.js';
import { reviewRocketXStatus, type Binding } from './gateway-rocketx-review.ts';
const ENDPOINT = 'https://graphql.mainnet.sui.io/graphql';
const MAINNET = '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
export const GATEWAY_RECEIPT_QUERY = `query GatewayReceipt($digest: String!) {
 chainIdentifier
 transaction(digest: $digest) {
  digest
  effects { status timestamp checkpoint { sequenceNumber }
   balanceChanges(first: 50) { pageInfo { hasNextPage } nodes { owner { address } coinType { repr } amount } }
  }
 }
}`;
function incomplete(reason: string) { return { deliveryVerified: false, executionEnabled: false, refundVerified: false, reason }; }
function check(ok: unknown, reason: string): asserts ok { if (!ok) throw Error(reason); }
export function reviewSuiReceipt(payload: any, expected: { digest: string; recipient: string; amountRaw: string; orderCreatedAt: number }, now = Date.now()) {
 try {
  check(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(expected.digest), 'invalid-digest');
  check(/^0x[0-9a-f]{64}$/i.test(expected.recipient) && !/^0x0+$/.test(expected.recipient), 'invalid-recipient');
  check(/^[1-9][0-9]{0,19}$/.test(expected.amountRaw) && BigInt(expected.amountRaw) <= 18446744073709551615n, 'invalid-amount');
  check(Number.isSafeInteger(expected.orderCreatedAt) && expected.orderCreatedAt > 0 && Number.isSafeInteger(now) && now >= expected.orderCreatedAt, 'invalid-order-time');
  check(!payload?.errors?.length && payload?.data?.chainIdentifier === MAINNET, 'unverified-mainnet-response');
  const tx = payload.data.transaction, e = tx?.effects;
  check(tx?.digest === expected.digest, 'transaction-not-found-or-mismatched');
  check(e?.status === 'SUCCESS', 'transaction-not-successful');
  check(Number.isSafeInteger(e.checkpoint?.sequenceNumber) && e.checkpoint.sequenceNumber >= 0, 'checkpoint-unavailable');
  const time = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : NaN;
  check(Number.isFinite(time) && time >= expected.orderCreatedAt && time <= now, 'transaction-outside-order-window');
  const changes = e.balanceChanges;
  check(changes?.pageInfo?.hasNextPage === false && Array.isArray(changes.nodes), 'incomplete-balance-changes');
  const credits = changes.nodes.filter(c => c?.owner?.address?.toLowerCase() === expected.recipient.toLowerCase() && /^0x0*2::sui::SUI$/.test(c?.coinType?.repr || ''));
  check(credits.length === 1 && typeof credits[0].amount === 'string' && /^[1-9][0-9]*$/.test(credits[0].amount) && BigInt(credits[0].amount) === BigInt(expected.amountRaw), 'native-sui-credit-mismatch');
  return { deliveryVerified: true, executionEnabled: false, refundVerified: false, digest: expected.digest, amountRaw: expected.amountRaw, checkpoint: e.checkpoint.sequenceNumber };
 } catch (error) { return incomplete(error.message); }
}
export async function verifyRocketXSuiReceipt(status: any, binding: Binding & { orderCreatedAt: number }, fetcher = fetch, now = Date.now()) {
 let expected;
 try {
  const progress = reviewRocketXStatus(status, binding);
  if (progress.phase !== 'receipt-pending') return incomplete('provider-payout-not-ready');
  if (!Number.isSafeInteger(binding.orderCreatedAt) || binding.orderCreatedAt <= 0 || binding.orderCreatedAt > now) return incomplete('invalid-order-time');
  expected = { digest: status.destinationTransactionHash, recipient: binding.destinationAddress, amountRaw: amountToRaw(String(status.actualAmount), 9), orderCreatedAt: binding.orderCreatedAt };
 } catch { return incomplete('invalid-order-or-payout'); }
 try {
  const response = await fetcher(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: GATEWAY_RECEIPT_QUERY, variables: { digest: expected.digest } }), redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return incomplete('sui-lookup-unavailable');
  return reviewSuiReceipt(await response.json(), expected, now);
 } catch { return incomplete('sui-lookup-unavailable'); }
}
