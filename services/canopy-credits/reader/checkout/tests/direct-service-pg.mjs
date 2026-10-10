/** Disposable database integration for the direct receipt connection.
 * PostgreSQL, quote signatures, BCS decoding and service code are real.
 * Identity, checkpoint approval, node responses and deployment IDs are fixtures.
 * No transaction is signed/submitted and no hosted database is reachable here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { MAINNET, createMainnetReader } from '../../../mainnet-reader.mjs';
import { DIRECT_CONTINUE as P } from '../../../continue-product.mjs';
import { createDirectContinueService } from '../../../direct-continue-service.mjs';
import { postgresDirectRepository } from '../../../direct-continue-repository.mjs';
import { createFlightStorage } from '../../../flight-storage.mjs';
import { createPaidDelivery, withPaidDelivery } from '../../../paid-delivery.mjs';
import { createDirectReceiptReader } from '../direct-receipt-reader.mjs';
import { Purchase, quoteFields } from '../codec.mjs';
import { authorizeQuoteForReview, validateQuoteEnvelope } from '../quote-authority.mjs';

if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST) || process.env.PGDATABASE !== 'direct_receipt_ci') {
  throw Error('Only an empty disposable loopback direct_receipt_ci database is allowed');
}
const require = createRequire(process.env.DIRECT_TEST_PACKAGE || import.meta.url);
const { Pool } = require('pg');
const pool = new Pool({ max: 16 });
const settings = { authOrigin: 'https://direct-binding-ci.example', environment: 'release-candidate' };
const storage = createFlightStorage(pool, settings);
const now = 1800000000000, D = MAINNET.genesisDigest;
const stamp = ms => ({ seconds: BigInt(Math.floor(ms / 1000)), nanos: (ms % 1000) * 1000000 });
const hex = () => randomBytes(32).toString('hex');
function digest() {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = randomBytes(32); bytes[0] |= 128;
  let n = BigInt('0x' + bytes.toString('hex')), out = '';
  while (n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; }
  return out;
}
const scopedDelivery = { async query(sql, params) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); await db.query('SET LOCAL ROLE tree_continue_delivery');
    const result = await db.query(sql, params); await db.query('COMMIT'); return result;
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
} };
const delivery = createPaidDelivery(scopedDelivery, settings);
async function fixture() {
  const keys = generateKeyPairSync('ed25519');
  const deployment = { network: P.network, packageId: '0x' + '3'.repeat(64), checkoutId: '0x' + '4'.repeat(64),
    initialSharedVersion: '1', keyEpoch: '1', quotePublicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex') };
  const actor = { authenticated: true, identityMappingReviewed: true, ...settings,
    accountId: randomUUID(), wallet: { family: 'sui', address: '0x' + hex() } };
  const runId = randomUUID(), snapshot = { format: 'treeforce89.checkpoint.v1', ruleset: 'treeforce89.v1',
    runId, wave: 3, score: 17649, lives: 0, continuesUsed: 0, scene: { codec: 'formation-recovery.v1' } };
  await storage.register(actor, runId);
  const checkpoint = await storage.save(actor, runId, randomUUID(), snapshot);
  // Fixture approval only; production gameplay validation is a separate gate.
  await pool.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','explicit-direct-binding-ci-fixture',$2)", [checkpoint.checkpointId, hex()]);
  const state = { terms: null, reads: 0, signatures: 0, digest: digest(), offline: false, underpaid: false, noCheckpoint: false };
  const reader = createDirectReceiptReader({ deployment, connect: options => createMainnetReader({
    getServiceInfo: async () => ({ response: { chain: 'mainnet', chainId: D, checkpointHeight: 1n, timestamp: stamp(now + 2000) } }),
    getCoinInfo: async () => ({ response: { coinType: P.coinType, metadata: { id: '0x' + '5'.repeat(64), decimals: 6, name: 'Thickquidity', symbol: 'Tree' } } }),
    getTransaction: async request => {
      state.reads++; if (state.offline) throw Error('ci-node-offline'); assert.equal(request.digest, state.digest);
      const terms = state.terms, { domain, ...q } = quoteFields(terms, deployment);
      const transaction = { digest: state.digest, checkpoint: 1n, timestamp: stamp(now + 2000), transaction: { sender: terms.payer },
        effects: { digest: D, transactionDigest: state.digest, status: { success: true }, eventsDigest: D },
        events: { digest: D, events: [{ packageId: deployment.packageId, sender: terms.payer, eventType: terms.eventType,
          contents: { value: Purchase.serialize({ schema_version: 1, ...q, paid_at_ms: String(now + 1000) }).toBytes() } }] },
        balanceChanges: [{ address: terms.payer, coinType: P.coinType, amount: '-' + P.requiredRaw },
          { address: P.recipient, coinType: P.coinType, amount: state.underpaid ? '1' : P.requiredRaw }] };
      if (state.noCheckpoint) delete transaction.checkpoint;
      return { response: { transaction } };
    },
    getCheckpoint: async () => ({ response: { checkpoint: { sequenceNumber: 1n, digest: D,
      summary: { timestamp: stamp(now + 2000), contentDigest: D },
      contents: { digest: D, transactions: [{ transaction: state.digest, effects: D }] } } } }),
  }, { now: () => now + 2000, decodeReceipt: options.decodeReceipt }) });
  const config = { paymentsEnabled: true, deployment, metadata: { network: P.network, coinType: P.coinType, decimals: 6 } };
  // Fixture repository is database owner; this test does not establish future
  // production order/settlement role separation. Delivery does use its role.
  const purchases = createDirectContinueService({ repository: postgresDirectRepository(pool),
    resolveFlight: (a, r) => storage.resolveValidatedFlight(a, r), loadConfiguration: async () => config,
    authorizeQuote: async (terms, d) => { state.signatures++; return authorizeQuoteForReview(terms, d, keys.privateKey); },
    verifyPayment: reader.verifyPayment, now: () => now });
  const service = withPaidDelivery(purchases, delivery);
  const command = (action, extras = {}) => ({ action, runId, requestId: randomUUID(), ...extras });
  const ordered = await service(actor, command('order')); state.terms = ordered.order.terms;
  return { actor, runId, checkpoint, state, deployment, config, service, command, ordered,
    reconcile: () => service(actor, command('reconcile', { orderId: ordered.order.orderId, digest: state.digest })) };
}
async function row(f) {
  return (await pool.query('SELECT state,evidence,receipt_id,envelope FROM tree_continue_v1.orders WHERE order_id=$1', [f.ordered.order.orderId])).rows[0];
}
async function receiptCount(f) {
  return (await pool.query('SELECT count(*)::int n FROM tree_continue_v1.receipts WHERE order_id=$1', [f.ordered.order.orderId])).rows[0].n;
}

await test('direct receipt adapter through actual PostgreSQL purchase and delivery services', async t => {
  try {
    await pool.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
    for (const file of ['direct-continue-schema.sql', 'migrations/flight-storage-v1.sql', 'migrations/paid-delivery-v1.sql']) {
      await pool.query(await readFile(new URL('../../../' + file, import.meta.url), 'utf8'));
    }
    await t.test('persisted order has the actual exact-price signed envelope, but no receipt', async () => {
      const f = await fixture(), saved = await row(f);
      assert.equal(f.ordered.order.amountRaw, '20000000000'); assert.equal(saved.state, 'ordered'); assert.equal(saved.evidence, null);
      assert.equal(validateQuoteEnvelope(f.state.terms, f.deployment, saved.envelope, now + 1000).signature.length, 64);
      assert.equal(f.state.signatures, 1); assert.equal(await receiptCount(f), 0);
    });
    await t.test('actual BCS verification stores receipt once and never directly authorizes lives', async () => {
      const f = await fixture(), result = await f.reconcile();
      assert.equal(result.status, 'verified'); assert.equal(result.authorization, null);
      assert.equal(result.deliveryProtocol, 'tree-paid-delivery.v1'); assert.equal((await row(f)).evidence.amountRaw, P.requiredRaw);
      assert.equal(await receiptCount(f), 1);
    });
    await t.test('concurrent verification retries retain one receipt and one quote', async () => {
      const f = await fixture(); const results = await Promise.all(Array.from({ length: 10 }, () => f.reconcile()));
      assert.ok(results.every(r => r.status === 'verified')); assert.equal(await receiptCount(f), 1);
      assert.equal(f.state.signatures, 1); assert.equal(f.state.reads, 1);
    });
    await t.test('underpayment rolls back receipt writes; corrected fixture retries the same order', async () => {
      const f = await fixture(); f.state.underpaid = true;
      await assert.rejects(f.reconcile(), /effects-mismatch/); assert.equal(await receiptCount(f), 0); assert.equal((await row(f)).state, 'ordered');
      f.state.underpaid = false; assert.equal((await f.reconcile()).status, 'verified');
      assert.equal(await receiptCount(f), 1); assert.equal(f.state.signatures, 1);
    });
    await t.test('node outage preserves the existing order without manufacturing success', async () => {
      const f = await fixture(); f.state.offline = true;
      await assert.rejects(f.reconcile(), /ci-node-offline/); assert.equal(await receiptCount(f), 0);
      f.state.offline = false; assert.equal((await f.reconcile()).status, 'verified'); assert.equal(f.state.signatures, 1);
    });
    await t.test('missing chain checkpoint cannot become a paid entitlement', async () => {
      const f = await fixture(); f.state.noCheckpoint = true;
      await assert.rejects(f.reconcile(), /checkpoint/); assert.equal(await receiptCount(f), 0);
      const result = await f.service(f.actor, { action: 'prepare_delivery', runId: f.runId, clientKey: hex() });
      assert.equal(result.status, 'awaiting-verification'); assert.equal(result.restoreAuthorized, false);
    });
    await t.test('paused new sales still allow exact receipt recovery and one-time delivery', async () => {
      const f = await fixture(); f.config.paymentsEnabled = false;
      await assert.rejects(f.service(f.actor, f.command('order')), /checkout-not-enabled/);
      await f.reconcile(); const clientKey = hex();
      const prepared = await f.service(f.actor, { action: 'prepare_delivery', runId: f.runId, clientKey });
      const command = { action: 'activate_delivery', runId: f.runId, clientKey,
        leaseId: prepared.leaseId, requestId: randomUUID(), checkpointHash: prepared.checkpointHash };
      const first = await f.service(f.actor, command), retry = await f.service(f.actor, command);
      assert.equal(first.restoreAuthorized, true); assert.equal(first.lives, 3); assert.equal(first.replay, false); assert.equal(retry.replay, true);
      assert.equal((await row(f)).state, 'delivered'); assert.equal(await receiptCount(f), 1);
      const count = (await pool.query("SELECT count(*)::int n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'", [f.ordered.order.orderId])).rows[0].n;
      assert.equal(count, 1); assert.equal(f.state.signatures, 1);
    });
  } finally { await pool.end(); }
});
