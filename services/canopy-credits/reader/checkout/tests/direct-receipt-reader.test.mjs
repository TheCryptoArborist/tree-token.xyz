/** Real quote encoding/signature checks, exact receipt BCS, reader normalizer,
 * checkpoint matching and direct verifier. All chain responses are fixtures.
 * Keys are ephemeral test keys. No wallet, database or network request occurs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { MAINNET, createMainnetReader } from '../../../mainnet-reader.mjs';
import { DIRECT_CONTINUE as P, createFixedContinueTerms, commitment } from '../../../continue-product.mjs';
import { createDirectReceiptReader } from '../direct-receipt-reader.mjs';
import { Quote, Purchase, quoteFields, encodeQuote } from '../codec.mjs';
import { authorizeQuoteForReview, validateQuoteEnvelope } from '../quote-authority.mjs';
const D = MAINNET.genesisDigest;
const now = 1800000000000;
const addr = n => '0x' + String(n).repeat(64);
const stamp = ms => ({ seconds: BigInt(Math.floor(ms / 1000)), nanos: (ms % 1000) * 1000000 });
function fixture({ orderEpoch = '1', readerEpoch = orderEpoch } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const deployment = { network: P.network, packageId: addr(3), checkoutId: addr(4),
    initialSharedVersion: '1', keyEpoch: orderEpoch, quotePublicKey: keyHex };
  const actor = { authenticated: true, accountId: randomUUID(), wallet: { family: 'sui', address: addr(1) } };
  const flight = { accountId: actor.accountId, runId: randomUUID(), lives: 0, continuesUsed: 0,
    ruleset: 'treeforce89.v1', checkpointHash: 'a'.repeat(64) };
  const terms = structuredClone(createFixedContinueTerms({ actor, flight, deployment,
    metadata: { network: P.network, coinType: P.coinType, decimals: 6 }, now }));
  const { domain, ...quote } = quoteFields(terms, deployment);
  const purchase = { schema_version: 1, ...quote, paid_at_ms: String(now + 1000) };
  const checkpointTime = now + 2000;
  const tx = { digest: D, checkpoint: 1n, timestamp: stamp(checkpointTime), transaction: { sender: terms.payer },
    effects: { digest: D, transactionDigest: D, status: { success: true }, eventsDigest: D },
    events: { digest: D, events: [{ packageId: deployment.packageId, sender: terms.payer,
      eventType: terms.eventType, contents: { value: Purchase.serialize(purchase).toBytes() } }] },
    balanceChanges: [{ address: terms.payer, coinType: P.coinType, amount: '-' + P.requiredRaw },
      { address: P.recipient, coinType: P.coinType, amount: P.requiredRaw }] };
  const checkpoint = { sequenceNumber: 1n, digest: D, summary: { timestamp: stamp(checkpointTime), contentDigest: D },
    contents: { digest: D, transactions: [{ transaction: D, effects: D }] } };
  const network = { network: P.network, chainIdentifier: P.chainIdentifier };
  const metadata = { coinType: P.coinType, decimals: 6 };
  let connections = 0, transactionReads = 0, codecUsed = false, beforeRead = async () => {};
  const readerDeployment = { ...deployment, keyEpoch: readerEpoch };
  const connect = options => {
    connections++; codecUsed = !!options?.decodeReceipt;
    const base = createMainnetReader({
      getServiceInfo: async () => ({ response: { chain: 'mainnet', chainId: D, checkpointHeight: 1n, timestamp: stamp(checkpointTime) } }),
      getCoinInfo: async () => { throw Error('unused-coin-wire-fixture'); },
      getTransaction: async () => { transactionReads++; await beforeRead(); return { response: { transaction: tx } }; },
      getCheckpoint: async () => ({ response: { checkpoint } }),
    }, { now: () => checkpointTime, decodeReceipt: options.decodeReceipt });
    return { ...base, getTreeMetadata: async () => metadata };
  };
  const bridge = createDirectReceiptReader({ deployment: readerDeployment, connect });
  function updatePurchase(patch) {
    Object.assign(purchase, patch);
    tx.events.events[0].contents.value = Purchase.serialize(purchase).toBytes();
  }
  return { terms, deployment, readerDeployment, privateKey, bridge, tx, checkpoint, purchase, metadata, network,
    updatePurchase, get connections() { return connections; }, get transactionReads() { return transactionReads; },
    get codecUsed() { return codecUsed; }, set beforeRead(fn) { beforeRead = fn; } };
}
function recommit(terms, patch) {
  const { quoteHash, ...next } = { ...terms, ...patch };
  return { ...next, quoteHash: commitment(next) };
}

test('direct quote signs the fixed 20,000 TREE and exact order context', () => {
  const f = fixture(), envelope = authorizeQuoteForReview(f.terms, f.deployment, f.privateKey);
  const decoded = Quote.parse(Buffer.from(envelope.quoteBase64, 'base64'));
  assert.equal(decoded.amount_raw, '20000000000'); assert.equal(decoded.checkout_id, f.terms.checkoutId);
  assert.equal(decoded.key_epoch, f.terms.keyEpoch); assert.equal(decoded.recipient, P.recipient);
  assert.equal(envelope.payable, false);
  assert.equal(validateQuoteEnvelope(f.terms, f.deployment, envelope, now + 1000).signature.length, 64);
});
test('different instance in otherwise valid committed terms cannot be silently signed', () => {
  const f = fixture(), changed = recommit(f.terms, { checkoutId: addr(8) });
  assert.throws(() => encodeQuote(changed, f.deployment), /direct-quote-instance-mismatch/);
  assert.throws(() => authorizeQuoteForReview(changed, f.deployment, f.privateKey), /direct-quote-instance-mismatch/);
});
test('different epoch in otherwise valid committed terms cannot be silently signed', () => {
  const f = fixture(), changed = recommit(f.terms, { keyEpoch: '2' });
  assert.throws(() => encodeQuote(changed, f.deployment), /direct-quote-key-epoch-mismatch/);
});
test('rotated signing configuration cannot sign an old order under a new epoch', () => {
  const f = fixture(); assert.throws(() => authorizeQuoteForReview(f.terms, { ...f.deployment, keyEpoch: '2' }, f.privateKey), /direct-quote-key-epoch-mismatch/);
});
test('missing reviewed deployment fails before connecting any reader', () => {
  let called = false; assert.throws(() => createDirectReceiptReader({ connect() { called = true; } }), /deployment/); assert.equal(called, false);
});
test('configured adapter connects once with the exact receipt codec', () => {
  const f = fixture(); assert.equal(f.connections, 1); assert.equal(f.codecUsed, true);
  assert.equal(f.transactionReads, 0); assert.deepEqual(Object.keys(f.bridge).sort(), ['inspect', 'verifyPayment']);
});
test('20,000 TREE BCS receipt passes actual normalizer, checkpoint and verifier', async () => {
  const f = fixture(), result = await f.bridge.verifyPayment(f.terms, D, f.deployment);
  assert.equal(f.transactionReads, 1); assert.equal(result.amountRaw, '20000000000');
  assert.equal(result.orderId, f.terms.orderId); assert.equal(result.checkoutId, f.terms.checkoutId);
  assert.equal(result.finalized, true); assert.equal(result.paymentTimeSource, 'checkout-clock');
  assert.equal(result.timestampMs, now + 1000); assert.equal(result.checkpointTimestampMs, now + 2000);
  assert.equal(Object.hasOwn(result, 'authorization'), false); assert.equal(Object.hasOwn(result, 'restoreAuthorized'), false);
});
test('valid older-epoch receipt remains settleable after signer rotation', async () => {
  const f = fixture({ orderEpoch: '1', readerEpoch: '2' });
  const result = await f.bridge.verifyPayment(f.terms, D, f.readerDeployment); assert.equal(result.keyEpoch, '1');
});
test('inspection never claims payment enablement or gameplay authorization', async () => {
  const f = fixture(), result = await f.bridge.inspect(); assert.equal(result.receiptDecoderConfigured, true);
  assert.equal(result.paymentsEnabled, false); assert.equal(result.restoreAuthorized, false);
  assert.equal(result.requiredRaw, P.requiredRaw); assert.equal(f.transactionReads, 0);
});
test('wrong TREE precision fails inspection', async () => {
  const f = fixture(); f.metadata.decimals = 9; await assert.rejects(f.bridge.inspect(), /metadata/);
});
for (const [name, patch, error] of [
  ['another package', { checkoutPackage: addr(8), eventType: addr(8) + '::checkout::Purchase' }, /deployment-mismatch/],
  ['another checkout', { checkoutId: addr(8) }, /deployment-mismatch/],
  ['future epoch', { keyEpoch: '2' }, /future-key-epoch/],
]) test('receipt adapter rejects ' + name + ' before a transaction read', async () => {
  const f = fixture(); await assert.rejects(f.bridge.verifyPayment(recommit(f.terms, patch), D), error); assert.equal(f.transactionReads, 0);
});
test('runtime configuration change fails closed before a transaction read', async () => {
  const f = fixture(); await assert.rejects(f.bridge.verifyPayment(f.terms, D, { ...f.deployment, quotePublicKey: 'b'.repeat(64) }), /runtime-config-changed/); assert.equal(f.transactionReads, 0);
});
test('caller mutation while the read is pending cannot change the verified order', async () => {
  const f = fixture(), originalHash = f.terms.quoteHash; f.beforeRead = async () => { f.terms.orderId = randomUUID(); f.terms.quoteHash = 'f'.repeat(64); };
  const result = await f.bridge.verifyPayment(f.terms, D); assert.equal(result.quoteHash, originalHash); assert.notEqual(result.orderId, f.terms.orderId);
});
test('caller deployment mutation does not replace the pinned receipt instance', async () => {
  const f = fixture(); f.readerDeployment.checkoutId = addr(9); const result = await f.bridge.verifyPayment(f.terms, D); assert.equal(result.checkoutId, addr(4));
});
test('malformed digest is rejected before any chain request', async () => {
  const f = fixture(); await assert.rejects(f.bridge.verifyPayment(f.terms, 'not-a-digest'), /digest/); assert.equal(f.transactionReads, 0);
});
for (const [name, change, error] of [
  ['failed transaction', f => { f.tx.effects.status.success = false; }, /unsuccessful/],
  ['missing checkpoint', f => { delete f.tx.checkpoint; }, /checkpoint/],
  ['wrong effect inclusion', f => { f.checkpoint.contents.transactions[0].effects = 'A'.repeat(43); }, /effect|checkpoint/],
  ['underpayment', f => { f.tx.balanceChanges[1].amount = '1'; }, /effects-mismatch/],
  ['wrong receipt amount', f => f.updatePurchase({ amount_raw: '1' }), /receipt-fields/],
  ['wrong receipt instance', f => f.updatePurchase({ checkout_id: addr(8) }), /instance/],
  ['wrong receipt payer', f => f.updatePurchase({ payer: addr(8) }), /receipt-fields/],
  ['receipt past expiry', f => f.updatePurchase({ paid_at_ms: String(now + 45001) }), /window/],
  ['receipt after checkpoint', f => f.updatePurchase({ paid_at_ms: String(now + 3000) }), /after-checkpoint/],
  ['wrong commitment', f => f.updatePurchase({ quote_hash: Array(32).fill(255) }), /receipt-fields/],
  ['missing BCS', f => { delete f.tx.events.events[0].contents; }, /bcs|content|receipt|bytes/],
]) test('actual receipt pipeline rejects ' + name, async () => {
  const f = fixture(); change(f); await assert.rejects(f.bridge.verifyPayment(f.terms, D), error);
});
test('node outage propagates as an error, not a fabricated payment result', async () => {
  const f = fixture(); f.beforeRead = async () => { throw Error('reader-offline'); }; await assert.rejects(f.bridge.verifyPayment(f.terms, D), /reader-offline/);
});
