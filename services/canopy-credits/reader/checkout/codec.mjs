/** Draft exact BCS interface. No deployed package is assumed or registered here. */
import { bcs } from '@mysten/sui/bcs';
import { check, uuid, uint, address, validateStoredTerms, TREE_TYPE, NETWORK, CC_SALES_RECIPIENT } from '../../mainnet-payment.mjs';
export const DOMAIN = 'TREE_CC_CHECKOUT_V1:sui:mainnet';
export const Quote = bcs.struct('Quote', {
  domain: bcs.vector(bcs.u8()), checkout_id: bcs.Address, key_epoch: bcs.u64(),
  order_id: bcs.vector(bcs.u8()), account_id: bcs.vector(bcs.u8()),
  payer: bcs.Address, recipient: bcs.Address, coin_type: bcs.string(), amount_raw: bcs.u64(),
  issued_at_ms: bcs.u64(), expires_at_ms: bcs.u64(), quote_hash: bcs.vector(bcs.u8()),
});
export const Purchase = bcs.struct('Purchase', {
  schema_version: bcs.u8(), checkout_id: bcs.Address, key_epoch: bcs.u64(),
  order_id: bcs.vector(bcs.u8()), account_id: bcs.vector(bcs.u8()),
  payer: bcs.Address, recipient: bcs.Address, coin_type: bcs.string(), amount_raw: bcs.u64(),
  issued_at_ms: bcs.u64(), expires_at_ms: bcs.u64(), quote_hash: bcs.vector(bcs.u8()), paid_at_ms: bcs.u64(),
});
export const bytesHex = bytes => Buffer.from(bytes).toString('hex');
export const idBytes = id => Uint8Array.from(Buffer.from(uuid(id).replaceAll('-', ''), 'hex'));
function idString(bytes) {
  check(bytes.length === 16, 'invalid-receipt-uuid-length');
  const h = bytesHex(bytes);
  return uuid(`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`);
}
export function deploymentConfig(d) {
  check(d && d.network === NETWORK, 'mainnet-deployment-required');
  address(d.packageId); address(d.checkoutId);
  check(d.packageId !== d.checkoutId, 'invalid-checkout-object');
  check(uint(d.initialSharedVersion) > 0n && uint(d.keyEpoch) > 0n, 'configured-checkout-required');
  check(typeof d.quotePublicKey === 'string' && /^[a-f0-9]{64}$/.test(d.quotePublicKey) && !/^0+$/.test(d.quotePublicKey), 'quote-public-key-required');
  return d;
}
export function quoteFields(terms, deployment) {
  const d = deploymentConfig(deployment);
  validateStoredTerms(terms);
  check(terms.checkoutPackage === d.packageId && terms.eventType === `${d.packageId}::checkout::Purchase`, 'checkout-package-mismatch');
  check(terms.chainIdentifier === '35834a8a' && terms.decimals === 6, 'mainnet-metadata-mismatch');
  check(terms.expiresAtMs - terms.issuedAtMs <= 45000, 'quote-window-too-long');
  return {
    domain: [...new TextEncoder().encode(DOMAIN)], checkout_id: d.checkoutId, key_epoch: d.keyEpoch,
    order_id: [...idBytes(terms.orderId)], account_id: [...idBytes(terms.accountId)],
    payer: terms.payer, recipient: CC_SALES_RECIPIENT, coin_type: TREE_TYPE,
    amount_raw: terms.requiredRaw, issued_at_ms: String(terms.issuedAtMs), expires_at_ms: String(terms.expiresAtMs),
    quote_hash: [...Buffer.from(terms.quoteHash, 'hex')],
  };
}
export function encodeQuote(terms, deployment) { return Quote.serialize(quoteFields(terms, deployment), { maxSize: 512 }).toBytes(); }
export function exactBase64(value, maxBytes = 1024) {
  check(typeof value === 'string' && value.length <= Math.ceil(maxBytes/3)*4 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'invalid-base64');
  const bytes = Buffer.from(value, 'base64');
  check(bytes.length <= maxBytes && bytes.toString('base64') === value, 'noncanonical-base64');
  return bytes;
}
/** Manual, server-side registration is required after the actual deployment is reviewed.
 * A matching-looking event JSON object alone is intentionally never decoded as payment.
 */
export function createCheckoutReceiptCodec(deployment) {
  const d = Object.freeze({ ...deploymentConfig(deployment) });
  const eventType = `${d.packageId}::checkout::Purchase`;
  return Object.freeze({ eventType, decode(event) {
    check(event?.type === eventType && event.packageId === d.packageId, 'unexpected-receipt-package');
    const bytes = exactBase64(event.bcsBase64, 512);
    const p = Purchase.parse(bytes);
    check(Buffer.from(Purchase.serialize(p, { maxSize: 512 }).toBytes()).equals(bytes), 'noncanonical-receipt-bcs');
    check(p.schema_version === 1 && p.checkout_id === d.checkoutId, 'wrong-receipt-version-or-instance');
    // Accept a prior key epoch for settlement after an operator rotation; the stored order
    // and actual contract authenticate payment. Never accept an epoch newer than this snapshot.
    check(uint(p.key_epoch) > 0n && uint(p.key_epoch) <= uint(d.keyEpoch), 'unknown-receipt-key-epoch');
    address(p.payer); check(p.payer !== CC_SALES_RECIPIENT, 'invalid-receipt-payer');
    check(p.recipient === CC_SALES_RECIPIENT && p.coin_type === TREE_TYPE, 'wrong-receipt-payment');
    check(uint(p.amount_raw, (1n<<64n)-1n) > 0n && p.quote_hash.length === 32, 'invalid-receipt-amount-or-hash');
    const issued = uint(p.issued_at_ms), expires = uint(p.expires_at_ms), paid = uint(p.paid_at_ms);
    check(expires > issued && expires-issued <= 45000n && paid >= issued && paid <= expires, 'receipt-outside-quote-window');
    return Object.freeze({ orderId: idString(p.order_id), accountId: idString(p.account_id), payer: p.payer,
      recipient: p.recipient, coinType: p.coin_type, amountRaw: p.amount_raw, quoteHash: bytesHex(p.quote_hash),
      checkoutId: p.checkout_id, keyEpoch: p.key_epoch, issuedAtMs: p.issued_at_ms,
      expiresAtMs: p.expires_at_ms, paidAtMs: p.paid_at_ms });
  } });
}
