/** Wire the ACTUAL reader normalizer into the existing verifier using explicit
 * fictional RPC data and a TEST-ONLY event decoder. No RPC or DB is used here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { MAINNET, createMainnetReader } from '../mainnet-reader.mjs';
import { draftOrder, verifyFromReader, TREE_TYPE, CC_SALES_RECIPIENT } from '../mainnet-payment.mjs';
const now = 1800000000000, time = { seconds: BigInt(now / 1000), nanos: 0 }, D = MAINNET.genesisDigest;
const A = n => '0x' + n.repeat(64);
function fixture(decoder = true) {
  const config = { network: MAINNET.network, coinType: TREE_TYPE, recipient: CC_SALES_RECIPIENT, checkoutPackage: A('3'),
    eventType: A('3') + '::checkout::Purchase', metadataVerified: true, decimals: 6, policyVersion: 'FIXTURE-NOT-LIVE-PRICE',
    bonusBps: 1000, chainIdentifier: MAINNET.chainIdentifier, maxBaseCC: '1000' };
  const { terms } = draftOrder({ accountId: randomUUID(), payer: A('1'), baseCC: '1000' }, config,
    { policyVersion: config.policyVersion, source: 'reviewed-policy', observedAtMs: now, usdMicroPerTree: '3000' }, randomBytes(32), now);
  const fields = Object.fromEntries(Object.entries({ orderId: terms.orderId, accountId: terms.accountId, payer: terms.payer,
    recipient: terms.recipient, coinType: TREE_TYPE, amountRaw: terms.requiredRaw, quoteHash: terms.quoteHash })
    .map(([key, value]) => [key, { kind: { oneofKind: 'stringValue', stringValue: value } }]));
  const tx = { digest: D, checkpoint: 1n, timestamp: time, transaction: { sender: terms.payer },
    effects: { digest: D, transactionDigest: D, status: { success: true }, eventsDigest: D },
    events: { digest: D, events: [{ packageId: config.checkoutPackage, sender: terms.payer, eventType: config.eventType,
      contents: { value: new Uint8Array([1]) }, json: { kind: { oneofKind: 'structValue', structValue: { fields } } } }] },
    balanceChanges: [{ address: terms.payer, coinType: TREE_TYPE, amount: '-' + terms.requiredRaw }, { address: terms.recipient, coinType: TREE_TYPE, amount: terms.requiredRaw }] };
  const cp = { sequenceNumber: 1n, digest: D, summary: { timestamp: time, contentDigest: D }, contents: { digest: D, transactions: [{ transaction: D, effects: D }] } };
  const reader = createMainnetReader({
    getServiceInfo: async () => ({ response: { chain: 'mainnet', chainId: D, checkpointHeight: 1n, timestamp: time } }),
    getCoinInfo: async () => { throw Error('No metadata read in this fixture'); },
    getTransaction: async () => ({ response: { transaction: tx } }), getCheckpoint: async () => ({ response: { checkpoint: cp } }),
  }, { now: () => now, decodeReceipt: decoder ? { eventType: config.eventType, decode: event => event.json } : null });
  return { terms, tx, reader };
}
test('checkpointed normalized receipt is compatible with existing verifier', async () => {
  const f = fixture(), evidence = await verifyFromReader(f.terms, D, '0', f.reader);
  assert.equal(evidence.accountId, f.terms.accountId); assert.equal(evidence.amountRaw, f.terms.requiredRaw);
  assert.equal(evidence.recipient, CC_SALES_RECIPIENT); assert.equal(evidence.source, 'chain-reader');
});
test('without a reviewed codec even matching-looking event JSON is rejected', async () => {
  const f = fixture(false); await assert.rejects(verifyFromReader(f.terms, D, '0', f.reader), /fields-mismatch/);
});
test('checkpointed FAILED transaction cannot become a creditable receipt', async () => {
  const f = fixture(); f.tx.effects.status.success = false;
  await assert.rejects(verifyFromReader(f.terms, D, '0', f.reader), /unsuccessful/);
});
test('receipt JSON is insufficient without exact matching received TREE effects', async () => {
  const f = fixture(); f.tx.balanceChanges[1].amount = '1';
  await assert.rejects(verifyFromReader(f.terms, D, '0', f.reader), /effects-mismatch/);
});
