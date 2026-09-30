import { createHash, randomUUID } from 'node:crypto';
export const DIRECT_CONTINUE = Object.freeze({
  product: 'treeforce89.continue.v1', policyVersion: 'treeforce89-20000-tree-v1',
  network: 'sui:mainnet', chainIdentifier: '35834a8a', decimals: 6,
  coinType: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  recipient: '0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f',
  requiredRaw: '20000000000', quantity: 1, restoreLives: 3,
});
const fail = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
const id = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const address = v => typeof v === 'string' && /^0x[a-f0-9]{64}$/.test(v) && !/^0x0+$/.test(v);
export const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' :
  v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v);
export const commitment = value => createHash('sha256').update(stable(value)).digest('hex');
export function validateFixedContinueTerms(t) {
  fail(t?.kind === 'direct-continue', 'not-direct-continue');
  for (const [key, value] of Object.entries(DIRECT_CONTINUE)) fail(t[key] === value, 'wrong-fixed-continue-' + key);
  for (const key of ['orderId', 'accountId', 'runId']) fail(id(t[key]), 'invalid-' + key);
  fail(address(t.payer) && t.payer !== DIRECT_CONTINUE.recipient, 'invalid-payer');
  fail(address(t.checkoutPackage) && address(t.checkoutId) && t.checkoutId !== t.checkoutPackage, 'invalid-deployment');
  fail(t.eventType === `${t.checkoutPackage}::checkout::Purchase` && /^[1-9][0-9]*$/.test(t.keyEpoch || ''), 'invalid-checkout-context');
  fail(/^[a-f0-9]{64}$/.test(t.flightHash || ''), 'invalid-flight-hash');
  fail(Number.isSafeInteger(t.issuedAtMs) && t.issuedAtMs > 0 && Number.isSafeInteger(t.expiresAtMs) &&
    t.expiresAtMs - t.issuedAtMs === 45000, 'invalid-fixed-quote-window');
  const allowed = ['kind', ...Object.keys(DIRECT_CONTINUE), 'orderId', 'accountId', 'runId', 'payer', 'checkoutPackage',
    'checkoutId', 'eventType', 'keyEpoch', 'flightHash', 'issuedAtMs', 'expiresAtMs', 'quoteHash'];
  fail(Object.keys(t).length === allowed.length && Object.keys(t).every(k => allowed.includes(k)), 'unexpected-direct-terms');
  const { quoteHash, ...rest } = t;
  fail(typeof quoteHash === 'string' && commitment(rest) === quoteHash, 'order-commitment-mismatch');
  return t;
}
/** No market price, CC issuance or bonus. The flight is supplied by trusted server state. */
export function createFixedContinueTerms({ actor, flight, deployment, metadata, now = Date.now(), orderId = randomUUID() }) {
  fail(actor?.authenticated === true && actor.wallet?.family === 'sui' && id(actor.accountId), 'sui-sign-in-required');
  fail(flight?.accountId === actor.accountId && id(flight.runId) && flight.lives === 0 && flight.continuesUsed === 0 &&
    flight.finished !== true && flight.ruleset === 'treeforce89.v1', 'ineligible-flight');
  fail(metadata?.network === DIRECT_CONTINUE.network && metadata.coinType === DIRECT_CONTINUE.coinType && metadata.decimals === 6,
    'verified-tree-metadata-required');
  fail(deployment?.network === DIRECT_CONTINUE.network, 'mainnet-deployment-required');
  const terms = { kind: 'direct-continue', ...DIRECT_CONTINUE, orderId, accountId: actor.accountId, runId: flight.runId,
    payer: actor.wallet.address, checkoutPackage: deployment.packageId, checkoutId: deployment.checkoutId,
    eventType: `${deployment.packageId}::checkout::Purchase`, keyEpoch: deployment.keyEpoch,
    flightHash: flight.checkpointHash, issuedAtMs: now, expiresAtMs: now + 45000 };
  terms.quoteHash = commitment(terms);
  return Object.freeze(validateFixedContinueTerms(terms));
}
export function publicContinueOrder(terms, envelope, payable = false) {
  validateFixedContinueTerms(terms);
  return { orderId: terms.orderId, runId: terms.runId, accountId: terms.accountId, payer: terms.payer,
    product: terms.product, network: terms.network, coinType: terms.coinType, recipient: terms.recipient,
    amountRaw: terms.requiredRaw, decimals: terms.decimals, lives: terms.restoreLives, payable,
    terms, quoteBase64: envelope?.quoteBase64, signatureBase64: envelope?.signatureBase64 };
}
