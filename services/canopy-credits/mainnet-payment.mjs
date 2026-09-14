/** Backend-only foundation. No signer, wallet calls, transaction submission or HTTP route. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { CC_SALES_RECIPIENT } from './sales-recipient.mjs';
export { CC_SALES_RECIPIENT };
export const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const NETWORK = 'sui:mainnet';
export const LIVE_CHECKOUT_ENABLED = false;
const I64 = 9223372036854775807n, U64 = 18446744073709551615n;
export function check(ok, code) { if (!ok) throw new Error(code); }
export function uuid(v) { check(typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v), 'invalid-uuid'); return v; }
export function uint(v, max=I64) { check(typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v), 'invalid-integer'); const n=BigInt(v); check(n<=max,'integer-overflow'); return n; }
export function address(v) { check(typeof v==='string' && /^0x[0-9a-f]{64}$/.test(v), 'invalid-canonical-address'); check(!/^0x0+$/.test(v),'zero-address'); return v; }
export function canonical(v) {
  if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  if (v && typeof v==='object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  check(v!==undefined && (typeof v!=='number'||Number.isSafeInteger(v)), 'invalid-canonical-value');
  return JSON.stringify(v);
}
export const hash = v => createHash('sha256').update(canonical(v)).digest('hex');
function keyCheck(key) { check(key instanceof Uint8Array && key.byteLength>=32,'signing-key-required'); }
export function signQuote(terms,key) { keyCheck(key); return createHmac('sha256',key).update('TREE_CC_ORDER_V1\n'+canonical(terms)).digest('base64url'); }
export function verifyQuote(terms,signature,key) {
  if(typeof signature!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(signature))return false;
  const expected=signQuote(terms,key); return timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
function configCheck(c) {
  check(c?.network===NETWORK && c.coinType===TREE_TYPE,'wrong-payment-network-or-coin');
  address(c.recipient); address(c.checkoutPackage);
  check(c.recipient===CC_SALES_RECIPIENT,'unapproved-sales-recipient');
  check(c.eventType===`${c.checkoutPackage}::checkout::Purchase`,'unreviewed-event-contract');
  check(c.metadataVerified===true && Number.isInteger(c.decimals) && c.decimals>=0 && c.decimals<=18,'verified-coin-metadata-required');
  check(typeof c.policyVersion==='string'&&c.policyVersion.length>0&&c.policyVersion.length<=80,'pricing-policy-required');
  check(Number.isSafeInteger(c.bonusBps)&&c.bonusBps>=0&&c.bonusBps<=10000,'invalid-bonus');
  check(typeof c.chainIdentifier==='string'&&/^[0-9a-f]{8}$/.test(c.chainIdentifier),'chain-identifier-required');
  check(uint(c.maxBaseCC)>0n,'pilot-cap-required');
}
/** Frozen draft terms, not live payment authorization. Recipient is pinned. */
export function draftOrder({accountId,payer,baseCC,orderId=randomUUID()},config,price,key,now=Date.now()) {
  configCheck(config); uuid(accountId); uuid(orderId); address(payer);
  check(payer!==config.recipient,'self-payment-not-supported');
  check(Number.isSafeInteger(now)&&now>0,'invalid-time');
  check(price?.policyVersion===config.policyVersion && price.source==='reviewed-policy','unreviewed-price');
  check(Number.isSafeInteger(price.observedAtMs)&&price.observedAtMs<=now&&now-price.observedAtMs<=30000,'stale-price');
  const rate=uint(price.usdMicroPerTree); check(rate>0n,'invalid-price');
  const base=uint(baseCC); check(base>0n&&base<=uint(config.maxBaseCC),'purchase-cap');
  const bonus=base*BigInt(config.bonusBps)/10000n; check(base+bonus<=I64,'credit-overflow');
  const usd=base*1000n; check(usd<=I64,'usd-overflow');
  const raw=(usd*10n**BigInt(config.decimals)+rate-1n)/rate; check(raw>0n&&raw<=U64,'payment-overflow');
  const terms={orderId,accountId,network:NETWORK,coinType:TREE_TYPE,payer,recipient:config.recipient,eventType:config.eventType,
    checkoutPackage:config.checkoutPackage,chainIdentifier:config.chainIdentifier,decimals:config.decimals,
    baseCC:base.toString(),bonusCC:bonus.toString(),totalCC:(base+bonus).toString(),bonusBps:config.bonusBps,
    usdMicro:usd.toString(),usdMicroPerTree:rate.toString(),priceObservedAtMs:price.observedAtMs,
    requiredRaw:raw.toString(),issuedAtMs:now,expiresAtMs:now+45000,policyVersion:config.policyVersion};
  terms.quoteHash=hash(terms);
  return Object.freeze({terms:Object.freeze(terms),signature:signQuote(terms,key),payable:false});
}
export function validateStoredTerms(t) {
  check(t&&typeof t==='object','missing-order');
  const {quoteHash,...committed}=t; check(/^[a-f0-9]{64}$/.test(quoteHash||'')&&hash(committed)===quoteHash,'order-commitment-mismatch');
  uuid(t.accountId);uuid(t.orderId);address(t.payer);address(t.recipient);address(t.checkoutPackage);
  check(t.recipient===CC_SALES_RECIPIENT,'unapproved-sales-recipient');
  check(t.payer!==t.recipient,'self-payment-not-supported');
  check(t.network===NETWORK&&t.coinType===TREE_TYPE,'wrong-payment-network-or-coin');
  check(t.eventType===`${t.checkoutPackage}::checkout::Purchase`,'unreviewed-event-contract');
  const base=uint(t.baseCC),bonus=uint(t.bonusCC),total=uint(t.totalCC);
  check(base>0n && base+bonus===total,'invalid-credit-terms');
  check(uint(t.requiredRaw,U64)>0n,'invalid-payment-terms');
  check(Number.isSafeInteger(t.issuedAtMs)&&Number.isSafeInteger(t.expiresAtMs)&&t.expiresAtMs>t.issuedAtMs&&t.expiresAtMs-t.issuedAtMs<=60000,'invalid-quote-window');
}
/** Normalized server-only gRPC evidence. No route may accept client-supplied evidence.
 * Checkout BCS must be decoded by the configured package/instance-specific codec.
 */
