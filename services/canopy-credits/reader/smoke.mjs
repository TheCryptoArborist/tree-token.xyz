/** Explicit, bounded mainnet READS only. Run manually or in the isolated CI job.
 * No recipient balance query, no ledger DB connection, no signer or wallet, no secrets.
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { connectMainnetReader } from './client.mjs';
import { MAINNET } from '../mainnet-reader.mjs';
import { TREE_TYPE, CC_SALES_RECIPIENT, LIVE_CHECKOUT_ENABLED, beginLiveCheckout } from '../mainnet-payment.mjs';
assert.equal(LIVE_CHECKOUT_ENABLED, false);
assert.throws(beginLiveCheckout, /disabled/);
assert.equal(TREE_TYPE, MAINNET.treeType);
const reader = connectMainnetReader();
const network = await reader.getNetworkIdentity();
const metadata = await reader.getTreeMetadata();
const samples = [], seen = new Set();
const latest = await reader.getRecentTransactionDigests();
// At most four checkpoints and twelve transactions, stopping as soon as the
// sample includes a user transaction with events and nonempty balance effects.
for (let back = 0; back < 4 && seen.size < 12; back++) {
  const page = back === 0 ? latest : await reader.getRecentTransactionDigests((BigInt(latest.checkpoint) - BigInt(back)).toString());
  for (const digest of page.digests) {
    if (seen.has(digest)) continue; seen.add(digest);
    const tx = await reader.getFinalizedTransaction(digest);
    assert.equal(tx.digest, digest); assert.equal(tx.finalized, true); assert.equal(tx.simulated, false);
    assert.ok(tx.events.every(e => e.fields === null), 'No receipt codec is registered before contract review');
    samples.push({ digest, status: tx.status, checkpoint: tx.checkpoint, checkpointDigest: tx.checkpointDigest,
      effectsDigest: tx.effectsDigest, timestampMs: tx.timestampMs, sender: tx.sender,
      eventCount: tx.events.length, balanceChangeCount: tx.balanceChanges.length,
      firstEventType: tx.events[0]?.type ?? null,
      finalitySource: tx.finalitySource, recognizedCanopyPurchase: false });
    if (samples.length >= 2 && samples.some(t => t.status === 'success' && t.eventCount > 0 && t.balanceChangeCount > 0)) break;
    if (seen.size >= 12) break;
  }
  if (samples.length >= 2 && samples.some(t => t.status === 'success' && t.eventCount > 0 && t.balanceChangeCount > 0)) break;
}
assert.ok(samples.length >= 2, 'Need at least two actual checkpointed transaction reads');
assert.ok(samples.some(t => t.status === 'success' && t.eventCount > 0 && t.balanceChangeCount > 0), 'Need one actual successful transaction with events and balance changes');
const report = { observedAt: new Date().toISOString(), sdk: '@mysten/sui@2.31.0',
  endpoint: MAINNET.endpoint, network, metadata, approvedSalesRecipient: CC_SALES_RECIPIENT,
  samples, liveCheckoutEnabled: false, transactionsSubmitted: 0, creditsIssued: 0,
  limitations: ['Trusted public RPC endpoint; committee signatures not independently verified.',
    'Samples are ordinary existing transactions, not Canopy Credits purchases.',
    'Checkout receipt codec and contract are not implemented or deployed.',
    'No game, account mapping, ledger, preview balance or production service is modified.'] };
await writeFile('mainnet-read-report.json', JSON.stringify(report, null, 2) + '\n');
console.log('MAINNET_READ_REPORT=' + JSON.stringify(report));
