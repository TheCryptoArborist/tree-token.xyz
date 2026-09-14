/** Server-side quote authorization only. Not a Sui wallet/treasury signer.
 * No key is generated, loaded from env, or persisted by this module.
 * Production service/allowlist/pricing wiring is deliberately absent.
 */
import { createPublicKey, sign, verify } from 'node:crypto';
import { check } from '../../mainnet-payment.mjs';
import { encodeQuote, deploymentConfig, exactBase64 } from './codec.mjs';
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
function publicKey(d) {
  return createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(d.quotePublicKey, 'hex')]), type: 'spki', format: 'der' });
}
export function authorizeQuoteForReview(terms, deployment, quotePrivateKey) {
  const d = deploymentConfig(deployment);
  check(quotePrivateKey?.type === 'private' && quotePrivateKey.asymmetricKeyType === 'ed25519', 'ed25519-quote-key-required');
  const actual = createPublicKey(quotePrivateKey).export({ type: 'spki', format: 'der' });
  check(actual.equals(publicKey(d).export({ type: 'spki', format: 'der' })), 'wrong-quote-authority');
  const bytes = encodeQuote(terms, d);
  const signature = sign(null, bytes, quotePrivateKey);
  return Object.freeze({ quoteBase64: Buffer.from(bytes).toString('base64'), signatureBase64: signature.toString('base64'), payable: false });
}
export function validateQuoteEnvelope(terms, deployment, envelope, now = Date.now()) {
  const d = deploymentConfig(deployment), expected = Buffer.from(encodeQuote(terms, d));
  check(Number.isSafeInteger(now) && now >= terms.issuedAtMs && now <= terms.expiresAtMs, 'quote-expired-or-not-yet-valid');
  const bytes = exactBase64(envelope?.quoteBase64, 512), signature = exactBase64(envelope?.signatureBase64, 64);
  check(expected.equals(bytes), 'quote-envelope-mismatch');
  check(signature.length === 64 && verify(null, bytes, publicKey(d), signature), 'invalid-quote-authorization');
  return { bytes: Uint8Array.from(bytes), signature: Uint8Array.from(signature) };
}