export async function verifyFromReader(terms,digest,eventIndex,reader) {
  validateStoredTerms(terms);
  check(typeof digest==='string'&&/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(digest),'invalid-digest');
  uint(eventIndex);
  const network=await reader.getNetworkIdentity();
  check(network?.network===NETWORK&&network.chainIdentifier===terms.chainIdentifier,'wrong-chain');
  const tx=await reader.getFinalizedTransaction(digest);
  check(tx?.digest===digest && tx.status==='success' && tx.finalized===true && tx.simulated===false,'unfinalized-or-unsuccessful');
  uint(tx.checkpoint,U64);
  check(Number.isSafeInteger(tx.timestampMs)&&tx.timestampMs>=terms.issuedAtMs,'payment-outside-quote-window');
  check(tx.sender===terms.payer,'payer-mismatch');
  check(Array.isArray(tx.events)&&Array.isArray(tx.balanceChanges),'incomplete-chain-data');
  const selected=tx.events.filter(e=>e.index===eventIndex);check(selected.length===1,'receipt-not-unique');
  const e=selected[0];check(e.type===terms.eventType&&e.packageId===terms.checkoutPackage,'receipt-package-mismatch');
  const expected={orderId:terms.orderId,accountId:terms.accountId,payer:terms.payer,recipient:terms.recipient,coinType:TREE_TYPE,amountRaw:terms.requiredRaw,quoteHash:terms.quoteHash};
  check(e.fields&&Object.entries(expected).every(([k,v])=>e.fields[k]===v),'receipt-fields-mismatch');
  let stamp=tx.timestampMs, receiptContext={};
  if (Object.hasOwn(e.fields,'checkoutId') || Object.hasOwn(e.fields,'paidAtMs')) {
    // The contract's Clock is authoritative for quote expiry. A containing checkpoint
    // can be recorded later than execution; never reject an on-time paid receipt merely
    // because checkpoint inclusion or the worker's observation came after expiry.
    address(e.fields.checkoutId); check(uint(e.fields.keyEpoch)>0n,'invalid-receipt-key-epoch');
    check(e.fields.issuedAtMs===String(terms.issuedAtMs)&&e.fields.expiresAtMs===String(terms.expiresAtMs),'receipt-order-window-mismatch');
    stamp=Number(uint(e.fields.paidAtMs,BigInt(Number.MAX_SAFE_INTEGER)));
    check(stamp<=tx.timestampMs,'receipt-time-after-checkpoint');
    receiptContext={checkoutId:e.fields.checkoutId,keyEpoch:e.fields.keyEpoch,
      checkpointTimestampMs:tx.timestampMs,paymentTimeSource:'checkout-clock'};
  }
  check(stamp>=terms.issuedAtMs&&stamp<=terms.expiresAtMs,'payment-outside-quote-window');
  const delta=who=>tx.balanceChanges.filter(b=>b.owner===who&&b.coinType===TREE_TYPE).reduce((sum,b)=>{
    check(typeof b.amount==='string'&&/^-?(0|[1-9][0-9]*)$/.test(b.amount),'invalid-balance-change');return sum+BigInt(b.amount);
  },0n);
  const amount=uint(terms.requiredRaw,U64);
  check(delta(terms.recipient)===amount&&delta(terms.payer)===-amount,'payment-effects-mismatch');
  const evidence={source:'chain-reader',network:NETWORK,finalized:true,status:'success',digest,eventIndex,checkpoint:tx.checkpoint,
    timestampMs:stamp,eventType:e.type,...expected,...receiptContext};
  evidence.evidenceHash=hash(evidence);
  return Object.freeze(evidence);
}
export function beginLiveCheckout() { throw new Error('mainnet-checkout-disabled-pending-reviewed-activation'); }
